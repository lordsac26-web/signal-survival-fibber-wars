import { Radio, Flag, LogOut, Play } from 'lucide-react';

export default function CoopHudBanner({ roomId, coop, onPing, onLeave, onForceNextWave }) {
  if (!roomId || !coop?.room) return null;
  const phase = coop.room.phase;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-game-signal/25 bg-slate-950/95 px-4 py-1.5 text-xs text-game-ink">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
          <Radio className="size-3.5" /> Co-Op Wave {coop.room.wave || 1} ({phase})
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {coop.users.map((u) => {
            const pct = Math.max(0, Math.min(100, Math.round(((u.hp || 0) / Math.max(1, u.maxHp || 100)) * 100)));
            const statusTag =
              phase === 'loadout'
                ? u.kitConfirmed
                  ? '✓ Kit'
                  : 'Picking…'
                : phase === 'intermission'
                ? u.intermissionReady
                  ? '✓ Ready'
                  : 'In Van…'
                : `${pct}% HP`;
            return (
              <span
                key={u.seat}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 ${
                  u.seat === coop.seat
                    ? 'border-game-signal bg-game-panel font-bold'
                    : 'border-white/10 bg-game-bg/80'
                }`}
              >
                <span className="text-game-signal">P{u.seat}</span>
                <span className="max-w-20 truncate">{u.name}</span>
                <span className={u.alive === false ? 'text-rose-400' : 'text-amber-200'}>{statusTag}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {phase === 'combat' && onPing && (
          <button
            type="button"
            onClick={onPing}
            className="inline-flex min-h-7 items-center gap-1 rounded-md border border-game-signal/40 bg-game-panel px-2.5 font-bold text-game-signal hover:bg-game-signal/15"
          >
            <Flag className="size-3" /> Ping (G)
          </button>
        )}
        {phase === 'intermission' && coop.isHost && onForceNextWave && (
          <button
            type="button"
            onClick={onForceNextWave}
            className="inline-flex min-h-7 items-center gap-1 rounded-md bg-game-warm px-2.5 font-bold text-game-bg"
          >
            <Play className="size-3 fill-current" /> Force Next Wave
          </button>
        )}
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex min-h-7 items-center gap-1 rounded-md border border-rose-400/30 px-2 text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="size-3" /> Exit Co-Op
          </button>
        )}
      </div>
    </div>
  );
}