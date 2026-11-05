import { Actor } from 'base44:runtime/actors';
import {
  MAX_USERS,
  VALID_CHARS,
  VALID_CHOICES,
  CHARACTER_SPECS,
  clamp,
  resolveArena,
  sanitizeWeapons,
  sanitizePassives,
  sanitizeDeployables,
  computeEffectiveStats,
  createCombatWorld,
  stepCombatWorld,
  triggerPlayerSpecial,
  triggerPlayerDeploy,
  serializeCombatWorld
} from '../../shared/coopSimulation.ts';

const SIM_STEP = 1 / 30;
const TICK_MS = 50;

export default class CoopRoom extends Actor {
  users = new Map(); // seatKey ('seat-1'..'seat-4') -> seat object
  disconnectedSeats = new Map(); // seatKey -> { seatObj, expiresAt }
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
    if (Array.isArray(savedSeats)) {
      this.users = new Map(savedSeats);
    }

    const savedChat = await this.storage.get('chat');
    if (Array.isArray(savedChat)) this.chat = savedChat.slice(-25);

    const liveConns = this.getConnections();
    const liveIds = new Set(liveConns.map((c) => c.id));
    for (const [key, u] of this.users.entries()) {
      if (u.connId && liveIds.has(u.connId)) {
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
      if (!this.world) {
        this.world = createCombatWorld(this.room, [...this.users.values()]);
      }
      this.ensureSimLoop();
    }
  }

  pruneExpiredDisconnected() {
    const now = Date.now();
    for (const [k, entry] of this.disconnectedSeats.entries()) {
      if (now > entry.expiresAt) this.disconnectedSeats.delete(k);
    }
    if (this.room.phase !== 'lobby') {
      const liveIds = new Set(this.getConnections().map((c) => c.id));
      for (const [k, u] of this.users.entries()) {
        if (!u.connected && (!u.connId || !liveIds.has(u.connId)) && u.disconnectedAt && now - u.disconnectedAt > 90000) {
          this.users.delete(k);
        }
      }
    }
  }

  ensureHostSeat() {
    const connectedSeats = [...this.users.values()]
      .filter((u) => u.connected !== false)
      .map((u) => u.seat)
      .sort((a, b) => a - b);
    const allSeats = [...this.users.values()].map((u) => u.seat).sort((a, b) => a - b);
    const pool = connectedSeats.length ? connectedSeats : allSeats;
    if (!pool.length) {
      this.room.hostSeat = 1;
    } else if (!pool.includes(this.room.hostSeat)) {
      this.room.hostSeat = pool[0];
    }
  }

  findExistingSeatForConn(conn) {
    const authUserId = conn.identity?.type === 'authenticated' ? conn.identity.userId : null;
    const liveIds = new Set(this.getConnections().map((c) => c.id));

    // 1. Exact conn.id match on an active seat (unless owned by a DIFFERENT authenticated user)
    for (const u of this.users.values()) {
      if (u.connId === conn.id) {
        if (!u.userId || !authUserId || u.userId === authUserId) {
          return { seatObj: u, restoredFromCache: false };
        }
      }
    }

    // 2. Authenticated userId reclaiming their disconnected seat
    if (authUserId) {
      for (const u of this.users.values()) {
        if (u.userId === authUserId && (!u.connId || !liveIds.has(u.connId) || u.connId === conn.id)) {
          return { seatObj: u, restoredFromCache: false };
        }
      }
    }

    // 3. Reclaiming a recently-disconnected lobby seat (e.g. page reload)
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
    if (preferred && preferred >= 1 && preferred <= MAX_USERS && !taken.has(preferred)) {
      return preferred;
    }
    for (let s = 1; s <= MAX_USERS; s++) {
      if (!taken.has(s)) return s;
    }
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
      vx: 0,
      vy: 0,
      ix: 0,
      iy: 0,
      hp: spec.stats.maxHp,
      maxHp: spec.stats.maxHp,
      level: 0,
      pendingLevels: 0,
      xp: 0,
      kills: 0,
      killsByType: {},
      signal: 0,
      earnedSignal: 0,
      damageDealt: 0,
      damageTaken: 0,
      healed: 0,
      side: 'right',
      moving: false,
      attack: 0,
      specialCooldown: 0,
      specialTimer: 0,
      deployCds: {},
      weapons: sanitizeWeapons('oracle', null, this.room.seed + seat),
      items: [],
      deployables: [],
      statMods: [],
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
      if (conn.identity?.type === 'authenticated' && conn.identity.userId) {
        me.userId = conn.identity.userId;
      }
      me.connected = true;
      me.disconnectedAt = null;
    } else {
      if (this.room.phase !== 'lobby') {
        conn.send({
          type: 'room_error',
          code: 'match_already_started',
          message: 'This shift has already launched and cannot accept late joiners.'
        });
        conn.reject(4002, 'Shift already in progress');
        return;
      }
      if (this.users.size >= MAX_USERS) {
        conn.send({
          type: 'room_error',
          code: 'room_full',
          message: 'Shift crew is full (max 4 technicians).'
        });
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

    // Send welcome and broadcast presence IMMEDIATELY before async storage/registry I/O
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

    if (this.room.phase === 'combat') {
      this.ensureSimLoop();
    }

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
    if (u.processedActions.length > 60) {
      u.processedActions.splice(0, u.processedActions.length - 60);
    }
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
        if (
          !this.room.registryId &&
          typeof msg.registryId === 'string' &&
          /^[a-f0-9]{24}$/i.test(msg.registryId) &&
          (!msg.roomId || msg.registryId === msg.roomId)
        ) {
          this.room.registryId = msg.registryId;
          this.room.roomId = msg.registryId;
        }
        if (typeof msg.title === 'string' && msg.title.trim()) {
          this.room.title = msg.title.trim().slice(0, 48);
        }
        if (typeof msg.arenaChoice === 'string' && VALID_CHOICES.has(msg.arenaChoice)) {
          this.room.arenaChoice = msg.arenaChoice;
          this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, null);
        }
      }
      if (typeof msg.name === 'string' && msg.name.trim()) {
        u.name = msg.name.trim().slice(0, 28);
      }
      if (!u.ready && this.room.phase === 'lobby') {
        if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) {
          u.characterId = msg.characterId;
          const spec = CHARACTER_SPECS[u.characterId];
          u.maxHp = spec.stats.maxHp;
          u.hp = spec.stats.maxHp;
          u.weapons = sanitizeWeapons(u.characterId, null, this.room.seed + u.seat);
          u.effStats = computeEffectiveStats(u);
        }
        if (typeof msg.useAlt === 'boolean') {
          u.useAlt = msg.useAlt;
        }
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
      if (typeof msg.name === 'string' && msg.name.trim()) {
        u.name = msg.name.trim().slice(0, 28);
      }
      if (u.ready) {
        conn.send({
          type: 'room_error',
          code: 'ready_locked',
          message: 'Unmark Ready before switching your technician or toolkit.'
        });
        return;
      }
      if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) {
        u.characterId = msg.characterId;
      }
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
      // Idempotent guard: only transition from 'lobby'
      if (this.room.phase !== 'lobby') return;
      if (u.seat !== this.room.hostSeat) {
        conn.send({
          type: 'room_error',
          code: 'not_host',
          message: 'Only the Shift Foreman (Host) can launch the shift.'
        });
        return;
      }
      const seats = [...this.users.values()];
      if (!seats.length || !seats.every((p) => p.ready === true)) {
        conn.send({
          type: 'room_error',
          code: 'crew_not_ready',
          message: 'All connected technicians must mark Ready before launching the shift.'
        });
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

      this.broadcast({
        type: 'phase_change',
        roomId: this.room.roomId,
        room: this.publicRoom(),
        users: this.publicUsers()
      });
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
        u.viewport = {
          width: clamp(msg.viewportW, 320, 2400),
          height: clamp(msg.viewportH, 240, 1800)
        };
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'combat_action') {
      if (this.room.phase !== 'combat' || !this.world) return;
      if (this.hasProcessedAction(u, msg.actionId)) return;
      const seats = [...this.users.values()];
      const action = String(msg.action || '');
      if (action === 'special') {
        triggerPlayerSpecial(this.world, this.room, seats, u);
      } else if (action === 'deploy') {
        triggerPlayerDeploy(this.world, u, Number(msg.deployIndex) || 0);
      } else if (action === 'ping') {
        const now = Date.now();
        if (!u.lastPingAt || now - u.lastPingAt >= 400) {
          u.lastPingAt = now;
          this.world.fx.push({
            id: this.world.nextEntityId++,
            type: 'ping',
            seat: u.seat,
            name: u.name,
            x: Math.round(u.x),
            y: Math.round(u.y),
            label: 'SECTOR PING'
          });
        }
      }
      this.stepWorldToNow();
      return;
    }

    if (msg.type === 'sync_intermission' || msg.type === 'intermission_ready') {
      if (this.room.phase !== 'intermission') return;
      if (msg.actionId && this.hasProcessedAction(u, msg.actionId)) return;

      if (Array.isArray(msg.weapons)) {
        u.weapons = sanitizeWeapons(u.characterId, msg.weapons, this.room.seed + u.seat);
      }
      if (Array.isArray(msg.items)) {
        u.items = sanitizePassives(msg.items);
      }
      if (Array.isArray(msg.deployables)) {
        u.deployables = sanitizeDeployables(u.characterId, msg.deployables);
      }
      if (Array.isArray(msg.statMods)) {
        u.statMods = sanitizePassives(msg.statMods);
      }
      u.effStats = computeEffectiveStats(u);
      u.maxHp = u.effStats.maxHp;
      if (msg.hp !== undefined) {
        u.hp = clamp(msg.hp, 1, u.maxHp);
      } else {
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (msg.signal !== undefined) {
        const maxAllowedSignal = (u.earnedSignal || 0) + 500;
        u.signal = clamp(msg.signal, 0, maxAllowedSignal);
      }
      if (msg.level !== undefined) {
        u.level = clamp(msg.level, 0, 200);
      }
      if (msg.pendingLevels !== undefined) {
        u.pendingLevels = clamp(msg.pendingLevels, 0, 50);
      }

      if (msg.type === 'intermission_ready') {
        u.intermissionReady = true;
      }
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
        peer.ready = false;
        peer.kitConfirmed = false;
        peer.intermissionReady = false;
        peer.waveDone = false;
        peer.alive = true;
      }
      this.broadcast({
        type: 'phase_change',
        roomId: this.room.roomId,
        room: this.publicRoom(),
        users: this.publicUsers()
      });
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
      const entry = {
        id: `${Date.now()}-${u.seat}`,
        seat: u.seat,
        name: u.name,
        characterId: u.characterId,
        text,
        ts: Date.now()
      };
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
    for (const peer of seats) {
      peer.waveDone = false;
      peer.intermissionReady = false;
    }
    this.world = createCombatWorld(this.room, seats);
    this.lastSimAt = Date.now();
    const snapshot = serializeCombatWorld(this.world, seats);

    this.broadcast({
      type: 'phase_change',
      roomId: this.room.roomId,
      room: this.publicRoom(),
      users: this.publicUsers(),
      world: snapshot
    });
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
    this.broadcast({
      type: 'world_tick',
      roomId: this.room.roomId,
      revision: this.room.revision,
      world: snap
    });
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

    this.broadcast({
      type: 'phase_change',
      roomId: this.room.roomId,
      room: this.publicRoom(),
      users: this.publicUsers(),
      world: finalWorld
    });
    await this.saveState();
    await this.syncRegistry();
  }

  async handleClose(conn) {
    const liveConns = this.getConnections().filter((c) => c !== conn);
    const stillOpenSameId = liveConns.some((c) => c.id === conn.id);
    if (stillOpenSameId) return;

    let targetSeat = null;
    for (const u of this.users.values()) {
      if (u.connId === conn.id) {
        targetSeat = u;
        break;
      }
    }
    if (!targetSeat) return;

    if (this.room.phase === 'lobby') {
      // Cache disconnected lobby seat for 30s so page reloads reclaim it,
      // while active lobby seats immediately reflect connected crew.
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
          // Registry record may already be deleted
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
        await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, {
          status: 'closed',
          player_count: 0
        });
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
    // Never include connId or userId in public broadcasts
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
    return [...this.users.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((u) => this.publicSeat(u));
  }

  broadcastPresence() {
    this.broadcast({
      type: 'presence',
      roomId: this.room.roomId,
      room: this.publicRoom(),
      users: this.publicUsers()
    });
  }
}