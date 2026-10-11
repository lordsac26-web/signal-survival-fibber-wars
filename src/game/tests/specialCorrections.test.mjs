import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePng} from './pngDecode.mjs';
import {CHARACTER_SPRITES,ENEMY_SPRITES} from '@/game/art/characterSprites';
import {drawGroundPuddle,puddingFootPoint} from '@/game/art/groundPuddle';
import {KNOWLEDGE_DUMP,knowledgeDumpFrame,knowledgeDumpPhase} from '@/game/combat/knowledgeDump';
import {techFrame,createTechAnimation} from '@/game/art/techSpriteAnimation';
import {drawJitterSprite} from '@/game/art/jitterSpriteAnimation';
import {JITTER,createJitterState,jitterPulseHits} from '@/game/combat/jitter';
import def from '@/game/art/jitterSpriteDefinition';
const bytes=p=>readFileSync(new URL('../../../public'+p,import.meta.url));
test('final row-five flattened goo is nonempty RGBA, byte-identical to last source-derived pose',()=>{
 const a=decodePng(bytes('/assets/pudding/puddle.png')),b=decodePng(bytes('/assets/pudding/puddle-final.png'));
 assert.deepEqual([b.width,b.height],[216,76]);let count=0,transparent=0;
 for(let y=0;y<76;y++)for(let x=0;x<216;x++){
  const i=(y*216+x)*4,j=(y*432+x+216)*4;assert.deepEqual(b.rgba.subarray(i,i+4),a.rgba.subarray(j,j+4));
  if(b.rgba[i+3]>200)count++;if(!b.rgba[i+3])transparent++;
 }
 assert(count>8000&&transparent>7000);assert.equal(ENEMY_SPRITES.packet.extras.find(e=>e[0]==='groundPuddle')[1],'/assets/pudding/puddle-final.png');
});
test('real loaded-wrapper ground draw has finite dimensions, readable alpha and constant WORLD footprint',()=>{
 const art={definition:ENEMY_SPRITES.packet,groundPuddle:{naturalWidth:216,naturalHeight:76}};
 const calls=[];const ctx={globalAlpha:1,imageSmoothingEnabled:true,save(){},restore(){},drawImage(...args){calls.push({args,alpha:this.globalAlpha})}};
 const at=puddingFootPoint(art,200,300);assert(Math.abs(at.y-326.7452830188679)<1e-8);
 for(const life of [5,4,1,.5])drawGroundPuddle(ctx,art,{...at,life});
 for(const c of calls){assert(c.args.slice(1).every(Number.isFinite));assert.deepEqual(c.args.slice(1,5),[0,0,216,76]);assert.deepEqual(c.args.slice(5),calls[0].args.slice(5))}
 assert.equal(calls[0].alpha,.95);assert.equal(calls[2].alpha,.95);assert.equal(calls[3].alpha,.475);
 const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');assert(!engine.includes('pudArtDef.puddleScale'));
 assert(engine.indexOf('drawGroundPuddle(ctx,puddingArt,d)')<engine.indexOf('// structures (under enemies)'));
});
test('Veteran explicit timeline: only pre-impact poses until EXACT 2.5s; middle impact at event; recovery after .12s',()=>{
 assert.deepEqual(KNOWLEDGE_DUMP.chargeFrames,[0,1,2]);assert.equal(KNOWLEDGE_DUMP.impactFrame,3);
 for(let i=0;i<150;i++){const remaining=3-i/60;assert.equal(knowledgeDumpPhase(remaining),'charge');assert(knowledgeDumpFrame(remaining)<3)}
 assert.equal(knowledgeDumpPhase(.5),'impact');assert.equal(knowledgeDumpFrame(.5),3);
 assert.equal(knowledgeDumpPhase(.38),'recovery');assert.equal(knowledgeDumpFrame(.38),4);assert.equal(knowledgeDumpFrame(.01),6);
 const art={definition:CHARACTER_SPRITES.veteran,special:{}},s=createTechAnimation();s.vfxClock=100;s.special=.5;
 assert.equal(techFrame(art,s).sx,3*277,'render clock cannot postpone or advance damage frame');
 s.special=3;assert.equal(techFrame(art,s).sx,0,'reactivation starts charge');s.special=0;assert.notEqual(techFrame(art,s).image,art.special,'interrupt clears special pose');
});
test('Veteran corrected impact excludes adjacent technician; movement and aiming assets untouched',()=>{
 const p=decodePng(bytes('/assets/veteran/knowledge-dump.png'));assert.deepEqual([p.width,p.height],[1939,119]);
 for(let y=0;y<119;y++)for(let x=0;x<38;x++)assert.equal(p.rgba[(y*1939+3*277+x)*4+3],0,'left-neighbor charge figure removed');
 let gold=0;for(let y=0;y<119;y++)for(let x=38;x<233;x++){const i=(y*1939+831+x)*4;if(p.rgba[i+3]&&p.rgba[i]>180&&p.rgba[i+1]>100&&p.rgba[i+2]<160)gold++}
 assert(gold>1000,'actual golden explosion retained');
 const d=CHARACTER_SPRITES.veteran;assert(d.extras.find(e=>e[0]==='walk')[1].endsWith('/walk-side.png'));assert(d.extras.find(e=>e[0]==='attack')[1].endsWith('/attack.png'));
});
test('Jitter +20% linear radius drives warning, burst and hit boundary; body, trigger, cooldown stay unchanged',()=>{
 assert.equal(JITTER.radius,76*1.2);assert.equal(JITTER.activationRange,130);assert.equal(JITTER.telegraph,1);assert.equal(JITTER.cooldown,12);assert.equal(def.worldSize,64);
 const s=createJitterState(()=>0),arcs=[];const ctx={imageSmoothingEnabled:true,save(){},restore(){},translate(){},scale(){},drawImage(){},beginPath(){},stroke(){},fill(){},arc(x,y,r){arcs.push(r)}};
 for(const phase of ['charge','recover']){s.phase=phase;s.remaining=phase==='charge'?1:.45;drawJitterSprite(ctx,{definition:def,atlas:{}},s,200,200,false)}
 assert.deepEqual(arcs,[JITTER.radius,JITTER.radius]);assert(jitterPulseHits(s,JITTER.radius-.001,0));assert(!jitterPulseHits(s,JITTER.radius+.001,0));
});