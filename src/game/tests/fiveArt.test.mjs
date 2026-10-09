import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodePng } from './pngDecode.mjs';
import { characterSprite, enemySpriteDef } from '@/game/art/characterSprites.js';
import { createTechAnimation, updateTechAnimation, techFrame, drawTechSprite, drawTechEnemy } from '@/game/art/techSpriteAnimation.js';

// Measured atlas dimensions from the image processing pipeline.
const EXPECTED={
  veteran:{idle:{w:675,h:120,cols:9},walk:{w:544,h:113,cols:8},walkLeft:{w:544,h:113,cols:8},attack:{w:792,h:124,cols:6},special:{w:1939,h:119,cols:7},portrait:{w:78,h:132}},
  clone:{idle:{w:648,h:112,cols:9},walk:{w:504,h:114,cols:8},walkLeft:{w:520,h:115,cols:8},attack:{w:720,h:112,cols:6},special:{w:1448,h:114,cols:8},portrait:{w:74,h:124}},
  don:{idle:{w:792,h:124,cols:9},walk:{w:608,h:122,cols:8},walkLeft:{w:616,h:120,cols:8},attack:{w:888,h:114,cols:8},special:{w:1912,h:117,cols:8},portrait:{w:94,h:136}},
  nomad:{idle:{w:675,h:128,cols:9},walk:{w:738,h:136,cols:9},walkLeft:{w:684,h:136,cols:9},attack:{w:1496,h:136,cols:11},special:{w:1560,h:123,cols:10},portrait:{w:76,h:140}},
  blob:{idle:{w:910,h:92,cols:10},walk:{w:792,h:82,cols:9},walkLeft:{w:747,h:81,cols:9},attack:{w:1251,h:86,cols:9},special:{w:1932,h:115,cols:7},portrait:{w:90,h:98}}
};

test('every new atlas exists at the exact measured dimensions with transparent background',async()=>{
  for(const [charId,rows] of Object.entries(EXPECTED)){
    for(const [rowName,exp] of Object.entries(rows)){
      if(rowName==='portrait'){
        const bytes=await readFile(new URL(`../../../public/assets/${charId}/portrait.png`,import.meta.url));
        const d=decodePng(bytes);
        assert.equal(d.width,exp.w,`${charId} portrait width`);
        assert.equal(d.height,exp.h,`${charId} portrait height`);
        let opaque=0;for(let i=3;i<d.rgba.length;i+=4)if(d.rgba[i])opaque++;
        assert.ok(opaque>exp.w*exp.h*.05,`${charId} portrait should have content`);
        continue;
      }
      const bytes=await readFile(new URL(`../../../public/assets/${charId}/${rowName==='idle'?'idle-front':rowName}.png`,import.meta.url));
      const d=decodePng(bytes);
      assert.equal(d.width,exp.w,`${charId} ${rowName} atlas width`);
      assert.equal(d.height,exp.h,`${charId} ${rowName} atlas height`);
      // Background must be keyed transparent (corner pixels alpha=0)
      assert.equal(d.rgba[3],0,`${charId} ${rowName} top-left must be transparent`);
      let opaque=0;for(let i=3;i<d.rgba.length;i+=4)if(d.rgba[i])opaque++;
      assert.ok(opaque>exp.w*exp.h*.03,`${charId} ${rowName} should have sprite content`);
    }
  }
});

test('every new manifest validates against its sprite definition manifestSpec',async()=>{
  for(const charId of ['veteran','clone','don','nomad']){
    const def=characterSprite(charId);
    assert.ok(def,`${charId} sprite definition must exist`);
    const manifest=JSON.parse(await readFile(new URL(`../../../public/assets/${charId}/animation.json`,import.meta.url),'utf8'));
    for(const [key,expected] of Object.entries(def.manifestSpec)){
      const actual=key.split('.').reduce((o,p)=>o?.[p],manifest);
      assert.equal(actual,expected,`${charId} manifest key ${key}: expected ${expected}, got ${actual}`);
    }
  }
  // Blob enemy
  const blobDef=enemySpriteDef('dirty');
  assert.ok(blobDef,'dirty (blob) enemy sprite definition must exist');
  const blobManifest=JSON.parse(await readFile(new URL('../../../public/assets/blob/animation.json',import.meta.url),'utf8'));
  for(const [key,expected] of Object.entries(blobDef.manifestSpec)){
    const actual=key.split('.').reduce((o,p)=>o?.[p],blobManifest);
    assert.equal(actual,expected,`blob manifest key ${key}: expected ${expected}, got ${actual}`);
  }
});

test('techSpriteAnimation: idle, walk, walk-left, attack, and special frame selection',()=>{
  for(const charId of ['veteran','clone','don','nomad']){
    const def=characterSprite(charId);
    const art={definition:def,atlas:'idle',walk:'walk',walkLeft:'walkLeft',attack:'attack',special:'special',hurt:null};
    const s=createTechAnimation();
    // Idle: first frame
    const idleFrame=techFrame(art,s);
    assert.equal(idleFrame.image,'idle');
    assert.equal(idleFrame.sx,0);
    // Walk left: true left art, unmirrored
    s.moving=true;s.side='left';s.frame=0;
    const leftFrame=techFrame(art,s);
    assert.equal(leftFrame.image,'walkLeft');
    assert.equal(leftFrame.mirror,false);
    // Walk right: right-facing walk, unmirrored
    s.side='right';
    const rightFrame=techFrame(art,s);
    assert.equal(rightFrame.image,'walk');
    assert.equal(rightFrame.mirror,false);
    // Attack: plays attack frames
    s.moving=false;s.attack=.4;s.special=0;
    const attackFrame=techFrame(art,s);
    assert.equal(attackFrame.image,'attack');
    // Special: plays special frames
    s.attack=0;s.special=1;s.vfxClock=0;
    const specialFrame=techFrame(art,s);
    assert.equal(specialFrame.image,'special');
    assert.equal(specialFrame.sx,0);
    // Special advances through frames
    s.vfxClock=1;
    const specialFrame1=techFrame(art,s);
    assert.equal(specialFrame1.image,'special');
  }
});

test('techSpriteAnimation: blob enemy uses same module with centered draw',()=>{
  const def=enemySpriteDef('dirty');
  assert.ok(def);
  const art={definition:def,atlas:'idle',walk:'walk',walkLeft:'walkLeft',attack:'attack',special:'special',hurt:null};
  const s=createTechAnimation();
  s.special=.5; // spawn flash
  const f=techFrame(art,s);
  assert.equal(f.image,'special');
  // After special expires, falls back to idle
  s.special=0;
  const idleFrame=techFrame(art,s);
  assert.equal(idleFrame.image,'idle');
});

test('techSpriteAnimation: update decrements hurt and attack, increments clock',()=>{
  const def=characterSprite('veteran');
  const s=createTechAnimation();
  s.hurt=.5;s.attack=.5;
  updateTechAnimation(s,0,0,.1,def);
  assert.ok(s.hurt<.5);
  assert.ok(s.attack<.5);
  assert.ok(s.vfxClock>0);
  // Moving sets side and frame
  updateTechAnimation(s,1,0,.1,def);
  assert.equal(s.side,'right');
  assert.ok(s.moving);
  // Moving left sets left side
  updateTechAnimation(s,-1,0,.1,def);
  assert.equal(s.side,'left');
});

test('engine wiring: techSpriteAnimation imported and used for all tech characters',async()=>{
  const engine=await readFile(new URL('../../game/signalEngine.js',import.meta.url),'utf8');
  assert.ok(engine.includes('createTechAnimation')&&engine.includes('updateTechAnimation')&&engine.includes('drawTechSprite')&&engine.includes('drawTechEnemy'),'engine must import tech sprite functions');
  assert.ok(engine.includes("['veteran','clone','don','nomad']"),'engine must have techChars list');
  assert.ok(engine.includes("e.kind==='dirty'&&blobArtDef"),'engine must create blob animation for dirty enemies');
  assert.ok(engine.includes("special.id==='sprint'?'chug'"),'engine must play chug sound for Nomad special');
  assert.ok(engine.includes("special.id==='clause'?'charge'"),'engine must play charge sound for Veteran special');
  assert.ok(engine.includes("special.id==='cash'"),'engine must have Cash Money VFX');
  assert.ok(engine.includes("special.id==='sprint'")&&engine.includes('22d3ee'),'engine must have cyan aura for Nomad');
  assert.ok(engine.includes("special.id==='clause'")&&engine.includes('fbbf24'),'engine must have golden glow for Veteran');
});

test('audio engine has new sound cues',async()=>{
  const audio=await readFile(new URL('../../game/audio.js',import.meta.url),'utf8');
  assert.ok(audio.includes('chug:'),'audio must have chug sound');
  assert.ok(audio.includes('charge:'),'audio must have charge sound');
  assert.ok(audio.includes('burst:'),'audio must have burst sound');
});

test('signatures: Veteran returns 3s charge-up, Nomad heals 40 HP',async()=>{
  const sig=await readFile(new URL('../../game/combat/signatures.js',import.meta.url),'utf8');
  assert.ok(sig.includes("case 'clause':return 3"),"Veteran special must return 3s duration");
  assert.ok(sig.includes("case 'sprint':api.heal(40)"),'Nomad special must heal 40 HP');
});