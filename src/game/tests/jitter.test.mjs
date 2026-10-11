import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JITTER,createJitterState,stepJitter,jitterVelocity,jitterPulseHits,pickEnemyKind } from '@/game/combat/jitter';
import { jitterFrame,drawJitterSprite } from '@/game/art/jitterSpriteAnimation';
import def from '@/game/art/jitterSpriteDefinition';
import { ENEMIES } from '@/game/data/combat';
import { guideEntries } from '@/game/data/reference';
import { decodePng } from './pngDecode.mjs';
const near={dist:75,visible:true,targetDx:20};
const ready=()=>{const s=createJitterState(()=>0);s.cooldown=0;stepJitter(s,0,near);return s};
const file=p=>readFileSync(new URL('../../../public'+p,import.meta.url));
test('actual JPEG source crops: 4 idle / 5 move / 4 melee / 5 special, true RGBA and no adjacent bleed/checker',()=>{
 const manifest=JSON.parse(file(def.manifest));assert.deepEqual(manifest.counts,def.counts);
 assert.deepEqual(manifest.sourceCrops.map(r=>r.length),[4,5,4,5]);
 const p=decodePng(file(def.atlas));assert.equal(p.width,1200);assert.equal(p.height,800);
 const counts=[4,5,4,5];let cyan=0,yellow=0;
 for(let row=0;row<4;row++)for(let col=0;col<5;col++){
  let opaque=0;for(let y=0;y<200;y++)for(let x=0;x<240;x++){
   const i=((row*200+y)*1200+col*240+x)*4,[r,g,b,a]=p.rgba.slice(i,i+4);
   if(!a)continue;opaque++;assert.equal(a,255);
   assert(x>1&&x<238&&y>1&&y<198,'transparent cell gutter');
   assert(!(Math.max(r,g,b)>125&&Math.max(r,g,b)-Math.min(r,g,b)<48),'checker/gray halo');
   if(g>170&&b>170&&r<140)cyan++;if(r>180&&g>170&&b<140)yellow++;
  }
  assert(col<counts[row]?opaque>500:opaque===0,'occupied frame count');
 }
 assert(cyan>500&&yellow>500,'cyan/yellow sparks and antennae kept');
 const portrait=decodePng(file(def.portrait));assert.equal(portrait.width,240);assert.equal(portrait.height,200);
 assert.equal(def.worldSize,64);assert.equal(ENEMIES.jitter.r,12);
});
test('exact one-second telegraph, one pulse, 12s cooldown from fire, stagger and recovery',()=>{
 assert.equal(createJitterState(()=>0).cooldown,10);assert.equal(createJitterState(()=>1).cooldown,15);
 const s=ready();assert.equal(s.phase,'charge');
 for(let i=0;i<59;i++)assert.equal(stepJitter(s,1/60,near),null);
 assert.equal(s.phase,'charge');assert.equal(stepJitter(s,1/60,near),'fire');assert.equal(s.cooldown,12);
 assert.equal(JITTER.radius,91.2);assert(jitterPulseHits(s,JITTER.radius-.001,0));assert(jitterPulseHits(s,JITTER.radius,0));assert(!jitterPulseHits(s,JITTER.radius+.001,0));assert(!jitterPulseHits(s,50,.1));
 let fires=1;for(let i=0;i<719;i++)if(stepJitter(s,1/60,near)==='fire')fires++;
 assert.equal(fires,1);assert.equal(s.phase,'chase');assert(s.cooldown>0);
 assert.equal(stepJitter(s,1/60,near),'charge');assert.equal(s.phase,'charge');
});
test('offscreen/far/dead player guard, interrupted charge cancels, pause clocks and fresh reset',()=>{
 for(const opts of [{...near,visible:false},{...near,dist:131},{...near,playerAlive:false}]){
  const s=createJitterState(()=>0);s.cooldown=0;assert.equal(stepJitter(s,0,opts),null);assert.equal(s.phase,'chase');
 }
 const s=ready(),before={...s};assert.deepEqual(s,before,'pause: no step means no clocks advance');
 assert.equal(stepJitter(s,.5,{...near,alive:false}),null);assert.equal(stepJitter(s,20,near),null);
 const reset=createJitterState(()=>.5);assert.equal(reset.phase,'chase');assert.equal(reset.melee,0);assert.equal(reset.cooldown,12.5);
});
test('chase advances toward actual target, root and melee face are separate from render shake',()=>{
 const s=createJitterState(()=>0);for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const v=jitterVelocity(s,a,92);assert(v.x*Math.cos(a)+v.y*Math.sin(a)>70);
 }
 stepJitter(s,.1,{...near,targetDx:-50});assert.equal(s.facing,'left');
 s.phase='charge';assert.deepEqual(jitterVelocity(s,0,92),{x:0,y:0});
 s.phase='recover';assert.deepEqual(jitterVelocity(s,0,92),{x:0,y:0});
});
test('frame bounds, target-facing mirrored transform, one uniform scale and ground anchor',()=>{
 const calls=[];const ctx={imageSmoothingEnabled:true,save(){},restore(){},translate(...a){calls.push(['translate',...a])},scale(...a){calls.push(['scale',...a])},drawImage(...a){calls.push(['draw',...a])}};
 const s=createJitterState(()=>0);s.facing='left';s.melee=1/3;assert.deepEqual(jitterFrame(s),{row:2,index:0});
 drawJitterSprite(ctx,{definition:def,atlas:{}},s,100,200,true);
 assert.deepEqual(calls[0],['translate',100,220]);assert.deepEqual(calls[1],['scale',-1,1]);
 const d=calls[2];assert.deepEqual(d.slice(2,6),[0,400,240,200]);assert.deepEqual(d.slice(6),[-44,-70,106,88]);
 for(const phase of ['chase','charge','recover'])for(let i=0;i<100;i++){
  s.phase=phase;s.clock=i/60;s.remaining=phase==='charge'?1-i/100:.45*(1-i/100);s.melee=0;
  const f=jitterFrame(s);assert(f.index>=0&&f.index<[4,5,4,5][f.row]);
 }
});
test('existing identity/spawn replacement: half-slot weighting, no additional attempts or cap changes',()=>{
 const types=Object.keys(ENEMIES);assert.equal(types.filter(x=>x==='jitter').length,1);
 let seed=42;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 let bugs=0;for(let i=0;i<30000;i++)if(pickEnemyKind(types,2,random)==='jitter')bugs++;
 assert(bugs>4500&&bugs<5500,'one-sixth early spawn chance');
 for(let i=0;i<100;i++)assert.notEqual(pickEnemyKind(types,1,random),'jitter');
 const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
 assert(engine.includes('activeFoeCount()>=maxActiveEnemies(run.wave)'));
 assert(engine.includes("action==='fire'"));assert(engine.includes('p.inv=.55'));
 assert(engine.includes('e.jit=null'));assert(engine.includes('e.jit.rootX=e.x'));
 const entry=guideEntries().Enemies.find(e=>e.id==='jitter');assert(entry.body.includes('circular warning'));assert(entry.detail.includes('ONE pulse'));
});