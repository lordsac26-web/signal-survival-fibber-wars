import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateCampaign,estimateDps } from '@/game/tests/balanceCampaign.mjs';
import { createRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { scaledEnemy } from '@/game/combat/difficulty';
import { ENEMIES,WEAPONS } from '@/game/data/combat';
import { maxActiveEnemies,signalForLevel } from '@/game/data/tuning';
const count=Number(process.env.PHASE2_SEEDS||12),seeds=Array.from({length:count},(_,i)=>7919*(i+1)+20261103);
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=sorted.length/2;return sorted.length%2?sorted[Math.floor(mid)]:(sorted[mid-1]+sorted[mid])/2};
test('Phase 2 seeded real-engine campaigns: stationary six-tool versus moving average four-tool build, equal gear and legal purchases',{timeout:240000},async()=>{
 const campers=[],movers=[];
 for(const seed of seeds){campers.push(await simulateCampaign(seed,false));movers.push(await simulateCampaign(seed,true))}
 const medianDeath=median(campers.map(r=>r.deathWave??31)),reached20=movers.filter(r=>r.reached>=20).length;
 console.log('PHASE2_CAMPAIGNS',JSON.stringify({seeds,camperDeaths:campers.map(r=>r.deathWave),medianDeath,moverDeaths:movers.map(r=>r.deathWave),reached20,total:seeds.length,levelsAt27:movers.filter(r=>r.reached>=27).map(r=>r.rows[26].level)}));
 const table=Array.from({length:30},(_,index)=>{const wave=index+1,rs=movers.flatMap(r=>r.rows.filter(row=>row.wave===wave)),enemy=scaledEnemy(ENEMIES.lag,wave),dps=rs.length?median(rs.map(r=>r.dps)):null,level=rs.length?median(rs.map(r=>r.level)):null;return {wave,hp:+enemy.hp.toFixed(2),contact:+enemy.damage.toFixed(2),cap:maxActiveEnemies(wave),playerDps:dps,idealTtk:dps?+(enemy.hp/dps).toFixed(3):null,signalPerLag:enemy.value,medianLevel:level,nextThreshold:level!==null?signalForLevel(Math.floor(level)):null,seedsPresent:rs.length,kills:rs.length?median(rs.map(r=>r.kills)):null}});
 console.log('PHASE2_WAVE_TABLE',JSON.stringify(table));
 assert(campers.every(r=>r.rows.every(row=>row.peak<=maxActiveEnemies(row.wave))));
 assert(movers.every(r=>r.rows.every(row=>row.peak<=maxActiveEnemies(row.wave))));
 assert(medianDeath<=8,`Camper median ${medianDeath}, target <=8`);
 assert(reached20/seeds.length>=.5,`Only ${reached20}/${seeds.length} movers reached wave 20`);
});
test('Phase 2 explicit starter and mid-build single-target ideal TTK estimates',()=>{
 const starter=createRun(characterById('nomad'),false,1,'ttk');
 const mid={...starter,weapons:['vfl','power','otdr','stripper'].map(id=>({...WEAPONS[id],baseId:id}))};
 const early=scaledEnemy(ENEMIES.lag,1).hp/estimateDps(starter),late=scaledEnemy(ENEMIES.lag,20).hp/estimateDps(mid);
 console.log('PHASE2_TTK_ESTIMATES',JSON.stringify({method:'HP / theoretical sustained single-target DPS, not a browser measurement',starter:{wave:1,dps:estimateDps(starter),ttk:early},mid:{wave:20,dps:estimateDps(mid),ttk:late}}));
 assert(early>=1.5&&early<=2.5);assert(late>=2.5&&late<=5);
});