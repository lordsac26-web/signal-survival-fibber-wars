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