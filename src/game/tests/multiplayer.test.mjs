import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCoopConnId } from '@/game/multiplayer/useCoopRoom';
import { stepCoopPeers, drawCoopPeers, syncAuthoritativeCoopWorld } from '@/game/multiplayer/coopArenaSync';
import ObjectPool from '@/game/performance/ObjectPool';
import { CHARACTER_SPRITES } from '@/game/art/characterSprites';
import drawEnemyBody from '@/game/art/drawEnemyBody';
import { makeRecordingCtx, preloadEnemySprite } from './engineHarness.mjs';

function makeMockStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    }
  };
}

test('CoopRoom actor and Multiplayer WebSocket wiring are registered with authoritative simulation', () => {
  const actorSrc = readFileSync(new URL('../../../base44/actors/CoopRoom/entry.ts', import.meta.url), 'utf8');
  assert(actorSrc.includes("import { Actor } from 'base44:runtime/actors'"), 'uses Base44 runtime Actor');
  assert(actorSrc.includes('export default class CoopRoom extends Actor'), 'exports default CoopRoom actor');
  assert(
    actorSrc.includes('handleConnect') && actorSrc.includes('handleMessage') && actorSrc.includes('handleClose'),
    'implements lifecycle hooks'
  );
  assert(
    actorSrc.includes('createCombatWorld') && actorSrc.includes('stepCombatWorld') && actorSrc.includes('serializeCombatWorld'),
    'actor owns authoritative server-side combat simulation and world serialization'
  );
  assert(
    actorSrc.includes('match_already_started') && actorSrc.includes('room_full') && actorSrc.includes('crew_not_ready'),
    'actor enforces room capacity, ready check, and in-progress join rejection'
  );

  const hookSrc = readFileSync(new URL('../multiplayer/useCoopRoom.js', import.meta.url), 'utf8');
  assert(hookSrc.includes('base44.actors.CoopRoom(roomId).connect'), 'connects to CoopRoom WebSocket actor');
  assert(hookSrc.includes('world_tick') && hookSrc.includes('room_error'), 'handles authoritative world ticks and room errors');

  const mpSrc = readFileSync(new URL('../../pages/Multiplayer.jsx', import.meta.url), 'utf8');
  assert(mpSrc.includes('useCoopRoom'), 'Multiplayer page uses WebSocket room hook');
  assert(mpSrc.includes('coopAuthoritative: true'), 'Multiplayer page enables authoritative co-op mode');
});

test('resolveCoopConnId isolates tabs, rooms, and user accounts while preserving same-tab reload identity', () => {
  const storage = makeMockStorage();
  const tabA = { name: '' };
  const tabB = { name: '' };

  const idA1 = resolveCoopConnId('room-101', 'user-1', storage, tabA);
  const idA2 = resolveCoopConnId('room-101', 'user-1', storage, tabA);
  assert.equal(idA1, idA2, 'reloading the same tab in the same room reuses connection id');
  assert(tabA.name.startsWith('signal_tab_'), 'assigns persistent tab token to window.name');

  const idTabB = resolveCoopConnId('room-101', 'user-1', storage, tabB);
  assert.notEqual(idA1, idTabB, 'second tab gets a distinct connection id even in the same sessionStorage');

  const idOtherRoom = resolveCoopConnId('room-202', 'user-1', storage, tabA);
  assert.notEqual(idA1, idOtherRoom, 'different room gets a distinct connection id');

  const idAccountSwitch = resolveCoopConnId('room-101', 'user-2', storage, tabA);
  assert.notEqual(idA1, idAccountSwitch, 'switching user account rotates connection id and purges prior user keys');
});

test('syncAuthoritativeCoopWorld reconciles server world entities, players, and FX into client engine pools without duplication', () => {
  const makePoolSet = () => ({
    enemies: new ObjectPool(32, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, hp: 0, r: 10 })),
    shots: new ObjectPool(32, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, r: 5 })),
    foeShots: new ObjectPool(16, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, r: 6 })),
    turrets: new ObjectPool(16, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, r: 13 })),
    structures: new ObjectPool(16, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, r: 20 })),
    pickups: new ObjectPool(32, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, value: 1 })),
    puddles: new ObjectPool(16, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, life: 4, maxLife: 6.5 }))
  });

  const sharedSnapshot = {
    tick: 10,
    wave: 20,
    time: 22.5,
    boss: { name: 'THE FIBER-CHOMPING SQUIRREL', hp: 1850, max: 2200, phase: 1 },
    meeting: { ownerSeat: 1, x: 520, y: 390, timer: 3.2, radius: 220 },
    surges: [{ ownerSeat: 2, x: 600, y: 410, pulse: 2 }],
    players: [
      { seat: 1, name: 'Host', characterId: 'oracle', x: 510, y: 395, hp: 88, maxHp: 90, alive: true, signal: 14, kills: 3 },
      { seat: 2, name: 'Ally', characterId: 'don', x: 615, y: 412, hp: 110, maxHp: 115, alive: true, signal: 14, kills: 2 }
    ],
    enemies: [
      { id: 101, kind: 'lag', x: 450, y: 360, vx: 20, vy: 10, hp: 18, max: 24, r: 13, boss: false, elite: false, state: 'chase', facing: 'right' },
      { id: 102, kind: 'squirrel', x: 700, y: 420, vx: -15, vy: 0, hp: 1850, max: 2200, r: 30, boss: true, elite: true, state: 'chase', facing: 'left', phase: 1 }
    ],
    shots: [{ id: 201, x: 530, y: 395, vx: 400, vy: 0, r: 5, color: '#38bdf8', pattern: 'beam', mortar: false, helper: false }],
    foeShots: [{ id: 301, x: 680, y: 420, vx: -210, vy: 0, r: 14, color: '#c084fc', ring: true, rock: false }],
    turrets: [{ id: 401, ownerSeat: 2, wid: 'turret_kit', mode: 'pellet', helperIndex: 0, x: 605, y: 405, r: 13, color: '#facc15', hp: 25, maxHp: 25, life: 9, maxLife: 11, lookA: 0, weaponTurret: true }],
    structures: [{ id: 501, ownerSeat: 2, type: 'barricade', x: 590, y: 400, r: 26, life: 14, maxLife: 16, power: 1, lookA: 0 }],
    pickups: [{ id: 601, x: 460, y: 365, value: 4 }],
    puddles: [{ id: 701, x: 500, y: 430, life: 5, maxLife: 6.5 }],
    fx: [
      { id: 1, type: 'dmg', x: 450, y: 360, amount: 12, crit: true, color: '#38bdf8' },
      { id: 2, type: 'ping', seat: 2, name: 'Ally', x: 615, y: 412 }
    ]
  };

  // Both Seat 1 and Seat 2 reconcile the same authoritative snapshot
  const client1Pools = makePoolSet();
  const client2Pools = makePoolSet();
  const worldRef1 = { current: sharedSnapshot };
  const worldRef2 = { current: sharedSnapshot };

  let dmgCalls = 0;
  const flashes = [];

  const state1 = {
    run: { coop: true, coopAuthoritative: true, coopSeat: 1, coopWorldRef: worldRef1, coopPeers: { current: [] } },
    dt: 1 / 60,
    p: { x: 508, y: 394, hp: 90, maxHp: 90 },
    ...client1Pools,
    meeting: { active: false, x: 0, y: 0 },
    surge: { active: false, x: 0, y: 0, pulse: 0 },
    arts: {},
    fxCallbacks: {
      damageNumber: () => {
        dmgCalls += 1;
      },
      particle() {},
      addShake() {},
      sfx() {},
      flash: (t) => flashes.push(t),
      showArea() {}
    }
  };

  const state2 = {
    run: { coop: true, coopAuthoritative: true, coopSeat: 2, coopWorldRef: worldRef2, coopPeers: { current: [] } },
    dt: 1 / 60,
    p: { x: 612, y: 410, hp: 115, maxHp: 115 },
    ...client2Pools,
    meeting: { active: false, x: 0, y: 0 },
    surge: { active: false, x: 0, y: 0, pulse: 0 },
    arts: {},
    fxCallbacks: {
      damageNumber() {},
      particle() {},
      addShake() {},
      sfx() {},
      flash() {},
      showArea() {}
    }
  };

  syncAuthoritativeCoopWorld(state1);
  syncAuthoritativeCoopWorld(state2);

  const activeEnemies1 = client1Pools.enemies.items.filter((e) => e.active);
  const activeEnemies2 = client2Pools.enemies.items.filter((e) => e.active);
  assert.equal(activeEnemies1.length, 2, 'Client 1 acquires 2 authoritative enemies');
  assert.equal(activeEnemies2.length, 2, 'Client 2 acquires the exact same 2 authoritative enemies');
  assert.deepEqual(
    activeEnemies1.map((e) => ({ netId: e.netId, kind: e.kind, hp: e.hp })),
    activeEnemies2.map((e) => ({ netId: e.netId, kind: e.kind, hp: e.hp })),
    'Both clients reconcile identical enemy netIds, kinds, and HP'
  );
  assert.equal(state1.p.hp, 88, 'Client 1 reconciles authoritative Seat 1 HP');
  assert.equal(state2.p.hp, 110, 'Client 2 reconciles authoritative Seat 2 HP');
  assert.equal(state1.meeting.active, true, 'activates shared meeting table');
  assert.equal(state1.surge.active, true, 'activates shared surge cabinet');
  assert.equal(dmgCalls, 1, 'fires damage number FX on first pass');
  assert(flashes.some((f) => f.includes('ALLY PINGED SECTOR')), 'fires ping flash on first pass');

  // Second pass with one enemy killed/removed and same FX IDs
  worldRef1.current = {
    ...sharedSnapshot,
    enemies: [sharedSnapshot.enemies[1]]
  };
  syncAuthoritativeCoopWorld(state1);
  assert.equal(client1Pools.enemies.items.filter((e) => e.active).length, 1, 'releases despawned enemy from pool');
  assert.equal(dmgCalls, 1, 'does not replay already-processed FX event IDs');
});

test('stepCoopPeers and drawCoopPeers render remote teammates and disconnected indicators', () => {
  const peersRef = {
    current: [
      { seat: 1, name: 'Host', characterId: 'oracle', x: 550, y: 400, hp: 100, maxHp: 100, alive: true, connected: true },
      {
        seat: 2,
        name: 'Partner',
        characterId: 'engineer',
        x: 620,
        y: 420,
        hp: 90,
        maxHp: 120,
        alive: true,
        connected: false,
        weapons: [{ name: 'Cleaver', damage: 20, range: 240, color: '#67e8f9' }]
      }
    ]
  };
  const run = {
    coop: true,
    coopAuthoritative: true,
    coopSeat: 1,
    coopPeers: peersRef,
    coopEvents: { current: [] }
  };

  stepCoopPeers(run, 0.1, {
    player: { x: 550, y: 400, hp: 100, maxHp: 100 },
    heal() {},
    damageBoss() {},
    nearestAt: () => null,
    launch() {},
    particle() {},
    flash() {}
  });

  const rec = makeRecordingCtx();
  drawCoopPeers(rec.ctx, run);
  assert(
    rec.record.some((r) => r[0] === 'fillText' && String(r[1]).includes('P2 Partner (DC)')),
    'renders partner callsign with disconnect tag in world space'
  );

  // When sprite art is loaded for the teammate's character, drawCoopPeers renders the true character sprite via drawImage
  const fakeAtlas = { id: 'engineer-atlas' };
  const fakeWalk = { id: 'engineer-walk' };
  peersRef.current[1].art = {
    definition: CHARACTER_SPRITES.engineer,
    atlas: fakeAtlas,
    walk: fakeWalk,
    walkLeft: fakeWalk,
    attack: fakeAtlas,
    special: fakeAtlas
  };
  peersRef.current[1].x = 660;
  stepCoopPeers(run, 0.1, {
    player: { x: 550, y: 400, hp: 100, maxHp: 100 },
    heal() {},
    damageBoss() {},
    nearestAt: () => null,
    launch() {},
    particle() {},
    flash() {}
  });
  const spriteRec = makeRecordingCtx();
  drawCoopPeers(spriteRec.ctx, run);
  assert(
    spriteRec.record.some((r) => r[0] === 'drawImage' && (r[1] === fakeAtlas || r[1] === fakeWalk)),
    'renders remote teammate with their true character sprite art instead of placeholder shapes'
  );
});

test('4-player co-op room synchronizes all 4 seats in lobby and combat without merging same-account tabs', () => {
  const actorSrc = readFileSync(new URL('../../../base44/actors/CoopRoom/entry.ts', import.meta.url), 'utf8');
  assert(
    !actorSrc.includes('u.userId === authUserId'),
    'CoopRoom matches seats strictly by per-tab conn.id so multiple tabs/windows on the same account get separate seats (1-4)'
  );

  // Verify 4 tabs get 4 distinct connection IDs even for the same userId
  const storage = makeMockStorage();
  const tabs = [{ name: '' }, { name: '' }, { name: '' }, { name: '' }];
  const connIds = tabs.map((t) => resolveCoopConnId('room-4p', 'same-user-id', storage, t));
  assert.equal(new Set(connIds).size, 4, '4 tabs produce 4 distinct connection IDs for 4 seats');

  // Verify 4-player world snapshot renders all 3 remote teammates for each seat
  const peersRef = {
    current: [
      { seat: 1, name: 'delongc', characterId: 'don', x: 500, y: 380, hp: 115, maxHp: 115, alive: true, connected: true },
      { seat: 2, name: 'Craig D', characterId: 'oracle', x: 560, y: 380, hp: 90, maxHp: 90, alive: true, connected: true },
      { seat: 3, name: 'Craig DeLong', characterId: 'veteran', x: 500, y: 430, hp: 115, maxHp: 115, alive: true, connected: true },
      { seat: 4, name: 'Tech 4', characterId: 'engineer', x: 560, y: 430, hp: 95, maxHp: 95, alive: true, connected: true }
    ]
  };
  const run = {
    coop: true,
    coopAuthoritative: true,
    coopSeat: 1,
    coopPeers: peersRef,
    coopEvents: { current: [] }
  };
  const rec = makeRecordingCtx();
  drawCoopPeers(rec.ctx, run);
  const labels = rec.record.filter((r) => r[0] === 'fillText').map((r) => String(r[1]));
  assert(labels.some((l) => l.includes('P2 Craig D')), 'renders P2 in 4-player match');
  assert(labels.some((l) => l.includes('P3 Craig DeLo')), 'renders P3 in 4-player match');
  assert(labels.some((l) => l.includes('P4 Tech 4')), 'renders P4 in 4-player match');
});

test('all 12 enemy species render valid sprite bodies in authoritative co-op and fall back visibly when art is absent', async () => {
  const [lagArt, puddingArt, jitterArt, blobArtDef, bendArt, critterArt, apparitionArt, ditchArt, petArt, routerArt, sqArt] = await Promise.all([
    preloadEnemySprite('lag'),
    preloadEnemySprite('packet'),
    preloadEnemySprite('jitter'),
    preloadEnemySprite('dirty'),
    preloadEnemySprite('bend'),
    preloadEnemySprite('crosstalk'),
    preloadEnemySprite('attenuation'),
    preloadEnemySprite('ditch'),
    preloadEnemySprite('pete'),
    preloadEnemySprite('rous'),
    preloadEnemySprite('squirrel')
  ]);

  const arts = {
    lagArt,
    puddingArt,
    pudArtDef: puddingArt,
    jitterArt,
    blobArtDef,
    bendArt,
    bendArtDef: bendArt,
    critterArt,
    apparitionArt,
    ditchArt,
    petArt,
    routerArt,
    sqArt
  };

  const allKinds = ['lag', 'packet', 'jitter', 'dirty', 'bend', 'crosstalk', 'attenuation', 'ditch', 'pete', 'peteMini', 'rous', 'squirrel'];
  const worldSnapshot = {
    seq: 1,
    wave: 20,
    time: 40,
    players: [{ seat: 1, name: 'Host', characterId: 'oracle', x: 550, y: 400, hp: 74, maxHp: 74, alive: true }],
    enemies: [
      ...allKinds.map((kind, idx) => ({
        id: idx + 1,
        kind,
        x: 420 + idx * 24,
        y: 380,
        vx: idx % 2 === 0 ? 45 : -45,
        vy: 15,
        hp: 50,
        max: 50,
        r: 18,
        boss: kind === 'rous' || kind === 'squirrel',
        elite: ['bend', 'attenuation', 'ditch', 'pete', 'rous', 'squirrel'].includes(kind),
        phase: 'chase',
        state: 'chase',
        facing: idx % 2 === 0 ? 'right' : 'left'
      })),
      { id: 999, kind: 'lag', x: 500, y: 400, hp: 0, max: 24, r: 13 }
    ],
    shots: [],
    foeShots: [],
    turrets: [],
    structures: [],
    pickups: [],
    puddles: [],
    fx: []
  };

  const enemies = new ObjectPool(32, (i) => ({ poolIndex: i, active: false, x: 0, y: 0, hp: 0, r: 14 }));
  const emptyPool = () => new ObjectPool(8, (i) => ({ poolIndex: i, active: false, x: 0, y: 0 }));

  syncAuthoritativeCoopWorld({
    run: { coop: true, coopAuthoritative: true, coopSeat: 1, coopWorldRef: { current: worldSnapshot }, coopPeers: { current: [] } },
    dt: 1 / 60,
    p: { x: 550, y: 400, hp: 74, maxHp: 74 },
    enemies,
    shots: emptyPool(),
    foeShots: emptyPool(),
    turrets: emptyPool(),
    structures: emptyPool(),
    pickups: emptyPool(),
    puddles: emptyPool(),
    meeting: { active: false, x: 0, y: 0 },
    surge: { active: false, x: 0, y: 0, pulse: 0 },
    arts,
    fxCallbacks: { damageNumber() {}, particle() {}, addShake() {}, sfx() {}, flash() {}, showArea() {} }
  });

  const liveEnemies = enemies.items.filter((e) => e.active);
  assert.equal(liveEnemies.length, allKinds.length, 'hydrates all 12 living enemy species and excludes dead snapshot enemy');

  for (const e of liveEnemies) {
    const rec = makeRecordingCtx();
    const res = drawEnemyBody(rec.ctx, e);
    assert.equal(res.fallback, false, `${e.kind} renders its true sprite atlas without fallback (${res.failure})`);
    assert(rec.record.some((r) => r[0] === 'drawImage'), `${e.kind} issues drawImage call`);
  }

  // Verify fallback pixel body renders visibly when art is missing
  const missingArtEnemy = { netId: 777, kind: 'ditch', x: 500, y: 400, r: 26, color: '#f97316', art: null };
  const fallbackRec = makeRecordingCtx();
  const fallbackRes = drawEnemyBody(fallbackRec.ctx, missingArtEnemy);
  assert.equal(fallbackRes.fallback, true, 'reports fallback when sprite art is missing');
  assert(fallbackRec.record.some((r) => r[0] === 'fillRect'), 'draws visible pixel-art silhouette fallback on canvas');
});