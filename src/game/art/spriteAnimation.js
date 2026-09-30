export const createSpriteAnimation=()=>({facing:'down',frame:0,clock:0,moving:false,hurt:0});
export function updateSpriteAnimation(state,dx,dy,dt,definition){
  state.hurt=Math.max(0,state.hurt-dt);
  const moving=Math.abs(dx)+Math.abs(dy)>.001;
  if(!moving){state.moving=false;state.clock=0;state.frame=0;return}
  const facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
  if(!state.moving || facing!==state.facing)state.clock=0;
  state.facing=facing;state.moving=true;state.clock+=dt;
  state.frame=Math.floor(state.clock*definition.fps)%definition.columns;
}
export function drawCharacterSprite(ctx,art,state,x,y){
  const d=art.definition,size=d.worldSize;
  const row=!state.moving && state.facing==='down'?d.idleRow:d.directions[state.facing];
  ctx.imageSmoothingEnabled=false;
  // Player world/collision center is the foot anchor; rounding error is at most half a unit.
  ctx.drawImage(state.hurt>0?art.hurt:art.atlas,state.frame*d.cell,row,d.cell,d.cell,
    Math.round(x-size*d.anchorX),Math.round(y-size*d.anchorY),size,size);
}