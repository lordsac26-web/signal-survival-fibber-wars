import { createGenerator, PASSIVE_ITEM_TABLE } from '@/game/data/generation';
import { DEPLOYABLES } from '@/game/data/structures';
import { scaleItem } from '@/game/items/itemScaling';
export function weaponReference(archetype){
  const item=createGenerator(42).weapon(0,[archetype],'common');
  return scaleItem({...item,name:archetype[1],baseStats:{...item.baseStats,mods:[]}},'common');
}
export const passiveReferences = () => PASSIVE_ITEM_TABLE.map((name,index)=>({id:`passive-${index}`,title:name,icon:'◆',item:createGenerator(index+19).passive(0,undefined,'common',name),body:'Passive field gear. Two copies of this exact name at the same tier combine; different tiers never merge. Preview a representative roll below.'}));
export const deployableReferences = () => DEPLOYABLES.map(d=>({id:d.id,title:d.name,icon:d.icon,item:scaleItem({...d,deploy:true,deployId:d.id,rarity:'common',baseStats:{mods:[]}},'common'),body:d.desc}));
export const referenceArchetypes = WEAPON_ARCHETYPES;