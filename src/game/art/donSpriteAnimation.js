// Dispatch Don animation — 9-frame idle atlases (front: frames 0-6 breathing
// variants, 7 radio-to-ear, 8 pointing/directing), 9-frame side walk
// (right-facing, mirrored for left), and a 4-frame signal atlas (radio-up,
// radio-up variant, stop-hand x2) held while his 'Escalate to Field Crew'
// special is active. Pure frame selection for testability.
export const createDonAnimation=()=>({side:'right',vert:'down',frame:0,clock:0,moving:false,hurt:0,signal:0});
export function updateDonAnimation(state,dx,dy,dt,definition){
  state.hurt=Math.max(0,state.hurt-dt);
  const moving=Math.abs(dx)+Math.abs(dy)>.001;
  if(moving){
    if(Math.abs(dx)>Math.abs(dy))state.side=dx<0?'left':'right';
    else if(dy)state.vert=dy<0?'up':'down';
    if(!state.moving)state.clock=0;
    state.moving=true;state.clock+=dt;
    state.frame=Math.floor(state.clock*(definition.walkFps||10))%definition.columns;
    return;
  }
  if(state.moving){state.moving=false;state.clock=0}
  state.clock+=dt;
}
// Idle: seven breathing frames at idleFps, then the radio-to-ear beat, the
// pointing beat, and a stop-hand beat from the signal atlas, then repeat.
// Horizontal movement walks in profile; vertical movement keeps the last
// profile side. Front/back idle views follow the last vertical direction.
export function donFrame(art,state){
  const d=art.definition;
  if(state.signal>0)return {image:art.signal,sx:0,sy:0,mirror:false};
  if(state.moving)return {image:art.walk,sx:state.frame*d.cellW,sy:0,mirror:state.side==='left'};
  const idleSpan=7/(d.idleFps||5),hold=d.gestureHold||.8,t=state.clock%(idleSpan+3*hold);
  if(t<idleSpan)return {image:state.vert==='up'?art.back:art.atlas,sx:Math.floor(t*(d.idleFps||5))*d.cellW,sy:0,mirror:false};
  const step=Math.floor((t-idleSpan)/hold);
  if(step===0)return {image:art.atlas,sx:7*d.cellW,sy:0,mirror:false};
  if(step===1)return {image:art.atlas,sx:8*d.cellW,sy:0,mirror:false};
  return {image:art.signal,sx:2*d.signalFrameW,sy:0,mirror:false};
}
// Foot-anchored like the Oracle: the collision point sits at the character's feet.
export function drawDonSprite(ctx,art,state,x,y){
  const d=art.definition,f=donFrame(art,state),h=d.worldSize,w=h*d.cellW/d.cellH;
  const img=state.hurt>0&&art.hurt&&f.image===art.atlas?art.hurt:f.image;
  const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,f.sx,f.sy,d.cellW,d.cellH,Math.round(x-w*d.anchorX),Math.round(y-h*d.anchorY),Math.round(w),h);
  ctx.imageSmoothingEnabled=previousSmoothing;
}