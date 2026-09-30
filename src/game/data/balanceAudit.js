import { ENEMIES } from '@/game/data/combat';
import { TUNING, waveDuration, spawnInterval, spawnDoubleChance } from '@/game/data/tuning';
// Spawn-supply estimates assume every spawn is killed and every ordinary drop collected.
// They are NOT measured playtest kill/collection rates.
export function supplyEstimate(wave){
  const count=Object.keys(ENEMIES).slice(0,Math.min(Object.keys(ENEMIES).length,2+Math.floor(wave/2)));
  const value=count.reduce((sum,id)=>sum+ENEMIES[id].value,0)/count.length;
  const expectedSpawns=Math.ceil(waveDuration(wave)/spawnInterval(wave))*(1+spawnDoubleChance(wave));
  return {wave,expectedSpawns:+expectedSpawns.toFixed(2),oldOrdinaryXp:+(expectedSpawns*value).toFixed(2),newOrdinaryXp:+(expectedSpawns*value*TUNING.xpPickupFactor).toFixed(2)};
}
export function appendSample(profile,run){
  if(!run.lastWaveMetrics)return profile.balanceSamples || [];
  const sample={runId:run.runId,wave:run.wave,...run.lastWaveMetrics};
  return [...(profile.balanceSamples || []).filter(s=>s.runId!==run.runId || s.wave!==run.wave),sample].slice(-30);
}