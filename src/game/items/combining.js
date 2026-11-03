import { canCombine, inventoryKey, nextTier, tierInfo } from '@/game/items/tiers';
import { normalizeItem, scaleItem } from '@/game/items/itemScaling';
export function combinePair(owned,incoming){
  if(!canCombine(owned,incoming))throw new Error('Combine requires the same identity and tier below Overclocked');
  const source=normalizeItem(incoming),other=normalizeItem(owned);
  const result=scaleItem({...source,id:owned.id,baseStats:source.baseStats,module:incoming.module || owned.module || null,levelUpgrade:!!(owned.levelUpgrade || incoming.levelUpgrade),stacks:source.deploy?Math.max(source.stacks || 1,other.stacks || 1):source.stacks},nextTier(source.rarity));
  const title=`Combined: ${tierInfo(result.rarity).label} ${result.archetype || result.name}`;
  const description=incoming.module && owned.module ? 'Kept the incoming module; the other module was destroyed.' : result.module ? 'Kept the installed module.' : 'Two matching items became one. Incoming rolls and effect retained.';
  return {item:result,notice:{title,description}};
}
export function combineInto(list,incoming){
  let item=normalizeItem(incoming);const items=[...list],notices=[];
  for(let index;(index=items.findIndex(other=>canCombine(other,item)))>=0;){
    const merged=combinePair(items[index],item);items.splice(index,1);item=merged.item;notices.push(merged.notice);
  }
  return {items:[...items,item],notices,item};
}
export function combineOwned(run,itemId){
  const key=['weapons','items','deployables'].find(k=>(run[k] || []).some(i=>i.id===itemId));
  if(!key)throw new Error('Owned item missing');
  const item=run[key].find(i=>i.id===itemId),others=run[key].filter(i=>i.id!==itemId);
  if(!others.some(other=>canCombine(other,item)))throw new Error('No matching same-tier pair');
  const combined=combineInto(others,item);
  return {...run,[key]:combined.items,combineNotices:combined.notices};
}
export function addToInventory(run,item){
  const key=inventoryKey(item),combined=combineInto(run[key] || [],item);
  return {...run,[key]:combined.items,combineNotices:combined.notices};
}