import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, characterById } from '@/game/data/characters';
import { createRun, normalizeRun, legalLoadout, rebuildStats, allowedWeapon } from '@/game/progression/runRules';
import { freshProfile, migrateProfile, completeRun } from '@/game/progression/profileModel';
import { enterShop, shopTransaction, premiumPreview, premiumTargets, cloneOverclockCap } from '@/game/shop/shopRules';
import { unlockMet } from '@/game/data/unlocks';
import { createGenerator } from '@/game/data/generation';
import { TUNING, signalForLevel, spawnInterval, spawnDoubleChance, maxActiveEnemies } from '@/game/data/tuning';
import { readFileSync } from 'node:fs';
import { formatStat, itemDeltas } from '@/game/data/stats';
import { supplyEstimate } from '@/game/data/balanceAudit';
import { activateSignature } from '@/game/combat/signatures';
import { validateProfile } from 'profileValidation';
const run=(id='rookie')=>({...createRun(characterById(id),false,123456,`test-${id}`),signal:10000});
const shop=()=>enterShop(run());
const weapon=(id,pattern='projectile',rarity='Common')=>({id,baseId:'power',name:id,pattern,rarity,damage:30,rate:1,range:300,mods:[],slotType:pattern==='melee'?'melee':'ranged'});
test('13 technicians on the roster; 11 immediately selectable; kits obey restrictions',()=>{assert.equal(CHARACTERS.length,13);assert.equal(migrateProfile({unlocked:['rookie']}).unlocked.length,11);for(const c of CHARACTERS){for(const alt of [false,true]){const r=createRun(c,alt,12,`kit-${c.id}`);assert(legalLoadout(c,r.weapons));assert(r.specialUnlocked);validateProfile({...freshProfile(),checkpoint:{phase:'ready',run:r}},'owner')}}});
test('legacy career preserved and Dispatch ids migrate',()=>{const p=migrateProfile({version:3,runs:12,totalKills:345,highWave:9,unlocked:['rookie','veteran'],selectedCharacter:'dispatch',highWaveByCharacter:{dispatch:9},loadouts:['dispatch:alt']});assert.equal(p.runs,12);assert(p.challenges.includes('veteran'));assert.equal(p.totalKills,345);assert.equal(p.selectedCharacter,'don');assert.equal(p.highWaveByCharacter.don,9);assert(p.loadouts.includes('don:alt'));assert.equal(characterById('dispatch').name,'Dispatch Don')});
test('completion run id is idempotent; death removes checkpoint not career',()=>{const r={...run(),hp:0,kills:20,earnedSignal:70};const a=completeRun(freshProfile(),r).save,b=completeRun(a,r).save;assert.equal(b.runs,1);assert.equal(b.totalKills,20);assert.equal(b.bestSignal,70);assert.equal(b.checkpoint,null)});
test('load sanitizes forbidden weapons, family limits and old deploy ranks',()=>{const r=run('frenzy');const next=normalizeRun({...r,weapons:[...r.weapons,weapon('illegal')],deployables:[{structure:'barricade',stacks:4}]});assert(next.weapons.every(w=>allowedWeapon(next.character,w)));assert.equal(next.deployables[0].stacks,2)});
test('Veteran never exceeds 4 per family, even when replacing at total capacity',()=>{const c=characterById('veteran'),ws=[...Array.from({length:4},(_,i)=>weapon(`m${i}`,'melee')),...Array.from({length:4},(_,i)=>weapon(`r${i}`))];assert(legalLoadout(c,ws));assert(!legalLoadout(c,ws.map(w=>w.id==='r0'?weapon('new','melee'):w)))});
test('max two locks; retained exactly across reroll, next shop and JSON checkpoint',()=>{let r=shop();const ids=r.shop.offers.map(i=>i.id);for(const id of ids.slice(0,2))r=shopTransaction(r,{type:'lock',offerId:id});const exact=r.shop.offers.slice(0,2).map(i=>JSON.stringify(i));assert.throws(()=>shopTransaction(r,{type:'lock',offerId:ids[2]}),/two offers/);r=shopTransaction(r,{type:'reroll'});assert.deepEqual(r.shop.offers.slice(0,2).map(i=>JSON.stringify(i)),exact);r=enterShop({...r,wave:2});assert.equal(r.shop.offers.length,4);assert.deepEqual(r.shop.offers.slice(0,2).map(i=>JSON.stringify(i)),exact);const restored=migrateProfile({checkpoint:{phase:'shop',run:JSON.parse(JSON.stringify(r))}});assert.deepEqual(restored.checkpoint.run.shop.offers.slice(0,2).map(i=>JSON.stringify(i)),exact)});
test('purchases clear locks and cannot spend twice; XP/earned Signal unchanged',()=>{let r=shop();const item=r.shop.offers[0];r=shopTransaction(r,{type:'lock',offerId:item.id});const next=shopTransaction(r,{type:'buy',offerId:item.id});assert.equal(next.signal,r.signal-item.cost);assert.equal(next.xp,r.xp);assert.equal(next.earnedSignal,r.earnedSignal);assert(!next.lockedIds.includes(item.id));assert.throws(()=>shopTransaction(next,{type:'buy',offerId:item.id}),/already/)});
test('replacing weapons removes their rolled contributions, keeps passives',()=>{let r=run();const old={...r.weapons[0],mods:[{stat:'damage',value:.5},{stat:'pierce',value:3},{stat:'knockback',value:4}]};r=rebuildStats({...r,weapons:[old],items:[{id:'pass',mods:[{stat:'armor',value:3}]}]});const item=weapon('replacement');r={...r,shop:{wave:1,offers:[item,null,null,null],sequence:1,rerolls:0}};const next=shopTransaction(r,{type:'buy',offerId:item.id,replaceId:old.id});assert.equal(next.damage,r.character.stats.damage);assert.equal(next.pierce,0);assert.equal(next.knockback,0);assert.equal(next.armor,3)});
test('premium upgrades exact instance; cancel is no transaction; bounded ranks',()=>{let r=run();const target=weapon('epic','projectile','Epic'),other=weapon('other','projectile','Legendary'),card={id:'card',premium:true,cost:108,rarity:'Legendary',name:'OSHA'};r={...r,weapons:[target,other],shop:{wave:1,offers:[card,weapon('locked'),null,null],sequence:1,rerolls:0},lockedIds:['locked']};const before=JSON.stringify(r);assert.throws(()=>shopTransaction(r,{type:'buy',offerId:card.id,weaponId:'missing'}));assert.equal(JSON.stringify(r),before);let next=shopTransaction(r,{type:'buy',offerId:card.id,weaponId:target.id});assert.equal(next.weapons[0].id,target.id);assert.equal(next.weapons[0].rarity,'Legendary');assert.deepEqual(next.weapons[1],other);assert.equal(next.signal,r.signal-card.cost);assert.deepEqual(next.shop.offers[1],r.shop.offers[1]);assert.deepEqual(next.lockedIds,['locked']);const capped=premiumPreview(premiumPreview(next.weapons[0]));assert.equal(capped.overclockRank,2);assert.throws(()=>premiumPreview(capped),/cap/)});
test('deployables cap ranks and cannot duplicate a granted signature',()=>{const r=run('bucket'),item={id:'keys',deploy:true,structure:'turretMount',cost:80};const s={...r,shop:{wave:1,offers:[item],sequence:1,rerolls:0}};assert.throws(()=>shopTransaction(s,{type:'buy',offerId:'keys'}),/Signature/)});
test('server rejects other owners, illegal equipped/offered tools, third lock and rank overflow',()=>{assert.throws(()=>validateProfile({ownerId:'other'},'owner'),/owner/);let r=enterShop(run('oracle'));r.weapons=[weapon('melee','melee')];assert.throws(()=>validateProfile({checkpoint:{phase:'shop',run:r}},'owner'),/Forbidden/);r=shop();r.lockedIds=r.shop.offers.slice(0,3).map(i=>i.id);assert.throws(()=>validateProfile({checkpoint:{phase:'shop',run:r}},'owner'),/two/);r=shop();r.deployables=[{structure:'barricade',stacks:3}];assert.throws(()=>validateProfile({checkpoint:{phase:'shop',run:r}},'owner'),/rank/)});
test('server refuses changing a character within the same run id',()=>{const a=run('rookie'),b={...run('oracle'),runId:a.runId};assert.throws(()=>validateProfile({checkpoint:{phase:'ready',run:b}},'owner',{checkpoint:{run:a}}),/midway/)});
test('small percentage rolls display correctly, not as zero percent',()=>{assert.equal(formatStat('percent',.003),'0.3%');assert.equal(formatStat('velocity',250),'250 units/s');assert.equal(itemDeltas({mods:[{stat:'instakill',value:.003}]}).at(0).text,'+0.3% Instakill Chance')});
test('positive Luck decreases Common frequency',()=>{const a=createGenerator(111),b=createGenerator(111);let ac=0,bc=0;for(let i=0;i<10000;i++){if(a.weapon(0).rarity==='Common')ac++;if(b.weapon(100).rarity==='Common')bc++}assert(bc<ac-1000)});
test('fresh offer rates sampled; forbidden tools never offered; premium eligibility enforced',()=>{let deploy=0,premium=0,n=0;for(let wave=1;wave<=5000;wave++){const r=enterShop({...run(),wave,weapons:[weapon('epic','projectile','Epic')]});for(const i of r.shop.offers){n++;if(i.deploy || i.turret)deploy++;if(i.premium)premium++}}console.log('OFFER_AUDIT',JSON.stringify({freshSlots:n,deploy,deployPercent:deploy/n*100,premium,premiumPercent:premium/n*100}));assert(deploy/n>.014 && deploy/n<.026);assert(premium/n>.006 && premium/n<.014);for(const id of ['frenzy','oracle'])for(let wave=1;wave<=300;wave++){const r=enterShop({...run(id),wave});assert(r.shop.offers.every(i=>!i.baseId || allowedWeapon(r.character,i)));assert(r.shop.offers.every(i=>!i.premium))}});
test('XP reduction, rising thresholds and spawn supply estimate are explicit',()=>{assert.equal(TUNING.xpPickupFactor,.65);for(let l=1;l<100;l++)assert(signalForLevel(l)>signalForLevel(l-1));const audit=[1,2,3].map(supplyEstimate);console.log('SPAWN_SUPPLY_ESTIMATE_NOT_PLAYTEST',JSON.stringify(audit));assert.equal(audit[0].newOrdinaryXp,+(audit[0].oldOrdinaryXp*.65).toFixed(2))});
test('new technicians: kits, unlock gates, signature timers and engine wiring',()=>{
  assert.equal(CHARACTERS.length,13);
  const clone=characterById('clone'),isr=characterById('isr');
  assert.equal(clone.stats.cleanliness,-35);assert.equal(clone.stats.speed,275);
  assert(!unlockMet({deaths:0,squirrelDefeated:false},clone));assert(unlockMet({deaths:5},clone));
  assert(!unlockMet({squirrelDefeated:false},isr));assert(unlockMet({squirrelDefeated:true},isr));
  for(const c of [clone,isr]) for(const alt of [false,true]){const r=createRun(c,alt,12,`kit2-${c.id}`);assert(legalLoadout(c,r.weapons));validateProfile({...freshProfile(),checkpoint:{phase:'ready',run:r}},'owner')}
  assert.equal(activateSignature({...run('clone'),character:clone},{},{}),8);
  assert.equal(activateSignature({...run('isr'),character:isr},{},{}),8);
  const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
  assert(engine.includes("'outage'?.5:1"));assert(engine.includes("cash'?2:1"));assert(engine.includes('outage?2.2:1'));
  const audio=readFileSync(new URL('../audio.js',import.meta.url),'utf8');
  assert(audio.includes('cash:()=>'));assert(audio.includes('whistle:()=>'));
});
test('Contractor Clone: Rare rarity cap everywhere, Rare overclock to rank 3, roster gating',()=>{
  const g=createGenerator(77,1,'Rare');for(let i=0;i<200;i++)assert(['Common','Rare'].includes(g.weapon(0).rarity));
  const clone={...run('clone'),weapons:[weapon('rare','projectile','Rare')]};
  assert.equal(premiumTargets(clone).length,1);
  assert.equal(premiumPreview(premiumTargets(clone)[0],cloneOverclockCap(clone)).overclockRank,1);
  const ranked={...weapon('rare','projectile','Rare'),overclockRank:3};
  assert(!premiumTargets({...clone,weapons:[ranked]}).length);
  const rookie={...run(),weapons:[weapon('rare','projectile','Rare')]};assert(!premiumTargets(rookie).length);
  assert(/Clone Overclocked/.test(premiumPreview(weapon('r2','projectile','Rare')).name));
});
test('item stat rolls scale with wave (capped at 2×)',()=>{
  assert.equal(TUNING.itemStatWaveScale,.06);
  // Aggregate over many seeds: per-value display rounding would make a single
  // comparison noisy, but summed roll value converges on the scale factor.
  const sum=wave=>{let t=0;for(let s=1;s<=200;s++){for(const m of createGenerator(s*7919,wave).passive(0).mods)t+=m.value}return t};
  const early=sum(1),late=sum(20),capped=sum(40);
  assert(Math.abs(late/early-(1+TUNING.itemStatWaveScale*19))<.08);
  assert(Math.abs(capped/early-2)<.08);
});
test('rotator-style wave density: trickle pacing, 34-active ceiling, stat scaling replaces body count',()=>{
  assert.equal(maxActiveEnemies(1),13);assert.equal(maxActiveEnemies(8),23);assert.equal(maxActiveEnemies(15),33);
  assert.equal(maxActiveEnemies(20),34);assert.equal(maxActiveEnemies(40),34);
  for(let w=2;w<=40;w++)assert(maxActiveEnemies(w)>=maxActiveEnemies(w-1));
  assert.equal(spawnInterval(20),.32);assert(Math.abs(spawnInterval(1)-.698)<1e-9);assert(spawnInterval(8)<spawnInterval(1));
  assert.equal(spawnDoubleChance(20),.4);assert.equal(spawnDoubleChance(1),.03);
  const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
  assert(engine.includes('maxActiveEnemies(run.wave)'));
  assert(engine.includes('spawnEnemy(null,true)'));
  assert(engine.includes('base.hp*(1+(run.wave-1)*.28)'));
  assert(engine.includes('base.damage*(1+(run.wave-1)*.02)'));
});
test('every signature has an effect hook, Don grants four helpers, Bucket grants one sentry',()=>{for(const c of CHARACTERS){const r=run(c.id),p={x:327,y:412,inv:0};const calls=[];const api={area:(...a)=>calls.push(['area',...a]),launch:(...a)=>calls.push(['launch',...a]),heal:a=>calls.push(['heal',a]),turret:a=>{calls.push(['turret',a]);return true},barrier:()=>{calls.push(['barrier']);return true}};assert.notEqual(activateSignature(r,p,api),null);if(c.id==='don')assert.equal(calls.filter(a=>a[0]==='turret').length,4);if(c.id==='bucket')assert.equal(calls.filter(a=>a[0]==='turret').length,1);if(c.id==='admin')assert.equal(p.inv,1.5)}});