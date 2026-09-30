import { WEAPON_ARCHETYPES } from '@/game/data/generation';
export const BASE_RANGE_RATINGS=Object.fromEntries(WEAPON_ARCHETYPES.map(w=>[w[0],w[6]]));
// Fractions of the shorter visible WORLD viewport, not world bounds or DPR pixels.
export const RANGE_PROFILES={
  ranged:{base:.26,cap:.42,reference:330},turret:{base:.24,cap:.42,reference:330},
  melee:{base:.12,cap:.18,reference:105},chain:{base:.15,cap:.18,reference:210,maxBounces:0},
  callback:{base:.32,cap:.40,reference:300},clause:{base:.30,cap:.40,reference:260},
  deepclean:{base:.30,cap:.40,reference:260},frenzy:{base:.12,cap:.18,reference:120},
  // Named exception: Full Trace may exceed normal 42–44% reach, max 60%.
  trace:{base:.40,cap:.60,reference:700}
};
export const SIGNATURE_RANGE_WEAPONS={
  callback:{range:300,rangeProfile:'callback'},clause:{range:260,rangeProfile:'clause'},
  deepclean:{range:260,rangeProfile:'deepclean'},frenzy:{range:120,rangeProfile:'frenzy'},
  trace:{range:700,rangeProfile:'trace'},fortify:{range:340,pattern:'turret'},crew:{range:280,pattern:'turret'}
};
export function rangeProfile(weapon){
  if(weapon.rangeProfile)return weapon.rangeProfile;
  if(weapon.turret || weapon.pattern==='turret')return 'turret';
  if(weapon.pattern==='chain')return 'chain';
  return ['melee','nova','cone','orbiting'].includes(weapon.pattern)?'melee':'ranged';
}
export function signatureRangeDescription(id){
  const profile=RANGE_PROFILES[id];
  return profile?`Viewport-derived reach: ${profile.base*100}% baseline, up to ${profile.cap*100}% of the shorter visible side${id==='trace'?' (named Full Trace exception)':''}; character/gear Range applies once.`:'';
}