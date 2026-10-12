// Automated engine harness only. Canvas calls are recorded, not rasterized:
// these tests are runtime/state evidence, NEVER browser visual verification.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(import.meta.url),'../../../..');
const pub=url=>path.join(root,'public',url.replace(/^https?:\/\/[^/]+/,''));
let seq=1,now=-1;export const rafMap=new Map();
globalThis.requestAnimationFrame=cb=>{const id=seq++;rafMap.set(id,cb);return id};
globalThis.cancelAnimationFrame=id=>rafMap.delete(id);
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.devicePixelRatio=2;globalThis.window=globalThis;
globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
export function makeRecordingCtx(){
 const record=[],stack=[];let matrix=[1,0,0,1,0,0];const target={globalAlpha:1,imageSmoothingEnabled:true};
 const ctx=new Proxy(target,{get(t,k){
  if(k in t)return t[k];if(k==='canvas')return null;
  if(k==='measureText')return ()=>({width:10});if(k==='getLineDash')return ()=>[];
  if(String(k).startsWith('create')&&String(k).endsWith('Gradient'))return ()=>({addColorStop(){}});
  return (...a)=>{
   if(k==='save')stack.push({props:{...t},matrix:[...matrix]});
   if(k==='restore'){const saved=stack.pop();if(saved){Object.assign(t,saved.props);matrix=saved.matrix}}
   if(k==='setTransform')matrix=[...a];
   if(k==='drawImage'&&a.length===9){if(!a.slice(1).every(Number.isFinite))throw Error('Nonfinite drawImage rectangle: '+a.slice(1));if(a[3]<=0||a[4]<=0||a[7]<=0||a[8]<=0)throw Error('Empty drawImage rectangle')}
   const entry=[k,...a];entry.meta={alpha:t.globalAlpha,matrix:[...matrix],now};record.push(entry);
  };
 },set(t,k,v){t[k]=v;return true}});return {ctx,record};
}
export function makeCanvas(width,height,rec){return {width:0,height:0,style:{},getContext:()=>rec.ctx,getBoundingClientRect:()=>({left:0,top:0,width,height,right:width,bottom:height}),addEventListener(){},removeEventListener(){}}}
globalThis.document={createElement:tag=>tag==='canvas'?makeCanvas(0,0,makeRecordingCtx()):{style:{},appendChild(){},setAttribute(){},addEventListener(){}},addEventListener(){},querySelectorAll:()=>[],documentElement:{scrollHeight:0}};
class Param{setValueAtTime(){}exponentialRampToValueAtTime(){}}
globalThis.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};this.sampleRate=44100}createGain(){return {gain:new Param(),connect(){}}}createOscillator(){return {type:'',frequency:new Param(),connect(){},start(){},stop(){}}}createBuffer(ch,len){return {getChannelData:()=>new Float32Array(len)}}createBufferSource(){return {buffer:null,connect(){},start(){},stop(){}}}resume(){return Promise.resolve()}};
globalThis.Image=class{
 set src(url){queueMicrotask(()=>{try{const b=readFileSync(pub(url));if(b.slice(1,4).toString()!=='PNG')throw Error('Not PNG '+url);this._src=url;this.naturalWidth=this.width=b.readUInt32BE(16);this.naturalHeight=this.height=b.readUInt32BE(20);this._ok=true;this.onload?.()}catch(e){this._err=e;this.onerror?.(e)}})}
 get src(){return this._src}decode(){return this._ok?Promise.resolve():Promise.reject(this._err)}
};
globalThis.fetch=async url=>{const bytes=readFileSync(pub(url));return {ok:true,status:200,json:async()=>JSON.parse(bytes.toString()),text:async()=>bytes.toString()}};
export function pump(seconds,script){
 if(now<0)now=performance.now();
 for(let f=0;f<seconds*60;f++){now+=1000/60;const callbacks=[...rafMap.values()];rafMap.clear();for(const cb of callbacks)cb(now);if(!rafMap.size)return f;script?.(f)}return -1;
}
const {createRun}=await import('@/game/progression/runRules');
const {characterById}=await import('@/game/data/characters');
export const {preloadCharacterSprite,preloadEnemySprite,preloadStructureSprite}=await import('@/game/art/spriteLoader');
export const {createSignalEngine}=await import('@/game/signalEngine');
export function baseRun(charId='oracle'){
 const run=createRun(characterById(charId),false,'startup-sim','startup-sim-run');run.wave=6;run.maxHp=2000;run.hp=2000;run.armor=4;return run;
}
export async function startEncounter({width,height,charId='oracle',configure=()=>{}}){
 const rec=makeRecordingCtx(),canvas=makeCanvas(width,height,rec),run=baseRun(charId),input={current:{x:0,y:0}},paused={current:false},events=[],samples=[];
 configure(run);
 const arts=await Promise.all([preloadCharacterSprite(charId),preloadEnemySprite('lag'),preloadStructureSprite('bucket'),preloadEnemySprite('squirrel'),preloadEnemySprite('dirty'),preloadStructureSprite('pedestal_turret'),preloadEnemySprite('packet'),preloadEnemySprite('jitter'),preloadEnemySprite('pete')]);
 let finished=null;const cleanup=createSignalEngine(canvas,run,input,{hud(){},reach(){},flash(){},finish:r=>{finished=r},event:e=>events.push(e),inspect:s=>samples.push(s)},paused,...arts);
 return {rec,run,input,paused,events,samples,arts,cleanup,get finished(){return finished},get state(){return samples.at(-1)},until(predicate,max=30){for(let i=0;i<max*60;i++){if(predicate())return; if(pump(1/60)!==-1)throw Error('Engine stopped before condition')}throw Error('Condition did not occur')}};
}