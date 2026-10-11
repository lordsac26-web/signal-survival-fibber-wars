import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENEMIES } from '@/game/data/combat';
import { ENEMY_SPRITES, enemySpriteDef } from '@/game/art/characterSprites';
import { PUDDING, initPuddingState, stepPuddingState, puddleMitigation, applyPuddleSlow } from '@/game/combat/puddles';
import { createPuddingAnimation, updatePuddingAnimation, puddingFrame } from '@/game/art/puddingSpriteAnimation';
import { guideEntries } from '@/game/data/reference';
import { decodePng } from './pngDecode.mjs';
const pud=ENEMY_SPRITES.packet;
const file=path=>readFileSync(new URL('../../../public'+path,import.meta.url));
const bytesOf=path=>file(path);
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
// strips: atlas/portrait/attack are direct keys; charge/drop/puddle come from extras
const stripPath=key=>key==='atlas'?pud.atlas:key==='portrait'?pud.portrait:key==='attack'?pud.attack:pud.extras.find(e=>e[0]===key)[1];
const stripSize=key=>key==='atlas'?[pud.atlasW,pud.atlasH]:key==='portrait'?[pud.portraitW,pud.portraitH]:key==='attack'?[pud.attackW,pud.attackH]:[pud.extras.find(e=>e[0]===key)[2],pud.extras.find(e=>e[0]===key)[3]];

test('actual Packet-Loss Pudding PNGs decode; strip/portrait sizes match the definition; true RGBA with real transparency',()=>{
  for(const key of ['atlas','attack','charge','drop','puddle','portrait']){
    const [width,height]=stripSize(key);
    const decoded=decodePng(bytesOf(stripPath(key)));
    assert.equal(decoded.width,width,key);assert.equal(decoded.height,height,key);
    assert(decoded.rgba.some((v,i)=>i%4===3&&v===0),key+' has no transparent pixels');
    assert(decoded.rgba.some((v,i)=>i%4===3&&v>200),key+' has opaque pixels');
  }
  console.log('PUDDING_IMAGE_EVIDENCE',JSON.stringify(Object.fromEntries(['atlas','attack','charge','drop','puddle','portrait'].map(k=>[k,[...stripSize(k),bytesOf(stripPath(k)).length]]))));
});

test('foot anchors match the manifest; per-frame foot baselines sit on the measured lines with no cell bleed; no checker remnants',()=>{
  const m=JSON.parse(bytesOf(pud.manifest));
  for(const [key,expected] of Object.entries(pud.manifestSpec)){const actual=key.split('.').reduce((o,p)=>o?.[p],m);assert.equal(actual,expected,key)}
  assert.deepEqual(m.anchors.movement,pud.moveAnchors);assert.deepEqual(m.anchors.attack,pud.attackAnchors);
  assert.deepEqual(m.anchors.charge,pud.chargeAnchors);assert.deepEqual(m.anchors.drop,pud.dropAnchors);
  assert.deepEqual(m.bodyTops.movement,pud.moveBodyTops);assert.deepEqual(m.bodyTops.attack,pud.attackBodyTops);
  const mv=decodePng(bytesOf(pud.atlas));
  const alphaAt=(img,x,y)=>img.rgba[(y*img.width+x)*4+3];
  // movement: 10 frames across 2 rows — every occupied cell bottoms out on the
  // measured foot baseline (~104, ±1), and nothing bleeds past the cell edges
  const cells=[];for(let row=0;row<2;row++)for(let col=0;col<6;col++){
    let last=-1,any=false;
    for(let y=0;y<106;y++)for(let x=0;x<170;x++)if(alphaAt(mv,col*170+x,row*106+y)>200){last=y;any=true}
    if(any)cells.push([row,col,last]);
  }
  assert.equal(cells.length,10,'10 occupied movement cells');
  for(const [row,col,last] of cells)assert(last>=102&&last<=105,`movement cell r${row}c${col} baseline ${last}`);
  for(const [row,col] of cells)for(const x of [0,1,168,169])for(let y=0;y<106;y++)
    assert(alphaAt(mv,col*170+x,row*106+y)<=200,`bleed at movement r${row}c${col} x${x}`);
  // other strips: last body row sits on the measured baselines (drop = residual 122)
  for(const [key,expected] of [['attack',98],['charge',116],['drop',122]]){
    const img=decodePng(bytesOf(stripPath(key))),cellW=pud[key+'CellW'],cellH=pud[key+'CellH'];
    for(let col=0;col<pud[key+'Columns'];col++){
      let last=-1;for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++)if(alphaAt(img,col*cellW+x,y)>200)last=y;
      assert(last>=expected-3&&last<=expected+1,`${key} col ${col} baseline ${last}`);
    }
  }
  // JPEG checker remnants removed: near-zero counts in the checker magenta tones
  for(const key of ['atlas','attack','charge','drop']){
    const img=decodePng(bytesOf(stripPath(key)));
    const near=(r,g,b,t)=>{let n=0;for(let i=0;i<img.rgba.length;i+=4){if(img.rgba[i+3]<10)continue;if(Math.abs(img.rgba[i]-r)<=t&&Math.abs(img.rgba[i+1]-g)<=t&&Math.abs(img.rgba[i+2]-b)<=t)n++}return n};
    const rem=near(185,6,123,12)+near(215,19,146,12);
    assert(rem<=30,`${key} checker remnants: ${rem}`);
    console.log('PUDDING_CHECKER_REMNANTS',key,rem);
  }
});

test('Packet-Loss Pudding keeps its identity/stats and joins the ordinary spawn progression',()=>{
  assert.deepEqual({...ENEMIES.packet,flavor:undefined,counter:undefined},{name:'Packet-Loss Pudding',color:'#fb7185',hp:44,speed:44,damage:16,r:18,value:3,eyes:2,sound:'packet',flavor:undefined,counter:undefined});
  assert(!('pattern' in ENEMIES.packet));assert(!('projectile' in ENEMIES.packet)); // melee contact + puddle only
  const engine=read('game/signalEngine.js');
  assert.match(engine,/if\(e\.kind==='packet'&&puddingArt\)\{e\.art=puddingArt;e\.anim=createPuddingAnimation\(\);e\.pud=initPuddingState\(\)\}/);
  assert.match(engine,/for\(let i=0;i<puddles\.items\.length;i\+\+\)/); // own bounded pool, not the enemy pool
  // hazards never count against the enemy cap and puddles spawn from the cast state machine only
  assert.match(engine,/spawnPuddle\(e\.pud\.dropX,e\.pud\.dropY\)/);
  assert(!/spawnPuddle\(\)/.test(engine.replace('function spawnPuddle(x,y)','')));
});

test('cast machine: 3-8s initial cooldown, exactly 1.0s rooted telegraph, drop at the saved spot, instant chase resume, 10s cooldown',()=>{
  const T=PUDDING;
  assert.equal(T.telegraph,1);assert.equal(T.puddleLife,5);assert.equal(T.cooldown,10);
  assert.equal(T.tickInterval,.5);assert.equal(T.tickDamage,10);assert.equal(T.slow,.35);assert.equal(T.radius,34);assert.equal(T.triggerRange,150);
  const s=initPuddingState(()=>.5);assert(s.castCd>=T.initialCastCdMin&&s.castCd<=T.initialCastCdMax);
  // not ready → chase; out of range / offscreen / dead player → never cast
  assert.equal(stepPuddingState(s,1,{dist:10,visible:true,playerAlive:true,x:1,y:2}),'chase');
  const far=initPuddingState(()=>.99);
  assert.equal(stepPuddingState(far,T.initialCastCdMax+1,{dist:T.triggerRange+1,visible:true,playerAlive:true}),'chase');
  assert.equal(stepPuddingState(far,1,{dist:1,visible:false,playerAlive:true}),'chase');
  assert.equal(stepPuddingState(far,1,{dist:1,visible:true,playerAlive:false}),'chase');
  // ready + close + visible → start: rooted, drop position saved at cast start
  assert.equal(stepPuddingState(far,1,{dist:T.triggerRange,visible:true,playerAlive:true,x:7,y:9}),'start');
  assert.equal(far.phase,'telegraph');assert.equal(far.t,1);assert.deepEqual([far.dropX,far.dropY],[7,9]);
  // still rooted at 0.999s; a bit past 1.0s → drop
  assert.equal(stepPuddingState(far,.999,{dist:1e6,visible:false}),'rooted');
  assert.equal(stepPuddingState(far,.0011,{dist:1e6,visible:false}),'drop');
  assert.equal(far.phase,'chase');assert.equal(far.castCd,T.cooldown); // chases again immediately
  // cooldown blocks re-cast for 10s after the drop
  assert.equal(stepPuddingState(far,T.cooldown-.001,{dist:1,visible:true,playerAlive:true}),'chase');
  assert.equal(stepPuddingState(far,.01,{dist:1,visible:true,playerAlive:true,x:3,y:4}),'start');
});

test('hazard math: strongest slow once, cleanliness mitigation 1%/point capped 40%, lifetime exactly 5s',()=>{
  assert.equal(applyPuddleSlow(1),1-PUDDING.slow);
  assert.equal(applyPuddleSlow(1-PUDDING.slow),1-PUDDING.slow); // never stacked
  assert.equal(applyPuddleSlow(.5),.5); // an already-stronger slow wins
  for(const [c,expected] of [[0,0],[10,.1],[20,.2],[40,.4],[100,.4]])assert.equal(puddleMitigation(c),expected);
  assert(puddleMitigation(5)<puddleMitigation(30)&&puddleMitigation(30)<puddleMitigation(60)); // monotonic
  const poolInit=read('game/signalEngine.js').match(/const puddles=new ObjectPool\(16,i=>\(\{poolIndex:i,active:false,x:0,y:0,born:0,life:PUDDING\.puddleLife,maxLife:PUDDING\.puddleLife/);
  assert(poolInit,'puddle lifetime seeded from PUDDING.puddleLife');
});

test('engine wiring: shared tick clock, single slow multiplier, ticks respect invulnerability, ground layer under actors',()=>{
  const engine=read('game/signalEngine.js');
  assert.match(engine,/puddleTickClock-=dt;if\(puddleTickClock<=0\)\{puddleTickClock\+=PUDDING\.tickInterval/); // += never reset by overlap
  assert.match(engine,/puddleSlowMul=Math\.min\(puddleSlowMul,1-PUDDING\.slow\)/);
  assert.match(engine,/run\.speed\*boost\*puddleSlowMul\*dt/); // movement honors the slow
  assert.match(engine,/damagePlayer\(PUDDING\.tickDamage\*\(1-puddleMitigation\(run\.cleanliness\)\)\)/);
  assert.match(engine,/if\(inP&&p\.inv<=0\)damagePlayer/); // ticks respect brief invulnerability, never grant it
  const goo=engine.indexOf('PACKET-LOSS PUDDING ground goo'),structures=engine.indexOf('// structures (under enemies)');
  assert(goo>-1&&structures>-1&&goo<structures,'puddles draw in the ground layer');
  assert.match(engine,/if\(e\.pud&&e\.pud\.phase!=='chase'\)spd=0/); // rooted during telegraph
  assert.match(engine,/d\.life<=0\)\{puddles\.release\(d\);continue\}/); // exact-lifetime expiry
  assert.match(read('components/game/GameArena.jsx'),/preloadEnemySprite\('packet'\)/);
  assert.match(read('components/game/GameArena.jsx'),/pedestalArt,puddingArt,jitterArt\)/);
  assert.match(engine,/puddingArt=null,jitterArt=null\)\{/); // engine signature takes the pudding art in slot order
});

test('contact melee strip plays on the ordinary contact tick without extra damage',()=>{
  const engine=read('game/signalEngine.js');
  assert.match(engine,/if\(e\.kind==='packet'\)\{e\.anim\.melee=\.34;e\.anim\.facing=p\.x<e\.x\?'left':'right'\}else e\.anim\.attack=\.35\}/);
  const d=enemySpriteDef('packet');
  assert.equal(d.attackColumns,4);assert.equal(d.attackFps,12);
  const s=createPuddingAnimation();s.melee=1/3;
  const frames=[];for(let k=0;k<4;k++){updatePuddingAnimation(s,0,0,1/13,d);frames.push(s.frame)} // ~12fps over the 1/3s strip
  assert.deepEqual(frames,[0,1,2,3]); // neutral → extend → impact → recover
});

test('movement cycle: 10 frames (row 4 + row 6), idle frame 0, left is mirrored, anchors drive the draw',()=>{
  const d=enemySpriteDef('packet'),s=createPuddingAnimation();
  updatePuddingAnimation(s,1,0,1/d.fps,d);assert.equal(s.frame,1);assert.equal(s.facing,'right');
  updatePuddingAnimation(s,-1,0,1/d.fps,d);assert.equal(s.frame,2);assert.equal(s.facing,'left');
  updatePuddingAnimation(s,0,0,10,d);assert.equal(s.frame,0); // stationary → idle frame 0
  updatePuddingAnimation(s,0,1,1/(d.fps/2),d);assert.equal(s.frame,1);assert.equal(s.facing,'left'); // vertical keeps facing
  // Full 10-frame cycle at 9fps: frames 1..9 then wrap to 0.
  const seq=[];for(let i=0;i<20;i++){updatePuddingAnimation(s,1,0,1/d.fps,d);seq.push(s.frame)}
  assert.deepEqual(seq.slice(0,10),[1,2,3,4,5,6,7,8,9,0]);
  // every movement frame draws from its measured anchor + body top; frames 4-9 sit on row B
  const fake={definition:d,atlas:{},attack:{},charge:{},drop:{}};
  for(let f=0;f<10;f++){
    s.frame=f;s.facing='right';
    const frame=puddingFrame(fake,s);
    assert.equal(frame.ax,d.moveAnchors[f][0]);
    assert.equal(frame.bodyTop,d.moveBodyTops[f]);
    assert.equal(frame.mirror,false);
    assert.equal(frame.sy,f<4?0:d.cellH);
  }
  // movement frames 4-9 come from row B (sy = cellH)
  s.clock=0;s.frame=5;const rowB=puddingFrame({definition:d,atlas:{},attack:{},charge:{},drop:{}},s);
  assert.equal(rowB.sy,d.cellH);
  s.frame=0;const rowA=puddingFrame({definition:d,atlas:{},attack:{},charge:{},drop:{}},s);
  assert.equal(rowA.sy,0);
});

test('telegraph/drop frame selection plays the right strips with render-only shake',()=>{
  const d=enemySpriteDef('packet'),s=createPuddingAnimation();
  s.telegraph=true;updatePuddingAnimation(s,0,0,.5,d); // 0.5s in → charge frame 4 % 4 = 0
  assert.equal(s.frame,0);
  const c=puddingFrame({definition:d,charge:{},drop:{}},s);
  assert.equal(c.sx,0);assert.equal(c.ay,d.chargeAnchors[0][1]); // charge strip geometry
  s.teleClock=0;s.frame=0;s.telegraph=false;
  s.dropT=.25;updatePuddingAnimation(s,0,0,.125,d);
  assert.equal(s.frame,1); // first 2 drop poses play as the release flash
});

test('Field Guide entry: full warning + technical detail for the pudding and its puddle',()=>{
  const entry=guideEntries().Enemies.find(e=>e.title==='Packet-Loss Pudding');
  assert(entry,'Packet-Loss Pudding entry missing from the guide');
  assert(entry.body.includes('glows cyan'));assert(entry.body.includes('Step out during the glow'));
  assert(entry.body.includes('5 seconds'));assert(entry.body.includes('Counter:'));
  assert(entry.detail.includes('ONE shared clock'));assert(entry.detail.includes('Cleanliness'));
  assert(entry.detail.includes('40'));assert(entry.detail.includes('no puddle at all'));
  assert(entry.detail.includes('1s rooted'));
  assert.equal(ENEMY_SPRITES.packet.portrait,'/assets/pudding/portrait.png'); // guide portrait path is live
});