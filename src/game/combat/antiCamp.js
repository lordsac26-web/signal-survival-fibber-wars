import { APPARITION } from '@/game/combat/coneAttack';
export const CAMP_ATTACK=Object.freeze({...APPARITION,id:'camp',focus:0,initialCooldown:0,cooldown:4.6,rangeFactor:.38,maxRange:320,kiteDistance:170,damage:0});
export const createCampState=(x,y)=>({x,y,time:0,active:false});
export function updateCamp(s,p,dt){
  if(Math.hypot(p.x-s.x,p.y-s.y)>90){s.x=p.x;s.y=p.y;s.time=0;s.active=false}
  else{s.time+=dt;s.active=s.time>2}
  return s.active;
}
export function campVelocity(enemy,target,speed,shortSide){
  const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy)||1,desired=Math.min(170,shortSide*CAMP_ATTACK.rangeFactor*.7),direction=d>desired+12?1:d<desired-12?-1:0;
  return {x:dx/d*speed*direction,y:dy/d*speed*direction};
}