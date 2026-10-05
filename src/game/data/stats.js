// Central dictionary of every player-facing stat: what it's called, how it's
// formatted, what it actually does in signalEngine.js, and how to render shop
// deltas. Screens (stats panel, shop, level-up) all read from here so a stat
// can never drift between "what the card says" and "what the engine does".

export const STAT_INFO = {
  maxHp: { label: 'Jacket Integrity', kind: 'flat', desc: 'Maximum HP. Hits reduce it; at 0 you are truck-rolled.' },
  regen: { label: 'HP Regen', kind: 'flat', desc: 'HP restored every second, automatically.' },
  lifeSteal: { label: 'Signal Recovery', kind: 'percent', desc: 'Percent of all damage dealt returned to you as HP.' },
  damage: { label: 'Damage', kind: 'multiplier', desc: 'Hit damage = base × Damage × (crit ? 2 : 1) × (1 + 0.004 × Splice Quality); dirty foes additionally × (1 + 0.01 × Cleanliness).' },
  attackSpeed: { label: 'Attack Speed', kind: 'multiplier', desc: 'Tool interval = base seconds / Attack Speed. Pedestal and Frenzy multiply speed further; deployed turrets use their own fire interval.' },
  crit: { label: 'Crit Chance', kind: 'percent', desc: 'Chance for a hit to deal double damage; capped at 100%.' },
  range: { label: 'Reach modifier', kind: 'multiplier', desc: 'Applied once to viewport-derived tool reach. Gear +0.03 adds 3 percentage points to the character factor (Oracle 1.35 → 1.38). Weapon reach ratings scale family/quality, not absolute distance. Normal ranged caps: 42% of the shorter visible side, Oracle 44%; melee 18%. Combat HUD shows actual world units. Flat bonuses, if present, add world units before the cap. Projectile distance freezes at launch; DPI never changes reach.' },
  knockback: { label: 'Knockback', kind: 'flat', desc: 'Critical hits move impairments away by 8 map units per point (plus rolled critical-knockback bonuses).' },
  pierce: { label: 'Pierce', kind: 'flat', desc: 'Normal shots penetrate round(Pierce) additional targets; inherently piercing pulses already penetrate all targets in their travel lifetime.' },
  armor: { label: 'Jacket Protection', kind: 'flat', desc: 'Contact damage = max(25% of the incoming hit, max(2, enemy damage − 1.5 × Armor)) × (1 − min(40%, 0.3% × Signal Integrity)). Armor can never reduce a hit below a quarter of its pre-armor damage.' },
  dodge: { label: 'Dodge', kind: 'percent', desc: 'Chance to take zero contact damage (capped at 50%).' },
  speed: { label: 'Move Speed', kind: 'velocity', desc: 'Map units per second. Base speed × product(1 + each gear bonus); diagonal movement is normalized. Temporary sprint/hit boosts multiply this further.' },
  harvesting: { label: 'Harvesting', kind: 'flat', desc: 'Bonus Signal granted at the end of each wave.' },
  engineering: { label: 'Engineering', kind: 'flat', desc: 'Turret/helper base damage × (1 + Engineering/100). Auto-sentry HP +2 and life +0.04s per point; purchased structures life +0.06s per point. Placement cap = 6 + floor(Engineering/10).' },
  cleanliness: { label: 'Cleanliness', kind: 'flat', desc: '+1% damage per point against dirty impairments (blobs, beasts).' },
  signalStrength: { label: 'Signal Integrity', kind: 'flat', desc: 'Contact damage reduction = min(40%, 0.3% × points), after Armor.' },
  spliceQuality: { label: 'Splice Quality', kind: 'flat', desc: '+0.4% damage per point. Pure craftsmanship.' },
  luck: { label: 'Luck', kind: 'flat', desc: 'Shifts min(20, max(0,Luck) × 0.2) rarity-weight points out of Common. Additional pickup chance per kill = min(100%, Luck × 0.2%).' },
  instakill: { label: 'Instakill Chance', kind: 'percent', desc: 'Chance to terminate a non-boss instantly (Veteran base 1%). Ignored for bosses; neither the trait nor Grandfather Clause bypasses boss HP.' }
};

export function formatStat(kind, v = 0) {
  if (kind === 'multiplier' || kind === 'percent') return `${+(v * 100).toFixed(2)}%`;
  if (kind === 'velocity') return `${+v.toFixed(2)} units/s`;
  return +v.toFixed(2);
}

// Percent-first character stat lines (declutter pass): movement speed reads as
// a percent of the Rookie baseline first, with the raw units/s secondary.
export const SPEED_REFERENCE = 250;
export function charStatText(key, value) {
  if (key === 'speed') return `${Math.round(value / SPEED_REFERENCE * 100)}% movement (${+value.toFixed(2)} units/s)`;
  return formatStat(STAT_INFO[key]?.kind || 'flat', value);
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
  for (const it of [...(run.weapons || []),...(run.items || [])]) for (const m of it.mods || []) if (m.stat === key) items += m.value;
  const pct = info.kind === 'multiplier' || info.kind === 'percent';
  const capped = (key === 'dodge' && base + items > .5) ? ' • capped at 50%' : (key === 'crit' && base + items > 1) ? ' • capped at 100%' : '';
  return {
    items,
    text: key === 'speed'
      ? `${formatStat('velocity',base)} base + ${formatStat('percent',run.speed / (base || 1) - 1)} gear`
      : pct
        ? `${formatStat('percent',base)} base + ${formatStat('percent',items)} inventory${capped}`
        : `${formatStat('flat',base)} base + ${formatStat('flat',items)} inventory`
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
    const num = pct ? +(Math.abs(value) * 100).toFixed(2) : +Math.abs(value).toFixed(2);
    return {
      stat,
      positive: value >= 0,
      text: `${value >= 0 ? '+' : '−'}${num}${pct ? '%' : ''} ${info.label}`
    };
  });
}