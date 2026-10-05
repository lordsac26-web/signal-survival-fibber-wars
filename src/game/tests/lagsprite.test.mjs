import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ENEMIES } from '@/game/data/combat';
import { ENEMY_SPRITES, enemySpriteDef } from '@/game/art/characterSprites';
import { createLagAnimation,updateLagAnimation,lagFrame,drawLagSprite } from '@/game/art/enemySpriteAnimation';
import { preloadEnemySprite } from '@/game/art/spriteLoader';
import { guideEntries } from '@/game/data/reference';
import { createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { decodePng } from './pngDecode.mjs';
const lag=ENEMY_SPRITES.lag;
const file=path=>readFileSync(new URL('../../../public'+path,import.meta.url));
const bytesOf=path=>file(path);

test('actual Lag Sprite public PNGs decode; local assets match exact uploaded bytes',async()=>{
  for(const [key,width,height] of [['atlas',384,128],['attack',128,64],['portrait',256,256]]){
    const response=await fetch(lag.sources[key],{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),decoded=decodePng(bytes);
    assert.equal(decoded.width,width);assert.equal(decoded.height,height);
    const local=bytesOf(lag[key]);assert.equal(createHash('sha256').update(local).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    assert(decoded.rgba.some((v,i)=>i%4===3 && v===0));assert(decoded.rgba.some((v,i)=>i%4===3 && v>200));
    if(key==='atlas'){
      const baselines=[];for(let row=0;row<2;row++)for(let col=0;col<6;col++){let last=-1;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(decoded.rgba[((row*64+y)*width+col*64+x)*4+3]>200)last=y;baselines.push(last);assert(last>=56 && last<=58)}
      console.log('LAGSPRITE_DECODED_FOOT_BASELINES',JSON.stringify(baselines));
    }
    console.log('LAGSPRITE_IMAGE_EVIDENCE',JSON.stringify({key,http:response.status,width,height,bytes:bytes.length,decoded:true}));
  }
  const m=JSON.parse(bytesOf(lag.manifest));
  assert.equal(m.enemyId,'lag_sprite');assert.equal(m.fps,8);
  for(const [key,expected] of Object.entries(lag.manifestSpec)){const actual=key.split('.').reduce((o,p)=>o?.[p],m);assert.equal(actual,expected,key)}
  assert.deepEqual(m.animations.attack_front.map(f=>[f.x,f.y]),[[0,0]]);assert.deepEqual(m.animations.attack_side.map(f=>[f.x,f.y]),[[64,0]]);
});

test('Lag Sprite is melee-only, keeps its stats, and the wiring references real assets not placeholders',()=>{
  // stats untouched; melee-only: contact damage, no projectile/pattern fields
  assert.deepEqual({...ENEMIES.lag,flavor:undefined},{name:'Lag Sprite',color:'#fbbf24',hp:24,speed:64,damage:10,r:13,value:2,eyes:2,sound:'lag',counter:ENEMIES.lag.counter,flavor:undefined});
  assert(!('pattern' in ENEMIES.lag));assert(!('projectile' in ENEMIES.lag));
  const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  const engine=read('game/signalEngine.js');
  assert.match(engine,/drawLagSprite\(ctx,e\.art,e\.anim/);assert.match(engine,/if\(e\.anim\)e\.anim\.attack=\.35/);assert.match(engine,/if\(e\.kind==='lag'&&lagArt\)/);
  assert.equal(lag.atlas,'/assets/lagsprite/movement.png');assert.equal(lag.attack,'/assets/lagsprite/attack.png');assert.equal(lag.portrait,'/assets/lagsprite/portrait.png');
  assert.match(read('pages/FieldGuide.jsx'),/tab==='Enemies' && enemySpriteDef\(e\.id\) && <EnemyPortrait/);
  assert.match(read('components/game/EnemyPortrait.jsx'),/\/assets\/lagsprite\/portrait\.png|def\.portrait/);
  // loader shares the same preload path as characters (no forked system)
  assert.match(read('game/art/spriteLoader.js'),/export const preloadEnemySprite=kind=>preloadSprite\(enemySpriteDef\(kind\)\)/);
});

test('Field Guide entry shows the exact flavor text before the stats line',()=>{
  const entry=guideEntries().Enemies.find(e=>e.title==='Lag Sprite');
  assert(entry,'Lag Sprite entry missing from the guide');
  assert(entry.body.startsWith('Small, annoying melee-only creature. Tiny glitchy digital sprite that looks like a lagging network packet or a delayed signal. '));
  assert(entry.body.includes('contact damage'));assert(entry.body.includes('Counter:'));
});

test('8fps walk cycle: front row for vertical, side row right/left mirrored, idle frame 0',()=>{
  const d=lag,s=createLagAnimation();
  for(const [dx,dy,facing,mirror] of [[0,1,'down',false],[0,-1,'up',false],[-1,0,'left',true],[1,0,'right',false]]){
    updateLagAnimation(s,dx,dy,.125,d);assert.equal(s.facing,facing);assert.equal(s.frame,1);
    updateLagAnimation(s,dx,dy,.125,d);assert.equal(s.frame,2);
    updateLagAnimation(s,0,0,.5,d);assert.equal(s.moving,false);assert.equal(s.frame,0);assert.equal(s.clock,0);
    updateLagAnimation(s,dx,dy,.125,d);assert.equal(s.frame,1);
  }
  // row selection: vertical → row 0, horizontal → row 64; left mirrors
  const art={definition:d,atlas:{id:'a'},attack:{id:'x'}};
  assert.deepEqual({...lagFrame(art,{facing:'down',frame:3,attack:0}),image:art.atlas},{image:art.atlas,sx:192,sy:0,mirror:false});
  assert.deepEqual({...lagFrame(art,{facing:'up',frame:5,attack:0}),image:art.atlas},{image:art.atlas,sx:320,sy:0,mirror:false});
  assert.deepEqual({...lagFrame(art,{facing:'right',frame:2,attack:0}),image:art.atlas},{image:art.atlas,sx:128,sy:64,mirror:false});
  assert.deepEqual({...lagFrame(art,{facing:'left',frame:2,attack:0}),image:art.atlas},{image:art.atlas,sx:128,sy:64,mirror:true});
});

test('attack swipe is a one-shot front/side frame; draw centers, mirrors left, and restores smoothing',()=>{
  const art={definition:lag,atlas:{id:'a'},attack:{id:'x'}};
  const front=lagFrame(art,{facing:'down',frame:1,attack:.3});assert.equal(front.image,art.attack);assert.equal(front.sx,0);assert.equal(front.mirror,false);
  const side=lagFrame(art,{facing:'right',frame:1,attack:.3});assert.equal(side.image,art.attack);assert.equal(side.sx,64);assert.equal(side.mirror,false);
  const sideLeft=lagFrame(art,{facing:'left',frame:1,attack:.3});assert.equal(sideLeft.image,art.attack);assert.equal(sideLeft.sx,64);assert.equal(sideLeft.mirror,true);
  const s=createLagAnimation();s.attack=.35;updateLagAnimation(s,0,0,.1,lag);assert(s.attack>0);updateLagAnimation(s,0,0,.3,lag);assert.equal(s.attack,0);
  const draws=[],ctx={imageSmoothingEnabled:true,drawImage(...a){assert.equal(this.imageSmoothingEnabled,false);draws.push(a)},save(){},restore(){},translate(){},scale(){}};
  drawLagSprite(ctx,art,{facing:'left',frame:4,attack:0},125.4,135.4);
  const a=draws.at(-1);assert.equal(a[0],art.atlas);assert.equal(a[1],256);assert.equal(a[2],64);
  assert(Number.isInteger(a[5])&&Number.isInteger(a[6]));assert.equal(a[5],-24);assert.equal(a[6],-24);
  drawLagSprite(ctx,art,{facing:'down',frame:0,attack:.35},0,0);assert.equal(draws.at(-1)[0],art.attack);assert.equal(draws.at(-1)[1],0);
  assert.equal(ctx.imageSmoothingEnabled,true);
});

test('loader resolves lag art once and rejects unknown kinds; real engine spawns animated Lag Sprites drawing the atlas',async()=>{
  const previous={Image:globalThis.Image,fetch:globalThis.fetch,document:globalThis.document,devicePixelRatio:globalThis.devicePixelRatio};
  globalThis.devicePixelRatio=1;
  globalThis.Image=class{set src(url){const bytes=file(url);this.naturalWidth=bytes.readUInt32BE(16);this.naturalHeight=bytes.readUInt32BE(20);this.onload()}async decode(){}};
  globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(bytesOf(lag.manifest))});
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},fillRect(){}})})};
  try{
    const a=preloadEnemySprite('lag'),b=preloadEnemySprite('lag');assert.equal(a,b);
    const art=await a;assert.equal(art.definition,lag);assert(art.attack);
    assert.equal(await preloadEnemySprite('packet'),null);
    // real engine boot with deterministic spawns: first impairment is a Lag Sprite
    delete globalThis.Image;delete globalThis.fetch;delete globalThis.document;
    const listeners=new Map();let nextFrame;
    globalThis.window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
    globalThis.localStorage={getItem:key=>key==='signal-survival-audio-v1'?'{"muted":true,"volume":0}':null};
    globalThis.requestAnimationFrame=fn=>{nextFrame=fn;return 1};globalThis.cancelAnimationFrame=()=>{};
    globalThis.ResizeObserver=class{observe(){}disconnect(){}};
    const noop=()=>{};
    const context=drawImage=>new Proxy({drawImage,createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>key in target?target[key]:noop});
    globalThis.document={createElement:()=>({getContext:()=>context(noop)})};
    const {createSignalEngine}=await import('@/game/signalEngine');
    const fakeArt={definition:lag,atlas:{id:'lag-atlas'},attack:{id:'lag-attack'}};
    const draws=[],ctx=context((...args)=>{if(args[0]===fakeArt.atlas || args[0]===fakeArt.attack){assert.equal(ctx.imageSmoothingEnabled,false);draws.push(args)}});
    const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:700})};
    const run=createRun(characterById('rookie'),false,123);run.weapons=[];run.dodge=0;run.hp=run.maxHp=10000;
    const oldRandom=Math.random;Math.random=()=>0;const input={current:{x:0,y:0}};
    const clean=createSignalEngine(canvas,run,input,{hud:noop,flash:noop,finish:noop},{current:false},null,fakeArt);
    try{
      let now=performance.now();for(let i=0;i<24;i++)nextFrame(now+=20);
      assert(draws.length>0,'Lag Sprite atlas was never drawn');
      assert(draws.some(d=>d[0]===fakeArt.atlas && d[2]===0),'front row not used for vertical approach');
      assert(draws.some(d=>d[0]===fakeArt.atlas && d[1]>=64),'walk cycle never advanced past frame 0 at 8fps');
      assert.equal(ctx.imageSmoothingEnabled,true);
    }finally{clean();Math.random=oldRandom}
  }finally{Object.assign(globalThis,previous)}
});