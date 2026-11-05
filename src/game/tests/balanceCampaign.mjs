import { createSignalEngine,makeCanvas,preloadCharacterSprite,preloadEnemySprite,preloadStructureSprite,pump } from '@/game/tests/engineHarness.mjs';
import { seeded } from '@/game/data/generation';
import { createRun,rebuildStats } from '@/game/progression/runRules';
import { applyStartingKit } from '@/game/progression/startingKit';
import { characterById } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { enterShop,shopTransaction,offerReason } from '@/game/shop/shopRules';
import { hasCombineTarget } from '@/game/items/acquisition';
import { engineerCategory,engineerWeaponCapBlocked } from '@/game/progression/runRules';
import { pickUpgrade,skipUpgrade,upgradeChoices } from '@/game/progression/upgradeRules';
import { waveDuration } from '@/game/data/tuning';
import { rerollCost,healingCost } from '@/game/shop/economy';
export const estimateDps=run=>run.weapons.reduce((sum,w)=>sum+w.damage/w.rate*(w.pattern==='chain'?3:1),0)*run.damage*run.attackSpeed*(1+run.crit)*(1+run.spliceQuality*.004);
const names=['lag','bucket','squirrel','dirty','pedestal_turret','packet','jitter','pete','bend','crosstalk','attenuation','rous'];
const artCache=new Map();
// Each technician's campaign needs that technician's own art pack: the engine
// draws from the character-specific sheets (ISR's seated sheets, the Oracle's
// grid, the Engineer's placeholder Veteran sheet).
async function arts(charId){
  if(artCache.has(charId))return artCache.get(charId);
  const rest=await Promise.all(names.map((id,i)=>[1,4].includes(i)?preloadStructureSprite(id):preloadEnemySprite(id)));
  const art=[await preloadCharacterSprite(charId),...rest];
  artCache.set(charId,art);return art;
}
function context(){const cache={};return new Proxy({imageSmoothingEnabled:false},{get(t,key){return t[key]??(cache[key]??=String(key).includes('Gradient')?()=>({addColorStop(){}}):()=>{})},set(t,key,value){t[key]=value;return true}})}
function intermission(run){
  while(run.pendingLevels>0){const choices=upgradeChoices(run);try{run=pickUpgrade(run,choices[0].id)}catch(error){if(run.character.id==='engineer')run=skipUpgrade(run);else throw error}}
  run=enterShop(run);
  if(run.hp<run.maxHp*.7&&run.signal>=healingCost(run.wave))run=shopTransaction(run,{type:'heal'});
  // Field Engineer growth is combine-driven: with the 4-slot budget full,
  // only same-identity duplicates upgrade him, so his average play rerolls
  // hunting combine targets and buys any that appear — passing the owned
  // same-category tool as the replacement when a cap makes a plain add a swap.
  if(run.character.id==='engineer'){
    for(let attempt=0;attempt<4;attempt++){
      const buyable=run.shop.offers.filter(i=>i&&!offerReason(run,i));
      if(buyable.length){
        const item=buyable[0];let ev={type:'buy',offerId:item.id};
        if(item.baseId && !hasCombineTarget(run,item) && engineerWeaponCapBlocked(run,item)){
          const cat=engineerCategory(item),owned=run.weapons.find(w=>engineerCategory(w)===cat);
          if(owned)ev.replaceId=owned.id;
        }
        try{run=shopTransaction(run,ev)}catch{break}
        continue;
      }
      if(run.signal>=rerollCost(run.wave,run.shop.rerolls)+20){try{run=shopTransaction(run,{type:'reroll'})}catch{break}}else break;
    }
    return {...run,wave:run.wave+1};
  }
  for(let buys=0;buys<2;buys++){
    const legal=run.shop.offers.filter(i=>i&&!i.premium&&!i.deploy&&!i.turret&&!offerReason(run,i)&&(!i.baseId||run.weapons.length<run.character.slots));
    const item=legal.find(i=>i.baseId)||legal[0];if(!item)break;
    try{run=shopTransaction(run,{type:'buy',offerId:item.id})}catch{break}
  }
  if(run.weapons.length<3&&run.signal>=rerollCost(run.wave)*3)run=shopTransaction(run,{type:'reroll'});
  return {...run,wave:run.wave+1};
}
// `starter` runs the opening exactly as the loadout screen plays it: the one
// picked Basic tool is the whole wave-1 kit; from the first intermission on
// it keeps a slot in the average build (displacing one fixture tool so total
// tool count matches the verified baseline).
// Per-character average builds for the balance campaigns: legal under each
// technician's restrictions and slot count, sized like the verified nomad
// fixtures (4 tools moving, 6 stationary). The Field Engineer's 4-slot budget
// caps him at four tools including one deployable sentry.
export const AVERAGE_BUILDS={
  nomad:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','cleaver','splicer']},
  veteran:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','cleaver','splicer']},
  oracle:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','midspan','dowel']},
  don:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','cleaver','splicer']},
  admin:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper']},
  clone:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','cleaver','splicer']},
  isr:{mover:['vfl','otdr','power','stripper'],camper:['vfl','otdr','power','stripper','cleaver','splicer']},
  engineer:{mover:['tray','vfl'],camper:['tray','vfl']}
};
export async function simulateCampaign(seed,moving,lastWave=30,starter=null,charId='nomad'){
  const art=await arts(charId),realRandom=Math.random;Math.random=seeded(seed);const rows=[];
  let run=createRun(characterById(charId),false,seed,`phase2-${seed}-${moving}${starter?`-${starter.baseId}`:''}-${charId}`),deathWave=null;
  const build=starter&&charId==='nomad'?(moving?['vfl','otdr','power','stripper']:['vfl','otdr','power','stripper','cleaver','splicer']):AVERAGE_BUILDS[charId][moving?'mover':'camper'];
  const fixture=build.map((id,i)=>({...WEAPONS[id],baseId:id,id:`fixture-${i}`,mods:[],rarity:'common'}));
  // The Field Engineer's average build fills his 4-slot budget exactly:
  // 1 deployable turret tool (the tray) + 1 ranged + 1 deployable ITEM
  // (the sim Q-places it on cooldown, like the owner-designed play pattern)
  // + the shared fixture-gear passive.
  if(charId==='engineer')run.deployables=[{structure:'turretMount',name:'Turret Mount',icon:'🔩',stacks:1}];
  if(starter)run=applyStartingKit(run,[starter.id]);
  else run.weapons=fixture;
  run=rebuildStats({...run,items:[{id:'fixture-gear',name:'Average-build fixture',mods:[{stat:'maxHp',value:40},{stat:'armor',value:4},{stat:'speed',value:.1},{stat:'damage',value:.1}]}],hp:118});
  try{for(let wave=1;wave<=lastWave;wave++){
    let hud=null,finished=null,peak=0,cones=0;const input={current:{x:0,y:0}},canvas=makeCanvas(1100,800,{ctx:context()});
    rows.push({wave,dps:+estimateDps(run).toFixed(2),level:run.level,xp:run.xp,signal:run.signal,hp:run.hp,weapons:run.weapons.length});
    const cleanup=createSignalEngine(canvas,run,input,{simulation:true,hud:h=>{hud=h},flash(){},finish:r=>{finished=r},event:e=>{if(e.type==='enemySpawn')peak=Math.max(peak,e.active);if(e.type==='campCone')cones++}},undefined,...art);
    try{pump(waveDuration(wave)*1.4+8,f=>{
      if(!hud)return;
      if(moving){const angle=f/60*1.4,tx=550+Math.cos(angle)*230,ty=400+Math.sin(angle)*180;input.current.x=tx-hud.position.x;input.current.y=ty-hud.position.y}
      if(hud.hp<hud.maxHp*.65&&hud.specialCooldown<=0)input.current.special=true;
      if(run.character.id==='engineer'&&hud.deploy){if(f%30===0)input.current.deploy=true;if(f%420===300)input.current.cycle=true}
    })}finally{cleanup()}
    if(!finished)throw Error(`Wave ${wave} did not finish`);
    rows.at(-1).kills=finished.lastWaveMetrics.kills;rows.at(-1).peak=peak;rows.at(-1).campCones=cones;rows.at(-1).earned=finished.lastWaveMetrics.earnedSignal;
    run=finished;if(!run.won){deathWave=wave;break}
    if(starter&&wave===1)run=rebuildStats({...run,weapons:[run.weapons[0],...fixture.slice(0,(moving?4:6)-1)]});
    run=intermission(run);
  }}finally{Math.random=realRandom}
  return {seed,moving,deathWave,reached:rows.at(-1)?.wave||0,level:run.level,rows};
}