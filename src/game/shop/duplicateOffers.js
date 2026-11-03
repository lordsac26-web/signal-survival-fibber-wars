import { createGenerator, WEAPON_ARCHETYPES } from '@/game/data/generation';
import { passivePoolFor } from '@/game/shop/rollPools';
import { nextTier, tierId, canCombine, itemIdentity } from '@/game/items/tiers';
import { scaleItem } from '@/game/items/itemScaling';
import { allowedWeapon } from '@/game/progression/runRules';
import { priceOffer } from '@/game/shop/itemPricing';
export const ownedMatch = (run,item) => [...run.weapons,...run.items,...(run.deployables || [])].some(owned=>canCombine(owned,item));
export function withVisitDuplicate(run,offers,sequence,random){
  const existing=offers.some(i=>i && ownedMatch(run,i));
  if(existing || random()>=.3)return {offers,sequence,duplicateOffered:existing};
  const candidates=[...run.weapons,...run.items,...(run.deployables || [])].filter(i=>itemIdentity(i) && nextTier(i.rarity) && (run.character.id!=='clone' || ['common','rare'].includes(tierId(i.rarity))) && (!i.baseId || allowedWeapon(run.character,i)));
  const slot=offers.findIndex(i=>!i || !(run.lockedIds || []).includes(i.id));
  if(!candidates.length || slot<0)return {offers,sequence,duplicateOffered:false};
  const source=candidates[Math.floor(random()*candidates.length)],gen=createGenerator(run.seed+sequence*104729+41,run.wave),rarity=tierId(source.rarity);
  let item;
  if(source.baseId)item=gen.weapon(run.luck,WEAPON_ARCHETYPES.filter(a=>a[0]===source.baseId),rarity);
  else if(source.deploy)item=scaleItem({...source,id:`duplicate-deploy-${sequence}`,baseCost:source.baseCost || 80},rarity);
  else item=gen.passive(run.luck,passivePoolFor(run.character.id),rarity,source.name);
  // A duplicate is new loot, not a clone of an installed future module.
  item={...item,module:null,id:`${run.runId}:duplicate:${run.wave}:${++sequence}`,duplicateOffer:true};
  const next=[...offers];next[slot]=priceOffer(item,run.wave);
  return {offers:next,sequence,duplicateOffered:true};
}