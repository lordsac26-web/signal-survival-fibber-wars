import { Actor } from 'base44:runtime/actors';

const MAX_USERS = 4;
const W = 1100;
const H = 800;
const SIM_STEP = 1 / 30;
const TICK_MS = 50;

const VALID_CHARS = new Set(['oracle', 'isr', 'veteran', 'clone', 'don', 'nomad', 'admin', 'engineer']);
const VALID_CHOICES = new Set(['random', 'classic', 'office', 'worksite', 'vault', 'nightWorksite']);
const ARENA_BG_IDS = ['office', 'worksite', 'vault', 'nightWorksite'];

const BASE_STATS = {
  maxHp: 100, speed: 250, damage: 1, attackSpeed: 1, armor: 0, range: 1,
  crit: 0.05, regen: 1, luck: 0, dodge: 0, lifeSteal: 0, engineering: 0,
  cleanliness: 0, signalStrength: 0, spliceQuality: 0, harvesting: 0,
  knockback: 0, pierce: 0, instakill: 0
};

const CHARACTER_SPECS = {
  nomad: { id: 'nomad', name: 'Night-Shift Nomad', slots: 6, restriction: 'any', start: ['vfl'], stats: { ...BASE_STATS, maxHp: 78, speed: 300, damage: 0.92, attackSpeed: 1.12, range: 1.12, crit: 0.08, regen: 0.5, luck: 15, dodge: 0.06, signalStrength: 5 }, special: { id: 'sprint', name: 'Café Chug', cooldown: 18, duration: 5 } },
  veteran: { id: 'veteran', name: '30 Year Veteran', slots: 8, familyCap: 4, restriction: 'any', start: ['cleaver', 'otdr'], stats: { ...BASE_STATS, maxHp: 115, speed: 225, damage: 1.08, attackSpeed: 0.94, armor: 3, crit: 0.04, regen: 1.5, luck: 2, dodge: 0.02, engineering: 2, spliceQuality: 8, instakill: 0.01 }, special: { id: 'clause', name: 'Knowledge Dump', cooldown: 30, duration: 3 } },
  oracle: { id: 'oracle', name: 'OTDR Oracle', slots: 6, restriction: 'ranged', start: ['otdr'], stats: { ...BASE_STATS, maxHp: 74, speed: 245, damage: 0.94, range: 1.35, crit: 0.06, regen: 0.5, luck: 24, dodge: 0.03, engineering: 2, signalStrength: 15, spliceQuality: 4, harvesting: 5 }, special: { id: 'trace', name: 'Full Trace', cooldown: 22, duration: 0.6 } },
  don: { id: 'don', name: 'Dispatch Don', slots: 6, restriction: 'any', start: ['power'], stats: { ...BASE_STATS, maxHp: 220, speed: 125, damage: 0.9, attackSpeed: 0.85, armor: 4, crit: 0.04, regen: 3, engineering: 8, harvesting: 10 }, special: { id: 'crew', name: 'Escalate to Field Crew', cooldown: 26, duration: 8 } },
  admin: { id: 'admin', name: 'No Accountability Admin', slots: 4, restriction: 'any', start: ['stripper'], stats: { ...BASE_STATS, maxHp: 88, damage: 0.75, dodge: 0.3, regen: 0.5, luck: 8 }, special: { id: 'meeting', name: 'Meeting Invite', cooldown: 20, duration: 4 } },
  engineer: { id: 'engineer', name: 'Field Engineer', slots: 4, restriction: 'any', start: ['tray', 'power'], stats: { ...BASE_STATS, maxHp: 105, speed: 259, damage: 1, attackSpeed: 1, armor: 1, regen: 1, crit: 0.04, luck: 5, engineering: 10, spliceQuality: 2, harvesting: 2 }, special: { id: 'surge', name: 'Fiber Splice Surge', cooldown: 18, duration: 4.8 } },
  clone: { id: 'clone', name: 'Contractor Clone', slots: 6, restriction: 'any', start: ['stripper'], stats: { ...BASE_STATS, maxHp: 90, speed: 275, crit: 0.05, regen: 1, cleanliness: -35, luck: 5 }, special: { id: 'cash', name: 'Cash Money', cooldown: 30, duration: 8 } },
  isr: { id: 'isr', name: 'Internet Services Representative', slots: 6, restriction: 'any', start: ['power'], stats: { ...BASE_STATS, maxHp: 105, speed: 210, damage: 0.8, attackSpeed: 1.05, range: 1.08, armor: 1, regen: 1.5, crit: 0.03, luck: 10, signalStrength: 8, dodge: 0.04, harvesting: 6 }, special: { id: 'outage', name: 'Outage Declaration', cooldown: 25, duration: 8 } }
};

const WEAPON_CATALOG = {
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

const ENEMY_CATALOG = {
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

const STRUCTURE_CATALOG = {
  turretMount: { name: 'Turret Mount', color: '#f59e0b', kind: 'turret', r: 16, life: 12, cd: 14, damage: 9, fire: 0.45, range: 300 },
  barricade: { name: 'Traffic Barricade', color: '#fb923c', kind: 'block', r: 24, life: 20, cd: 9 },
  ratTrap: { name: 'Rat Guard', color: '#f87171', kind: 'trap', r: 18, life: 24, cd: 11, chomp: 26, uses: 4 },
  snare: { name: 'Slack Coil Snare', color: '#22d3ee', kind: 'slow', r: 80, life: 12, cd: 12, slow: 0.45 },
  pedestal: { name: 'Portable Pedestal', color: '#facc15', kind: 'buff', r: 85, life: 15, cd: 13, buff: 0.25 }
};

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
}

function seedHash(seed, wave) {
  let h = (Number(seed) || 1) ^ ((Number(wave) || 1) * 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function pickArenaTheme(seed = 1, wave = 1, prev = null) {
  let idx = seedHash(seed, wave) % ARENA_BG_IDS.length;
  if (prev && ARENA_BG_IDS[idx] === prev) {
    idx = (idx + 1 + (seedHash(seed, wave + 97) % (ARENA_BG_IDS.length - 1))) % ARENA_BG_IDS.length;
  }
  return ARENA_BG_IDS[idx];
}

function resolveArena(choice, seed, wave, prev = null) {
  if (choice && choice !== 'random' && VALID_CHOICES.has(choice)) return choice;
  return pickArenaTheme(seed, wave, prev);
}

function signalForLevel(level) {
  return Math.ceil(level <= 5 ? 45 + level * 18 + level * level * 3 : 210 * Math.pow(1.3, level - 5));
}

function waveDuration(wave) {
  return Math.min(90, 20 + (wave - 1) * 4);
}

function spawnInterval(wave, playerCount = 1) {
  const base = Math.max(0.32, 0.72 - wave * 0.022);
  return Math.max(0.22, base / (1 + Math.max(0, playerCount - 1) * 0.18));
}

function maxActiveEnemies(wave, playerCount = 1) {
  const base = Math.min(14, 6 + Math.floor(Math.max(0, wave - 1) / 6));
  return Math.min(22, base + Math.max(0, playerCount - 1) * 2);
}

function enemyHpMultiplier(wave = 1, elite = false) {
  const w = Math.max(0, wave - 1);
  return (1 + w * 0.29 + w * w * 0.0275) * (elite ? 1.25 : 1);
}

function enemyDamageMultiplier(wave = 1, elite = false) {
  const w = Math.max(0, wave - 1);
  return (1 + w * 0.12) * (elite ? 1.15 : 1);
}

function weaponSlotType(pattern) {
  return ['melee', 'chain', 'nova', 'orbiting'].includes(pattern) ? 'melee' : 'ranged';
}

function allowedWeaponForChar(charSpec, w) {
  if (!charSpec || !w) return false;
  return !charSpec.restriction || charSpec.restriction === 'any' || weaponSlotType(w.pattern) === charSpec.restriction;
}

function sanitizeWeapons(charId, rawWeapons, fallbackSeed = 1) {
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
      if (spec.familyCap && out.filter((x) => x.slotType === slotType).length >= spec.familyCap) continue;
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
        rarity: ['common', 'rare', 'epic', 'legendary', 'overclocked'].includes(String(rw.rarity || '').toLowerCase()) ? String(rw.rarity).toLowerCase() : 'common',
        damage: clamp(rw.damage ?? base.damage, 1, 5000),
        rate: clamp(rw.rate ?? base.rate, 0.08, 10),
        range: clamp(rw.range ?? base.range, 50, 1200),
        heal: clamp(rw.heal ?? (base.heal || 0), 0, 100),
        turret: base.turret ? { ...base.turret } : null,
        overclockRank: clamp(rw.overclockRank ?? 0, 0, 3),
        mods: Array.isArray(rw.mods) ? rw.mods.slice(0, 6).map((m) => ({ stat: String(m?.stat || 'damage').slice(0, 24), label: String(m?.label || 'Stat').slice(0, 32), value: clamp(m?.value ?? 0, -100, 500) })) : []
      });
    }
  }
  if (!out.length) {
    for (let i = 0; i < (spec.start || ['power']).length; i++) {
      const base = WEAPON_CATALOG[spec.start[i]] || WEAPON_CATALOG.power;
      out.push({ id: `starter-${charId}-${i}`, baseId: base.baseId, name: base.name, icon: base.icon, color: base.color, pattern: base.pattern, slotType: weaponSlotType(base.pattern), family: base.family, rarity: 'common', damage: base.damage, rate: base.rate, range: base.range, heal: base.heal || 0, turret: base.turret ? { ...base.turret } : null, overclockRank: 0, mods: [] });
    }
  }
  return out;
}

function sanitizePassives(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.slice(0, 24).map((it, idx) => ({
    id: String(it?.id || `item-${idx}`).slice(0, 64),
    name: String(it?.name || 'Item').slice(0, 64),
    rarity: String(it?.rarity || 'common').toLowerCase(),
    special: typeof it?.special === 'string' ? it.special.slice(0, 80) : null,
    specialPower: clamp(it?.specialPower ?? 1, 1, 5),
    mods: Array.isArray(it?.mods) ? it.mods.slice(0, 6).map((m) => ({ stat: String(m?.stat || 'damage').slice(0, 24), label: String(m?.label || 'Stat').slice(0, 32), value: clamp(m?.value ?? 0, -100, 500) })) : []
  }));
}

function sanitizeDeployables(charId, rawDeploys) {
  if (!Array.isArray(rawDeploys)) return [];
  const cap = charId === 'engineer' ? 4 : 6;
  const out = [];
  for (let i = 0; i < rawDeploys.length && out.length < cap; i++) {
    const d = rawDeploys[i];
    if (!d || typeof d !== 'object' || !STRUCTURE_CATALOG[d.structure]) continue;
    out.push({ id: String(d.id || `dep-${i}`).slice(0, 64), name: String(d.name || STRUCTURE_CATALOG[d.structure].name).slice(0, 48), icon: String(d.icon || '🚧').slice(0, 8), structure: d.structure, unique: Boolean(d.unique || ['turretMount', 'barricade'].includes(d.structure)), stacks: clamp(d.stacks || 1, 1, 2) });
  }
  return out;
}

function computeEffectiveStats(seatState) {
  const spec = CHARACTER_SPECS[seatState.characterId] || CHARACTER_SPECS.oracle;
  const stats = { ...spec.stats, cleaningKillsHeal: 0, bonusSignal: 0, hitSpeedBoost: 0, critKnockback: 0, turretQuality: 0, firstHitBlocked: 0 };
  for (const item of [...(seatState.weapons || []), ...(seatState.items || []), ...(seatState.statMods || [])]) {
    for (const m of item?.mods || []) {
      if (['damage', 'attackSpeed', 'range'].includes(m.stat)) stats[m.stat] = (stats[m.stat] || 1) + Number(m.value || 0);
      else if (m.stat === 'speed') stats.speed = (stats.speed || 250) * (1 + Number(m.value || 0));
      else if (m.stat && m.stat in stats) stats[m.stat] = (stats[m.stat] || 0) + Number(m.value || 0);
    }
    if (item?.special === 'Repairs restore Jacket Integrity' || item?.special === 'Cleaning kills restore Jacket Integrity') stats.cleaningKillsHeal += 2 * (item.specialPower || 1);
    else if (item?.special === 'Enemies occasionally drop bonus Signal') stats.bonusSignal += 0.15 * (item.specialPower || 1);
    else if (item?.special === 'Gain a brief speed boost when hit') stats.hitSpeedBoost = 1;
    else if (item?.special === 'Critical hits knock impairments backward') stats.critKnockback += 3 * (item.specialPower || 1);
    else if (item?.special === 'Turrets inherit extra Splice Quality') stats.turretQuality += 5 * (item.specialPower || 1);
    else if (item?.special === 'First hit each wave is politely declined') stats.firstHitBlocked = 1;
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

function effectiveReachForWeapon(w, stats, viewport = { width: 1100, height: 800 }, kind = 'weapon') {
  const shortSide = Math.min(viewport?.width || 1100, viewport?.height || 800);
  const raw = (w.range || 240) * 0.65 * (kind === 'turret' ? 1 : stats.range || 1);
  const cap = kind === 'turret' ? shortSide * 0.46 : shortSide * 0.55;
  return Math.max(48, Math.min(raw, cap));
}

function pickEnemyKindForWave(rng, wave) {
  const pool = ['lag', 'packet', 'jitter', 'dirty'];
  if (wave >= 2) pool.push('crosstalk');
  if (wave >= 3) pool.push('bend');
  if (wave >= 4) pool.push('attenuation');
  if (wave >= 6) pool.push('ditch');
  if (wave >= 7) pool.push('pete');
  return pool[Math.floor(rng() * pool.length)];
}

function createCombatWorld(room, seats) {
  const wave = room.wave || 1;
  const duration = waveDuration(wave);
  const rng = seeded(seedHash(room.seed || 1, wave));
  const world = { wave, duration, time: duration, seq: 0, nextEntityId: 1, spawnCd: 0.35, puddleTickCd: 0.5, bossSpawned: false, outageTimer: 0, outageOwnerSeat: null, meeting: null, surge: null, rng, enemies: [], shots: [], foeShots: [], turrets: [], structures: [], pickups: [], puddles: [], fx: [] };
  for (const u of seats) {
    const spawnAngle = ((u.seat - 1) * Math.PI) / 2;
    u.x = Math.round(550 + Math.cos(spawnAngle) * 54);
    u.y = Math.round(400 + Math.sin(spawnAngle) * 54);
    u.vx = 0; u.vy = 0; u.ix = 0; u.iy = 0; u.inv = 0; u.regenAcc = 0; u.hurtBoost = 0;
    u.firstBlockUsed = false; u.specialCooldown = 0; u.specialTimer = 0; u.clauseFired = false; u.deployCds = {};
    u.weapons = sanitizeWeapons(u.characterId, u.weapons, (room.seed || 1) + u.seat);
    u.effStats = computeEffectiveStats(u);
    u.maxHp = u.effStats.maxHp;
    if (u.hp <= 0 || u.hp > u.maxHp) u.hp = wave === 1 ? u.maxHp : Math.max(1, Math.round(u.maxHp * 0.5));
    u.alive = u.hp > 0;
    u.weaponCds = u.weapons.map(() => 0.15);
  }
  return world;
}

function pushFx(world, ev) {
  world.fx.push({ id: world.nextEntityId++, ...ev });
  if (world.fx.length > 48) world.fx.splice(0, world.fx.length - 48);
}

function spawnEnemyInWorld(world, kindOverride = null, forced = false, activeCountCap = 12, posOverride = null) {
  if (!forced && world.enemies.length >= activeCountCap) return null;
  const kind = kindOverride || pickEnemyKindForWave(world.rng, world.wave);
  if (kind === 'ditch' && world.enemies.filter((e) => e.kind === 'ditch').length >= 2) return null;
  if (kind === 'attenuation' && world.enemies.filter((e) => e.kind === 'attenuation').length >= 2) return null;
  if (kind === 'pete' && world.enemies.some((e) => e.kind === 'pete')) return null;
  const base = ENEMY_CATALOG[kind] || ENEMY_CATALOG.lag;
  const hpMult = enemyHpMultiplier(world.wave, Boolean(base.elite));
  const dmgMult = enemyDamageMultiplier(world.wave, Boolean(base.elite));
  const edge = Math.floor(world.rng() * 4), pad = 28;
  const x = posOverride ? clamp(posOverride.x, 24, W - 24) : edge === 1 ? W - pad : edge === 3 ? pad : Math.round(pad + world.rng() * (W - pad * 2));
  const y = posOverride ? clamp(posOverride.y, 24, H - 24) : edge === 0 ? pad : edge === 2 ? H - pad : Math.round(pad + world.rng() * (H - pad * 2));
  const maxHp = Math.max(1, Math.round(base.hp * hpMult));
  const enemy = { id: world.nextEntityId++, kind: base.kind, name: base.name || base.kind, x, y, vx: 0, vy: 0, r: base.r, hp: maxHp, max: maxHp, speed: base.speed, damage: +(base.damage * dmgMult).toFixed(2), value: base.value, color: base.color, elite: Boolean(base.elite), boss: Boolean(base.boss), dirty: Boolean(base.dirty), knockbackResist: base.knockbackResist || 0, phase: 'chase', castCd: 2.2 + world.rng() * 1.5, windup: 0, aim: 0, cloneT: kind === 'pete' ? 18 : 0, sqPhase: 1, hitByShots: new Set() };
  world.enemies.push(enemy);
  if (enemy.boss) pushFx(world, { type: 'flash', text: enemy.kind === 'squirrel' ? 'FIBER-NIBBLING SQUIRREL IN THE TRENCH!' : 'R.O.U.S. DETECTED ON THE ROUTE!' });
  return enemy;
}

function damagePlayerSeat(world, u, rawDmg) {
  if (!u || !u.alive || u.hp <= 0 || u.inv > 0) return;
  const stats = u.effStats || computeEffectiveStats(u);
  if (world.rng() <= Math.min(0.5, stats.dodge || 0)) { u.inv = 0.25; return; }
  const reduced = Math.max(Math.ceil(rawDmg * 0.25), Math.max(2, rawDmg - (stats.armor || 0) * 1.5));
  const amount = reduced * (1 - Math.min(0.4, (stats.signalStrength || 0) * 0.003));
  u.hp = Math.max(0, +(u.hp - amount).toFixed(1));
  u.damageTaken = (u.damageTaken || 0) + amount;
  u.inv = 0.5;
  if (stats.hitSpeedBoost) u.hurtBoost = 2;
  pushFx(world, { type: 'hit_player', seat: u.seat, x: Math.round(u.x), y: Math.round(u.y), amount: Math.round(amount) });
  if (u.hp <= 0) {
    u.hp = 0; u.alive = false; u.specialTimer = 0;
    if (world.outageOwnerSeat === u.seat) { world.outageTimer = 0; world.outageOwnerSeat = null; }
    pushFx(world, { type: 'flash', text: `P${u.seat} ${u.name.toUpperCase()} DOWN — SURVIVE THE WAVE TO REVIVE!` });
  }
}

function killEnemyInWorld(world, room, seats, enemy, killerSeat) {
  const idx = world.enemies.indexOf(enemy);
  if (idx === -1) return;
  world.enemies.splice(idx, 1);
  const killer = seats.find((s) => s.seat === killerSeat) || seats[0];
  if (killer) {
    killer.kills = (killer.kills || 0) + 1;
    killer.killsByType = killer.killsByType || {};
    killer.killsByType[enemy.kind] = (killer.killsByType[enemy.kind] || 0) + 1;
    const kStats = killer.effStats || computeEffectiveStats(killer);
    if (kStats.cleaningKillsHeal && killer.alive && killer.hp > 0) {
      const before = killer.hp; killer.hp = Math.min(killer.maxHp, killer.hp + kStats.cleaningKillsHeal); killer.healed = (killer.healed || 0) + (killer.hp - before);
    }
    if (killer.characterId === 'isr' && killer.specialTimer > 0 && killer.alive && killer.hp > 0) {
      const before = killer.hp; killer.hp = Math.min(killer.maxHp, killer.hp + 5); killer.healed = (killer.healed || 0) + (killer.hp - before);
    }
  }
  room.teamKills = seats.reduce((sum, s) => sum + (s.kills || 0), 0);
  const cashMul = seats.some((s) => s.characterId === 'clone' && s.specialTimer > 0) ? 2 : 1;
  const kStats = killer?.effStats || BASE_STATS;
  const dropVal = (enemy.value + (world.rng() < (kStats.bonusSignal || 0) ? enemy.value : 0)) * cashMul;
  world.pickups.push({ id: world.nextEntityId++, x: Math.round(enemy.x), y: Math.round(enemy.y), value: dropVal });
  pushFx(world, { type: 'kill', x: Math.round(enemy.x), y: Math.round(enemy.y), color: enemy.color, kind: enemy.kind, seat: killer?.seat || 1 });
}

function hitEnemyInWorld(world, room, seats, enemy, baseDmg, color, attacker) {
  if (!enemy || enemy.hp <= 0) return;
  const stats = attacker?.effStats || BASE_STATS;
  const crit = world.rng() < (stats.crit || 0.05);
  let amount = baseDmg * (stats.damage || 1) * (crit ? 2 : 1) * (1 + (stats.spliceQuality || 0) * 0.004);
  if (enemy.dirty) amount *= 1 + (stats.cleanliness || 0) * 0.01;
  if (!enemy.boss && world.rng() < (stats.instakill || 0)) amount = enemy.hp + 1;
  enemy.hp = +(enemy.hp - amount).toFixed(2);
  if (attacker) {
    attacker.damageDealt = (attacker.damageDealt || 0) + amount;
    if (stats.lifeSteal && attacker.alive && attacker.hp > 0) {
      const before = attacker.hp; attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount * stats.lifeSteal); attacker.healed = (attacker.healed || 0) + (attacker.hp - before);
    }
  }
  if (crit && attacker) {
    const kb = ((stats.critKnockback || 0) + (stats.knockback || 0)) * (1 - Math.min(1, enemy.knockbackResist || 0));
    if (kb > 0) {
      const a = Math.atan2(enemy.y - attacker.y, enemy.x - attacker.x);
      enemy.x = clamp(enemy.x + Math.cos(a) * kb * 8, enemy.r, W - enemy.r);
      enemy.y = clamp(enemy.y + Math.sin(a) * kb * 8, enemy.r, H - enemy.r);
    }
  }
  pushFx(world, { type: 'dmg', x: Math.round(enemy.x), y: Math.round(enemy.y), value: Math.max(1, Math.round(amount)), crit, color });
  if (enemy.hp <= 0) killEnemyInWorld(world, room, seats, enemy, attacker?.seat || 1);
}

function nearestEnemyAt(world, x, y, maxRange) {
  let best = null, bestDist = maxRange;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= bestDist) { best = e; bestDist = d; }
  }
  return best;
}

function fireWeaponForPlayer(world, room, seats, u, w) {
  const stats = u.effStats || computeEffectiveStats(u);
  if (w.pattern === 'turret' && w.turret) {
    const cap = u.characterId === 'engineer' ? 3 : 2;
    if (world.turrets.filter((t) => t.ownerSeat === u.seat && t.wid === w.id).length >= cap) return;
    const a = world.rng() * Math.PI * 2;
    const dmgScale = (u.characterId === 'engineer' ? stats.damage : 1) * (1 + (stats.engineering || 0) * 0.02) * (1 + (stats.turretQuality || 0) * 0.004);
    world.turrets.push({ id: world.nextEntityId++, ownerSeat: u.seat, wid: w.id, mode: w.turret.mode || 'pellet', weaponTurret: true, color: w.color || '#f59e0b', x: clamp(u.x + Math.cos(a) * 26, 24, W - 24), y: clamp(u.y + Math.sin(a) * 26, 24, H - 24), r: 13, hp: 20 + (stats.engineering || 0) * 2, maxHp: 20 + (stats.engineering || 0) * 2, life: w.turret.life + (stats.engineering || 0) * 0.04, maxLife: w.turret.life + (stats.engineering || 0) * 0.04, fire: w.turret.fire / (u.characterId === 'engineer' ? stats.attackSpeed : 1), fireCd: 0.2, damage: w.damage * dmgScale, range: w.range || 300, haste: 0, lookA: 0 });
    return;
  }
  const reach = effectiveReachForWeapon(w, stats, u.viewport);
  const target = nearestEnemyAt(world, u.x, u.y, reach);
  if (!target) return;
  const angle = Math.atan2(target.y - u.y, target.x - u.x);
  u.side = target.x < u.x ? 'left' : 'right';
  u.attack = 0.35;
  const pattern = w.pattern || 'projectile';
  if (['melee', 'nova', 'cone', 'orbiting'].includes(pattern)) {
    const half = ['melee', 'cone'].includes(pattern) ? Math.PI / 3 : Math.PI;
    for (const e of [...world.enemies]) {
      if (Math.hypot(e.x - u.x, e.y - u.y) > reach + e.r) continue;
      if (half < Math.PI) {
        let diff = Math.atan2(e.y - u.y, e.x - u.x) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > half) continue;
      }
      hitEnemyInWorld(world, room, seats, e, w.damage, w.color, u);
    }
    if (w.heal && u.alive && u.hp > 0) {
      const before = u.hp; u.hp = Math.min(u.maxHp, u.hp + w.heal); u.healed = (u.healed || 0) + (u.hp - before);
    }
    pushFx(world, { type: 'area', seat: u.seat, x: Math.round(u.x), y: Math.round(u.y), reach: Math.round(reach), angle: +angle.toFixed(3), half: +half.toFixed(3), color: w.color });
    return;
  }
  const spawnShot = (ang) => {
    const speed = pattern === 'thrown' ? 380 : 540;
    world.shots.push({ id: world.nextEntityId++, ownerSeat: u.seat, x: u.x, y: u.y - 16, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: pattern === 'beam' ? 7 : 5, damage: w.damage, color: w.color || '#38bdf8', pattern, pierce: ['pierce', 'beam', 'beamSweep'].includes(pattern), pen: Math.round(stats.pierce || 0), mortar: false, remaining: reach, maxReach: reach });
  };
  spawnShot(angle);
  if (pattern === 'chain') { spawnShot(angle - 0.16); spawnShot(angle + 0.16); }
}

function triggerPlayerSpecial(world, room, seats, u) {
  if (!u || !u.alive || u.hp <= 0 || u.specialCooldown > 0) return false;
  const spec = CHARACTER_SPECS[u.characterId] || CHARACTER_SPECS.oracle;
  const special = spec.special;
  if (!special) return false;
  u.specialCooldown = special.cooldown;
  u.specialTimer = special.duration || 0.6;
  const stats = u.effStats || computeEffectiveStats(u);
  if (special.id === 'sprint') {
    const before = u.hp; u.hp = Math.min(u.maxHp, u.hp + 40); u.healed = (u.healed || 0) + (u.hp - before);
    for (const peer of seats) if (peer.seat !== u.seat && peer.alive && peer.hp > 0) { const pb = peer.hp; peer.hp = Math.min(peer.maxHp, peer.hp + 18); peer.healed = (peer.healed || 0) + (peer.hp - pb); }
  } else if (special.id === 'clause') {
    u.clauseFired = false;
  } else if (special.id === 'trace') {
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI * 2) / 12;
      world.shots.push({ id: world.nextEntityId++, ownerSeat: u.seat, x: u.x, y: u.y - 14, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 7, damage: 90, color: '#c084fc', pattern: 'pierce', pierce: true, pen: 99, mortar: false, remaining: 380, maxReach: 380 });
    }
  } else if (special.id === 'crew') {
    for (let idx = 0; idx < 4; idx++) {
      const a = (idx * Math.PI) / 2;
      world.turrets.push({ id: world.nextEntityId++, ownerSeat: u.seat, wid: `signature-don-${idx}`, mode: 'helper', helperIndex: idx, weaponTurret: false, color: '#38bdf8', x: clamp(u.x + Math.cos(a) * 28, 24, W - 24), y: clamp(u.y + Math.sin(a) * 28, 24, H - 24), r: 13, hp: 45 + (stats.engineering || 0) * 3, maxHp: 45 + (stats.engineering || 0) * 3, life: 8, maxLife: 8, fire: 0.45, fireCd: 0.15, damage: 18 * (1 + (stats.engineering || 0) * 0.01), range: 280, haste: 0, lookA: 0 });
    }
  } else if (special.id === 'meeting') {
    world.meeting = { ownerSeat: u.seat, x: clamp(u.x + 80, 90, W - 90), y: clamp(u.y, 90, H - 90), timer: 4, radius: 220 };
  } else if (special.id === 'surge') {
    world.surge = { ownerSeat: u.seat, x: clamp(u.x, 36, W - 36), y: clamp(u.y, 36, H - 36), timer: 4.8, pulse: 0, radius: 210 };
  } else if (special.id === 'outage') {
    world.outageTimer = 8; world.outageOwnerSeat = u.seat;
  }
  pushFx(world, { type: 'special', seat: u.seat, specialId: special.id, label: `${u.name}: ${special.name.toUpperCase()}`, x: Math.round(u.x), y: Math.round(u.y) });
  return true;
}

function triggerPlayerDeploy(world, u, deployIndex = 0) {
  if (!u || !u.alive || u.hp <= 0) return false;
  const list = u.deployables || [];
  if (!list.length) return false;
  const idx = clamp(deployIndex, 0, list.length - 1);
  const item = list[idx];
  const def = STRUCTURE_CATALOG[item?.structure];
  if (!def || (u.deployCds?.[item.structure] || 0) > 0) return false;
  const stats = u.effStats || computeEffectiveStats(u);
  const totalCap = u.characterId === 'engineer' ? 12 : 2;
  const itemCap = u.characterId === 'engineer' ? 3 : item.unique ? 1 : 2;
  const myStructs = world.structures.filter((s) => s.ownerSeat === u.seat);
  if (myStructs.length >= totalCap || myStructs.filter((s) => s.type === item.structure).length >= itemCap) return false;
  if (world.structures.some((s) => Math.hypot(s.x - u.x, s.y - u.y) < 90)) return false;
  const cdMult = u.characterId === 'engineer' ? 0.45 : 1;
  const stacks = clamp(item.stacks || 1, 1, 2);
  u.deployCds = u.deployCds || {};
  u.deployCds[item.structure] = def.cd * (1 - 0.12 * (stacks - 1)) * cdMult;
  world.structures.push({ id: world.nextEntityId++, ownerSeat: u.seat, type: item.structure, x: clamp(Math.round(u.x), 30, W - 30), y: clamp(Math.round(u.y), 30, H - 30), r: def.r, life: def.life + (stats.engineering || 0) * 0.06, maxLife: def.life + (stats.engineering || 0) * 0.06, power: stacks, uses: def.uses || 0, rearm: 0, fireCd: 0.25, haste: 0, lookA: 0 });
  pushFx(world, { type: 'deploy', seat: u.seat, structure: item.structure, x: Math.round(u.x), y: Math.round(u.y) });
  return true;
}

function stepCombatWorld(world, room, seats, dt) {
  if (!world || room.phase !== 'combat') return { ended: false };
  world.seq += 1;
  world.time = Math.max(0, world.time - dt);
  if (world.outageTimer > 0) world.outageTimer = Math.max(0, world.outageTimer - dt);
  const livingSeats = seats.filter((s) => s.alive && s.hp > 0);
  if (!livingSeats.length) return { ended: true, won: false };

  if (world.meeting) {
    world.meeting.timer -= dt;
    if (world.meeting.timer <= 0) {
      const m = world.meeting; world.meeting = null;
      const owner = seats.find((s) => s.seat === m.ownerSeat) || livingSeats[0];
      const totalBase = (owner?.weapons || []).reduce((sum, w) => sum + (w.damage || 12), 0) * 8;
      const targets = world.enemies.filter((e) => Math.hypot(e.x - m.x, e.y - m.y) <= m.radius + e.r);
      if (targets.length) {
        const share = totalBase / targets.length;
        for (const t of targets) hitEnemyInWorld(world, room, seats, t, share, '#fbbf24', owner);
      }
      pushFx(world, { type: 'area', seat: m.ownerSeat, x: m.x, y: m.y, reach: m.radius, angle: 0, half: Math.PI, color: '#fbbf24' });
    }
  }

  if (world.surge) {
    world.surge.timer -= dt;
    const elapsed = 4.8 - Math.max(0, world.surge.timer);
    const pulseTimes = [0.8, 1.8, 2.8, 3.8];
    const owner = seats.find((s) => s.seat === world.surge.ownerSeat) || livingSeats[0];
    while (world.surge.pulse < 4 && elapsed >= pulseTimes[world.surge.pulse]) {
      world.surge.pulse += 1;
      const dmg = 28 + (world.wave - 1) * 4;
      for (const e of [...world.enemies]) if (Math.hypot(e.x - world.surge.x, e.y - world.surge.y) <= world.surge.radius + e.r) hitEnemyInWorld(world, room, seats, e, dmg, '#7fe6f9', owner);
      for (const t of world.turrets) { t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.2); t.haste = 5; }
      for (const st of world.structures) if (st.type === 'turretMount') st.haste = 5;
      pushFx(world, { type: 'area', seat: world.surge.ownerSeat, x: world.surge.x, y: world.surge.y, reach: world.surge.radius, angle: 0, half: Math.PI, color: '#7fe6f9' });
    }
    if (world.surge.timer <= 0) world.surge = null;
  }

  for (let i = world.puddles.length - 1; i >= 0; i--) {
    world.puddles[i].life -= dt;
    if (world.puddles[i].life <= 0) world.puddles.splice(i, 1);
  }
  world.puddleTickCd -= dt;
  const doPuddleTick = world.puddleTickCd <= 0;
  if (doPuddleTick) world.puddleTickCd += 0.5;

  for (const u of seats) {
    if (!u.alive || u.hp <= 0) continue;
    const stats = u.effStats || computeEffectiveStats(u);
    u.inv = Math.max(0, (u.inv || 0) - dt);
    u.hurtBoost = Math.max(0, (u.hurtBoost || 0) - dt);
    u.attack = Math.max(0, (u.attack || 0) - dt);
    u.specialCooldown = Math.max(0, (u.specialCooldown || 0) - dt);
    u.specialTimer = Math.max(0, (u.specialTimer || 0) - dt);

    if (u.characterId === 'veteran' && u.specialTimer > 0 && !u.clauseFired && 3 - u.specialTimer >= 2.5) {
      u.clauseFired = true;
      const totalBase = (u.weapons || []).reduce((sum, w) => sum + (w.damage || 15), 0) * 30;
      const inRange = world.enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= 260 + e.r);
      if (inRange.length) {
        const share = totalBase / inRange.length;
        for (const e of inRange) hitEnemyInWorld(world, room, seats, e, e.boss ? share * 0.5 : share, '#fde68a', u);
      }
      pushFx(world, { type: 'area', seat: u.seat, x: Math.round(u.x), y: Math.round(u.y), reach: 260, angle: 0, half: Math.PI, color: '#fbbf24' });
    }

    for (const k of Object.keys(u.deployCds || {})) if (u.deployCds[k] > 0) u.deployCds[k] = Math.max(0, u.deployCds[k] - dt);

    u.regenAcc = (u.regenAcc || 0) + dt * (stats.regen || 0);
    if (u.regenAcc >= 1) {
      const gain = Math.floor(u.regenAcc); u.regenAcc -= gain;
      const before = u.hp; u.hp = Math.min(u.maxHp, u.hp + gain); u.healed = (u.healed || 0) + (u.hp - before);
    }

    const inPuddle = world.puddles.some((d) => Math.hypot(u.x - d.x, u.y - d.y) < 48);
    if (doPuddleTick && inPuddle && u.inv <= 0) {
      const mit = Math.min(0.5, Math.max(-0.35, (stats.cleanliness || 0) * 0.008));
      damagePlayerSeat(world, u, 6 * (1 - mit));
    }

    const ix = clamp(u.ix || 0, -1, 1), iy = clamp(u.iy || 0, -1, 1);
    if (ix || iy) {
      const mag = Math.hypot(ix, iy) || 1;
      const specMult = u.specialTimer > 0 ? (u.characterId === 'nomad' ? 1.8 : u.characterId === 'veteran' ? 0.3 : 1) : 1;
      const boost = specMult * (u.hurtBoost > 0 ? 1.3 : 1) * (inPuddle ? 0.65 : 1);
      u.vx = (ix / mag) * stats.speed * boost;
      u.vy = (iy / mag) * stats.speed * boost;
      u.x = clamp(u.x + u.vx * dt, 17, W - 17);
      u.y = clamp(u.y + u.vy * dt, 17, H - 17);
      if (Math.abs(ix) > 0.05) u.side = ix < 0 ? 'left' : 'right';
      u.moving = true;
    } else {
      u.vx = 0; u.vy = 0; u.moving = false;
    }

    let pedestalBuff = 0;
    for (const st of world.structures) if (st.type === 'pedestal' && Math.hypot(u.x - st.x, u.y - st.y) <= st.r) pedestalBuff = Math.max(pedestalBuff, 0.25 + 0.05 * ((st.power || 1) - 1));

    if (!Array.isArray(u.weaponCds) || u.weaponCds.length !== u.weapons.length) u.weaponCds = u.weapons.map(() => 0.15);
    for (let i = 0; i < u.weapons.length; i++) {
      u.weaponCds[i] -= dt;
      if (u.weaponCds[i] <= 0) {
        const w = u.weapons[i];
        u.weaponCds[i] = Math.max(0.1, (w.rate || 0.8) / ((stats.attackSpeed || 1) * (1 + pedestalBuff)));
        fireWeaponForPlayer(world, room, seats, u, w);
      }
    }
  }

  if (!world.bossSpawned && world.wave % 5 === 0) {
    world.bossSpawned = true;
    spawnEnemyInWorld(world, world.wave % 20 === 0 ? 'squirrel' : 'rous', true, 99);
  }

  const activeCap = maxActiveEnemies(world.wave, seats.length);
  world.spawnCd -= dt;
  if (world.spawnCd <= 0) {
    if (world.enemies.length < activeCap) spawnEnemyInWorld(world, null, false, activeCap);
    world.spawnCd = spawnInterval(world.wave, seats.length);
  }

  for (let i = world.structures.length - 1; i >= 0; i--) {
    const st = world.structures[i];
    st.life -= dt; st.rearm = Math.max(0, (st.rearm || 0) - dt); st.haste = Math.max(0, (st.haste || 0) - dt);
    if (st.life <= 0) { world.structures.splice(i, 1); continue; }
    if (st.type === 'turretMount') {
      st.fireCd -= dt * (st.haste > 0 ? 1.3 : 1);
      if (st.fireCd <= 0) {
        const owner = seats.find((s) => s.seat === st.ownerSeat) || livingSeats[0];
        const oStats = owner?.effStats || BASE_STATS;
        const target = nearestEnemyAt(world, st.x, st.y, 260);
        if (target) {
          const ang = Math.atan2(target.y - st.y, target.x - st.x);
          st.lookA = ang;
          const dmg = 9 * (1 + 0.2 * ((st.power || 1) - 1)) * (1 + (oStats.engineering || 0) * 0.02);
          world.shots.push({ id: world.nextEntityId++, ownerSeat: st.ownerSeat, x: st.x, y: st.y - 14, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, r: 5, damage: dmg, color: '#f59e0b', pattern: 'projectile', pierce: false, pen: 0, mortar: false, remaining: 260, maxReach: 260 });
          st.fireCd = 0.45;
        } else st.fireCd = 0.15;
      }
    }
  }

  for (let i = world.turrets.length - 1; i >= 0; i--) {
    const t = world.turrets[i];
    t.life -= dt; t.haste = Math.max(0, (t.haste || 0) - dt);
    if (t.mode === 'helper') {
      const owner = seats.find((s) => s.seat === t.ownerSeat);
      if (owner && owner.alive) {
        const a = ((t.helperIndex || 0) * Math.PI) / 2;
        t.x += (owner.x + Math.cos(a) * 38 - t.x) * Math.min(1, dt * 4);
        t.y += (owner.y + Math.sin(a) * 38 - t.y) * Math.min(1, dt * 4);
      }
    }
    if (t.life <= 0 || t.hp <= 0) { world.turrets.splice(i, 1); continue; }
    t.fireCd -= dt * (t.haste > 0 ? 1.3 : 1);
    if (t.fireCd <= 0) {
      const reach = Math.min(340, (t.range || 280) * 0.65);
      const target = nearestEnemyAt(world, t.x, t.y, reach);
      if (target) {
        const ang = Math.atan2(target.y - t.y, target.x - t.x);
        t.lookA = ang; t.fireCd = t.fire || 0.5;
        const launchTurretShot = (a, speed, pattern, mortar = false) => {
          world.shots.push({ id: world.nextEntityId++, ownerSeat: t.ownerSeat, x: t.x, y: t.y - 12, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: t.mode === 'helper' ? 7 : 5, damage: t.damage, color: t.color, pattern, pierce: pattern === 'pierce', pen: pattern === 'pierce' ? 3 : 0, mortar, remaining: reach, maxReach: reach });
        };
        if (t.mode === 'mortar') launchTurretShot(ang, 280, 'mortar', true);
        else if (t.mode === 'pulse') launchTurretShot(ang, 620, 'pierce', false);
        else if (t.mode === 'spread') { for (let k = -2; k <= 2; k++) launchTurretShot(ang + k * 0.22, 480, 'projectile', false); }
        else launchTurretShot(ang, 520, 'projectile', false);
      } else t.fireCd = 0.12;
    }
  }

  for (let i = world.shots.length - 1; i >= 0; i--) {
    const s = world.shots[i];
    const stepDist = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.remaining -= stepDist;
    const owner = seats.find((u) => u.seat === s.ownerSeat) || livingSeats[0];
    let removeShot = false;
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      if (!e || e.hp <= 0 || e.hitByShots.has(s.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) <= e.r + s.r + 4) {
        e.hitByShots.add(s.id);
        if (s.mortar) {
          for (const ao of [...world.enemies]) if (Math.hypot(ao.x - s.x, ao.y - s.y) <= 55 + ao.r) hitEnemyInWorld(world, room, seats, ao, s.damage, s.color, owner);
          pushFx(world, { type: 'area', seat: s.ownerSeat, x: Math.round(s.x), y: Math.round(s.y), reach: 55, angle: 0, half: Math.PI, color: s.color });
          removeShot = true; break;
        }
        hitEnemyInWorld(world, room, seats, e, s.damage, s.color, owner);
        if (!s.pierce) {
          if (s.pen > 0) s.pen -= 1;
          else { removeShot = true; break; }
        }
      }
    }
    if (removeShot || s.remaining <= 0 || s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) world.shots.splice(i, 1);
  }

  for (let i = world.foeShots.length - 1; i >= 0; i--) {
    const f = world.foeShots[i];
    f.x += f.vx * dt; f.y += f.vy * dt; f.remaining -= Math.hypot(f.vx, f.vy) * dt;
    let hitPlayer = false;
    for (const u of livingSeats) {
      if (u.inv <= 0 && Math.hypot(u.x - f.x, u.y - f.y) <= 17 + f.r) { damagePlayerSeat(world, u, f.damage); hitPlayer = true; break; }
    }
    if (hitPlayer || f.remaining <= 0 || f.x < -50 || f.x > W + 50 || f.y < -50 || f.y > H + 50) world.foeShots.splice(i, 1);
  }

  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (!e || e.hp <= 0) continue;
    let tgt = world.meeting;
    if (!tgt) {
      let bestD = Infinity;
      for (const u of livingSeats) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < bestD) { bestD = d; tgt = u; } }
    }
    if (!tgt) continue;

    if (e.kind === 'pete') {
      e.cloneT -= dt;
      if (e.cloneT <= 0) {
        e.cloneT = 18;
        if (world.enemies.filter((o) => o.kind === 'peteMini').length < 5) spawnEnemyInWorld(world, 'peteMini', true, 99, { x: e.x + 24, y: e.y + 24 });
      }
    }
    if (e.kind === 'packet') {
      e.castCd -= dt;
      if (e.castCd <= 0 && world.puddles.length < 10) {
        e.castCd = 6.5;
        world.puddles.push({ id: world.nextEntityId++, x: Math.round(e.x), y: Math.round(e.y), life: 9, maxLife: 9 });
      }
    }
    if (e.kind === 'bend' || e.kind === 'squirrel' || e.kind === 'ditch') {
      e.castCd -= dt;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          e.phase = 'chase';
          const ang = e.aim || Math.atan2(tgt.y - e.y, tgt.x - e.x);
          if (e.kind === 'bend') world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, r: 22, damage: e.damage, remaining: 280, ring: true, rock: false });
          else if (e.kind === 'ditch') { for (let k = -1; k <= 1; k++) { const a = ang + k * 0.26; world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 9, damage: e.damage * 0.85, remaining: 260, ring: false, rock: true }); } }
          else if (e.kind === 'squirrel') { for (let k = -2; k <= 2; k++) { const a = ang + k * 0.18; world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 6, damage: e.damage * 0.75, remaining: 310, ring: false, rock: false }); } }
        }
      } else if (e.castCd <= 0 && Math.hypot(tgt.x - e.x, tgt.y - e.y) < 320) {
        e.windup = 0.85; e.castCd = 4.2; e.phase = 'windup'; e.aim = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      }
    }
    if (e.kind === 'squirrel' && e.hp <= e.max * 0.5) e.sqPhase = 2;

    let slowMul = world.outageTimer > 0 ? 0.25 : 1;
    for (let sIdx = world.structures.length - 1; sIdx >= 0; sIdx--) {
      const st = world.structures[sIdx];
      const dist = Math.hypot(e.x - st.x, e.y - st.y);
      if (st.type === 'barricade' && dist < st.r + e.r) {
        const push = (st.r + e.r - dist) * 0.6, ba = Math.atan2(e.y - st.y, e.x - st.x);
        e.x += Math.cos(ba) * push; e.y += Math.sin(ba) * push;
      } else if (st.type === 'ratTrap' && st.rearm <= 0 && st.uses > 0 && dist < st.r + e.r) {
        st.rearm = 0.7; st.uses -= 1;
        const owner = seats.find((u) => u.seat === st.ownerSeat) || livingSeats[0];
        hitEnemyInWorld(world, room, seats, e, 26 * (1 + 0.2 * ((st.power || 1) - 1)), '#f87171', owner);
        if (st.uses <= 0) world.structures.splice(sIdx, 1);
      } else if (st.type === 'snare' && dist < st.r) slowMul = Math.min(slowMul, 0.55);
    }
    if (e.hp <= 0) continue;

    const ang = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    const spd = e.windup > 0 ? 0 : e.speed * slowMul;
    e.vx = Math.cos(ang) * spd; e.vy = Math.sin(ang) * spd;
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, H - e.r);

    for (let j = Math.max(0, i - 10); j < i; j++) {
      const o = world.enemies[j];
      if (!o || o.hp <= 0) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d2 = dx * dx + dy * dy, minD = e.r + o.r;
      if (d2 > 0 && d2 < minD * minD) {
        const d = Math.sqrt(d2), push = (minD - d) * 0.2;
        e.x = clamp(e.x + (dx / d) * push, e.r, W - e.r);
        e.y = clamp(e.y + (dy / d) * push, e.r, H - e.r);
      }
    }

    if (!world.meeting) {
      for (const u of livingSeats) {
        if (u.inv <= 0 && Math.hypot(u.x - e.x, u.y - e.y) < 17 + e.r) {
          const stats = u.effStats || BASE_STATS;
          if (stats.firstHitBlocked && !u.firstBlockUsed) {
            u.firstBlockUsed = true; u.inv = 0.55;
            pushFx(world, { type: 'flash', seat: u.seat, text: 'FIRST HIT POLITELY DECLINED' });
          } else damagePlayerSeat(world, u, e.damage);
        }
      }
    }
  }

  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const d = world.pickups[i];
    let collector = null, nearestD = Infinity;
    for (const u of livingSeats) {
      const dist = Math.hypot(u.x - d.x, u.y - d.y);
      if (dist < nearestD) { nearestD = dist; collector = u; }
    }
    if (collector && nearestD < 130) {
      d.x += (collector.x - d.x) * Math.min(1, dt * 8);
      d.y += (collector.y - d.y) * Math.min(1, dt * 8);
    }
    if (collector && nearestD < 28) {
      world.pickups.splice(i, 1);
      for (const peer of seats) {
        peer.signal = (peer.signal || 0) + d.value;
        peer.earnedSignal = (peer.earnedSignal || 0) + d.value;
        const xpGain = d.value * 0.65;
        peer.xp = (peer.xp || 0) + xpGain;
        while (peer.xp >= signalForLevel((peer.level || 0) + (peer.pendingLevels || 0))) {
          peer.xp -= signalForLevel((peer.level || 0) + (peer.pendingLevels || 0));
          peer.pendingLevels = (peer.pendingLevels || 0) + 1;
        }
      }
      room.teamSignal = seats.reduce((sum, s) => sum + Math.round(s.signal || 0), 0);
    }
  }

  if (!seats.some((s) => s.alive && s.hp > 0)) return { ended: true, won: false };
  if (world.time <= 0) return { ended: true, won: true };
  return { ended: false };
}

function serializeCombatWorld(world, seats) {
  if (!world) return null;
  let boss = null;
  for (const e of world.enemies) {
    if (e.boss && e.hp > 0) {
      boss = { id: e.id, kind: e.kind, name: e.name, hp: Math.round(e.hp), max: Math.round(e.max), phase: e.sqPhase || 1 };
      break;
    }
  }
  const fx = world.fx.splice(0, world.fx.length);
  return {
    seq: world.seq,
    wave: world.wave,
    time: +world.time.toFixed(2),
    duration: world.duration,
    outageTimer: +world.outageTimer.toFixed(2),
    meeting: world.meeting ? { ...world.meeting } : null,
    surge: world.surge ? { ...world.surge } : null,
    boss,
    players: seats.map((u) => ({
      seat: u.seat, name: u.name, characterId: u.characterId, alive: u.alive,
      x: Math.round(u.x), y: Math.round(u.y), vx: Math.round(u.vx || 0), vy: Math.round(u.vy || 0),
      hp: +Number(u.hp || 0).toFixed(1), maxHp: u.maxHp, side: u.side || 'right', moving: Boolean(u.moving),
      attack: +(u.attack || 0).toFixed(2), special: +(u.specialTimer || 0).toFixed(2), specialCooldown: +(u.specialCooldown || 0).toFixed(2),
      kills: u.kills || 0, signal: Math.round(u.signal || 0), earnedSignal: Math.round(u.earnedSignal || 0),
      xp: +(u.xp || 0).toFixed(2), level: (u.level || 0) + (u.pendingLevels || 0), pendingLevels: u.pendingLevels || 0,
      damageDealt: Math.round(u.damageDealt || 0), healed: Math.round(u.healed || 0), damageTaken: Math.round(u.damageTaken || 0),
      deployCds: { ...(u.deployCds || {}) }, weapons: u.weapons || []
    })),
    enemies: world.enemies.map((e) => ({ id: e.id, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), vx: Math.round(e.vx || 0), vy: Math.round(e.vy || 0), r: e.r, hp: Math.round(e.hp), max: Math.round(e.max), color: e.color, elite: e.elite, boss: e.boss, phase: e.phase, sqPhase: e.sqPhase || 1 })),
    shots: world.shots.map((s) => ({ id: s.id, seat: s.ownerSeat, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx), vy: Math.round(s.vy), r: s.r, color: s.color, pattern: s.pattern, mortar: s.mortar })),
    foeShots: world.foeShots.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), vx: Math.round(f.vx), vy: Math.round(f.vy), r: f.r, ring: f.ring, rock: f.rock })),
    turrets: world.turrets.map((t) => ({ id: t.id, seat: t.ownerSeat, mode: t.mode, helperIndex: t.helperIndex || 0, weaponTurret: t.weaponTurret, x: Math.round(t.x), y: Math.round(t.y), hp: Math.round(t.hp), maxHp: Math.round(t.maxHp), life: +t.life.toFixed(2), maxLife: t.maxLife, color: t.color, lookA: +t.lookA.toFixed(2) })),
    structures: world.structures.map((st) => ({ id: st.id, seat: st.ownerSeat, type: st.type, x: Math.round(st.x), y: Math.round(st.y), r: st.r, life: +st.life.toFixed(2), maxLife: st.maxLife, lookA: +st.lookA.toFixed(2) })),
    pickups: world.pickups.map((d) => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), value: d.value })),
    puddles: world.puddles.map((p) => ({ id: p.id, x: p.x, y: p.y, life: +p.life.toFixed(2), maxLife: p.maxLife })),
    fx
  };
}

export default class CoopRoom extends Actor {
  users = new Map();
  disconnectedSeats = new Map();
  chat = [];
  world = null;
  simTimer = null;
  lastSimAt = 0;

  room = {
    roomId: null,
    runId: null,
    revision: 1,
    phase: 'lobby',
    wave: 1,
    seed: Math.floor(Math.random() * 0x7fffffff) || 1,
    arenaChoice: 'random',
    arenaTheme: 'office',
    hostSeat: 1,
    registryId: null,
    title: 'Field Crew Shift',
    teamKills: 0,
    teamSignal: 0,
    updatedAt: Date.now()
  };

  async handleStart() {
    const savedRoom = await this.storage.get('room');
    if (savedRoom) this.room = { ...this.room, ...savedRoom };
    else this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, null);

    const savedSeats = await this.storage.get('seats');
    if (Array.isArray(savedSeats)) this.users = new Map(savedSeats);

    const savedChat = await this.storage.get('chat');
    if (Array.isArray(savedChat)) this.chat = savedChat.slice(-25);

    const liveIds = new Set(this.getConnections().map((c) => c.id));
    for (const [key, u] of this.users.entries()) {
      const cid = u.connId || key;
      if (liveIds.has(cid)) {
        u.connId = cid;
        u.connected = true;
        u.disconnectedAt = null;
      } else if (this.room.phase === 'lobby') {
        this.disconnectedSeats.set(key, { seatObj: u, expiresAt: Date.now() + 30000 });
        this.users.delete(key);
      } else {
        u.connected = false;
        u.disconnectedAt = u.disconnectedAt || Date.now();
      }
    }
    this.ensureHostSeat();
    if (this.room.phase === 'combat') {
      if (!this.world) this.world = createCombatWorld(this.room, [...this.users.values()]);
      this.ensureSimLoop();
    }
  }

  pruneExpiredDisconnected() {
    const now = Date.now();
    for (const [k, entry] of this.disconnectedSeats.entries()) {
      if (now > entry.expiresAt) this.disconnectedSeats.delete(k);
    }
  }

  ensureHostSeat() {
    const connectedSeats = [...this.users.values()].filter((u) => u.connected !== false).map((u) => u.seat).sort((a, b) => a - b);
    const allSeats = [...this.users.values()].map((u) => u.seat).sort((a, b) => a - b);
    const pool = connectedSeats.length ? connectedSeats : allSeats;
    if (!pool.length) this.room.hostSeat = 1;
    else if (!pool.includes(this.room.hostSeat)) this.room.hostSeat = pool[0];
  }

  findExistingSeatForConn(conn) {
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    const liveIds = new Set(this.getConnections().map((c) => c.id));

    for (const u of this.users.values()) {
      if (u.connId === conn.id && (!u.userId || !authUserId || u.userId === authUserId)) {
        return { seatObj: u, restoredFromCache: false };
      }
    }
    if (authUserId) {
      for (const u of this.users.values()) {
        if (u.userId === authUserId && (!u.connId || !liveIds.has(u.connId) || u.connId === conn.id)) {
          return { seatObj: u, restoredFromCache: false };
        }
      }
    }
    for (const [key, entry] of this.disconnectedSeats.entries()) {
      const u = entry.seatObj;
      const sameConn = u.connId === conn.id && (!u.userId || !authUserId || u.userId === authUserId);
      const sameUser = Boolean(authUserId && u.userId === authUserId);
      if (sameConn || sameUser) {
        this.disconnectedSeats.delete(key);
        return { seatObj: u, restoredFromCache: true };
      }
    }
    return null;
  }

  allocateSeatNumber(preferred = null) {
    const taken = new Set([...this.users.values()].map((u) => u.seat));
    if (preferred && preferred >= 1 && preferred <= MAX_USERS && !taken.has(preferred)) return preferred;
    for (let s = 1; s <= MAX_USERS; s++) if (!taken.has(s)) return s;
    return null;
  }

  createFreshSeat(seat, conn) {
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    const spawnAngle = ((seat - 1) * Math.PI) / 2;
    const spec = CHARACTER_SPECS.oracle;
    return {
      seat,
      seatKey: `seat-${seat}`,
      connId: conn.id,
      userId: authUserId,
      connected: true,
      disconnectedAt: null,
      name: `Tech #${seat}`,
      characterId: 'oracle',
      useAlt: false,
      ready: false,
      kitConfirmed: false,
      intermissionReady: false,
      waveDone: false,
      alive: true,
      x: Math.round(550 + Math.cos(spawnAngle) * 54),
      y: Math.round(400 + Math.sin(spawnAngle) * 54),
      vx: 0, vy: 0, ix: 0, iy: 0,
      hp: spec.stats.maxHp, maxHp: spec.stats.maxHp,
      level: 0, pendingLevels: 0, xp: 0,
      kills: 0, killsByType: {}, signal: 0, earnedSignal: 0,
      damageDealt: 0, damageTaken: 0, healed: 0,
      side: 'right', moving: false, attack: 0,
      specialCooldown: 0, specialTimer: 0, deployCds: {},
      weapons: sanitizeWeapons('oracle', null, this.room.seed + seat),
      items: [], deployables: [], statMods: [],
      effStats: { ...spec.stats },
      viewport: { width: 1100, height: 800 },
      processedActions: []
    };
  }

  async handleConnect(conn) {
    this.cancelSchedule('cleanup');
    this.pruneExpiredDisconnected();

    const existing = this.findExistingSeatForConn(conn);
    let me = null;

    if (existing) {
      me = existing.seatObj;
      if (existing.restoredFromCache) {
        if (this.users.size >= MAX_USERS) {
          conn.send({ type: 'room_error', code: 'room_full', message: 'Shift crew is full (max 4 technicians).' });
          conn.reject(4001, 'Shift crew is full (max 4 technicians)');
          return;
        }
        const assignedSeat = this.allocateSeatNumber(me.seat) || 1;
        me.seat = assignedSeat;
        me.seatKey = `seat-${assignedSeat}`;
        this.users.set(me.seatKey, me);
      }
      me.connId = conn.id;
      if (conn.identity?.type === 'authenticated' && conn.identity.userId) me.userId = conn.identity.userId;
      me.connected = true;
      me.disconnectedAt = null;
    } else {
      if (this.room.phase !== 'lobby') {
        conn.send({ type: 'room_error', code: 'match_already_started', message: 'This shift has already launched and cannot accept late joiners.' });
        conn.reject(4002, 'Shift already in progress');
        return;
      }
      if (this.users.size >= MAX_USERS) {
        conn.send({ type: 'room_error', code: 'room_full', message: 'Shift crew is full (max 4 technicians).' });
        conn.reject(4001, 'Shift crew is full (max 4 technicians)');
        return;
      }
      const seat = this.allocateSeatNumber();
      if (!seat) {
        conn.reject(4001, 'Shift crew is full');
        return;
      }
      me = this.createFreshSeat(seat, conn);
      this.users.set(me.seatKey, me);
    }

    this.ensureHostSeat();
    this.room.revision = (this.room.revision || 0) + 1;
    this.room.updatedAt = Date.now();

    conn.send({
      type: 'welcome',
      roomId: this.room.roomId,
      seat: me.seat,
      room: this.publicRoom(),
      users: this.publicUsers(),
      world: this.world ? serializeCombatWorld(this.world, [...this.users.values()]) : null,
      chat: this.chat
    });
    this.broadcastPresence();

    if (this.room.phase === 'combat') this.ensureSimLoop();

    await this.saveState();
    await this.syncRegistry();
  }

  getSeatByConn(conn) {
    for (const u of this.users.values()) {
      if (u.connId === conn.id) return u;
    }
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    if (authUserId) {
      for (const u of this.users.values()) {
        if (u.userId === authUserId) {
          u.connId = conn.id;
          return u;
        }
      }
    }
    return null;
  }

  hasProcessedAction(u, actionId) {
    if (!actionId || typeof actionId !== 'string') return false;
    u.processedActions = u.processedActions || [];
    if (u.processedActions.includes(actionId)) return true;
    u.processedActions.push(actionId);
    if (u.processedActions.length > 60) u.processedActions.splice(0, u.processedActions.length - 60);
    return false;
  }

  async handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const u = this.getSeatByConn(conn);
    if (!u) return;

    if (msg.type === 'init_room' || msg.type === 'join_room') {
      if (typeof msg.roomId === 'string' && msg.roomId.trim() && !this.room.roomId) {
        this.room.roomId = msg.roomId.trim().slice(0, 64);
      }
      if (msg.type === 'init_room' && u.seat === this.room.hostSeat && this.room.phase === 'lobby') {
        if (!this.room.registryId && typeof msg.registryId === 'string' && /^[a-f0-9]{24}$/i.test(msg.registryId) && (!msg.roomId || msg.registryId === msg.roomId)) {
          this.room.registryId = msg.registryId;
          this.room.roomId = msg.registryId;
        }
        if (typeof msg.title === 'string' && msg.title.trim()) this.room.title = msg.title.trim().slice(0, 48);
        if (typeof msg.arenaChoice === 'string' && VALID_CHOICES.has(msg.arenaChoice)) {
          this.room.arenaChoice = msg.arenaChoice;
          this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, null);
        }
      }
      if (typeof msg.name === 'string' && msg.name.trim()) u.name = msg.name.trim().slice(0, 28);
      if (!u.ready && this.room.phase === 'lobby') {
        if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) {
          u.characterId = msg.characterId;
          const spec = CHARACTER_SPECS[u.characterId];
          u.maxHp = spec.stats.maxHp;
          u.hp = spec.stats.maxHp;
          u.weapons = sanitizeWeapons(u.characterId, null, this.room.seed + u.seat);
          u.effStats = computeEffectiveStats(u);
        }
        if (typeof msg.useAlt === 'boolean') u.useAlt = msg.useAlt;
      }
      this.room.revision = (this.room.revision || 0) + 1;
      this.room.updatedAt = Date.now();
      this.broadcastPresence();
      await this.saveState();
      await this.syncRegistry();
      return;
    }

    if (msg.type === 'select_character') {
      if (this.room.phase !== 'lobby') return;
      if (typeof msg.name === 'string' && msg.name.trim()) u.name = msg.name.trim().slice(0, 28);
      if (u.ready) {
        conn.send({ type: 'room_error', code: 'ready_locked', message: 'Unmark Ready before switching your technician or toolkit.' });
        return;
      }
      if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) u.characterId = msg.characterId;
      u.useAlt = Boolean(msg.useAlt);
      const spec = CHARACTER_SPECS[u.characterId] || CHARACTER_SPECS.oracle;
      u.weapons = sanitizeWeapons(u.characterId, null, this.room.seed + u.seat);
      u.effStats = computeEffectiveStats(u);
      u.maxHp = spec.stats.maxHp;
      u.hp = spec.stats.maxHp;
      this.room.revision = (this.room.revision || 0) + 1;
      this.broadcastPresence();
      await this.saveSeats();
      return;
    }

    if (msg.type === 'set_arena') {
      if (u.seat !== this.room.hostSeat || this.room.phase !== 'lobby') return;
      if (typeof msg.arenaChoice === 'string' && VALID_CHOICES.has(msg.arenaChoice)) {
        this.room.arenaChoice = msg.arenaChoice;
        this.room.arenaTheme = resolveArena(msg.arenaChoice, this.room.seed, this.room.wave, null);
        this.room.revision = (this.room.revision || 0) + 1;
        this.broadcastPresence();
        await this.saveState();
        await this.syncRegistry();
      }
      return;
    }

    if (msg.type === 'toggle_ready') {
      if (this.room.phase !== 'lobby') return;
      u.ready = typeof msg.ready === 'boolean' ? msg.ready : !u.ready;
      this.room.revision = (this.room.revision || 0) + 1;
      this.broadcastPresence();
      await this.saveSeats();
      return;
    }

    if (msg.type === 'start_shift') {
      if (this.room.phase !== 'lobby') return;
      if (u.seat !== this.room.hostSeat) {
        conn.send({ type: 'room_error', code: 'not_host', message: 'Only the Shift Foreman (Host) can launch the shift.' });
        return;
      }
      const seats = [...this.users.values()];
      if (!seats.length || !seats.every((p) => p.ready === true)) {
        conn.send({ type: 'room_error', code: 'crew_not_ready', message: 'All connected technicians must mark Ready before launching the shift.' });
        return;
      }
      this.room.runId = crypto.randomUUID();
      this.room.phase = 'loadout';
      this.room.wave = 1;
      this.room.seed = Math.floor(Math.random() * 0x7fffffff) || 1;
      this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, 1, null);
      this.room.teamKills = 0;
      this.room.teamSignal = 0;
      this.room.revision = (this.room.revision || 0) + 1;
      this.room.updatedAt = Date.now();

      for (const peer of seats) {
        const spec = CHARACTER_SPECS[peer.characterId] || CHARACTER_SPECS.oracle;
        peer.kitConfirmed = false;
        peer.waveDone = false;
        peer.intermissionReady = false;
        peer.alive = true;
        peer.kills = 0;
        peer.killsByType = {};
        peer.signal = 0;
        peer.earnedSignal = 0;
        peer.xp = 0;
        peer.level = 0;
        peer.pendingLevels = 0;
        peer.damageDealt = 0;
        peer.damageTaken = 0;
        peer.healed = 0;
        peer.items = [];
        peer.deployables = [];
        peer.statMods = [];
        peer.weapons = sanitizeWeapons(peer.characterId, null, this.room.seed + peer.seat);
        peer.effStats = computeEffectiveStats(peer);
        peer.maxHp = spec.stats.maxHp;
        peer.hp = spec.stats.maxHp;
      }

      this.broadcast({ type: 'phase_change', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers() });
      await this.saveState();
      await this.syncRegistry();
      return;
    }

    if (msg.type === 'confirm_kit') {
      if (this.room.phase !== 'loadout') return;
      if (this.hasProcessedAction(u, msg.actionId)) return;
      u.weapons = sanitizeWeapons(u.characterId, msg.weapons, this.room.seed + u.seat);
      u.effStats = computeEffectiveStats(u);
      u.maxHp = u.effStats.maxHp;
      u.hp = u.maxHp;
      u.kitConfirmed = true;
      this.room.revision = (this.room.revision || 0) + 1;

      const allConfirmed = [...this.users.values()].every((p) => p.kitConfirmed);
      if (allConfirmed && this.room.phase === 'loadout') {
        await this.enterCombatWave();
      } else {
        this.broadcastPresence();
        await this.saveSeats();
      }
      return;
    }

    if (msg.type === 'combat_input') {
      if (this.room.phase !== 'combat') return;
      u.ix = clamp(msg.x ?? 0, -1, 1);
      u.iy = clamp(msg.y ?? 0, -1, 1);
      if (msg.viewportW && msg.viewportH) {
        u.viewport = { width: clamp(msg.viewportW, 320, 2400), height: clamp(msg.viewportH, 240, 1800) };
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'combat_action') {
      if (this.room.phase !== 'combat' || !this.world) return;
      if (this.hasProcessedAction(u, msg.actionId)) return;
      const seats = [...this.users.values()];
      const action = String(msg.action || '');
      if (action === 'special') triggerPlayerSpecial(this.world, this.room, seats, u);
      else if (action === 'deploy') triggerPlayerDeploy(this.world, u, Number(msg.deployIndex) || 0);
      else if (action === 'ping') {
        const now = Date.now();
        if (!u.lastPingAt || now - u.lastPingAt >= 400) {
          u.lastPingAt = now;
          this.world.fx.push({ id: this.world.nextEntityId++, type: 'ping', seat: u.seat, name: u.name, x: Math.round(u.x), y: Math.round(u.y), label: 'SECTOR PING' });
        }
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'sync_intermission' || msg.type === 'intermission_ready') {
      if (this.room.phase !== 'intermission') return;
      if (msg.actionId && this.hasProcessedAction(u, msg.actionId)) return;
      if (Array.isArray(msg.weapons)) u.weapons = sanitizeWeapons(u.characterId, msg.weapons, this.room.seed + u.seat);
      if (Array.isArray(msg.items)) u.items = sanitizePassives(msg.items);
      if (Array.isArray(msg.deployables)) u.deployables = sanitizeDeployables(u.characterId, msg.deployables);
      if (Array.isArray(msg.statMods)) u.statMods = sanitizePassives(msg.statMods);
      u.effStats = computeEffectiveStats(u);
      u.maxHp = u.effStats.maxHp;
      if (msg.hp !== undefined) u.hp = clamp(msg.hp, 1, u.maxHp);
      else u.hp = Math.min(u.hp, u.maxHp);
      if (msg.signal !== undefined) u.signal = clamp(msg.signal, 0, (u.earnedSignal || 0) + 500);
      if (msg.level !== undefined) u.level = clamp(msg.level, 0, 200);
      if (msg.pendingLevels !== undefined) u.pendingLevels = clamp(msg.pendingLevels, 0, 50);

      if (msg.type === 'intermission_ready') u.intermissionReady = true;
      this.room.teamSignal = [...this.users.values()].reduce((s, p) => s + Math.round(p.signal || 0), 0);
      this.room.revision = (this.room.revision || 0) + 1;

      const allReady = [...this.users.values()].every((p) => p.intermissionReady || p.connected === false);
      if ((allReady || (msg.force && u.seat === this.room.hostSeat)) && this.room.phase === 'intermission') {
        this.room.wave += 1;
        this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, this.room.arenaTheme);
        await this.enterCombatWave();
      } else {
        this.broadcastPresence();
        await this.saveSeats();
      }
      return;
    }

    if (msg.type === 'return_lobby') {
      if (u.seat !== this.room.hostSeat && this.room.phase !== 'summary') return;
      this.stopSimLoop();
      this.world = null;
      this.room.phase = 'lobby';
      this.room.wave = 1;
      this.room.seed = Math.floor(Math.random() * 0x7fffffff) || 1;
      this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, 1, null);
      this.room.revision = (this.room.revision || 0) + 1;
      this.room.updatedAt = Date.now();
      for (const peer of this.users.values()) {
        peer.ready = false; peer.kitConfirmed = false; peer.intermissionReady = false; peer.waveDone = false; peer.alive = true;
      }
      this.broadcast({ type: 'phase_change', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers() });
      await this.saveState();
      await this.syncRegistry();
      return;
    }

    if (msg.type === 'leave_room') {
      this.users.delete(u.seatKey);
      this.disconnectedSeats.delete(u.seatKey);
      this.ensureHostSeat();
      this.room.revision = (this.room.revision || 0) + 1;
      if (this.users.size === 0) {
        this.stopSimLoop();
        this.world = null;
        this.room.phase = 'lobby';
      }
      this.broadcastPresence();
      await this.saveState();
      await this.syncRegistry();
      return;
    }

    if (msg.type === 'chat' && typeof msg.text === 'string') {
      const text = msg.text.trim().slice(0, 200);
      if (!text) return;
      const entry = { id: `${Date.now()}-${u.seat}`, seat: u.seat, name: u.name, characterId: u.characterId, text, ts: Date.now() };
      this.chat.push(entry);
      if (this.chat.length > 25) this.chat = this.chat.slice(-25);
      this.broadcast({ type: 'chat', roomId: this.room.roomId, entry });
      await this.storage.put('chat', this.chat);
    }
  }

  async enterCombatWave() {
    this.room.phase = 'combat';
    this.room.revision = (this.room.revision || 0) + 1;
    this.room.updatedAt = Date.now();
    const seats = [...this.users.values()].sort((a, b) => a.seat - b.seat);
    for (const peer of seats) { peer.waveDone = false; peer.intermissionReady = false; }
    this.world = createCombatWorld(this.room, seats);
    this.lastSimAt = Date.now();
    const snapshot = serializeCombatWorld(this.world, seats);

    this.broadcast({ type: 'phase_change', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers(), world: snapshot });
    this.ensureSimLoop();
    await this.saveState();
    await this.syncRegistry();
  }

  ensureSimLoop() {
    if (this.simTimer) return;
    this.lastSimAt = Date.now();
    this.simTimer = setInterval(() => {
      this.stepWorldToNow();
    }, TICK_MS);
  }

  stopSimLoop() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  stepWorldToNow() {
    if (this.room.phase !== 'combat' || !this.world) {
      this.stopSimLoop();
      return;
    }
    const now = Date.now();
    let elapsed = Math.min(0.25, Math.max(0, (now - (this.lastSimAt || now)) / 1000));
    if (elapsed < SIM_STEP * 0.8) return;
    this.lastSimAt = now;

    const seats = [...this.users.values()].sort((a, b) => a.seat - b.seat);
    let outcome = { ended: false };
    while (elapsed >= SIM_STEP) {
      outcome = stepCombatWorld(this.world, this.room, seats, SIM_STEP);
      elapsed -= SIM_STEP;
      if (outcome.ended) break;
    }
    this.lastSimAt = now - elapsed * 1000;

    if (outcome.ended) {
      this.stopSimLoop();
      void this.finishCombatWave(Boolean(outcome.won));
      return;
    }

    const snap = serializeCombatWorld(this.world, seats);
    this.broadcast({ type: 'world_tick', roomId: this.room.roomId, revision: this.room.revision, world: snap });
  }

  async finishCombatWave(won) {
    if (this.room.phase !== 'combat') return;
    const seats = [...this.users.values()].sort((a, b) => a.seat - b.seat);
    for (const peer of seats) {
      peer.waveDone = true;
      if (won) {
        const harvest = Math.round(peer.effStats?.harvesting || 0);
        peer.signal = (peer.signal || 0) + harvest;
        peer.earnedSignal = (peer.earnedSignal || 0) + harvest;
        if (!peer.alive || peer.hp <= 0) {
          peer.hp = Math.max(1, Math.round(peer.maxHp * 0.5));
          peer.alive = true;
        }
      } else {
        peer.hp = 0;
        peer.alive = false;
      }
      peer.intermissionReady = false;
    }
    this.room.teamKills = seats.reduce((s, p) => s + (p.kills || 0), 0);
    this.room.teamSignal = seats.reduce((s, p) => s + Math.round(p.signal || 0), 0);
    this.room.phase = won ? 'intermission' : 'summary';
    this.room.revision = (this.room.revision || 0) + 1;
    this.room.updatedAt = Date.now();

    const finalWorld = this.world ? serializeCombatWorld(this.world, seats) : null;
    this.world = null;

    this.broadcast({ type: 'phase_change', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers(), world: finalWorld });
    await this.saveState();
    await this.syncRegistry();
  }

  async handleClose(conn) {
    const liveConns = this.getConnections().filter((c) => c !== conn);
    if (liveConns.some((c) => c.id === conn.id)) return;

    let targetSeat = null;
    for (const u of this.users.values()) {
      if (u.connId === conn.id) {
        targetSeat = u;
        break;
      }
    }
    if (!targetSeat) return;

    if (this.room.phase === 'lobby') {
      this.disconnectedSeats.set(targetSeat.seatKey, {
        seatObj: { ...targetSeat, connected: false },
        expiresAt: Date.now() + 30000
      });
      this.users.delete(targetSeat.seatKey);
    } else {
      targetSeat.connected = false;
      targetSeat.disconnectedAt = Date.now();
      targetSeat.ix = 0;
      targetSeat.iy = 0;
    }

    this.ensureHostSeat();
    this.room.revision = (this.room.revision || 0) + 1;
    this.broadcastPresence();
    await this.saveState();
    await this.syncRegistry();

    if (liveConns.length === 0) {
      this.stopSimLoop();
      this.schedule('cleanup', Date.now() + 60000);
    }
  }

  async handleWake(key) {
    if (key === 'cleanup' && this.getConnections().length === 0) {
      this.stopSimLoop();
      this.world = null;
      this.users.clear();
      this.disconnectedSeats.clear();
      if (this.room.registryId) {
        try {
          await this.client.asServiceRole.entities.CoopLobby.delete(this.room.registryId);
        } catch {
          // Already deleted
        }
      }
      await this.storage.put('seats', []);
    }
  }

  async syncRegistry() {
    if (!this.room.registryId) return;
    try {
      const connectedCount = [...this.users.values()].filter((u) => u.connected !== false).length;
      const host = [...this.users.values()].find((p) => p.seat === this.room.hostSeat);
      if (connectedCount === 0) {
        await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, { status: 'closed', player_count: 0 });
      } else {
        await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, {
          title: this.room.title,
          host_name: host?.name || 'Dispatch Host',
          status: this.room.phase === 'summary' ? 'intermission' : this.room.phase,
          player_count: connectedCount,
          wave: this.room.wave,
          arena_choice: this.room.arenaChoice
        });
      }
    } catch {
      // Ignore transient registry update errors
    }
  }

  async saveSeats() {
    await this.storage.put('seats', [...this.users.entries()]);
  }

  async saveState() {
    await this.storage.put('room', this.room);
    await this.storage.put('seats', [...this.users.entries()]);
  }

  publicRoom() {
    return {
      roomId: this.room.roomId,
      runId: this.room.runId,
      revision: this.room.revision || 1,
      phase: this.room.phase,
      wave: this.room.wave,
      seed: this.room.seed,
      arenaChoice: this.room.arenaChoice,
      arenaTheme: this.room.arenaTheme,
      hostSeat: this.room.hostSeat,
      registryId: this.room.registryId,
      title: this.room.title,
      teamKills: this.room.teamKills,
      teamSignal: this.room.teamSignal
    };
  }

  publicSeat(u) {
    return {
      seat: u.seat,
      connected: u.connected !== false,
      name: u.name,
      characterId: u.characterId,
      useAlt: Boolean(u.useAlt),
      ready: Boolean(u.ready),
      kitConfirmed: Boolean(u.kitConfirmed),
      intermissionReady: Boolean(u.intermissionReady),
      waveDone: Boolean(u.waveDone),
      alive: u.alive !== false,
      x: Math.round(u.x || 550),
      y: Math.round(u.y || 400),
      vx: Math.round(u.vx || 0),
      vy: Math.round(u.vy || 0),
      hp: +Number(u.hp ?? 100).toFixed(1),
      maxHp: u.maxHp || 100,
      level: (u.level || 0) + (u.pendingLevels || 0),
      pendingLevels: u.pendingLevels || 0,
      xp: +(u.xp || 0).toFixed(2),
      kills: u.kills || 0,
      killsByType: u.killsByType || {},
      signal: Math.round(u.signal || 0),
      earnedSignal: Math.round(u.earnedSignal || 0),
      damageDealt: Math.round(u.damageDealt || 0),
      damageTaken: Math.round(u.damageTaken || 0),
      healed: Math.round(u.healed || 0),
      side: u.side || 'right',
      moving: Boolean(u.moving),
      attack: +(u.attack || 0).toFixed(2),
      special: +(u.specialTimer || 0).toFixed(2),
      specialCooldown: +(u.specialCooldown || 0).toFixed(2),
      weapons: u.weapons || [],
      items: u.items || [],
      deployables: u.deployables || [],
      statMods: u.statMods || []
    };
  }

  publicUsers() {
    return [...this.users.values()].sort((a, b) => a.seat - b.seat).map((u) => this.publicSeat(u));
  }

  broadcastPresence() {
    this.broadcast({ type: 'presence', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers() });
  }
}