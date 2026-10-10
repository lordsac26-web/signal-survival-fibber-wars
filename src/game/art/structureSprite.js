// Bucket-Truck turret drawing — static vehicle art from the user-supplied sheet.
// The three tiles are near-duplicate poses of the same truck (per the asset
// manifest), so the only motion is a slow ~1.5s/frame idle cycle between them;
// it reads as a subtle idle wobble, never a boom sweep or target tracking.
// Drawn centered on the structure point with the manifest's ground baseline
// (tile-local y=174, wheel contact) sitting on it; no mirroring and no googly
// eyes — this one is a literal truck, unlike the other structures.
export function truckFrame(definition,born){
  if(!(definition.idleCycle>1))return {sx:0,sy:0};
  return {sx:Math.floor(Math.max(0,born||0)*definition.fps)%definition.idleCycle*definition.tileW,sy:0};
}
export function drawTruckTurret(ctx,art,born,x,y,grow=1){
  const d=art.definition,{sx,sy}=truckFrame(d,born);
  const scale=d.worldSize*Math.max(.2,Math.min(1,grow||1))/d.tileW;
  const w=Math.round(d.tileW*scale),h=Math.round(d.tileH*scale);
  const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(art.atlas,sx,sy,d.tileW,d.tileH,Math.round(x-w/2),Math.round(y-d.anchorY*scale),w,h);
  ctx.imageSmoothingEnabled=previousSmoothing;
}

// Pedestal Turret — multi-strip animated turret with 4 states:
// deploy (9f, ~1.5s), rotate/aim idle (8f, looping), fire (7f, on shoot),
// retract (9f, last 1.5s of life). Each strip is foot-aligned (baselineY)
// and center-anchored (anchorX). Mirrors horizontally when aiming left.
// State priority: retract > deploy > fire > rotate.
const PT_FPS={deploy:6,rotate:4,fire:10,retract:6};
const PT_DEPLOY_DUR=9/PT_FPS.deploy;
const PT_RETRACT_DUR=9/PT_FPS.retract;

export function drawPedestalTurret(ctx,art,st,x,y,grow=1){
  const d=art.definition,strips=d.strips;
  const born=st.born||0,life=st.life||0;
  const growClamped=Math.max(.2,Math.min(1,grow||1));
  const scale=d.worldSize*growClamped/strips.deploy.cellW;

  // Determine animation state + frame index
  let stripName,frameIdx,loop=false;
  const retractT=Math.max(0,PT_RETRACT_DUR-life);
  if(life>0&&life<=PT_RETRACT_DUR){
    stripName='retract';frameIdx=Math.min(Math.floor(retractT*PT_FPS.retract),strips.retract.columns-1);
  }else if(born<PT_DEPLOY_DUR){
    stripName='deploy';frameIdx=Math.min(Math.floor(born*PT_FPS.deploy),strips.deploy.columns-1);
  }else if(st.fireCd!=null&&st.fire!=null&&st.fireCd>st.fire*.6){
    // fire animation plays in the first ~40% of the fire cooldown window
    stripName='fire';
    const fireT=(1-st.fireCd/st.fire)*st.fire;
    frameIdx=Math.min(Math.floor(fireT*PT_FPS.fire),strips.fire.columns-1);
  }else{
    stripName='rotate';loop=true;frameIdx=Math.floor((born-PT_DEPLOY_DUR)*PT_FPS.rotate)%strips.rotate.columns;
  }

  const strip=strips[stripName];
  const cellW=strip.cellW,cellH=strip.cellH,fi=frameIdx;
  const baselineY=strip.baselineY;

  // Mirror when aiming left
  const aim=st.lookA||0;
  const mirror=Math.cos(aim)<0;

  const w=Math.round(cellW*scale),h=Math.round(cellH*scale);
  const drawY=Math.round(y-baselineY*scale);
  const src=stripName==='deploy'?art.atlas:art[stripName];

  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  if(mirror){
    ctx.save();
    ctx.translate(Math.round(x),0);
    ctx.scale(-1,1);
    ctx.translate(-Math.round(x),0);
    ctx.drawImage(src,fi*cellW,0,cellW,cellH,Math.round(x-w/2),drawY,w,h);
    ctx.restore();
  }else{
    ctx.drawImage(src,fi*cellW,0,cellW,cellH,Math.round(x-w/2),drawY,w,h);
  }
  ctx.imageSmoothingEnabled=prev;
}