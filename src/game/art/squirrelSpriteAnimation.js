// Squirrel boss animation — three movement atlases (idle front, idle back,
// side walk mirrored for left) plus the 5-frame FEC attack atlas (220x200:
// frames 0-2 tail fluffing/charging, 3 fully puffed, 4 whip-forward release).
// Frame selection is pure so wiring is testable without a canvas.
export const createSquirrelAnimation=()=>({facing:'down',side:'right',frame:0,clock:0,moving:false,wind:0,cast:0,pop:0});
export function updateSquirrelAnimation(state,vx,vy,dt,definition){
  if(state.pop)state.pop=Math.max(0,state.pop-dt*3.3);
  const moving=Math.abs(vx)+Math.abs(vy)>.001;
  if(moving){
    if(Math.abs(vx)>Math.abs(vy))state.side=vx<0?'left':'right';
    else if(vy)state.facing=vy<0?'up':'down';
    if(!state.moving)state.clock=0;
    state.moving=true;state.clock+=dt;
    state.frame=Math.floor(state.clock*(definition.walkFps||10))%definition.columns;
  }else{
    if(state.moving){state.moving=false;state.clock=0}
    state.clock+=dt;
    state.frame=Math.floor(state.clock*(definition.idleFps||6))%definition.columns;
  }
}
// FEC telegraph: while wind>0 the windup plays frames 0-2 quickly (each about
// 15% of the telegraph) then HOLDS the fully-puffed frame 3 for the final
// 45% — a clear "it's about to whip" beat before the release. After the
// engine fires the cone, release frame 4 holds during the short remaining
// cast window, with a brief scale-pop (state.pop, set by squirrelRelease)
// that makes the whip moment read on screen.
export const FEC_POP=.5;
export function squirrelRelease(state){state.pop=FEC_POP}
export function squirrelFrame(art,state){
  const d=art.definition;
  if(state.wind>0){
    const wu=d.windup||.8,el=wu-state.wind,spread=wu*.55;
    const frame=el<spread?Math.min(2,Math.floor(el/spread*3)):3;
    return {image:art.attack,sx:frame*d.attackFrameW,sy:0,frameW:d.attackFrameW,frameH:d.attackFrameH,mirror:false,attack:true};
  }
  if(state.cast>0)return {image:art.attack,sx:4*d.attackFrameW,sy:0,frameW:d.attackFrameW,frameH:d.attackFrameH,mirror:false,attack:true};
  if(state.moving)return {image:art.walk,sx:state.frame*d.cell,sy:0,frameW:d.cell,frameH:d.cell,mirror:state.side==='left'};
  if(state.facing==='up')return {image:art.back,sx:state.frame*d.cell,sy:0,frameW:d.cell,frameH:d.cell,mirror:false};
  return {image:art.atlas,sx:state.frame*d.cell,sy:0,frameW:d.cell,frameH:d.cell,mirror:false};
}
// Bosses draw CENTERED on their collision point like every other enemy.
export function drawSquirrelSprite(ctx,art,state,x,y){
  const d=art.definition,f=squirrelFrame(art,state),size=d.worldSize;
  const pop=f.attack?(state.pop||0)*.28:0,grow=1+pop;
  const w=(f.attack?size*f.frameW/d.cell:size)*grow,h=(f.attack?size*f.frameH/d.cell:size)*grow;
  const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));if(f.mirror)ctx.scale(-1,1);
  ctx.drawImage(f.image,f.sx,f.sy,f.frameW,f.frameH,Math.round(-w/2),Math.round(-h/2),Math.round(w),Math.round(h));
  ctx.restore();ctx.imageSmoothingEnabled=previousSmoothing;
}