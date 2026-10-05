import { CHARACTERS } from '@/game/data/characters';
import { CHALLENGES, ACHIEVEMENTS, LOADOUTS, unlockMet } from '@/game/data/unlocks';
import { normalizeRun } from '@/game/progression/runRules';
import { appendSample } from '@/game/data/balanceAudit';
import { bossWave } from '@/game/data/bosses';
export const SAVE_VERSION = 4;
export const freshProfile = () => ({version:SAVE_VERSION,highWave:0,highKills:0,runs:0,totalKills:0,deaths:0,bestSignal:0,healPeak:0,meleePeak:0,toolPeak:0,noBuyWave:0,highWaveByCharacter:{},killsByType:{},squirrelDefeated:false,unlocked:CHARACTERS.filter(c=>!c.unlock).map(c=>c.id),achievements:[],challenges:[],loadouts:[],discoveredTools:[],completedRunIds:[],summaries:[],checkpoint:null,selectedCharacter:'rookie',selectedLoadouts:{},settings:{muted:false,volume:.55},balanceSamples:[],updatedAt:0});
const donId = id => ['dispatch','dave','dispatch_dave'].includes(id) ? 'don' : id;
export function migrateProfile(raw = {}) {
  const p={...freshProfile(),...raw,version:SAVE_VERSION};
  p.squirrelDefeated=!!p.squirrelDefeated;
  p.unlocked=CHARACTERS.filter(c=>unlockMet(p,c)).map(c=>c.id);
  p.settings={muted:false,volume:.55,...raw.settings};p.settings.muted=!!p.settings.muted;p.settings.volume=Math.max(0,Math.min(1,Number(p.settings.volume) || 0));
  p.selectedCharacter=donId(p.selectedCharacter);p.selectedLoadouts=Object.fromEntries(Object.entries(p.selectedLoadouts || {}).map(([id,v])=>[donId(id),v]));
  p.highWaveByCharacter={...p.highWaveByCharacter,don:Math.max(p.highWaveByCharacter?.don || 0,p.highWaveByCharacter?.dispatch || 0,p.highWaveByCharacter?.dave || 0,p.highWaveByCharacter?.dispatch_dave || 0)};
  for(const id of ['dispatch','dave','dispatch_dave']) delete p.highWaveByCharacter[id];
  p.challenges=[...new Set([...(p.challenges || []),...((raw.version || 1)<4?(raw.unlocked || []).filter(id=>CHALLENGES.some(c=>c.id===id)):[])])];
  p.loadouts=(p.loadouts || []).map(id=>id.replace(/^(dispatch|dave|dispatch_dave):/,'don:'));
  p.summaries=(p.summaries || []).map(s=>({...s,characterId:donId(s.characterId),characterName:s.characterName==='Dispatch Dave'?'Dispatch Don':s.characterName}));
  if(p.checkpoint) {const run=normalizeRun(p.checkpoint.run);p.checkpoint=run && ['ready','shop','upgrade'].includes(p.checkpoint.phase)?{...p.checkpoint,run}:null}
  return p;
}
export function completeRun(profile,run) {
  const p=migrateProfile(profile);
  if(p.completedRunIds.includes(run.runId)) return {save:p,newUnlocks:[]};
  const next={...p,balanceSamples:appendSample(p,run),checkpoint:null,runs:p.runs+1,totalKills:p.totalKills+run.kills,deaths:p.deaths+(run.hp<=0?1:0),highWave:Math.max(p.highWave,run.wave),highKills:Math.max(p.highKills,run.kills),bestSignal:Math.max(p.bestSignal,run.earnedSignal || run.signal || 0),healPeak:Math.max(p.healPeak,run.healed || 0),meleePeak:Math.max(p.meleePeak,run.meleePeak || 0,run.weapons.filter(w=>w.slotType==='melee').length),toolPeak:Math.max(p.toolPeak,run.weapons.length),noBuyWave:run.buys?p.noBuyWave:Math.max(p.noBuyWave,run.wave),highWaveByCharacter:{...p.highWaveByCharacter,[run.character.id]:Math.max(p.highWaveByCharacter[run.character.id] || 0,run.wave)},killsByType:{...p.killsByType},completedRunIds:[...p.completedRunIds,run.runId],summaries:[{runId:run.runId,characterId:run.character.id,characterName:run.character.name,wave:run.wave,kills:run.kills,earnedSignal:run.earnedSignal || 0,endedAt:Date.now()},...p.summaries].slice(0,50)};
  for(const [kind,n] of Object.entries(run.killsByType || {})) next.killsByType[kind]=(next.killsByType[kind] || 0)+n;
  // Clearing a boss wave (20, 30, …) with a surviving truck marks the Squirrel
  // as defeated for the ISR's unlock; gated technicians unlock on the same
  // completion that meets their milestone.
  if(run.won && bossWave(run.wave)) next.squirrelDefeated=true;
  const newUnlocks=[];
  for(const [field,list,type] of [['challenges',CHALLENGES,'challenge'],['achievements',ACHIEVEMENTS,'achievement'],['loadouts',LOADOUTS,'toolkit']]) {
    next[field]=[...next[field]];
    for(const reward of list) if(!next[field].includes(reward.id) && reward.check(next,run)){next[field].push(reward.id);newUnlocks.push({type,label:reward.name || `${reward.charName} — ${reward.tools}`})}
  }
  for(const c of CHARACTERS) if(c.unlock && !next.unlocked.includes(c.id) && unlockMet(next,c)){next.unlocked=[...next.unlocked,c.id];newUnlocks.push({type:'technician',label:c.name})}
  return {save:next,newUnlocks};
}