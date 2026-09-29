// Central dictionary of every player-facing stat: what it's called, how it's
// formatted, what it actually does in signalEngine.js, and how to render shop
// deltas. Screens (stats panel, shop, level-up) all read from here so a stat
// can never drift between "what the card says" and "what the engine does".

export const STAT_INFO = {
  maxHp: { label: 'Jacket Integrity', kind: 'flat', desc: 'Maximum HP. Hits reduce it; at 0 you are truck-rolled.' },
  regen: { label: 'HP Regen', kind: 'flat', desc: 'HP restored every second, automatically.' },
  lifeSteal: { label: 'Signal Recovery', kind: 'percent', desc: 'Percent of all damage dealt returned to you as HP.' },
  damage: { label: 'Damage', kind: 'multiplier', desc: 'Multiplies every tool\'s base damage.' },
  attackSpeed: { label: 'Attack Speed', kind: 'multiplier', desc: 'Tools fire this much faster (shorter cooldowns).' },
  crit: { label: 'Crit Chance', kind: 'percent', desc: 'Chance for a hit to deal double damage.' },
  range: { label: 'Range', kind: 'multiplier', desc: 'Extends projectile travel and melee reach.' },
  knockback: { label: 'Knockback', kind: 'flat', desc: 'Critical hits shove impairments backward.' },
  pierce: { label: 'Pierce', kind: 'flat', desc: 'Projectiles pass through this many extra impairments.' },
  armor: { label: 'Jacket Protection', kind: 'flat', desc: 'Flat reduction of enemy contact damage.' },
  dodge: { label: 'Dodge', kind: 'percent', desc: 'Chance to take zero contact damage (capped at 60%).' },
  speed: { label: 'Move Speed', kind: 'velocity', desc: 'Movement in map units per second; gear bonuses increase it by a percentage.' },
  harvesting: { label: 'Harvesting', kind: 'flat', desc: 'Bonus Signal granted at the end of each wave.' },
  engineering: { label: 'Engineering', kind: 'flat', desc: 'Turret-pattern tools and deployable specials deal bonus damage.' },
  cleanliness: { label: 'Cleanliness', kind: 'flat', desc: '+1% damage per point against dirty impairments (blobs, beasts).' },
  signalStrength: { label: 'Signal Integrity', kind: 'flat', desc: 'Each point blocks a little impairment damage (max 40%).' },
  spliceQuality: { label: 'Splice Quality', kind: 'flat', desc: '+0.4% damage per point. Pure craftsmanship.' },
  luck: { label: 'Luck', kind: 'flat', desc: 'Better rarity odds in the shop and bonus Signal drops from kills.' },
  instakill: { label: 'Instakill Chance', kind: 'percent', desc: 'Chance any hit fails inspection instantly. Grandfathered in.' }
};

export function formatStat(kind, v = 0) {
  if (kind === 'multiplier' || kind === 'percent') return `${Math.round(v * 100)}%`;
  if (kind === 'velocity') return `${Math.round(v)} units/s`;
  return Math.round(v * 10) / 10;
}

// Breakdown of "base character stat + what your tools/items added" for the
// in-run stats panel. Multiplier stats store the item contribution as an added
// fraction (damage/range/attack speed add these fractions, while movement
// speed compounds them), so the sum is a bonus percentage for those stats;
// flat/percent stats are plain additive sums.
export function statBreakdown(run, key) {
  const info = STAT_INFO[key] || { kind: 'flat' };
  const base = run.character?.stats?.[key] ?? 0;
  let items = 0;
  for (const it of run.items || []) for (const m of it.mods || []) if (m.stat === key) items += m.value;
  const pct = info.kind === 'multiplier' || info.kind === 'percent';
  return {
    items,
    text: key === 'speed'
      ? `${Math.round(base)} units/s base + ${Math.round((run.speed / (base || 1) - 1) * 100)}% gear`
      : pct
        ? `${Math.round(base * 100)}% base + ${Math.round(items * 100)}% tools`
        : `${Math.round(base * 10) / 10} base + ${Math.round(items * 10) / 10} tools`
  };
}

// Explicit, colorable stat deltas for shop and level-up cards
// (green "+3 Armor" / red "−5% Speed"). Repeated rolls of the same stat are
// merged into one chip.
export function itemDeltas(item) {
  const agg = {};
  for (const m of item.mods || []) agg[m.stat] = (agg[m.stat] || 0) + m.value;
  return Object.entries(agg).map(([stat, value]) => {
    const info = STAT_INFO[stat] || { label: stat, kind: 'flat' };
    const pct = info.kind === 'multiplier' || info.kind === 'percent' || info.kind === 'velocity';
    const num = pct ? Math.round(Math.abs(value) * 100) : Math.round(Math.abs(value) * 10) / 10;
    return {
      stat,
      positive: value >= 0,
      text: `${value >= 0 ? '+' : '−'}${num}${pct ? '%' : ''} ${info.label}`
    };
  });
}