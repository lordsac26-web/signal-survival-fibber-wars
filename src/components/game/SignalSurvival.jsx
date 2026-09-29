import { useEffect, useState } from 'react';
import { loadSave, recordRun, pullCloud } from '@/game/storage';
import { applyMods, dailySeed } from '@/game/data/generation';
import { WEAPONS } from '@/game/data/combat';
import MenuScreen from '@/components/game/MenuScreen';
import CharacterSelect from '@/components/game/CharacterSelect';
import GameArena from '@/components/game/GameArena';
import UpgradeScreen from '@/components/game/UpgradeScreen';
import ShopScreen from '@/components/game/ShopScreen';
import SummaryScreen from '@/components/game/SummaryScreen';
import GalleryScreen from '@/components/game/GalleryScreen';

export default function SignalSurvival() {
  const [screen, setScreen] = useState('menu');
  const [save, setSave] = useState(loadSave);
  const [run, setRun] = useState(null);
  const [newUnlocks, setNewUnlocks] = useState([]);

  // Cross-device/refresh persistence: pull a newer cloud save once on boot.
  // localStorage is the instant source of truth; the cloud record only wins
  // when it carries a newer timestamp.
  useEffect(() => { pullCloud().then(s => { if (s) setSave(s); }); }, []);

  const start = (c, useAlt = false) => {
    // Expand starting-weapon ids (default or unlocked alternate kit) into full
    // weapon objects with slotType — the same shape shop weapons have, so
    // every consumer (HUD, engine, shop slot rules, swap picker) can assume
    // run.weapons entries are always full objects.
    const ids = useAlt && c.altStart ? c.altStart : c.start;
    const startingWeapons = ids.map((id, i) => {
      const base = WEAPONS[id];
      return {
        ...base,
        baseId: id,
        id: `start-${i}-${id}`,
        slotType: ['melee', 'chain'].includes(base.pattern) ? 'melee' : 'ranged'
      };
    });

    setRun({
      character: c,
      wave: 1,
      level: 0,
      hp: c.stats.maxHp,
      signal: 0,
      kills: 0,
      xp: 0,
      pendingLevels: 0,
      buys: 0,
      weapons: startingWeapons,
      items: [],
      seed: dailySeed(),
      specialProgress: 0,
      specialUnlocked: false,
      ...c.stats
    });
    setScreen('game');
  };

  const finish = next => {
    setRun(next);
    if (!next.won) {
      const res = recordRun(next);
      setSave(res.save);
      setNewUnlocks(res.newUnlocks);
      setScreen('summary');
    } else if (next.pendingLevels > 0) {
      setScreen('upgrade');
    } else {
      setScreen('shop');
    }
  };

  const upgrade = item => {
    let next = applyMods({ ...run, level: run.level + 1, pendingLevels: run.pendingLevels - 1 }, item);
    next.items = [...(run.items || []), item];
    setRun(next);
    setScreen(next.pendingLevels > 0 ? 'upgrade' : 'shop');
  };

  const nextWave = () => {
    setRun(r => ({ ...r, wave: r.wave + 1, hp: Math.min(r.maxHp, r.hp + Math.ceil(r.maxHp * .22)) }));
    setScreen('game');
  };

  if (screen === 'menu') return <MenuScreen save={save} onPlay={() => setScreen('select')} onGallery={() => setScreen('gallery')} />;
  if (screen === 'gallery') return <GalleryScreen save={save} onBack={() => setScreen('menu')} />;
  if (screen === 'select') return <CharacterSelect save={save} onBack={() => setScreen('menu')} onSelect={start} />;
  if (screen === 'game') return <GameArena key={run.wave} run={run} onFinish={finish} />;
  if (screen === 'upgrade') return <UpgradeScreen key={`${run.wave}-${run.level}`} run={run} onPick={upgrade} />;
  if (screen === 'shop') return <ShopScreen run={run} onChange={setRun} onContinue={nextWave} />;
  return <SummaryScreen run={run} newUnlocks={newUnlocks} onMenu={() => setScreen('menu')} onRetry={() => setScreen('select')} />;
}