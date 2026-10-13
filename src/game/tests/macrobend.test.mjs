import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MACRO,createBendState,stepBend,bendVelocity } from '@/game/combat/macrobend';
import { createBendAnimation,updateBendAnimation,bendFrame,drawBendSprite } from '@/game/art/bendSpriteAnimation';
import { enemySpriteDef } from '@/game/art/characterSprites';
import { ENEMIES } from '@/game/data/combat';
import { pickEnemyKind } from '@/game/combat/jitter';
import { guideEntries } from '@/game/data/reference';
import { decodePng } from './pngDecode.mjs';
const def=enemySpriteDef('bend');
const file=p=>readFileSync(new URL('../../../public'+p,import.meta.url));
const near={dist:75,visible:true,targetDx:20};

test('actual Beast strips decode at exact sizes; no magenta remnants, manifest verified',()=>{
 const strips={idle:[def.atlas,672,137],walk:[def.extras[0][1],895,134],attack:[def.extras[1][1],868,138],special:[def.extras[2][1],920,128],ring:[def.extras[3][1],116,92]};
 for(const [k,[path,w,h]] of Object.entries(strips)){
  const p=decodePng(file(path));assert.equal(p.width,w,k);assert.equal(p.height,h,k);
  let opaque=0,pink=0;
  for(let i=0;i<p.rgba.length;i+=4){if(p.rgba[i+3]>=200){opaque++;const r=p.rgba[i],g=p.rgba[i+1],b=p.rgba[i+2];if(r>150&&g<60&&r-g>100&&r>b)pink++}}
  assert(opaque>1000,k+' body pixels kept');assert.equal(pink,0,k+' magenta background remnants');
 }
 const portrait=decodePng(file(def.portrait));assert.equal(portrait.width,320);assert.equal(portrait.height,252);
 const manifest=JSON.parse(file(def.manifest));
 for(const [key,expected] of Object.entries(def.manifestSpec)){const actual=key.split('.').reduce((o,p2)=>o?.[p2],manifest);assert.equal(actual,expected,key)}
});

test('stat contract: 1.6× Jitter HP, 1.15× contact, 0.85× speed; cast numbers literal',()=>{
 assert(Math.abs(ENEMIES.bend.hp-ENEMIES.jitter.hp*1.6)<1e-9);
 assert(Math.abs(ENEMIES.bend.damage-ENEMIES.jitter.damage*1.15)<1e-9);
 assert(Math.abs(ENEMIES.bend.speed-ENEMIES.jitter.speed*.85)<1e-9);
 assert.equal(ENEMIES.bend.r,25);assert.equal(MACRO.telegraph,1);assert.equal(MACRO.recovery,.4);assert.equal(MACRO.cooldown,12);
 assert.equal(MACRO.wave,4);assert.equal(MACRO.spawnWeight,.5);
});

test('exact one-second coil, ONE ring at release, 12s cooldown from fire, 0.4s recovery',()=>{
 assert.equal(createBendState(()=>0).cooldown,8);assert.equal(createBendState(()=>1).cooldown,12);
 const s=createBendState(()=>0);s.cooldown=0;
 assert.equal(stepBend(s,0,near),'coil');assert.equal(s.remaining,1);
 for(let i=0;i<59;i++)assert.equal(stepBend(s,1/60,near),null);
 assert.equal(s.phase,'coil');assert.equal(stepBend(s,1/60,near),'fire');
 assert.equal(s.cooldown,12);assert.equal(s.phase,'recover');assert.equal(s.remaining,.4);
 for(let i=0;i<23;i++)stepBend(s,1/60,near);assert.equal(s.phase,'recover');
 assert.equal(stepBend(s,1/60,near),null);assert.equal(s.phase,'chase');
 let fires=0;for(let i=0;i<719;i++)if(stepBend(s,1/60,near)==='fire')fires++;
 assert.equal(fires,1);assert.equal(s.phase,'chase');assert(s.cooldown>0&&s.cooldown<=12);
});

test('guards: offscreen/far/dead-player never coil; killing mid-coil cancels the ring',()=>{
 for(const opts of [{...near,visible:false},{...near,dist:MACRO.activationRange+.001},{...near,playerAlive:false}]){
  const s=createBendState(()=>0);s.cooldown=0;assert.equal(stepBend(s,0,opts),null);assert.equal(s.phase,'chase');
 }
 const s=createBendState(()=>0);s.cooldown=0;stepBend(s,0,near);
 assert.equal(stepBend(s,.5,{...near,alive:false}),null);assert.equal(s.phase,'dead');
 assert.equal(stepBend(s,20,near),null);assert.equal(s.phase,'dead','no fire after death');
});

test('chase-only movement: rooted through coil and recovery, straight chase vector',()=>{
 const s=createBendState(()=>0);
 const v=bendVelocity(s,0,78.2);assert(v.x>70&&Math.abs(v.y)<1e-9);
 for(const phase of ['coil','recover','dead']){s.phase=phase;assert.deepEqual(bendVelocity(s,0,78.2),{x:0,y:0})}
});

test('animation frames: coil poses 0-2, release 3/4, walk/idle/attack selection, left mirror',()=>{
 const art={definition:def,atlas:{},walk:{},attack:{},special:{}};
 const s=createBendAnimation();
 updateBendAnimation(s,60,0,1/60,null);assert.equal(s.facing,'right');assert.equal(s.moving,true);
 let f=bendFrame(art,s);assert(f.sx>=0&&f.sx<def.walkCellW*def.walkColumns);
 s.phase='coil';s.coilT=0;f=bendFrame(art,s);assert.equal(f.sx,0);assert.equal(f.w,def.specialCellW);
 s.coilT=1;f=bendFrame(art,s);assert.equal(f.sx,2*def.specialCellW);
 s.phase='recover';s.coilT=-1;s.releaseF=3;f=bendFrame(art,s);assert.equal(f.sx,3*def.specialCellW);
 s.releaseF=4;f=bendFrame(art,s);assert.equal(f.sx,4*def.specialCellW);
 s.phase='chase';s.releaseF=-1;s.attack=.35;f=bendFrame(art,s);assert.equal(f.image,art.attack);assert.equal(f.sx,0);
 s.attack=0;f=bendFrame(art,s);assert.equal(f.image,art.atlas);
 const calls=[];const ctx={imageSmoothingEnabled:true,save(){},restore(){},translate(...a){calls.push(['translate',...a])},scale(...a){calls.push(['scale',...a])},drawImage(...a){calls.push(['draw',...a])}};
 s.facing='left';drawBendSprite(ctx,art,s,100,200);
 assert.deepEqual(calls[0],['translate',100,200]);assert.deepEqual(calls[1],['scale',-1,1]);
 const d=calls[2];assert(Number.isFinite(d[6])&&Number.isFinite(d[7])&&d[6]<0&&d[7]<0);
});

test('wave-4 spawn gate with half-weight gate, replacing not adding attempts',()=>{
 const types=Object.keys(ENEMIES);
 let seed=42;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<200;i++)assert.notEqual(pickEnemyKind(types,3,random),'bend');
 let bends4=0,bends6=0;
 for(let i=0;i<20000;i++)if(pickEnemyKind(types,4,random)==='bend')bends4++;
 for(let i=0;i<20000;i++)if(pickEnemyKind(types,6,random)==='bend')bends6++;
 assert(bends4>800&&bends4<3200,'about 10% of wave-4 attempts');
 assert(bends6>800&&bends6<3200,'weight gate holds once the pool includes it');
});

test('guide entries document the cast and the stat contract',()=>{
 const e=guideEntries().Enemies.find(e=>e.id==='bend');
 assert(e.body.includes('coils'));assert(e.body.includes('Cleanliness'));
 assert(e.detail.includes('ONE'));assert(e.detail.includes('35% of the shorter visible side'));
 assert(e.detail.includes('1.6× the Jitter Bug HP'));
});