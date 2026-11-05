import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CONN_STORAGE_KEY = 'signal_coop_conn_id';

function getOrCreateConnId() {
  try {
    let id = sessionStorage.getItem(CONN_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(CONN_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function useCoopRoom(roomId, initialConfig = null) {
  const [status, setStatus] = useState(roomId ? 'connecting' : 'idle');
  const [error, setError] = useState('');
  const [seat, setSeat] = useState(null);
  const [room, setRoom] = useState(null);
  const [users, setUsers] = useState([]);
  const [chat, setChat] = useState([]);

  const handleRef = useRef(null);
  const peersRef = useRef([]);
  const combatEventsRef = useRef([]);
  const initSentRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      setStatus('idle');
      setSeat(null);
      setRoom(null);
      setUsers([]);
      setChat([]);
      peersRef.current = [];
      combatEventsRef.current = [];
      initSentRef.current = false;
      return undefined;
    }

    setStatus('connecting');
    setError('');
    const connId = getOrCreateConnId();
    const actorHandle = base44.actors.CoopRoom(roomId).connect({ id: connId });
    handleRef.current = actorHandle;

    const sub = actorHandle.subscribe((msg) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'welcome') {
        setStatus('connected');
        setSeat(msg.seat);
        setRoom(msg.room);
        setUsers(msg.users || []);
        setChat(msg.chat || []);
        peersRef.current = (msg.users || []).map((u) => ({ ...u }));

        if (!initSentRef.current && initialConfig) {
          initSentRef.current = true;
          actorHandle.send({
            type: 'init_room',
            registryId: initialConfig.registryId || null,
            title: initialConfig.title || 'Field Crew Shift',
            arenaChoice: initialConfig.arenaChoice || 'random',
            name: initialConfig.name || undefined,
            characterId: initialConfig.characterId || 'oracle'
          });
        }
        return;
      }

      if (msg.type === 'presence' || msg.type === 'phase_change') {
        setStatus('connected');
        if (msg.room) setRoom(msg.room);
        if (Array.isArray(msg.users)) {
          setUsers(msg.users);
          const prevMap = new Map(peersRef.current.map((p) => [p.seat, p]));
          peersRef.current = msg.users.map((u) => {
            const old = prevMap.get(u.seat);
            return old ? { ...old, ...u } : { ...u };
          });
        }
        return;
      }

      if (msg.type === 'telemetry' && msg.state) {
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

    return () => {
      sub.unsubscribe();
      actorHandle.close();
      handleRef.current = null;
    };
  }, [roomId]);

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
    ({ weapons, hp, maxHp }) => {
      send({ type: 'confirm_kit', weapons, hp, maxHp });
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

  const markIntermissionReady = useCallback(
    (payload) => {
      send({ type: 'intermission_ready', ...payload });
    },
    [send]
  );

  const returnToLobby = useCallback(() => {
    send({ type: 'return_lobby' });
  }, [send]);

  const sendChat = useCallback(
    (text) => {
      send({ type: 'chat', text });
    },
    [send]
  );

  return {
    status,
    error,
    seat,
    room,
    users,
    chat,
    peersRef,
    combatEventsRef,
    isHost: Boolean(seat && room && seat === room.hostSeat),
    selectCharacter,
    setArenaChoice,
    toggleReady,
    startShift,
    confirmKit,
    sendTelemetry,
    sendCombatEvent,
    reportWaveResult,
    markIntermissionReady,
    returnToLobby,
    sendChat
  };
}