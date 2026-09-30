import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile } from '@/game/progression/profileModel';
const disk=new Map(),remote=new Map(),calls=[];
let loseResponse=false;
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.window={addEventListener(){}};
globalThis.localStorage={getItem:key=>disk.get(key)||null,setItem:(key,value)=>disk.set(key,value)};
const envelope=(id,runs)=>({revision:1,data:{...freshProfile(),ownerId:id,runs},commitId:`initial-${id}`});
remote.set('A',envelope('A',7));remote.set('B',envelope('B',99));
let active='A';
globalThis.__profileClient={functions:{async invoke(name,params){
  if(!navigator.onLine)throw new Error('offline');
  const prev=remote.get(active);if(params.action==='load')return {data:structuredClone(prev)};
  calls.push({owner:active,commitId:params.commitId});
  if(prev.commitId===params.commitId)return {data:structuredClone(prev)};
  if(prev.revision!==params.baseRevision)return {data:{...structuredClone(prev),conflict:true}};
  const next={data:structuredClone(params.data),revision:prev.revision+1,commitId:params.commitId};remote.set(active,next);
  if(loseResponse){loseResponse=false;throw new Error('response lost after write')}
  return {data:structuredClone(next)};
}}};
const store=await import('@/game/storage');
const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
const bind=async id=>{active=id;await store.bindProfile(id);await settle()};
test('account-scoped cache never leaks a previous account or unclaimed legacy career',async()=>{
  disk.set('signal-survival-save-v1',JSON.stringify({version:3,runs:44,totalKills:444}));
  await bind('A');assert.equal(store.loadSave().runs,7);assert(store.getSaveState().legacyPending);
  store.updateProfile(p=>({...p,runs:8}));await settle();
  await bind('B');assert.equal(store.loadSave().runs,99);assert.equal(store.loadSave().ownerId,'B');
  assert.equal(JSON.parse(disk.get('signal-survival-v4:A')).profile.runs,8);
  assert.equal(JSON.parse(disk.get('signal-survival-v4:B')).profile.runs,99);
});
test('offline outboxes are independent and upload only the active owner snapshot',async()=>{
  await bind('A');navigator.onLine=false;store.updateProfile(p=>({...p,runs:9}));assert.equal(store.getSaveState().status,'offline');
  await bind('B');assert.equal(store.loadSave().runs,99);store.updateProfile(p=>({...p,runs:100}));
  await bind('A');assert.equal(store.loadSave().runs,9);navigator.onLine=true;await store.retrySave();await settle();
  assert.equal(remote.get('A').data.runs,9);assert.equal(remote.get('B').data.runs,99);assert.equal(store.getSaveState().status,'saved');
});
test('lost-response retry uses stable commit id without a second revision or reward',async()=>{
  await bind('A');const revision=remote.get('A').revision;loseResponse=true;store.updateProfile(p=>({...p,runs:10}));await settle();
  assert.equal(store.getSaveState().status,'error');const id=store.getSaveState().commitId;await store.retrySave();await settle();
  assert.equal(store.getSaveState().status,'saved');assert.equal(remote.get('A').revision,revision+1);assert.equal(remote.get('A').data.runs,10);assert.equal(calls.at(-1).commitId,id);assert.equal(calls.at(-2).commitId,id);
});
test('cloud conflicts require explicit choice; legacy import is claimed once, not merged',async()=>{
  await bind('A');const cloud=remote.get('A');remote.set('A',{...cloud,revision:cloud.revision+1,commitId:'different-device',data:{...cloud.data,runs:88}});
  store.updateProfile(p=>({...p,runs:11}));await settle();assert.equal(store.getSaveState().status,'conflict');assert.equal(store.loadSave().runs,11);assert.equal(store.getSaveState().conflict.profile.runs,88);
  store.resolveConflict('cloud');assert.equal(store.loadSave().runs,88);store.importLegacy();await settle();assert.equal(store.loadSave().runs,44);assert.equal(disk.get('signal-survival-legacy-owner'),'A');
  await bind('B');assert.equal(store.loadSave().runs,100);assert(!store.getSaveState().legacyPending);assert.equal(remote.get('B').data.runs,100);
});