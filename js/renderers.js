(() => {
  const { clamp } = window.SimUtils;

  class SheetRenderer{
    constructor(canvas,w,h){
      this.canvas=canvas;
      this.ctx=canvas.getContext("2d",{alpha:false});
      this.ctx.imageSmoothingEnabled=false;
      this.w=w; this.h=h;
      this.imageData=this.ctx.createImageData(w,h);
      this.data=this.imageData.data;
      this.bg=this._makeStarfield(w,h);
      this.bgData=this.bg.data;
    }
    _makeStarfield(w,h){
      const img=new ImageData(w,h);
      const d=img.data;
      for(let i=0;i<w*h;i++){
        const y=(i/w)|0;
        const g=8 + ((y/h)*18);
        d[i*4+0]=3; d[i*4+1]=5; d[i*4+2]=g; d[i*4+3]=255;
      }
      for(let s=0;s<220;s++){
        const x=(Math.random()*w)|0, y=(Math.random()*h)|0;
        const i=y*w+x;
        const b=120 + ((Math.random()*135)|0);
        d[i*4+0]=b; d[i*4+1]=b; d[i*4+2]=b;
      }
      return img;
    }
    draw(sim,phase){
      this.data.set(this.bgData);
      const M=sim.M.words, A=sim.A.words, E=sim.E, T=sim.T, eps=sim.eps;
      const n=sim.n, data=this.data;
      const phaseTint = (phase==="EXPANSION")?[0,10,30]:(phase==="CONTRACTION")?[20,0,25]:[25,15,0];

      for(let i=0;i<n;i++){
        const wi=i>>>5, bi=i&31, mask=(1<<bi);
        const m=(M[wi]&mask)?1:0;
        const a=(A[wi]&mask)?1:0;
        const e=E[i], t=T[i];
        const p=i*4;
        let r=data[p+0], g=data[p+1], b=data[p+2];

        r=clamp(r + phaseTint[0]*0.12,0,255);
        g=clamp(g + phaseTint[1]*0.12,0,255);
        b=clamp(b + phaseTint[2]*0.12,0,255);

        const glow=e*0.45;
        r=clamp(r + glow*0.9,0,255);
        g=clamp(g + glow*0.7,0,255);
        b=clamp(b + glow*0.25,0,255);

        if(m||a){
          if(m && !a){
            r=clamp(r + 160 + (t*0.2),0,255);
            g=clamp(g + 40 + (t*0.1),0,255);
            b=clamp(b + 20,0,255);
          }else if(a && !m){
            r=clamp(r + 25,0,255);
            g=clamp(g + 90 + (t*0.15),0,255);
            b=clamp(b + 175 + (t*0.25),0,255);
          }else{ r=255; g=255; b=255; }
        }else{
          const es=eps[i];
          if(es!==0){
            const s=Math.min(1,Math.abs(es)/2000);
            r=clamp(r + s*18,0,255);
            b=clamp(b + s*22,0,255);
          }
        }

        data[p+0]=r; data[p+1]=g; data[p+2]=b; data[p+3]=255;
      }
      this.ctx.putImageData(this.imageData,0,0);
    }
  }

  class GridOverlay{
    constructor(w,h){
      this.w=w; this.h=h;
      this.canvas=document.createElement("canvas");
      this.canvas.width=w; this.canvas.height=h;
      this.ctx=this.canvas.getContext("2d");
      this._render();
    }
    _render(){
      const ctx=this.ctx;
      ctx.clearRect(0,0,this.w,this.h);
      const minor=4, major=16;
      for(let x=0;x<this.w;x+=minor){
        ctx.fillStyle=(x%major===0)?"rgba(127,194,255,0.18)":"rgba(127,194,255,0.08)";
        ctx.fillRect(x,0,1,this.h);
      }
      for(let y=0;y<this.h;y+=minor){
        ctx.fillStyle=(y%major===0)?"rgba(127,194,255,0.18)":"rgba(127,194,255,0.08)";
        ctx.fillRect(0,y,this.w,1);
      }
    }
  }

  class OverlayRenderer{
    constructor(canvas,w,h){
      this.canvas=canvas;
      this.ctx=canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled=false;
      this.w=w; this.h=h;
      this.grid=new GridOverlay(w,h);
      this.showGrid=true; this.showOverlays=true;
    }
    setToggles({showGrid,showOverlays}){
      if(typeof showGrid==="boolean") this.showGrid=showGrid;
      if(typeof showOverlays==="boolean") this.showOverlays=showOverlays;
    }
    draw(sim){
      const ctx=this.ctx;
      ctx.clearRect(0,0,this.w,this.h);

      if(this.showGrid) ctx.drawImage(this.grid.canvas,0,0);

      if(this.showOverlays){
        const sample=280;
        for(let k=0;k<sample;k++){
          const i=(Math.random()*sim.n)|0;
          const x=i%sim.w, y=(i/sim.w)|0;
          const tt=sim.T[i]/255;
          if(tt>0.4){
            ctx.fillStyle=`rgba(255,209,102,${0.08*tt})`;
            ctx.fillRect(x,y,1,1);
          }
          const ee=sim.E[i]/255;
          if(ee>0.3){
            ctx.fillStyle=`rgba(255,255,255,${0.06*ee})`;
            ctx.fillRect(x,y,1,1);
          }
        }

        const op=sim.operator;
        const r=op.radius;
        ctx.strokeStyle="rgba(127,194,255,0.85)";
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.arc(op.x+0.5,op.y+0.5,r,0,Math.PI*2);
        ctx.stroke();

        ctx.strokeStyle="rgba(255,255,255,0.65)";
        ctx.beginPath();
        ctx.moveTo(op.x-4,op.y+0.5); ctx.lineTo(op.x+5,op.y+0.5);
        ctx.moveTo(op.x+0.5,op.y-4); ctx.lineTo(op.x+0.5,op.y+5);
        ctx.stroke();

        const rr=Math.max(6,(r*0.6)|0);
        const x0=Math.max(0,op.x-rr), x1=Math.min(sim.w-1,op.x+rr);
        const y0=Math.max(0,op.y-rr), y1=Math.min(sim.h-1,op.y+rr);
        const r2=rr*rr;
        for(let y=y0;y<=y1;y++){
          const dy=y-op.y;
          for(let x=x0;x<=x1;x++){
            const dx=x-op.x, d2=dx*dx+dy*dy;
            if(d2>r2) continue;
            const i=y*sim.w+x;
            const es=sim.eps[i];
            if(es===0) continue;
            const s=Math.min(1,Math.abs(es)/2000);
            ctx.fillStyle = es>0 ? `rgba(99,255,138,${0.12*s})` : `rgba(255,107,107,${0.12*s})`;
            ctx.fillRect(x,y,1,1);
          }
        }

        const ev=sim.fx.events;
        for(let i=0;i<ev.length;i++){
          const e=ev[i];
          const age=e.age/40;
          const alpha=(1-age)*0.55;
          const rad=1 + (age*18*e.strength);
          if(e.type==="annih") ctx.strokeStyle=`rgba(255,255,255,${alpha})`;
          else if(e.type==="quench") ctx.strokeStyle=`rgba(255,209,102,${alpha})`;
          else if(e.type==="eps") ctx.strokeStyle=`rgba(99,255,138,${alpha})`;
          else if(e.type==="warp") ctx.strokeStyle=`rgba(127,194,255,${alpha})`;
          else ctx.strokeStyle=`rgba(255,209,102,${alpha})`;
          ctx.beginPath();
          ctx.arc(e.x+0.5,e.y+0.5,rad,0,Math.PI*2);
          ctx.stroke();
        }
      }
    }
  }

  window.SimRenderers = { SheetRenderer, OverlayRenderer };
})();