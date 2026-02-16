(() => {
  const { hashStringToSeed } = window.SimUtils;
  const { BaryoSim } = window.BaryoSim;

  function getSeed(){
    const url=new URL(window.location.href);
    const sp=url.searchParams.get("seed");
    if(sp===null || sp===""){
      const saved=localStorage.getItem("sim_baryo_seed");
      if(saved) return (parseInt(saved,10)>>>0);
      const s=(Math.random()*0xFFFFFFFF)>>>0;
      localStorage.setItem("sim_baryo_seed",String(s));
      return s;
    }
    const n=Number(sp);
    if(!Number.isNaN(n) && Number.isFinite(n)) return (n>>>0);
    return hashStringToSeed(sp);
  }

  const STAGE_W = 960;
  const STAGE_H = 800;

  function computeFitScale(w,h){
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const viewportEl = document.querySelector('.viewport');
    let padX = 48, padY = 48;
    if(viewportEl){
      const cs = getComputedStyle(viewportEl);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      padX = pl + pr;
      padY = pt + pb;
    }

    const FOOTER_RESERVE = 32;
    const SAFE = 24;

    const availW = Math.max(240, vw - padX - SAFE);
    const availH = Math.max(240, vh - padY - FOOTER_RESERVE - SAFE);

    const s = Math.min(availW / w, availH / h);
    const candidate = Math.max(0.55, Math.min(2.0, s));
    return Math.round(candidate * 100) / 100;
  }

  function getScaleOverride(){
    const url = new URL(window.location.href);
    const sp = url.searchParams.get("scale") || 1;
    if(!sp) return null;
    const n = Number(sp);
    if(!Number.isFinite(n)) return null;
    if(n === 0) return null;
    return Math.min(3, Math.max(0.55, n));
  }

  const seed=getSeed();
  const canvas=document.getElementById("gameCanvas");
  const overlayCanvas=document.getElementById("overlayCanvas");
  const root=document.getElementById("gameRoot");

  const sim=new BaryoSim(canvas.width, canvas.height, seed);
  const engine=new window.SimEngine(sim, canvas, overlayCanvas);
  const ui=new window.SimUI(sim, engine);
  engine.attachUI(ui);

  function applyScale(){
    const fit = computeFitScale(STAGE_W, STAGE_H);
    const override = getScaleOverride();
    const scale = override ? Math.min(override, fit) : fit;
    root.style.setProperty("--scale", String(scale));
  }
  applyScale();
  window.addEventListener("resize", applyScale);

  engine.setOverlayToggles({
    showGrid: document.getElementById("toggleGrid").checked,
    showOverlays: document.getElementById("toggleOverlays").checked,
  });
  engine.setPaused(document.getElementById("togglePause").checked);

  engine.start();
})();