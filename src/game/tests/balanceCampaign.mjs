import { createSignalEngine,makeCanvas,preloadCharacterSprite,preloadEnemySprite,preloadStructureSprite,pump } from '@/game/tests/engineHarness.mjs';
import { seeded } from '@/game/data/generation';
import { createRun,rebuildStats } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { enterShop,shopTransaction,offerReason } from '@/game/shop/shopRules';
import { pickUpgrade,upgradeChoices } from '@/game/progression/upgradeRules';
import { waveDuration } from '@/game/data/tuning';
import { rerollCost,healingCost } from '@/game/shop/economy';
export const estimateDps=run=>run.weapons.reduce((sum,w)=>sum+w.damage/w.rate*(w.pattern==='chain'?3:1),0)*run.damage*run.attackSpeed*(1+run.crit)*(1+run.spliceQuality*.004);
const names=['nomad','lag','bucket','squirrel','dirty','pedestal_turret','packet','jitter','pete','bend','crosstalk','attenuation','rous'];
let cached;
async function arts(){return cached??=await Promise.all(names.map((id,i)=>i===0?preloadCharacterSprite(id):[2,5].includes(i)?preloadStructureSprite(id):preloadEnemySprite(id)))}
function context(){const cache={};return new Proxy({imageSmoothingEnabled:false},{get(t,key){return t[key]??(cache[key]??=String(key).includes('Gradient')?()=>({addColorStop(){}}):()=>{})},set(t,key,value){t[key]=value;return true}})}
function intermission(run){
  while(run.pendingLevels>0){const choices=upgradeChoices(run);run=pickUpgrade(run,choices[0].id)}
  run=enterShop(run);
  if(run.hp<run.maxHp*.7&&run.signal>=healingCost(run.wave))run=shopTransaction(run,{type:'heal'});
  for(let buys=0;buys<2;buys++){
    const legal=run.shop.offers.filter(i=>i&&!i.premium&&!i.deploy&&!i.turret&&!offerReason(run,i)&&(!i.baseId||run.weapons.length<run.character.slots));
    const item=legal.find(i=>i.baseId)||legal[0];if(!item)break;
    run=shopTransaction(run,{type:'buy',offerId:item.id});
  }
  if(run.weapons.length<3&&run.signal>=rerollCost(run.wave)*3)run=shopTransaction(run,{type:'reroll'});
  return {...run,wave:run.wave+1};
}
export async function simulateCampaign(seed,moving,lastWave=30){
  const art=await arts(),realRandom=Math.random;Math.random=seeded(seed);const rows=[];
  let run=createRun(characterById('nomad'),false,seed,`phase2-${seed}-${moving}`),deathWave=null;
  run.weapons=(moving?['vfl','otdr','power','stripper']:['vfl','otdr','power','stripper','cleaver','splicer']).map((id,i)=>({...WEAPONS[id],baseId:id,id:`fixture-${i}`,mods:[],rarity:'common'}));
  run=rebuildStats({...run,items:[{id:'fixture-gear',name:'Average-build fixture',mods:[{stat:'maxHp',value:40},{stat:'armor',value:4},{stat:'speed',value:.1},{stat:'damage',value:.1}]}],hp:118});
  try{for(let wave=1;wave<=lastWave;wave++){
    let hud=null,finished=null,peak=0,cones=0;const input={current:{x:0,y:0}},canvas=makeCanvas(1100,800,{ctx:context()});
    rows.push({wave,dps:+estimateDps(run).toFixed(2),level:run.level,xp:run.xp,signal:run.signal,hp:run.hp,weapons:run.weapons.length});
    const cleanup=createSignalEngine(canvas,run,input,{simulation:true,hud:h=>{hud=h},flash(){},finish:r=>{finished=r},event:e=>{if(e.type==='enemySpawn')peak=Math.max(peak,e.active);if(e.type==='campCone')cones++}},undefined,...art);
    try{pump(waveDuration(wave)*1.4+8,f=>{
      if(!hud)return;
      if(moving){const angle=f/60*1.4,tx=550+Math.cos(angle)*230,ty=400+Math.sin(angle)*180;input.current.x=tx-hud.position.x;input.current.y=ty-hud.position.y}
      if(hud.hp<hud.maxHp*.65&&hud.specialCooldown<=0)input.current.special=true;
    })}finally{cleanup()}
    if(!finished)throw Error(`Wave ${wave} did not finish`);
    rows.at(-1).kills=finished.lastWaveMetrics.kills;rows.at(-1).peak=peak;rows.at(-1).campCones=cones;rows.at(-1).earned=finished.lastWaveMetrics.earnedSignal;
    run=finished;if(!run.won){deathWave=wave;break}run=intermission(run);
  }}finally{Math.random=realRandom}
  return {seed,moving,deathWave,reached:rows.at(-1)?.wave||0,level:run.level,rows};
}