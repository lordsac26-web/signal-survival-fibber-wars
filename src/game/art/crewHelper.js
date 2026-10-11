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
// Measured hand/muzzle point per extracted crew figure (box-local, from the
// box's TOP-LEFT, right-facing art): the weapon tip inside the chest band,
// from the same pixel pass that produced the figures (muzzleAudit.test.mjs).
// Mirrors horizontally exactly like drawCrewHelper does, so the shot always
// leaves the drawn hand.
const CREW_MUZZLE=[[42,34],[32,32],[46,30],[35,40]];
export function crewMuzzle(ci,t){
  const i=((t.helperIndex%4)+4)%4,f=ci.frames[i],hW=ci.worldHeight*f.h/MAX_H,s=hW/f.h,w=hW*f.w/f.h;
  const [lx,ly]=CREW_MUZZLE[i];
  return[Math.cos(t.lookA||0)<0?t.x+w/2-lx*s:t.x-w/2+lx*s,t.y-hW+ly*s];
}