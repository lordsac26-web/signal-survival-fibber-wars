// Dispatch Don's field-crew helpers: the four individual crew figures
// extracted from the Don v2 special sheet (the embedded group frame is never
// drawn — see characterSprites.js). Each helper turret (E,S,W,N relative to
// Don) renders its own extracted figure, foot-anchored at the turret point,
// mirrored toward the current target, with a small recoil pulse right after
// each shot. The engine calls this ONLY while the special timer is active;
// the placeholder helper is the mutually exclusive fallback (asset failure),
// never drawn alongside the crew art.
const MAX_H=109; // tallest extracted figure; the others keep their relative art scale
export function drawCrewHelper(ctx,art,t){
  const ci=art.definition.crewInd,frames=ci.frames,f=frames[((t.helperIndex%frames.length)+frames.length)%frames.length];
  const firing=t.fire!=null&&t.fireCd>t.fire*.6;
  const hWorld=ci.worldHeight*f.h/MAX_H,pulse=firing?1.06:1;
  const w=Math.round(hWorld*f.w/f.h*pulse),h=Math.round(hWorld*pulse);
  const mirror=Math.cos(t.lookA||0)<0;
  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  if(mirror){
    ctx.save();ctx.translate(Math.round(t.x),0);ctx.scale(-1,1);ctx.translate(-Math.round(t.x),0);
    ctx.drawImage(art.crewInd,f.x,f.y,f.w,f.h,Math.round(t.x-w/2),Math.round(t.y-h),w,h);
    ctx.restore();
  }else ctx.drawImage(art.crewInd,f.x,f.y,f.w,f.h,Math.round(t.x-w/2),Math.round(t.y-h),w,h);
  ctx.imageSmoothingEnabled=prev;
}