import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import useProfile from '@/game/progression/useProfile';
import useCoopRoom from '@/game/multiplayer/useCoopRoom';
import { characterById } from '@/game/data/characters';
import { createRun, advanceRunWave } from '@/game/progression/runRules';
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

export default function Multiplayer() {
  const { user } = useAuth();
  const profileState = useProfile(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const roomId = searchParams.get('room') || '';

  const [arenaChoice, setArenaChoice] = useState('random');
  const [selectedCharId, setSelectedCharId] = useState('oracle');
  const [initConfig, setInitConfig] = useState(null);
  const [run, setRun] = useState(null);
  const [localStage, setLocalStage] = useState('lobby');
  const [newUnlocks, setNewUnlocks] = useState([]);

  const runRef = useRef(null);
  const lastPosRef = useRef({ x: 550, y: 400 });
  const lastTelemetryRef = useRef({ sig: '', ts: 0 });
  const syncedWaveRef = useRef(0);

  const playerName = user?.full_name || user?.email?.split('@')[0] || 'Technician';
  const coop = useCoopRoom(roomId, initConfig);

  const assignRun = (nextRun) => {
    const { combineNotices = [], ...clean } = nextRun;
    runRef.current = clean;
    setRun(clean);
    for (const notice of combineNotices) {
      toast({ ...notice, duration: 3500, className: 'combine-flash' });
    }
  };

  // Synchronize local screen transitions with authoritative server room phase
  useEffect(() => {
    if (!roomId || !coop.room) return;
    const serverPhase = coop.room.phase;

    if (serverPhase === 'lobby') {
      syncedWaveRef.current = 0;
      setLocalStage('lobby');
      return;
    }

    if (serverPhase === 'loadout' && localStage === 'lobby') {
      resumeAudio();
      const ch = characterById(selectedCharId);
      const fresh = {
        ...createRun(ch, false, coop.room.seed || 1),
        arenaChoice: coop.room.arenaChoice || 'random',
        arenaTheme: coop.room.arenaTheme || 'office',
        coop: true,
        coopSeat: coop.seat
      };
      assignRun(fresh);
      setLocalStage('loadout');
      return;
    }

    if (serverPhase === 'combat' && syncedWaveRef.current !== coop.room.wave) {
      syncedWaveRef.current = coop.room.wave;
      let base = runRef.current;
      if (!base) {
        const ch = characterById(selectedCharId);
        base = createRun(ch, false, coop.room.seed || 1);
      } else if (coop.room.wave > 1 && base.wave < coop.room.wave) {
        base = advanceRunWave(base, coop.room.arenaChoice || 'random');
      }
      if (base.hp <= 0) {
        base = { ...base, hp: Math.max(1, Math.round(base.maxHp * 0.5)) };
      }
      assignRun({
        ...base,
        wave: coop.room.wave,
        arenaChoice: coop.room.arenaChoice || 'random',
        arenaTheme: coop.room.arenaTheme || base.arenaTheme || 'office',
        coop: true,
        coopSeat: coop.seat
      });
      setLocalStage('combat');
      return;
    }

    if (serverPhase === 'intermission' && (localStage === 'waiting_wave' || localStage === 'combat')) {
      const cur = runRef.current;
      if (!cur) return;
      const revived = cur.hp <= 0 ? { ...cur, hp: Math.max(1, Math.round(cur.maxHp * 0.5)) } : cur;
      if ((revived.pendingLevels || 0) > 0) {
        assignRun(revived);
        setLocalStage('upgrade');
      } else {
        assignRun(enterShop(revived));
        setLocalStage('shop');
      }
      return;
    }

    if (serverPhase === 'summary' && localStage !== 'summary') {
      if (runRef.current) {
        const res = recordRun(runRef.current);
        setNewUnlocks(res.newUnlocks || []);
      }
      setLocalStage('summary');
    }
  }, [roomId, coop.room?.phase, coop.room?.wave, coop.seat, selectedCharId, localStage]);

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
      registryId: created.id,
      title,
      arenaChoice,
      name: playerName,
      characterId: ch.id
    });
    setSearchParams({ room: created.id });
  };

  const handleCreatePrivate = (title) => {
    const ch = characterById(selectedCharId);
    const privateId = crypto.randomUUID();
    setInitConfig({
      registryId: null,
      title,
      arenaChoice,
      name: playerName,
      characterId: ch.id
    });
    setSearchParams({ room: privateId });
  };

  const handleJoinRoom = (targetRoomId) => {
    const ch = characterById(selectedCharId);
    setInitConfig({
      name: playerName,
      characterId: ch.id
    });
    setSearchParams({ room: targetRoomId });
  };

  const handleLeaveRoom = () => {
    setInitConfig(null);
    setRun(null);
    runRef.current = null;
    syncedWaveRef.current = 0;
    setLocalStage('lobby');
    setSearchParams({});
  };

  const handlePickCharacter = (ch) => {
    setSelectedCharId(ch.id);
    coop.selectCharacter({
      name: playerName,
      characterId: ch.id,
      useAlt: false,
      maxHp: ch.stats.maxHp
    });
  };

  const handleConfirmKit = (pickedIds) => {
    if (!runRef.current) return;
    const next = applyStartingKit(runRef.current, pickedIds);
    assignRun(next);
    setLocalStage('waiting_kit');
    coop.confirmKit({
      weapons: next.weapons,
      hp: next.hp,
      maxHp: next.maxHp
    });
  };

  const handleWaveFinish = (finishedRun) => {
    assignRun(finishedRun);
    setLocalStage('waiting_wave');
    coop.reportWaveResult({
      won: finishedRun.won,
      hp: finishedRun.hp,
      maxHp: finishedRun.maxHp,
      kills: finishedRun.kills,
      signal: finishedRun.signal,
      level: finishedRun.level,
      damageDealt: finishedRun.damageDealt
    });
  };

  const handleUpgrade = (item) => {
    const r = runRef.current;
    if (!r || !upgradeChoices(r).some((i) => i.id === item.id)) return;
    const next = pickUpgrade(r, item.id);
    if ((next.pendingLevels || 0) > 0) {
      assignRun(next);
      setLocalStage('upgrade');
    } else {
      assignRun(enterShop(next));
      setLocalStage('shop');
    }
  };

  const handleRerollUpgrade = () => {
    if (!runRef.current) return;
    try {
      assignRun(rerollUpgradeChoices(runRef.current));
    } catch (e) {
      toast({ title: 'Reroll unavailable', description: e.message });
    }
  };

  const handleSkipUpgrade = () => {
    if (!runRef.current) return;
    const next = skipUpgrade(runRef.current);
    if ((next.pendingLevels || 0) > 0) {
      assignRun(next);
      setLocalStage('upgrade');
    } else {
      assignRun(enterShop(next));
      setLocalStage('shop');
    }
  };

  const handleShopAction = (event) => {
    if (!runRef.current) return;
    assignRun(shopTransaction(runRef.current, event));
  };

  const handleShopReadyNextWave = () => {
    if (!runRef.current) return;
    setLocalStage('waiting_intermission');
    coop.markIntermissionReady({
      hp: runRef.current.hp,
      maxHp: runRef.current.maxHp,
      level: runRef.current.level,
      signal: runRef.current.signal,
      weapons: runRef.current.weapons
    });
  };

  const handlePing = () => {
    coop.sendCombatEvent({
      kind: 'ping',
      x: lastPosRef.current.x,
      y: lastPosRef.current.y,
      label: 'SECTOR PING'
    });
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

  if (localStage === 'lobby' || !coop.room || coop.room.phase === 'lobby') {
    return (
      <CoopStagingRoom
        roomId={roomId}
        coop={coop}
        profile={profileState.profile}
        selectedCharId={selectedCharId}
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
      coopSeat: coop.seat,
      coopPeers: coop.peersRef,
      coopEvents: coop.combatEventsRef,
      onCoopPing: handlePing,
      onCoopSpecial: (x, y, special) => {
        coop.sendCombatEvent({
          kind: special?.id === 'sprint' ? 'heal_pulse' : 'special',
          x,
          y,
          amount: special?.id === 'sprint' ? 18 : 0,
          label: special?.name || 'SIGNATURE'
        });
      },
      onCoopTelemetry: (hudSnap) => {
        if (hudSnap.position) lastPosRef.current = hudSnap.position;
        const tx = Math.round(hudSnap.position?.x ?? lastPosRef.current.x);
        const ty = Math.round(hudSnap.position?.y ?? lastPosRef.current.y);
        const thp = Math.round(hudSnap.hp || 0);
        const sig = `${tx}:${ty}:${thp}:${hudSnap.maxHp}:${hudSnap.kills}:${Math.round(hudSnap.signal || 0)}:${hudSnap.level}:${Math.ceil(hudSnap.specialRemaining || 0)}`;
        const now = performance.now();
        if (sig === lastTelemetryRef.current.sig && now - lastTelemetryRef.current.ts < 500) return;
        lastTelemetryRef.current = { sig, ts: now };
        coop.sendTelemetry({
          x: tx,
          y: ty,
          hp: hudSnap.hp,
          maxHp: hudSnap.maxHp,
          kills: hudSnap.kills,
          signal: hudSnap.signal,
          level: hudSnap.level,
          special: hudSnap.specialRemaining || 0
        });
      }
    };
    return <GameArena key={`coop-${roomId}-w${run.wave}`} run={arenaRun} onFinish={handleWaveFinish} />;
  }

  if (localStage === 'upgrade' && run) {
    return (
      <>
        <CoopHudBanner roomId={roomId} coop={coop} onLeave={handleLeaveRoom} />
        <UpgradeScreen
          key={`coop-upg-${run.wave}-${run.level}`}
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