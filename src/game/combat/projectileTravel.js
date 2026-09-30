import { withinReach } from '@/game/combat/effectiveRange';
// Distance, not lifetime, owns expiry. Budget is frozen at launch; sweeps end at the capped endpoint.
export function advanceProjectile(s,dt){
  s.prevX=s.x;s.prevY=s.y;
  const distance=Math.min(s.remaining,Math.hypot(s.vx,s.vy)*Math.max(0,dt));
  const speed=Math.hypot(s.vx,s.vy);
  if(speed>0){s.x+=s.vx/speed*distance;s.y+=s.vy/speed*distance}
  s.traveled+=distance;s.remaining=Math.max(0,s.remaining-distance);s.life-=dt;
  return s.remaining<=1e-8 || s.life<=0;
}
export function projectileCanHit(s,e){
  if(!withinReach(e.x,e.y,s.originX,s.originY,s.maxReach))return false;
  const dx=s.x-s.prevX,dy=s.y-s.prevY,length2=dx*dx+dy*dy;
  const t=length2?Math.max(0,Math.min(1,((e.x-s.prevX)*dx+(e.y-s.prevY)*dy)/length2)):0;
  return (e.x-s.prevX-t*dx)**2+(e.y-s.prevY-t*dy)**2<=(e.r+s.r)**2;
}