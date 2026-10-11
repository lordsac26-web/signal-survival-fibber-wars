import SpecialButton from '@/components/game/SpecialButton';
import DeployButton from '@/components/game/DeployButton';
import ProgressMeters from '@/components/game/ProgressMeters';

// Footer region BELOW the canvas: XP/earned-signal readout, the transient
// action flash, and the Special/Deploy buttons all live here in normal flow —
// never overlaid on the play area. The flash row keeps a fixed height so its
// appearance doesn't shift the layout mid-wave.
export default function MatchFooter({ hud, input, flash }) {
  return <footer className="w-full shrink-0 border-t-2 border-slate-800 bg-slate-950 px-3 py-2 text-white" data-hud-region>
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="w-full sm:w-64 sm:shrink-0"><ProgressMeters hud={hud}/></div>
      <div className="flex h-10 items-center justify-center" aria-live="polite">
        {flash && <span className="-rotate-2 rounded-lg bg-amber-300 px-4 py-1 text-center text-base font-black text-slate-950 shadow-[5px_5px_0_#ea580c] sm:text-lg">{flash}</span>}
      </div>
      <div className="flex items-center gap-3">
        <DeployButton hud={hud} input={input}/>
        <SpecialButton hud={hud} input={input}/>
      </div>
    </div>
  </footer>;
}