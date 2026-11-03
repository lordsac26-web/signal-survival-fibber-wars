import { DEPLOYABLES, STRUCTURES } from '@/game/data/structures';
import { tierId, tierInfo } from '@/game/items/tiers';
const round=n=>+n.toFixed(6);
const oldPower={common:1,rare:1.15,epic:1.3,legendary:1.5,overclocked:3.4};
// Immutable, un-tiered roll snapshots prevent scaling again after save/resume.
export function scaleItem(item,rarity=item.rarity){
  if(item.premium)return {...item,rarity:tierId(rarity)};
  const tier=tierId(rarity),power=tierInfo(tier).power,old=oldPower[tierId(item.rarity)];
  const rank=item.overclockRank || 0;
  const base=item.baseStats || {mods:(item.mods || []).map(m=>({...m,value:m.value/old})),...(item.baseId?{damage:item.damage/old/Math.pow(1.1,rank),rate:item.rate/Math.pow(.95,rank),range:item.range,heal:item.heal || 0,turret:item.turret?{...item.turret}:null}:{})};
  const next={...item,rarity:tier,tierVersion:1,baseStats:base,mods:(base.mods || []).map(m=>({...m,value:round(m.value*power)})),specialPower:power};
  if(item.baseId)Object.assign(next,{damage:round(base.damage*power*Math.pow(1.1,rank)),rate:round(base.rate/power*Math.pow(.95,rank)),range:round(base.range*power),heal:round((base.heal || 0)*power),turret:base.turret?{...base.turret,life:round(base.turret.life*power),fire:round(base.turret.fire/power)}:null});
  if(item.deploy){const definition=DEPLOYABLES.find(d=>d.structure===item.structure);next.deployId=item.deployId || definition?.id || item.id;next.stacks=item.stacks || 1}
  return next;
}
export const normalizeItem = item => item.tierVersion===1 ? {...item,rarity:tierId(item.rarity)} : scaleItem(item);
// Mechanical caps and trigger counts are not inflated: tier improves useful
// magnitudes; faster cooldowns are divided. Slow stays below a full root.
export function deployStats(item){
  const base=STRUCTURES[item.structure];if(!base)return null;
  const power=item.tierVersion===1?tierInfo(item.rarity).power:1,next={...base};
  for(const k of ['damage','chomp','life','r','range','buff','slow'])if(base[k]!=null)next[k]=round(base[k]*power);
  for(const k of ['cd','fire'])if(base[k]!=null)next[k]=round(base[k]/power);
  if(next.slow!=null)next.slow=Math.min(.9,next.slow);
  return next;
}