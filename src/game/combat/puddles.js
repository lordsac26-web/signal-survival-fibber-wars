// Packet-Loss Pudding special mechanic: shared tunables and pure state logic.
// The enemy keeps its existing identity, stats and spawn progression
// (ENEMIES.packet in data/combat.js); only its cast + ground hazard live here.
export const PUDDING=Object.freeze({
 telegraph:1,       // rooted glow, exactly 1.0s
 cooldown:10,       // after a successful drop
 puddleLife:5,      // exact hazard lifetime, game time (frozen while paused)
 tickInterval:.5,   // shared hazard damage clock
 tickDamage:10,     // base per tick, before defense
 slow:.35,          // movement slow while inside (strongest once, never stacked)
 radius:34,         // hazard footprint, world units (drawn goo is slightly wider)
 triggerRange:150,  // cast only when this close to the player AND on screen
 initialCastCdMin:3,initialCastCdMax:8 // fresh spawns never all cast instantly
});
export const initPuddingState=(rand=Math.random)=>({phase:'chase',castCd:PUDDING.initialCastCdMin+rand()*(PUDDING.initialCastCdMax-PUDDING.initialCastCdMin),t:0,dropX:0,dropY:0});
// Cleanliness mitigation for puddle tick damage: 1% per point, capped at 40%.
// Same per-point unit as the existing Cleanliness damage synergy (+1%/point
// vs dirty targets in the combat hit path), so the stat reads one way
// everywhere. The puddle lifetime is never shortened by Cleanliness.
export const puddleMitigation=c=>Math.min(.4,(c||0)*.01);
// Overlapping puddles apply the STRONGEST slow once — never multiplicative.
export const applyPuddleSlow=currentSlow=>Math.min(currentSlow,1-PUDDING.slow);
// Per-enemy cast state machine. Returns 'start' | 'rooted' | 'drop' | 'chase'.
// The drop position is saved (rooted) the moment the telegraph begins, so the
// puddle lands at the exact saved world spot regardless of later movement.
// A pudding killed during the telegraph is simply released — 'drop' never
// fires, so no puddle appears (pending cast cancelled).
export function stepPuddingState(s,dt,{dist,visible,playerAlive,x=0,y=0}={}){
 if(!s)return 'chase';
 s.castCd=Math.max(0,s.castCd-dt);
 if(s.phase==='telegraph'){
  s.t-=dt;
  if(s.t<=0){s.phase='chase';s.castCd=PUDDING.cooldown;return 'drop'} // chase resumes immediately
  return 'rooted';
 }
 if(playerAlive&&s.castCd<=0&&visible&&dist<=PUDDING.triggerRange){s.phase='telegraph';s.t=PUDDING.telegraph;s.dropX=x;s.dropY=y;return 'start'}
 return 'chase';
}