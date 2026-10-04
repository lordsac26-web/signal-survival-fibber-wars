// Lag Sprite enemy animation — same state/update/draw shape as the Oracle
// character's spriteAnimation.js, extended with the attack-swipe atlas and
// side-row mirroring (side row faces right; left is drawn flipped).
export const createLagAnimation=()=>({facing:'down',frame:0,clock:0,moving:false,attack:0});
export function updateLagAnimation(state,dx,dy,dt,definition){
  state.attack=Math.max(0,state.attack-dt);
  const moving=Math.abs(dx)+Math.abs(dy)>.001;
  if(!moving){state.moving=false;state.clock=0;state.frame=0;return}
  const facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
  if(!state.moving || facing!==state.facing)state.clock=0;
  state.facing=facing;state.moving=true;state.clock+=dt;
  state.frame=Math.floor(state.clock*definition.fps)%definition.columns;
}
// Pure frame selection so wiring is testable without a canvas.
export function lagFrame(art,state){
  const d=art.definition,side=state.facing==='left'||state.facing==='right';
  if(state.attack>0)return {image:art.attack,sx:side?d.attackSide:d.attackFront,sy:0,mirror:side&&state.facing!==d.sideFaces};
  return {image:art.atlas,sx:state.frame*d.cell,sy:side?d.sideRow:d.frontRow,mirror:side&&state.facing!==d.sideFaces};
}
// Enemies are drawn CENTERED on their collision point like every other enemy
// sprite (feet-anchor math stays in the manifest for provenance).
export function drawLagSprite(ctx,art,state,x,y){
  const d=art.definition,f=lagFrame(art,state),size=d.worldSize;
  const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));if(f.mirror)ctx.scale(-1,1);
  ctx.drawImage(f.image,f.sx,f.sy,d.cell,d.cell,Math.round(-size/2),Math.round(-size/2),size,size);
  ctx.restore();ctx.imageSmoothingEnabled=previousSmoothing;
}