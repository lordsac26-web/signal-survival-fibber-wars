import { addToInventory, combineOwned } from '@/game/items/combining';
import { canCombine } from '@/game/items/tiers';
import { allowedWeapon, legalLoadout, normalizeWeapon, rebuildStats, itemBudgetUsed, itemBudgetCap } from '@/game/progression/runRules';
export const hasCombineTarget = (run,item) => (run[item.baseId?'weapons':item.deploy?'deployables':'items'] || []).some(other=>canCombine(other,item));
export function acquireItem(run,item,{replaceId}={}){
  if(item.premium)throw new Error('Premium cards must target an owned weapon');
  if(item.baseId && !allowedWeapon(run.character,item))throw new Error('Forbidden weapon for this technician');
  const merging=hasCombineTarget(run,item);
  let next=run;
  if(item.baseId && replaceId && !merging){
    if(!run.weapons.some(w=>w.id===replaceId))throw new Error('Replacement tool missing');
    next={...run,weapons:run.weapons.filter(w=>w.id!==replaceId)};
  }
  // Field Engineer: his 4-slot budget spans tools, passives and deployables.
  // A same-tier combine or a straight tool replacement keeps the total flat.
  if(run.character.id==='engineer' && !merging && !(item.baseId && replaceId) && itemBudgetUsed(run)>=itemBudgetCap(run))
    throw new Error('Field Engineer carries exactly 4 items total — sell or combine first');
  // One deployable turret tool per technician; the Field Engineer is the
  // deployables specialist and may field up to 4 (budget-capped) instead.
  if(item.baseId && item.pattern==='turret' && run.character.id!=='engineer' && !merging && run.weapons.some(w=>w.pattern==='turret'))throw new Error('Only one deployable turret tool per technician — combine a matching tier or upgrade the one you own.');
  next=addToInventory(next,item.baseId?normalizeWeapon(item):item);
  if(item.baseId && !legalLoadout(run.character,next.weapons))throw new Error('Choose a compatible tool to replace; slot or family cap reached');
  return rebuildStats(next);
}
export const manualCombine = (run,itemId) => rebuildStats(combineOwned(run,itemId));