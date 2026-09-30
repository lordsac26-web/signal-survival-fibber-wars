import { createGenerator, WEAPON_ARCHETYPES, STAT_MOD_POOL, seeded, RARITY } from '@/game/data/generation';
import { DEPLOYABLES } from '@/game/data/structures';
import { TUNING } from '@/game/data/tuning';
import { allowedWeapon, legalLoadout, normalizeWeapon, rebuildStats } from '@/game/progression/runRules';
export const premiumTargets=run=>run.weapons.filter(w=>w.rarity==='Epic' || (w.rarity==='Legendary' && (w.overclockRank || 0)<TUNING.overclockRankCap));
function freshOffer(run,sequence){
  const seed=(run.seed+run.wave*7919+sequence*104729)>>>0,r=seeded(seed),gen=createGenerator(seed+31),chance=r();
  let item;
  if(chance<TUNING.deployOfferChance){
    const candidates=DEPLOYABLES.filter(d=>['turretMount','barricade'].includes(d.structure) && d.structure!==run.character.signatureStructure && ((run.deployables || []).find(o=>o.structure===d.structure)?.stacks || 0)<TUNING.deployRankCap);
    const turrets=WEAPON_ARCHETYPES.filter(a=>a[2]==='turret' && allowedWeapon(run.character,{pattern:a[2]}) && run.character.signatureStructure!=='turretMount');
    if(candidates.length && (r()<.6 || !turrets.length)){
      const d=candidates[Math.floor(r()*candidates.length)],rar=r()<.8?'Rare':'Epic';
      item={...d,id:`deploy-${sequence}`,deploy:true,rarity:rar,mods:[],cost:Math.round(TUNING.deployBasePrice*RARITY[rar].power*(1+((run.deployables || []).find(o=>o.structure===d.structure)?.stacks || 0)*.5))};
    }else if(turrets.length){item=gen.weapon(run.luck,turrets,r()<.8?'Rare':r()<.8?'Epic':'Legendary');item.cost=Math.max(TUNING.deployBasePrice,Math.round(item.cost*2.8))}
  } else if(chance<TUNING.deployOfferChance+TUNING.premiumOfferChance && premiumTargets(run).length){
    item={id:`premium-${sequence}`,premium:true,name:'OSHA Has Left the Chat',icon:'↑',rarity:'Legendary',mods:[],cost:Math.round(TUNING.premiumReferencePrice*TUNING.premiumPriceMultiplier),desc:'Promote one owned Epic, or overclock one owned Legendary. Choose and preview before paying.'};
  }
  if(!item){
    const pool=WEAPON_ARCHETYPES.filter(a=>a[2]!=='turret' && allowedWeapon(run.character,{pattern:a[2]}));
    const preferred={bucket:['engineering','armor'],patty:['armor','maxHp'],cleaner:['lifeSteal','cleanliness','regen'],oracle:['range','crit'],frenzy:['attackSpeed','spliceQuality'],admin:['dodge','speed'],nomad:['speed','luck'],deadline:['speed','attackSpeed'],don:['maxHp','engineering']}[run.character.id] || ['damage','maxHp'];
    const passivePool=STAT_MOD_POOL.concat(STAT_MOD_POOL.filter(m=>preferred.includes(m[0])));
    const weakerFamily=run.weapons.filter(w=>w.slotType==='melee').length>run.weapons.filter(w=>w.slotType==='ranged').length?'ranged':'melee';
    const synergy=run.character.id==='veteran'?pool.concat(pool.filter(a=>(['melee','chain','nova','orbiting'].includes(a[2])?'melee':'ranged')===weakerFamily)):pool;
    item=r()<.55?gen.weapon(run.luck,synergy):gen.passive(run.luck,passivePool);
  }
  return {...item,id:`${run.runId}:offer:${run.wave}:${sequence}:${item.id}`};
}
export function enterShop(run){
  if(run.shop?.wave===run.wave)return run;
  const old=run.shop?.offers || [],locked=run.lockedIds || [];let sequence=run.shop?.sequence || 0;
  const offers=Array.from({length:TUNING.shopSlots},(_,index)=>{const item=old[index];return item && locked.includes(item.id)?item:freshOffer(run,++sequence)});
  return {...run,shop:{wave:run.wave,offers,sequence,rerolls:0},lockedIds:locked.filter(id=>offers.some(o=>o?.id===id))};
}
export function swapTargets(run,item){return run.weapons.filter(old=>legalLoadout(run.character,run.weapons.map(w=>w.id===old.id?item:w)))}
export function offerReason(run,item){
  if(!item)return 'Offer already purchased.';
  if(item.baseId && !allowedWeapon(run.character,item))return `${run.character.restriction}-only technician.`;
  if(item.deploy && (item.structure===run.character.signatureStructure || ((run.deployables || []).find(d=>d.structure===item.structure)?.stacks || 0)>=TUNING.deployRankCap))return 'Signature duplicate or loot rank cap reached.';
  if(item.premium && !premiumTargets(run).length)return 'Requires an eligible Epic or Legendary tool.';
  if(run.signal<item.cost)return `Need ${item.cost-run.signal} more spendable Signal.`;
  return '';
}
export function premiumPreview(weapon){
  if(!weapon || !['Epic','Legendary'].includes(weapon.rarity))throw new Error('Ineligible premium target');
  if(weapon.rarity==='Epic')return {...weapon,rarity:'Legendary',damage:+(weapon.damage*(RARITY.Legendary.power/RARITY.Epic.power)).toFixed(2),name:`${weapon.name} • Management Approved`};
  if((weapon.overclockRank || 0)>=TUNING.overclockRankCap)throw new Error('Overclock cap reached');
  return {...weapon,damage:+(weapon.damage*1.1).toFixed(2),rate:+(weapon.rate*.95).toFixed(3),overclockRank:(weapon.overclockRank || 0)+1,name:`${weapon.name} • OSHA Has Left the Chat`};
}
export function shopTransaction(run,event){
  if(!run.shop)throw new Error('Shop is not open');
  const shop={...run.shop,offers:[...run.shop.offers]},locks=[...(run.lockedIds || [])];
  if(event.type==='reroll'){
    const cost=TUNING.rerollBase+shop.rerolls*TUNING.rerollStep;if(run.signal<cost)throw new Error('Not enough spendable Signal');
    shop.offers=shop.offers.map(i=>i && locks.includes(i.id)?i:freshOffer(run,++shop.sequence));shop.rerolls++;
    return {...run,signal:run.signal-cost,shop};
  }
  const index=shop.offers.findIndex(i=>i?.id===event.offerId),item=shop.offers[index];if(!item)throw new Error('This offer has already changed or been purchased');
  if(event.type==='lock'){
    const found=locks.indexOf(item.id);if(found>=0)locks.splice(found,1);else{if(locks.length>=TUNING.maxLocks)throw new Error('Only two offers may be locked. Unlock one first.');locks.push(item.id)}
    return {...run,lockedIds:locks};
  }
  if(event.type!=='buy')throw new Error('Unknown shop action');
  const reason=offerReason(run,item);if(reason)throw new Error(reason);
  let next={...run,shop,lockedIds:locks.filter(id=>id!==item.id),signal:run.signal-item.cost,buys:(run.buys || 0)+1};
  if(item.premium){
    const target=premiumTargets(run).find(w=>w.id===event.weaponId);if(!target)throw new Error('Choose an eligible owned instance');
    next.weapons=run.weapons.map(w=>w.id===target.id?premiumPreview(w):w);
  }else if(item.baseId){
    const tool=normalizeWeapon(item);
    next.weapons=event.replaceId?run.weapons.map(w=>w.id===event.replaceId?tool:w):[...run.weapons,tool];
    if(event.replaceId && !run.weapons.some(w=>w.id===event.replaceId))throw new Error('Replacement tool missing');
    if(!legalLoadout(run.character,next.weapons))throw new Error('Choose a compatible tool to replace; slot or family cap reached');
  }else if(item.deploy){
    const owned=(run.deployables || []).find(d=>d.structure===item.structure);
    next.deployables=owned?run.deployables.map(d=>d.structure===item.structure?{...d,stacks:d.stacks+1}:d):[...(run.deployables || []),{...item,stacks:1}];
  }else next.items=[...run.items,item];
  shop.offers[index]=null;
  next.meleePeak=Math.max(run.meleePeak || 0,next.weapons.filter(w=>w.slotType==='melee').length);next.toolPeak=Math.max(run.toolPeak || 0,next.weapons.length);
  return rebuildStats(next);
}