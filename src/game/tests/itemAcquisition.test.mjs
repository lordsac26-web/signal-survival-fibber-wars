import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator, WEAPON_ARCHETYPES } from '@/game/data/generation';
import { createRun, rebuildStats, normalizeRun } from '@/game/progression/runRules';
import { acquireItem, manualCombine } from '@/game/items/acquisition';
import { tierId, combineStatus, canCombine } from '@/game/items/tiers';
import { characterById } from '@/game/data/characters';
import { upgradeChoices, pickUpgrade } from '@/game/progression/upgradeRules';
import { enterShop, shopTransaction, offerReason } from '@/game/shop/shopRules';
import { ownedMatch } from '@/game/shop/duplicateOffers';
import { guideEntries } from '@/game/data/reference';
const run=()=>({...createRun(characterById('nomad'),false,42,'combine-run'),signal:1000000});
const tool=(id='owned',tier='common',index=4)=>({...createGenerator(19).weapon(0,[WEAPON_ARCHETYPES[index]],tier),id,cost:50});
const shop=(r,item)=>({...r,shop:{wave:r.wave,offers:[item,null,null,null],rerolls:0,sequence:1}});
test('purchase auto-combines before slot/family checks, spends once, removes old stats and preserves XP',()=>{
  let r=run();r.weapons=Array.from({length:6},(_,i)=>tool(`owned-${i}`,'common',i));r=rebuildStats(r);
  const incoming=tool('incoming','common',0),before=JSON.stringify(r),s=shop(r,incoming),next=shopTransaction(s,{type:'buy',offerId:incoming.id});
  assert.equal(JSON.stringify(r),before);assert.equal(next.weapons.length,6);assert.equal(next.weapons.find(w=>w.baseId===incoming.baseId).rarity,'rare');
  assert.equal(next.signal,r.signal-50);assert.equal(next.xp,r.xp);assert.equal(next.earnedSignal,r.earnedSignal);assert(next.combineNotices.length);
  assert.equal(next.shop.offers[0],null);assert.throws(()=>shopTransaction(next,{type:'buy',offerId:incoming.id}),/already/);
  const expected=rebuildStats(next);assert.equal(next.armor,expected.armor);assert.equal(next.damage,expected.damage);
});
test('manual combines saved pairs, cascades, persists, refuses stale actions and never charges',()=>{
  const item=tool(),r={...run(),weapons:[item,{...item,id:'partner'}]},before=JSON.stringify(r);
  assert.equal(combineStatus(r,item),'2/2 combines to Rare');
  const next=shopTransaction({...r,shop:{wave:1,offers:[null,null,null,null],rerolls:0,sequence:0}},{type:'combine',itemId:item.id});
  assert.equal(next.weapons.length,1);assert.equal(next.weapons[0].rarity,'rare');assert.equal(next.signal,r.signal);
  assert.equal(JSON.stringify(r),before);assert.throws(()=>manualCombine(next,next.weapons[0].id),/No matching/);
  assert.equal(normalizeRun(JSON.parse(JSON.stringify(next))).weapons[0].rarity,'rare');
});
test('level-up picks share UI generator and acquisition auto-combine, including Clone cap',()=>{
  for(const character of ['nomad','clone']){
    const r={...createRun(characterById(character),false,52,`upgrade-${character}`),pendingLevels:2,level:4},choices=upgradeChoices(r),item=choices[0];
    if(character==='clone')assert(choices.every(i=>['common','rare'].includes(i.rarity)));
    const owned={...item,id:'owned-level-item'},next=pickUpgrade({...r,items:[owned]},item.id);
    assert.equal(next.items.length,1);assert(next.combineNotices.length);assert.equal(next.pendingLevels,1);assert.equal(next.level,5);
    assert(!canCombine(next.items[0],item));assert.throws(()=>pickUpgrade(next,'old-choice'),/changed/);
  }
});
test('passive and deployable loot acquisition auto-combines, but cross-tier loot remains separate',()=>{
  const generator=createGenerator(7),p=generator.passive(0,undefined,'common','Slack Coils');
  let r=acquireItem(run(),p);r=acquireItem(r,{...p,id:'second'});assert.equal(r.items.length,1);assert.equal(r.items[0].rarity,'rare');
  r=acquireItem(r,{...p,id:'third'});assert.equal(r.items.length,2);
  const d=generator.deployable();r=acquireItem(r,d);r=acquireItem(r,{...d,id:'second-deploy'});assert.equal(r.deployables.length,1);assert.notEqual(r.deployables[0].rarity,d.rarity);
});
test('duplicate visit rate stays near 30%, exact tier/identity, max one, no new duplicate on reroll',()=>{
  let visits=0,duplicateVisits=0;
  for(let seed=1;seed<=1200;seed++){
    const base={...run(),seed:seed*7919,weapons:[tool()],wave:1+seed%30},r=enterShop(base),matches=r.shop.offers.filter(i=>i && ownedMatch(r,i));
    visits++;if(matches.length)duplicateVisits++;
    assert(matches.length<=1);if(matches.length){assert(canCombine(base.weapons[0],matches[0]));assert.notEqual(matches[0].rarity,'overclocked')}
    const rolled=shopTransaction(r,{type:'reroll'});assert(!rolled.shop.offers.some(i=>i && ownedMatch(rolled,i)));
  }
  const rate=duplicateVisits/visits;assert(rate>.26 && rate<.34,`duplicate visit rate ${rate}`);
  console.log('PHASE1_DUPLICATE_VISITS',JSON.stringify({visits,duplicateVisits,rate}));
});
test('duplicate candidate respects Clone roll ceiling and two exact-price locks',()=>{
  let r=enterShop({...run(),weapons:[tool()]});const [first,second]=r.shop.offers;
  r=shopTransaction(r,{type:'lock',offerId:first.id});r=shopTransaction(r,{type:'lock',offerId:second.id});
  assert.throws(()=>shopTransaction(r,{type:'lock',offerId:r.shop.offers[2].id}),/two/);
  const snapshot=[first,second].map(JSON.stringify),next=enterShop({...r,wave:2});assert.deepEqual(next.shop.offers.slice(0,2).map(JSON.stringify),snapshot);
  const clone={...run(),character:characterById('clone'),weapons:[tool('high','epic')]};
  for(let wave=1;wave<=40;wave++)assert(enterShop({...clone,wave}).shop.offers.filter(Boolean).every(i=>['common','rare'].includes(tierId(i.rarity))));
});
test('Overclocked shop injection is rejected and cannot spend Signal',()=>{
  const r=run(),item=tool('unsold','overclocked');assert.match(offerReason(r,item),/never sold/);assert.throws(()=>shopTransaction(shop(r,item),{type:'buy',offerId:item.id}),/never sold/);
});
test('Field Guide covers every weapon/passive/deployable with the same previewable item contract',()=>{
  const entries=guideEntries();assert.equal(entries.Tools.length,20);assert.equal(entries.Passives.length,35);assert.equal(entries.Deployables.length,5);
  assert(entries.Rarity.some(e=>e.title==='Basic'));assert(entries.Rarity.some(e=>e.title==='Overclocked'));
  for(const item of [...entries.Tools,...entries.Passives,...entries.Deployables]){assert(item.item);assert.equal(item.item.rarity,'common');assert.match(combineStatus({},item.item),/1\/2/)}
});