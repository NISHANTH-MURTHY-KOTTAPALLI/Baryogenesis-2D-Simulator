(() => {
  const { clamp, mulberry32 } = window.SimUtils;
  const Bitset2D = window.Bitset2D;
  const PHASES = { EXPANSION:"EXPANSION", CONTRACTION:"CONTRACTION", BOUNCE:"BOUNCE" };

  function idxToXY(i,w){ const y=(i/w)|0; const x=i-y*w; return [x,y]; }
  function wrap(v,max){ v%=max; if(v<0) v+=max; return v; }
  function gaussFalloff(d2,r2){ if(d2>=r2) return 0; const t=1-(d2/r2); return t*t; }

  class BaryoSim{
    constructor(w,h,seed=123456789){
      this.w=w; this.h=h; this.n=w*h;
      this.seed=seed>>>0; this.rng=mulberry32(this.seed);

      this.M=new Bitset2D(w,h);
      this.A=new Bitset2D(w,h);
      this._X=new Bitset2D(w,h);

      this.T=new Uint8Array(this.n);
      this.E=new Uint8Array(this.n);
      this.eps=new Int16Array(this.n);

      this.phase=PHASES.EXPANSION;
      this.cycle=0; this.ticks=0; this.phaseTicks=0;
      this.phaseDur={ [PHASES.EXPANSION]:10*60, [PHASES.CONTRACTION]:8*60, [PHASES.BOUNCE]:2*60 };

      this.globalEps=0;
      this.freezeOutTemp=28;
      this.baseTemp=40;

      this.operator={ tool:"probe", radius:12, isDown:false, x:0, y:0, lastProbe:null };

      this.mCount=0; this.aCount=0; this.bNet=0;
      this.annihTotal=0; this._annihWindow=0; this._annihWindowTicks=0;

      this.fx={ events:[], maxEvents:500 };
      this.reset();
    }

    reset(seed=null){
      if(seed!==null){ this.seed=seed>>>0; this.rng=mulberry32(this.seed); }
      this.M.clearAll(); this.A.clearAll(); this._X.clearAll();
      this.T.fill(this.baseTemp); this.E.fill(0); this.eps.fill(0);
      this.phase=PHASES.EXPANSION; this.cycle=0; this.ticks=0; this.phaseTicks=0; this.globalEps=0;
      this.fx.events.length=0;

      for(let k=0;k<25;k++){
        const cx=(this.rng()*this.w)|0, cy=(this.rng()*this.h)|0;
        this.applyQuench(cx,cy,12,120,90);
      }
      this._recount();
    }

    setTool(t){ this.operator.tool=t; }
    setPointer(x,y,isDown){
      this.operator.x=clamp(x|0,0,this.w-1);
      this.operator.y=clamp(y|0,0,this.h-1);
      this.operator.isDown=!!isDown;
    }
    setRadius(r){ this.operator.radius=clamp(r|0,2,60); }

    initiateBounce(){
      this.phase=PHASES.BOUNCE; this.phaseTicks=0;
      const cx=(this.rng()*this.w)|0, cy=(this.rng()*this.h)|0;
      this.applyQuench(cx,cy,20,200,140);
      for(let i=0;i<this.n;i++) this.T[i]=clamp(this.T[i]+8,0,255);
      this._pushFx(cx,cy,1.0,"bounce");
    }

    paintEps(cx,cy,radius,deltaScaled,strength=1.0){
      const r2=radius*radius, w=this.w, h=this.h;
      const x0=clamp(cx-radius,0,w-1), x1=clamp(cx+radius,0,w-1);
      const y0=clamp(cy-radius,0,h-1), y1=clamp(cy+radius,0,h-1);
      for(let y=y0;y<=y1;y++){
        const dy=y-cy;
        for(let x=x0;x<=x1;x++){
          const dx=x-cx, d2=dx*dx+dy*dy; if(d2>r2) continue;
          const fall=gaussFalloff(d2,r2)*strength;
          const i=y*w+x;
          let v=this.eps[i] + (deltaScaled*fall);
          v=clamp(v,-2000,2000);
          this.eps[i]=v|0;
        }
      }
      this._pushFx(cx,cy,0.6,"eps");
    }

    applyQuench(cx,cy,radius,tempAdd,energyAdd){
      const r2=radius*radius, w=this.w, h=this.h;
      const x0=clamp(cx-radius,0,w-1), x1=clamp(cx+radius,0,w-1);
      const y0=clamp(cy-radius,0,h-1), y1=clamp(cy+radius,0,h-1);
      for(let y=y0;y<=y1;y++){
        const dy=y-cy;
        for(let x=x0;x<=x1;x++){
          const dx=x-cx, d2=dx*dx+dy*dy; if(d2>r2) continue;
          const fall=gaussFalloff(d2,r2);
          const i=y*w+x;
          this.T[i]=clamp(this.T[i]+tempAdd*fall,0,255);
          this.E[i]=clamp(this.E[i]+energyAdd*fall,0,255);
        }
      }
      this._pushFx(cx,cy,0.9,"quench");
    }

    applyWarp(cx,cy,radius){
      const r2=radius*radius, w=this.w, h=this.h;
      const x0=clamp(cx-radius,0,w-1), x1=clamp(cx+radius,0,w-1);
      const y0=clamp(cy-radius,0,h-1), y1=clamp(cy+radius,0,h-1);
      for(let y=y0;y<=y1;y++){
        const dy=y-cy;
        for(let x=x0;x<=x1;x++){
          const dx=x-cx, d2=dx*dx+dy*dy; if(d2>r2) continue;
          const t=d2/r2;
          const ring=Math.max(0,1-Math.abs(t-0.45)/0.35);
          const i=y*w+x;
          this.T[i]=clamp(this.T[i]+ring*35,0,255);
          this.E[i]=clamp(this.E[i]+ring*25,0,255);
        }
      }
      this._pushFx(cx,cy,0.8,"warp");
    }

    probe(cx,cy,radius){
      const r2=radius*radius, w=this.w, h=this.h;
      const x0=clamp(cx-radius,0,w-1), x1=clamp(cx+radius,0,w-1);
      const y0=clamp(cy-radius,0,h-1), y1=clamp(cy+radius,0,h-1);
      let m=0,a=0,temp=0,eps=0,n=0;
      for(let y=y0;y<=y1;y++){
        const dy=y-cy;
        for(let x=x0;x<=x1;x++){
          const dx=x-cx, d2=dx*dx+dy*dy; if(d2>r2) continue;
          const i=y*w+x;
          m += this.M.getByIndex(i);
          a += this.A.getByIndex(i);
          temp += this.T[i];
          eps += this.eps[i];
          n++;
        }
      }
      return { m,a,net:m-a,temp:n?temp/n:0, eps:n?eps/n:0, n };
    }

    step(steps=1){ for(let s=0;s<steps;s++) this._tick(); this._recount(); }

    _phaseParams(){
      if(this.phase===PHASES.EXPANSION) return { create:1.0, move:1.25, annih:0.85, cool:1.15 };
      if(this.phase===PHASES.CONTRACTION) return { create:1.0, move:0.85, annih:1.25, cool:0.85 };
      return { create:1.8, move:1.1, annih:1.1, cool:0.7 };
    }

    _avgTemp(){
      let sum=0,k=128;
      for(let i=0;i<k;i++) sum += this.T[(this.rng()*this.n)|0];
      return sum/k;
    }

    _tick(){
      this.ticks++; this.phaseTicks++;

      if(this.phase!==PHASES.BOUNCE){
        const dur=this.phaseDur[this.phase];
        if(this.phaseTicks>=dur){
          this.phase = (this.phase===PHASES.EXPANSION) ? PHASES.CONTRACTION : PHASES.EXPANSION;
          this.phaseTicks=0;
          if(this.phase===PHASES.EXPANSION) this.cycle++;
        }
      }else{
        if(this.phaseTicks>=this.phaseDur[PHASES.BOUNCE]){
          this.phase=PHASES.EXPANSION; this.phaseTicks=0; this.cycle++;
        }
      }

      const op=this.operator;
      if(op.isDown){
        if(op.tool==="bias") this.paintEps(op.x,op.y,op.radius,200);
        else if(op.tool==="quench") this.applyQuench(op.x,op.y,Math.max(6,(op.radius*0.6)|0),40,35);
        else if(op.tool==="warp") this.applyWarp(op.x,op.y,Math.max(8,(op.radius*0.8)|0));
      }

      if((this.ticks%6)===0){
        this.operator.lastProbe = this.probe(op.x,op.y,Math.max(6,(op.radius*0.6)|0));
      }

      this._pairCreation();
      this._transportSampled();
      const annih = this._annihilate();
      this._coolingAndDecay(annih);

      this._annihWindow += annih;
      this._annihWindowTicks++;
      if(this._annihWindowTicks>=60){
        this.annihTotal=this._annihWindow;
        this._annihWindow=0; this._annihWindowTicks=0;
      }

      const ev=this.fx.events;
      for(let i=ev.length-1;i>=0;i--){
        ev[i].age++;
        if(ev[i].age>40) ev.splice(i,1);
      }
    }

    _pairCreation(){
      const p=this._phaseParams();
      const avgT=this._avgTemp();
      const freeze = avgT < this.freezeOutTemp;

      let attempts = (60 + avgT*1.2) * p.create;
      if(freeze) attempts *= 0.08;
      attempts = clamp(attempts,10,420);

      const w=this.w;
      const globalEpsScaled=this.globalEps;

      for(let k=0;k<attempts;k++){
        const i=(this.rng()*this.n)|0;
        const m=this.M.getByIndex(i), a=this.A.getByIndex(i);
        if(m && a) continue;
        const t=this.T[i];
        const gate=t/255;
        if(this.rng()>gate) continue;

        const [x,y]=idxToXY(i,w);
        const dir=this._flowDir(x,y);
        const nx=wrap(x+dir[0],this.w), ny=wrap(y+dir[1],this.h);
        const j=ny*w+nx;

        const epsLocalScaled=this.eps[i] + globalEpsScaled;
        const epsBias = clamp(epsLocalScaled/1e6,-0.002,0.002);
        const matterFirst = (this.rng() < (0.5 + epsBias));

        const mi = matterFirst ? i : j;
        const ai = matterFirst ? j : i;

        this.M.setByIndex(mi);
        this.A.setByIndex(ai);

        this.E[i]=clamp(this.E[i]+6,0,255);
        this.T[i]=clamp(this.T[i]+2,0,255);
        this.E[j]=clamp(this.E[j]+6,0,255);
        this.T[j]=clamp(this.T[j]+2,0,255);
      }
    }

    _flowDir(x,y){
      const t=this.ticks*0.01;
      const fx=Math.sin((x*0.11)+t) + Math.cos((y*0.07)-t*1.3);
      const fy=Math.cos((y*0.10)+t*1.1) - Math.sin((x*0.09)-t);

      const cx=this.w*0.5, cy=this.h*0.5;
      const dx0=x-cx, dy0=y-cy;
      const r=Math.sqrt(dx0*dx0+dy0*dy0)+1e-6;
      const outward = (this.phase===PHASES.EXPANSION)?0.35:(this.phase===PHASES.CONTRACTION?-0.35:0.0);

      const vx=fx + outward*(dx0/r);
      const vy=fy + outward*(dy0/r);

      let dx=0,dy=0;
      if(Math.abs(vx)>Math.abs(vy)) dx = vx>0?1:-1;
      else dy = vy>0?1:-1;

      if(this.rng()<0.08) return [0,0];
      return [dx,dy];
    }

    _transportSampled(){
      const p=this._phaseParams();
      const avgT=this._avgTemp();
      const moveRate=clamp((avgT/255)*0.025*p.move,0.002,0.06);

      const occ=this.M.popcount()+this.A.popcount();
      let attempts=(occ*moveRate)|0;
      attempts=clamp(attempts,50,2200);

      const w=this.w;
      for(let k=0;k<attempts;k++){
        const i=(this.rng()*this.n)|0;
        const m=this.M.getByIndex(i), a=this.A.getByIndex(i);
        if(!m && !a) continue;
        if(m && a) continue;

        const [x,y]=idxToXY(i,w);
        const d=this._flowDir(x,y);

        let dx=d[0],dy=d[1];
        if(this.rng()<0.28){
          const r=(this.rng()*4)|0;
          dx = (r===0)?1:(r===1?-1:0);
          dy = (r===2)?1:(r===3?-1:0);
        }
        if(dx===0 && dy===0) continue;

        const nx=wrap(x+dx,this.w), ny=wrap(y+dy,this.h);
        const j=ny*w+nx;

        if(m){
          if(!this.M.getByIndex(j)){
            this.M.clearByIndex(i); this.M.setByIndex(j);
          }
        }else if(a){
          if(!this.A.getByIndex(j)){
            this.A.clearByIndex(i); this.A.setByIndex(j);
          }
        }
      }
    }

    _annihilate(){
      this.M.andInto(this.A,this._X);
      const annihCount=this._X.popcount();
      if(annihCount===0) return 0;

      this.M.andNotInPlace(this._X);
      this.A.andNotInPlace(this._X);

      const maxEvents=450;
      this._X.forEachSetBit((i)=>{
        const [x,y]=idxToXY(i,this.w);
        this.E[i]=clamp(this.E[i]+140,0,255);
        this.T[i]=clamp(this.T[i]+60,0,255);
        const w=this.w;
        if(x>0){ const j=i-1; this.E[j]=clamp(this.E[j]+30,0,255); }
        if(x<w-1){ const j=i+1; this.E[j]=clamp(this.E[j]+30,0,255); }
        if(y>0){ const j=i-w; this.E[j]=clamp(this.E[j]+30,0,255); }
        if(y<this.h-1){ const j=i+w; this.E[j]=clamp(this.E[j]+30,0,255); }
        this._pushFx(x,y,0.7,"annih");
      }, maxEvents);

      return annihCount;
    }

    _coolingAndDecay(){
      const p=this._phaseParams();
      const phaseHeat = (this.phase===PHASES.CONTRACTION)?0.25:(this.phase===PHASES.BOUNCE?0.15:-0.55);
      const cool = 0.9*p.cool;
      const epsDecay = 0.985;

      for(let i=0;i<this.n;i++){
        const t=this.T[i] + phaseHeat + (this.E[i]*0.012) - cool;
        this.T[i]=clamp(t,0,255);
        this.E[i]=clamp(this.E[i]-3,0,255);
        this.eps[i]=(this.eps[i]*epsDecay)|0;
      }

      if(this.phase===PHASES.BOUNCE && (this.phaseTicks%18)===0){
        this.globalEps = clamp(this.globalEps + 2, -50, 50);
      }
    }

    _recount(){
      this.mCount=this.M.popcount();
      this.aCount=this.A.popcount();
      this.bNet=this.mCount-this.aCount;
    }

    _pushFx(x,y,strength,type){
      const arr=this.fx.events;
      arr.push({x,y,strength,type,age:0});
      if(arr.length>this.fx.maxEvents) arr.shift();
    }

    getPhase(){ return this.phase; }

    getAvgTempEstimate(){
      const k=256; let sum=0;
      for(let i=0;i<k;i++) sum += this.T[(this.rng()*this.n)|0];
      return sum/k;
    }

    onToolClick(tool,cx,cy){
      const r=this.operator.radius;
      if(tool==="quench") this.applyQuench(cx,cy,r,160,160);
      else if(tool==="warp") this.applyWarp(cx,cy,r);
      else if(tool==="bounce") this.initiateBounce();
      else if(tool==="bias") this.paintEps(cx,cy,r,320);
    }
  }

  window.BaryoSim = { BaryoSim, PHASES };
})();