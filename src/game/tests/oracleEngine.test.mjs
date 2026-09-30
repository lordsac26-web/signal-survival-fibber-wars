import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_SPRITES } from '@/game/art/characterSprites';
import { createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
const listeners=new Map();let nextFrame,resizeObserved;
globalThis.window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
globalThis.localStorage={getItem:key=>key==='signal-survival-audio-v1'?'{"muted":true,"volume":0}':null};
globalThis.devicePixelRatio=1;
globalThis.requestAnimationFrame=fn=>{nextFrame=fn;return 1};globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{constructor(fn){resizeObserved=fn}observe(){}disconnect(){}};
const noop=()=>{};
const context=drawImage=>new Proxy({drawImage,createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>key in target?target[key]:noop});
globalThis.document={createElement:()=>({getContext:()=>context(noop)})};
const {createSignalEngine}=await import('@/game/signalEngine');
const art={definition:CHARACTER_SPRITES.oracle,atlas:{id:'actual-oracle-atlas'},hurt:{id:'cached-hurt-atlas'}};

test('real engine chooses Oracle atlas, moves four directions, retains idle; DPR/resize update reach without save mutations',()=>{
  const draws=[],ctx=context((...args)=>{if(args[0]===art.atlas || args[0]===art.hurt){assert.equal(ctx.imageSmoothingEnabled,false);draws.push(args)}}),bounds={width:390,height:700},canvas={getContext:()=>ctx,getBoundingClientRect:()=>bounds};
  const run=createRun(characterById('oracle'),false,123),original=JSON.stringify(run),input={current:{x:0,y:0}},reaches=[];
  const clean=createSignalEngine(canvas,run,input,{hud:noop,flash:noop,finish:noop,reach:v=>reaches.push(v)}, {current:false},art);
  let now=performance.now();const tick=()=>nextFrame(now+=20);
  try{
    tick();assert.equal(draws.at(-1)[2],256);const baseline=reaches.at(-1).weaponRanges[0];
    for(const [x,y,row] of [[0,1,0],[-1,0,64],[1,0,128],[0,-1,192]]){input.current.x=x;input.current.y=y;for(let i=0;i<10;i++)tick();assert.equal(draws.at(-1)[2],row);input.current.x=0;input.current.y=0;tick();assert.equal(draws.at(-1)[1],0);assert.equal(draws.at(-1)[2],row===0?256:row)}
    for(const dpr of [1,2,3]){globalThis.devicePixelRatio=dpr;resizeObserved();assert.equal(reaches.at(-1).weaponRanges[0],baseline)}
    bounds.width=1280;bounds.height=720;resizeObserved();assert.equal(reaches.at(-1).viewport.height,720/(1280/1100));assert(reaches.at(-1).weaponRanges[0]>baseline);
    assert.equal(JSON.stringify(run),original);assert.equal(ctx.imageSmoothingEnabled,true);
  }finally{clean()}
});

test('real engine damage selects cached hurt atlas, while another character never draws Oracle',()=>{
  let hurtDrawn=false;const ctx=context(image=>{if(image===art.hurt)hurtDrawn=true}),bounds={width:390,height:700},canvas={getContext:()=>ctx,getBoundingClientRect:()=>bounds};
  const run=createRun(characterById('oracle'),false,123);run.weapons=[];run.dodge=0;run.hp=run.maxHp=10000;
  const oldRandom=Math.random;Math.random=()=>.5;const input={current:{x:0,y:0}};
  const clean=createSignalEngine(canvas,run,input,{hud:noop,flash:noop,finish:noop},{current:false},art);let now=performance.now();
  try{for(let i=0;i<450 && !hurtDrawn;i++)nextFrame(now+=20);assert(hurtDrawn)}finally{clean();Math.random=oldRandom}
  let oracleDrawn=false;const otherCtx=context(image=>{if(image===art.atlas || image===art.hurt)oracleDrawn=true}),otherCanvas={getContext:()=>otherCtx,getBoundingClientRect:()=>bounds};
  const other=createSignalEngine(otherCanvas,createRun(characterById('rookie'),false,123),input,{hud:noop,flash:noop,finish:noop},{current:false},art);
  try{nextFrame(performance.now()+20);assert.equal(oracleDrawn,false)}finally{other()}
  assert.throws(()=>createSignalEngine(canvas,run,input,{hud:noop,flash:noop,finish:noop}),/must be preloaded/);
});