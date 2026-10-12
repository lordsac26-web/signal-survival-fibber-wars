// Instrumented real simulation and draw commands, NOT browser/device QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {startEncounter,pump,rafMap} from './engineHarness.mjs';
const quiet=r=>{r.regen=0;r.crit=0;r.instakill=0;r.luck=0;r.dodge=1;r.lifeSteal=0;r.cleaningKillsHeal=0;r.spliceQuality=0;r.damage=1;r.weapons=[]};
const weapon=(damage=0)=>({id:'isr-fixture',damage,range:1000,rangeProfile:'trace',pattern:'pierce',rate:.1,speed:1000,color:'#67e8f9'});
async function controlled(options,fn){const random=Math.random;Math.random=()=>.15;const h=await startEncounter({charId:'isr',...options});try{await fn(h)}finally{h.cleanup();Math.random=random}}
for(const [width,height] of [[375,667],[1280,800]]){
 test(`ISR ${width}×${height}: seated startup, existing + newly spawned foes AND boss at 25%, exactly8s, pause, cooldown25, no double activation`,async()=>controlled({width,height,configure:r=>{quiet(r);r.wave=20}},h=>{
  h.input.current.x=1;pump(.3);h.input.current.x=-1;h.input.current.y=.7;pump(.3);h.input.current.x=h.input.current.y=0;
  assert(h.rec.record.some(r=>r[0]==='drawImage'&&r[1]?.src?.endsWith('/isr/walk-side.png')));assert(h.rec.record.some(r=>r[0]==='drawImage'&&r[1]?.src?.endsWith('/isr/walk-left.png')));
  const prior=new Set(h.state.enemies.map(e=>e.index));assert(h.state.enemies.some(e=>e.boss));
  h.input.current.special=true;pump(1/60);const activation=h.events.find(e=>e.type==='outageStart');assert(activation);assert.equal(h.state.specialTimer,8);assert.equal(h.state.specialCooldown,25);
  for(const e of h.state.enemies){assert.equal(e.motion.slow,.25);if(e.boss)assert(Math.abs(Math.hypot(e.motion.x,e.motion.y)-e.speed*.25)<1e-7)}
  h.input.current.special=true;pump(.5);assert.equal(h.events.filter(e=>e.type==='outageStart').length,1);
  assert(h.state.enemies.some(e=>!prior.has(e.index)));for(const e of h.state.enemies)assert.equal(e.motion.slow,.25);
  const frozen=[h.state.time,h.state.specialTimer,h.state.specialCooldown];h.paused.current=true;pump(2);assert.deepEqual([h.state.time,h.state.specialTimer,h.state.specialCooldown],frozen);h.paused.current=false;
  h.until(()=>h.state.specialTimer===0,9);const expiry=h.state.time;assert(Math.abs(expiry-activation.time-8)<1e-7);
  for(const e of h.state.enemies){assert.equal(e.motion.slow,1);if(e.boss)assert(Math.abs(Math.hypot(e.motion.x,e.motion.y)-e.speed)<1e-7)}assert.equal(h.state.sprite.heal,0);
  h.input.current.special=true;pump(1/60);assert.equal(h.events.filter(e=>e.type==='outageStart').length,1);
  h.until(()=>h.state.specialCooldown===0,18);assert(Math.abs(h.state.time-activation.time-25)<1e-7);
  h.input.current.special=true;pump(1/60);assert.equal(h.events.filter(e=>e.type==='outageStart').length,2);
  assert(!h.finished);console.log('ISR_AUTOMATED_TIMER_EVIDENCE',JSON.stringify({width,height,activation:activation.time,expiry,activeSeconds:8,cooldownSeconds:25,existing:true,newSpawns:true,boss:true,paused:true,note:'Not browser rasterization'}));
 }));
 test(`ISR ${width}×${height}: real projectile kills heal once +5 in window, never before or after; laptop-origin diagonal vectors`,async()=>{
  const w=weapon(1e6);await controlled({width,height,configure:r=>{quiet(r);r.hp=500;r.maxHp=2000;r.weapons=[w]}},h=>{
   h.until(()=>h.events.filter(e=>e.type==='ownedKill').length>=2,20);assert.equal(h.state.player.hp,500);assert.equal(h.state.healed,0);
   h.input.current.special=true;pump(1/60);const start=h.events.find(e=>e.type==='outageStart').time;
   h.until(()=>h.events.some(e=>e.type==='outageHeal'),5);h.until(()=>h.state.specialTimer===0,9);
   const deaths=h.events.filter(e=>e.type==='ownedKill'&&e.time>=start&&e.time<start+8-1e-8),grants=h.events.filter(e=>e.type==='outageHeal');
   assert(deaths.length>0);assert.equal(grants.length,deaths.length);assert(grants.every(e=>e.amount===5&&e.time>=start&&e.time<start+8));
   assert.equal(new Set(grants.map(e=>`${e.time}:${e.index}`)).size,grants.length);assert.equal(h.state.healed,grants.length*5);assert.equal(h.state.player.hp,500+grants.length*5);
   const kills=h.state.kills,hp=h.state.player.hp;h.until(()=>h.state.kills>kills,8);assert.equal(h.events.filter(e=>e.type==='outageHeal').length,grants.length);assert.equal(h.state.player.hp,hp);
   const shots=h.samples.flatMap(s=>s.shots||[]);assert(shots.length);assert(shots.every(s=>s.originY<400-15));assert(shots.some(s=>Math.abs(s.vx)>1&&Math.abs(s.vy)>1));
   console.log('ISR_AUTOMATED_KILL_EVIDENCE',JSON.stringify({width,height,ownedDeathsInWindow:deaths.length,grants:grants.length,amount:5,before:0,after:0,note:'Instrumented solo simulation, not real browser or multiplayer'}));
  });
 });
}
test('ISR real maxHP cap: two or more deaths, first missing2 restores2, subsequent full-HP kills cannot over-heal',async()=>{
 const w=weapon();await controlled({width:375,height:667,configure:r=>{quiet(r);r.hp=98;r.maxHp=100;r.weapons=[w]}},h=>{
  h.until(()=>h.state?.shots.length>0,20);w.damage=1e6;h.input.current.special=true;pump(1/60);
  h.until(()=>h.events.some(e=>e.type==='outageHeal'),5);assert.equal(h.events.find(e=>e.type==='outageHeal').amount,2);
  const kills=h.state.kills;h.until(()=>h.state.kills>kills,3);assert.equal(h.state.player.hp,100);assert.equal(h.state.player.maxHp,100);assert.equal(h.state.healed,2);assert.equal(h.events.filter(e=>e.type==='outageHeal').length,1);
 });
});
for(const kind of ['weapon-turret','placed-structure'])test(`ISR real owned ${kind} death credit grants heal through the same guarded kill event`,async()=>{
 const w={...weapon(),pattern:'projectile',rate:.5,range:330,turret:{cap:1,life:1.5,fire:.1,mode:'pellet'}};
 await controlled({width:375,height:667,configure:r=>{quiet(r);r.hp=500;r.maxHp=2000;if(kind==='weapon-turret')r.weapons=[w];else{r.engineering=100;r.deployables=[{structure:'turretMount',name:'Owned mount',stacks:1}]}}},h=>{
  pump(8);w.damage=1e6;h.input.current.special=true;if(kind==='placed-structure')h.input.current.deploy=true;pump(1/60);
  h.until(()=>h.events.some(e=>e.type==='outageHeal'),7);assert(h.events.find(e=>e.type==='outageHeal').amount===5);assert(h.state.player.hp>500);
 });
});
test('ISR death mid-outage cancels effects/grants; cleanup and next-character engine have no carried active status',async()=>{
 await controlled({width:375,height:667,configure:r=>{quiet(r);r.hp=r.maxHp=1;r.armor=0;r.dodge=0;r.wave=20}},async h=>{
  h.input.current.special=true;pump(1/60);assert.equal(h.state.specialTimer,8);
  for(let i=0;i<360&&!h.finished;i++){const p=h.state.player,e=h.state.enemies[0];h.input.current.x=e.x-p.x;h.input.current.y=e.y-p.y;pump(1/60)}
  assert(h.finished);assert.equal(h.finished.hp,0);assert.equal(h.state.specialTimer,0);assert.equal(h.state.sprite.heal,0);assert.equal(h.events.filter(e=>e.type==='outageHeal').length,0);
  h.cleanup();assert.equal(rafMap.size,0);
  const next=await startEncounter({width:375,height:667,charId:'oracle',configure:quiet});try{pump(.3);assert.equal(next.state.specialTimer,0);assert.equal(next.state.specialCooldown,0)}finally{next.cleanup()}
 });
});