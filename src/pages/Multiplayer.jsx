import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import useProfile from '@/game/progression/useProfile';
import useCoopRoom from '@/game/multiplayer/useCoopRoom';
import { characterById } from '@/game/data/characters';
import { createRun, rebuildStats } from '@/game/progression/runRules';
import { applyStartingKit } from '@/game/progression/startingKit';
import { enterShop, shopTransaction } from '@/game/shop/shopRules';
import { pickUpgrade, upgradeChoices, rerollUpgradeChoices, skipUpgrade } from '@/game/progression/upgradeRules';
import { recordRun } from '@/game/storage';
import { resumeAudio } from '@/game/audio';
import { toast } from '@/components/ui/use-toast';
import CoopRoomBrowser from '@/components/game/CoopRoomBrowser';
import CoopStagingRoom from '@/components/game/CoopStagingRoom';
import CoopHudBanner from '@/components/game/CoopHudBanner';
import LoadoutScreen from '@/components/game/LoadoutScreen';
import GameArena from '@/components/game/GameArena';
import UpgradeScreen from '@/components/game/UpgradeScreen';
import ShopScreen from '@/components/game/ShopScreen';
import SummaryScreen from '@/components/game/SummaryScreen';

function hydrateSeatRun(meSeat, roomState, fallbackCharId) {
  const ch = characterById(meSeat?.characterId || fallbackCharId || 'oracle');
  const base = createRun(ch, Boolean(meSeat?.useAlt), roomState?.seed || 1);
  const merged = rebuildStats({
    ...base,
    wave: roomState?.wave || 1,
    arenaChoice: roomState?.arenaChoice || 'random',
    arenaTheme: roomState?.arenaTheme || base.arenaTheme || 'office',
    weapons: Array.isArray(meSeat?.weapons) && meSeat.weapons.length ? meSeat.weapons : base.weapons,
    items: Array.isArray(meSeat?.items) ? meSeat.items : base.items,
    deployables: Array.isArray(meSeat?.deployables) ? meSeat.deployables : base.deployables,
    statMods: Array.isArray(meSeat?.statMods) ? meSeat.statMods : base.statMods,
    hp: meSeat?.hp ?? base.hp,
    level: meSeat?.level ?? base.level,
    pendingLevels: meSeat?.pendingLevels ?? 0,
    xp: meSeat?.xp ?? 0,
    kills: meSeat?.kills ?? 0,
    killsByType: meSeat?.killsByType || {},
    signal: meSeat?.signal ?? 0,
    earnedSignal: meSeat?.earnedSignal ?? 0,
    damageDealt: meSeat?.damageDealt ?? 0,
    damageTaken: meSeat?.damageTaken ?? 0,
    healed: meSeat?.healed ?? 0
  });
  return {
    ...merged,
    hp: Math.min(merged.maxHp, Math.max(1, meSeat?.hp ?? merged.hp)),
    coop: true,
    coopAuthoritative: true,
    coopSeat: meSeat?.seat || 1
  };
}

export default function Multiplayer() {
  const { user } = useAuth();
  const profileState = useProfile(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const roomId = searchParams.get('room') || '';

  const [arenaChoice, setArenaChoice] = useState('random');
  const [selectedCharId, setSelectedCharId] = useState('oracle');
  const [selectedAlt, setSelectedAlt] = useState(false);
  const [initConfig, setInitConfig] = useState(null);
  const [run, setRun] = useState(null);
  const [localStage, setLocalStage] = useState('lobby');
  const [newUnlocks, setNewUnlocks] = useState([]);

  const runRef = useRef(null);
  const syncedPhaseKeyRef = useRef('');
  const lastInputSentRef = useRef({ ts: 0, x: 0, y: 0 });

  const playerName = user?.full_name || user?.email?.split('@')[0] || 'Technician';
  const effectiveInitConfig = initConfig || {
    isHostInit: false,
    name: playerName,
    characterId: selectedCharId,
    useAlt: selectedAlt
  };
  const coop = useCoopRoom(roomId, effectiveInitConfig, user?.id || 'anon');

  // If a user entered a truncated/prefix room ID in the URL, resolve it to the canonical 24-char CoopLobby ID
  useEffect(() => {
    if (!roomId || roomId.length >= 24) return;
    let cancelled = false;
    base44.entities.CoopLobby.filter(
      { status: { $in: ['lobby', 'loadout', 'combat', 'intermission'] } },
      { sort: '-updated_date', limit: 20 }
    )
      .then((page) => {
        if (cancelled) return;
        const list = Array.isArray(page) ? page : page?.items || [];
        const needle = roomId.trim().toLowerCase();
        const match = list.find(
          (r) =>
            r.id &&
            (r.id.toLowerCase() === needle ||
              r.id.toLowerCase().startsWith(needle) ||
              String(r.title || '').toLowerCase() === needle)
        );
        if (match && match.id !== roomId) {
          setSearchParams({ room: match.id }, { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roomId, setSearchParams]);

  const assignRun = (nextRun) => {
    const { combineNotices = [], ...clean } = nextRun;
    runRef.current = clean;
    setRun(clean);
    for (const notice of combineNotices) {
      toast({ ...notice, duration: 3500, className: 'combine-flash' });
    }
  };

  // Synchronize local screen transitions with authoritative server room phase & seat state
  useEffect(() => {
    if (!roomId || !coop.room || !coop.seat) return;
    const serverPhase = coop.room.phase;
    const meSeat = coop.users.find((u) => u.seat === coop.seat);
    if (meSeat?.characterId && meSeat.characterId !== selectedCharId) {
      setSelectedCharId(meSeat.characterId);
    }

    if (serverPhase === 'lobby') {
      syncedPhaseKeyRef.current = 'lobby';
      setLocalStage('lobby');
      return;
    }

    const phaseKey = `${serverPhase}:w${coop.room.wave}:${coop.room.runId || ''}`;

    if (serverPhase === 'loadout') {
      if (meSeat?.kitConfirmed) {
        if (!runRef.current) assignRun(hydrateSeatRun(meSeat, coop.room, selectedCharId));
        setLocalStage('waiting_kit');
        return;
      }
      if (syncedPhaseKeyRef.current !== phaseKey) {
        syncedPhaseKeyRef.current = phaseKey;
        resumeAudio();
        const ch = characterById(meSeat?.characterId || selectedCharId);
        const fresh = {
          ...createRun(ch, Boolean(meSeat?.useAlt ?? selectedAlt), coop.room.seed || 1),
          arenaChoice: coop.room.arenaChoice || 'random',
          arenaTheme: coop.room.arenaTheme || 'office',
          coop: true,
          coopAuthoritative: true,
          coopSeat: coop.seat
        };
        assignRun(fresh);
        setLocalStage('loadout');
      }
      return;
    }

    if (serverPhase === 'combat') {
      if (syncedPhaseKeyRef.current !== phaseKey) {
        syncedPhaseKeyRef.current = phaseKey;
        const hydrated = hydrateSeatRun(meSeat, coop.room, selectedCharId);
        assignRun(hydrated);
        setLocalStage('combat');
      }
      return;
    }

    if (serverPhase === 'intermission') {
      if (meSeat?.intermissionReady) {
        if (!runRef.current) assignRun(hydrateSeatRun(meSeat, coop.room, selectedCharId));
        setLocalStage('waiting_intermission');
        return;
      }
      if (syncedPhaseKeyRef.current !== phaseKey) {
        syncedPhaseKeyRef.current = phaseKey;
        const hydrated = hydrateSeatRun(meSeat, coop.room, selectedCharId);
        if ((hydrated.pendingLevels || 0) > 0) {
          assignRun(hydrated);
          setLocalStage('upgrade');
        } else {
          assignRun(enterShop(hydrated));
          setLocalStage('shop');
        }
      }
      return;
    }

    if (serverPhase === 'summary' && localStage !== 'summary') {
      syncedPhaseKeyRef.current = phaseKey;
      const finalRun = {
        ...hydrateSeatRun(meSeat, coop.room, selectedCharId),
        won: false,
        hp: 0
      };
      assignRun(finalRun);
      const res = recordRun(finalRun);
      setNewUnlocks(res.newUnlocks || []);
      setLocalStage('summary');
    }
  }, [roomId, coop.room?.phase, coop.room?.wave, coop.room?.runId, coop.seat, coop.users, selectedCharId, selectedAlt, localStage]);

  const handleCreatePublic = async (title) => {
    const ch = characterById(selectedCharId);
    const created = await base44.entities.CoopLobby.create({
      title,
      host_name: playerName,
      status: 'lobby',
      player_count: 1,
      max_players: 4,
      wave: 1,
      arena_choice: arenaChoice
    });
    setInitConfig({
      isHostInit: true,
      registryId: created.id,
      title,
      arenaChoice,
      name: playerName,
      characterId: ch.id,
      useAlt: selectedAlt
    });
    setSearchParams({ room: created.id });
  };

  const handleCreatePrivate = (title) => {
    const ch = characterById(selectedCharId);
    const privateId = crypto.randomUUID();
    setInitConfig({
      isHostInit: true,
      registryId: null,
      title,
      arenaChoice,
      name: playerName,
      characterId: ch.id,
      useAlt: selectedAlt
    });
    setSearchParams({ room: privateId });
  };

  const handleJoinRoom = (targetRoomId) => {
    const ch = characterById(selectedCharId);
    setInitConfig({
      isHostInit: false,
      name: playerName,
      characterId: ch.id,
      useAlt: selectedAlt
    });
    setSearchParams({ room: targetRoomId });
  };

  const handleLeaveRoom = () => {
    coop.leaveRoom();
    setInitConfig(null);
    setRun(null);
    runRef.current = null;
    syncedPhaseKeyRef.current = '';
    setLocalStage('lobby');
    setSearchParams({});
  };

  const handlePickCharacter = (ch, useAlt = false) => {
    setSelectedCharId(ch.id);
    setSelectedAlt(Boolean(useAlt));
    coop.selectCharacter({
      name: playerName,
      characterId: ch.id,
      useAlt: Boolean(useAlt),
      maxHp: ch.stats.maxHp
    });
  };

  const handleConfirmKit = (pickedIds) => {
    if (!runRef.current) return;
    const next = applyStartingKit(runRef.current, pickedIds);
    assignRun(next);
    setLocalStage('waiting_kit');
    coop.confirmKit({
      pickedIds,
      weapons: next.weapons,
      hp: next.hp,
      maxHp: next.maxHp
    });
  };

  const pushIntermissionSnapshot = (nextRun) => {
    coop.syncIntermission({
      hp: nextRun.hp,
      maxHp: nextRun.maxHp,
      level: nextRun.level,
      pendingLevels: nextRun.pendingLevels || 0,
      signal: nextRun.signal,
      weapons: nextRun.weapons,
      items: nextRun.items,
      deployables: nextRun.deployables,
      statMods: nextRun.statMods
    });
  };

  const handleUpgrade = (item) => {
    const r = runRef.current;
    if (!r || !upgradeChoices(r).some((i) => i.id === item.id)) return;
    const next = pickUpgrade(r, item.id);
    if ((next.pendingLevels || 0) > 0) {
      assignRun(next);
      pushIntermissionSnapshot(next);
      setLocalStage('upgrade');
    } else {
      const shopRun = enterShop(next);
      assignRun(shopRun);
      pushIntermissionSnapshot(shopRun);
      setLocalStage('shop');
    }
  };

  const handleRerollUpgrade = () => {
    if (!runRef.current) return;
    try {
      const next = rerollUpgradeChoices(runRef.current);
      assignRun(next);
      pushIntermissionSnapshot(next);
    } catch (e) {
      toast({ title: 'Reroll unavailable', description: e.message });
    }
  };

  const handleSkipUpgrade = () => {
    if (!runRef.current) return;
    const next = skipUpgrade(runRef.current);
    if ((next.pendingLevels || 0) > 0) {
      assignRun(next);
      pushIntermissionSnapshot(next);
      setLocalStage('upgrade');
    } else {
      const shopRun = enterShop(next);
      assignRun(shopRun);
      pushIntermissionSnapshot(shopRun);
      setLocalStage('shop');
    }
  };

  const handleShopAction = (event) => {
    if (!runRef.current) return;
    const next = shopTransaction(runRef.current, event);
    assignRun(next);
    pushIntermissionSnapshot(next);
  };

  const handleShopReadyNextWave = () => {
    if (!runRef.current) return;
    setLocalStage('waiting_intermission');
    coop.markIntermissionReady({
      hp: runRef.current.hp,
      maxHp: runRef.current.maxHp,
      level: runRef.current.level,
      pendingLevels: runRef.current.pendingLevels || 0,
      signal: runRef.current.signal,
      weapons: runRef.current.weapons,
      items: runRef.current.items,
      deployables: runRef.current.deployables,
      statMods: runRef.current.statMods
    });
  };

  const handlePing = () => {
    coop.sendCombatAction({ action: 'ping' });
  };

  if (!roomId) {
    return (
      <CoopRoomBrowser
        user={user}
        arenaChoice={arenaChoice}
        onArenaChange={setArenaChoice}
        onCreatePublic={handleCreatePublic}
        onCreatePrivate={handleCreatePrivate}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  if (coop.status === 'rejected') {
    return (
      <main className="game-grid min-h-screen px-5 py-16 text-game-ink">
        <section className="mx-auto max-w-lg rounded-3xl border-2 border-rose-400/50 bg-game-panel p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-rose-400" />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-rose-300">
            Dispatch Join Refused ({coop.errorCode || 'room_locked'})
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold">
            {coop.error || 'This shift room cannot accept new technicians right now.'}
          </h1>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={coop.retryConnection}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-game-signal/40 bg-game-bg px-4 text-sm font-bold text-game-signal"
            >
              <RefreshCw className="size-4" /> Retry Room
            </button>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-game-warm px-5 text-sm font-bold text-game-bg"
            >
              <ArrowLeft className="size-4" /> Back to Dispatch Board
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (localStage === 'lobby' || !coop.room || coop.room.phase === 'lobby') {
    return (
      <CoopStagingRoom
        roomId={roomId}
        coop={coop}
        profile={profileState.profile}
        selectedCharId={selectedCharId}
        selectedAlt={selectedAlt}
        onSelectCharacter={handlePickCharacter}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (localStage === 'loadout' && run) {
    return (
      <>
        <CoopHudBanner roomId={roomId} coop={coop} onLeave={handleLeaveRoom} />
        <LoadoutScreen run={run} onConfirm={handleConfirmKit} onBack={handleLeaveRoom} />
      </>
    );
  }

  if (localStage === 'waiting_kit' || localStage === 'waiting_wave' || localStage === 'waiting_intermission') {
    return (
      <main className="game-grid min-h-screen text-game-ink">
        <CoopHudBanner
          roomId={roomId}
          coop={coop}
          onLeave={handleLeaveRoom}
          onForceNextWave={
            coop.isHost && coop.room?.phase === 'intermission'
              ? () => coop.markIntermissionReady({ force: true })
              : undefined
          }
        />
        <section className="mx-auto mt-16 max-w-xl rounded-3xl border-2 border-game-signal/35 bg-game-panel p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-game-signal">WebSocket Crew Sync</p>
          <h1 className="mt-2 font-heading text-2xl font-bold">
            {localStage === 'waiting_kit'
              ? 'Kit locked in — waiting on crew check-out…'
              : localStage === 'waiting_wave'
              ? 'Wave complete — syncing field telemetry…'
              : 'Ready for next wave — waiting on crew in the company van…'}
          </h1>
          <div className="mt-5 space-y-2 text-left text-sm">
            {coop.users.map((u) => (
              <div
                key={u.seat}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-game-bg px-4 py-2.5"
              >
                <span>
                  <b className="text-game-signal">P{u.seat}</b> {u.name}
                  {u.connected === false && <span className="ml-2 text-xs text-rose-400">(Disconnected)</span>}
                </span>
                <span className="font-bold text-game-warm">
                  {localStage === 'waiting_kit'
                    ? u.kitConfirmed
                      ? '✓ Confirmed'
                      : 'Choosing tool…'
                    : localStage === 'waiting_intermission'
                    ? u.intermissionReady
                      ? '✓ Ready'
                      : 'Shopping…'
                    : u.waveDone
                    ? '✓ Finished Wave'
                    : `In Combat (${Math.round(u.hp || 0)} HP)`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (localStage === 'combat' && run) {
    const arenaRun = {
      ...run,
      coop: true,
      coopAuthoritative: true,
      coopSeat: coop.seat,
      coopWorldRef: coop.worldRef,
      coopPeers: coop.peersRef,
      coopEvents: coop.combatEventsRef,
      onCoopPing: handlePing,
      onCoopInput: ({ x, y, viewportW, viewportH }) => {
        const now = performance.now();
        const prev = lastInputSentRef.current;
        const changed = Math.abs(x - prev.x) > 0.01 || Math.abs(y - prev.y) > 0.01;
        if (!changed && now - prev.ts < 65) return;
        lastInputSentRef.current = { ts: now, x, y };
        coop.sendCombatInput({ x, y, viewportW, viewportH });
      },
      onCoopAction: (actionPayload) => {
        coop.sendCombatAction(actionPayload);
      }
    };
    return (
      <>
        <CoopHudBanner roomId={roomId} coop={coop} onPing={handlePing} onLeave={handleLeaveRoom} />
        <GameArena
          key={`coop-${roomId}-${coop.room?.runId || 'r'}-w${coop.room?.wave || run.wave}`}
          run={arenaRun}
          onFinish={() => setLocalStage('waiting_wave')}
        />
      </>
    );
  }

  if (localStage === 'upgrade' && run) {
    return (
      <>
        <CoopHudBanner roomId={roomId} coop={coop} onLeave={handleLeaveRoom} />
        <UpgradeScreen
          key={`coop-upg-${run.wave}-${run.level}-${run.pendingLevels || 0}`}
          run={run}
          onPick={handleUpgrade}
          onReroll={handleRerollUpgrade}
          onSkip={handleSkipUpgrade}
        />
      </>
    );
  }

  if (localStage === 'shop' && run) {
    return (
      <>
        <CoopHudBanner
          roomId={roomId}
          coop={coop}
          onLeave={handleLeaveRoom}
          onForceNextWave={coop.isHost ? () => coop.markIntermissionReady({ force: true }) : undefined}
        />
        <ShopScreen
          run={run}
          onAction={handleShopAction}
          onContinue={handleShopReadyNextWave}
          onProfile={handleLeaveRoom}
        />
      </>
    );
  }

  return (
    <>
      <CoopHudBanner roomId={roomId} coop={coop} onLeave={handleLeaveRoom} />
      <SummaryScreen
        run={run || createRun(characterById(selectedCharId), false, 1)}
        newUnlocks={newUnlocks}
        onMenu={handleLeaveRoom}
        onRetry={coop.returnToLobby}
      />
    </>
  );
}