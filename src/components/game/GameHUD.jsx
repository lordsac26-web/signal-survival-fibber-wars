import { RadioTower, Skull, Timer, Gauge, ClipboardList } from 'lucide-react';
import { WEAPONS } from '@/game/data/combat';
import ProgressMeters from '@/components/game/ProgressMeters';

const weapon = value => typeof value === 'string' ? WEAPONS[value] : value;

// NEW: onOpenStats is optional (defaults to undefined) so this component
// doesn't break if some other screen ever reuses GameHUD without wiring it up.
export default function GameHUD({ hud, wave, weapons, slots = 6, onOpenStats, onSelectDeploy }) {
  const hp = Math.max(0, hud.hp || 0);
  const max = hud.maxHp || 1;
  return <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 text-white sm:p-5">
    <div className="mx-auto flex max-w-6xl items-start justify-between gap-2">
      <div className="w-36 sm:w-60">
        <div className="mb-1 flex justify-between text-xs font-black uppercase"><span>Jacket Integrity</span><span>{Math.ceil(hp)}/{max}</span></div>
        <div className="h-5 overflow-hidden rounded-md border-2 border-slate-950 bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-[width] duration-200" style={{width:`${hp/max*100}%`}}/></div>
        <div className="mt-1 hidden text-xs font-bold text-slate-300 sm:block">{hud.specialUnlocked ? `${hud.specialName} ready on E` : 'Special locked'}</div>
      </div>
      <div className="rounded-xl border-2 border-cyan-200 bg-slate-950/85 px-4 py-2 text-center">
        <div className="text-xs font-black uppercase tracking-widest text-cyan-200">Wave {wave}</div>
        <div className="flex items-center gap-2 text-2xl font-black tabular-nums"><Timer className="size-5"/>{Math.ceil(hud.time||0)}s</div>
      </div>
      <div className="flex items-start gap-2">
        <div className="space-y-1 rounded-xl bg-slate-950/75 px-3 py-2 text-sm font-black">
          <div className="flex gap-2 text-cyan-200"><RadioTower className="size-4"/>{Math.round(hud.signal||0)} <span className="sr-only">spendable Signal</span></div>
          <div className="flex gap-2 text-rose-300"><Skull className="size-4"/>{hud.kills||0}</div>
          {hud.stress && <div className="flex gap-2 text-amber-300"><Gauge className="size-4"/>{hud.fps} FPS</div>}
        </div>
        {/* NEW: the parent HUD wrapper above is `pointer-events-none` (so it
            never blocks clicks/taps meant for the game underneath), which
            means this button needs `pointer-events-auto` explicitly or it
            would be visible but unclickable — a classic "why won't this
            button click" gotcha with overlay HUDs. */}
        {onOpenStats && (
          <button
            onClick={onOpenStats}
            title="View stats (Esc)"
            className="pointer-events-auto flex size-11 items-center justify-center rounded-xl border-2 border-cyan-200 bg-slate-950/85 text-cyan-200 hover:bg-slate-900"
          >
            <ClipboardList className="size-5"/>
          </button>
        )}
      </div>
    </div>
    <div className="mt-3 flex justify-center gap-1">{Array.from({length:Math.max(slots,weapons.length)},(_,i)=>{const w=weapon(weapons[i]);return <div key={i} className="flex size-10 items-center justify-center rounded-lg border-2 border-white/20 bg-slate-950/75 text-xl" title={w?.name||'Empty tool slot'}>{w?.icon||'·'}</div>})}</div>
    <ProgressMeters hud={hud}/>
    {/* Deployable bar: structure counter (deployed/permit cap) + one slot per
        owned deployable with its cooldown + stack level. Clicking a slot
        selects it (the HUD wrapper is pointer-events-none, so slots need
        pointer-events-auto like the stats button above). */}
    {hud.deploy?.items?.length > 0 && (
      <div className="mt-1 flex items-center justify-center gap-1">
        <span className="rounded-md border-2 border-white/20 bg-slate-950/75 px-2 py-1 text-xs font-black text-amber-200" title="Structures deployed / permit cap">🧱 {hud.deploy.structures}/{hud.deploy.cap}</span>
        {hud.deploy.items.map((d, i) => (
          <button
            key={i}
            onClick={() => onSelectDeploy?.(i)}
            title={`${d.name} — place with Q (C to switch)`}
            className={`pointer-events-auto relative flex size-10 cursor-pointer items-center justify-center rounded-lg border-2 text-xl ${d.selected ? 'border-amber-300 bg-slate-900' : 'border-white/20 bg-slate-950/75'}`}
          >
            {d.icon}
            {d.stacks > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-300 px-1 text-[10px] font-black text-slate-950">{d.stacks}</span>}
            {d.cd > 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md text-xs font-black tabular-nums text-white" style={{ background: `conic-gradient(rgba(2,6,23,.8) ${(d.cd / d.cdMax) * 360}deg, rgba(2,6,23,.35) 0deg)` }}>
                {Math.ceil(d.cd)}
              </span>
            )}
          </button>
        ))}
        <span className="ml-1 hidden text-xs font-black uppercase text-cyan-100/70 sm:block">Q</span>
      </div>
    )}
  </div>;
}