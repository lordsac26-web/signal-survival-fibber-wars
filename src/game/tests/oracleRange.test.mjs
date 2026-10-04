import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { characterById } from '@/game/data/characters';
import { CHARACTER_SPRITES } from '@/game/art/characterSprites';
import { createSpriteAnimation,updateSpriteAnimation,drawCharacterSprite } from '@/game/art/spriteAnimation';
import { preloadCharacterSprite } from '@/game/art/spriteLoader';
import { effectiveRange,updateVisibleViewport,withinReach,areaCanHit } from '@/game/combat/effectiveRange';
import { RANGE_PROFILES,SIGNATURE_RANGE_WEAPONS } from '@/game/combat/rangeConfig';
import { advanceProjectile,projectileCanHit } from '@/game/combat/projectileTravel';
import { decodePng } from './pngDecode.mjs';
import { drawProjectile } from '@/game/performance/drawProjectile';
const oracle=CHARACTER_SPRITES.oracle;
const file=path=>readFileSync(new URL('../../../public'+path,import.meta.url));
const weapon={baseId:'power',pattern:'projectile',range:330};
const run=(id='rookie',bonus=0)=>({character:characterById(id),range:characterById(id).stats.range+bonus});
const view=(w,h,z=1)=>updateVisibleViewport({},w,h,z);
const shot=(reach=100,speed=10000)=>({x:0,y:0,prevX:0,prevY:0,originX:0,originY:0,vx:speed,vy:0,maxReach:reach,remaining:reach,traveled:0,life:100,r:5});

test('actual public PNG HTTP responses fully decode; local assets match exact uploaded bytes',async()=>{
  for(const [key,width,height] of [['atlas',448,320],['portrait',256,256]]){
    const response=await fetch(oracle.sources[key],{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),decoded=decodePng(bytes);
    assert.equal(decoded.width,width);assert.equal(decoded.height,height);
    const local=file(oracle[key]);assert.equal(createHash('sha256').update(local).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    assert(decoded.rgba.some((v,i)=>i%4===3 && v===0));assert(decoded.rgba.some((v,i)=>i%4===3 && v>200));
    if(key==='atlas'){
      const baselines=[];for(let row=0;row<5;row++)for(let col=0;col<7;col++){let last=-1;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(decoded.rgba[((row*64+y)*width+col*64+x)*4+3]>200)last=y;baselines.push(last);assert(last>=56 && last<=58)}
      console.log('ORACLE_DECODED_FOOT_BASELINES',JSON.stringify(baselines));
    }
    console.log('ORACLE_IMAGE_EVIDENCE',JSON.stringify({key,http:response.status,width,height,bytes:bytes.length,decoded:true}));
  }
  const m=JSON.parse(file(oracle.manifest));assert.equal(m.columns,7);assert.equal(m.rows,5);assert.equal(m.anchor.y,.90625);
  for(const [direction,y] of Object.entries(oracle.directions))assert.deepEqual(m.animations[direction].map(f=>[f.x,f.y]),Array.from({length:7},(_,i)=>[i*64,y]));
});

test('Oracle roster id, existing portraits/guide/select surfaces, and preloaded engine path are connected',()=>{
  assert.equal(characterById('oracle').id,'oracle');
  const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  for(const p of ['components/game/CharacterPortrait.jsx','pages/FieldGuide.jsx','components/game/GalleryScreen.jsx'])assert.match(read(p),/OraclePortrait/);
  assert.match(read('components/game/CharacterCard.jsx'),/CharacterPortrait/);
  assert.match(read('components/game/OraclePortrait.jsx'),/characterSprite\('oracle'\)\.portrait/);
  assert.match(read('components/game/GameArena.jsx'),/preloadCharacterSprite\(run.character.id\)/);assert.match(read('components/game/GameArena.jsx'),/preloadEnemySprite\('lag'\)/);assert.match(read('components/game/GameArena.jsx'),/paused,art,lagArt/);assert.match(read('components/game/GameArena.jsx'),/Retry sprite assets/);
  const engine=read('game/signalEngine.js');assert.match(engine,/run.character.id==='oracle'/);assert.match(engine,/drawCharacterSprite\(ctx,characterArt,spriteState/);assert.match(engine,/p.hp-=dmg;if\(spriteState\)spriteState.hurt=.18/);
  assert.doesNotMatch(engine,/w\.range\*run\.range|t\.range\*run\.range|def\.range\*run\.range/);
});

test('8fps directional movement, stop/resume idle, rounded foot anchor and hurt atlas; no other sprite ids',()=>{
  const s=createSpriteAnimation(),art={definition:oracle,atlas:{id:'atlas'},hurt:{id:'hurt'}},draws=[],ctx={imageSmoothingEnabled:true,drawImage(...a){assert.equal(this.imageSmoothingEnabled,false);draws.push(a)}};
  for(const [dx,dy,facing,row] of [[0,1,'down',0],[-1,0,'left',64],[1,0,'right',128],[0,-1,'up',192]]){
    updateSpriteAnimation(s,dx,dy,.125,oracle);assert.equal(s.facing,facing);assert.equal(s.frame,1);
    drawCharacterSprite(ctx,art,s,125.4,135.4);assert.equal(draws.at(-1)[2],row);assert.equal(draws.at(-1)[1],64);
    updateSpriteAnimation(s,0,0,.3,oracle);assert.equal(s.facing,facing);assert.equal(s.frame,0);assert.equal(s.clock,0);
    drawCharacterSprite(ctx,art,s,125.4,135.4);assert.equal(draws.at(-1)[2],facing==='down'?256:row);
    const a=draws.at(-1);assert(Number.isInteger(a[5])&&Number.isInteger(a[6]));assert(Math.abs(a[6]+48*.90625-135.4)<=.5);
    updateSpriteAnimation(s,dx,dy,.125,oracle);assert.equal(s.frame,1);
  }
  s.hurt=.18;drawCharacterSprite(ctx,art,s,0,0);assert.equal(draws.at(-1)[0],art.hurt);updateSpriteAnimation(s,0,0,.2,oracle);drawCharacterSprite(ctx,art,s,0,0);assert.equal(draws.at(-1)[0],art.atlas);
  assert.equal(ctx.imageSmoothingEnabled,true);assert.equal(CHARACTER_SPRITES.rookie,undefined);
});

test('loader decodes, caches once, rejects visible errors and permits retry',async()=>{
  const previous={Image:globalThis.Image,fetch:globalThis.fetch,document:globalThis.document};let count=0,failed=true,wrong=false,decodeCount=0;
  globalThis.Image=class{set src(url){count++;queueMicrotask(()=>{if(failed){this.onerror();return}const bytes=file(url);this.naturalWidth=bytes.readUInt32BE(16)+(wrong?-1:0);this.naturalHeight=bytes.readUInt32BE(20);this.onload()})}async decode(){decodeCount++}};
  globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(file(oracle.manifest))});
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},fillRect(){}})})};
  try{
    await assert.rejects(preloadCharacterSprite('oracle'),/failed to load/);failed=false;wrong=true;
    await assert.rejects(preloadCharacterSprite('oracle'),/Unexpected image size/);wrong=false;
    const a=preloadCharacterSprite('oracle'),b=preloadCharacterSprite('oracle');assert.equal(a,b);const art=await a;assert.equal(art.definition,oracle);assert.equal(count,6);assert(decodeCount>=2);
    assert.equal(await preloadCharacterSprite('rookie'),null);assert.equal(count,6);
  }finally{Object.assign(globalThis,previous)}
});

test('logical desktop/mobile/orientation/zoom ranges are bounded and DPR-independent; logs old/new',()=>{
  const examples=[];
  for(const [width,height] of [[1280,720],[390,700],[700,390]])for(const zoom of [1,2,Math.max(1,width/1100,height/800)]){
    const viewport=view(width,height,zoom),short=Math.min(viewport.width,viewport.height);
    for(const dpr of [1,2,3]){
      const baseline=effectiveRange(weapon,run(),viewport),enhanced=effectiveRange(weapon,run('rookie',1),viewport),oracleW={baseId:'otdr',range:520,pattern:'pierce'},oracleR=effectiveRange(oracleW,run('oracle'),viewport),oracleUp=effectiveRange(oracleW,run('oracle',1),viewport),melee=effectiveRange({baseId:'cleaver',range:92,pattern:'melee'},run(),viewport);
      assert(baseline<=.30*short);assert(enhanced<=.42*short+1e-8);assert(oracleR<=.44*short);assert(oracleUp<=.44*short+1e-8);assert(oracleR>baseline);assert(melee<baseline*.6);
      const meleeUpgraded=effectiveRange({baseId:'cleaver',range:92,pattern:'melee'},run('rookie',1),viewport);assert(meleeUpgraded<=.18*short+1e-8);
      assert.equal(effectiveRange(weapon,run(),view(width,height,zoom,dpr)),baseline);
      if(dpr===1 && zoom===Math.max(1,width/1100,height/800))examples.push({css:[width,height],zoom,shortWorld:short,old:{ordinary:330,ordinaryUpgraded:660,oracle:702,oracleUpgraded:1222,melee:92,meleeUpgraded:184},new:{ordinary:baseline,ordinaryUpgraded:enhanced,oracle:oracleR,oracleUpgraded:oracleUp,melee,meleeUpgraded}});
    }
  }
  console.log('RANGE_BEFORE_AFTER',JSON.stringify(examples));
  assert.equal(effectiveRange(weapon,run(),view(390,700)),effectiveRange(weapon,run(),view(700,390)));
});

test('inside/outside limits, flat/percent/weapon bonuses once, and resize never mutates saved stats',()=>{
  const r=run('oracle'),before=JSON.stringify(r),vp=view(390,700),range=effectiveRange(weapon,r,vp);
  assert(withinReach(range-.01,0,0,0,range));assert(!withinReach(range+.01,0,0,0,range));
  assert(effectiveRange({...weapon,range:396},r,vp)>range);
  assert.equal(effectiveRange(weapon,{...r,rangeFlat:5},vp),range+5);
  assert.equal(effectiveRange({...weapon,rangeFlat:5},{...r,rangeFlat:5},vp),range+10);
  assert(Math.abs(effectiveRange(weapon,run('oracle',.03),vp)-390*.26*1.38)<1e-8);
  for(let i=0;i<100;i++){updateVisibleViewport(vp,i%2?390:1280,i%2?700:720,i%2?1:1280/1100);effectiveRange(weapon,r,vp)}
  assert.equal(JSON.stringify(r),before);assert.equal(r.range,1.35);
});

test('high-speed/large-dt shots stop before collision outside frozen endpoint, including piercing beams',()=>{
  for(const pattern of ['projectile','pierce','beam','beamSweep','thrown','mortar']){
    const s={...shot(),pattern};assert(advanceProjectile(s,10));assert.equal(s.x,100);assert.equal(s.traveled,100);assert.equal(s.remaining,0);
    assert(projectileCanHit(s,{x:99,y:0,r:13}));assert(!projectileCanHit(s,{x:100.01,y:0,r:28}));assert(!projectileCanHit(s,{x:101,y:0,r:100}));
    advanceProjectile(s,10);assert.equal(s.x,100);
  }
  const s=shot(100,100);advanceProjectile(s,.4);const frozen=s.maxReach;const resized=view(390,700,2);effectiveRange(weapon,run(),resized);assert.equal(s.maxReach,frozen);advanceProjectile(s,2);assert.equal(s.x,100);
});

test('rendered beam/piercing front stops at remaining reach and tail never starts behind launch',()=>{
  for(const pattern of ['beam','beamSweep','pierce','projectile']){
    const s={...shot(),pattern,pierce:pattern!=='projectile',color:'#fff'};advanceProjectile(s,.0099);
    const points=[],ctx={beginPath(){},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){},arc(x,y){points.push([x,y])},fill(){}};
    drawProjectile(ctx,s);assert(points.every(([x,y])=>x>=0 && x<=100 && y===0));assert(points.some(([x])=>x===100));
    const first={...shot(),pattern,pierce:true,color:'#fff'};drawProjectile(ctx,first);assert(points.every(([x])=>x>=0));
  }
});
test('arcs/radial attacks and current chain fan share bounded visible reach; future turns cannot reset travel',()=>{
  const vp=view(390,700),r=run(),reach=effectiveRange({baseId:'jumper',range:210,pattern:'chain'},r,vp);
  assert.equal(RANGE_PROFILES.chain.maxBounces,0);assert(reach<=.18*390);
  assert(areaCanHit({x:reach-.01,y:0},0,0,reach,0,Math.PI/3));assert(!areaCanHit({x:reach+.01,y:0},0,0,reach));assert(!areaCanHit({x:-10,y:0},0,0,reach,0,Math.PI/3));
  for(const angle of [-.16,0,.16]){const s=shot(reach,1000);s.vx=Math.cos(angle)*1000;s.vy=Math.sin(angle)*1000;advanceProjectile(s,1);assert(Math.hypot(s.x,s.y)<=reach+1e-8);assert.equal(s.remaining,0)}
  const turn=shot(100,100);advanceProjectile(turn,.6);turn.vx=-100;advanceProjectile(turn,2);assert.equal(turn.traveled,100);assert.equal(turn.remaining,0);assert.equal(turn.x,20);
  assert.equal(effectiveRange(SIGNATURE_RANGE_WEAPONS.trace,run('oracle'),vp),390*.4*1.35);assert.equal(effectiveRange(SIGNATURE_RANGE_WEAPONS.trace,run('oracle',10),vp),390*.6);
});