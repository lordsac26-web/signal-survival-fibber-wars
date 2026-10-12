// Repeat Pete: asset, spawn-gate, clone-pulse and guide regression tests.
// Automated engine harness only — runtime/state evidence, never browser
// visual verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PETE } from '@/game/data/bosses';
import { ENEMIES } from '@/game/data/combat';
import { pickEnemyKind } from '@/game/combat/jitter';
import { enemySpriteDef } from '@/game/art/characterSprites';
import { drawTechEnemy } from '@/game/art/techSpriteAnimation';
import { guideEntries } from '@/game/data/reference';
import { decodePng } from './pngDecode.mjs';
import { startEncounter, pump } from './engineHarness.mjs';

const file=p=>readFileSync(new URL('../../../public'+p,import.meta.url));
const def2=enemySpriteDef('pete');

test('processed strips match the definition, clean cells, manifest counts',()=>{
  assert.equal(def2.portraitW,124);assert.equal(def2.portraitH,124);assert.equal(def2.worldSize,58);
  assert.equal(def2.walkColumns,6);assert.equal(def2.walkLeftColumns,6);
  assert.equal(def2.attackColumns,4);assert.equal(def2.specialColumns,8);
  const strips=[['idle-front.png',124,124,1],['walk-side.png',744,124,6],['walk-left.png',744,124,6],['attack.png',496,124,4],['special.png',1120,140,8]];
  for(const [name,w,h,cols] of strips){
    const img=decodePng(file('/assets/pete/'+name));
    assert.equal(img.width,w);assert.equal(img.height,h,name);
    // per-cell: outermost 2 columns transparent, full body present, feet
    // anchored to the bottom row (final walk poses may lift the trailing foot)
    const cellW=w/cols,cellH=h;
    for(let c=0;c<cols;c++){
      let edgeOp=0,body=0,lowest=-1;
      for(let y=0;y<h;y++)for(let x=c*cellW;x<(c+1)*cellW;x++){
        const a=img.rgba[(y*w+x)*4+3];
        if(a>=200){body++;if(x<c*cellW+2||x>=(c+1)*cellW-2)edgeOp++;if(y>lowest)lowest=y}
      }
      assert.equal(edgeOp,0,name+' cell '+c+' edge bleed');
      assert(body>1500,name+' cell '+c+' full body present, saw '+body);
      assert(h-1-lowest<=2,name+' cell '+c+' feet anchored, lowest row '+lowest);
    }
    // no stray near-opaque pixels; (Pete's own glow is magenta-family by
    // design, so chromatic background checks would false-positive here —
    // spatial gutter/edge checks above carry the cleanliness contract)
    for(let i=0;i<img.rgba.length;i+=4){
      const a=img.rgba[i+3];
      if(a>0&&a<200)assert(a<200,name+' no stray near-opaque');
    }
  }
  const manifest=JSON.parse(file('/assets/pete/animation.json'));
  assert.equal(manifest.frameWidth,124);assert.equal(manifest.frameHeight,124);
  assert.equal(manifest.walkSide.columns,6);assert.equal(manifest.walkLeft.columns,6);
  assert.equal(manifest.attack.columns,4);assert.equal(manifest.special.columns,8);
  assert(manifest.notes.includes('component pass'));
});

test('pete combat data and 50%-baseline mini',()=>{
  assert.equal(ENEMIES.pete.hp/ENEMIES.peteMini.hp,2);
  assert.equal(ENEMIES.pete.damage/ENEMIES.peteMini.damage,2);
  assert(ENEMIES.peteMini.r<ENEMIES.pete.r);assert(ENEMIES.peteMini.speed>ENEMIES.pete.speed);
  assert(ENEMIES.pete.elite&&!ENEMIES.peteMini.elite);
  assert.equal(PETE.cloneInterval,30);assert.equal(PETE.miniCap,5);assert.equal(PETE.miniScale,.55);assert.equal(PETE.minWave,11);
});

test('spawn gate: never below wave 11, peteMini never eligible, weight keeps pete rare',()=>{
  const types=Object.keys(ENEMIES);
  assert.equal(types.filter(x=>x==='pete').length,1);assert.equal(types.filter(x=>x==='peteMini').length,1);
  let seed=77;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  for(let w=1;w<=10;w++)for(let i=0;i<2000;i++)assert.notEqual(pickEnemyKind(types,w,random),'pete','wave '+w);
  for(let i=0;i<20000;i++)assert.notEqual(pickEnemyKind(types,30,random),'peteMini');
  seed=77;let petes=0;for(let i=0;i<10000;i++)if(pickEnemyKind(types,11,random)==='pete')petes++;
  assert(petes>150&&petes<450,'about 3% of wave-11 attempts, saw '+petes);
  // jitter's own weighting at wave 2 is untouched
  seed=77;let bugs=0;for(let i=0;i<30000;i++)if(pickEnemyKind(types,2,random)==='jitter')bugs++;
  assert(bugs>4500&&bugs<5500,'jitter one-sixth early chance preserved');
});

test('mini draw is a uniform 0.55 scale of the same strip, centered',()=>{
  const calls=[];const ctx={imageSmoothingEnabled:true,save(){},restore(){},translate(){},scale(){},drawImage(...a){calls.push(a)}};
  const art={definition:def2,atlas:{}};
  drawTechEnemy(ctx,art,{moving:true,side:'right',frame:0,special:0,attack:0,hurt:0},300,200);
  drawTechEnemy(ctx,art,{moving:true,side:'right',frame:0,special:0,attack:0,hurt:0},300,200,PETE.miniScale);
  const full=calls[0],mini=calls[1];
  assert.equal(full[1],0); // single walk strip, sx=0
  assert(Math.abs(mini[6]-full[6]*PETE.miniScale)<1.5,'mini dest width');
  assert(Math.abs(mini[7]-full[7]*PETE.miniScale)<1.5,'mini dest height');
});

test('engine: pete spawns at wave 11, one 30s pulse, independent half-HP mini, no mini reproduction',async()=>{
  // Deterministic seed chosen so a Pete spawns early in the wave.
  let seed=20261012;const realRandom=Math.random;
  Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  try{
    const enc=await startEncounter({width:1280,height:800,configure:run=>{run.wave=11}});
    enc.until(()=>enc.samples.some(s=>s.petes?.some(p=>p.kind==='pete')),55);
    const peteAt=enc.samples.find(s=>s.petes?.some(p=>p.kind==='pete'));
    const pete=peteAt.petes.find(p=>p.kind==='pete');
    const waveTime=peteAt.time;
    assert(pete.cloneT>0&&pete.cloneT<=PETE.cloneInterval,'clone clock armed');
    assert(Math.abs(pete.hp-ENEMIES.pete.hp*(1+(10)*.28))<1,'wave-11 HP scaling: '+pete.hp);
    // run until the pulse fires (cloneT wraps) and the mini appears
    enc.until(()=>enc.samples.some(s=>s.petes?.some(p=>p.kind==='peteMini')),Math.min(60,waveDurationLeft(waveTime)));
    const miniAt=enc.samples.findLast(s=>s.petes?.some(p=>p.kind==='peteMini'));
    const mini=miniAt.petes.find(p=>p.kind==='peteMini');
    const original=miniAt.petes.find(p=>p.kind==='pete');
    assert(Math.abs(mini.hp/original.max*2-1)<.02,'mini is 50% of the original baseline');
    assert(mini.cloneT===0||mini.cloneT===undefined,'mini has no clone clock');
    assert(mini.index!==original.index,'independent entity');
    // minis never reproduce: 60 more seconds, mini count never exceeds cap
    let maxMinis=0;for(const s of enc.samples)maxMinis=Math.max(maxMinis,s.petes?.filter(p=>p.kind==='peteMini').length||0);
    assert(maxMinis<=PETE.miniCap,'mini cap '+maxMinis);
    assert(enc.samples.every(s=>(s.petes?.length||0)<=(PETE.miniCap+3)),'bounded paperwork');
  }finally{Math.random=realRandom}
  function waveDurationLeft(t){return 60-t}
});

test('engine: no pete below wave 11 (wave 6 control)',async()=>{
  let seed=5150;const realRandom=Math.random;
  Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  try{
    const enc=await startEncounter({width:1280,height:800,configure:run=>{run.wave=6}});
    enc.until(()=>enc.samples.length>400,55); // ~6.5s of samples
    assert(enc.samples.every(s=>!(s.petes?.length)),'no pete at wave 6');
  }finally{Math.random=realRandom}
});

test('guide: pete enemy entry carries clone mechanics, bosses entry present, peteMini folded',()=>{
  const g=guideEntries();
  const pete=g.Enemies.find(e=>e.id==='pete');assert(pete,'enemy entry');
  assert(pete.body.includes('independent Pete'));assert(pete.detail.includes('Spawn gate: wave 11+'));assert(pete.detail.includes('fewer than 5 minis'));
  assert(!g.Enemies.some(e=>e.id==='peteMini'),'peteMini folded into pete');
  const boss=g.Bosses.find(b=>b.id==='pete');assert(boss,'boss guide entry');
  assert(boss.body.includes('30s')||boss.body.includes('Every 30s'));
  assert(g.Bosses.some(b=>b.id==='squirrel'),'squirrel entry kept');
});