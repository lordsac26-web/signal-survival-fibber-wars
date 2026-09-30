import { BASE_RANGE_RATINGS, RANGE_PROFILES, rangeProfile } from '@/game/combat/rangeConfig';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function updateVisibleViewport(out,cssWidth,cssHeight,zoom=1){
  out.width=Math.max(1,cssWidth)/Math.max(.01,zoom);out.height=Math.max(1,cssHeight)/Math.max(.01,zoom);
  return out;
}
export function effectiveRange(weapon,run,viewport,override){
  const key=override || rangeProfile(weapon),profile=RANGE_PROFILES[key] || RANGE_PROFILES.ranged;
  const short=Math.min(viewport.width,viewport.height);
  const rating=BASE_RANGE_RATINGS[weapon.baseId] || weapon.range || profile.reference;
  const familyScale=clamp(Math.sqrt(rating/profile.reference),.7,1.1);
  const quality=Math.sqrt(Math.max(.01,(weapon.range || rating)/rating));
  // Saved run.range is an additive percent-point factor: base 1.35 + gear .03 = 1.38.
  // Legacy weapon.range is a reach rating, NOT a world-unit distance. Optional flats are world units.
  const raw=short*profile.base*familyScale*quality*Math.max(0,run.range ?? 1)+(run.rangeFlat || 0)+(weapon.rangeFlat || 0);
  const cap=(key==='ranged' || key==='turret') && run.character?.id==='oracle' ? .44 : profile.cap;
  return clamp(raw,0,short*cap);
}
export function withinReach(x,y,ox,oy,range){return (x-ox)**2+(y-oy)**2<=range*range+1e-8}
export function areaCanHit(e,x,y,reach,angle=0,half=Math.PI){
  if(!withinReach(e.x,e.y,x,y,reach))return false;
  return half>=Math.PI || Math.cos(Math.atan2(e.y-y,e.x-x)-angle)>=Math.cos(half);
}
export function rangeLabel(range,viewport){return `${range.toFixed(1)} u (${(100*range/Math.min(viewport.width,viewport.height)).toFixed(1)}% short view)`}