import { WEAPON_ARCHETYPES } from '@/game/data/generation';
export const BASE_RANGE_RATINGS=Object.fromEntries(WEAPON_ARCHETYPES.map(w=>[w[0],w[6]]));
// Fractions of the shorter visible WORLD viewport, not world bounds or DPR pixels.
export const RANGE_PROFILES={
  ranged:{base:.26,cap:.42,reference:330},turret:{base:.24,cap:.42,reference:330},
  melee:{base:.12,cap:.18,reference:105},chain:{base:.15,cap:.18,reference:210,maxBounces:0},
  clause:{base:.30,cap:.40,reference:260},
  // Named exception: Full Trace may exceed normal 42–44% reach, max 60%.
  trace:{base:.40,cap:.60,reference:700}
};
// BALANCE TUNING (single shared multiplier): every effective reach —
// targeting, launch budget, turret/structure reach, melee/cone/nova areas,
// drawn arcs and HUD readouts — is this factor × the capped viewport reach.
// One constant, one place: bump or revert here and the whole game follows.
// The guard that a default attack from arena center cannot reach the far
// side of the map is pinned in rangeBalance.test.mjs (worst default kit
// after ×1.2: 46.3% of the shorter visible side < the 50% wall distance).
export const RANGE_MULTIPLIER=1.2;
export const SIGNATURE_RANGE_WEAPONS={
  clause:{range:260,rangeProfile:'clause'},
  trace:{range:700,rangeProfile:'trace'},crew:{range:280,pattern:'turret'}
};
export function rangeProfile(weapon){
  if(weapon.rangeProfile)return weapon.rangeProfile;
  if(weapon.turret || weapon.pattern==='turret')return 'turret';
  if(weapon.pattern==='chain')return 'chain';
  return ['melee','nova','cone','orbiting'].includes(weapon.pattern)?'melee':'ranged';
}
export function signatureRangeDescription(id){
  const profile=RANGE_PROFILES[id];
  return profile?`Viewport-derived reach: ${(profile.base*RANGE_MULTIPLIER*100).toFixed(1)}% baseline, up to ${(profile.cap*RANGE_MULTIPLIER*100).toFixed(1)}% of the shorter visible side${id==='trace'?' (named Full Trace exception)':''}; character/gear Range applies once.`:'';
}