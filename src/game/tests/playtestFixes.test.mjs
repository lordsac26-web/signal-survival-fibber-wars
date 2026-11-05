import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SQUIRREL, PETE, ROUS } from '@/game/data/bosses';
import { ENEMIES, WEAPONS } from '@/game/data/combat';
import { scaledEnemy } from '@/game/combat/difficulty';
import { structureItemCap, UNIQUE_STRUCTURES } from '@/game/combat/deployableRules';
import { PIN, createPinState, stepPin, sidestepVelocity } from '@/game/combat/bossAntiPin';
import { formatCompact } from '@/game/data/stats';
import { STATIC_SPRITES } from '@/game/art/spriteLoader';
import { DEPLOYABLES } from '@/game/data/structures';
import { createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { startEncounter, pump, makeRecordingCtx, makeCanvas, createSignalEngine } from '@/game/tests/engineHarness.mjs';
import { decodePng } from './pngDecode.mjs';

// PLAYTEST FIX REGRESSIONS: unique-deployable cap, boss knockback resistance
// and anti-pin, the three close-range answers, the doubled truck, the
// game-over counter formatting and the new static deployable art.

test('the three heavies carry 90–100% knockback resistance through every spawn path',()=>{
  for(const b of [SQUIRREL,ROUS,PETE])assert(b.knockbackResist>=.9&&b.knockbackResist<=1,`${b.id} resistance ${b.knockbackResist}`);
  assert.equal(ENEMIES.pete.knockbackResist,PETE.knockbackResist);
  for(const base of [SQUIRREL,ROUS,ENEMIES.pete])assert.equal(scaledEnemy(base,20).knockbackResist,base.knockbackResist,'scaling preserves the resistance');
  const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
  assert(engine.includes('(1-Math.min(1,e.knockbackResist||0))'),'hit() applies the resistance to every knockback source');
  assert(engine.includes("e.pin=createPinState();e.shoutCd=4}"),'Pete gets a pin state');
  assert(engine.includes('pin:createPinState(),novaT:0'), 'R.O.U.S. gets a pin state');
  assert(engine.includes('e.pin=createPinState();e.shoutT=0;'), 'Squirrel gets a pin state');
  assert(engine.includes('stepPin(e.pin'),'anti-pin runs in the movement loop');
});

test('anti-pin: 1.5s of blocked movement triggers an alternating, center-biased sidestep burst',()=>{
  const pin=createPinState();
  for(let i=0;i<89;i++)assert.equal(stepPin(pin,1/60,120,0,5,0),false,`no sidestep before the 1.5s threshold (frame ${i})`);
  assert.equal(stepPin(pin,1/60,120,0,5,0),true,'sidestep activates at ~1.5s of being pinned');
  assert.equal(pin.dir,-1,'activation alternates the side');
  const sv=sidestepVelocity(pin,0,-120,138,550,400,100,400);
  assert(Math.abs(sv.y)<1e-9,'sidestep is perpendicular to the intended heading');
  assert(sv.x>0,'the burst is flipped toward arena center');
  assert(Math.hypot(sv.x,sv.y)>137,'sidestep keeps the boss moving');
  let guard=0;while(stepPin(pin,1/60,120,0,120,0)&&++guard<100); // the burst ends
  assert.equal(pin.sidestep,0,'the sidestep is a short burst, not a lock');
  const free=createPinState();
  stepPin(free,1,120,0,0,0);
  stepPin(free,1,120,0,120,0);
  assert(free.blocked>0&&free.blocked<1,'free movement decays the blocked clock');
  const rooted=createPinState();
  for(let i=0;i<200;i++)stepPin(rooted,1/60,0,0,0,0);
  assert.equal(rooted.blocked,0,'rooted bosses never accumulate pin time');
  assert.equal(PIN.threshold,1.5);
});

test('unique deployable caps: Keys and Barricade Kit are one-per-shift for every technician; ordinary items keep the ladder',()=>{
  const engineer=createRun(characterById('engineer'),false,91,'unique-unit');
  const nomad=createRun(characterById('nomad'),false,91,'unique-unit-n');
  const keys={id:'keys',structure:'turretMount',deploy:true};
  const cone={id:'cone',structure:'barricade',deploy:true};
  const rat={id:'rat',structure:'ratTrap',deploy:true};
  assert.equal(structureItemCap(engineer,keys),1,'Keys: engineer included');
  assert.equal(structureItemCap(engineer,cone),1,'Barricade Kit: engineer included');
  assert.equal(structureItemCap(nomad,keys),1);
  assert.equal(structureItemCap(nomad,cone),1);
  assert.equal(structureItemCap(engineer,rat),3,'ordinary items keep the engineer 3-ladder');
  assert.equal(structureItemCap(nomad,rat),2,'ordinary items keep the roster 2-ladder');
  assert.equal(structureItemCap(engineer),3,'item-less ladder calls unchanged');
  assert.equal(structureItemCap(nomad),2);
  for(const d of DEPLOYABLES)assert.equal(UNIQUE_STRUCTURES.has(d.structure),!!d.unique,`${d.id}: unique flag matches the canonical structure set`);
});

test('live engine: the unique cap refuses a second truck, consumes no cooldown, and re-opens after expiry', { timeout: 120000 }, () => {
  const run=createRun(characterById('engineer'),false,91,'unique-cap');
  run.wave=6;run.hp=run.maxHp=3000;run.armor=60;run.weapons=[];
  run.deployables=[{id:'keys',structure:'turretMount',name:'Bucket Truck Keys',icon:'🔑',stacks:1,deploy:true}];
  const rec=makeRecordingCtx(),canvas=makeCanvas(1100,800,rec),input={current:{}};
  const state={flashes:[],huds:[],samples:[]};
  const cleanup=createSignalEngine(canvas,run,input,{hud:h=>state.huds.push(h),flash:m=>state.flashes.push(m),finish(){},event(){},inspect:s=>state.samples.push(s)},{current:false});
  try{
    pump(1/60);
    const posts=()=>state.samples.at(-1)?.posts?.filter(p=>p.type==='turretMount')??[];
    const place=()=>{input.current.deploy=true;pump(1/60)};
    const step=()=>{input.current.x=1;pump(.5);input.current.x=0};
    place();
    assert.equal(posts().length,1,'first (and only) truck placed');
    step();pump(8.5); // re-arm 14s x .6 = 8.4s; the mount still lives ~12s
    place();
    assert.equal(posts().length,1,'the Keys never field a second instance — unique cap, engineer included');
    assert(state.flashes.some(f=>f.includes('ONE INSTANCE PER SHIFT')),'clear unique-cap feedback');
    const last=state.huds.at(-1).deploy;
    assert(last.items[0].cd<1,`refused placement left the cooldown at ${last.items[0].cd}s, not reset to ${last.items[0].cdMax}s`);
    pump(4.5); // past the mount's ~12s life
    assert.equal(posts().length,0,'the truck expired');
    place();
    assert.equal(posts().length,1,'a fresh placement works once the unique instance is gone');
  }finally{cleanup()}
});

test('live engine: maxed crit knockback barely displaces the wave-20 Squirrel', { timeout: 180000 }, async () => {
  const h=await startEncounter({width:1100,height:800,charId:'oracle',configure:r=>{
    r.wave=20;r.hp=4000;r.maxHp=4000;r.armor=40;
    r.crit=1;r.knockback=100;r.damage=1;r.attackSpeed=1;
    r.weapons=[{id:'kb-probe',baseId:'cleaver',name:'KB Probe',pattern:'melee',damage:4,rate:.5,range:500,mods:[],slotType:'melee',rarity:'common'}];
  }});
  try{
    h.until(()=>h.samples.some(s=>s.foes?.some(f=>f.kind==='squirrel')),5);
    // orbit so the boss is never at cornering range and no pounce mixes into the measurement
    pump(12,f=>{const a=f/60*.9;h.input.current.x=Math.cos(a);h.input.current.y=Math.sin(a)});
    const pounces=h.events.filter(e=>e.type==='squirrelPounceTelegraph'||e.type==='squirrelPounce');
    const first=pounces.find(e=>e.type==='squirrelPounceTelegraph')?.time??Infinity;
    const last=pounces.filter(e=>e.type==='squirrelPounce').at(-1)?.time??-Infinity;
    let max=0,jumpSeen=false;
    for(let i=1;i<h.samples.length;i++){
      const a=h.samples[i-1].foes?.find(f=>f.kind==='squirrel'),b=h.samples[i].foes?.find(f=>f.kind==='squirrel');
      if(!a||!b)continue;
      const t=h.samples[i].time;
      if(t>first-1.4||t<last+.8)continue; // exclude the boss's own leap frames
      const d=Math.hypot(b.x-a.x,b.y-a.y);
      if(d>12)jumpSeen=true;
      max=Math.max(max,d);
    }
    // 95% resistance turns an 800-unit raw crit shove into ≤40 units; the
    // chase itself moves ~10 units between 10Hz samples.
    assert(max<=70,`boss moved ${max.toFixed(1)} units between samples — stun-locked`);
    assert(jumpSeen,'the knockback actually landed (resisted shoves observable)');
  }finally{h.cleanup()}
});

test('live engine: a cornered Squirrel telegraphs, leaps and impacts; repeats are cooldown-gated', { timeout: 180000 }, async () => {
  const h=await startEncounter({width:1100,height:800,charId:'oracle',configure:r=>{
    r.wave=20;r.hp=8000;r.maxHp=8000;r.armor=100;r.weapons=[];
  }});
  try{
    h.until(()=>h.events.some(e=>e.type==='squirrelPounceTelegraph'),40);
    const tele=h.events.find(e=>e.type==='squirrelPounceTelegraph');
    h.until(()=>h.events.some(e=>e.type==='squirrelPounce'),5);
    const impact=h.events.find(e=>e.type==='squirrelPounce');
    assert(impact.time-tele.time>=SQUIRREL.pounce.telegraph-.1,'the leap lands after the full 1.2s telegraph');
    assert.equal(impact.hit,true,'a stationary target cannot dodge the locked leap');
    const second=h.events.filter(e=>e.type==='squirrelPounceTelegraph').at(1);
    assert(!second||second.time-impact.time>=SQUIRREL.pounce.cooldown-1,'repeats are cooldown-gated');
  }finally{h.cleanup()}
});

test('live engine: cornering Repeat Pete triggers the Client Escalation shout and an early duplicate pulse', { timeout: 180000 }, async () => {
  // Same deterministic seed the pete suite uses: Pete spawns early in wave 11.
  const realRandom=Math.random;let seed=20292688;
  Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  let h;
  try{
    h=await startEncounter({width:1280,height:800,charId:'oracle',configure:run=>{
      run.wave=11;run.hp=run.maxHp=100000;
      // weak fodder clearer keeps spawn slots open (Pete's 2k HP shrugs it off
      // for the length of the test; the shout and early mini land long before)
      run.weapons=[{id:'fodder-clear',baseId:'cleaver',name:'Fodder clear',pattern:'melee',damage:10,rate:.1,range:60,mods:[],slotType:'melee',rarity:'common'}];
    }});
    h.until(()=>h.samples.some(s=>s.petes?.some(p=>p.kind==='pete')),55);
    // actively corner Pete: chase his position every frame (a moving player
    // never arms the camp standoff, so Pete stays in contact range)
    const chase=frames=>pump(frames/60,()=>{
      const s=h.samples.at(-1),pete=s?.petes?.find(p=>p.kind==='pete');
      if(!pete)return;
      const dx=pete.x-s.player.x,dy=pete.y-s.player.y,l=Math.hypot(dx,dy)||1;
      h.input.current.x=dx/l;h.input.current.y=dy/l;
    });
    chase(60*20);
    const tele=h.events.find(e=>e.type==='peteShoutTelegraph');
    assert(tele,'cornering Pete triggers the 0.9s shout telegraph');
    const shout=h.events.find(e=>e.type==='peteShout');
    assert(shout,'the shout releases');
    assert.equal(shout.radius,PETE.shockwave.radius);
    // the early duplicate pulse: a mini appears within ~2s of the shout,
    // far ahead of the 30s clone clock
    h.until(()=>h.samples.some(s=>s.petes?.some(p=>p.kind==='peteMini')),3);
    const miniAt=h.samples.find(s=>s.petes?.some(p=>p.kind==='peteMini'));
    assert(miniAt.time-shout.time<=2.5,'the shout fires the duplicate pulse early');
  }finally{h?.cleanup();Math.random=realRandom}
});

test('live engine: a cornered R.O.U.S. telegraphs the Factory Reset nova and releases lag sprites', { timeout: 180000 }, async () => {
  const h=await startEncounter({width:1100,height:800,charId:'oracle',configure:r=>{
    r.wave=30;r.hp=20000;r.maxHp=20000;r.armor=200;r.weapons=[];
  }});
  try{
    h.until(()=>h.events.some(e=>e.type==='rousNovaTelegraph'),30);
    const before=h.samples.at(-1)?.foes?.filter(f=>f.kind==='lag').length||0;
    h.until(()=>h.events.some(e=>e.type==='rousNova'),4);
    const nova=h.events.find(e=>e.type==='rousNova');
    assert.equal(nova.radius,ROUS.nova.radius);
    assert.equal(nova.lags,2,'the nova releases a couple of lag sprites');
    h.until(()=>(h.samples.at(-1)?.foes?.filter(f=>f.kind==='lag').length||0)>=before+2,3);
    const second=h.events.filter(e=>e.type==='rousNovaTelegraph').at(1);
    assert(!second||second.time-nova.time>=ROUS.nova.cooldown-1,'repeats are cooldown-gated');
  }finally{h.cleanup()}
});

test('game-over counters: rounding, compact suffixes, clip-proof tiles',()=>{
  assert.equal(formatCompact(69.579999999999996),'70','no float tails');
  assert.equal(formatCompact(0),'0');
  assert.equal(formatCompact(41),'41');
  assert.equal(formatCompact(1234),'1.2K');
  assert.equal(formatCompact(13050),'13.1K');
  assert.equal(formatCompact(1400000),'1.4M');
  const ui=readFileSync(new URL('../../components/game/SummaryScreen.jsx',import.meta.url),'utf8');
  assert(ui.includes('formatCompact'),'the game-over screen formats every stat value');
  assert(ui.includes('min-w-0')&&ui.includes('overflow-hidden text-ellipsis'),'tiles are clip-proof');
  assert(ui.includes('text.length <= 4'),'value font shrinks for long numbers');
});

test('static deployable art decodes at exact sizes and is wired into the engine and the arena',()=>{
  for(const [key,[w,hh]] of [['barricade',[88,96]],['spliceCabinetIdle',[96,85]],['spliceCabinetActive',[82,96]]]){
    const def=STATIC_SPRITES[key];
    const decoded=decodePng(readFileSync(new URL('../../../public'+def.path,import.meta.url)));
    assert.equal(decoded.width,w,`${key} width`);assert.equal(decoded.height,hh,`${key} height`);
    assert(decoded.rgba.some((v,i)=>i%4===3&&v>200),`${key} has opaque pixels`);
  }
  const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
  assert(engine.includes('if(barricadeArt)'),'barricade sprite branch');
  assert(engine.includes('pulsesDone||elapsed<SURGE.arming?cabArt.idle:cabArt.active'),'cabinet: idle through arming, active while pulses fire, idle again after');
  const arena=readFileSync(new URL('../../components/game/GameArena.jsx',import.meta.url),'utf8');
  assert(arena.includes("preloadStaticSprite('barricade')"),'the arena preloads the barricade sprite');
  assert(arena.includes("preloadStaticSprite('spliceCabinetIdle')")&&arena.includes("preloadStaticSprite('spliceCabinetActive')"),'the arena preloads both cabinet states');
});