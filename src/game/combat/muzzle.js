// Muzzle anchors, pixel-measured from the processed attack atlases (see
// src/game/tests/muzzleAudit.test.mjs). CONVENTION: attack strips are
// RIGHT-facing art; muzzle.x / muzzle.y are the weapon tip / muzzle-flash
// pixel measured from the attack frame's TOP-LEFT corner, taken from the
// most-extended "fire" frame of the strip:
//   veteran 131,36 · clone 119,41 · don 104,35 · nomad 163,66
//   oracle (right-facing row of the movement atlas) 43,35
//   pedestal turret fire strip 74,49 (from its strip anchor, characterSprites)
// techMuzzlePoint converts that cell-local point to world coordinates for a
// foot-anchored sprite, handling the frame's world width (frame aspect vs
// worldSize), the attack mirror, and the vertical anchor. The projectile
// angle is then aimed from this point to the actual target — the upright
// sprite itself is never rotated.
export function techMuzzlePoint(def,dir,px,py){
  const mu=def.muzzle;
  if(!mu)return null;
  const fh=mu.cellH||def.attackCellH||def.cellH||def.cell||def.worldSize;
  const fw=mu.cellW||def.attackCellW||def.cellW||def.cell||def.worldSize;
  const s=def.worldSize/fh,w=def.worldSize*fw/fh;
  return{
    x:dir>0?px-w/2+mu.x*s:px+w/2-mu.x*s,
    y:py-def.worldSize*def.anchorY+mu.y*s
  };
}