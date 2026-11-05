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
  // "trying to move but barely moving": intended 120/s = 2 units per 1/60s
  // step, realized 0.1 units (<25% of the intended step)
  let frames=0,triggered=false;
  while(frames<200&&!triggered){triggered=stepPin(pin,1/60,120,0,.1,0);frames++}
  assert(triggered,`sidestep activates after sustained pinning (${frames} frames)`);
  assert(frames>=85&&frames<=95,`threshold lands at the documented ~1.5s (fired after ${frames} frames)`);
  assert.equal(pin.dir,-1,'activation alternates the side');
  const sv=sidestepVelocity(pin,0,-120,138,550,400,100,400);
  assert(Math.abs(sv.y)<1e-9,'sidestep is perpendicular to the intended heading');
  assert(sv.x>0,'the burst is flipped toward arena center');
  assert(Math.hypot(sv.x,sv.y)>137,'sidestep keeps the boss moving');
  let guard=0;while(stepPin(pin,1/60,120,0,120,0)&&++guard<100); // the burst ends
  assert.equal(pin.sidestep,0,'the sidestep is a short burst, not a lock');
  const free=createPinState();
  for(let i=0;i<6;i++)stepPin(free,1/60,120,0,.1,0);
  assert(free.blocked>0,'blocked time accumulates while pinned');
  stepPin(free,1/60,120,0,120,0);
  assert(free.blocked>0&&free.blocked<6/60,'free movement decays the blocked clock');
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
    r.weapons=[{id:'kb-probe',baseId:'vfl',name:'KB Probe',pattern:'nova',damage:4,rate:.5,range:500,mods:[],slotType:'ranged',rarity:'common'}];
  }});
  try{
    h.until(()=>h.samples.some(s=>s.foes?.some(f=>f.kind==='squirrel')),5);
    // tight orbit: the probe's effective reach is ~173 world units (weapon
    // range is a rating, not world units), so keep the trailing boss inside it
    pump(12,f=>{const a=f/60*2.2;h.input.current.x=Math.cos(a);h.input.current.y=Math.sin(a)});
    const windows=h.events.filter(e=>e.type==='squirrelPounceTelegraph').map(e=>[e.time-1.4,e.time+SQUIRREL.pounce.telegraph+SQUIRREL.pounce.leapTime+.6]);
    let max=0,jumpSeen=false,maxFoe=0;
    for(let i=1;i<h.samples.length;i++){
      const prev=new Map((h.samples[i-1].foes??[]).map(f=>[f.index,f])),cur=h.samples[i].foes??[];
      for(const f of cur){
        const q=prev.get(f.index);
        if(!q||q.kind!==f.kind)continue;
        const d=Math.hypot(f.x-q.x,f.y-q.y);
        if(f.kind==='squirrel'){
          const t=h.samples[i].time;
          if(windows.some(([a,b])=>t>=a&&t<=b))continue; // exclude the boss's own telegraph/leap frames
          if(d>12)jumpSeen=true;
          max=Math.max(max,d);
        }else maxFoe=Math.max(maxFoe,d); // contrast: normal foes under the identical config
      }
    }
    // Raw shove is ~800 units (100 knockback × the ×8 impulse); 95% resistance
    // caps the boss at ≤40 units per crit, chase drift ~10 between samples.
    assert(max<=70,`boss moved ${max.toFixed(1)} units between samples — stun-locked`);
    assert(jumpSeen,'the knockback actually landed (resisted shoves observable)');
    assert(maxFoe>max+40,`normal foes are thrown ${maxFoe.toFixed(0)} units under the identical config — the resistance is the only difference`);
  }finally{h.cleanup()}
});

test('live engine: a cornered Squirrel telegraphs, leaps and impacts; the blast locks at telegraph end so a moving target dodges', { timeout: 180000 }, async () => {
  const h=await startEncounter({width:1100,height:800,charId:'oracle',configure:r=>{
    r.wave=20;r.hp=8000;r.maxHp=8000;r.armor=100;r.weapons=[];
  }});
  try{
    h.until(()=>h.samples.some(s=>s.foes?.some(f=>f.kind==='squirrel')),5);
    // Corner the boss from standoff range: a moving player never arms the
    // elite camp standoff, and the approach stops short of contact range.
    const approach=()=>{const s=h.samples.at(-1),sq=s?.foes?.find(f=>f.kind==='squirrel');
      if(!sq){h.input.current.x=0;h.input.current.y=0;return}
      const dx=sq.x-s.player.x,dy=sq.y-s.player.y,l=Math.hypot(dx,dy)||1;
      if(l>120){h.input.current.x=dx/l;h.input.current.y=dy/l}else{h.input.current.x=0;h.input.current.y=0}};
    // Harass the boss inside trigger range: close in, orbit it, never touch.
    const harass=()=>{const s=h.samples.at(-1),sq=s?.foes?.find(f=>f.kind==='squirrel');
      if(!sq){h.input.current.x=0;h.input.current.y=0;return}
      const dx=sq.x-s.player.x,dy=sq.y-s.player.y,l=Math.hypot(dx,dy)||1;
      if(l>105){h.input.current.x=dx/l;h.input.current.y=dy/l}
      else if(l>70){const a=Math.atan2(s.player.y-sq.y,s.player.x-sq.x)+1.1;h.input.current.x=Math.cos(a);h.input.current.y=Math.sin(a)}
      else{h.input.current.x=-dx/l;h.input.current.y=-dy/l}};
    let tele=null;
    for(let t=0;t<40&&!tele;t++){pump(1,approach);tele=h.events.find(e=>e.type==='squirrelPounceTelegraph')}
    assert(tele,'cornering the Squirrel triggers the 1.2s pounce telegraph');
    const stood=h.samples.at(-1);
    pump(2,()=>{h.input.current.x=0;h.input.current.y=0}); // stand through telegraph + leap
    const impact=h.events.find(e=>e.type==='squirrelPounce');
    assert(impact,'the leap releases after the full telegraph');
    assert(impact.time-tele.time>=SQUIRREL.pounce.telegraph-.1,'the leap lands no earlier than the full 1.2s telegraph');
    assert.equal(impact.radius,SQUIRREL.pounce.impactRadius);
    assert(Math.hypot(impact.x-stood.player.x,impact.y-stood.player.y)<SQUIRREL.pounce.impactRadius,'a stationary target is caught by the blast');
    // dodge read: the leap aim locks at telegraph end, so a target that keeps
    // moving walks out of the blast radius before the leap lands
    const byTime=t=>{let best=null;for(const s of h.samples)if(!best||Math.abs(s.time-t)<Math.abs(best.time-t))best=s;return best};
    let tele2=null;
    for(let t=0;t<30&&!tele2;t++){pump(1,harass);tele2=h.events.filter(e=>e.type==='squirrelPounceTelegraph').at(1)}
    assert(tele2,'a second pounce is reachable after the cooldown');
    assert(tele2.time-impact.time>=SQUIRREL.pounce.cooldown-1,'repeats are cooldown-gated');
    const lock=byTime(tele2.time+SQUIRREL.pounce.telegraph);
    pump(2,harass);
    const impact2=h.events.filter(e=>e.type==='squirrelPounce').at(1);
    assert(impact2,'the second leap releases');
    assert(Math.hypot(impact2.x-lock.player.x,impact2.y-lock.player.y)<SQUIRREL.pounce.impactRadius,'the leap locks where the target stood at telegraph end');
    const dodged=byTime(impact2.time);
    assert(Math.hypot(impact2.x-dodged.player.x,impact2.y-dodged.player.y)>SQUIRREL.pounce.impactRadius-10,'an orbiting target walks out of the blast — the pounce is dodgeable');
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
    h.until(()=>h.samples.some(s=>s.petes?.some(p=>p.kind==='peteMini')),6);
    const miniAt=h.samples.find(s=>s.petes?.some(p=>p.kind==='peteMini'));
    // the mini may wait behind the active-foe cap for a moment; anything well
    // inside the 30s clone clock proves the shout fired the pulse early
    assert(miniAt.time-shout.time<=5,'the shout fires the duplicate pulse early');
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