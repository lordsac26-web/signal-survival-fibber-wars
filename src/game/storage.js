import { base44 } from '@/api/base44Client';
import { freshProfile, migrateProfile, completeRun } from '@/game/progression/profileModel';
import { normalizeRun } from '@/game/progression/runRules';
import { appendSample } from '@/game/data/balanceAudit';
const LEGACY='signal-survival-save-v1', AUDIO='signal-survival-audio-v1', CLAIM='signal-survival-legacy-owner';
const key=id=>`signal-survival-v4:${id}`;
const listeners=new Set();let epoch=0,inFlight=false;
let state={ownerId:null,profile:freshProfile(),status:'loading',revision:0,dirty:false,commitId:null,conflict:null,error:'',legacyPending:false};
const emit=patch=>{state={...state,...patch};listeners.forEach(fn=>fn())};
export const subscribeSave=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export const getSaveState=()=>state;
export const loadSave=()=>state.profile;
function cache(){localStorage.setItem(key(state.ownerId),JSON.stringify({ownerId:state.ownerId,profile:state.profile,revision:state.revision,dirty:state.dirty,commitId:state.commitId,sentCommitId:state.sentCommitId}))}
function readable(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}}
export async function bindProfile(ownerId){
  const token=++epoch,stored=readable(key(ownerId));
  const valid=stored?.ownerId===ownerId;
  emit({ownerId,profile:migrateProfile(valid?stored.profile:{}),revision:valid?stored.revision:0,dirty:valid?stored.dirty:false,commitId:valid?stored.commitId:null,sentCommitId:valid?stored.sentCommitId:null,status:'loading',conflict:null,error:'',legacyPending:!!readable(LEGACY)&&!localStorage.getItem(CLAIM)});
  try{
    const {data:cloud}=await base44.functions.invoke('playerProfile',{action:'load'});
    if(token!==epoch)return;
    if(cloud.data?.ownerId && cloud.data.ownerId!==ownerId)throw new Error('Cloud profile owner mismatch');
    if(state.dirty && cloud.commitId===state.commitId)emit({revision:cloud.revision,dirty:false});
    else if(state.dirty && cloud.commitId && cloud.commitId===state.sentCommitId)emit({revision:cloud.revision});
    if(state.dirty && cloud.revision!==state.revision){emit({status:'conflict',conflict:{profile:migrateProfile(cloud.data || {}),revision:cloud.revision}});return}
    if(!state.dirty)emit({profile:migrateProfile(cloud.data || (valid?stored.profile:{})),revision:cloud.revision});
    emit({status:state.dirty?'saving':'saved'});cache();
    if(cloud.data?.version!==4 && !state.dirty)updateProfile(p=>p);
    if(state.dirty)await retrySave();
  }catch(error){if(token===epoch)emit({status:navigator.onLine?'error':'offline',error:error.message})}
}
export function unbindProfile(ownerId){if(state.ownerId===ownerId){epoch++;emit({ownerId:null,profile:freshProfile(),status:'loading',dirty:false,conflict:null})}}
export function updateProfile(update){
  if(!state.ownerId || state.status==='loading' || state.conflict)throw new Error('Resolve or load your profile first');
  const profile=migrateProfile(typeof update==='function'?update(state.profile):update);profile.ownerId=state.ownerId;profile.updatedAt=Date.now();
  emit({profile,dirty:true,commitId:crypto.randomUUID(),error:'',status:navigator.onLine?'saving':'offline'});
  try{cache()}catch(error){emit({status:'error',error:`Local save failed: ${error.message}`});return}
  void retrySave();
}
export async function retrySave(){
  if(inFlight || !state.ownerId || state.conflict)return;
  if(!state.dirty){await bindProfile(state.ownerId);return}
  if(!navigator.onLine){emit({status:'offline'});return}
  inFlight=true;const token=epoch,ownerId=state.ownerId,commitId=state.commitId;
  try{
    emit({status:'saving',sentCommitId:commitId});cache();
    const {data:res}=await base44.functions.invoke('playerProfile',{action:'save',data:state.profile,baseRevision:state.revision,commitId});
    if(token!==epoch || ownerId!==state.ownerId)return;
    if(res.conflict){emit({status:'conflict',conflict:{profile:migrateProfile(res.data),revision:res.revision}});return}
    emit({revision:res.revision,dirty:state.commitId!==commitId,status:state.commitId===commitId?'saved':'saving'});cache();
  }catch(error){if(token===epoch)emit({status:navigator.onLine?'error':'offline',error:error.message})}
  finally{inFlight=false;if(state.ownerId && state.dirty && state.status==='saving')void retrySave()}
}
export function resolveConflict(choice){
  const remote=state.conflict;if(!remote)return;
  emit({conflict:null,revision:remote.revision,profile:choice==='cloud'?remote.profile:state.profile,dirty:choice!=='cloud',status:choice==='cloud'?'saved':'saving',commitId:crypto.randomUUID()});
  cache();if(choice!=='cloud')void retrySave();
}
export function importLegacy(){
  if(localStorage.getItem(CLAIM))return;
  const legacy=readable(LEGACY);if(!legacy)return;
  updateProfile({...migrateProfile(legacy),settings:readable(AUDIO) || state.profile.settings});
  localStorage.setItem(CLAIM,state.ownerId);emit({legacyPending:false});
}
export function declineLegacy(){localStorage.setItem(CLAIM,'declined');emit({legacyPending:false})}
export function saveCheckpoint(run,phase){
  const validated=normalizeRun(run);if(!validated)throw new Error('Invalid solo checkpoint');
  validated.checkpointId=`${validated.runId}:${validated.wave}:${phase}:${validated.shop?.sequence || 0}:${validated.buys}:${validated.level}`;
  updateProfile(p=>({...p,checkpoint:{checkpointId:validated.checkpointId,phase,run:validated},balanceSamples:appendSample(p,validated),selectedCharacter:validated.character.id,selectedLoadouts:{...p.selectedLoadouts,[validated.character.id]:!!validated.useAlt},discoveredTools:[...new Set([...p.discoveredTools,...validated.weapons.map(w=>w.baseId)])]}));
  return validated;
}
export function recordRun(run){const result=completeRun(state.profile,run);updateProfile(result.save);return result}
export function loadSettings(){return state.ownerId?state.profile.settings:{muted:false,volume:.55,...readable(AUDIO)}}
export function saveSettings(next){if(state.ownerId && state.status!=='loading')updateProfile(p=>({...p,settings:next}));else localStorage.setItem(AUDIO,JSON.stringify(next))}
window.addEventListener('online',()=>{if(state.ownerId)void retrySave()});
window.addEventListener('storage',event=>{if(state.ownerId && event.key===key(state.ownerId)){const other=readable(event.key);if(other?.commitId!==state.commitId)emit({status:'conflict',conflict:{profile:migrateProfile(other.profile),revision:other.revision},error:'Another tab changed this profile; choose which copy to keep.'})}});