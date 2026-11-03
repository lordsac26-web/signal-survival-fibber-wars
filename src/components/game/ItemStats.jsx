import StatChips from '@/components/game/StatChips';
import { combineStatus, itemCategory, tierInfo } from '@/game/items/tiers';
import { deployStats } from '@/game/items/itemScaling';
import { DESIGNATIONS } from '@/game/data/generation';
const n=value=>+Number(value).toFixed(3);
export default function ItemStats({item,run,incoming=false}){
  const structure=item.deploy?deployStats(item):null;
  return <div className="space-y-2">
    <p className="text-xs font-bold text-game-warm">{itemCategory(item)} • {tierInfo(item.rarity).label}{item.baseId?` • ${DESIGNATIONS[item.pattern] || item.pattern}`:''}</p>
    {item.baseId && <p className="text-xs leading-relaxed text-game-muted">{n(item.damage)} base damage • {n(item.rate)}s interval • {n(item.range)} reach rating (viewport-capped){item.heal>0?` • ${n(item.heal)} HP per attack`:''}</p>}
    {item.turret && <p className="text-xs text-game-muted">Turret: {n(item.turret.fire)}s fire interval • {n(item.turret.life)}s lifetime • {item.turret.cap} active cap</p>}
    {structure && <p className="text-xs leading-relaxed text-game-muted">{n(structure.life)}s life • {n(structure.cd)}s placement cooldown • {n(structure.r)} radius{structure.damage?` • ${n(structure.damage)} damage / ${n(structure.fire)}s • ${n(structure.range)} reach rating`:''}{structure.chomp?` • ${n(structure.chomp)} trap damage • ${structure.uses} uses`:''}{structure.slow?` • ${n(structure.slow*100)}% slow`:''}{structure.buff?` • +${n(structure.buff*100)}% attack speed`:''}</p>}
    <StatChips item={item}/>
    {item.special && <p className="text-xs leading-relaxed text-game-muted">{item.special}{!['First hit each wave is politely declined','Gain a brief speed boost when hit'].includes(item.special)&&item.specialPower>1?` (${n(item.specialPower)}× effect strength)`:''}</p>}
    {item.module && <p className="text-xs text-game-signal">Installed module: {item.module.name || item.module.id || item.module}</p>}
    {item.premium && <p className="text-xs text-game-muted">{item.desc}</p>}
    <p className="text-xs font-bold text-game-signal">{combineStatus(run,item,incoming)}</p>
  </div>;
}