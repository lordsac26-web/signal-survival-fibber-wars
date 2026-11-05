import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const ACTIVE_USER_KEY = 'signal_coop_active_user';
const CONN_PREFIX = 'signal_coop_conn:';
const RELOAD_PREFIX = 'signal_coop_reload:';
const TAB_PREFIX = 'signal_tab_';

const inMemoryTabConnIds = new Map();
let unloadHookRegistered = false;

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureUnloadHook() {
  if (unloadHookRegistered || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  unloadHookRegistered = true;
  window.addEventListener('beforeunload', () => {
    try {
      for (const [, entry] of inMemoryTabConnIds.entries()) {
        if (entry?.storageKey) {
          sessionStorage.setItem(`${RELOAD_PREFIX}${entry.storageKey}`, String(Date.now()));
        }
      }
    } catch {
      // ignore storage errors on unload
    }
  });
}

/**
 * Resolves a tab-isolated, room-scoped, user-scoped connection id.
 * - Duplicating a tab in Chrome/Edge copies sessionStorage and window.name without firing beforeunload,
 *   so we detect the missing reload stamp and mint a fresh tabId + connId for the duplicated tab.
 * - Reloading the same tab preserves its connId so the player reclaims their seat.
 * - Switching authenticated userId clears all stored connIds in sessionStorage.
 * - Switching roomId uses a distinct storage key.
 */
export function resolveCoopConnId(
  roomId,
  userId = 'anon',
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  win = typeof window !== 'undefined' ? window : null
) {
  const cleanRoom = String(roomId || 'default').trim();
  const cleanUser = String(userId || 'anon').trim();
  if (!storage) return randomId();

  const isRealBrowserWindow = typeof window !== 'undefined' && win === window;
  if (isRealBrowserWindow) ensureUnloadHook();

  try {
    const prevUser = storage.getItem(ACTIVE_USER_KEY);
    if (prevUser && prevUser !== cleanUser) {
      const toRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && (k.startsWith(CONN_PREFIX) || k.startsWith(RELOAD_PREFIX))) toRemove.push(k);
      }
      for (const k of toRemove) storage.removeItem(k);
      if (isRealBrowserWindow) inMemoryTabConnIds.clear();
    }
    storage.setItem(ACTIVE_USER_KEY, cleanUser);

    const memKey = `${cleanRoom}:${cleanUser}`;
    if (isRealBrowserWindow && inMemoryTabConnIds.has(memKey)) {
      return inMemoryTabConnIds.get(memKey).connId;
    }

    let tabId = 'tab';
    if (win) {
      if (typeof win.name === 'string' && win.name.startsWith(TAB_PREFIX)) {
        tabId = win.name;
      } else {
        tabId = `${TAB_PREFIX}${randomId()}`;
        try {
          win.name = tabId;
        } catch {
          // ignore read-only window.name in restricted environments
        }
      }
    }

    let storageKey = `${CONN_PREFIX}${cleanRoom}:${cleanUser}:${tabId}`;
    let connId = storage.getItem(storageKey);

    if (connId && isRealBrowserWindow) {
      const reloadKey = `${RELOAD_PREFIX}${storageKey}`;
      const reloadTs = Number(storage.getItem(reloadKey) || 0);
      storage.removeItem(reloadKey);
      const isGenuineReload = reloadTs > 0 && Date.now() - reloadTs < 20000;
      if (!isGenuineReload) {
        // Duplicated tab detected: mint a fresh tabId & connId so this tab gets its own seat
        tabId = `${TAB_PREFIX}${randomId()}`;
        try {
          win.name = tabId;
        } catch {
          // ignore
        }
        storageKey = `${CONN_PREFIX}${cleanRoom}:${cleanUser}:${tabId}`;
        connId = null;
      }
    }

    if (!connId) {
      connId = randomId();
      storage.setItem(storageKey, connId);
    }

    if (isRealBrowserWindow) {
      inMemoryTabConnIds.set(memKey, { connId, storageKey });
    }
    return connId;
  } catch {
    return randomId();
  }
}

export default function useCoopRoom(roomId, initialConfig = null, userId = null) {
  const [status, setStatus] = useState(roomId ? 'connecting' : 'idle');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [seat, setSeat] = useState(null);
  const [room, setRoom] = useState(null);
  const [users, setUsers] = useState([]);
  const [chat, setChat] = useState([]);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const handleRef = useRef(null);
  const seatRef = useRef(null);
  const peersRef = useRef([]);
  const worldRef = useRef(null);
  const combatEventsRef = useRef([]);
  const initConfigRef = useRef(initialConfig);
  const lastRevisionRef = useRef(0);

  useEffect(() => {
    initConfigRef.current = initialConfig;
  }, [initialConfig]);

  useEffect(() => {
    if (!roomId) {
      setStatus('idle');
      setError('');
      setErrorCode('');
      setSeat(null);
      setRoom(null);
      setUsers([]);
      setChat([]);
      seatRef.current = null;
      peersRef.current = [];
      worldRef.current = null;
      combatEventsRef.current = [];
      lastRevisionRef.current = 0;
      return undefined;
    }

    setStatus('connecting');
    setError('');
    setErrorCode('');
    lastRevisionRef.current = 0;

    const connId = resolveCoopConnId(roomId, userId || 'anon');
    const actorHandle = base44.actors.CoopRoom(roomId).connect({ id: connId });
    handleRef.current = actorHandle;

    const syncUsersAndPeers = (incomingUsers) => {
      if (!Array.isArray(incomingUsers)) return;
      setUsers(incomingUsers);
      const prevMap = new Map(peersRef.current.map((p) => [p.seat, p]));
      peersRef.current = incomingUsers.map((u) => {
        const old = prevMap.get(u.seat);
        return old ? { ...old, ...u } : { ...u };
      });
    };

    const syncWorldPayload = (world) => {
      if (!world || typeof world !== 'object') return;
      worldRef.current = world;
      if (Array.isArray(world.players)) {
        const prevMap = new Map(peersRef.current.map((p) => [p.seat, p]));
        peersRef.current = world.players.map((p) => {
          const old = prevMap.get(p.seat);
          return old ? { ...old, ...p } : { ...p };
        });
      }
    };

    const sub = actorHandle.subscribe((msg) => {
      if (!msg || typeof msg !== 'object') return;

      // Guard against cross-room stale frames
      if (msg.roomId && msg.roomId !== roomId) return;
      if (msg.room?.roomId && msg.room.roomId !== roomId) return;

      if (msg.type === 'room_error') {
        const code = msg.code || 'room_error';
        setErrorCode(code);
        setError(msg.message || 'Unable to join co-op shift room.');
        if (code === 'room_full' || code === 'match_already_started') {
          setStatus('rejected');
        }
        return;
      }

      const incomingRev = msg.revision ?? msg.room?.revision ?? 0;
      if (incomingRev > 0 && incomingRev < lastRevisionRef.current && msg.type !== 'world_tick') {
        return;
      }
      if (incomingRev > lastRevisionRef.current) {
        lastRevisionRef.current = incomingRev;
      }

      if (msg.type === 'welcome') {
        setStatus('connected');
        setError('');
        setErrorCode('');
        seatRef.current = msg.seat;
        setSeat(msg.seat);
        if (msg.room) setRoom(msg.room);
        syncUsersAndPeers(msg.users || []);
        setChat(msg.chat || []);
        if (msg.world) syncWorldPayload(msg.world);

        const cfg = initConfigRef.current;
        if (cfg?.isHostInit) {
          cfg.isHostInit = false;
          actorHandle.send({
            type: 'init_room',
            roomId,
            registryId: cfg.registryId || null,
            title: cfg.title || 'Field Crew Shift',
            arenaChoice: cfg.arenaChoice || 'random',
            name: cfg.name || undefined,
            characterId: cfg.characterId || 'oracle',
            useAlt: Boolean(cfg.useAlt)
          });
        } else {
          actorHandle.send({
            type: 'join_room',
            roomId,
            name: cfg?.name || undefined,
            characterId: cfg?.characterId || undefined,
            useAlt: cfg?.useAlt
          });
        }
        return;
      }

      if (msg.type === 'presence' || msg.type === 'phase_change') {
        setStatus('connected');
        if (msg.room) setRoom(msg.room);
        if (Array.isArray(msg.users)) syncUsersAndPeers(msg.users);
        if (msg.world !== undefined) {
          if (msg.world) syncWorldPayload(msg.world);
          else worldRef.current = null;
        }
        return;
      }

      if (msg.type === 'world_tick' && msg.world) {
        syncWorldPayload(msg.world);
        return;
      }

      if (msg.type === 'telemetry' && msg.state) {
        if (msg.seat === seatRef.current) return;
        const list = peersRef.current;
        const idx = list.findIndex((p) => p.seat === msg.seat);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...msg.state };
        } else {
          list.push({ ...msg.state });
        }
        return;
      }

      if (msg.type === 'combat_event') {
        combatEventsRef.current.push(msg);
        return;
      }

      if (msg.type === 'chat' && msg.entry) {
        setChat((prev) => [...prev.slice(-24), msg.entry]);
      }
    });

    const syncInterval = setInterval(() => {
      try {
        actorHandle.send({ type: 'sync_state' });
      } catch {
        // ignore transient send errors
      }
    }, 2500);

    return () => {
      clearInterval(syncInterval);
      sub.unsubscribe();
      actorHandle.close();
      handleRef.current = null;
    };
  }, [roomId, userId, reconnectNonce]);

  const send = useCallback((payload) => {
    if (!handleRef.current) return;
    try {
      handleRef.current.send(payload);
    } catch (e) {
      setError(e?.message || 'Failed to send room message');
    }
  }, []);

  const selectCharacter = useCallback(
    ({ name, characterId, useAlt, maxHp }) => {
      send({ type: 'select_character', name, characterId, useAlt, maxHp });
    },
    [send]
  );

  const setArenaChoice = useCallback(
    (arenaChoice) => {
      send({ type: 'set_arena', arenaChoice });
    },
    [send]
  );

  const toggleReady = useCallback(
    (ready) => {
      send({ type: 'toggle_ready', ready });
    },
    [send]
  );

  const startShift = useCallback(() => {
    send({ type: 'start_shift' });
  }, [send]);

  const confirmKit = useCallback(
    ({ pickedIds, weapons, hp, maxHp }) => {
      send({ type: 'confirm_kit', pickedIds, weapons, hp, maxHp });
    },
    [send]
  );

  const sendCombatInput = useCallback(
    (inputState) => {
      send({ type: 'combat_input', ...inputState });
    },
    [send]
  );

  const sendCombatAction = useCallback(
    (actionPayload) => {
      send({
        type: 'combat_action',
        actionId: actionPayload?.actionId || randomId(),
        ...actionPayload
      });
    },
    [send]
  );

  const sendTelemetry = useCallback(
    (state) => {
      send({ type: 'telemetry', ...state });
    },
    [send]
  );

  const sendCombatEvent = useCallback(
    (event) => {
      send({ type: 'combat_event', ...event });
    },
    [send]
  );

  const reportWaveResult = useCallback(
    (result) => {
      send({ type: 'wave_result', ...result });
    },
    [send]
  );

  const syncIntermission = useCallback(
    (snapshot) => {
      send({ type: 'sync_intermission', ...snapshot });
    },
    [send]
  );

  const markIntermissionReady = useCallback(
    (payload) => {
      send({ type: 'intermission_ready', ...payload });
    },
    [send]
  );

  const returnToLobby = useCallback(() => {
    send({ type: 'return_lobby' });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: 'leave_room' });
  }, [send]);

  const sendChat = useCallback(
    (text) => {
      send({ type: 'chat', text });
    },
    [send]
  );

  const retryConnection = useCallback(() => {
    setError('');
    setErrorCode('');
    setReconnectNonce((n) => n + 1);
  }, []);

  return {
    status,
    error,
    errorCode,
    seat,
    room,
    users,
    chat,
    worldRef,
    peersRef,
    combatEventsRef,
    isHost: Boolean(seat && room && seat === room.hostSeat),
    selectCharacter,
    setArenaChoice,
    toggleReady,
    startShift,
    confirmKit,
    sendCombatInput,
    sendCombatAction,
    sendTelemetry,
    sendCombatEvent,
    reportWaveResult,
    syncIntermission,
    markIntermissionReady,
    returnToLobby,
    leaveRoom,
    sendChat,
    retryConnection
  };
}