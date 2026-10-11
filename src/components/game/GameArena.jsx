import { useEffect, useRef, useState } from 'react';
import { createSignalEngine } from '@/game/signalEngine';
import { preloadCharacterSprite, preloadEnemySprite, preloadStructureSprite } from '@/game/art/spriteLoader';
import GameHUD from '@/components/game/GameHUD';
import TouchControls from '@/components/game/TouchControls';
import MatchFooter from '@/components/game/MatchFooter';
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
  const [artStatus,setArtStatus]=useState('loading');
  const [artAttempt,setArtAttempt]=useState(0);

  const toggleStats = () => setShowStats(current => {paused.current=!current;return !current});

  useEffect(() => {
    const down = e => {
      const k = e.key.toLowerCase();
      // NEW: Escape (desktop) toggles the stats screen just like the on-screen
      // button does (for touch). Returning immediately means a held movement
      // key doesn't also register on the same keypress that opened the panel.
      if ((k === 'escape' || k === 'tab') && !e.repeat) { e.preventDefault(); toggleStats(); return; }
      if (['arrowup', 'w'].includes(k)) input.current.y = -1;
      if (['arrowdown', 's'].includes(k)) input.current.y = 1;
      if (['arrowleft', 'a'].includes(k)) input.current.x = -1;
      if (['arrowright', 'd'].includes(k)) input.current.x = 1;
      if (k === 'e') input.current.special = true;
      // Deployables: Q places the selected structure at the player's feet,
      // C cycles which owned deployable is selected (HUD highlight follows).
      if (k === 'q') input.current.deploy = true;
      if (k === 'c') input.current.cycle = true;
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
    let disposed=false,clean=null;
    // Character art (Oracle or Dispatch Don), the Lag Sprite enemy art, the
    // Bucket-Truck turret art, and the Squirrel boss art load in parallel;
    // a failure blocks start with a retry.
    Promise.all([preloadCharacterSprite(run.character.id),preloadEnemySprite('lag'),preloadStructureSprite('bucket'),preloadStructureSprite('pedestal_turret'),preloadEnemySprite('squirrel'),preloadEnemySprite('dirty'),preloadEnemySprite('packet')]).then(([art,lagArt,truckArt,pedestalArt,squirrelArt,blobArt,puddingArt])=>{
      if(disposed)return;
      clean=createSignalEngine(canvas.current,run,input,{
        hud:setHud,reach:reach=>setHud(current=>({...current,...reach})),finish:onFinish,
        flash:t=>{setFlash(t);setTimeout(()=>setFlash(''),1400)}
      },paused,art,lagArt,truckArt,squirrelArt,blobArt,pedestalArt,puddingArt);
      setArtStatus('');
    }).catch(error=>{if(!disposed)setArtStatus(error.message)});

    return () => {
      disposed=true;clean?.();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [artAttempt]);

  // DEV-ONLY RUNTIME ASSERTION: measures the real DOM — header/footer text
  // regions must never intersect the canvas rect, and the page must not
  // scroll. Re-measured every second so the boss bar's dynamic height is
  // covered too. Production builds skip this entirely.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const id = setInterval(() => {
      const canvasRect = canvas.current?.getBoundingClientRect();
      if (!canvasRect) return;
      for (const el of document.querySelectorAll('[data-hud-region]')) {
        const r = el.getBoundingClientRect();
        if (!(r.bottom <= canvasRect.top || r.top >= canvasRect.bottom)) console.warn('HUD region overlaps the canvas:', el.tagName, r.top, r.bottom, 'canvas', canvasRect.top, canvasRect.bottom);
      }
      if (document.documentElement.scrollHeight > window.innerHeight + 1) console.warn('Match page scrolls vertically:', document.documentElement.scrollHeight);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // STRUCTURAL HUD/CANVAS SEPARATION: three stacked DOM regions in normal
  // flow — header (ALL gameplay text: HP/wave/timer/signal/kills/boss bar/
  // tools/range), canvas region (the only element the engine measures), and
  // footer (XP, flash messages, Special/Deploy buttons). No absolute HUD
  // overlays, no safe-rect insets, no negative margins — the canvas element
  // IS the remaining visible area, and the engine derives its camera
  // viewport, DPR backing buffer and touch-sized projection from that same
  // rect (see signalEngine resize()). TouchControls stays inside the canvas
  // region because it is transparent and text-free. StatsScreen stays a
  // fullscreen overlay (gameplay is paused under it).
  return (
    <main className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950">
      <GameHUD
        hud={hud}
        wave={run.wave}
        weapons={run.weapons}
        slots={run.character.slots || 6}
        onOpenStats={toggleStats} // renders a small clipboard icon button in the HUD
        onSelectDeploy={i => { input.current.deploySel = i; }} // click a deployable slot to select it
      />
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvas} className="block h-full w-full" />
        <TouchControls input={input} />
        {artStatus && <div className="absolute inset-0 z-30 flex items-center justify-center bg-game-bg/95 p-6 text-game-ink"><div role={artStatus==='loading'?'status':'alert'} className="max-w-lg text-center"><p>{artStatus==='loading'?'Loading character and enemy sprite assets…':`Sprite assets could not start: ${artStatus}`}</p>{artStatus!=='loading' && <button className="mt-4 min-h-11 rounded-lg bg-game-signal px-4 font-bold text-game-bg" onClick={()=>setArtAttempt(n=>n+1)}>Retry sprite assets</button>}</div></div>}
      </div>
      <MatchFooter hud={hud} input={input} flash={flash} />
      {/* Only mounted while showStats is true; every stat it needs already
          lives as plain fields on the run object (see StatsScreen.jsx). */}
      {showStats && <StatsScreen run={{...run,...hud}} onClose={toggleStats} />}
    </main>
  );
}