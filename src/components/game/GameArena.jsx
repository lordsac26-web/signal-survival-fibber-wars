import { useEffect, useRef, useState } from 'react';
import { createSignalEngine } from '@/game/signalEngine';
import GameHUD from '@/components/game/GameHUD';
import TouchControls from '@/components/game/TouchControls';
import SpecialButton from '@/components/game/SpecialButton';
import StatsScreen from '@/components/game/StatsScreen'; // NEW: the Brotato-style stat sheet overlay

export default function GameArena({ run, onFinish }) {
  const canvas = useRef(null);
  const input = useRef({ x: 0, y: 0, special: false });

  // NEW: `paused` is a ref, not useState — it needs to be read by the engine's
  // rAF loop every frame (see the comment in signalEngine.js), and refs don't
  // trigger a re-render on write, which is exactly what a value read 60x/sec
  // by non-React code wants. `showStats` is the actual React state that
  // controls whether <StatsScreen> renders — the two are kept in sync by
  // toggleStats() below rather than merging them into one thing, because
  // "is the sim frozen" (engine's concern) and "is this overlay showing"
  // (React's concern) are different questions that happen to always agree
  // in this game, but wiring them through their natural owners keeps this
  // change easy to extend later (e.g. auto-pausing for other future menus
  // without necessarily opening the stats screen).
  const paused = useRef(false);
  const [showStats, setShowStats] = useState(false);

  const [hud, setHud] = useState(run);
  const [flash, setFlash] = useState('');
  const [shake, setShake] = useState(false);

  const toggleStats = () => {
    const next = !showStats;
    setShowStats(next);
    paused.current = next;
  };

  useEffect(() => {
    const down = e => {
      const k = e.key.toLowerCase();
      // NEW: Escape (desktop) toggles the stats screen just like the on-screen
      // button does (for touch). Returning immediately means a held movement
      // key doesn't also register on the same keypress that opened the panel.
      if (k === 'escape') { toggleStats(); return; }
      if (['arrowup', 'w'].includes(k)) input.current.y = -1;
      if (['arrowdown', 's'].includes(k)) input.current.y = 1;
      if (['arrowleft', 'a'].includes(k)) input.current.x = -1;
      if (['arrowright', 'd'].includes(k)) input.current.x = 1;
      if (k === 'e') input.current.special = true;
    };
    const up = e => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'w', 'arrowdown', 's'].includes(k)) input.current.y = 0;
      if (['arrowleft', 'a', 'arrowright', 'd'].includes(k)) input.current.x = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    // CHANGED: `paused` ref is now the 5th argument to createSignalEngine —
    // see signalEngine.js for what it does inside the loop.
    const clean = createSignalEngine(canvas.current, run, input, {
      hud: setHud,
      finish: onFinish,
      flash: t => { setFlash(t); setTimeout(() => setFlash(''), 1400); },
      shake: () => { setShake(true); setTimeout(() => setShake(false), 120); }
    }, paused);

    return () => {
      clean();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`relative h-screen w-screen overflow-hidden bg-slate-950 ${shake ? 'game-shake' : ''}`}>
      <canvas ref={canvas} className="h-full w-full" />
      <GameHUD
        hud={hud}
        wave={run.wave}
        weapons={run.weapons}
        slots={run.character.slots || 6}
        onOpenStats={toggleStats} // NEW: renders a small clipboard icon button in the HUD
      />
      <TouchControls input={input} />
      <SpecialButton hud={hud} input={input} />
      {flash && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-5 text-center">
          <span className="-rotate-2 rounded-lg bg-amber-300 px-5 py-2 text-xl font-black text-slate-950 shadow-[5px_5px_0_#ea580c] sm:text-2xl">{flash}</span>
        </div>
      )}
      {/* NEW: only mounted while showStats is true. Passing `run` directly is
          enough — every stat it needs to display (damage, armor, crit, the
          current weapon loadout, etc.) already lives as plain fields on the
          run object itself; see StatsScreen.jsx for the full breakdown. */}
      {showStats && <StatsScreen run={run} onClose={toggleStats} />}
    </main>
  );
}
