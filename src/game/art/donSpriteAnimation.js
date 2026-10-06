// Dispatch Don animation — 9-frame idle atlases (front: frames 0-6 breathing
// variants, 7 radio-to-ear, 8 pointing/directing), a 9-frame right-facing side
// walk, an 8-frame TRUE left-facing walk (walk-left.png, drawn unmirrored), a
// 4-frame signal atlas (radio-up, radio-up variant, stop-hand x2) for idle
// gestures, and the 8-frame 'Escalate to Field Crew' sequence (crew.png,
// 4 poses per row: the crew arrives, then Don directs them) played once
// across his special timer. Pure frame selection for testability.
export const createDonAnimation=()=>({side:'right',vert:'down',frame:0,clock:0,moving:false,hurt:0,signal:0,crewClock:0});
export function updateDonAnimation(state,dx,dy,dt,definition){
  state.hurt=Math.max(0,state.hurt-dt);
  if(state.signal>0)state.crewClock+=dt;else state.crewClock=0;
  const moving=Math.abs(dx)+Math.abs(dy)>.001;
  if(moving){
    if(Math.abs(dx)>Math.abs(dy))state.side=dx<0?'left':'right';
    else if(dy)state.vert=dy<0?'up':'down';
    if(!state.moving)state.clock=0;
    state.moving=true;state.clock+=dt;
    const cols=state.side==='left'?(definition.walkLeftColumns||definition.columns):definition.columns;
    state.frame=Math.floor(state.clock*(definition.walkFps||10))%cols;
    return;
  }
  if(state.moving){state.moving=false;state.clock=0}
  state.clock+=dt;
}
// Special: while the crew timer runs, the escalation sequence plays once —
// one pose per second (crew arrives, then the directing poses), holding the
// final commanding pose until the special ends.
// Idle: seven breathing frames at idleFps, then the radio-to-ear beat, the
// pointing beat, and a stop-hand beat from the signal atlas, then repeat.
// Horizontal movement walks in profile; vertical movement keeps the last
// profile side. Front/back idle views follow the last vertical direction.
export function donFrame(art,state){
  const d=art.definition;
  if(state.signal>0){
    const frame=Math.min(7,Math.floor(state.crewClock));
    return {image:art.crew,sx:(frame%4)*d.crewFrameW,sy:Math.floor(frame/4)*d.crewFrameH,frameW:d.crewFrameW,frameH:d.crewFrameH,mirror:false};
  }
  if(state.moving){
    if(state.side==='left')return {image:art.walkLeft,sx:state.frame*d.walkLeftFrameW,sy:0,frameW:d.walkLeftFrameW,frameH:d.cellH,mirror:false};
    return {image:art.walk,sx:state.frame*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:true};
  }
  const idleSpan=7/(d.idleFps||5),hold=d.gestureHold||.8,t=state.clock%(idleSpan+3*hold);
  if(t<idleSpan)return {image:state.vert==='up'?art.back:art.atlas,sx:Math.floor(t*(d.idleFps||5))*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:false};
  const step=Math.floor((t-idleSpan)/hold);
  if(step===0)return {image:art.atlas,sx:7*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:false};
  if(step===1)return {image:art.atlas,sx:8*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:false};
  return {image:art.signal,sx:2*d.signalFrameW,sy:0,frameW:d.signalFrameW,frameH:d.cellH,mirror:false};
}
// Foot-anchored like the Oracle: the collision point sits at the character's feet.
export function drawDonSprite(ctx,art,state,x,y){
  const d=art.definition,f=donFrame(art,state),h=d.worldSize,fw=f.frameW||d.cellW,fh=f.frameH||d.cellH,w=h*fw/fh;
  const img=state.hurt>0&&art.hurt&&f.image===art.atlas?art.hurt:f.image;
  const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,f.sx,f.sy,fw,fh,Math.round(x-w*d.anchorX),Math.round(y-h*d.anchorY),Math.round(w),h);
  ctx.imageSmoothingEnabled=previousSmoothing;
}