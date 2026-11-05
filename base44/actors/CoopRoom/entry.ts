import { Actor } from 'base44:runtime/actors';

const MAX_USERS = 4;
const VALID_CHARS = new Set(['oracle', 'isr', 'veteran', 'clone', 'don', 'nomad', 'admin', 'engineer']);
const VALID_CHOICES = new Set(['random', 'classic', 'office', 'worksite', 'vault', 'nightWorksite']);
const ARENA_BG_IDS = ['office', 'worksite', 'vault', 'nightWorksite'];

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
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

export default class CoopRoom extends Actor {
  users = new Map();
  nextSeat = 1;
  chat = [];
  room = {
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
    if (savedSeats) this.users = new Map(savedSeats);

    const savedChat = await this.storage.get('chat');
    if (Array.isArray(savedChat)) this.chat = savedChat.slice(-25);

    const live = new Set(this.getConnections().map((c) => c.id));
    for (const id of this.users.keys()) {
      if (!live.has(id)) this.users.delete(id);
    }
    this.nextSeat = Math.max(0, ...[...this.users.values()].map((u) => u.seat)) + 1;
    this.ensureHostSeat();
  }

  ensureHostSeat() {
    const seats = [...this.users.values()].map((u) => u.seat).sort((a, b) => a - b);
    if (!seats.length) {
      this.room.hostSeat = 1;
    } else if (!seats.includes(this.room.hostSeat)) {
      this.room.hostSeat = seats[0];
    }
  }

  async handleConnect(conn) {
    this.cancelSchedule('cleanup');
    if (!this.users.has(conn.id) && this.users.size >= MAX_USERS) {
      conn.reject(4001, 'Shift crew is full (max 4 technicians)');
      return;
    }

    if (!this.users.has(conn.id)) {
      const seat = this.nextSeat++;
      const spawnAngle = ((seat - 1) * Math.PI) / 2;
      this.users.set(conn.id, {
        seat,
        name: `Tech #${seat}`,
        characterId: 'oracle',
        useAlt: false,
        ready: false,
        kitConfirmed: false,
        intermissionReady: false,
        waveDone: false,
        alive: true,
        x: Math.round(550 + Math.cos(spawnAngle) * 48),
        y: Math.round(400 + Math.sin(spawnAngle) * 48),
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        level: 1,
        kills: 0,
        signal: 0,
        damageDealt: 0,
        side: 'right',
        moving: false,
        attack: 0,
        special: 0,
        weapons: []
      });
      this.ensureHostSeat();
      await this.saveState();
      await this.syncRegistry();
    }

    const me = this.users.get(conn.id);
    conn.send({
      type: 'welcome',
      seat: me.seat,
      room: this.publicRoom(),
      users: this.publicUsers(),
      chat: this.chat
    });
    this.broadcastPresence();
  }

  async handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const u = this.users.get(conn.id);
    if (!u) return;

    if (msg.type === 'init_room') {
      if (u.seat === this.room.hostSeat) {
        if (typeof msg.registryId === 'string' && msg.registryId.length <= 64) {
          this.room.registryId = msg.registryId;
        }
        if (typeof msg.title === 'string' && msg.title.trim()) {
          this.room.title = msg.title.trim().slice(0, 48);
        }
        if (typeof msg.arenaChoice === 'string' && VALID_CHOICES.has(msg.arenaChoice)) {
          this.room.arenaChoice = msg.arenaChoice;
          this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, null);
        }
        await this.saveState();
        await this.syncRegistry();
      }
      if (typeof msg.name === 'string' && msg.name.trim()) {
        u.name = msg.name.trim().slice(0, 28);
      }
      if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) {
        u.characterId = msg.characterId;
      }
      await this.saveSeats();
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'select_character') {
      if (typeof msg.name === 'string' && msg.name.trim()) {
        u.name = msg.name.trim().slice(0, 28);
      }
      if (typeof msg.characterId === 'string' && VALID_CHARS.has(msg.characterId)) {
        u.characterId = msg.characterId;
      }
      u.useAlt = Boolean(msg.useAlt);
      if (msg.maxHp) {
        u.maxHp = clamp(msg.maxHp, 1, 50000);
        u.hp = u.maxHp;
      }
      await this.saveSeats();
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'set_arena') {
      if (u.seat !== this.room.hostSeat) return;
      if (typeof msg.arenaChoice === 'string' && VALID_CHOICES.has(msg.arenaChoice)) {
        this.room.arenaChoice = msg.arenaChoice;
        this.room.arenaTheme = resolveArena(msg.arenaChoice, this.room.seed, this.room.wave, null);
        await this.saveState();
        await this.syncRegistry();
        this.broadcastPresence();
      }
      return;
    }

    if (msg.type === 'toggle_ready') {
      u.ready = typeof msg.ready === 'boolean' ? msg.ready : !u.ready;
      await this.saveSeats();
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'start_shift') {
      if (u.seat !== this.room.hostSeat) return;
      this.room.phase = 'loadout';
      this.room.wave = 1;
      this.room.seed = Math.floor(Math.random() * 0x7fffffff) || 1;
      this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, 1, null);
      this.room.teamKills = 0;
      this.room.teamSignal = 0;
      this.room.updatedAt = Date.now();
      for (const peer of this.users.values()) {
        peer.kitConfirmed = false;
        peer.waveDone = false;
        peer.intermissionReady = false;
        peer.alive = true;
        peer.kills = 0;
        peer.signal = 0;
        peer.level = 1;
      }
      await this.saveState();
      await this.syncRegistry();
      this.broadcast({
        type: 'phase_change',
        room: this.publicRoom(),
        users: this.publicUsers()
      });
      return;
    }

    if (msg.type === 'confirm_kit') {
      u.kitConfirmed = true;
      if (Array.isArray(msg.weapons)) {
        u.weapons = msg.weapons.slice(0, 6).map((w) => ({
          name: String(w?.name || 'Tool').slice(0, 40),
          icon: String(w?.icon || '🔧').slice(0, 8),
          damage: clamp(w?.damage ?? 12, 1, 5000),
          range: clamp(w?.range ?? 240, 40, 1200),
          color: String(w?.color || '#67e8f9').slice(0, 16)
        }));
      }
      if (msg.maxHp) {
        u.maxHp = clamp(msg.maxHp, 1, 50000);
        u.hp = clamp(msg.hp ?? u.maxHp, 1, u.maxHp);
      }
      await this.saveSeats();
      const allConfirmed = [...this.users.values()].every((p) => p.kitConfirmed);
      if (allConfirmed && this.room.phase === 'loadout') {
        await this.enterCombatWave();
      } else {
        this.broadcastPresence();
      }
      return;
    }

    if (msg.type === 'telemetry') {
      const spawnAngle = ((u.seat - 1) * Math.PI) / 2;
      u.x = clamp(msg.x ?? u.x, 16, 1084);
      u.y = clamp(msg.y ?? u.y, 16, 784);
      u.vx = clamp(msg.vx ?? 0, -1000, 1000);
      u.vy = clamp(msg.vy ?? 0, -1000, 1000);
      u.maxHp = clamp(msg.maxHp ?? u.maxHp, 1, 50000);
      u.hp = clamp(msg.hp ?? u.hp, 0, u.maxHp);
      u.alive = u.hp > 0;
      u.side = msg.side === 'left' ? 'left' : 'right';
      u.moving = Boolean(msg.moving);
      u.attack = clamp(msg.attack ?? 0, 0, 2);
      u.special = clamp(msg.special ?? 0, 0, 30);
      u.kills = clamp(msg.kills ?? u.kills, 0, 999999);
      u.signal = clamp(msg.signal ?? u.signal, 0, 9999999);
      u.level = clamp(msg.level ?? u.level, 1, 999);
      if (!Number.isFinite(u.x)) u.x = 550 + Math.cos(spawnAngle) * 48;
      this.broadcast({
        type: 'telemetry',
        seat: u.seat,
        state: this.publicSeat(u)
      });
      return;
    }

    if (msg.type === 'combat_event') {
      const kind = String(msg.kind || '').slice(0, 32);
      if (!['special', 'deploy', 'ping', 'boss_damage', 'heal_pulse'].includes(kind)) return;
      this.broadcast({
        type: 'combat_event',
        seat: u.seat,
        name: u.name,
        characterId: u.characterId,
        kind,
        x: clamp(msg.x ?? u.x, 0, 1100),
        y: clamp(msg.y ?? u.y, 0, 800),
        amount: clamp(msg.amount ?? 0, 0, 50000),
        label: String(msg.label || '').slice(0, 48)
      });
      return;
    }

    if (msg.type === 'wave_result') {
      u.waveDone = true;
      u.alive = Boolean(msg.won);
      u.maxHp = clamp(msg.maxHp ?? u.maxHp, 1, 50000);
      u.hp = u.alive ? clamp(msg.hp ?? u.maxHp, 1, u.maxHp) : 0;
      u.kills = clamp(msg.kills ?? u.kills, 0, 999999);
      u.signal = clamp(msg.signal ?? u.signal, 0, 9999999);
      u.level = clamp(msg.level ?? u.level, 1, 999);
      u.damageDealt = clamp(msg.damageDealt ?? u.damageDealt, 0, 99999999);

      this.room.teamKills = [...this.users.values()].reduce((s, p) => s + (p.kills || 0), 0);
      this.room.teamSignal = [...this.users.values()].reduce((s, p) => s + (p.signal || 0), 0);

      const allDone = [...this.users.values()].every((p) => p.waveDone);
      if (allDone && this.room.phase === 'combat') {
        const anySurvived = [...this.users.values()].some((p) => p.alive);
        if (anySurvived) {
          this.room.phase = 'intermission';
          for (const peer of this.users.values()) {
            peer.intermissionReady = false;
            if (!peer.alive || peer.hp <= 0) {
              peer.hp = Math.max(1, Math.round(peer.maxHp * 0.5));
              peer.alive = true;
            }
          }
        } else {
          this.room.phase = 'summary';
        }
        this.room.updatedAt = Date.now();
        await this.saveState();
        await this.syncRegistry();
        this.broadcast({
          type: 'phase_change',
          room: this.publicRoom(),
          users: this.publicUsers()
        });
      } else {
        await this.saveSeats();
        this.broadcastPresence();
      }
      return;
    }

    if (msg.type === 'intermission_ready') {
      u.intermissionReady = true;
      if (msg.maxHp) {
        u.maxHp = clamp(msg.maxHp, 1, 50000);
        u.hp = clamp(msg.hp ?? u.maxHp, 1, u.maxHp);
      }
      if (msg.level) u.level = clamp(msg.level, 1, 999);
      if (msg.signal !== undefined) u.signal = clamp(msg.signal, 0, 9999999);
      if (Array.isArray(msg.weapons)) {
        u.weapons = msg.weapons.slice(0, 6).map((w) => ({
          name: String(w?.name || 'Tool').slice(0, 40),
          icon: String(w?.icon || '🔧').slice(0, 8),
          damage: clamp(w?.damage ?? 12, 1, 5000),
          range: clamp(w?.range ?? 240, 40, 1200),
          color: String(w?.color || '#67e8f9').slice(0, 16)
        }));
      }
      await this.saveSeats();
      const allReady = [...this.users.values()].every((p) => p.intermissionReady);
      if ((allReady || (msg.force && u.seat === this.room.hostSeat)) && this.room.phase === 'intermission') {
        this.room.wave += 1;
        this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, this.room.wave, this.room.arenaTheme);
        await this.enterCombatWave();
      } else {
        this.broadcastPresence();
      }
      return;
    }

    if (msg.type === 'return_lobby') {
      if (u.seat !== this.room.hostSeat && this.room.phase !== 'summary') return;
      this.room.phase = 'lobby';
      this.room.wave = 1;
      this.room.seed = Math.floor(Math.random() * 0x7fffffff) || 1;
      this.room.arenaTheme = resolveArena(this.room.arenaChoice, this.room.seed, 1, null);
      for (const peer of this.users.values()) {
        peer.ready = false;
        peer.kitConfirmed = false;
        peer.intermissionReady = false;
        peer.waveDone = false;
        peer.alive = true;
      }
      await this.saveState();
      await this.syncRegistry();
      this.broadcast({
        type: 'phase_change',
        room: this.publicRoom(),
        users: this.publicUsers()
      });
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
      await this.storage.put('chat', this.chat);
      this.broadcast({ type: 'chat', entry });
    }
  }

  async enterCombatWave() {
    this.room.phase = 'combat';
    this.room.updatedAt = Date.now();
    for (const peer of this.users.values()) {
      const spawnAngle = ((peer.seat - 1) * Math.PI) / 2;
      peer.x = Math.round(550 + Math.cos(spawnAngle) * 48);
      peer.y = Math.round(400 + Math.sin(spawnAngle) * 48);
      peer.waveDone = false;
      peer.intermissionReady = false;
      peer.alive = true;
      if (peer.hp <= 0) peer.hp = Math.max(1, Math.round(peer.maxHp * 0.5));
    }
    await this.saveState();
    await this.syncRegistry();
    this.broadcast({
      type: 'phase_change',
      room: this.publicRoom(),
      users: this.publicUsers()
    });
  }

  async handleClose(conn) {
    this.users.delete(conn.id);
    this.ensureHostSeat();
    await this.saveState();
    await this.syncRegistry();
    this.broadcastPresence();
    if (this.users.size === 0) {
      this.schedule('cleanup', Date.now() + 60000);
    }
  }

  async handleWake(key) {
    if (key === 'cleanup' && this.getConnections().length === 0) {
      this.users.clear();
      if (this.room.registryId) {
        try {
          await this.client.asServiceRole.entities.CoopLobby.delete(this.room.registryId);
        } catch {
          // Registry record may already be removed
        }
      }
      await this.storage.put('seats', []);
    }
  }

  async syncRegistry() {
    if (!this.room.registryId) return;
    try {
      const count = this.users.size;
      const host = [...this.users.values()].find((p) => p.seat === this.room.hostSeat);
      if (count === 0) {
        await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, {
          status: 'closed',
          player_count: 0
        });
      } else {
        await this.client.asServiceRole.entities.CoopLobby.update(this.room.registryId, {
          title: this.room.title,
          host_name: host?.name || 'Dispatch Host',
          status: this.room.phase === 'summary' ? 'intermission' : this.room.phase,
          player_count: count,
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
      name: u.name,
      characterId: u.characterId,
      useAlt: u.useAlt,
      ready: u.ready,
      kitConfirmed: u.kitConfirmed,
      intermissionReady: u.intermissionReady,
      waveDone: u.waveDone,
      alive: u.alive,
      x: u.x,
      y: u.y,
      vx: u.vx,
      vy: u.vy,
      hp: u.hp,
      maxHp: u.maxHp,
      level: u.level,
      kills: u.kills,
      signal: u.signal,
      damageDealt: u.damageDealt,
      side: u.side,
      moving: u.moving,
      attack: u.attack,
      special: u.special,
      weapons: u.weapons || []
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
      room: this.publicRoom(),
      users: this.publicUsers()
    });
  }
}