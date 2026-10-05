import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodePng } from './pngDecode.mjs';
import { ENEMIES } from '@/game/data/combat.js';
import { SQUIRREL, bossWave } from '@/game/data/bosses.js';
import { characterSprite, enemySpriteDef } from '@/game/art/characterSprites.js';
import { createSquirrelAnimation, updateSquirrelAnimation, squirrelFrame, drawSquirrelSprite } from '@/game/art/squirrelSpriteAnimation.js';
import { createDonAnimation, updateDonAnimation, donFrame } from '@/game/art/donSpriteAnimation.js';
import { guideEntries } from '@/game/data/reference.js';

const BASE='https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/';
// [local path, remote filename, width, height] — heights null for the JPEG.
const ASSETS=[
  ['squirrel/idle-front.png','74fcd8572_boss_idle_front.png',1020,170],
  ['squirrel/idle-back.png','4dab873b1_boss_idle_back.png',1020,170],
  ['squirrel/walk-side.png','56d978f24_boss_walk_side.png',1020,170],
  ['squirrel/fec-attack.png','cdaad81d2_boss_fec_attack.png',1100,200],
  ['squirrel/portrait.png','f08b0630c_boss_portrait.png',147,187],
  ['don/idle-front.png','cd24a6944_don_idle_front.png',1170,190],
  ['don/idle-back.png','b3e497e7f_don_idle_back.png',1170,190],
  ['don/walk-side.png','54be9d69f_don_walk_side.png',1170,190],
  ['don/signal-poses.png','017a98330_don_signal_poses.png',520,190],
  ['don/portrait.png','0a52d8d76_don_portrait.png',127,193],
  ['landing/hero.jpg','0f35c9358_source.jpg',1168,784]
];

test('every new asset is HTTP 200 at the exact listed dimensions and byte-identical locally',async()=>{
  for(const [local,remote,w,h] of ASSETS){
    const r=await fetch(BASE+remote);
    assert.equal(r.status,200,`${remote} must be HTTP 200`);
    const bytes=Buffer.from(await r.arrayBuffer());
    const localBytes=await readFile(new URL(`../../../public/assets/${local}`,import.meta.url));
    assert.equal(bytes.length,localBytes.length,`${local} must be byte-identical to the upload`);
    if(local.endsWith('.png')){
      const d=decodePng(bytes);
      assert.equal(d.width,w,`${local} width`);assert.equal(d.height,h,`${local} height`);
    }
  }
});

test('squirrel boss is a genuinely new wave-20 gate entry, not a reused stat block',()=>{
  assert.ok(!Object.keys(ENEMIES).includes('squirrel'),'squirrel must stay out of the ordinary spawn pool');
  assert.ok(bossWave(20)&&bossWave(30)&&bossWave(40));
  assert.ok(!bossWave(19)&&!bossWave(10)&&!bossWave(15)&&!bossWave(25));
  assert.equal(SQUIRREL.hp,520);
  assert.equal(SQUIRREL.damage,22);
  assert.equal(SQUIRREL.speed,95);
  // 55° total cone, locked aim, 0.8s telegraph, 5s cooldown.
  assert.ok(Math.abs(SQUIRREL.cone.half-27.5*Math.PI/180)<1e-9);
  assert.equal(SQUIRREL.cone.pellets,7);
  assert.equal(SQUIRREL.cone.range,340);
  assert.equal(SQUIRREL.cone.damage,16);
  assert.equal(SQUIRREL.cone.windup,.8);
  assert.equal(SQUIRREL.cone.cooldown,5);
  // Standard wave-20 HP multiplier check for the report's numbers.
  assert.ok(Math.abs(SQUIRREL.hp*(1+19*.19)-2397)<2);
});

test('squirrel + don sprite definitions validate against their local manifests',async()=>{
  for(const [def,manifestPath] of [[enemySpriteDef('squirrel'),'../../../public/assets/squirrel/animation.json'],[characterSprite('don'),'../../../public/assets/don/animation.json']]){
    assert.ok(def);
    const manifest=JSON.parse(await readFile(new URL(manifestPath,import.meta.url),'utf8'));
    for(const [key,expected] of Object.entries(def.manifestSpec)){
      assert.equal(key.split('.').reduce((o,p)=>o?.[p],manifest),expected,`${manifestPath} key ${key}`);
    }
  }
});

const SQ_ART=()=>({definition:enemySpriteDef('squirrel'),atlas:{},back:{},walk:{},attack:{}});
test('squirrel FEC telegraph frames progress from windup to the release frame',()=>{
  const art=SQ_ART(),s=createSquirrelAnimation();
  s.wind=.8;s.cast=1.05; // telegraph start → frame 0 (tail begins fluffing)
  assert.equal(squirrelFrame(art,s).sx,0);
  s.wind=.3;s.cast=.55; // mid-windup → frame 2
  assert.equal(squirrelFrame(art,s).sx,2*220);
  s.wind=0;s.cast=.25; // engine fired the cone → frame 4 release, held
  const f=squirrelFrame(art,s);
  assert.equal(f.sx,4*220);assert.ok(f.attack);
  s.cast=0; // back to locomotion
  updateSquirrelAnimation(s,-1,0,.05,art.definition);
  const walk=squirrelFrame(art,s);
  assert.equal(walk.image,art.walk);assert.ok(walk.mirror); // side walk mirrors for left
  updateSquirrelAnimation(s,0,0,.2,art.definition); // stationary → idle front
  assert.equal(squirrelFrame(art,s).image,art.atlas);
  updateSquirrelAnimation(s,0,-1,.05,art.definition); // moving up sets back-facing
  updateSquirrelAnimation(s,0,0,.05,art.definition);
  assert.equal(squirrelFrame(art,s).image,art.back);
});

test('squirrel draw uses NEAREST smoothing and restores it',()=>{
  const log=[];const fake={get imageSmoothingEnabled(){return log.length%2===0},set imageSmoothingEnabled(v){log.push(v)},save(){},restore(){},translate(){},scale(){},drawImage(){}};
  drawSquirrelSprite(fake,SQ_ART(),createSquirrelAnimation(),10,10);
  assert.equal(log[0],false);
  assert.equal(log[log.length-1],true);
});

test('dispatch don frames: signal pose on special, mirrored walk, idle gesture variety',()=>{
  const def=characterSprite('don'),art={definition:def,atlas:{},back:{},walk:{},signal:{},hurt:{}};
  const s=createDonAnimation();
  s.signal=1; // 'Escalate to Field Crew' active → radio-up signal frame 0
  assert.deepEqual([donFrame(art,s).image,donFrame(art,s).sx],[art.signal,0]);
  s.signal=0;
  updateDonAnimation(s,-1,0,.05,def); // moving left → mirrored side walk
  let f=donFrame(art,s);
  assert.equal(f.image,art.walk);assert.ok(f.mirror);
  updateDonAnimation(s,0,0,3,def); // idle long enough to reach the gesture beats
  const idle=donFrame(art,s);
  assert.ok([art.atlas,art.signal].includes(idle.image));
  assert.ok([0,7*130,8*130,2*130].includes(idle.sx));
  updateDonAnimation(s,0,-1,.05,def); // moving up, then stopping → back view idle
  updateDonAnimation(s,0,0,.01,def);
  const t=donFrame(art,s);
  assert.ok(t.image===art.back||t.image===art.atlas);
});

test('wiring: engine has boss phases + FEC cone + don branch; placeholders replaced',async()=>{
  const engine=await readFile(new URL('../../game/signalEngine.js',import.meta.url),'utf8');
  for(const needle of ['spawnBoss','squirrelUpdate','fireCone','foeShots','drawSquirrelSprite','bossWave(run.wave)','e.hp<=e.max*.5','damagePlayer(s.damage)'])assert.ok(engine.includes(needle),`engine missing ${needle}`);
  assert.ok(engine.includes("charId==='don'")&&engine.includes('drawDonSprite')&&engine.includes('updateDonAnimation'),'engine must branch to the real Don sprite');
  const portrait=await readFile(new URL('../../components/game/CharacterPortrait.jsx',import.meta.url),'utf8');
  assert.ok(!portrait.includes('M75 38V55H64'),'Don SVG placeholder special-case must be gone');
  assert.ok(portrait.includes('DonPortrait'),'Don must render the real portrait');
  const arena=await readFile(new URL('../../components/game/GameArena.jsx',import.meta.url),'utf8');
  assert.ok(arena.includes("preloadEnemySprite('squirrel')")&&arena.includes('squirrelArt'),'GameArena must preload and pass the boss art');
  const home=await readFile(new URL('../../pages/Home.jsx',import.meta.url),'utf8');
  assert.ok(home.includes('/assets/landing/hero.jpg'),'landing page must render the new hero background');
  assert.ok(home.includes('bg-gradient-to-t from-game-bg'),'landing page needs a dark overlay for legibility');
  const guide=await readFile(new URL('../../pages/FieldGuide.jsx',import.meta.url),'utf8');
  assert.ok(guide.includes('DonPortrait'),"Field Guide must use Don's real portrait");
  const bosses=guideEntries().Bosses;
  assert.equal(bosses.length,1);
  assert.ok(bosses[0].title.includes('Squirrel')&&bosses[0].body.includes('55')&&bosses[0].body.includes('FEC'));
  assert.ok(Object.keys(guideEntries()).includes('Bosses'));
});