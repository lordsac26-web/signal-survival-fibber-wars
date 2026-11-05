// Shared Co-Op Catalog, Seeding, and Loadout/Stat Validation
// Plain JS module for both Deno Actor runtime and Node test runner.

export const MAX_USERS = 4;
export const W = 1100;
export const H = 800;

export const VALID_CHARS = new Set(['oracle', 'isr', 'veteran', 'clone', 'don', 'nomad', 'admin', 'engineer']);
export const VALID_CHOICES = new Set(['random', 'classic', 'office', 'worksite', 'vault', 'nightWorksite']);
export const ARENA_BG_IDS = ['office', 'worksite', 'vault', 'nightWorksite'];

export const BASE_STATS = {
  maxHp: 100,
  speed: 250,
  damage: 1,
  attackSpeed: 1,
  armor: 0,
  range: 1,
  crit: 0.05,
  regen: 1,
  luck: 0,
  dodge: 0,
  lifeSteal: 0,
  engineering: 0,
  cleanliness: 0,
  signalStrength: 0,
  spliceQuality: 0,
  harvesting: 0,
  knockback: 0,
  pierce: 0,
  instakill: 0
};

export const CHARACTER_SPECS = {
  nomad: {
    id: 'nomad',
    name: 'Night-Shift Nomad',
    slots: 6,
    restriction: 'any',
    start: ['vfl'],
    altStart: ['stripper', 'vfl'],
    stats: { ...BASE_STATS, maxHp: 78, speed: 300, damage: 0.92, attackSpeed: 1.12, range: 1.12, crit: 0.08, regen: 0.5, luck: 15, dodge: 0.06, signalStrength: 5 },
    special: { id: 'sprint', name: 'Café Chug', cooldown: 18, duration: 5 }
  },
  veteran: {
    id: 'veteran',
    name: '30 Year Veteran',
    slots: 8,
    familyCap: 4,
    restriction: 'any',
    start: ['cleaver', 'otdr'],
    altStart: ['cutters', 'power'],
    stats: { ...BASE_STATS, maxHp: 115, speed: 225, damage: 1.08, attackSpeed: 0.94, armor: 3, crit: 0.04, regen: 1.5, luck: 2, dodge: 0.02, engineering: 2, spliceQuality: 8, instakill: 0.01 },
    special: { id: 'clause', name: 'Knowledge Dump', cooldown: 30, duration: 3 }
  },
  oracle: {
    id: 'oracle',
    name: 'OTDR Oracle',
    slots: 6,
    restriction: 'ranged',
    start: ['otdr'],
    altStart: ['power'],
    stats: { ...BASE_STATS, maxHp: 74, speed: 245, damage: 0.94, range: 1.35, crit: 0.06, regen: 0.5, luck: 24, dodge: 0.03, engineering: 2, signalStrength: 15, spliceQuality: 4, harvesting: 5 },
    special: { id: 'trace', name: 'Full Trace', cooldown: 22, duration: 0.6 }
  },
  don: {
    id: 'don',
    name: 'Dispatch Don',
    slots: 6,
    restriction: 'any',
    start: ['power'],
    altStart: ['tray'],
    stats: { ...BASE_STATS, maxHp: 220, speed: 125, damage: 0.9, attackSpeed: 0.85, armor: 4, crit: 0.04, regen: 3, engineering: 8, harvesting: 10 },
    special: { id: 'crew', name: 'Escalate to Field Crew', cooldown: 26, duration: 8 }
  },
  admin: {
    id: 'admin',
    name: 'No Accountability Admin',
    slots: 4,
    restriction: 'any',
    start: ['stripper'],
    altStart: null,
    stats: { ...BASE_STATS, maxHp: 88, damage: 0.75, dodge: 0.3, regen: 0.5, luck: 8 },
    special: { id: 'meeting', name: 'Meeting Invite', cooldown: 20, duration: 4 }
  },
  engineer: {
    id: 'engineer',
    name: 'Field Engineer',
    slots: 4,
    restriction: 'any',
    start: ['tray', 'power'],
    altStart: null,
    stats: { ...BASE_STATS, maxHp: 105, speed: 259, damage: 1, attackSpeed: 1, armor: 1, regen: 1, crit: 0.04, luck: 5, engineering: 10, spliceQuality: 2, harvesting: 2 },
    special: { id: 'surge', name: 'Fiber Splice Surge', cooldown: 18, duration: 4.8 }
  },
  clone: {
    id: 'clone',
    name: 'Contractor Clone',
    slots: 6,
    restriction: 'any',
    start: ['stripper'],
    altStart: ['cleaver', 'stripper'],
    stats: { ...BASE_STATS, maxHp: 90, speed: 275, crit: 0.05, regen: 1, cleanliness: -35, luck: 5 },
    special: { id: 'cash', name: 'Cash Money', cooldown: 30, duration: 8 }
  },
  isr: {
    id: 'isr',
    name: 'Internet Services Representative',
    slots: 6,
    restriction: 'any',
    start: ['power'],
    altStart: ['otdr'],
    stats: { ...BASE_STATS, maxHp: 105, speed: 210, damage: 0.8, attackSpeed: 1.05, range: 1.08, armor: 1, regen: 1.5, crit: 0.03, luck: 10, signalStrength: 8, dodge: 0.04, harvesting: 6 },
    special: { id: 'outage', name: 'Outage Declaration', cooldown: 25, duration: 8 }
  }
};

export const WEAPON_CATALOG = {
  cleaver: { baseId: 'cleaver', name: 'Fiber Cleaver', icon: '✂', color: '#fde047', damage: 24, rate: 0.7, range: 92, pattern: 'melee', family: 'melee' },
  splicer: { baseId: 'splicer', name: 'Fusion Splicer', icon: '⚡', color: '#c084fc', damage: 31, rate: 0.92, range: 120, pattern: 'nova', family: 'spark' },
  otdr: { baseId: 'otdr', name: 'OTDR', icon: '⌁', color: '#22d3ee', damage: 34, rate: 1.25, range: 520, pattern: 'pierce', family: 'laser' },
  vfl: { baseId: 'vfl', name: 'Visual Fault Locator', icon: '↗', color: '#ef4444', damage: 9, rate: 0.28, range: 390, pattern: 'beam', family: 'laser' },
  power: { baseId: 'power', name: 'Optical Power Meter', icon: '▣', color: '#38bdf8', damage: 22, rate: 0.8, range: 330, pattern: 'projectile', family: 'laser' },
  stripper: { baseId: 'stripper', name: 'Fiber Stripper', icon: '≋', color: '#fb923c', damage: 8, rate: 0.22, range: 145, pattern: 'projectile', family: 'snip' },
  cleaner: { baseId: 'cleaner', name: 'One-Click Cleaner', icon: '◉', color: '#34d399', damage: 15, rate: 0.72, range: 155, pattern: 'cone', family: 'squirt', heal: 2 },
  cutters: { baseId: 'cutters', name: 'Kevlar Cutters', icon: '✕', color: '#f472b6', damage: 42, rate: 1.05, range: 105, pattern: 'melee', family: 'snip' },
  tray: { baseId: 'tray', name: 'Splice Tray Sentry', icon: '▤', color: '#f59e0b', damage: 13, rate: 3.2, range: 300, pattern: 'turret', family: 'spark', turret: { life: 6, cap: 3, fire: 0.45, mode: 'pellet' } },
  closure: { baseId: 'closure', name: 'Closure Cannon', icon: '◎', color: '#f97316', damage: 46, rate: 4.5, range: 420, pattern: 'turret', family: 'spark', turret: { life: 7, cap: 2, fire: 1.5, mode: 'mortar' } },
  cable: { baseId: 'cable', name: 'Launch Cable Nest', icon: '⌇', color: '#22d3ee', damage: 26, rate: 3.8, range: 520, pattern: 'turret', family: 'spark', turret: { life: 8, cap: 2, fire: 1, mode: 'pulse' } },
  fanout: { baseId: 'fanout', name: 'Fan-Out Splitter', icon: '≡', color: '#a3e635', damage: 9, rate: 3.4, range: 230, pattern: 'turret', family: 'spark', turret: { life: 5, cap: 3, fire: 1.15, mode: 'spread' } },
  jumper: { baseId: 'jumper', name: 'Patch Cord Whip', icon: '∿', color: '#a3e635', damage: 18, rate: 1.6, range: 210, pattern: 'chain', family: 'melee' },
  midspan: { baseId: 'midspan', name: 'Midspan Access Tool', icon: '⌇', color: '#fb7185', damage: 29, rate: 0.9, range: 280, pattern: 'pierce', family: 'laser' },
  blaster: { baseId: 'blaster', name: 'Buffer Tube Blaster', icon: '◖', color: '#60a5fa', damage: 17, rate: 0.48, range: 230, pattern: 'cone', family: 'snip' },
  deadzone: { baseId: 'deadzone', name: 'Dead Zone Eliminator', icon: '⌁', color: '#e879f9', damage: 25, rate: 0.7, range: 360, pattern: 'beamSweep', family: 'laser' },
  switch: { baseId: 'switch', name: 'Optical Switch Snapper', icon: '⌘', color: '#2dd4bf', damage: 21, rate: 1.7, range: 260, pattern: 'chain', family: 'melee' },
  bell: { baseId: 'bell', name: 'Fairy Bell', icon: '♢', color: '#f9a8d4', damage: 16, rate: 0.42, range: 170, pattern: 'orbiting', family: 'melee' },
  rocket: { baseId: 'rocket', name: 'Loose-Tube Launcher', icon: '◉', color: '#f97316', damage: 38, rate: 1.4, range: 350, pattern: 'thrown', family: 'snip' },
  dowel: { baseId: 'dowel', name: 'Loader-Dowel', icon: '▮', color: '#a8a29e', damage: 48, rate: 1.6, range: 300, pattern: 'projectile', family: 'snip' }
};

export const ENEMY_CATALOG = {
  lag: { kind: 'lag', color: '#fbbf24', hp: 24, speed: 64, damage: 11, r: 13, value: 2 },
  packet: { kind: 'packet', color: '#fb7185', hp: 44, speed: 44, damage: 16, r: 18, value: 3 },
  jitter: { kind: 'jitter', color: '#a3e635', hp: 31, speed: 92, damage: 10, r: 12, value: 3 },
  dirty: { kind: 'dirty', color: '#a78bfa', hp: 66, speed: 52, damage: 18, r: 21, value: 5, dirty: true },
  bend: { kind: 'bend', color: '#f97316', hp: 49.6, speed: 78.2, damage: 11.5, r: 25, value: 8, elite: true, dirty: true },
  crosstalk: { kind: 'crosstalk', color: '#2dd4bf', hp: 22, speed: 106, damage: 12, r: 15, value: 5 },
  attenuation: { kind: 'attenuation', color: '#94a3b8', hp: 145, speed: 46, damage: 30, r: 28, value: 12, elite: true },
  pete: { kind: 'pete', color: '#f472b6', hp: 240, speed: 56, damage: 30, r: 24, value: 14, elite: true, knockbackResist: 0.95 },
  peteMini: { kind: 'peteMini', color: '#f9a8d4', hp: 120, speed: 68, damage: 15, r: 13, value: 7 },
  ditch: { kind: 'ditch', color: '#f97316', hp: 110, speed: 58, damage: 20, r: 26, value: 10, elite: true, dirty: true, knockbackResist: 0.6 },
  rous: { kind: 'rous', name: 'R.O.U.S. (Router of Unusual Size)', color: '#facc15', hp: 560, speed: 48, damage: 28, r: 34, value: 45, elite: true, boss: true, knockbackResist: 0.85 },
  squirrel: { kind: 'squirrel', name: 'Fiber-Nibbling Squirrel', color: '#f97316', hp: 720, speed: 72, damage: 30, r: 32, value: 60, elite: true, boss: true, knockbackResist: 0.85 }
};

export const STRUCTURE_CATALOG = {
  turretMount: { name: 'Turret Mount', color: '#f59e0b', kind: 'turret', r: 16, life: 12, cd: 14, damage: 9, fire: 0.45, range: 300 },
  barricade: { name: 'Traffic Barricade', color: '#fb923c', kind: 'block', r: 24, life: 20, cd: 9 },
  ratTrap: { name: 'Rat Guard', color: '#f87171', kind: 'trap', r: 18, life: 24, cd: 11, chomp: 26, uses: 4 },
  snare: { name: 'Slack Coil Snare', color: '#22d3ee', kind: 'slow', r: 80, life: 12, cd: 12, slow: 0.45 },
  pedestal: { name: 'Portable Pedestal', color: '#facc15', kind: 'buff', r: 85, life: 15, cd: 13, buff: 0.25 }
};

export function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
}

export function seedHash(seed, wave) {
  let h = (Number(seed) || 1) ^ ((Number(wave) || 1) * 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function pickArenaTheme(seed = 1, wave = 1, prev = null) {
  let idx = seedHash(seed, wave) % ARENA_BG_IDS.length;
  if (prev && ARENA_BG_IDS[idx] === prev) {
    idx = (idx + 1 + (seedHash(seed, wave + 97) % (ARENA_BG_IDS.length - 1))) % ARENA_BG_IDS.length;
  }
  return ARENA_BG_IDS[idx];
}

export function resolveArena(choice, seed, wave, prev = null) {
  if (choice && choice !== 'random' && VALID_CHOICES.has(choice)) return choice;
  return pickArenaTheme(seed, wave, prev);
}

export function signalForLevel(level) {
  return Math.ceil(
    level <= 5
      ? 45 + level * 18 + level * level * 3
      : 210 * Math.pow(1.3, level - 5)
  );
}

export function waveDuration(wave) {
  return Math.min(90, 20 + (wave - 1) * 4);
}

export function spawnInterval(wave, playerCount = 1) {
  const base = Math.max(0.32, 0.72 - wave * 0.022);
  const mult = 1 + Math.max(0, playerCount - 1) * 0.18;
  return Math.max(0.22, base / mult);
}

export function maxActiveEnemies(wave, playerCount = 1) {
  const base = Math.min(14, 6 + Math.floor(Math.max(0, wave - 1) / 6));
  return Math.min(22, base + Math.max(0, playerCount - 1) * 2);
}

export function enemyHpMultiplier(wave = 1, elite = false) {
  const w = Math.max(0, wave - 1);
  return (1 + w * 0.29 + w * w * 0.0275) * (elite ? 1.25 : 1);
}

export function enemyDamageMultiplier(wave = 1, elite = false) {
  const w = Math.max(0, wave - 1);
  return (1 + w * 0.12) * (elite ? 1.15 : 1);
}

export function weaponSlotType(pattern) {
  return ['melee', 'chain', 'nova', 'orbiting'].includes(pattern) ? 'melee' : 'ranged';
}

export function allowedWeaponForChar(charSpec, w) {
  if (!charSpec || !w) return false;
  if (!charSpec.restriction || charSpec.restriction === 'any') return true;
  return weaponSlotType(w.pattern) === charSpec.restriction;
}

export function sanitizeWeapons(charId, rawWeapons, fallbackSeed = 1) {
  const spec = CHARACTER_SPECS[charId] || CHARACTER_SPECS.oracle;
  const maxSlots = spec.slots || 6;
  const out = [];
  if (Array.isArray(rawWeapons)) {
    for (let i = 0; i < rawWeapons.length && out.length < maxSlots; i++) {
      const rw = rawWeapons[i];
      if (!rw || typeof rw !== 'object') continue;
      const base = WEAPON_CATALOG[rw.baseId] || Object.values(WEAPON_CATALOG).find((c) => c.pattern === rw.pattern) || WEAPON_CATALOG.power;
      if (!allowedWeaponForChar(spec, base)) continue;
      const slotType = weaponSlotType(base.pattern);
      if (spec.familyCap) {
        const countInFamily = out.filter((x) => x.slotType === slotType).length;
        if (countInFamily >= spec.familyCap) continue;
      }
      if (spec.id === 'engineer') {
        const cat = base.pattern === 'turret' ? 'deployable' : slotType;
        const countCat = out.filter((x) => (x.pattern === 'turret' ? 'deployable' : x.slotType) === cat).length;
        const cap = cat === 'deployable' ? 4 : cat === 'melee' ? 2 : 1;
        if (countCat >= cap) continue;
      }
      out.push({
        id: String(rw.id || `w-${fallbackSeed}-${i}`).slice(0, 64),
        baseId: base.baseId,
        name: String(rw.name || base.name).slice(0, 64),
        icon: String(rw.icon || base.icon || '🔧').slice(0, 8),
        color: String(rw.color || base.color || '#67e8f9').slice(0, 16),
        pattern: base.pattern,
        slotType,
        family: base.family,
        rarity: ['common', 'rare', 'epic', 'legendary', 'overclocked'].includes(String(rw.rarity || '').toLowerCase())
          ? String(rw.rarity).toLowerCase()
          : 'common',
        damage: clamp(rw.damage ?? base.damage, 1, 5000),
        rate: clamp(rw.rate ?? base.rate, 0.08, 10),
        range: clamp(rw.range ?? base.range, 50, 1200),
        heal: clamp(rw.heal ?? (base.heal || 0), 0, 100),
        turret: base.turret ? { ...base.turret } : null,
        overclockRank: clamp(rw.overclockRank ?? 0, 0, 3),
        mods: Array.isArray(rw.mods)
          ? rw.mods.slice(0, 6).map((m) => ({
              stat: String(m?.stat || 'damage').slice(0, 24),
              label: String(m?.label || 'Stat').slice(0, 32),
              value: clamp(m?.value ?? 0, -100, 500)
            }))
          : []
      });
    }
  }
  if (!out.length) {
    const startIds = spec.start || ['power'];
    for (let i = 0; i < startIds.length; i++) {
      const base = WEAPON_CATALOG[startIds[i]] || WEAPON_CATALOG.power;
      out.push({
        id: `starter-${charId}-${i}`,
        baseId: base.baseId,
        name: base.name,
        icon: base.icon,
        color: base.color,
        pattern: base.pattern,
        slotType: weaponSlotType(base.pattern),
        family: base.family,
        rarity: 'common',
        damage: base.damage,
        rate: base.rate,
        range: base.range,
        heal: base.heal || 0,
        turret: base.turret ? { ...base.turret } : null,
        overclockRank: 0,
        mods: []
      });
    }
  }
  return out;
}

export function sanitizePassives(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.slice(0, 24).map((it, idx) => ({
    id: String(it?.id || `item-${idx}`).slice(0, 64),
    name: String(it?.name || 'Item').slice(0, 64),
    rarity: String(it?.rarity || 'common').toLowerCase(),
    special: typeof it?.special === 'string' ? it.special.slice(0, 80) : null,
    specialPower: clamp(it?.specialPower ?? 1, 1, 5),
    mods: Array.isArray(it?.mods)
      ? it.mods.slice(0, 6).map((m) => ({
          stat: String(m?.stat || 'damage').slice(0, 24),
          label: String(m?.label || 'Stat').slice(0, 32),
          value: clamp(m?.value ?? 0, -100, 500)
        }))
      : []
  }));
}

export function sanitizeDeployables(charId, rawDeploys) {
  if (!Array.isArray(rawDeploys)) return [];
  const cap = charId === 'engineer' ? 4 : 6;
  const out = [];
  for (let i = 0; i < rawDeploys.length && out.length < cap; i++) {
    const d = rawDeploys[i];
    if (!d || typeof d !== 'object' || !STRUCTURE_CATALOG[d.structure]) continue;
    out.push({
      id: String(d.id || `dep-${i}`).slice(0, 64),
      name: String(d.name || STRUCTURE_CATALOG[d.structure].name).slice(0, 48),
      icon: String(d.icon || '🚧').slice(0, 8),
      structure: d.structure,
      unique: Boolean(d.unique || ['turretMount', 'barricade'].includes(d.structure)),
      stacks: clamp(d.stacks || 1, 1, 2)
    });
  }
  return out;
}

export function computeEffectiveStats(seatState) {
  const spec = CHARACTER_SPECS[seatState.characterId] || CHARACTER_SPECS.oracle;
  const stats = {
    ...spec.stats,
    cleaningKillsHeal: 0,
    bonusSignal: 0,
    hitSpeedBoost: 0,
    critKnockback: 0,
    turretQuality: 0,
    firstHitBlocked: 0
  };
  const allItems = [
    ...(seatState.weapons || []),
    ...(seatState.items || []),
    ...(seatState.statMods || [])
  ];
  for (const item of allItems) {
    for (const m of item?.mods || []) {
      if (['damage', 'attackSpeed', 'range'].includes(m.stat)) {
        stats[m.stat] = (stats[m.stat] || 1) + Number(m.value || 0);
      } else if (m.stat === 'speed') {
        stats.speed = (stats.speed || 250) * (1 + Number(m.value || 0));
      } else if (m.stat && m.stat in stats) {
        stats[m.stat] = (stats[m.stat] || 0) + Number(m.value || 0);
      }
    }
    if (item?.special === 'Repairs restore Jacket Integrity' || item?.special === 'Cleaning kills restore Jacket Integrity') {
      stats.cleaningKillsHeal += 2 * (item.specialPower || 1);
    } else if (item?.special === 'Enemies occasionally drop bonus Signal') {
      stats.bonusSignal += 0.15 * (item.specialPower || 1);
    } else if (item?.special === 'Gain a brief speed boost when hit') {
      stats.hitSpeedBoost = 1;
    } else if (item?.special === 'Critical hits knock impairments backward') {
      stats.critKnockback += 3 * (item.specialPower || 1);
    } else if (item?.special === 'Turrets inherit extra Splice Quality') {
      stats.turretQuality += 5 * (item.specialPower || 1);
    } else if (item?.special === 'First hit each wave is politely declined') {
      stats.firstHitBlocked = 1;
    }
  }
  stats.maxHp = clamp(Math.round(stats.maxHp), 1, 5000);
  stats.speed = clamp(stats.speed, 60, 750);
  stats.damage = clamp(stats.damage, 0.2, 25);
  stats.attackSpeed = clamp(stats.attackSpeed, 0.25, 12);
  stats.range = clamp(stats.range, 0.4, 4);
  stats.dodge = clamp(stats.dodge, 0, 0.5);
  stats.crit = clamp(stats.crit, 0, 1);
  stats.armor = clamp(stats.armor, -20, 200);
  return stats;
}

export function effectiveReachForWeapon(w, stats, viewport = { width: 1100, height: 800 }, kind = 'weapon') {
  const shortSide = Math.min(viewport?.width || 1100, viewport?.height || 800);
  const raw = (w.range || 240) * 0.65 * (kind === 'turret' ? 1 : stats.range || 1);
  const cap = kind === 'turret' ? shortSide * 0.46 : shortSide * 0.55;
  return Math.max(48, Math.min(raw, cap));
}