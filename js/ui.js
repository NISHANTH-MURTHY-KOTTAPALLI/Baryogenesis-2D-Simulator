(() => {
  const { clamp } = window.SimUtils;

  class Sparkline{
    constructor(canvas,maxPoints=140){
      this.canvas=canvas;
      this.ctx=canvas.getContext("2d");
      this.maxPoints=maxPoints;
      this.values=new Float32Array(maxPoints);
      this.values2=new Float32Array(maxPoints);
      this.idx=0; this.count=0;
    }
    push(v1,v2=0){
      this.values[this.idx]=v1;
      this.values2[this.idx]=v2;
      this.idx=(this.idx+1)%this.maxPoints;
      this.count=Math.min(this.maxPoints,this.count+1);
    }
    draw(mode="single"){
      const ctx=this.ctx, w=this.canvas.width, h=this.canvas.height;
      ctx.clearRect(0,0,w,h);
      const n=this.count; if(n<2) return;

      let min=Infinity,max=-Infinity;
      for(let k=0;k<n;k++){
        const i=(this.idx-n+k+this.maxPoints)%this.maxPoints;
        const v=this.values[i];
        min=Math.min(min,v); max=Math.max(max,v);
        if(mode==="double"){
          const v2=this.values2[i];
          min=Math.min(min,v2); max=Math.max(max,v2);
        }
      }
      if(min===max){ min-=1; max+=1; }
      const sx=w/(n-1);
      const mapY=(v)=>{ const t=(v-min)/(max-min); return h-2 - t*(h-4); };

      ctx.strokeStyle="rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.moveTo(0,h-1); ctx.lineTo(w,h-1); ctx.stroke();

      ctx.strokeStyle="rgba(99,255,138,0.85)";
      ctx.beginPath();
      for(let k=0;k<n;k++){
        const i=(this.idx-n+k+this.maxPoints)%this.maxPoints;
        const x=k*sx, y=mapY(this.values[i]);
        if(k===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();

      if(mode==="double"){
        ctx.strokeStyle="rgba(127,194,255,0.85)";
        ctx.beginPath();
        for(let k=0;k<n;k++){
          const i=(this.idx-n+k+this.maxPoints)%this.maxPoints;
          const x=k*sx, y=mapY(this.values2[i]);
          if(k===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }
  }

  class SimUI{
    constructor(sim,engine){
      this.sim=sim; this.engine=engine;
      this.canvas=document.getElementById("gameCanvas");

      this.toolButtons=[...document.querySelectorAll(".tool-btn")];
      this.speedButtons=[...document.querySelectorAll(".speed-row .small-btn")];

      this.toggleGrid=document.getElementById("toggleGrid");
      this.toggleOverlays=document.getElementById("toggleOverlays");
      this.togglePause=document.getElementById("togglePause");

      this.cyclePill=document.getElementById("cyclePill");
      this.phasePill=document.getElementById("phasePill");
      this.tempBar=document.getElementById("tempBar");
      this.seedPill=document.getElementById("seedPill");
      this.epsPill=document.getElementById("epsPill");
      this.speedPill=document.getElementById("speedPill");

      this.matterCount=document.getElementById("matterCount");
      this.antiCount=document.getElementById("antiCount");
      this.netCount=document.getElementById("netCount");
      this.annihRate=document.getElementById("annihRate");

      this.bounceBtn=document.getElementById("bounceBtn");

      this.helpOverlay=document.getElementById("helpOverlay");
      this.helpBtn=document.getElementById("helpBtn");
      this.closeHelp=document.getElementById("closeHelp");

      this.modal=document.getElementById("modal");
      this.modalTitle=document.getElementById("modalTitle");
      this.modalText=document.getElementById("modalText");
      this.modalCancel=document.getElementById("modalCancel");
      this.modalOk=document.getElementById("modalOk");
      this.modalHint=document.getElementById("modalHint");

      this.exportReplayBtn=document.getElementById("exportReplay");
      this.importReplayBtn=document.getElementById("importReplay");
      this.resetBtn=document.getElementById("resetRun");

      this.spark1=new Sparkline(document.getElementById("sparkline"),140);
      this.spark2=new Sparkline(document.getElementById("sparkline2"),140);

      this.recording=true;
      this.replay=null;
      this.events=[];
      this.tool="probe";
      this.toolRadius=12;

      this._bindUI();
      this._bindInput();
      this._refreshToolButtons();
      this._setSeedDisplay();
    }

    _bindUI(){
      this.toolButtons.forEach(btn=>{
        btn.addEventListener("click",()=> this.setTool(btn.dataset.tool));
      });

      this.speedButtons.forEach(btn=>{
        btn.addEventListener("click",()=>{
          const s=parseFloat(btn.dataset.speed);
          this.engine.setSpeed(s);
          this.speedButtons.forEach(b=>b.classList.toggle("is-selected",b===btn));
          this.speedPill.textContent=`SPD: ${s}×`;
        });
      });

      this.toggleGrid.addEventListener("change",()=>this.engine.setOverlayToggles({showGrid:this.toggleGrid.checked}));
      this.toggleOverlays.addEventListener("change",()=>this.engine.setOverlayToggles({showOverlays:this.toggleOverlays.checked}));
      this.togglePause.addEventListener("change",()=>this.engine.setPaused(this.togglePause.checked));

      this.bounceBtn.addEventListener("click",()=>this._fireBounce());

      this.helpBtn.addEventListener("click",()=>this.showHelp(true));
      this.closeHelp.addEventListener("click",()=>this.showHelp(false));
      this.helpOverlay.addEventListener("click",(e)=>{ if(e.target===this.helpOverlay) this.showHelp(false); });

      this.exportReplayBtn.addEventListener("click",()=>this._openExport());
      this.importReplayBtn.addEventListener("click",()=>this._openImport());
      this.resetBtn.addEventListener("click",()=>this._resetRun());

      this.modalCancel.addEventListener("click",()=>this._closeModal());
    }

    _bindInput(){
      const getPos=(evt)=>{
        const rect=this.canvas.getBoundingClientRect();
        const x=((evt.clientX-rect.left)/rect.width)*this.sim.w;
        const y=((evt.clientY-rect.top)/rect.height)*this.sim.h;
        return [clamp(x|0,0,this.sim.w-1), clamp(y|0,0,this.sim.h-1)];
      };

      this.canvas.addEventListener("mousemove",(evt)=>{
        const [x,y]=getPos(evt);
        this.sim.setPointer(x,y,this.sim.operator.isDown);
      });

      this.canvas.addEventListener("mousedown",(evt)=>{
        const [x,y]=getPos(evt);
        this.sim.setPointer(x,y,true);
        this.sim.onToolClick(this.tool,x,y);
        this._recordEvent("click",{tool:this.tool,x,y,r:this.toolRadius});
      });

      window.addEventListener("mouseup",()=>{ this.sim.operator.isDown=false; });

      this.canvas.addEventListener("wheel",(evt)=>{
        evt.preventDefault();
        const delta=Math.sign(evt.deltaY);
        this.toolRadius=clamp(this.toolRadius + delta*2,2,60);
        this.sim.setRadius(this.toolRadius);
        this._recordEvent("radius",{r:this.toolRadius});
      },{passive:false});

      window.addEventListener("keydown",(evt)=>{
        if(this.modal && !this.modal.hidden) return;
        
        if (evt.ctrlKey) {
          if(evt.key==="1") this.setTool("probe");
          else if(evt.key==="2") this.setTool("bias");
          else if(evt.key==="3") this.setTool("quench");
          else if(evt.key==="4") this.setTool("warp");
          else if(evt.key==="5") this.setTool("bounce");
        }

        if (evt.shiftKey) {
          if(evt.key==="g"||evt.key==="G"){
            this.toggleGrid.checked=!this.toggleGrid.checked;
            this.engine.setOverlayToggles({showGrid:this.toggleGrid.checked});
          }else if(evt.key==="o"||evt.key==="O"){
            this.toggleOverlays.checked=!this.toggleOverlays.checked;
            this.engine.setOverlayToggles({showOverlays:this.toggleOverlays.checked});
          }
        }

        if(evt.key===" "){
          evt.preventDefault();
          this.togglePause.checked=!this.togglePause.checked;
          this.engine.setPaused(this.togglePause.checked);
        }
        
        if(evt.key==="h"||evt.key==="H"){
          this.showHelp(this.helpOverlay.hidden);
        }else if(evt.key==="Enter"){
          this._fireBounce();
        }else if(evt.key==="r"||evt.key==="R"){
          this._resetRun();
        }
      });
    }

    setTool(tool){
      this.tool=tool;
      this.sim.setTool(tool);
      this._refreshToolButtons();
      this._recordEvent("tool",{tool});
    }

    _refreshToolButtons(){
      this.toolButtons.forEach(btn=>btn.classList.toggle("is-selected",btn.dataset.tool===this.tool));
      this.sim.setRadius(this.toolRadius);
    }

    showHelp(on){ this.helpOverlay.hidden=!on; }

    _setSeedDisplay(){ this.seedPill.textContent=`SEED: ${this.sim.seed}`; }

    _fireBounce(){ this.sim.initiateBounce(); this._recordEvent("bounce",{}); }

    _resetRun(){
      const seed=this.sim.seed;
      this.sim.reset(seed);
      this.events=[]; this.replay=null;
      this._recordEvent("reset",{seed});
    }

    _recordEvent(type,payload){
      if(!this.recording) return;
      if(this.replay && this.replay.mode==="play") return;
      const tick=this.engine.tickCount;
      this.events.push({t:tick,type,...payload});
    }

    _openExport(){
      const replay={ seed:this.sim.seed, version:1, events:this.events.slice(0) };
      this._openModal({
        title:"Export replay JSON",
        hint:"Copy this JSON somewhere safe. Import it to replay the exact operator interventions (seed + events).",
        text:JSON.stringify(replay,null,2),
        okText:"Copy to clipboard",
        onOk: async ()=>{
          try{
            await navigator.clipboard.writeText(this.modalText.value);
            this._closeModal();
          }catch(e){
            this.modalHint.textContent="Clipboard blocked by browser. Copy manually.";
          }
        }
      });
    }

    _openImport(){
      this._openModal({
        title:"Import replay JSON",
        hint:"Paste a previously exported replay JSON here, then press OK to start replay mode.",
        text:"",
        okText:"Start replay",
        onOk: ()=>{
          try{
            const obj=JSON.parse(this.modalText.value);
            if(!obj || !obj.events || typeof obj.seed!=="number") throw new Error("bad");
            this._closeModal();
            this._startReplay(obj);
          }catch(e){
            this.modalHint.textContent="Invalid JSON. Please paste a valid replay export.";
          }
        }
      });
    }

    _startReplay(obj){
      this.replay={ mode:"play", seed:obj.seed>>>0, events:obj.events||[], idx:0 };
      this.recording=false;
      this.sim.reset(this.replay.seed);
      this.engine.setPaused(false);
      this.togglePause.checked=false;
    }

    onTick(){
      if(this.replay && this.replay.mode==="play"){
        const tick=this.engine.tickCount;
        while(this.replay.idx < this.replay.events.length && this.replay.events[this.replay.idx].t <= tick){
          const ev=this.replay.events[this.replay.idx++];
          this._applyReplayEvent(ev);
        }
        if(this.replay.idx >= this.replay.events.length){
          this.replay=null; this.recording=true;
        }
      }

      if((this.engine.tickCount%6)===0){
        this.spark1.push(this.sim.bNet);
        this.spark2.push(this.sim.mCount, -this.sim.aCount);
      }
    }

    _applyReplayEvent(ev){
      if(ev.type==="tool") this.setTool(ev.tool);
      else if(ev.type==="radius"){ this.toolRadius=clamp(ev.r|0,2,60); this.sim.setRadius(this.toolRadius); }
      else if(ev.type==="click") this.sim.onToolClick(ev.tool,ev.x|0,ev.y|0);
      else if(ev.type==="bounce") this.sim.initiateBounce();
      else if(ev.type==="reset") this.sim.reset(ev.seed>>>0);
    }

    renderHUD(){
      this.cyclePill.textContent=`CYCLE: ${this.sim.cycle}`;
      this.phasePill.textContent=`PHASE: ${this.sim.getPhase()}`;

      const avgT=this.sim.getAvgTempEstimate();
      const pct=clamp((avgT/255)*100,0,100);
      this.tempBar.style.width=`${pct}%`;

      this.matterCount.textContent=String(this.sim.mCount);
      this.antiCount.textContent=String(this.sim.aCount);
      this.netCount.textContent=String(this.sim.bNet);
      this.netCount.classList.toggle("good",this.sim.bNet>=0);
      this.netCount.classList.toggle("bad",this.sim.bNet<0);
      this.annihRate.textContent=String(this.sim.annihTotal);

      const probe=this.sim.operator.lastProbe;
      if(probe){
        const eps=(probe.eps/1e6);
        this.epsPill.textContent=`ε: ${eps.toFixed(6)}`;
      }

      this.spark1.draw("single");
      this.spark2.draw("double");
    }

    _openModal({title,hint,text,okText,onOk}){
      this.modal.hidden=false;
      this.modalTitle.textContent=title;
      this.modalHint.textContent=hint||"";
      this.modalText.value=text||"";
      this.modalOk.textContent=okText||"OK";
      this.modalText.focus();
      this.modalOk.onclick=null;
      this.modalOk.onclick=onOk;
    }

    _closeModal(){
      this.modal.hidden=true;
      this.modalText.value="";
      this.modalHint.textContent="";
    }
  }

  window.SimUI = SimUI;
})();