import test from 'node:test';
import assert from 'node:assert/strict';
import {CROSSTALK as C,createCritterState,stepCritter,critterVelocity,critterContactReady,clampCritterLunge} from '@/game/combat/crosstalk';
import {ENEMIES} from '@/game/data/combat';
import {pickEnemyKind} from '@/game/combat/jitter';
import {startEncounter,pump,rafMap} from './engineHarness.mjs';
test('Critter reuses one normal pool identity, low HP / fast speed, eligible normally from wave4',()=>{
  assert.equal(Object.keys(ENEMIES).filter(id=>id==='crosstalk').length,1);assert.equal(ENEMIES.crosstalk.hp,C.hp);assert(C.hp<ENEMIES.lag.hp);assert(C.speed>ENEMIES.jitter.speed);assert.equal(C.blink,false);
  let seed=55;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);const types=Object.keys(ENEMIES);for(const w of [1,2,3])for(let k=0;k<1000;k++)assert.notEqual(pickEnemyKind(types,w,rand),'crosstalk');let found=0;for(let k=0;k<1000;k++)if(pickEnemyKind(types,4,rand)==='crosstalk')found++;assert(found>100);
});
test('zig-zag closes forward on player; exact windup, locked lunge, one strike, recovery, death and visible bounds',()=>{
  const s=createCritterState(),sides=[];for(let k=0;k<60;k++){stepCritter(s,1/60,{dx:200,visible:true});const v=critterVelocity(s,0,106);assert(v.x>0);sides.push(v.y)}assert(sides.some(y=>y>0)&&sides.some(y=>y<0));
  s.cooldown=0;assert.equal(stepCritter(s,1/60,{dx:90,dy:0,visible:true}),'windup');assert.equal(critterContactReady(s),false);for(let k=0;k<23;k++)stepCritter(s,1/60,{dx:0,dy:100,visible:true});assert.equal(s.phase,'windup');stepCritter(s,1/60,{dx:0,dy:100,visible:true});assert.equal(s.phase,'lunge');assert.equal(s.angle,0);assert(critterContactReady(s));s.struck=true;assert(!critterContactReady(s));assert.equal(critterVelocity(s,2,106).y,0);assert.equal(critterVelocity(s,0,26.5,.25).x,82.5,'ISR slows lunge once, not just chase');
  for(const bounds of [{x:0,y:0,width:1100,height:800},{x:362,y:80,width:375,height:500}])for(const x of [-999,9999])for(const y of [-999,9999]){const e={x,y};clampCritterLunge(e,bounds);assert(e.x>=bounds.x+30&&e.x<=bounds.x+bounds.width-30&&e.y>=bounds.y+30&&e.y<=bounds.y+bounds.height-30)}
  stepCritter(s,1,{alive:false});assert.equal(s.phase,'dead');assert.deepEqual(critterVelocity(s,0,100),{x:0,y:0});assert.equal(stepCritter(s,2,{alive:true}),null);
});
for(const [width,height] of [[375,500],[1100,800]])test(`Oracle ${width}x${height} normal wave: Critters draw and lunge; pause and cleanup`,async()=>{
  const rand=Math.random;Math.random=()=>.74;
  const h=await startEncounter({width,height,configure:r=>{r.wave=6;r.weapons=[];r.dodge=1}});
  try{h.until(()=>h.state?.critters.length,3);h.until(()=>h.events.some(e=>e.type==='critterPhase'&&e.phase==='lunge'),20);assert(h.rec.record.some(r=>r[0]==='drawImage'&&r[1]?.src?.includes('/crosstalk/')));const n=h.samples.length;h.paused.current=true;pump(1);assert.equal(h.samples.length,n);h.paused.current=false;h.cleanup();assert.equal(rafMap.size,0)}finally{h.cleanup();Math.random=rand}
});