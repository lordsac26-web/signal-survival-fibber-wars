import test from 'node:test';
import assert from 'node:assert/strict';
import {APPARITION as A,ROUTER_ATTACK as R,createConeState,stepCone,coneContains,consumeConeHit,cancelHiddenCharge,coneOrigin} from '@/game/combat/coneAttack';
import {bossKind,bossWave} from '@/game/data/bosses';
import {CHARACTERS,characterById} from '@/game/data/characters';
import {freshProfile,completeRun} from '@/game/progression/profileModel';
import {createRun} from '@/game/progression/runRules';
import {startEncounter,pump,rafMap} from './engineHarness.mjs';
const args={x:550,y:400,tx:650,ty:400,shortSide:800,visible:true};
const tick=(s,c,n,a=args)=>{const events=[];for(let k=0;k<n;k++){const e=stepCone(s,c,1/60,a);if(e)events.push(e)}return events};
for(const c of [A,R])test(`${c.id}: exact footprint, rooted warning, release timing, one pulse, no lingering damage`,()=>{
  const s=createConeState(c);s.cooldown=0;s.focusCooldown=Infinity;assert.equal(stepCone(s,c,1/60,args),'windup');assert(!consumeConeHit(s,650,400));const angle=s.angle;tick(s,c,Math.round(c.windup*60)-1,{...args,tx:400});assert.equal(s.phase,'windup');tick(s,c,1,{...args,tx:400});assert.equal(s.phase,'fire');assert.equal(s.angle,angle);
  if(c.id==='rous'){assert.equal(s.released,false);tick(s,c,41);assert.equal(s.released,false);tick(s,c,1);assert(s.released)}else assert(s.released);
  const o=coneOrigin(s),point=(distance,angle=s.angle)=>[o.x+Math.cos(angle)*distance,o.y+Math.sin(angle)*distance];assert(coneContains(s,...point(s.reach)));assert(!coneContains(s,...point(s.reach+.01)));const inside=s.angle+s.half-.001,outside=s.angle+s.half+.001;assert(coneContains(s,...point(100,inside)));assert(!coneContains(s,...point(100,outside)));assert(!coneContains(s,...point(10,s.angle+Math.PI)));
  assert(consumeConeHit(s,650,400));assert(!consumeConeHit(s,650,400));tick(s,c,120);assert(!consumeConeHit(s,650,400));assert(s.cooldown>0);stepCone(s,c,0,{alive:false});assert.equal(s.phase,'dead');
});
test('Focus is 1.5s nondamaging, consumes on only next cone; cooldown11, wider/harder once; camera cancellation safe',()=>{
  const s=createConeState(A);s.focusCooldown=0;s.cooldown=0;assert.equal(stepCone(s,A,1/60,args),'focus');tick(s,A,89);assert.equal(s.phase,'focus');assert(!s.empowered);assert(!consumeConeHit(s,550,400));tick(s,A,1);assert.equal(s.phase,'chase');assert(s.empowered);assert(Math.abs(s.focusCooldown-11)<1e-6);stepCone(s,A,1/60,args);assert.equal(s.phase,'windup');assert(s.poweredShot);assert(!s.empowered);assert.equal(s.half,Math.PI/4);assert.equal(s.damage,33);tick(s,A,300);s.cooldown=0;stepCone(s,A,1/60,args);assert(!s.poweredShot);assert.equal(s.damage,22);
  s.phase='windup';s.x=550;s.y=400;s.poweredShot=true;assert(cancelHiddenCharge(s,{x:600,y:0,width:375,height:667}));assert.equal(s.phase,'chase');assert(s.empowered);assert(!s.released);
});
test('one boss per old gate; Router cannot roll in normal waves or grant the Squirrel career unlock',()=>{
  for(let wave=1;wave<100;wave++){const kind=bossKind(wave);assert.equal(!!kind,bossWave(wave));if(kind)assert.equal(kind,wave%20===10?'rous':'squirrel')}
  assert.equal(bossKind(20),'squirrel');assert.equal(bossKind(30),'rous');assert.equal(bossKind(40),'squirrel');assert(CHARACTERS.some(c=>c.id==='isr'));
  const r=createRun(characterById('oracle'),false,1,'router-unlock');r.wave=30;r.won=true;assert.equal(completeRun(freshProfile(),r).save.squirrelDefeated,false);
});
for(const [width,height] of [[375,500],[1100,800]])test(`Oracle ${width}x${height} wave30: Router boss gate, strips, cone, pause/reset`,async()=>{
  const h=await startEncounter({width,height,configure:r=>{r.wave=30;r.weapons=[];r.dodge=1}});
  try{h.until(()=>h.state?.casters.some(e=>e.kind==='rous'),2);h.until(()=>h.events.some(e=>e.type==='coneRelease'&&e.kind==='rous'),20);assert.equal(h.events.filter(e=>e.type==='bossSpawn'&&e.kind==='rous').length,1);const draws=h.rec.record.filter(r=>r[0]==='drawImage'&&r[1]?.src?.includes('/rous/'));assert(draws.length>100);for(const key of ['windup','fire'])assert(draws.some(r=>r[1].src.endsWith(key+'.png')));for(const sample of h.samples)for(const e of sample.casters.filter(e=>e.kind==='rous'))assert(e.x>=sample.camX+59&&e.x<=sample.camX+width-59&&e.y>=sample.camY+99&&e.y<=sample.camY+height-15);assert(h.huds.some(h=>h.boss?.name.startsWith('R.O.U.S.')));const frozen=h.samples.length;h.paused.current=true;pump(2);assert.equal(h.samples.length,frozen);h.cleanup();assert.equal(rafMap.size,0)}finally{h.cleanup()}
});
for(const [width,height] of [[375,500],[1100,800]])test(`Oracle ${width}x${height} normal wave8: elite identity spawns, cone releases, max one`,async()=>{
  const old=Math.random;let calls=0;Math.random=()=>calls++%2?.01:.99;
  const h=await startEncounter({width,height,configure:r=>{r.wave=8;r.weapons=[];r.dodge=1}});
  try{
    h.until(()=>h.state?.casters.some(e=>e.kind==='attenuation'),35);
    h.until(()=>h.events.some(e=>e.type==='coneRelease'&&e.kind==='attenuation'),25);
    assert(h.samples.every(s=>s.casters.filter(e=>e.kind==='attenuation').length<=1));
    assert(h.rec.record.some(r=>r[0]==='drawImage'&&r[1]?.src?.endsWith('/attenuation/attack.png')));
  }finally{h.cleanup();Math.random=old}
});