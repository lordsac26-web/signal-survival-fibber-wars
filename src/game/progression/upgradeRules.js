import { createGenerator } from '@/game/data/generation';
import { acquireItem } from '@/game/items/acquisition';
import { levelRerollCost } from '@/game/shop/economy';
import { rebuildStats } from '@/game/progression/runRules';

// Level-up choices are seeded per level; levelRerolls shifts the seed so a
// reroll replaces ALL THREE options. At levelRerolls=0 the seed is unchanged
// from the original formula, so existing runs keep their offered set.
export function upgradeChoices(run) {
  const g = createGenerator(run.seed + run.level * 3571 + (run.levelRerolls || 0) * 104729 + 17, run.level, run.character.id === 'clone' ? 'rare' : null);
  return [g.passive(run.luck), g.passive(run.luck), g.passive(run.luck)];
}
export function pickUpgrade(run, itemId) {
  const item = upgradeChoices(run).find(i => i.id === itemId);
  if (!item || !(run.pendingLevels > 0)) throw new Error('Level-up choice has changed');
  const next = {...run, level: run.level + 1, pendingLevels: run.pendingLevels - 1, levelRerolls: 0};
  try {
    return acquireItem(next, {...item, levelUpgrade: true});
  } catch (error) {
    // A full Field Engineer kit (4 total items) cannot hold another passive,
    // so the upgrade applies as a bare stat mod instead of an inventory
    // item: his levels never dead-end, they just take no item slot.
    if (run.character?.id === 'engineer' && /exactly 4 items total/.test(error.message)) {
      return rebuildStats({...next, statMods: [...(next.statMods || []), {id: item.id, mods: item.mods, special: item.special, specialPower: item.specialPower}]});
    }
    throw error;
  }
}
// Declining keeps the level and moves on instead of dead-ending the screen.
export function skipUpgrade(run) {
  if (!(run.pendingLevels > 0)) throw new Error('No level-up pending');
  return {...run, pendingLevels: run.pendingLevels - 1, levelRerolls: 0};
}
// Reroll costs roughly DOUBLE the item-reroll model (same growth curve,
// doubled) at the current wave, paid from spendable Signal. The replacement
// set must not immediately re-offer any of the current three.
export function rerollUpgradeChoices(run) {
  const prevIds = new Set(upgradeChoices(run).map(i => i.id));
  const cost = levelRerollCost(run.wave, run.levelRerolls || 0);
  if ((run.signal || 0) < cost) throw new Error('Not enough spendable Signal');
  let rerolls = (run.levelRerolls || 0) + 1, choices = upgradeChoices({...run, levelRerolls: rerolls});
  while (rerolls - (run.levelRerolls || 0) < 8 && choices.some(i => prevIds.has(i.id))) {
    rerolls++; choices = upgradeChoices({...run, levelRerolls: rerolls});
  }
  return {...run, signal: run.signal - cost, levelRerolls: rerolls};
}