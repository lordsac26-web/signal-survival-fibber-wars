// Authoritative Co-Op Combat Simulation
// Imports catalog & stat rules from ./coopCatalog.ts

import {
  W,
  H,
  BASE_STATS,
  CHARACTER_SPECS,
  ENEMY_CATALOG,
  STRUCTURE_CATALOG,
  clamp,
  seeded,
  seedHash,
  signalForLevel,
  waveDuration,
  spawnInterval,
  maxActiveEnemies,
  enemyHpMultiplier,
  enemyDamageMultiplier,
  sanitizeWeapons,
  computeEffectiveStats,
  effectiveReachForWeapon
} from './coopCatalog.ts';

export * from './coopCatalog.ts';

function pickEnemyKindForWave(rng, wave) {
  const pool = ['lag', 'packet', 'jitter', 'dirty'];
  if (wave >= 2) pool.push('crosstalk');
  if (wave >= 3) pool.push('bend');
  if (wave >= 4) pool.push('attenuation');
  if (wave >= 6) pool.push('ditch');
  if (wave >= 7) pool.push('pete');
  return pool[Math.floor(rng() * pool.length)];
}

export function createCombatWorld(room, seats) {
  const wave = room.wave || 1;
  const duration = waveDuration(wave);
  const rng = seeded(seedHash(room.seed || 1, wave));
  const world = {
    wave,
    duration,
    time: duration,
    seq: 0,
    nextEntityId: 1,
    spawnCd: 0.35,
    puddleTickCd: 0.5,
    bossSpawned: false,
    outageTimer: 0,
    outageOwnerSeat: null,
    meeting: null,
    surge: null,
    rng,
    enemies: [],
    shots: [],
    foeShots: [],
    turrets: [],
    structures: [],
    pickups: [],
    puddles: [],
    fx: []
  };

  for (const u of seats) {
    const spawnAngle = ((u.seat - 1) * Math.PI) / 2;
    u.x = Math.round(550 + Math.cos(spawnAngle) * 54);
    u.y = Math.round(400 + Math.sin(spawnAngle) * 54);
    u.vx = 0;
    u.vy = 0;
    u.ix = 0;
    u.iy = 0;
    u.inv = 0;
    u.regenAcc = 0;
    u.hurtBoost = 0;
    u.firstBlockUsed = false;
    u.specialCooldown = 0;
    u.specialTimer = 0;
    u.clauseFired = false;
    u.deployCds = {};
    u.weapons = sanitizeWeapons(u.characterId, u.weapons, (room.seed || 1) + u.seat);
    u.effStats = computeEffectiveStats(u);
    u.maxHp = u.effStats.maxHp;
    if (u.hp <= 0 || u.hp > u.maxHp) {
      u.hp = wave === 1 ? u.maxHp : Math.max(1, Math.round(u.maxHp * 0.5));
    }
    u.alive = u.hp > 0;
    u.weaponCds = u.weapons.map(() => 0.15);
    u.waveStartKills = u.kills || 0;
    u.waveStartSignal = u.earnedSignal || u.signal || 0;
    u.xpEarnedWave = 0;
    u.levelsGainedWave = 0;
  }

  return world;
}

function pushFx(world, ev) {
  world.fx.push({ id: world.nextEntityId++, ...ev });
  if (world.fx.length > 48) {
    world.fx.splice(0, world.fx.length - 48);
  }
}

export function spawnEnemyInWorld(world, kindOverride = null, forced = false, activeCountCap = 12, posOverride = null) {
  if (!forced && world.enemies.length >= activeCountCap) return null;
  const kind = kindOverride || pickEnemyKindForWave(world.rng, world.wave);
  if (kind === 'ditch' && world.enemies.filter((e) => e.kind === 'ditch').length >= 2) return null;
  if (kind === 'attenuation' && world.enemies.filter((e) => e.kind === 'attenuation').length >= 2) return null;
  if (kind === 'pete' && world.enemies.some((e) => e.kind === 'pete')) return null;

  const base = ENEMY_CATALOG[kind] || ENEMY_CATALOG.lag;
  const hpMult = enemyHpMultiplier(world.wave, Boolean(base.elite));
  const dmgMult = enemyDamageMultiplier(world.wave, Boolean(base.elite));
  const edge = Math.floor(world.rng() * 4);
  const pad = 28;
  const x = posOverride
    ? clamp(posOverride.x, 24, W - 24)
    : edge === 1
    ? W - pad
    : edge === 3
    ? pad
    : Math.round(pad + world.rng() * (W - pad * 2));
  const y = posOverride
    ? clamp(posOverride.y, 24, H - 24)
    : edge === 0
    ? pad
    : edge === 2
    ? H - pad
    : Math.round(pad + world.rng() * (H - pad * 2));

  const maxHp = Math.max(1, Math.round(base.hp * hpMult));
  const enemy = {
    id: world.nextEntityId++,
    kind: base.kind,
    name: base.name || base.kind,
    x,
    y,
    vx: 0,
    vy: 0,
    r: base.r,
    hp: maxHp,
    max: maxHp,
    speed: base.speed,
    damage: +(base.damage * dmgMult).toFixed(2),
    value: base.value,
    color: base.color,
    elite: Boolean(base.elite),
    boss: Boolean(base.boss),
    dirty: Boolean(base.dirty),
    knockbackResist: base.knockbackResist || 0,
    phase: 'chase',
    castCd: 2.2 + world.rng() * 1.5,
    windup: 0,
    aim: 0,
    cloneT: kind === 'pete' ? 18 : 0,
    sqPhase: 1,
    hitByShots: new Set()
  };
  world.enemies.push(enemy);
  if (enemy.boss) {
    pushFx(world, { type: 'flash', text: enemy.kind === 'squirrel' ? 'FIBER-NIBBLING SQUIRREL IN THE TRENCH!' : 'R.O.U.S. DETECTED ON THE ROUTE!' });
  }
  return enemy;
}

function damagePlayerSeat(world, u, rawDmg) {
  if (!u || !u.alive || u.hp <= 0 || u.inv > 0) return;
  const stats = u.effStats || computeEffectiveStats(u);
  if (world.rng() <= Math.min(0.5, stats.dodge || 0)) {
    u.inv = 0.25;
    return;
  }
  const reduced = Math.max(Math.ceil(rawDmg * 0.25), Math.max(2, rawDmg - (stats.armor || 0) * 1.5));
  const amount = reduced * (1 - Math.min(0.4, (stats.signalStrength || 0) * 0.003));
  u.hp = Math.max(0, +(u.hp - amount).toFixed(1));
  u.damageTaken = (u.damageTaken || 0) + amount;
  u.inv = 0.5;
  if (stats.hitSpeedBoost) u.hurtBoost = 2;
  pushFx(world, { type: 'hit_player', seat: u.seat, x: Math.round(u.x), y: Math.round(u.y), amount: Math.round(amount) });
  if (u.hp <= 0) {
    u.hp = 0;
    u.alive = false;
    u.specialTimer = 0;
    if (world.outageOwnerSeat === u.seat) {
      world.outageTimer = 0;
      world.outageOwnerSeat = null;
    }
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
      const before = killer.hp;
      killer.hp = Math.min(killer.maxHp, killer.hp + kStats.cleaningKillsHeal);
      killer.healed = (killer.healed || 0) + (killer.hp - before);
    }
    if (killer.characterId === 'isr' && killer.specialTimer > 0 && killer.alive && killer.hp > 0) {
      const before = killer.hp;
      killer.hp = Math.min(killer.maxHp, killer.hp + 5);
      killer.healed = (killer.healed || 0) + (killer.hp - before);
    }
  }
  room.teamKills = seats.reduce((sum, s) => sum + (s.kills || 0), 0);

  const anyCashActive = seats.some((s) => s.characterId === 'clone' && s.specialTimer > 0);
  const cashMul = anyCashActive ? 2 : 1;
  const kStats = killer?.effStats || BASE_STATS;
  const bonus = world.rng() < (kStats.bonusSignal || 0) ? enemy.value : 0;
  const dropVal = (enemy.value + bonus) * cashMul;

  world.pickups.push({
    id: world.nextEntityId++,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    value: dropVal
  });
  if ((kStats.luck || 0) > 0 && world.rng() < (kStats.luck || 0) * 0.002) {
    world.pickups.push({
      id: world.nextEntityId++,
      x: Math.round(enemy.x + 7),
      y: Math.round(enemy.y + 7),
      value: enemy.value * cashMul
    });
  }
  pushFx(world, {
    type: 'kill',
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    color: enemy.color,
    kind: enemy.kind,
    seat: killer?.seat || 1
  });
}

function hitEnemyInWorld(world, room, seats, enemy, baseDmg, color, attacker) {
  if (!enemy || enemy.hp <= 0) return;
  const stats = attacker?.effStats || BASE_STATS;
  const crit = world.rng() < (stats.crit || 0.05);
  let amount = baseDmg * (stats.damage || 1) * (crit ? 2 : 1) * (1 + (stats.spliceQuality || 0) * 0.004);
  if (enemy.dirty) amount *= 1 + (stats.cleanliness || 0) * 0.01;
  if (!enemy.boss && world.rng() < (stats.instakill || 0)) {
    amount = enemy.hp + 1;
  }
  enemy.hp = +(enemy.hp - amount).toFixed(2);
  if (attacker) {
    attacker.damageDealt = (attacker.damageDealt || 0) + amount;
    if (stats.lifeSteal && attacker.alive && attacker.hp > 0) {
      const before = attacker.hp;
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount * stats.lifeSteal);
      attacker.healed = (attacker.healed || 0) + (attacker.hp - before);
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
  pushFx(world, {
    type: 'dmg',
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    value: Math.max(1, Math.round(amount)),
    crit,
    color
  });
  if (enemy.hp <= 0) {
    killEnemyInWorld(world, room, seats, enemy, attacker?.seat || 1);
  }
}

function nearestEnemyAt(world, x, y, maxRange) {
  let best = null;
  let bestDist = maxRange;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

function fireWeaponForPlayer(world, room, seats, u, w) {
  const stats = u.effStats || computeEffectiveStats(u);
  if (w.pattern === 'turret' && w.turret) {
    const cap = u.characterId === 'engineer' ? 3 : 2;
    const current = world.turrets.filter((t) => t.ownerSeat === u.seat && t.wid === w.id).length;
    if (current >= cap) return;
    const a = world.rng() * Math.PI * 2;
    const dmgScale = (u.characterId === 'engineer' ? stats.damage : 1) * (1 + (stats.engineering || 0) * 0.02) * (1 + (stats.turretQuality || 0) * 0.004);
    world.turrets.push({
      id: world.nextEntityId++,
      ownerSeat: u.seat,
      wid: w.id,
      mode: w.turret.mode || 'pellet',
      weaponTurret: true,
      color: w.color || '#f59e0b',
      x: clamp(u.x + Math.cos(a) * 26, 24, W - 24),
      y: clamp(u.y + Math.sin(a) * 26, 24, H - 24),
      r: 13,
      hp: 20 + (stats.engineering || 0) * 2,
      maxHp: 20 + (stats.engineering || 0) * 2,
      life: w.turret.life + (stats.engineering || 0) * 0.04,
      maxLife: w.turret.life + (stats.engineering || 0) * 0.04,
      fire: w.turret.fire / (u.characterId === 'engineer' ? stats.attackSpeed : 1),
      fireCd: 0.2,
      damage: w.damage * dmgScale,
      range: w.range || 300,
      haste: 0,
      lookA: 0
    });
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
    const snapshot = [...world.enemies];
    for (const e of snapshot) {
      const dist = Math.hypot(e.x - u.x, e.y - u.y);
      if (dist > reach + e.r) continue;
      if (half < Math.PI) {
        let diff = Math.atan2(e.y - u.y, e.x - u.x) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > half) continue;
      }
      hitEnemyInWorld(world, room, seats, e, w.damage, w.color, u);
    }
    if (w.heal && u.alive && u.hp > 0) {
      const before = u.hp;
      u.hp = Math.min(u.maxHp, u.hp + w.heal);
      u.healed = (u.healed || 0) + (u.hp - before);
    }
    pushFx(world, {
      type: 'area',
      seat: u.seat,
      x: Math.round(u.x),
      y: Math.round(u.y),
      reach: Math.round(reach),
      angle: +angle.toFixed(3),
      half: +half.toFixed(3),
      color: w.color
    });
    return;
  }

  const spawnShot = (ang) => {
    const speed = pattern === 'thrown' ? 380 : 540;
    world.shots.push({
      id: world.nextEntityId++,
      ownerSeat: u.seat,
      x: u.x,
      y: u.y - 16,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: pattern === 'beam' ? 7 : 5,
      damage: w.damage,
      color: w.color || '#38bdf8',
      pattern,
      pierce: ['pierce', 'beam', 'beamSweep'].includes(pattern),
      pen: Math.round(stats.pierce || 0),
      mortar: false,
      remaining: reach,
      maxReach: reach
    });
  };
  spawnShot(angle);
  if (pattern === 'chain') {
    spawnShot(angle - 0.16);
    spawnShot(angle + 0.16);
  }
}

export function triggerPlayerSpecial(world, room, seats, u) {
  if (!u || !u.alive || u.hp <= 0 || u.specialCooldown > 0) return false;
  const spec = CHARACTER_SPECS[u.characterId] || CHARACTER_SPECS.oracle;
  const special = spec.special;
  if (!special) return false;

  u.specialCooldown = special.cooldown;
  u.specialTimer = special.duration || 0.6;
  const stats = u.effStats || computeEffectiveStats(u);

  if (special.id === 'sprint') {
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + 40);
    u.healed = (u.healed || 0) + (u.hp - before);
    for (const peer of seats) {
      if (peer.seat !== u.seat && peer.alive && peer.hp > 0) {
        const pb = peer.hp;
        peer.hp = Math.min(peer.maxHp, peer.hp + 18);
        peer.healed = (peer.healed || 0) + (peer.hp - pb);
      }
    }
  } else if (special.id === 'clause') {
    u.clauseFired = false;
  } else if (special.id === 'trace') {
    const reach = 380;
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI * 2) / 12;
      world.shots.push({
        id: world.nextEntityId++,
        ownerSeat: u.seat,
        x: u.x,
        y: u.y - 14,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        r: 7,
        damage: 90,
        color: '#c084fc',
        pattern: 'pierce',
        pierce: true,
        pen: 99,
        mortar: false,
        remaining: reach,
        maxReach: reach
      });
    }
  } else if (special.id === 'crew') {
    for (let idx = 0; idx < 4; idx++) {
      const a = (idx * Math.PI) / 2;
      world.turrets.push({
        id: world.nextEntityId++,
        ownerSeat: u.seat,
        wid: `signature-don-${idx}`,
        mode: 'helper',
        helperIndex: idx,
        weaponTurret: false,
        color: '#38bdf8',
        x: clamp(u.x + Math.cos(a) * 28, 24, W - 24),
        y: clamp(u.y + Math.sin(a) * 28, 24, H - 24),
        r: 13,
        hp: 45 + (stats.engineering || 0) * 3,
        maxHp: 45 + (stats.engineering || 0) * 3,
        life: 8,
        maxLife: 8,
        fire: 0.45,
        fireCd: 0.15,
        damage: 18 * (1 + (stats.engineering || 0) * 0.01),
        range: 280,
        haste: 0,
        lookA: 0
      });
    }
  } else if (special.id === 'meeting') {
    world.meeting = {
      ownerSeat: u.seat,
      x: clamp(u.x + 80, 90, W - 90),
      y: clamp(u.y, 90, H - 90),
      timer: 4,
      radius: 220
    };
  } else if (special.id === 'surge') {
    world.surge = {
      ownerSeat: u.seat,
      x: clamp(u.x, 36, W - 36),
      y: clamp(u.y, 36, H - 36),
      timer: 4.8,
      pulse: 0,
      radius: 210
    };
  } else if (special.id === 'outage') {
    world.outageTimer = 8;
    world.outageOwnerSeat = u.seat;
  }

  pushFx(world, {
    type: 'special',
    seat: u.seat,
    specialId: special.id,
    label: `${u.name}: ${special.name.toUpperCase()}`,
    x: Math.round(u.x),
    y: Math.round(u.y)
  });
  return true;
}

export function triggerPlayerDeploy(world, u, deployIndex = 0) {
  if (!u || !u.alive || u.hp <= 0) return false;
  const list = u.deployables || [];
  if (!list.length) return false;
  const idx = clamp(deployIndex, 0, list.length - 1);
  const item = list[idx];
  const def = STRUCTURE_CATALOG[item?.structure];
  if (!def) return false;
  if ((u.deployCds?.[item.structure] || 0) > 0) return false;

  const stats = u.effStats || computeEffectiveStats(u);
  const totalCap = u.characterId === 'engineer' ? 12 : 2;
  const itemCap = u.characterId === 'engineer' ? 3 : item.unique ? 1 : 2;
  const myStructs = world.structures.filter((s) => s.ownerSeat === u.seat);
  if (myStructs.length >= totalCap) return false;
  if (myStructs.filter((s) => s.type === item.structure).length >= itemCap) return false;
  if (world.structures.some((s) => Math.hypot(s.x - u.x, s.y - u.y) < 90)) return false;

  const cdMult = u.characterId === 'engineer' ? 0.45 : 1;
  const stacks = clamp(item.stacks || 1, 1, 2);
  u.deployCds = u.deployCds || {};
  u.deployCds[item.structure] = def.cd * (1 - 0.12 * (stacks - 1)) * cdMult;

  world.structures.push({
    id: world.nextEntityId++,
    ownerSeat: u.seat,
    type: item.structure,
    x: clamp(Math.round(u.x), 30, W - 30),
    y: clamp(Math.round(u.y), 30, H - 30),
    r: def.r,
    life: def.life + (stats.engineering || 0) * 0.06,
    maxLife: def.life + (stats.engineering || 0) * 0.06,
    power: stacks,
    uses: def.uses || 0,
    rearm: 0,
    fireCd: 0.25,
    haste: 0,
    lookA: 0
  });
  pushFx(world, { type: 'deploy', seat: u.seat, structure: item.structure, x: Math.round(u.x), y: Math.round(u.y) });
  return true;
}

export function stepCombatWorld(world, room, seats, dt) {
  if (!world || room.phase !== 'combat') return { ended: false };
  world.seq += 1;
  world.time = Math.max(0, world.time - dt);
  if (world.outageTimer > 0) world.outageTimer = Math.max(0, world.outageTimer - dt);

  const livingSeats = seats.filter((s) => s.alive && s.hp > 0);
  if (!livingSeats.length) {
    return { ended: true, won: false };
  }

  if (world.meeting) {
    world.meeting.timer -= dt;
    if (world.meeting.timer <= 0) {
      const m = world.meeting;
      world.meeting = null;
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
      for (const e of [...world.enemies]) {
        if (Math.hypot(e.x - world.surge.x, e.y - world.surge.y) <= world.surge.radius + e.r) {
          hitEnemyInWorld(world, room, seats, e, dmg, '#7fe6f9', owner);
        }
      }
      for (const t of world.turrets) {
        t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.2);
        t.haste = 5;
      }
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

    for (const k of Object.keys(u.deployCds || {})) {
      if (u.deployCds[k] > 0) u.deployCds[k] = Math.max(0, u.deployCds[k] - dt);
    }

    u.regenAcc = (u.regenAcc || 0) + dt * (stats.regen || 0);
    if (u.regenAcc >= 1) {
      const gain = Math.floor(u.regenAcc);
      u.regenAcc -= gain;
      const before = u.hp;
      u.hp = Math.min(u.maxHp, u.hp + gain);
      u.healed = (u.healed || 0) + (u.hp - before);
    }

    const inPuddle = world.puddles.some((d) => Math.hypot(u.x - d.x, u.y - d.y) < 48);
    if (doPuddleTick && inPuddle && u.inv <= 0) {
      const mit = Math.min(0.5, Math.max(-0.35, (stats.cleanliness || 0) * 0.008));
      damagePlayerSeat(world, u, 6 * (1 - mit));
    }

    const ix = clamp(u.ix || 0, -1, 1);
    const iy = clamp(u.iy || 0, -1, 1);
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
      u.vx = 0;
      u.vy = 0;
      u.moving = false;
    }

    let pedestalBuff = 0;
    for (const st of world.structures) {
      if (st.type === 'pedestal' && Math.hypot(u.x - st.x, u.y - st.y) <= st.r) {
        pedestalBuff = Math.max(pedestalBuff, 0.25 + 0.05 * ((st.power || 1) - 1));
      }
    }

    if (!Array.isArray(u.weaponCds) || u.weaponCds.length !== u.weapons.length) {
      u.weaponCds = u.weapons.map(() => 0.15);
    }
    for (let i = 0; i < u.weapons.length; i++) {
      u.weaponCds[i] -= dt;
      if (u.weaponCds[i] <= 0) {
        const w = u.weapons[i];
        const scheduled = Math.max(0.1, (w.rate || 0.8) / ((stats.attackSpeed || 1) * (1 + pedestalBuff)));
        fireWeaponForPlayer(world, room, seats, u, w);
        u.weaponCds[i] = scheduled;
      }
    }
  }

  if (!world.bossSpawned && world.wave % 5 === 0) {
    world.bossSpawned = true;
    const bossKind = world.wave % 20 === 0 ? 'squirrel' : 'rous';
    spawnEnemyInWorld(world, bossKind, true, 99);
  }

  const activeCap = maxActiveEnemies(world.wave, seats.length);
  world.spawnCd -= dt;
  if (world.spawnCd <= 0) {
    if (world.enemies.length < activeCap) {
      spawnEnemyInWorld(world, null, false, activeCap);
    }
    world.spawnCd = spawnInterval(world.wave, seats.length);
  }

  for (let i = world.structures.length - 1; i >= 0; i--) {
    const st = world.structures[i];
    st.life -= dt;
    st.rearm = Math.max(0, (st.rearm || 0) - dt);
    st.haste = Math.max(0, (st.haste || 0) - dt);
    if (st.life <= 0) {
      world.structures.splice(i, 1);
      continue;
    }
    if (st.type === 'turretMount') {
      const hasteMul = st.haste > 0 ? 1.3 : 1;
      st.fireCd -= dt * hasteMul;
      if (st.fireCd <= 0) {
        const owner = seats.find((s) => s.seat === st.ownerSeat) || livingSeats[0];
        const oStats = owner?.effStats || BASE_STATS;
        const target = nearestEnemyAt(world, st.x, st.y, 260);
        if (target) {
          const ang = Math.atan2(target.y - st.y, target.x - st.x);
          st.lookA = ang;
          const dmg = 9 * (1 + 0.2 * ((st.power || 1) - 1)) * (1 + (oStats.engineering || 0) * 0.02);
          world.shots.push({
            id: world.nextEntityId++,
            ownerSeat: st.ownerSeat,
            x: st.x,
            y: st.y - 14,
            vx: Math.cos(ang) * 520,
            vy: Math.sin(ang) * 520,
            r: 5,
            damage: dmg,
            color: '#f59e0b',
            pattern: 'projectile',
            pierce: false,
            pen: 0,
            mortar: false,
            remaining: 260,
            maxReach: 260
          });
          st.fireCd = 0.45;
        } else {
          st.fireCd = 0.15;
        }
      }
    }
  }

  for (let i = world.turrets.length - 1; i >= 0; i--) {
    const t = world.turrets[i];
    t.life -= dt;
    t.haste = Math.max(0, (t.haste || 0) - dt);
    if (t.mode === 'helper') {
      const owner = seats.find((s) => s.seat === t.ownerSeat);
      if (owner && owner.alive) {
        const a = ((t.helperIndex || 0) * Math.PI) / 2;
        t.x += (owner.x + Math.cos(a) * 38 - t.x) * Math.min(1, dt * 4);
        t.y += (owner.y + Math.sin(a) * 38 - t.y) * Math.min(1, dt * 4);
      }
    }
    if (t.life <= 0 || t.hp <= 0) {
      world.turrets.splice(i, 1);
      continue;
    }
    const hasteMul = t.haste > 0 ? 1.3 : 1;
    t.fireCd -= dt * hasteMul;
    if (t.fireCd <= 0) {
      const reach = Math.min(340, (t.range || 280) * 0.65);
      const target = nearestEnemyAt(world, t.x, t.y, reach);
      if (target) {
        const ang = Math.atan2(target.y - t.y, target.x - t.x);
        t.lookA = ang;
        t.fireCd = t.fire || 0.5;
        const launchTurretShot = (a, speed, pattern, mortar = false) => {
          world.shots.push({
            id: world.nextEntityId++,
            ownerSeat: t.ownerSeat,
            x: t.x,
            y: t.y - 12,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            r: t.mode === 'helper' ? 7 : 5,
            damage: t.damage,
            color: t.color,
            pattern,
            pierce: pattern === 'pierce',
            pen: pattern === 'pierce' ? 3 : 0,
            mortar,
            remaining: reach,
            maxReach: reach
          });
        };
        if (t.mode === 'mortar') launchTurretShot(ang, 280, 'mortar', true);
        else if (t.mode === 'pulse') launchTurretShot(ang, 620, 'pierce', false);
        else if (t.mode === 'spread') {
          for (let k = -2; k <= 2; k++) launchTurretShot(ang + k * 0.22, 480, 'projectile', false);
        } else launchTurretShot(ang, 520, 'projectile', false);
      } else {
        t.fireCd = 0.12;
      }
    }
  }

  for (let i = world.shots.length - 1; i >= 0; i--) {
    const s = world.shots[i];
    const stepDist = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.remaining -= stepDist;
    const owner = seats.find((u) => u.seat === s.ownerSeat) || livingSeats[0];

    let removeShot = false;
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      if (!e || e.hp <= 0 || e.hitByShots.has(s.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) <= e.r + s.r + 4) {
        e.hitByShots.add(s.id);
        if (s.mortar) {
          for (const ao of [...world.enemies]) {
            if (Math.hypot(ao.x - s.x, ao.y - s.y) <= 55 + ao.r) {
              hitEnemyInWorld(world, room, seats, ao, s.damage, s.color, owner);
            }
          }
          pushFx(world, { type: 'area', seat: s.ownerSeat, x: Math.round(s.x), y: Math.round(s.y), reach: 55, angle: 0, half: Math.PI, color: s.color });
          removeShot = true;
          break;
        }
        hitEnemyInWorld(world, room, seats, e, s.damage, s.color, owner);
        if (!s.pierce) {
          if (s.pen > 0) s.pen -= 1;
          else {
            removeShot = true;
            break;
          }
        }
      }
    }
    if (removeShot || s.remaining <= 0 || s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) {
      if (s.mortar && !removeShot && s.remaining <= 0) {
        for (const ao of [...world.enemies]) {
          if (Math.hypot(ao.x - s.x, ao.y - s.y) <= 55 + ao.r) {
            hitEnemyInWorld(world, room, seats, ao, s.damage, s.color, owner);
          }
        }
      }
      world.shots.splice(i, 1);
    }
  }

  for (let i = world.foeShots.length - 1; i >= 0; i--) {
    const f = world.foeShots[i];
    const stepDist = Math.hypot(f.vx, f.vy) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.remaining -= stepDist;
    let hitPlayer = false;
    for (const u of livingSeats) {
      if (u.inv <= 0 && Math.hypot(u.x - f.x, u.y - f.y) <= 17 + f.r) {
        damagePlayerSeat(world, u, f.damage);
        hitPlayer = true;
        break;
      }
    }
    if (hitPlayer || f.remaining <= 0 || f.x < -50 || f.x > W + 50 || f.y < -50 || f.y > H + 50) {
      world.foeShots.splice(i, 1);
    }
  }

  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (!e || e.hp <= 0) continue;

    let tgt = world.meeting;
    if (!tgt) {
      let bestD = Infinity;
      for (const u of livingSeats) {
        const d = Math.hypot(u.x - e.x, u.y - e.y);
        if (d < bestD) {
          bestD = d;
          tgt = u;
        }
      }
    }
    if (!tgt) continue;

    if (e.kind === 'pete') {
      e.cloneT -= dt;
      if (e.cloneT <= 0) {
        e.cloneT = 18;
        if (world.enemies.filter((o) => o.kind === 'peteMini').length < 5) {
          spawnEnemyInWorld(world, 'peteMini', true, 99, { x: e.x + 24, y: e.y + 24 });
        }
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
          if (e.kind === 'bend') {
            world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, r: 22, damage: e.damage, remaining: 280, ring: true, rock: false });
          } else if (e.kind === 'ditch') {
            for (let k = -1; k <= 1; k++) {
              const a = ang + k * 0.26;
              world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 9, damage: e.damage * 0.85, remaining: 260, ring: false, rock: true });
            }
          } else if (e.kind === 'squirrel') {
            for (let k = -2; k <= 2; k++) {
              const a = ang + k * 0.18;
              world.foeShots.push({ id: world.nextEntityId++, x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 6, damage: e.damage * 0.75, remaining: 310, ring: false, rock: false });
            }
          }
        }
      } else if (e.castCd <= 0 && Math.hypot(tgt.x - e.x, tgt.y - e.y) < 320) {
        e.windup = 0.85;
        e.castCd = 4.2;
        e.phase = 'windup';
        e.aim = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      }
    }

    if (e.kind === 'squirrel' && e.hp <= e.max * 0.5) e.sqPhase = 2;

    let slowMul = world.outageTimer > 0 ? 0.25 : 1;
    for (let sIdx = world.structures.length - 1; sIdx >= 0; sIdx--) {
      const st = world.structures[sIdx];
      const dist = Math.hypot(e.x - st.x, e.y - st.y);
      if (st.type === 'barricade' && dist < st.r + e.r) {
        const push = (st.r + e.r - dist) * 0.6;
        const ba = Math.atan2(e.y - st.y, e.x - st.x);
        e.x += Math.cos(ba) * push;
        e.y += Math.sin(ba) * push;
      } else if (st.type === 'ratTrap' && st.rearm <= 0 && st.uses > 0 && dist < st.r + e.r) {
        st.rearm = 0.7;
        st.uses -= 1;
        const owner = seats.find((u) => u.seat === st.ownerSeat) || livingSeats[0];
        hitEnemyInWorld(world, room, seats, e, 26 * (1 + 0.2 * ((st.power || 1) - 1)), '#f87171', owner);
        if (st.uses <= 0) world.structures.splice(sIdx, 1);
      } else if (st.type === 'snare' && dist < st.r) {
        slowMul = Math.min(slowMul, 0.55);
      }
    }
    if (e.hp <= 0) continue;

    const ang = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    const spd = e.windup > 0 ? 0 : e.speed * slowMul;
    e.vx = Math.cos(ang) * spd;
    e.vy = Math.sin(ang) * spd;
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, H - e.r);

    for (let j = Math.max(0, i - 10); j < i; j++) {
      const o = world.enemies[j];
      if (!o || o.hp <= 0) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d2 = dx * dx + dy * dy;
      const minD = e.r + o.r;
      if (d2 > 0 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.2;
        e.x = clamp(e.x + (dx / d) * push, e.r, W - e.r);
        e.y = clamp(e.y + (dy / d) * push, e.r, H - e.r);
      }
    }

    if (!world.meeting) {
      for (const u of livingSeats) {
        if (u.inv <= 0 && Math.hypot(u.x - e.x, u.y - e.y) < 17 + e.r) {
          const stats = u.effStats || BASE_STATS;
          if (stats.firstHitBlocked && !u.firstBlockUsed) {
            u.firstBlockUsed = true;
            u.inv = 0.55;
            pushFx(world, { type: 'flash', seat: u.seat, text: 'FIRST HIT POLITELY DECLINED' });
          } else {
            damagePlayerSeat(world, u, e.damage);
          }
        }
      }
    }
  }

  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const d = world.pickups[i];
    let collector = null;
    let nearestD = Infinity;
    for (const u of livingSeats) {
      const dist = Math.hypot(u.x - d.x, u.y - d.y);
      if (dist < nearestD) {
        nearestD = dist;
        collector = u;
      }
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
        peer.xpEarnedWave = (peer.xpEarnedWave || 0) + xpGain;
        while (peer.xp >= signalForLevel((peer.level || 0) + (peer.pendingLevels || 0))) {
          peer.xp -= signalForLevel((peer.level || 0) + (peer.pendingLevels || 0));
          peer.pendingLevels = (peer.pendingLevels || 0) + 1;
          peer.levelsGainedWave = (peer.levelsGainedWave || 0) + 1;
        }
      }
      room.teamSignal = seats.reduce((sum, s) => sum + Math.round(s.signal || 0), 0);
    }
  }

  if (!seats.some((s) => s.alive && s.hp > 0)) return { ended: true, won: false };
  if (world.time <= 0) return { ended: true, won: true };
  return { ended: false };
}

export function serializeCombatWorld(world, seats) {
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
      seat: u.seat,
      name: u.name,
      characterId: u.characterId,
      alive: u.alive,
      x: Math.round(u.x),
      y: Math.round(u.y),
      vx: Math.round(u.vx || 0),
      vy: Math.round(u.vy || 0),
      hp: +Number(u.hp || 0).toFixed(1),
      maxHp: u.maxHp,
      side: u.side || 'right',
      moving: Boolean(u.moving),
      attack: +(u.attack || 0).toFixed(2),
      special: +(u.specialTimer || 0).toFixed(2),
      specialCooldown: +(u.specialCooldown || 0).toFixed(2),
      kills: u.kills || 0,
      signal: Math.round(u.signal || 0),
      earnedSignal: Math.round(u.earnedSignal || 0),
      xp: +(u.xp || 0).toFixed(2),
      level: (u.level || 0) + (u.pendingLevels || 0),
      pendingLevels: u.pendingLevels || 0,
      damageDealt: Math.round(u.damageDealt || 0),
      healed: Math.round(u.healed || 0),
      damageTaken: Math.round(u.damageTaken || 0),
      deployCds: { ...(u.deployCds || {}) },
      weapons: u.weapons || []
    })),
    enemies: world.enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      x: Math.round(e.x),
      y: Math.round(e.y),
      vx: Math.round(e.vx || 0),
      vy: Math.round(e.vy || 0),
      r: e.r,
      hp: Math.round(e.hp),
      max: Math.round(e.max),
      color: e.color,
      elite: e.elite,
      boss: e.boss,
      phase: e.phase,
      sqPhase: e.sqPhase || 1
    })),
    shots: world.shots.map((s) => ({
      id: s.id,
      seat: s.ownerSeat,
      x: Math.round(s.x),
      y: Math.round(s.y),
      vx: Math.round(s.vx),
      vy: Math.round(s.vy),
      r: s.r,
      color: s.color,
      pattern: s.pattern,
      mortar: s.mortar
    })),
    foeShots: world.foeShots.map((f) => ({
      id: f.id,
      x: Math.round(f.x),
      y: Math.round(f.y),
      vx: Math.round(f.vx),
      vy: Math.round(f.vy),
      r: f.r,
      ring: f.ring,
      rock: f.rock
    })),
    turrets: world.turrets.map((t) => ({
      id: t.id,
      seat: t.ownerSeat,
      mode: t.mode,
      helperIndex: t.helperIndex || 0,
      weaponTurret: t.weaponTurret,
      x: Math.round(t.x),
      y: Math.round(t.y),
      hp: Math.round(t.hp),
      maxHp: Math.round(t.maxHp),
      life: +t.life.toFixed(2),
      maxLife: t.maxLife,
      color: t.color,
      lookA: +t.lookA.toFixed(2)
    })),
    structures: world.structures.map((st) => ({
      id: st.id,
      seat: st.ownerSeat,
      type: st.type,
      x: Math.round(st.x),
      y: Math.round(st.y),
      r: st.r,
      life: +st.life.toFixed(2),
      maxLife: st.maxLife,
      lookA: +st.lookA.toFixed(2)
    })),
    pickups: world.pickups.map((d) => ({
      id: d.id,
      x: Math.round(d.x),
      y: Math.round(d.y),
      value: d.value
    })),
    puddles: world.puddles.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      life: +p.life.toFixed(2),
      maxLife: p.maxLife
    })),
    fx
  };
}