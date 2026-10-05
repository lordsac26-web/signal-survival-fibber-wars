// Classic top-center boss life meter. Rendered only while a boss is active —
// the engine publishes hud.boss on every HUD tick (null between boss waves),
// so the bar appears with the boss intro and disappears on death. The parent
// HUD wrapper is pointer-events-none and the bar is compact (h-2.5 on <640px),
// so it never covers the play area or blocks taps.
export default function BossBar({ boss }) {
  if (!boss) return null;
  const pct = Math.max(0, Math.min(100, boss.max ? boss.hp / boss.max * 100 : 0));
  return <div className="mt-2 flex justify-center px-2">
    <div className="w-full max-w-md rounded-lg border-2 border-slate-950 bg-slate-900/90 px-2 py-1">
      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-amber-200 sm:text-xs">
        <span className="truncate">{boss.name}{boss.phase === 2 ? ' • Phase 2' : ''}</span>
        <span className="tabular-nums">{Math.ceil(boss.hp)}/{Math.ceil(boss.max)}</span>
      </div>
      <div className="mt-0.5 h-2.5 overflow-hidden rounded bg-slate-950 sm:h-3">
        <div className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-orange-400 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  </div>;
}