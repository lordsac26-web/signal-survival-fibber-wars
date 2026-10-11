import test from 'node:test';
import assert from 'node:assert/strict';
import {startEncounter,pump,rafMap} from './engineHarness.mjs';
import {knowledgeDumpFrame,knowledgeDumpPhase} from '@/game/combat/knowledgeDump';
const frames=seconds=>pump(seconds);
const same=(p,d)=>p.poolIndex===d.index&&p.x===d.x&&p.y===d.y;
const safe=run=>Object.assign(run,{weapons:[],armor:0,dodge:0,regen:0,crit:0,signalStrength:0,cleanliness:0,instakill:0});
async function fixedRandom(value,fn){const original=Math.random;Math.random=()=>value;try{await fn()}finally{Math.random=original}}
for(const [width,height] of [[375,667],[1280,800]]){
 test(`Pudding engine ${width}×${height}: actual cast/drop, +1/+4/+5s, world lock, contact/exit, pause`,()=>fixedRandom(.3,async()=>{
  const clearTool={id:'clear-test',damage:0,range:1000,rangeProfile:'trace',pattern:'pierce',rate:.1,speed:1000,color:'#ffffff'};
  const h=await startEncounter({width,height,configure:r=>{safe(r);r.weapons=[clearTool]}});
  try{
   h.until(()=>h.events.some(e=>e.type==='puddleDrop'));
   const drop=h.events.find(e=>e.type==='puddleDrop'),charge=h.events.find(e=>e.type==='puddingCharge'&&e.dropX===drop.x&&e.dropY===drop.y);
   assert(charge);assert(Math.abs(drop.time-charge.time-1)<1e-7);assert.equal(drop.life,5);
   assert.equal(h.arts[6].puddleCellW,undefined,'old loaded-wrapper field is absent: old source rectangle was invalid');
   assert.deepEqual([h.arts[6].groundPuddle.naturalWidth,h.arts[6].groundPuddle.naturalHeight],[216,76]);
   const poseDraw=()=>h.rec.record.findLast(r=>r[0]==='drawImage'&&r[1].src?.endsWith('/puddle-final.png'));
   let draw=poseDraw();assert(draw);assert(draw.slice(2).every(Number.isFinite));assert.equal(draw.meta.alpha,.95);
   const checkpoints=[{at:0,life:5,x:drop.x,y:drop.y,draw:[...draw.slice(2)]}];
   h.until(()=>h.state.time>=drop.time+1-1e-8);
   let hazard=h.state.puddles.find(p=>same(p,drop));assert(hazard);assert(Math.abs(hazard.life-4)<1e-7);
   const parent=h.state.puddings.find(e=>e.index===charge.index);assert(parent);assert(Math.hypot(parent.x-charge.x,parent.y-charge.y)>5,'creature moved away from saved drop');
   checkpoints.push({at:1,life:hazard.life,x:hazard.x,y:hazard.y,alpha:.95,parentMoved:true});
   const held={...hazard};h.paused.current=true;frames(3);assert.deepEqual(h.state.puddles.find(p=>same(p,drop)),held);h.paused.current=false;
   // Kill the parent with the real projectile path, then deliberately step onto
   // its goo: stationary play cannot prove contact (desktop drops can be far away).
   clearTool.damage=1e6;
   h.until(()=>!h.state.puddings.some(e=>e.index===charge.index&&e.cast.dropX===drop.x&&e.cast.dropY===drop.y),1.5);
   frames(.6); // let existing contact grace expire, no changes to production defense
   h.until(()=>{const dx=drop.x-h.state.player.x,dy=drop.y-h.state.player.y;if(Math.hypot(dx,dy)<8){h.input.current.x=0;h.input.current.y=0;return true}h.input.current.x=dx;h.input.current.y=dy;return false},1.5);
   frames(.6);assert.equal(h.state.slow,.65);assert(h.events.some(e=>e.type==='puddleTick'&&Math.abs(e.damage-10)<1e-7));
   for(const at of [4]){
    h.until(()=>h.state.time>=drop.time+at-1e-8);hazard=h.state.puddles.find(p=>same(p,drop));assert(hazard);assert(Math.abs(hazard.life-(5-at))<1e-7);
    draw=h.rec.record.findLast(r=>r[0]==='drawImage'&&r[1].src?.endsWith('/puddle-final.png')&&r[6]===Math.round(drop.x-216*.38/2)&&r[7]===Math.round(drop.y-76*.38/2));
    assert(draw);assert.equal(draw.meta.alpha,.95);assert(draw.slice(2).every(Number.isFinite));
    checkpoints.push({at,life:hazard.life,x:hazard.x,y:hazard.y,alpha:draw.meta.alpha});
   }
   h.until(()=>h.state.time>=drop.time+5-1e-8);assert(!h.state.puddles.some(p=>same(p,drop)),'expired precisely at five simulation seconds');
   assert(h.samples.some(s=>s.slow===.65),'actual contact slows player by 35%');assert(h.events.some(e=>e.type==='puddleTick'&&Math.abs(e.damage-10)<1e-7),'actual shared tick dealt 10 base damage');
   h.input.current.x=-1;frames(2);assert.equal(h.state.slow,1,'exit restores modifier');
   h.until(()=>h.state.puddles.length===0,2);const ticks=h.events.filter(e=>e.type==='puddleTick').length;frames(.6);assert.equal(h.events.filter(e=>e.type==='puddleTick').length,ticks,'no damage after all hazards expired');assert.equal(h.state.slow,1);
   checkpoints.push({at:5,removed:true});console.log('AUTOMATED_PUDDLE_STATE_EVIDENCE',JSON.stringify({width,height,chargeAt:charge.time,dropAt:drop.time,checkpoints,contact:{damage:10,slow:.65,exitSlow:h.state.slow,postExpiryTicks:0},texture:[216,76],note:'Canvas commands validated, not browser-rasterized visual proof'}));
  }finally{h.cleanup()}
 }));
 test(`Veteran engine ${width}×${height}: exactly one burst at 2.5s, middle impact, coverage through charge, recovery/reset`,()=>fixedRandom(.3,async()=>{
  const tool={id:'timing-test',damage:0,range:0,pattern:'projectile',rate:999,color:'#ffffff'};
  const h=await startEncounter({width,height,charId:'veteran',configure:r=>{safe(r);r.weapons=[tool];r.damage=1;r.spliceQuality=0}});
  try{
   frames(10);h.input.current.special=true;frames(1/60);const activated=h.state.time;assert.equal(h.state.specialTimer,3);
   tool.damage=10;
   h.until(()=>h.events.some(e=>e.type==='knowledgeImpact'),3);
   const impact=h.events.find(e=>e.type==='knowledgeImpact');assert(Math.abs(impact.time-activated-2.5)<1e-7);assert.equal(h.events.filter(e=>e.type==='knowledgeImpact').length,1);
   assert.equal(knowledgeDumpFrame(h.state.specialTimer),3);assert.equal(knowledgeDumpPhase(h.state.specialTimer),'impact');
   const draw=h.rec.record.findLast(r=>r[0]==='drawImage'&&r[1].src?.endsWith('/knowledge-dump.png'));assert.equal(draw[2],3*277);
   assert(Math.abs(h.state.damageDealt-300)<1e-6,`actual split burst total ${h.state.damageDealt}`);
   const chargeSamples=h.samples.filter(s=>s.time>=activated&&s.time<impact.time-1e-8);assert(chargeSamples.every(s=>!s.clauseFired));
   assert(h.rec.record.some(r=>r[0]==='setLineDash'&&r[1][0]===12),'coverage ring drew during windup');
   frames(.2);assert.equal(knowledgeDumpPhase(h.state.specialTimer),'recovery');
   frames(.5);assert.equal(h.state.specialTimer,0);assert.equal(h.events.filter(e=>e.type==='knowledgeImpact').length,1);assert(Math.abs(h.state.damageDealt-300)<1e-6);
   console.log('AUTOMATED_VETERAN_TIMELINE',JSON.stringify({width,height,activated,impact:impact.time,charge:impact.time-activated,impactCell:3,totalDamage:300,recovery:.5,bursts:1}));
  }finally{h.cleanup()}
  const reset=await startEncounter({width,height,charId:'veteran',configure:safe});reset.input.current.special=true;frames(1/60);frames(1);reset.cleanup();assert.equal(rafMap.size,0);assert(!reset.events.some(e=>e.type==='knowledgeImpact'),'interrupt before impact cancels pending burst');
  const fresh=await startEncounter({width,height,charId:'veteran',configure:safe});try{frames(3);assert.equal(fresh.state.specialTimer,0);assert(!fresh.events.some(e=>e.type==='knowledgeImpact'))}finally{fresh.cleanup()}
 }));
}
test('Pudding parent death cancels pre-drop cast but leaves a completed independent hazard; reset clears it',()=>fixedRandom(.3,async()=>{
 const tool={id:'death-test',damage:0,range:1000,rangeProfile:'trace',pattern:'pierce',rate:.1,speed:1000,color:'#ffffff'};
 const setup=r=>{safe(r);r.weapons=[tool]};
 const pre=await startEncounter({width:375,height:667,configure:setup});try{pre.until(()=>pre.events.some(e=>e.type==='puddingCharge'));tool.damage=1e6;frames(1);assert(!pre.events.some(e=>e.type==='puddleDrop'),'death during charge produced no hazard')}finally{pre.cleanup()}
 tool.damage=0;const post=await startEncounter({width:375,height:667,configure:setup});let drop;
 try{post.until(()=>post.events.some(e=>e.type==='puddleDrop'));drop=post.events.find(e=>e.type==='puddleDrop');tool.damage=1e6;frames(1);assert(!post.state.puddings.some(e=>e.cast.dropX===drop.x&&e.cast.dropY===drop.y),'original parent was killed, new pooled enemies may exist');assert(post.state.puddles.some(p=>same(p,drop)),'hazard survived parent death')}finally{post.cleanup()}
 const fresh=await startEncounter({width:375,height:667,configure:safe});try{frames(1/60);assert.equal(fresh.state.puddles.length,0)}finally{fresh.cleanup()}
}));