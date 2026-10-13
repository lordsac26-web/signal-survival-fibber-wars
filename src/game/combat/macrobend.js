// MACROBEND BEAST — squeeze-and-throw elite (wave 4+). Number rationale:
// exactly 1.6× the Jitter Bug's base HP (31 → 49.6), 1.15× its melee damage
// (10 → 11.5) and 0.85× its speed (92 → 78.2) — a slower, tankier bruiser
// whose special is the real threat. The cast lifecycle mirrors the Jitter
// Bug's nova (charge → fire → recovery) with its own numbers: casts every 12s,
// first cast staggered 8–12s after spawn, a 1s rooted coil telegraph, then ONE
// instant ring released at the end of the coil plus a 0.4s recovery pose.
export const MACRO=Object.freeze({
 telegraph:1,recovery:.4,cooldown:12,initialMin:8,initialMax:12,
 activationRange:300,ringRadius:14,ringSpeed:210,rangeFactor:.35,
 spawnWeight:.5,wave:4});
export const createBendState=(random=Math.random)=>({phase:'chase',remaining:0,cooldown:MACRO.initialMin+random()*(MACRO.initialMax-MACRO.initialMin),clock:0,facing:'right',rootX:0,rootY:0});
export function stepBend(s,dt,{alive=true,playerAlive=true,dist=Infinity,visible=false,targetDx=0}={}){
 if(!alive){s.phase='dead';s.remaining=0;return null}
 if(s.phase==='dead')return null;
 s.clock+=dt;s.cooldown=Math.max(0,s.cooldown-dt);
 if(Math.abs(targetDx)>2)s.facing=targetDx<0?'left':'right';
 if(s.phase==='coil'){
  s.remaining=Math.max(0,s.remaining-dt);
  if(s.remaining<=1e-8){s.phase='recover';s.remaining=MACRO.recovery;s.cooldown=MACRO.cooldown;return 'fire'}
 }else if(s.phase==='recover'){
  s.remaining=Math.max(0,s.remaining-dt);if(s.remaining<=1e-8)s.phase='chase';
 }else if(s.cooldown<=1e-8&&playerAlive&&visible&&dist<=MACRO.activationRange){s.phase='coil';s.remaining=MACRO.telegraph;return 'coil'}
 return null;
}
// The Beast only moves while chasing: it is rooted through the coil AND the
// recovery pose, then resumes the straight chase vector.
export const bendVelocity=(s,angle,speed)=>s.phase==='chase'?{x:Math.cos(angle)*speed,y:Math.sin(angle)*speed}:{x:0,y:0};