import { createGenerator, WEAPON_ARCHETYPES, seeded } from '@/game/data/generation';
import { passivePoolFor } from '@/game/shop/rollPools';
import { tierId } from '@/game/items/tiers';
import { normalizeItem, scaleItem } from '@/game/items/itemScaling';
import { acquireItem, hasCombineTarget, manualCombine } from '@/game/items/acquisition';
import { priceOffer } from '@/game/shop/itemPricing';
import { rerollCost, buyHealing } from '@/game/shop/economy';
import { sellItem } from '@/game/shop/selling';
import { itemBudgetUsed } from '@/game/progression/runRules';
import { ownedMatch, withVisitDuplicate } from '@/game/shop/duplicateOffers';
import { DEPLOYABLES } from '@/game/data/structures';
import { TUNING } from '@/game/data/tuning';
import { allowedWeapon, legalLoadout, rebuildStats } from '@/game/progression/runRules';
// Clone keeps Rare-only fresh rolls and Rare premium tune-ups (cap 3).
// The shared combine ladder can still promote owned items above Rare.
export const cloneOverclockCap=run=>run.character.id==='clone'?TUNING.cloneOverclockCap:TUNING.overclockRankCap;
export const premiumTargets=run=>run.character.id==='clone'
  ?run.weapons.filter(w=>tierId(w.rarity)==='rare' && (w.overclockRank || 0)<TUNING.cloneOverclockCap)
  :run.weapons.filter(w=>tierId(w.rarity)==='epic' || (tierId(w.rarity)==='legendary' && (w.overclockRank || 0)<TUNING.overclockRankCap));
// ONE deployable turret WEAPON per character — an inventory cap, not an
// active-unit cap. A second turret tool is blocked across ALL variants;
// upgrades to the owned turret (premium overclock / rank caps) stay
// available. Legacy saves that already hold several turret tools load
// untouched (non-destructive); only new acquisitions are gated.
export const ownedTurretCount=run=>run.weapons.filter(w=>w.pattern==='turret').length;
function freshOffer(run,sequence){
  const seed=(run.seed+run.wave*7919+sequence*104729)>>>0,r=seeded(seed),gen=createGenerator(seed+31,run.wave,run.character.id==='clone'?'rare':null),chance=r();
  let item;
  if(chance<TUNING.deployOfferChance){
    const candidates=DEPLOYABLES.filter(d=>['turretMount','barricade'].includes(d.structure) && d.structure!==run.character.signatureStructure);
    const turrets=ownedTurretCount(run)&&run.character.id!=='engineer'?[]:WEAPON_ARCHETYPES.filter(a=>a[2]==='turret' && allowedWeapon(run.character,{pattern:a[2]}) && run.character.signatureStructure!=='turretMount');
    if(candidates.length && (r()<.6 || !turrets.length)){
      const d=candidates[Math.floor(r()*candidates.length)],rar=run.character.id==='clone'?'rare':(r()<.8?'rare':'epic');
      item=scaleItem({...d,id:`deploy-${sequence}`,deployId:d.id,deploy:true,rarity:rar,baseStats:{mods:[]},baseCost:TUNING.deployBasePrice},rar);
    }else if(turrets.length)item=gen.weapon(run.luck,turrets,run.character.id==='clone'?'rare':(r()<.8?'rare':r()<.8?'epic':'legendary'));
  }else if(chance<TUNING.deployOfferChance+TUNING.premiumOfferChance && premiumTargets(run).length){
    item=run.character.id==='clone'
      ?{id:`premium-${sequence}`,premium:true,clone:true,name:'Overtime Overclock',icon:'↑',rarity:'rare',mods:[],cost:Math.round(TUNING.premiumReferencePrice*TUNING.premiumPriceMultiplier),desc:'Overclock one owned Rare tool up to 3 times. Choose and preview before paying.'}
      :{id:`premium-${sequence}`,premium:true,name:'OSHA Has Left the Chat',icon:'↑',rarity:'legendary',mods:[],cost:Math.round(TUNING.premiumReferencePrice*TUNING.premiumPriceMultiplier),desc:'Promote one owned Epic, or overclock one owned Legendary. Choose and preview before paying.'};
  }
  if(!item){
    const pool=WEAPON_ARCHETYPES.filter(a=>a[2]!=='turret' && allowedWeapon(run.character,{pattern:a[2]}));
    const passivePool=passivePoolFor(run.character.id);
    const weakerFamily=run.weapons.filter(w=>w.slotType==='melee').length>run.weapons.filter(w=>w.slotType==='ranged').length?'ranged':'melee';
    const synergy=run.character.id==='veteran'?pool.concat(pool.filter(a=>(['melee','chain','nova','orbiting'].includes(a[2])?'melee':'ranged')===weakerFamily)):pool;
    item=r()<.55?gen.weapon(run.luck,synergy):gen.passive(run.luck,passivePool);
  }
  return {...priceOffer(item,run.wave),id:`${run.runId}:offer:${run.wave}:${sequence}:${item.id}`};
}
// Only the per-visit slot below can sell an exact owned-tier duplicate.
// Rerolls do not manufacture another duplicate opportunity in that visit.
function freshNonDuplicate(run,shop){
  for(let attempt=0;attempt<200;attempt++){const item=freshOffer(run,++shop.sequence);if(!ownedMatch(run,item))return item}
  return null;
}
export function enterShop(run){
  if(run.shop?.wave===run.wave)return run;
  const old=run.shop?.offers || [],locked=run.lockedIds || [],state={sequence:run.shop?.sequence || 0};
  const fresh=Array.from({length:TUNING.shopSlots},(_,index)=>{const item=old[index];return item && locked.includes(item.id) && !(item.pattern==='turret'&&ownedTurretCount(run)&&!hasCombineTarget(run,item))?item:freshNonDuplicate(run,state)});
  const {offers,sequence,duplicateOffered}=withVisitDuplicate(run,fresh,state.sequence,seeded((run.seed+run.wave*3571+851)>>>0));
  return {...run,shop:{wave:run.wave,offers,sequence,rerolls:0,duplicateOffered},lockedIds:locked.filter(id=>offers.some(o=>o?.id===id))};
}
export function swapTargets(run,item){return run.weapons.filter(old=>legalLoadout(run.character,run.weapons.map(w=>w.id===old.id?item:w)))}
export function offerReason(run,item){
  if(!item)return 'Offer already purchased.';
  if(item.baseId && !allowedWeapon(run.character,item))return `${run.character.restriction}-only technician.`;
  if(!item.premium && tierId(item.rarity)==='overclocked')return 'Overclocked items are combine-only, never sold.';
  if(item.baseId && item.pattern==='turret' && run.character.id!=='engineer' && ownedTurretCount(run) && !hasCombineTarget(run,item))return 'Only one deployable turret tool per technician — combine a matching tier or upgrade the one you own.';
  if(run.character.id==='engineer' && item.baseId && item.pattern==='turret' && run.weapons.filter(w=>w.pattern==='turret').length>=4 && !hasCombineTarget(run,item))return 'Field Engineer fields at most 4 deployable tools.';
  if(run.character.id==='engineer' && !item.premium && !item.baseId && itemBudgetUsed(run)>=4 && !hasCombineTarget(run,item))return 'Field Engineer carries exactly 4 items total — sell or combine first.';
  if(item.deploy && item.structure===run.character.signatureStructure)return 'Signature duplicate.';
  if(item.premium && !premiumTargets(run).length)return run.character.id==='clone'?'Requires an owned Rare tool below its overclock cap.':'Requires an eligible Epic or Legendary tool.';
  if(run.signal<item.cost)return `Need ${Math.ceil(item.cost-run.signal)} more spendable Signal.`;
  return '';
}
export function premiumPreview(weapon,rankCap=TUNING.overclockRankCap){
  if(!weapon || !['rare','epic','legendary'].includes(tierId(weapon.rarity)))throw new Error('Ineligible premium target');
  const item=normalizeItem(weapon);
  if(item.rarity==='epic')return scaleItem({...item,name:`${item.name} • Management Approved`},'legendary');
  if((item.overclockRank || 0)>=rankCap)throw new Error('Overclock cap reached');
  return scaleItem({...item,overclockRank:(item.overclockRank || 0)+1,name:`${item.name} • ${item.rarity==='rare'?'Clone Overclocked':'OSHA Has Left the Chat'}`});
}
export function shopTransaction(run,event){
  if(!run.shop)throw new Error('Shop is not open');
  if(event.type==='combine')return manualCombine(run,event.itemId);
  if(event.type==='heal')return buyHealing(run);
  if(event.type==='sell')return sellItem(run,event.itemId);
  const shop={...run.shop,offers:[...run.shop.offers]},locks=[...(run.lockedIds || [])];
  if(event.type==='reroll'){
    const cost=rerollCost(run.wave,shop.rerolls);if(run.signal<cost)throw new Error('Not enough spendable Signal');
    shop.offers=shop.offers.map(i=>i && locks.includes(i.id)?i:freshNonDuplicate(run,shop));shop.rerolls++;
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
    next.weapons=run.weapons.map(w=>w.id===target.id?premiumPreview(w,cloneOverclockCap(run)):w);
  }else next=acquireItem(next,item,{replaceId:event.replaceId});
  shop.offers[index]=null;
  next.meleePeak=Math.max(run.meleePeak || 0,next.weapons.filter(w=>w.slotType==='melee').length);next.toolPeak=Math.max(run.toolPeak || 0,next.weapons.length);
  return rebuildStats(next);
}