import test from 'node:test';
import assert from 'node:assert/strict';
import { scaledEnemy,enemyHpMultiplier,enemyDamageMultiplier,enemySpeedMultiplier,signalMultiplier } from '@/game/combat/difficulty';
import { createEncounterDirector,perimeterSpawn } from '@/game/combat/encounterDirector';
import { createCampState,updateCamp,campVelocity } from '@/game/combat/antiCamp';
import { maxActiveEnemies,signalForLevel } from '@/game/data/tuning';
import { rerollCost,healingCost } from '@/game/shop/economy';
import { enterShop,shopTransaction } from '@/game/shop/shopRules';
import { createRun,normalizeRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { ENEMIES } from '@/game/data/combat';
test('Phase 2 curves apply once to ordinary/elite/boss bodies, casts, speed and fractional drops',()=>{
 for(const wave of [1,5,8,20,27,70,100]){
  const ordinary=scaledEnemy(ENEMIES.lag,wave),elite=scaledEnemy({...ENEMIES.lag,elite:true},wave);
  assert(Math.abs(elite.hp/ordinary.hp-1.35)<1e-8);assert(Math.abs(elite.damage/ordinary.damage-1.15)<1e-8);
  assert.equal(ordinary.hp,24*enemyHpMultiplier(wave));assert.equal(ordinary.damage,11*enemyDamageMultiplier(wave));assert(ordinary.speed<=64*1.25);
  assert.equal(ordinary.value,+(2*signalMultiplier(wave)).toFixed(4));assert(ordinary.value<=2&&ordinary.value>=1.5);
 }
 assert.equal(enemySpeedMultiplier(100),1.25);assert.equal(scaledEnemy(ENEMIES.lag,2).value,1.98);
 assert.equal(maxActiveEnemies(49),14);assert.equal(maxActiveEnemies(500),14);
});
test('post-five level thresholds compound 1.30, never linearly or quadratically forever',()=>{
 assert.equal(signalForLevel(5),210);assert.equal(signalForLevel(6),273);
 for(let level=7;level<30;level++)assert(Math.abs(signalForLevel(level)/signalForLevel(level-1)-1.3)<.004);
 assert(signalForLevel(20)>10000);
});
test('reroll and repair sinks share wave scaling, compound within visits, and preserve other balances',()=>{
 assert.deepEqual([0,1,2,3].map(n=>rerollCost(1,n)),[4,6,8,10]);assert.equal(healingCost(20),26);
 let run=enterShop({...createRun(characterById('nomad'),false,717,'sink'),signal:500,hp:20,xp:12,earnedSignal:700});
 const xp=run.xp,earned=run.earnedSignal,id=run.runId,price=rerollCost(1,0);run=shopTransaction(run,{type:'reroll'});assert.equal(run.signal,500-price);assert.equal(run.shop.rerolls,1);
 const before=run;run=shopTransaction(run,{type:'heal'});assert.equal(run.hp,38);assert.equal(run.signal,before.signal-12);assert.equal(run.xp,xp);assert.equal(run.earnedSignal,earned);assert.equal(run.runId,id);
 const restored=normalizeRun(JSON.parse(JSON.stringify(run)));assert.equal(restored.hp,run.hp);assert.equal(restored.shop.rerolls,1);
 const next=enterShop({...run,wave:2});assert.equal(next.shop.rerolls,0);
 assert.throws(()=>shopTransaction({...next,hp:next.maxHp},{type:'heal'}),/already full/);assert.throws(()=>shopTransaction({...next,signal:0},{type:'heal'}),/Signal/);
});
test('director guarantees front/ranged/pincers using real free capacity and opposite edges, once each',()=>{
 for(const wave of [1,5,8,20]){
  const d=createEncounterDirector(wave,()=>.25),cap=maxActiveEnemies(wave),front=d.next(.01,0,cap,1)[0];assert.equal(front.tag,'forward');assert(Math.abs(front.angle-1)<=Math.PI/3);
  assert.equal(d.next(1,cap,cap).length,0);
  const ranged=d.next(1,1,cap);assert.equal(ranged.some(r=>r.kind==='attenuation'),wave>=5);
  const pair=d.next(2,2,cap);assert.equal(pair.length,wave>=8?2:0);
  if(pair.length){assert.equal((pair[0].edge+2)%4,pair[1].edge);assert.equal(d.reserved(),0)}
  assert.deepEqual(d.next(20,0,cap),[]);
 }
 const point=perimeterSpawn({x:550,y:400},{x:0,y:0,width:1100,height:800},0);assert.equal(point.x,1135);assert.equal(point.y,400);
});
test('camp clock cannot be defeated by tiny steps; leaving 90 resets, while elite standoff moves without teleporting',()=>{
 const state=createCampState(550,400);assert(!updateCamp(state,{x:590,y:400},2));assert(updateCamp(state,{x:589,y:400},.01));assert(!updateCamp(state,{x:641,y:400},.01));
 assert.equal(state.time,0);const near=campVelocity({x:550,y:400},{x:560,y:400},100,800),far=campVelocity({x:100,y:400},{x:550,y:400},100,800);assert(near.x<0);assert(far.x>0);assert(Math.hypot(far.x,far.y)<=100);
});