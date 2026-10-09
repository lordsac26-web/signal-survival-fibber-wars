// Unified technician sprite animation for Veteran, Clone, Don v2, Nomad, and
// the Dirty-Connector Blob enemy. Handles idle (with gesture frames), walk
// (right/left true art), attack, and special activation. Pure frame selection
// for testability; VFX (glow, aura, jitter) drawn by the engine on top.
export const createTechAnimation=()=>({side:'right',vert:'down',frame:0,clock:0,moving:false,hurt:0,special:0,attack:0,vfxClock:0});
export function updateTechAnimation(state,dx,dy,dt,definition){
  state.hurt=Math.max(0,state.hurt-dt);
  state.attack=Math.max(0,state.attack-dt);
  state.vfxClock+=dt;
  const moving=Math.abs(dx)+Math.abs(dy)>.001;
  if(moving){
    if(Math.abs(dx)>Math.abs(dy))state.side=dx<0?'left':'right';
    else if(dy)state.vert=dy<0?'up':'down';
    if(!state.moving)state.clock=0;
    state.moving=true;state.clock+=dt;
    const cols=state.side==='left'?(definition.walkLeftColumns||definition.columns):definition.walkColumns;
    state.frame=Math.floor(state.clock*(definition.walkFps||10))%cols;
    return;
  }
  if(state.moving){state.moving=false;state.clock=0}
  state.clock+=dt;
}
// Special: play special frames in sequence while the special timer runs.
// Attack: play attack frames synced to the fire moment.
// Idle: 6 breathing frames at idleFps, then 3 gesture beats (radio/point/drink)
// held for gestureHold seconds each, then repeat.
// Walk: true left-facing art when moving left; right-facing walk when moving right.
export function techFrame(art,state){
  const d=art.definition;
  if(state.special>0){
    const cols=d.specialColumns||1;
    const fps=d.specialFps||3;
    const frame=Math.min(cols-1,Math.floor(state.vfxClock*fps));
    return {image:art.special,sx:frame*d.specialCellW,sy:0,frameW:d.specialCellW,frameH:d.specialCellH,mirror:false};
  }
  if(state.attack>0){
    const cols=d.attackColumns||1;
    const elapsed=(d.attackDuration||.4)-state.attack;
    const frame=Math.min(cols-1,Math.floor(elapsed*(d.attackFps||12)));
    return {image:art.attack,sx:frame*d.attackCellW,sy:0,frameW:d.attackCellW,frameH:d.attackCellH,mirror:false};
  }
  if(state.moving){
    if(state.side==='left')return {image:art.walkLeft,sx:state.frame*d.walkLeftCellW,sy:0,frameW:d.walkLeftCellW,frameH:d.walkLeftCellH,mirror:false};
    return {image:art.walk,sx:state.frame*d.walkCellW,sy:0,frameW:d.walkCellW,frameH:d.walkCellH,mirror:false};
  }
  const breath=d.idleBreathFrames||6,idleFps=d.idleFps||5,idleSpan=breath/idleFps,hold=d.gestureHold||.8;
  const t=state.clock%(idleSpan+(d.columns-breath)*hold);
  if(t<idleSpan)return {image:art.atlas,sx:Math.floor(t*idleFps)*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:false};
  const step=Math.floor((t-idleSpan)/hold);
  const gf=breath+Math.min(step,d.columns-breath-1);
  return {image:art.atlas,sx:gf*d.cellW,sy:0,frameW:d.cellW,frameH:d.cellH,mirror:false};
}
// Characters are foot-anchored: the collision point sits at the character's feet.
export function drawTechSprite(ctx,art,state,x,y){
  const d=art.definition,f=techFrame(art,state),h=d.worldSize;
  const fw=f.frameW||d.cellW,fh=f.frameH||d.cellH,w=h*fw/fh;
  const img=state.hurt>0&&art.hurt&&f.image===art.atlas?art.hurt:f.image;
  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,f.sx,f.sy,fw,fh,Math.round(x-w*d.anchorX),Math.round(y-h*d.anchorY),Math.round(w),h);
  ctx.imageSmoothingEnabled=prev;
}
// Enemies are drawn CENTERED on their collision point (feet-anchor math stays
// in the manifest for provenance), matching the Lag and Squirrel convention.
export function drawTechEnemy(ctx,art,state,x,y){
  const d=art.definition,f=techFrame(art,state),size=d.worldSize;
  const fw=f.frameW||d.cellW,fh=f.frameH||d.cellH,w=size*fw/fh,h=size;
  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  ctx.drawImage(f.image,f.sx,f.sy,fw,fh,Math.round(-w/2),Math.round(-h/2),Math.round(w),Math.round(h));
  ctx.restore();ctx.imageSmoothingEnabled=prev;
}