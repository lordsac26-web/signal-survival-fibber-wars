import { wavePriceMultiplier } from '@/game/shop/economy';
import { tierId, tierPrice } from '@/game/items/tiers';
import { rebuildStats } from '@/game/progression/runRules';
import { TUNING } from '@/game/data/tuning';

// Sell window (playtest): sell price is 50% of the item's CURRENT shop value
// (tier price multiplier x current wave inflation), floored to 1 — a starting
// Basic tool is never sold for free. Overclocked items are combine-only and
// never sold, so they have no sell price.
export function sellValue(item, wave) {
  if (!item || item.premium || tierId(item.rarity) === 'overclocked') return null;
  const base = item.baseCost ?? (item.deploy ? TUNING.deployBasePrice : item.baseId ? 27 : 24);
  return Math.max(1, Math.floor(tierPrice(base, item.rarity) * wavePriceMultiplier(wave) * .5));
}

export function sellItem(run, itemId) {
  const item = [...run.weapons, ...run.items, ...(run.deployables || [])].find(i => i.id === itemId);
  if (!item) throw new Error('That item is no longer in the kit');
  const value = sellValue(item, run.wave);
  if (value == null) throw new Error('This item cannot be sold');
  if (run.weapons.some(w => w.id === itemId) && run.weapons.length <= 1) throw new Error('Cannot sell your last remaining tool');
  const next = {
    ...run,
    weapons: run.weapons.filter(w => w.id !== itemId),
    items: run.items.filter(w => w.id !== itemId),
    deployables: (run.deployables || []).filter(d => d.id !== itemId),
    // The refund is spendable Signal only — selling is a conversion, not
    // earnings, so career bestSignal never counts it.
    signal: run.signal + value
  };
  return rebuildStats(next);
}