import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { STRUCTURE_SPRITES, structureSpriteDef } from '@/game/art/characterSprites';
import { truckFrame, drawTruckTurret } from '@/game/art/structureSprite';
import { preloadStructureSprite } from '@/game/art/spriteLoader';
import { DEPLOYABLES } from '@/game/data/structures';
import { createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { decodePng } from './pngDecode.mjs';
const def=STRUCTURE_SPRITES.bucket;
const file=path=>readFileSync(new URL('../../../public'+path,import.meta.url));
const bytesOf=path=>file(path);

test('actual Bucket-Truck public PNGs decode at exact sizes; local copies match uploaded bytes; manifest anchors verified',async()=>{
  for(const [key,width,height,local] of [['atlas',690,190,'atlas'],['icon',234,204,'portrait']]){
    const response=await fetch(def.sources[key],{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),decoded=decodePng(bytes);
    assert.equal(decoded.width,width);assert.equal(decoded.height,height);
    assert.equal(createHash('sha256').update(bytesOf(def[local])).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    assert(decoded.rgba.some((v,i)=>i%4===3 && v===0));assert(decoded.rgba.some((v,i)=>i%4===3 && v>200));
    console.log('BUCKETTRUCK_IMAGE_EVIDENCE',JSON.stringify({key,http:response.status,width,height,bytes:bytes.length,decoded:true}));
  }
  const mResponse=await fetch(def.sources.manifest,{signal:AbortSignal.timeout(30000)});assert.equal(mResponse.status,200);
  const mBytes=Buffer.from(await mResponse.arrayBuffer());
  assert.equal(createHash('sha256').update(bytesOf(def.manifest)).digest('hex'),createHash('sha256').update(mBytes).digest('hex'));
  const m=JSON.parse(mBytes);
  for(const [key,expected] of Object.entries(def.manifestSpec)){const actual=key.split('.').reduce((o,p)=>o?.[p],m);assert.equal(actual,expected,key)}
  assert.equal(m.frames.length,3);assert.deepEqual(m.frames.map(f=>f.x),[0,230,460]);
});

test('engine wiring: the truck is exclusive to the Keys turretMount; the Boss signature and other turrets keep placeholders',()=>{
  const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  const engine=read('game/signalEngine.js');
  // structures pool: turretMount draws the truck
  assert.match(engine,/drawTruckTurret\(ctx,truckArt,st\.born,x,y,grow\)/);assert.match(engine,/st\.type===truckDef\.structureType/);
  // turrets pool (signature/weapon turrets): NO truck reference at all
  assert.doesNotMatch(engine,/signatureWid/);assert.doesNotMatch(engine,/signature-bucket/);
  assert.match(engine,/if\(t\.mode==='helper'\)drawHelper\(ctx,Math\.round\(t\.x\),Math\.round\(t\.y\),t\.color\);else drawTurretBody/);
  assert.equal(def.structureType,'turretMount');assert.equal(def.signatureWid,undefined);
  assert.equal(def.atlas,'/assets/buckettruck/turret.png');assert.equal(def.portrait,'/assets/buckettruck/icon.png');
  // the only scoped user of the truck art; other turrets/structures keep drawTurretBody
  assert.equal(DEPLOYABLES.find(d=>d.id==='bucket_keys').structure,'turretMount');
  assert.equal(characterById('bucket').special.id,'fortify');
  // Field Guide no longer shows the truck portrait on the Boss's character card
  const guide=read('pages/FieldGuide.jsx');
  assert.doesNotMatch(guide,/StructurePortrait/);
});

test('slow idle cycle is a 3-pose wobble at 1.5fps; draw is centered, ground-anchored, rounded, smoothing restored',()=>{
  assert.deepEqual(truckFrame(def,0),{sx:0,sy:0});
  assert.deepEqual(truckFrame(def,.7),{sx:230,sy:0});
  assert.deepEqual(truckFrame(def,1.4),{sx:460,sy:0});
  assert.deepEqual(truckFrame(def,2.2),{sx:0,sy:0}); // wraps at 3 frames, never faster
  assert.deepEqual(truckFrame(def,-1),{sx:0,sy:0});
  const draws=[],ctx={imageSmoothingEnabled:true,drawImage(...a){assert.equal(this.imageSmoothingEnabled,false);draws.push(a)}};
  drawTruckTurret(ctx,{definition:def,atlas:{id:'truck'}},0,100,100,1);
  let a=draws.at(-1);assert.equal(a[0].id,'truck');assert.equal(a[1],0);assert.equal(a[2],0);assert.equal(a[3],230);assert.equal(a[4],190);
  assert.equal(a[5],100-32);assert(Number.isInteger(a[5])&&Number.isInteger(a[6]));assert.equal(a[7],64);assert.equal(a[8],53);
  // ground baseline: tile-local y=174 scaled to displayed width sits on the structure point
  drawTruckTurret(ctx,{definition:def,atlas:{}},.7,0,0,.5);
  a=draws.at(-1);assert.equal(a[1],230);assert.equal(a[6],-Math.round(174*(32/230)));assert.equal(a[7],32);
  drawTruckTurret(ctx,{definition:def,atlas:{}},0,10,10,.05);assert.equal(draws.at(-1)[7],Math.round(64*.2));
  assert.equal(ctx.imageSmoothingEnabled,true);
});

test('real engine draws the truck ONLY for the Keys turretMount; the Boss signature keeps its placeholder',async()=>{
  const previous={Image:globalThis.Image,fetch:globalThis.fetch,document:globalThis.document,devicePixelRatio:globalThis.devicePixelRatio};
  globalThis.devicePixelRatio=1;
  globalThis.Image=class{set src(url){const bytes=file(url);this.naturalWidth=bytes.readUInt32BE(16);this.naturalHeight=bytes.readUInt32BE(20);this.onload()}async decode(){}};
  globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(bytesOf(def.manifest))});
  const noop=()=>{};
  const makeCtx=record=>new Proxy({drawImage(...a){if(record)record.push(a)},createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>key in target?target[key]:noop});
  globalThis.document={createElement:()=>({getContext:()=>makeCtx(null)})};
  globalThis.window={addEventListener:noop,removeEventListener:noop};
  globalThis.localStorage={getItem:key=>key==='signal-survival-audio-v1'?'{"muted":true,"volume":0}':null};
  globalThis.requestAnimationFrame=fn=>{nextFrame=fn;return 1};globalThis.cancelAnimationFrame=()=>{};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  let nextFrame;
  try{
    const {createSignalEngine}=await import('@/game/signalEngine');
    const fakeArt={definition:def,atlas:{id:'truck-atlas'}};
    const canvas={getContext:()=>makeCtx(null),getBoundingClientRect:()=>({width:390,height:700})};
    const oldRandom=Math.random;Math.random=()=>0;
    const boot=(run,input)=>{const draws=[],ctx=makeCtx(draws),c={getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:700})};
      const clean=createSignalEngine(c,run,input,{hud:noop,flash:noop,finish:noop},{current:false},null,null,fakeArt);
      let now=performance.now();for(let i=0;i<44;i++)nextFrame(now+=20);
      const trucks=draws.filter(d=>d[0]===fakeArt.atlas);clean();Math.random=oldRandom;return trucks};
    try{
      // Boss signature: 'fortify' places one signature-bucket sentry → placeholder, NOT the truck
      const sig=createRun(characterById('bucket'),false,123);sig.weapons=[];sig.hp=sig.maxHp=10000;
      const sigTrucks=boot(sig,{current:{x:0,y:0,special:true}});
      assert.equal(sigTrucks.length,0,'signature turret must NOT draw the truck');
      // Shop deployable: Bucket Truck Keys → turretMount structure → truck art
      const dep=createRun(characterById('rookie'),false,123);dep.weapons=[];dep.dodge=0;dep.hp=dep.maxHp=10000;
      dep.deployables=[{structure:'turretMount',name:'Bucket Truck Keys',icon:'🔑',stacks:1}];
      const depTrucks=boot(dep,{current:{x:0,y:0,deploy:true}});
      assert(depTrucks.length>0,'turretMount structure never drew the truck');
      assert(depTrucks.some(d=>d[1]===0),'pose_a not drawn first');assert(depTrucks.some(d=>d[1]===230),'idle cycle never advanced to pose_b');
    }finally{Math.random=oldRandom}
  }finally{Object.assign(globalThis,previous)}
});