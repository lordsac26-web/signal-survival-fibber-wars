import { DEPLOYABLES } from '@/game/data/structures';
// Persist lowercase ids; accept the capitalized ids shipped in older saves.
export const TIERS = Object.freeze({
  common: {label:'Basic',power:1,price:1,weight:65,rolls:1,color:'#94a3b8'},
  rare: {label:'Rare',power:1.35,price:1.6,weight:24,rolls:2,color:'#38bdf8'},
  epic: {label:'Epic',power:1.85,price:2.4,weight:9,rolls:3,color:'#c084fc'},
  legendary: {label:'Legendary',power:2.5,price:3.5,weight:2,rolls:4,color:'#fbbf24'},
  overclocked: {label:'Overclocked',power:3.4,price:null,weight:0,rolls:4,color:'#7fe6f5'}
});
export const TIER_IDS = Object.keys(TIERS);
export const tierId = value => TIER_IDS.includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'common';
export const tierInfo = value => TIERS[tierId(value)];
export const nextTier = value => TIER_IDS[TIER_IDS.indexOf(tierId(value))+1] || null;
export const tierPrice = (base,value) => {
  const price=tierInfo(value).price;
  if(price===null)throw new Error('Overclocked items are combine-only, never sold');
  return Math.round(base*price);
};
export const itemCategory = item => item.premium ? 'Premium card' : item.category==='module' ? 'Module' : item.baseId ? 'Weapon' : item.deploy ? 'Deployable' : 'Passive';
export const itemIdentity = item => !item || item.premium || item.category==='module' ? null : item.baseId ? `weapon:${item.baseId}` : item.deploy ? `deployable:${item.deployId || DEPLOYABLES.find(d=>d.structure===item.structure)?.id || item.id}` : item.name ? `passive:${item.name}` : null;
export const inventoryKey = item => item.baseId ? 'weapons' : item.deploy ? 'deployables' : 'items';
export const canCombine = (a,b) => !!itemIdentity(a) && itemIdentity(a)===itemIdentity(b) && tierId(a.rarity)===tierId(b.rarity) && !!nextTier(a.rarity);
export const matchingItems = (run,item) => (run?.[inventoryKey(item)] || []).filter(other=>canCombine(item,other));
export function combineStatus(run,item,incoming=false){
  if(!itemIdentity(item))return 'Does not combine';
  const tier=nextTier(item.rarity);
  if(!tier)return 'Max tier';
  const count=matchingItems(run,item).length+(incoming?1:0);
  return count>=2 ? `2/2 combines to ${tierInfo(tier).label}` : '1/2 for next tier';
}