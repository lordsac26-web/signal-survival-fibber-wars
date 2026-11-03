import { createGenerator } from '@/game/data/generation';
import { acquireItem } from '@/game/items/acquisition';
export function upgradeChoices(run){
  const g=createGenerator(run.seed+run.level*3571+17,run.level,run.character.id==='clone'?'rare':null);
  return [g.passive(run.luck),g.passive(run.luck),g.passive(run.luck)];
}
export function pickUpgrade(run,itemId){
  const item=upgradeChoices(run).find(i=>i.id===itemId);
  if(!item || !(run.pendingLevels>0))throw new Error('Level-up choice has changed');
  return acquireItem({...run,level:run.level+1,pendingLevels:run.pendingLevels-1},{...item,levelUpgrade:true});
}