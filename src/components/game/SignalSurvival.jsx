import { useState } from 'react';
import { loadSave, recordRun } from '@/game/storage';
import { applyMods, dailySeed } from '@/game/data/generation';
import { WEAPONS } from '@/game/data/combat'; // NEW: needed to expand starting-weapon ids into full weapon objects
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
  const [unlocked, setUnlocked] = useState(false);

  const start = c => {
    // WHY THIS CHANGE:
    // characters.js gives each character's starting loadout as plain string ids,
    // e.g. start: ['cleaver'] — just a key into the WEAPONS table in combat.js.
    // Shop-bought weapons (generation.js -> createGenerator().weapon()) are a
    // completely different shape: a full object with its own damage/rate/range,
    // a rarity, rolled stat mods, a slotType ('melee' | 'ranged'), etc.
    //
    // Before this change, run.weapons held a mix of both shapes at once, and every
    // place that touched run.weapons (the HUD, the engine, the shop's slot-limit
    // check) had to carry a `typeof w === 'string' ? lookup : use-as-is` branch to
    // cope. That's also *why* the Veteran's "max 4 melee / 4 ranged" rule quietly
    // mishandled starting weapons — string entries had no slotType, so the shop
    // fell back to guessing from a hardcoded name list instead of checking it properly.
    //
    // Fixing it once, here, at the moment a run is created, means every downstream
    // consumer can assume "a weapon in run.weapons is always a full object" and
    // the swap-picker UI in ShopScreen.jsx can show real stats for starting weapons
    // too, not just shop-bought ones.
    const startingWeapons = c.start.map(id => {
      const base = WEAPONS[id];
      return {
        ...base,
        baseId: id,                 // matches the field shop weapons use to mean "this is a weapon, not a passive"
        id: `start-${id}`,          // unique key, mirrors the `w-<n>` / `p-<n>` ids the generator makes up
        // Same rule generation.js uses: melee-pattern weapons (including chain-whip
        // types) count as 'melee', everything else counts as 'ranged'.
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
      weapons: startingWeapons,     // was: [...c.start]
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
      const before = save.unlocked.length, fresh = recordRun(next);
      setSave(fresh);
      setUnlocked(fresh.unlocked.length > before);
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
  return <SummaryScreen run={run} newlyUnlocked={unlocked} onMenu={() => setScreen('menu')} onRetry={() => setScreen('select')} />;
}
