import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '@/game/data/combat';
import { WEAPON_ARCHETYPES, DESIGNATIONS } from '@/game/data/generation';
import { rebuildStats, normalizeRun, createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { enterShop, shopTransaction } from '@/game/shop/shopRules';
import { startEncounter, pump } from './engineHarness.mjs';

const weapon=id=>({...WEAPONS[id],baseId:id,id:`audit-${id}`});
const triggers=(events,name)=>events.filter(e=>e.type==='weaponTrigger'&&e.weapon===name);

test('weapon-trigger cadence: one weapon, engine-measured count matches rate/attackSpeed exactly',async()=>{
 let enc;
 enc=await startEncounter({width:900,height:700,charId:'oracle',configure:run=>{
  run.wave=6;run.weapons=[weapon('splicer')];run.attackSpeed=1;run.crit=0;run.spliceQuality=0;run.cleanliness=0;run.instakill=0;run.damage=1;
 }});
 pump(30);
 const sim=enc.state.time,trig=triggers(enc.events,'Fusion Splicer');
 assert(trig.length>0,'the weapon never fired');
 assert(Math.abs(trig.length-Math.floor(sim/.92)-1)<=2,`trigger count ${trig.length} vs floor(${sim}/.92)+1`);
 for(const t of trig)assert.equal(t.scheduled,.92);
});

test('multi-weapon loadout: every weapon fires on its own cadence, no starvation',async()=>{
 const enc=await startEncounter({width:900,height:700,charId:'oracle',configure:run=>{
  run.wave=6;run.weapons=[weapon('cleaver'),weapon('otdr'),weapon('vfl')];
  run.attackSpeed=1;run.crit=0;run.spliceQuality=0;run.cleanliness=0;run.instakill=0;run.damage=1;
 }});
 pump(30);
 const sim=enc.state.time;
 for(const [name,rate] of [['Fiber Cleaver',.7],['OTDR',1.25],['Visual Fault Locator',.28]]){
  const got=triggers(enc.events,name).length,expect=Math.floor(sim/rate)+1;
  assert(got>0,`${name} starved`);
  assert(Math.abs(got-expect)<=2,`${name}: ${got} vs ${expect}`);
 }
});

test('attack-speed modifier divides each cooldown; pause freezes triggers and resumes',async()=>{
 const enc=await startEncounter({width:900,height:700,charId:'oracle',configure:run=>{
  run.wave=6;run.weapons=[weapon('vfl')];run.attackSpeed=1.5;run.crit=0;run.spliceQuality=0;run.cleanliness=0;run.instakill=0;run.damage=1;
 }});
 pump(5);
 const before=triggers(enc.events,'Visual Fault Locator').length;
 enc.paused.current=true;pump(3);
 const frozen=triggers(enc.events,'Visual Fault Locator').length;
 enc.paused.current=false;pump(2);
 const total=triggers(enc.events,'Visual Fault Locator').length,sim=enc.state.time;
 assert.equal(frozen,before,'triggers fired while paused');
 assert(Math.abs(total-Math.floor(sim/(.28/1.5))-1)<=2,`total ${total} vs floor(${sim}/.187)-based count`);
 for(const t of triggers(enc.events,'Visual Fault Locator'))assert(Math.abs(t.scheduled-.28/1.5)<1e-6);
});

test('damage exactly-once: each logged area hit contributes exactly base×run.damage',async()=>{
 const enc=await startEncounter({width:900,height:700,charId:'oracle',configure:run=>{
  run.wave=6;run.weapons=[weapon('splicer')];
  run.attackSpeed=1;run.crit=0;run.spliceQuality=0;run.cleanliness=0;run.instakill=0;run.damage=1;run.lifeSteal=0;
 }});
 pump(25);
 const hits=enc.events.filter(e=>e.type==='attackHits'&&e.weapon==='Fusion Splicer');
 assert(hits.length>0,'no nova connected');assert(hits.reduce((s,h)=>s+h.hits,0)>0);
 let total=0;for(const h of hits)total+=h.hits;
 const dealt=enc.state.damageDealt;
 assert(Math.abs(dealt-total*31)<1e-6,`damageDealt ${dealt} vs ${total} hits × 31`);
 for(const h of hits)assert.equal(h.pattern,'nova');
});

test('balance audit: per-hit DPS inside the band; chain trio normalized; archetypes match WEAPONS',()=>{
 const band=[];const chain=[];
 for(const a of WEAPON_ARCHETYPES){
  const [id,,pattern,,dmg,rate]=a;
  if(pattern==='turret'){ // per-sentry DPS instead of per-trigger DPS
   const per=dmg*(a[8].mode==='spread'?5:1)/a[8].fire;assert(per>=20&&per<=40,`${id} per-sentry DPS ${per} outside 20-40`);
   assert(a[8].cap<=3,`${id} cap above 3`);
   continue;
  }
  const dps=dmg/rate*(pattern==='chain'?3:1);
  (pattern==='chain'?chain:band).push([id,dps]);
 }
 for(const [id,dps] of band)assert(dps>=20&&dps<=46,`${id} DPS ${dps} outside 20-46`);
 for(const [id,dps] of chain)assert(dps>=30&&dps<=42,`chain ${id} DPS ${dps} outside 30-42`);
 // the audit's normalization: rate changes only — damage/pattern untouched
 assert.equal(WEAPONS.jumper.rate,1.6);assert.equal(WEAPONS.stripper.rate,.22);
 assert.equal(WEAPON_ARCHETYPES.find(a=>a[0]==='jumper')[5],1.6);
 assert.equal(WEAPON_ARCHETYPES.find(a=>a[0]==='switch')[5],1.7);
 assert.equal(WEAPON_ARCHETYPES.find(a=>a[0]==='stripper')[5],.22);
 assert.equal(WEAPONS.jumper.damage,18);assert.equal(WEAPONS.stripper.damage,8);
 // guide designation text still matches the fan identity
 assert.equal(DESIGNATIONS.chain,'Melee (fan)');
 // WEAPONS and WEAPON_ARCHETYPES stay in sync on damage and rate
 for(const a of WEAPON_ARCHETYPES){const w=WEAPONS[a[0]];if(!w)continue;assert.equal(w.damage,a[4],a[0]);assert.equal(w.rate,a[5],a[0]);assert.equal(w.pattern,a[2],a[0])}
});

test('inventory progression: level grant, shop buy and save round-trip hydrate identical stats',()=>{
 const base=createRun(characterById('oracle'),false,77,'hydrate-run');
 // midrun level grant: rebuildStats with a new passive item applies its rolls
 const item={id:'grant-1',name:'Service Loops',icon:'↺',rarity:'Rare',mods:[{stat:'damage',value:.05,label:'Damage %'},{stat:'attackSpeed',value:.04,label:'Attack Speed'}]};
 const leveled=rebuildStats({...base,level:3,items:[...base.items,item]});
 assert.equal(leveled.damage,base.damage+.05);
 assert.equal(leveled.attackSpeed,base.attackSpeed+.04);
 // shop buy: a weapon purchase enters the loadout and re-hydrates stats
 const opened=enterShop({...base,signal:100000});
 const offer=opened.shop.offers.find(o=>o&&o.baseId);
 assert(offer,'no weapon offer in a fresh shop');
 const bought=shopTransaction(opened,{type:'buy',offerId:offer.id});
 assert(bought.weapons.some(w=>w.id===offer.id||w.baseId===offer.baseId));
 assert(bought.damage!==undefined);
 // save round-trip: normalizeRun(hydrate(JSON.stringify)) preserves stats
 const saved=JSON.parse(JSON.stringify({...bought,character:characterById(bought.character.id)}));
 const loaded=normalizeRun(saved);
 assert(loaded,'save failed to hydrate');
 assert.equal(loaded.damage,bought.damage);
 assert.equal(loaded.weapons.length,bought.weapons.length);
 assert.equal(loaded.hp,bought.hp);
 assert.equal(loaded.items.length,bought.items.length);
 // legacy string weapons hydrate too
 const legacy=normalizeRun({...saved,weapons:['cleaver','vfl'],items:[]});
 assert(legacy.weapons.every(w=>w.baseId&&w.slotType));
});