import { characterById } from '@/game/data/characters';
import { ENEMIES } from '@/game/data/combat';
import { STRUCTURES } from '@/game/data/structures';
import { SQUIRREL, ROUS } from '@/game/data/bosses';
import { enemySprite } from '@/game/performance/spriteAtlas';
import { createLagAnimation, updateLagAnimation } from '@/game/art/enemySpriteAnimation';
import { createTechAnimation, updateTechAnimation, drawTechSprite, drawTechDeathFrame } from '@/game/art/techSpriteAnimation';
import { createSpriteAnimation, updateSpriteAnimation, drawCharacterSprite } from '@/game/art/spriteAnimation';
import { createISRAnimation, updateISRAnimation } from '@/game/art/isrSpriteAnimation';
import { drawISR } from '@/game/art/drawISR';
import { loadedCharacterSprite, preloadCharacterSprite } from '@/game/art/spriteLoader';
import { createPuddingAnimation, updatePuddingAnimation } from '@/game/art/puddingSpriteAnimation';
import { createBendAnimation, updateBendAnimation } from '@/game/art/bendSpriteAnimation';
import { createSquirrelAnimation, updateSquirrelAnimation } from '@/game/art/squirrelSpriteAnimation';
import { createDitchState } from '@/game/combat/ditchWitch';
import { createConeState, APPARITION, ROUTER_ATTACK } from '@/game/combat/coneAttack';
import { createCritterState } from '@/game/combat/crosstalk';
import { createJitterState } from '@/game/combat/jitter';
import { createBendState } from '@/game/combat/macrobend';

function ensurePeerSpriteState(peer, charId) {
  if (!peer.spriteState || peer.spriteCharId !== charId) {
    peer.spriteCharId = charId;
    peer.spriteState =
      charId === 'isr'
        ? createISRAnimation()
        : charId === 'oracle'
        ? createSpriteAnimation()
        : createTechAnimation();
  }
  return peer.spriteState;
}

function updatePeerSprite(peer, dx, dy, dt) {
  const charId = characterById(peer.characterId || 'oracle').id;
  const spriteState = ensurePeerSpriteState(peer, charId);
  const art = peer.art || loadedCharacterSprite(charId);
  if (!art && typeof window !== 'undefined') {
    preloadCharacterSprite(charId).catch(() => {});
  }
  spriteState.special = (peer.special || 0) > 0 ? peer.special : 0;
  if (charId === 'oracle') {
    if (art?.definition) updateSpriteAnimation(spriteState, dx, dy, dt, art.definition);
  } else if (charId === 'isr') {
    updateISRAnimation(spriteState, dx, dy, dt);
  } else if (art?.definition) {
    updateTechAnimation(spriteState, dx, dy, dt, art.definition);
  }
}

function reconcilePoolById(pool, list, dt, configureItem) {
  const incoming = Array.isArray(list) ? list : [];
  const byId = new Map();
  for (let i = 0; i < incoming.length; i++) {
    const item = incoming[i];
    if (item && item.id !== undefined && Number.isFinite(item.x) && Number.isFinite(item.y) && !(item.hp !== undefined && item.hp <= 0)) byId.set(item.id, item);
  }

  const existingById = new Map();
  for (let i = 0; i < pool.items.length; i++) {
    const obj = pool.items[i];
    if (!obj.active) continue;
    if (obj.netId !== undefined && byId.has(obj.netId) && !existingById.has(obj.netId)) {
      existingById.set(obj.netId, obj);
    } else {
      pool.release(obj);
    }
  }

  for (const [id, src] of byId.entries()) {
    let obj = existingById.get(id);
    const isNew = !obj;
    if (!obj) {
      obj = pool.acquire();
      if (!obj) continue;
      obj.netId = id;
    }
    configureItem(obj, src, isNew, dt);
  }
}

/**
 * Reconciles the authoritative CoopRoom world snapshot into the local SignalEngine
 * pools so all connected clients render the exact same enemies, bosses, projectiles,
 * structures, pickups, puddles, and combat effects at 60fps.
 */
export function syncAuthoritativeCoopWorld(state) {
  const {
    run,
    dt,
    p,
    enemies,
    shots,
    foeShots,
    turrets,
    structures,
    pickups,
    puddles,
    meeting,
    surge,
    arts,
    fxCallbacks
  } = state;

  const world = run.coopWorldRef?.current;
  if (!world) return null;

  // 1. Reconcile players & peers
  const players = Array.isArray(world.players) ? world.players : [];
  const me = players.find((pl) => pl.seat === run.coopSeat);
  if (me) {
    const dist = Math.hypot((me.x ?? p.x) - p.x, (me.y ?? p.y) - p.y);
    if (dist > 95) {
      p.x = me.x;
      p.y = me.y;
    } else if (dist > 2) {
      p.x += (me.x - p.x) * Math.min(1, dt * 12);
      p.y += (me.y - p.y) * Math.min(1, dt * 12);
    }
    p.hp = me.hp;
    p.maxHp = me.maxHp || p.maxHp;
  }

  if (run.coopPeers) {
    const prevPeers = new Map((run.coopPeers.current || []).map((pr) => [pr.seat, pr]));
    run.coopPeers.current = players.map((pl) => {
      const old = prevPeers.get(pl.seat);
      const prevRx = old?.rx !== undefined ? old.rx : pl.x;
      const prevRy = old?.ry !== undefined ? old.ry : pl.y;
      const rx = old?.rx !== undefined ? old.rx + (pl.x - old.rx) * Math.min(1, dt * 14) : pl.x;
      const ry = old?.ry !== undefined ? old.ry + (pl.y - old.ry) * Math.min(1, dt * 14) : pl.y;
      const peerObj = { ...(old || {}), ...pl, rx, ry };
      const dx = Math.abs(rx - prevRx) > 0.001 ? rx - prevRx : (pl.vx || 0) * dt;
      const dy = Math.abs(ry - prevRy) > 0.001 ? ry - prevRy : (pl.vy || 0) * dt;
      updatePeerSprite(peerObj, dx, dy, dt);
      return peerObj;
    });
  }

  // 2. Reconcile enemies and bosses
  reconcilePoolById(enemies, world.enemies, dt, (e, src, isNew) => {
    const prevX = isNew ? src.x : e.x;
    const prevY = isNew ? src.y : e.y;
    const tx = src.x + (src.vx || 0) * dt * 0.35;
    const ty = src.y + (src.vy || 0) * dt * 0.35;
    e.x = isNew ? src.x : e.x + (tx - e.x) * Math.min(1, dt * 16);
    e.y = isNew ? src.y : e.y + (ty - e.y) * Math.min(1, dt * 16);
    const mvx = (e.x - prevX) / Math.max(0.001, dt);
    const mvy = (e.y - prevY) / Math.max(0.001, dt);

    e.kind = src.kind;
    e.hp = src.hp;
    e.max = src.max;
    e.r = src.r || 14;
    e.boss = Boolean(src.boss);
    e.elite = Boolean(src.elite);
    e.shoutT = src.shoutT || 0;
    e.novaT = src.novaT || 0;

    if (isNew || e.configuredKind !== src.kind) {
      e.configuredKind = src.kind;
      const base =
        src.kind === 'squirrel'
          ? SQUIRREL
          : src.kind === 'rous'
          ? ROUS
          : ENEMIES[src.kind] || ENEMIES.lag;
      e.color = base?.color || '#f87171';
      e.sound = base?.sound || 'hit';
      e.sprite = e.boss ? null : enemySprite(src.kind, base || ENEMIES.lag);
      e.art = null;
      e.anim = null;
      e.sq = null;
      e.ditch = null;
      e.caster = null;
      e.critter = null;
      e.jit = null;
      e.mac = null;
      e.pud = null;

      if (src.kind === 'ditch' && arts.ditchArt) {
        e.art = arts.ditchArt;
        e.ditch = createDitchState(() => .5);
      } else if (src.kind === 'attenuation' && arts.apparitionArt) {
        e.art = arts.apparitionArt;
        e.caster = createConeState(APPARITION);
      } else if (src.kind === 'rous' && arts.routerArt) {
        e.art = arts.routerArt;
        e.caster = createConeState(ROUTER_ATTACK);
      } else if (src.kind === 'crosstalk' && arts.critterArt) {
        e.art = arts.critterArt;
        e.critter = createCritterState();
      } else if (src.kind === 'jitter' && arts.jitterArt) {
        e.art = arts.jitterArt;
        e.jit = createJitterState(() => .5);
      } else if (src.kind === 'lag' && arts.lagArt) {
        e.art = arts.lagArt;
        e.anim = createLagAnimation();
      } else if (src.kind === 'dirty' && arts.blobArtDef) {
        e.art = arts.blobArtDef;
        e.anim = createTechAnimation();
      } else if (src.kind === 'packet' && arts.puddingArt) {
        e.art = arts.puddingArt;
        e.anim = createPuddingAnimation();
        e.pud = { phase: 'chase' };
      } else if ((src.kind === 'pete' || src.kind === 'peteMini') && arts.petArt) {
        e.art = arts.petArt;
        e.anim = createTechAnimation();
      } else if (src.kind === 'bend' && arts.bendArt) {
        e.art = arts.bendArt;
        e.anim = createBendAnimation();
        e.mac = createBendState(() => .5);
      } else if (src.kind === 'squirrel' && arts.sqArt) {
        e.sq = { ...createSquirrelAnimation(), art: arts.sqArt, phase: src.phase || 1, pounceT: src.pounceT || 0 };
      }
    }

    // Renderer clocks must advance independently of snapshot frequency. These
    // are visual DTOs only: never run local combat state machines in co-op.
    for (const visual of [e.ditch, e.caster, e.critter, e.jit, e.mac]) {
      if (!visual) continue;
      const snapshot = src.renderState || {};
      visual.clock = Number.isFinite(snapshot.clock) ? snapshot.clock : (Number.isFinite(visual.clock) ? visual.clock : 0) + dt;
      visual.remaining = Number.isFinite(snapshot.remaining) ? snapshot.remaining : Math.max(0, visual.remaining || 0);
      visual.facing = snapshot.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
    }
    if (e.ditch) {
      e.ditch.phase = src.state || src.phase || 'chase';
      e.ditch.facing = src.renderState?.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
      e.ditch.animT = (e.ditch.animT || 0) + dt;
    }
    if (e.caster) {
      e.caster.phase = src.renderState?.phase || src.state || (typeof src.phase === 'string' ? src.phase : 'chase');
      e.caster.facing = src.renderState?.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
      e.caster.vx = mvx;
      e.caster.vy = mvy;
      e.caster.x = e.x;
      e.caster.y = e.y;
    }
    if (e.critter) {
      e.critter.phase = src.renderState?.phase || src.state || (typeof src.phase === 'string' ? src.phase : 'chase');
      e.critter.facing = src.renderState?.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
    }
    if (e.jit) {
      e.jit.phase = src.renderState?.phase || src.state || (typeof src.phase === 'string' ? src.phase : 'chase');
      e.jit.facing = src.renderState?.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
    }
    if (e.mac) {
      e.mac.phase = src.renderState?.phase || src.state || (typeof src.phase === 'string' ? src.phase : 'chase');
      e.mac.facing = src.renderState?.facing || src.facing || ((src.vx || 0) < 0 ? 'left' : 'right');
    }
    if (e.pud) {
      e.pud.phase = src.renderState?.phase || src.state || (typeof src.phase === 'string' ? src.phase : 'chase');
      if (e.anim) e.anim.telegraph = e.pud.phase === 'telegraph';
    }
    if (e.sq && arts.sqArt) {
      e.sq.phase = src.phase || 1;
      e.sq.pounceT = src.pounceT || 0;
      updateSquirrelAnimation(e.sq, mvx, mvy, dt, arts.sqArt.definition);
    } else if (e.anim) {
      if (e.art === arts.puddingArt && arts.pudArtDef) {
        updatePuddingAnimation(e.anim, mvx, mvy, dt, arts.pudArtDef.definition);
      } else if (e.art === arts.blobArtDef) {
        updateTechAnimation(e.anim, mvx * dt, mvy * dt, dt, arts.blobArtDef.definition);
      } else if (arts.petArt && (e.kind === 'pete' || e.kind === 'peteMini')) {
        updateTechAnimation(e.anim, mvx * dt, mvy * dt, dt, arts.petArt.definition);
      } else if (e.mac && arts.bendArtDef) {
        updateBendAnimation(e.anim, mvx, mvy, dt, e.mac);
      } else if (arts.lagArt) {
        updateLagAnimation(e.anim, mvx * dt, mvy * dt, dt, arts.lagArt.definition);
      }
    }
  });

  // 3. Reconcile player & turret projectiles
  reconcilePoolById(shots, world.shots, dt, (s, src, isNew) => {
    s.prevX = isNew ? src.x : s.x;
    s.prevY = isNew ? src.y : s.y;
    s.x = isNew ? src.x : s.x + (src.x + (src.vx || 0) * dt * 0.5 - s.x) * Math.min(1, dt * 20);
    s.y = isNew ? src.y : s.y + (src.y + (src.vy || 0) * dt * 0.5 - s.y) * Math.min(1, dt * 20);
    s.vx = src.vx || 0;
    s.vy = src.vy || 0;
    s.r = src.r || 5;
    s.color = src.color || '#67e8f9';
    s.pattern = src.pattern || 'projectile';
    s.mortar = Boolean(src.mortar);
    s.helper = Boolean(src.helper);
    if (isNew && run.coopPeers?.current) {
      for (const peer of run.coopPeers.current) {
        if (!peer || peer.seat === run.coopSeat || !peer.spriteState) continue;
        if (Math.hypot((peer.rx ?? peer.x) - src.x, (peer.ry ?? peer.y) - src.y) < 48) {
          peer.spriteState.attack = Math.max(peer.spriteState.attack || 0, 0.35);
          if (Math.abs(src.vx || 0) > 5) {
            peer.spriteState.attackFace = src.vx < 0 ? 'left' : 'right';
          }
        }
      }
    }
  });

  // 4. Reconcile enemy projectiles
  reconcilePoolById(foeShots, world.foeShots, dt, (f, src, isNew) => {
    f.prevX = isNew ? src.x : f.x;
    f.prevY = isNew ? src.y : f.y;
    f.x = isNew ? src.x : f.x + (src.x + (src.vx || 0) * dt * 0.5 - f.x) * Math.min(1, dt * 20);
    f.y = isNew ? src.y : f.y + (src.y + (src.vy || 0) * dt * 0.5 - f.y) * Math.min(1, dt * 20);
    f.vx = src.vx || 0;
    f.vy = src.vy || 0;
    f.r = src.r || 6;
    f.color = src.color || '#f87171';
    f.ring = Boolean(src.ring);
    f.rock = Boolean(src.rock);
  });

  // 5. Reconcile turrets
  reconcilePoolById(turrets, world.turrets, dt, (t, src, isNew) => {
    t.x = isNew ? src.x : t.x + (src.x - t.x) * Math.min(1, dt * 14);
    t.y = isNew ? src.y : t.y + (src.y - t.y) * Math.min(1, dt * 14);
    t.r = src.r || 13;
    t.wid = src.wid;
    t.mode = src.mode || 'pellet';
    t.helperIndex = src.helperIndex || 0;
    t.color = src.color || '#f59e0b';
    t.hp = src.hp ?? 25;
    t.maxHp = src.maxHp ?? 25;
    t.life = src.life ?? 10;
    t.maxLife = src.maxLife ?? 10;
    t.lookA = src.lookA || 0;
    t.weaponTurret = Boolean(src.weaponTurret);
    t.born = isNew ? 0.25 : (t.born || 0.25) + dt;
  });

  // 6. Reconcile structures
  reconcilePoolById(structures, world.structures, dt, (st, src, isNew) => {
    st.type = src.type;
    st.stats = STRUCTURES[src.type] || null;
    st.x = src.x;
    st.y = src.y;
    st.r = src.r || st.stats?.r || 22;
    st.life = src.life ?? 12;
    st.maxLife = src.maxLife ?? 12;
    st.power = src.power || 1;
    st.lookA = src.lookA || 0;
    st.born = isNew ? 0.25 : (st.born || 0.25) + dt;
  });

  // 7. Reconcile pickups & puddles
  reconcilePoolById(pickups, world.pickups, dt, (d, src, isNew) => {
    d.x = isNew ? src.x : d.x + (src.x - d.x) * Math.min(1, dt * 16);
    d.y = isNew ? src.y : d.y + (src.y - d.y) * Math.min(1, dt * 16);
    d.value = src.value || 1;
  });

  reconcilePoolById(puddles, world.puddles, dt, (d, src, isNew) => {
    d.x = src.x;
    d.y = src.y;
    d.life = src.life ?? 4;
    d.maxLife = src.maxLife ?? 6.5;
    d.born = Math.max(0, d.maxLife - d.life);
    if (isNew) d.mirror = ((Math.round(src.x * 0.13) + Math.round(src.y * 0.07)) & 1) === 1;
  });

  // 8. Reconcile meeting table & surge
  if (world.meeting) {
    meeting.active = true;
    meeting.x = world.meeting.x;
    meeting.y = world.meeting.y;
  } else {
    meeting.active = false;
  }

  const activeSurge = (Array.isArray(world.surges) && world.surges[0]) || world.surge || null;
  if (activeSurge) {
    surge.active = true;
    surge.x = activeSurge.x;
    surge.y = activeSurge.y;
    surge.pulse = activeSurge.pulse || 0;
  } else {
    surge.active = false;
  }

  // 9. Process authoritative world FX events once per fx.id
  if (!run.coopProcessedFxRef) run.coopProcessedFxRef = { lastId: 0 };
  const fxList = Array.isArray(world.fx) ? world.fx : [];
  for (let i = 0; i < fxList.length; i++) {
    const ev = fxList[i];
    if (!ev || (ev.id && ev.id <= run.coopProcessedFxRef.lastId)) continue;
    if (ev.id) run.coopProcessedFxRef.lastId = ev.id;

    if (ev.type === 'dmg') {
      fxCallbacks.damageNumber(ev.x, ev.y, ev.amount ?? ev.value ?? 1, ev.crit);
      fxCallbacks.particle(ev.x, ev.y, ev.color || '#67e8f9', ev.crit ? 6 : 2);
    } else if (ev.type === 'kill') {
      fxCallbacks.particle(ev.x, ev.y, ev.color || '#f87171', 8);
      if (ev.elite) fxCallbacks.addShake(4);
    } else if (ev.type === 'area') {
      fxCallbacks.showArea(ev.x, ev.y, ev.r ?? ev.reach ?? 120, ev.color || '#fbbf24');
      fxCallbacks.particle(ev.x, ev.y, ev.color || '#fbbf24', 10);
      fxCallbacks.sfx('burst');
    } else if (ev.type === 'special') {
      fxCallbacks.particle(ev.x || p.x, ev.y || p.y, '#fde047', 12);
      if (ev.label) fxCallbacks.flash(ev.label);
      fxCallbacks.sfx('special');
    } else if (ev.type === 'deploy') {
      fxCallbacks.particle(ev.x || p.x, ev.y || p.y, '#d6d3d1', 6);
      fxCallbacks.sfx('deploy');
    } else if (ev.type === 'hit_player') {
      fxCallbacks.particle(ev.x || p.x, ev.y || p.y, '#ffffff', 8);
      if (ev.seat === run.coopSeat) {
        fxCallbacks.sfx('hit');
        fxCallbacks.addShake(4);
      } else if (run.coopPeers?.current) {
        const hitPeer = run.coopPeers.current.find((pr) => pr.seat === ev.seat);
        if (hitPeer?.spriteState) hitPeer.spriteState.hurt = 0.18;
      }
    } else if (ev.type === 'ping') {
      fxCallbacks.particle(ev.x || p.x, ev.y || p.y, '#67e8f9', 14);
      fxCallbacks.flash(`${String(ev.name || 'ALLY').toUpperCase()} PINGED SECTOR`);
    } else if (ev.type === 'flash' && ev.text) {
      fxCallbacks.flash(ev.text);
    }
  }

  return { me, world };
}

export function stepCoopPeers(run, dt, api) {
  if (!run.coop) return;

  const events = run.coopEvents?.current;
  if (Array.isArray(events) && events.length) {
    const batch = events.splice(0, events.length);
    for (const ev of batch) {
      if (!ev || ev.seat === run.coopSeat) continue;
      if (ev.kind === 'heal_pulse' && ev.amount > 0 && api.player.hp > 0) {
        api.heal(ev.amount);
        api.particle(api.player.x, api.player.y, '#22c55e', 10);
        api.flash(`${ev.name} SHARED +${Math.round(ev.amount)} HP`);
      } else if (ev.kind === 'boss_damage' && ev.amount > 0) {
        api.damageBoss(ev.amount);
      } else if (ev.kind === 'special') {
        api.particle(ev.x || api.player.x, ev.y || api.player.y, '#fde047', 12);
        if (ev.label) api.flash(`${ev.name}: ${ev.label}`);
      } else if (ev.kind === 'ping') {
        api.particle(ev.x || api.player.x, ev.y || api.player.y, '#67e8f9', 16);
        api.flash(`${ev.name} PINGED THE FIELD`);
      }
    }
  }

  const peers = run.coopPeers?.current;
  if (!Array.isArray(peers)) return;
  for (const peer of peers) {
    if (!peer || peer.seat === run.coopSeat) continue;
    const tx = Number.isFinite(peer.x) ? peer.x : 550;
    const ty = Number.isFinite(peer.y) ? peer.y : 400;
    const prevRx = peer.rx ?? tx;
    const prevRy = peer.ry ?? ty;
    peer.rx = prevRx + (tx - prevRx) * Math.min(1, dt * 12);
    peer.ry = prevRy + (ty - prevRy) * Math.min(1, dt * 12);
    updatePeerSprite(peer, peer.rx - prevRx, peer.ry - prevRy, dt);
    if (!peer.alive || peer.hp <= 0) continue;

    if (!run.coopAuthoritative) {
      peer.fireCd = (peer.fireCd ?? 0.45) - dt;
      if (peer.fireCd <= 0) {
        const w = peer.weapons?.[0];
        const reach = Math.min(320, Math.max(150, w?.range || 230));
        const target = api.nearestAt(peer.rx, peer.ry, reach);
        if (target) {
          const ang = Math.atan2(target.y - (peer.ry - 16), target.x - peer.rx);
          api.launch(
            {
              damage: Math.max(6, (w?.damage || 12) * 0.65),
              range: reach,
              pattern: 'projectile',
              color: w?.color || '#67e8f9',
              speed: 520
            },
            ang,
            peer.rx,
            peer.ry - 16,
            reach
          );
          peer.fireCd = 0.65;
        } else {
          peer.fireCd = 0.2;
        }
      }
    }
  }
}

export function drawCoopPeers(ctx, run) {
  if (!run.coop) return;
  const peers = run.coopPeers?.current;
  if (!Array.isArray(peers) || !peers.length) return;

  for (const peer of peers) {
    if (!peer || peer.seat === run.coopSeat) continue;
    const x = Math.round(peer.rx ?? peer.x ?? 550);
    const y = Math.round(peer.ry ?? peer.y ?? 400);
    const ch = characterById(peer.characterId || 'oracle');
    const alive = peer.alive !== false && (peer.hp ?? 1) > 0;
    const connected = peer.connected !== false;

    ctx.save();
    ctx.globalAlpha = !connected ? 0.35 : alive ? 0.94 : 0.45;

    // Co-op ground ring
    ctx.strokeStyle = !connected ? '#94a3b8' : alive ? '#67e8f9' : '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 2, 18, 0, Math.PI * 2);
    ctx.stroke();

    const art = peer.art || loadedCharacterSprite(ch.id);
    const spriteState = ensurePeerSpriteState(peer, ch.id);
    const rawX = peer.rx ?? peer.x ?? 550;
    const rawY = peer.ry ?? peer.y ?? 400;
    const drawX = (peer.special || 0) > 0 && ch.id === 'nomad' ? rawX + Math.sin(performance.now() * 0.05) * 2 : rawX;
    const drawY = (peer.special || 0) > 0 && ch.id === 'nomad' ? rawY + Math.cos(performance.now() * 0.05) * 2 : rawY;

    if (art && spriteState) {
      if (!alive && art.definition?.deathColumns && art.death) {
        drawTechDeathFrame(ctx, art, art.definition.deathColumns - 1, drawX, drawY);
      } else if (ch.id === 'isr') {
        drawISR(ctx, art, spriteState, drawX, drawY);
      } else if (ch.id === 'oracle') {
        drawCharacterSprite(ctx, art, spriteState, drawX, drawY);
      } else {
        drawTechSprite(ctx, art, spriteState, drawX, drawY);
      }
    } else {
      // Fallback technician silhouette when sprite assets are not loaded (e.g. headless tests)
      ctx.fillStyle = ch.color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ch.vest || '#facc15';
      ctx.fillRect(x - 12, y + 2, 24, 14);
      ctx.fillStyle = ch.belt || '#1e293b';
      ctx.fillRect(x - 13, y + 10, 26, 4);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, y - 12, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 13, y - 13, 26, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 7, y - 5, 5, 6);
      ctx.fillRect(x + 2, y - 5, 5, 6);
    }

    if ((peer.special || 0) > 0 && ch.special?.id !== 'outage') {
      ctx.strokeStyle = ch.special?.id === 'cash' ? '#22c55e' : ch.special?.id === 'sprint' ? '#22d3ee' : '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 18, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Overhead HP bar + seat callsign positioned cleanly above full character sprites
    const barY = art ? y - 52 : y - 34;
    const ratio = Math.max(0, Math.min(1, (peer.hp || 0) / Math.max(1, peer.maxHp || 100)));
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(x - 22, barY, 44, 6);
    ctx.fillStyle = ratio > 0.35 ? '#22d3ee' : '#f87171';
    ctx.fillRect(x - 21, barY + 1, Math.round(42 * ratio), 4);

    ctx.font = 'bold 11px Chivo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0f2fe';
    const label = `P${peer.seat} ${String(peer.name || 'Tech').slice(0, 10)}${!connected ? ' (DC)' : ''}`;
    ctx.fillText(label, x, barY - 5);
    ctx.restore();
  }
}