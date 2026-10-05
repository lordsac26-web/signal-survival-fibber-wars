import { rangeLabel } from '@/game/combat/effectiveRange';
export default function RangeReadout({hud}){
  if(!hud.viewport || !hud.weaponRanges?.length)return null;
  const min=Math.min(...hud.weaponRanges),max=Math.max(...hud.weaponRanges);
  return <div className="pointer-events-auto mx-auto mt-1 hidden w-fit rounded-md bg-game-panel/90 sm:block px-2 py-1 text-center text-[10px] text-game-signal" title="World units and fraction of the shorter visible arena side. Targeting and projectile travel share this limit; DPI does not change it.">Tool reach {min===max?rangeLabel(max,hud.viewport):`${min.toFixed(1)}–${rangeLabel(max,hud.viewport)}`}{hud.signatureReach>0 && <span className="block">{hud.specialName}: {rangeLabel(hud.signatureReach,hud.viewport)}</span>}</div>;
}