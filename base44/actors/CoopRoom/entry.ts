import { Actor } from 'base44:runtime/actors';

const MAX_USERS = 4; // authoritative room actor
const W = 1100;
const H = 800;
const SIM_STEP = 1 / 30;
const TICK_MS = 50;

const VALID_CHARS = new Set(['oracle', 'isr', 'veteran', 'clone', 'don', 'nomad', 'admin', 'engineer']);
const VALID_CHOICES = new Set(['random', 'classic', 'office', 'worksite', 'vault', 'nightWorksite']);
const ARENA_BG_IDS = ['office', 'worksite', 'vault', 'nightWorksite'];

// Compact character table: [maxHp, speed, damage, attackSpeed, armor, range, crit, regen, luck, dodge, signalStrength, spliceQuality, harvesting, engineering, cleanliness, instakill, slots, restriction, startIds, specialId, specialName, specialCd, specialDur]
const CHAR_TABLE = {
  nomad: [78, 300, 0.92, 1.12, 0, 1.12, 0.08, 0.5, 15, 0.06, 5, 0, 0, 0, 0, 0, 6, 'any', ['vfl'], 'sprint', 'Café Chug', 18, 5],
  veteran: [115, 225, 1.08, 0.94, 3, 1, 0.04, 1.5, 2, 0.02, 0, 8, 0, 2, 0, 0.01, 8, 'any', ['cleaver', 'otdr'], 'clause', 'Knowledge Dump', 30, 3],
  oracle: [74, 245, 0.94, 1, 0, 1.35, 0.06, 0.5, 24, 0.03, 15, 4, 5, 2, 0, 0, 6, 'ranged', ['otdr'], 'trace', 'Full Trace', 22, 0.6],
  don: [220, 125, 0.9, 0.85, 4, 1, 0.04, 3, 0, 0, 0, 0, 10, 8, 0, 0, 6, 'any', ['power'], 'crew', 'Escalate to Field Crew', 26, 8],
  admin: [88, 250, 0.75, 1, 0, 1, 0.05, 0.5, 8, 0.3, 0, 0, 0, 0, 0, 0, 4, 'any', ['stripper'], 'meeting', 'Meeting Invite', 20, 4],
  engineer: [105, 259, 1, 1, 1, 1, 0.04, 1, 5, 0, 0, 2, 2, 10, 0, 0, 4, 'any', ['tray', 'power'], 'surge', 'Fiber Splice Surge', 18, 4.8],
  clone: [90, 275, 1, 1, 0, 1, 0.05, 1, 5, 0, 0, 0, 0, 0, -35, 0, 6, 'any', ['stripper'], 'cash', 'Cash Money', 30, 8],
  isr: [105, 210, 0.8, 1.05, 1, 1.08, 0.03, 1.5, 10, 0.04, 8, 0, 6, 0, 0, 0, 6, 'any', ['power'], 'outage', 'Outage Declaration', 25, 8]
};

// Compact weapon table: [name, icon, color, damage, rate, range, pattern, heal, turretLife, turretFire, turretMode]
const WEAPON_TABLE = {
  cleaver: ['Fiber Cleaver', '✂', '#fde047', 24, 0.7, 92, 'melee', 0],
  splicer: ['Fusion Splicer', '⚡', '#c084fc', 31, 0.92, 120, 'nova', 0],
  otdr: ['OTDR', '⌁', '#22d3ee', 34, 1.25, 520, 'pierce', 0],
  vfl: ['Visual Fault Locator', '↗', '#ef4444', 9, 0.28, 390, 'beam', 0],
  power: ['Optical Power Meter', '▣', '#38bdf8', 22, 0.8, 330, 'projectile', 0],
  stripper: ['Fiber Stripper', '≋', '#fb923c', 8, 0.22, 145, 'projectile', 0],
  cleaner: ['One-Click Cleaner', '◉', '#34d399', 15, 0.72, 155, 'cone', 2],
  cutters: ['Kevlar Cutters', '✕', '#f472b6', 42, 1.05, 105, 'melee', 0],
  tray: ['Splice Tray Sentry', '▤', '#f59e0b', 13, 3.2, 300, 'turret', 0, 6, 0.45, 'pellet'],
  closure: ['Closure Cannon', '◎', '#f97316', 46, 4.5, 420, 'turret', 0, 7, 1.5, 'mortar'],
  cable: ['Launch Cable Nest', '⌇', '#22d3ee', 26, 3.8, 520, 'turret', 0, 8, 1, 'pulse'],
  fanout: ['Fan-Out Splitter', '≡', '#a3e635', 9, 3.4, 230, 'turret', 0, 5, 1.15, 'spread'],
  jumper: ['Patch Cord Whip', '∿', '#a3e635', 18, 1.6, 210, 'chain', 0],
  midspan: ['Midspan Access Tool', '⌇', '#fb7185', 29, 0.9, 280, 'pierce', 0],
  blaster: ['Buffer Tube Blaster', '◖', '#60a5fa', 17, 0.48, 230, 'cone', 0],
  deadzone: ['Dead Zone Eliminator', '⌁', '#e879f9', 25, 0.7, 360, 'beamSweep', 0],
  switch: ['Optical Switch Snapper', '⌘', '#2dd4bf', 21, 1.7, 260, 'chain', 0],
  bell: ['Fairy Bell', '♢', '#f9a8d4', 16, 0.42, 170, 'orbiting', 0],
  rocket: ['Loose-Tube Launcher', '◉', '#f97316', 38, 1.4, 350, 'thrown', 0],
  dowel: ['Loader-Dowel', '▮', '#a8a29e', 48, 1.6, 300, 'projectile', 0]
};

// [color, hp, speed, damage, r, value, elite, boss, dirty, kbResist]
const ENEMY_TABLE = {
  lag: ['#fbbf24', 24, 64, 11, 13, 2, false, false, false, 0],
  packet: ['#fb7185', 44, 44, 16, 18, 3, false, false, false, 0],
  jitter: ['#a3e635', 31, 92, 10, 12, 3, false, false, false, 0],
  dirty: ['#a78bfa', 66, 52, 18, 21, 5, false, false, true, 0],
  bend: ['#f97316', 49.6, 78.2, 11.5, 25, 8, true, false, true, 0],
  crosstalk: ['#2dd4bf', 22, 106, 12, 15, 5, false, false, false, 0],
  attenuation: ['#94a3b8', 145, 46, 30, 28, 12, true, false, false, 0],
  pete: ['#f472b6', 240, 56, 30, 24, 14, true, false, false, 0.95],
  peteMini: ['#f9a8d4', 120, 68, 15, 13, 7, false, false, false, 0],
  ditch: ['#f97316', 110, 58, 20, 26, 10, true, false, true, 0.6],
  rous: ['#facc15', 560, 48, 28, 34, 45, true, true, false, 0.85],
  squirrel: ['#f97316', 720, 72, 30, 32, 60, true, true, false, 0.85]
};

const STRUCT_TABLE = {
  turretMount: ['Turret Mount', 'turret', 16, 12, 14, 0],
  barricade: ['Traffic Barricade', 'block', 24, 20, 9, 0],
  ratTrap: ['Rat Guard', 'trap', 18, 24, 11, 4],
  snare: ['Slack Coil Snare', 'slow', 80, 12, 12, 0],
  pedestal: ['Portable Pedestal', 'buff', 85, 15, 13, 0]
};

function clamp(n, min, max) {
  const v = Number(n);
  return !Number.isFinite(v) ? min : v < min ? min : v > max ? max : v;
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

function resolveArena(choice, seed, wave, prev = null) {
  if (choice && choice !== 'random' && VALID_CHOICES.has(choice)) return choice;
  let idx = seedHash(seed, wave) % ARENA_BG_IDS.length;
  if (prev && ARENA_BG_IDS[idx] === prev) {
    idx = (idx + 1 + (seedHash(seed, wave + 97) % (ARENA_BG_IDS.length - 1))) % ARENA_BG_IDS.length;
  }
  return ARENA_BG_IDS[idx];
}

function charSpec(id) {
  const row = CHAR_TABLE[id] || CHAR_TABLE.oracle;
  return {
    id: CHAR_TABLE[id] ? id : 'oracle',
    slots: row[16],
    familyCap: id === 'veteran' ? 4 : null,
    restriction: row[17],
    start: row[18],
    special: { id: row[19], name: row[20], cooldown: row[21], duration: row[22] },
    stats: {
      maxHp: row[0], speed: row[1], damage: row[2], attackSpeed: row[3], armor: row[4],
      range: row[5], crit: row[6], regen: row[7], luck: row[8], dodge: row[9],
      signalStrength: row[10], spliceQuality: row[11], harvesting: row[12],
      engineering: row[13], cleanliness: row[14], instakill: row[15],
      lifeSteal: 0, knockback: 0, pierce: 0
    }
  };
}

function weaponSlotType(pattern) {
  return ['melee', 'chain', 'nova', 'orbiting'].includes(pattern) ? 'melee' : 'ranged';
}

function sanitizeWeapons(charId, rawWeapons, fallbackSeed = 1) {
  const spec = charSpec(charId);
  const out = [];
  if (Array.isArray(rawWeapons)) {
    for (let i = 0; i < rawWeapons.length && out.length < spec.slots; i++) {
      const rw = rawWeapons[i];
      if (!rw || typeof rw !== 'object') continue;
      const baseId = WEAPON_TABLE[rw.baseId] ? rw.baseId : 'power';
      const wRow = WEAPON_TABLE[baseId];
      const pattern = wRow[6];
      const slotType = weaponSlotType(pattern);
      if (spec.restriction !== 'any' && slotType !== spec.restriction) continue;
      if (spec.familyCap && out.filter((x) => x.slotType === slotType).length >= spec.familyCap) continue;
      out.push({
        id: String(rw.id || `w-${fallbackSeed}-${i}`).slice(0, 64),
        baseId,
        name: String(rw.name || wRow[0]).slice(0, 64),
        icon: String(rw.icon || wRow[1]).slice(0, 8),
        color: String(rw.color || wRow[2]).slice(0, 16),
        pattern,
        slotType,
        rarity: String(rw.rarity || 'common').toLowerCase(),
        damage: clamp(rw.damage ?? wRow[3], 1, 5000),
        rate: clamp(rw.rate ?? wRow[4], 0.08, 10),
        range: clamp(rw.range ?? wRow[5], 50, 1200),
        heal: clamp(rw.heal ?? wRow[7], 0, 100),
        turret: wRow[8] ? { life: wRow[8], fire: wRow[9], mode: wRow[10] } : null,
        mods: Array.isArray(rw.mods) ? rw.mods.slice(0, 6).map((m) => ({ stat: String(m?.stat || 'damage').slice(0, 24), value: clamp(m?.value ?? 0, -100, 500) })) : []
      });
    }
  }
  if (!out.length) {
    for (let i = 0; i < spec.start.length; i++) {
      const baseId = spec.start[i];
      const wRow = WEAPON_TABLE[baseId] || WEAPON_TABLE.power;
      out.push({
        id: `starter-${charId}-${i}`,
        baseId,
        name: wRow[0],
        icon: wRow[1],
        color: wRow[2],
        pattern: wRow[6],
        slotType: weaponSlotType(wRow[6]),
        rarity: 'common',
        damage: wRow[3],
        rate: wRow[4],
        range: wRow[5],
        heal: wRow[7],
        turret: wRow[8] ? { life: wRow[8], fire: wRow[9], mode: wRow[10] } : null,
        mods: []
      });
    }
  }
  return out;
}

function computeEffectiveStats(u) {
  const spec = charSpec(u.characterId);
  const stats = { ...spec.stats, cleaningKillsHeal: 0, bonusSignal: 0, hitSpeedBoost: 0, critKnockback: 0, turretQuality: 0, firstHitBlocked: 0 };
  for (const item of [...(u.weapons || []), ...(u.items || []), ...(u.statMods || [])]) {
    for (const m of item?.mods || []) {
      if (['damage', 'attackSpeed', 'range'].includes(m.stat)) stats[m.stat] = (stats[m.stat] || 1) + Number(m.value || 0);
      else if (m.stat === 'speed') stats.speed = (stats.speed || 250) * (1 + Number(m.value || 0));
      else if (m.stat && m.stat in stats) stats[m.stat] = (stats[m.stat] || 0) + Number(m.value || 0);
    }
  }
  stats.maxHp = clamp(Math.round(stats.maxHp), 1, 5000);
  stats.speed = clamp(stats.speed, 60, 750);
  stats.damage = clamp(stats.damage, 0.2, 25);
  stats.attackSpeed = clamp(stats.attackSpeed, 0.25, 12);
  stats.range = clamp(stats.range, 0.4, 4);
  stats.dodge = clamp(stats.dodge, 0, 0.5);
  stats.crit = clamp(stats.crit, 0, 1);
  return stats;
}

function createCombatWorld(room, seats) {
  const wave = room.wave || 1;
  const duration = Math.min(90, 20 + (wave - 1) * 4);
  const world = {
    wave, duration, time: duration, seq: 0, nextEntityId: 1,
    spawnCd: 0.35, puddleTickCd: 0.5, bossSpawned: false,
    outageTimer: 0, outageOwnerSeat: null, meeting: null, surge: null,
    rng: seeded(seedHash(room.seed || 1, wave)),
    enemies: [], shots: [], foeShots: [], turrets: [], structures: [], pickups: [], puddles: [], fx: []
  };
  for (const u of seats) {
    const a = ((u.seat - 1) * Math.PI) / 2;
    u.x = Math.round(550 + Math.cos(a) * 54);
    u.y = Math.round(400 + Math.sin(a) * 54);
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

function spawnEnemyInWorld(world, kindOverride = null, forced = false, cap = 12, pos = null) {
  if (!forced && world.enemies.length >= cap) return null;
  const pool = ['lag', 'packet', 'jitter', 'dirty'];
  if (world.wave >= 2) pool.push('crosstalk');
  if (world.wave >= 3) pool.push('bend');
  if (world.wave >= 4) pool.push('attenuation');
  if (world.wave >= 6) pool.push('ditch');
  if (world.wave >= 7) pool.push('pete');
  const kind = kindOverride || pool[Math.floor(world.rng() * pool.length)];
  const row = ENEMY_TABLE[kind] || ENEMY_TABLE.lag;
  const w = Math.max(0, world.wave - 1);
  const hpMult = (1 + w * 0.29 + w * w * 0.0275) * (row[6] ? 1.25 : 1);
  const dmgMult = (1 + w * 0.12) * (row[6] ? 1.15 : 1);
  const edge = Math.floor(world.rng() * 4), pad = 28;
  const x = pos ? clamp(pos.x, 24, W - 24) : edge === 1 ? W - pad : edge === 3 ? pad : Math.round(pad + world.rng() * (W - pad * 2));
  const y = pos ? clamp(pos.y, 24, H - 24) : edge === 0 ? pad : edge === 2 ? H - pad : Math.round(pad + world.rng() * (H - pad * 2));
  const maxHp = Math.max(1, Math.round(row[1] * hpMult));
  const enemy = {
    id: world.nextEntityId++, kind, x, y, vx: 0, vy: 0, r: row[4],
    hp: maxHp, max: maxHp, speed: row[2], damage: +(row[3] * dmgMult).toFixed(2),
    value: row[5], color: row[0], elite: row[6], boss: row[7], dirty: row[8],
    knockbackResist: row[9], phase: 'chase', castCd: 2.5, windup: 0, aim: 0, cloneT: kind === 'pete' ? 18 : 0, sqPhase: 1, hitByShots: new Set()
  };
  world.enemies.push(enemy);
  return enemy;
}

function hitEnemyInWorld(world, room, seats, enemy, baseDmg, color, attacker) {
  if (!enemy || enemy.hp <= 0) return;
  const stats = attacker?.effStats || charSpec('oracle').stats;
  const crit = world.rng() < (stats.crit || 0.05);
  let amount = baseDmg * (stats.damage || 1) * (crit ? 2 : 1) * (1 + (stats.spliceQuality || 0) * 0.004);
  if (enemy.dirty) amount *= 1 + (stats.cleanliness || 0) * 0.01;
  if (!enemy.boss && world.rng() < (stats.instakill || 0)) amount = enemy.hp + 1;
  enemy.hp = +(enemy.hp - amount).toFixed(2);
  if (attacker) attacker.damageDealt = (attacker.damageDealt || 0) + amount;
  pushFx(world, { type: 'dmg', x: Math.round(enemy.x), y: Math.round(enemy.y), value: Math.max(1, Math.round(amount)), crit, color });
  if (enemy.hp <= 0) {
    const idx = world.enemies.indexOf(enemy);
    if (idx !== -1) world.enemies.splice(idx, 1);
    if (attacker) {
      attacker.kills = (attacker.kills || 0) + 1;
      attacker.killsByType = attacker.killsByType || {};
      attacker.killsByType[enemy.kind] = (attacker.killsByType[enemy.kind] || 0) + 1;
    }
    room.teamKills = seats.reduce((sum, s) => sum + (s.kills || 0), 0);
    const cashMul = seats.some((s) => s.characterId === 'clone' && s.specialTimer > 0) ? 2 : 1;
    world.pickups.push({ id: world.nextEntityId++, x: Math.round(enemy.x), y: Math.round(enemy.y), value: enemy.value * cashMul });
    pushFx(world, { type: 'kill', x: Math.round(enemy.x), y: Math.round(enemy.y), color: enemy.color, kind: enemy.kind, seat: attacker?.seat || 1 });
  }
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
      if (targets.length) for (const t of targets) hitEnemyInWorld(world, room, seats, t, totalBase / targets.length, '#fbbf24', owner);
      pushFx(world, { type: 'area', seat: m.ownerSeat, x: m.x, y: m.y, reach: m.radius, angle: 0, half: Math.PI, color: '#fbbf24' });
    }
  }

  for (const u of seats) {
    if (!u.alive || u.hp <= 0) continue;
    const stats = u.effStats || computeEffectiveStats(u);
    u.inv = Math.max(0, (u.inv || 0) - dt);
    u.attack = Math.max(0, (u.attack || 0) - dt);
    u.specialCooldown = Math.max(0, (u.specialCooldown || 0) - dt);
    u.specialTimer = Math.max(0, (u.specialTimer || 0) - dt);
    for (const k of Object.keys(u.deployCds || {})) if (u.deployCds[k] > 0) u.deployCds[k] = Math.max(0, u.deployCds[k] - dt);

    const ix = clamp(u.ix || 0, -1, 1), iy = clamp(u.iy || 0, -1, 1);
    if (ix || iy) {
      const mag = Math.hypot(ix, iy) || 1;
      const boost = u.specialTimer > 0 && u.characterId === 'nomad' ? 1.8 : 1;
      u.vx = (ix / mag) * stats.speed * boost;
      u.vy = (iy / mag) * stats.speed * boost;
      u.x = clamp(u.x + u.vx * dt, 17, W - 17);
      u.y = clamp(u.y + u.vy * dt, 17, H - 17);
      if (Math.abs(ix) > 0.05) u.side = ix < 0 ? 'left' : 'right';
      u.moving = true;
    } else {
      u.vx = 0; u.vy = 0; u.moving = false;
    }

    if (!Array.isArray(u.weaponCds) || u.weaponCds.length !== u.weapons.length) u.weaponCds = u.weapons.map(() => 0.15);
    for (let i = 0; i < u.weapons.length; i++) {
      u.weaponCds[i] -= dt;
      if (u.weaponCds[i] <= 0) {
        const w = u.weapons[i];
        u.weaponCds[i] = Math.max(0.1, (w.rate || 0.8) / (stats.attackSpeed || 1));
        const reach = Math.max(48, Math.min((w.range || 240) * 0.65 * (stats.range || 1), 440));
        let target = null, bestD = reach;
        for (const e of world.enemies) {
          const d = Math.hypot(e.x - u.x, e.y - u.y);
          if (d <= bestD) { bestD = d; target = e; }
        }
        if (target) {
          const ang = Math.atan2(target.y - u.y, target.x - u.x);
          u.side = target.x < u.x ? 'left' : 'right';
          u.attack = 0.35;
          if (['melee', 'nova', 'cone', 'orbiting'].includes(w.pattern)) {
            for (const e of [...world.enemies]) if (Math.hypot(e.x - u.x, e.y - u.y) <= reach + e.r) hitEnemyInWorld(world, room, seats, e, w.damage, w.color, u);
            pushFx(world, { type: 'area', seat: u.seat, x: Math.round(u.x), y: Math.round(u.y), reach: Math.round(reach), angle: +ang.toFixed(3), half: Math.PI / 3, color: w.color });
          } else {
            world.shots.push({ id: world.nextEntityId++, ownerSeat: u.seat, x: u.x, y: u.y - 16, vx: Math.cos(ang) * 540, vy: Math.sin(ang) * 540, r: 5, damage: w.damage, color: w.color || '#38bdf8', pattern: w.pattern, pierce: ['pierce', 'beam', 'beamSweep'].includes(w.pattern), pen: Math.round(stats.pierce || 0), mortar: false, remaining: reach });
          }
        }
      }
    }
  }

  if (!world.bossSpawned && world.wave % 5 === 0) {
    world.bossSpawned = true;
    spawnEnemyInWorld(world, world.wave % 20 === 0 ? 'squirrel' : 'rous', true, 99);
  }
  const activeCap = Math.min(20, 6 + Math.floor(Math.max(0, world.wave - 1) / 6) + Math.max(0, seats.length - 1) * 2);
  world.spawnCd -= dt;
  if (world.spawnCd <= 0) {
    if (world.enemies.length < activeCap) spawnEnemyInWorld(world, null, false, activeCap);
    world.spawnCd = Math.max(0.24, (0.72 - world.wave * 0.022) / (1 + Math.max(0, seats.length - 1) * 0.18));
  }

  for (let i = world.shots.length - 1; i >= 0; i--) {
    const s = world.shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt; s.remaining -= Math.hypot(s.vx, s.vy) * dt;
    const owner = seats.find((u) => u.seat === s.ownerSeat) || livingSeats[0];
    let remove = false;
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      if (!e || e.hp <= 0 || e.hitByShots.has(s.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) <= e.r + s.r + 4) {
        e.hitByShots.add(s.id);
        hitEnemyInWorld(world, room, seats, e, s.damage, s.color, owner);
        if (!s.pierce) { if (s.pen > 0) s.pen -= 1; else { remove = true; break; } }
      }
    }
    if (remove || s.remaining <= 0 || s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) world.shots.splice(i, 1);
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
    const slowMul = world.outageTimer > 0 ? 0.25 : 1;
    const ang = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    e.vx = Math.cos(ang) * e.speed * slowMul;
    e.vy = Math.sin(ang) * e.speed * slowMul;
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, H - e.r);

    if (!world.meeting) {
      for (const u of livingSeats) {
        if (u.inv <= 0 && Math.hypot(u.x - e.x, u.y - e.y) < 17 + e.r) {
          const stats = u.effStats || computeEffectiveStats(u);
          if (world.rng() <= Math.min(0.5, stats.dodge || 0)) { u.inv = 0.25; continue; }
          const dmg = Math.max(Math.ceil(e.damage * 0.25), Math.max(2, e.damage - (stats.armor || 0) * 1.5));
          u.hp = Math.max(0, +(u.hp - dmg).toFixed(1));
          u.inv = 0.5;
          if (u.hp <= 0) { u.hp = 0; u.alive = false; }
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
        peer.xp = (peer.xp || 0) + d.value * 0.65;
        const targetXp = (lvl) => Math.ceil(lvl <= 5 ? 45 + lvl * 18 + lvl * lvl * 3 : 210 * Math.pow(1.3, lvl - 5));
        while (peer.xp >= targetXp((peer.level || 0) + (peer.pendingLevels || 0))) {
          peer.xp -= targetXp((peer.level || 0) + (peer.pendingLevels || 0));
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
    if (e.boss && e.hp > 0) { boss = { id: e.id, kind: e.kind, name: e.kind, hp: Math.round(e.hp), max: Math.round(e.max), phase: e.sqPhase || 1 }; break; }
  }
  const fx = world.fx.splice(0, world.fx.length);
  return {
    seq: world.seq, wave: world.wave, time: +world.time.toFixed(2), duration: world.duration,
    outageTimer: +world.outageTimer.toFixed(2), meeting: world.meeting, surge: world.surge, boss,
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
    enemies: world.enemies.map((e) => ({ id: e.id, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), vx: Math.round(e.vx || 0), vy: Math.round(e.vy || 0), r: e.r, hp: Math.round(e.hp), max: Math.round(e.max), color: e.color, elite: e.elite, boss: e.boss, phase: e.phase })),
    shots: world.shots.map((s) => ({ id: s.id, seat: s.ownerSeat, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx), vy: Math.round(s.vy), r: s.r, color: s.color, pattern: s.pattern, mortar: s.mortar })),
    foeShots: world.foeShots,
    turrets: world.turrets,
    structures: world.structures,
    pickups: world.pickups,
    puddles: world.puddles,
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
    roomId: null, runId: null, revision: 1, phase: 'lobby', wave: 1,
    seed: Math.floor(Math.random() * 0x7fffffff) || 1, arenaChoice: 'random', arenaTheme: 'office',
    hostSeat: 1, registryId: null, title: 'Field Crew Shift', teamKills: 0, teamSignal: 0, updatedAt: Date.now()
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
      if (liveIds.has(cid)) { u.connId = cid; u.connected = true; u.disconnectedAt = null; }
      else if (this.room.phase === 'lobby') { this.disconnectedSeats.set(key, { seatObj: u, expiresAt: Date.now() + 30000 }); this.users.delete(key); }
      else { u.connected = false; u.disconnectedAt = u.disconnectedAt || Date.now(); }
    }
    this.ensureHostSeat();
    if (this.room.phase === 'combat') {
      if (!this.world) this.world = createCombatWorld(this.room, [...this.users.values()]);
      this.ensureSimLoop();
    }
  }

  ensureHostSeat() {
    const connected = [...this.users.values()].filter((u) => u.connected !== false).map((u) => u.seat).sort((a, b) => a - b);
    const all = [...this.users.values()].map((u) => u.seat).sort((a, b) => a - b);
    const pool = connected.length ? connected : all;
    if (!pool.length) this.room.hostSeat = 1;
    else if (!pool.includes(this.room.hostSeat)) this.room.hostSeat = pool[0];
  }

  findExistingSeatForConn(conn) {
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    const liveIds = new Set(this.getConnections().map((c) => c.id));
    for (const u of this.users.values()) {
      if (u.connId === conn.id && (!u.userId || !authUserId || u.userId === authUserId)) return { seatObj: u, restoredFromCache: false };
    }
    if (authUserId) {
      for (const u of this.users.values()) {
        if (u.userId === authUserId && (!u.connId || !liveIds.has(u.connId) || u.connId === conn.id)) return { seatObj: u, restoredFromCache: false };
      }
    }
    for (const [key, entry] of this.disconnectedSeats.entries()) {
      if (Date.now() > entry.expiresAt) { this.disconnectedSeats.delete(key); continue; }
      const u = entry.seatObj;
      if ((u.connId === conn.id && (!u.userId || !authUserId || u.userId === authUserId)) || (authUserId && u.userId === authUserId)) {
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
    const a = ((seat - 1) * Math.PI) / 2;
    const spec = charSpec('oracle');
    return {
      seat, seatKey: `seat-${seat}`, connId: conn.id, userId: authUserId, connected: true, disconnectedAt: null,
      name: `Tech #${seat}`, characterId: 'oracle', useAlt: false, ready: false, kitConfirmed: false, intermissionReady: false, waveDone: false, alive: true,
      x: Math.round(550 + Math.cos(a) * 54), y: Math.round(400 + Math.sin(a) * 54), vx: 0, vy: 0, ix: 0, iy: 0,
      hp: spec.stats.maxHp, maxHp: spec.stats.maxHp, level: 0, pendingLevels: 0, xp: 0,
      kills: 0, killsByType: {}, signal: 0, earnedSignal: 0, damageDealt: 0, damageTaken: 0, healed: 0,
      side: 'right', moving: false, attack: 0, specialCooldown: 0, specialTimer: 0, deployCds: {},
      weapons: sanitizeWeapons('oracle', null, this.room.seed + seat), items: [], deployables: [], statMods: [],
      effStats: { ...spec.stats }, viewport: { width: 1100, height: 800 }, processedActions: []
    };
  }

  async handleConnect(conn) {
    this.cancelSchedule('cleanup');
    const existing = this.findExistingSeatForConn(conn);
    let me = null;

    if (existing) {
      me = existing.seatObj;
      if (existing.restoredFromCache) {
        if (this.users.size >= MAX_USERS) {
          conn.send({ type: 'room_error', code: 'room_full', message: 'Shift crew is full (max 4 technicians).' });
          conn.reject(4001, 'Shift crew is full');
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
        conn.reject(4001, 'Shift crew is full');
        return;
      }
      const seat = this.allocateSeatNumber();
      if (!seat) { conn.reject(4001, 'Shift crew is full'); return; }
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
    for (const u of this.users.values()) if (u.connId === conn.id) return u;
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    if (authUserId) {
      for (const u of this.users.values()) if (u.userId === authUserId) { u.connId = conn.id; return u; }
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
      if (typeof msg.roomId === 'string' && msg.roomId.trim() && !this.room.roomId) this.room.roomId = msg.roomId.trim().slice(0, 64);
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
          const spec = charSpec(u.characterId);
          u.maxHp = spec.stats.maxHp; u.hp = spec.stats.maxHp;
          u.weapons = sanitizeWeapons(u.characterId, null, this.room.seed + u.seat);
          u.effStats = computeEffectiveStats(u);
        }
        if (typeof msg.useAlt === 'boolean') u.useAlt = msg.useAlt;
      }
      this.room.revision = (this.room.revision || 0) + 1;
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
      const spec = charSpec(u.characterId);
      u.weapons = sanitizeWeapons(u.characterId, null, this.room.seed + u.seat);
      u.effStats = computeEffectiveStats(u);
      u.maxHp = spec.stats.maxHp; u.hp = spec.stats.maxHp;
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
      this.room.teamKills = 0; this.room.teamSignal = 0;
      this.room.revision = (this.room.revision || 0) + 1;

      for (const peer of seats) {
        const spec = charSpec(peer.characterId);
        peer.kitConfirmed = false; peer.waveDone = false; peer.intermissionReady = false; peer.alive = true;
        peer.kills = 0; peer.killsByType = {}; peer.signal = 0; peer.earnedSignal = 0; peer.xp = 0; peer.level = 0; peer.pendingLevels = 0;
        peer.damageDealt = 0; peer.damageTaken = 0; peer.healed = 0; peer.items = []; peer.deployables = []; peer.statMods = [];
        peer.weapons = sanitizeWeapons(peer.characterId, null, this.room.seed + peer.seat);
        peer.effStats = computeEffectiveStats(peer);
        peer.maxHp = spec.stats.maxHp; peer.hp = spec.stats.maxHp;
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
      u.maxHp = u.effStats.maxHp; u.hp = u.maxHp;
      u.kitConfirmed = true;
      this.room.revision = (this.room.revision || 0) + 1;

      if ([...this.users.values()].every((p) => p.kitConfirmed) && this.room.phase === 'loadout') {
        await this.enterCombatWave();
      } else {
        this.broadcastPresence();
        await this.saveSeats();
      }
      return;
    }

    if (msg.type === 'combat_input' || msg.type === 'telemetry') {
      if (this.room.phase !== 'combat') return;
      if (msg.type === 'combat_input') {
        u.ix = clamp(msg.x ?? 0, -1, 1);
        u.iy = clamp(msg.y ?? 0, -1, 1);
      } else if (msg.ix !== undefined || msg.iy !== undefined) {
        u.ix = clamp(msg.ix ?? 0, -1, 1);
        u.iy = clamp(msg.iy ?? 0, -1, 1);
      }
      if (msg.viewportW && msg.viewportH) {
        u.viewport = { width: clamp(msg.viewportW, 320, 2400), height: clamp(msg.viewportH, 240, 1800) };
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'combat_action' || msg.type === 'combat_event') {
      if (this.room.phase !== 'combat' || !this.world) return;
      if (this.hasProcessedAction(u, msg.actionId)) return;
      const action = String(msg.action || msg.kind || '');
      if (action === 'special' || action === 'heal_pulse') {
        const spec = charSpec(u.characterId);
        if (u.alive && u.hp > 0 && u.specialCooldown <= 0) {
          u.specialCooldown = spec.special.cooldown;
          u.specialTimer = spec.special.duration;
          if (spec.special.id === 'sprint') {
            u.hp = Math.min(u.maxHp, u.hp + 40);
            for (const peer of this.users.values()) if (peer.seat !== u.seat && peer.alive && peer.hp > 0) peer.hp = Math.min(peer.maxHp, peer.hp + 18);
          } else if (spec.special.id === 'meeting') {
            this.world.meeting = { ownerSeat: u.seat, x: clamp(u.x + 80, 90, W - 90), y: clamp(u.y, 90, H - 90), timer: 4, radius: 220 };
          } else if (spec.special.id === 'outage') {
            this.world.outageTimer = 8; this.world.outageOwnerSeat = u.seat;
          }
          pushFx(this.world, { type: 'special', seat: u.seat, specialId: spec.special.id, label: `${u.name}: ${spec.special.name.toUpperCase()}`, x: Math.round(u.x), y: Math.round(u.y) });
        }
      } else if (action === 'deploy') {
        const list = u.deployables || [];
        const idx = clamp(Number(msg.deployIndex) || 0, 0, Math.max(0, list.length - 1));
        const item = list[idx];
        const row = STRUCT_TABLE[item?.structure];
        if (row && (u.deployCds?.[item.structure] || 0) <= 0 && !this.world.structures.some((s) => Math.hypot(s.x - u.x, s.y - u.y) < 90)) {
          u.deployCds = u.deployCds || {};
          u.deployCds[item.structure] = row[4] * (u.characterId === 'engineer' ? 0.45 : 1);
          this.world.structures.push({ id: this.world.nextEntityId++, ownerSeat: u.seat, type: item.structure, x: clamp(Math.round(u.x), 30, W - 30), y: clamp(Math.round(u.y), 30, H - 30), r: row[2], life: row[3], maxLife: row[3], power: clamp(item.stacks || 1, 1, 2), uses: row[5] || 0, rearm: 0, fireCd: 0.25, haste: 0, lookA: 0 });
          pushFx(this.world, { type: 'deploy', seat: u.seat, structure: item.structure, x: Math.round(u.x), y: Math.round(u.y) });
        }
      } else if (action === 'ping') {
        const now = Date.now();
        if (!u.lastPingAt || now - u.lastPingAt >= 400) {
          u.lastPingAt = now;
          pushFx(this.world, { type: 'ping', seat: u.seat, name: u.name, x: Math.round(u.x), y: Math.round(u.y), label: 'SECTOR PING' });
        }
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'sync_intermission' || msg.type === 'intermission_ready') {
      if (this.room.phase !== 'intermission') return;
      if (msg.actionId && this.hasProcessedAction(u, msg.actionId)) return;
      if (Array.isArray(msg.weapons)) u.weapons = sanitizeWeapons(u.characterId, msg.weapons, this.room.seed + u.seat);
      if (Array.isArray(msg.items)) u.items = msg.items.slice(0, 24);
      if (Array.isArray(msg.deployables)) u.deployables = msg.deployables.slice(0, 6);
      if (Array.isArray(msg.statMods)) u.statMods = msg.statMods.slice(0, 24);
      u.effStats = computeEffectiveStats(u);
      u.maxHp = u.effStats.maxHp;
      u.hp = msg.hp !== undefined ? clamp(msg.hp, 1, u.maxHp) : Math.min(u.hp, u.maxHp);
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
      for (const peer of this.users.values()) { peer.ready = false; peer.kitConfirmed = false; peer.intermissionReady = false; peer.waveDone = false; peer.alive = true; }
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
      if (this.users.size === 0) { this.stopSimLoop(); this.world = null; this.room.phase = 'lobby'; }
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
    const seats = [...this.users.values()].sort((a, b) => a.seat - b.seat);
    for (const peer of seats) { peer.waveDone = false; peer.intermissionReady = false; }
    this.world = createCombatWorld(this.room, seats);
    this.lastSimAt = Date.now();
    this.broadcast({ type: 'phase_change', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers(), world: serializeCombatWorld(this.world, seats) });
    this.ensureSimLoop();
    await this.saveState();
    await this.syncRegistry();
  }

  ensureSimLoop() {
    this.lastSimAt = Date.now();
  }

  stopSimLoop() {
    this.simTimer = null;
  }

  stepWorldToNow() {
    if (this.room.phase !== 'combat' || !this.world) { this.stopSimLoop(); return; }
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
    this.broadcast({ type: 'world_tick', roomId: this.room.roomId, revision: this.room.revision, world: serializeCombatWorld(this.world, seats) });
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
        if (!peer.alive || peer.hp <= 0) { peer.hp = Math.max(1, Math.round(peer.maxHp * 0.5)); peer.alive = true; }
      } else { peer.hp = 0; peer.alive = false; }
      peer.intermissionReady = false;
    }
    this.room.teamKills = seats.reduce((s, p) => s + (p.kills || 0), 0);
    this.room.teamSignal = seats.reduce((s, p) => s + Math.round(p.signal || 0), 0);
    this.room.phase = won ? 'intermission' : 'summary';
    this.room.revision = (this.room.revision || 0) + 1;
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
    for (const u of this.users.values()) if (u.connId === conn.id) { targetSeat = u; break; }
    if (!targetSeat) return;

    if (this.room.phase === 'lobby') {
      this.disconnectedSeats.set(targetSeat.seatKey, { seatObj: { ...targetSeat, connected: false }, expiresAt: Date.now() + 30000 });
      this.users.delete(targetSeat.seatKey);
    } else {
      targetSeat.connected = false; targetSeat.disconnectedAt = Date.now(); targetSeat.ix = 0; targetSeat.iy = 0;
    }
    this.ensureHostSeat();
    this.room.revision = (this.room.revision || 0) + 1;
    this.broadcastPresence();
    await this.saveState();
    await this.syncRegistry();
    if (liveConns.length === 0) { this.stopSimLoop(); this.schedule('cleanup', Date.now() + 60000); }
  }

  async handleWake(key) {
    if (key === 'cleanup' && this.getConnections().length === 0) {
      this.stopSimLoop(); this.world = null; this.users.clear(); this.disconnectedSeats.clear();
      if (this.room.registryId) await this.client.asServiceRole.entities.CoopLobby.delete(this.room.registryId).catch(() => {});
      await this.storage.put('seats', []);
    }
  }

  async syncRegistry() {
    if (!this.room.registryId) return;
    try {
      const connectedCount = [...this.users.values()].filter((u) => u.connected !== false).length;
      const host = [...this.users.values()].find((p) => p.seat === this.room.hostSeat);
      if (connectedCount === 0) await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, { status: 'closed', player_count: 0 });
      else await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, { title: this.room.title, host_name: host?.name || 'Dispatch Host', status: this.room.phase === 'summary' ? 'intermission' : this.room.phase, player_count: connectedCount, wave: this.room.wave, arena_choice: this.room.arenaChoice });
    } catch { /* ignore */ }
  }

  saveSeats() { return this.storage.put('seats', [...this.users.entries()]); }
  async saveState() { await this.storage.put('room', this.room); await this.storage.put('seats', [...this.users.entries()]); }

  publicRoom() {
    return {
      roomId: this.room.roomId, runId: this.room.runId, revision: this.room.revision || 1,
      phase: this.room.phase, wave: this.room.wave, seed: this.room.seed,
      arenaChoice: this.room.arenaChoice, arenaTheme: this.room.arenaTheme,
      hostSeat: this.room.hostSeat, registryId: this.room.registryId, title: this.room.title,
      teamKills: this.room.teamKills, teamSignal: this.room.teamSignal
    };
  }

  publicSeat(u) {
    return {
      seat: u.seat, connected: u.connected !== false, name: u.name, characterId: u.characterId,
      useAlt: Boolean(u.useAlt), ready: Boolean(u.ready), kitConfirmed: Boolean(u.kitConfirmed),
      intermissionReady: Boolean(u.intermissionReady), waveDone: Boolean(u.waveDone), alive: u.alive !== false,
      x: Math.round(u.x || 550), y: Math.round(u.y || 400), vx: Math.round(u.vx || 0), vy: Math.round(u.vy || 0),
      hp: +Number(u.hp ?? 100).toFixed(1), maxHp: u.maxHp || 100, level: (u.level || 0) + (u.pendingLevels || 0),
      pendingLevels: u.pendingLevels || 0, xp: +(u.xp || 0).toFixed(2), kills: u.kills || 0, killsByType: u.killsByType || {},
      signal: Math.round(u.signal || 0), earnedSignal: Math.round(u.earnedSignal || 0),
      damageDealt: Math.round(u.damageDealt || 0), damageTaken: Math.round(u.damageTaken || 0), healed: Math.round(u.healed || 0),
      side: u.side || 'right', moving: Boolean(u.moving), attack: +(u.attack || 0).toFixed(2),
      special: +(u.specialTimer || 0).toFixed(2), specialCooldown: +(u.specialCooldown || 0).toFixed(2),
      weapons: u.weapons || [], items: u.items || [], deployables: u.deployables || [], statMods: u.statMods || []
    };
  }

  publicUsers() { return [...this.users.values()].sort((a, b) => a.seat - b.seat).map((u) => this.publicSeat(u)); }
  broadcastPresence() { this.broadcast({ type: 'presence', roomId: this.room.roomId, room: this.publicRoom(), users: this.publicUsers() }); }
}