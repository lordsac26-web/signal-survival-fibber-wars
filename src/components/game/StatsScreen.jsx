import { X } from 'lucide-react';
import GameButton from '@/components/game/GameButton';
import { STAT_INFO, formatStat, statBreakdown } from '@/game/data/stats';
import { DESIGNATIONS } from '@/game/data/generation';
import { effectiveRange, rangeLabel } from '@/game/combat/effectiveRange';

// The in-run character panel (Esc / Tab / clipboard button). Every row shows
// the CURRENT value, a plain-language description of what the stat does, and —
// once items have modified it — a breakdown of base character stat vs. what
// tools added. All labels/descriptions live in data/stats.js.
const SECTIONS = [
  { title: 'Combat', keys: ['damage', 'attackSpeed', 'crit', 'range', 'knockback', 'pierce', 'lifeSteal', 'instakill'] },
  { title: 'Survival', keys: ['maxHp', 'regen', 'armor', 'dodge', 'speed'] },
  { title: 'Fieldwork', keys: ['harvesting', 'engineering', 'cleanliness', 'signalStrength', 'spliceQuality', 'luck'] }
];

export default function StatsScreen({ run, onClose }) {
  const c = run.character;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/92 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black uppercase tracking-[.3em] text-amber-300">Paused • Wave {run.wave}</p>
            <h1 className="text-3xl font-black uppercase sm:text-4xl" style={{ color: c.color }}>{c.name}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">{c.tag}</p>
          </div>
          <button onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-white/20 bg-slate-900 p-2 hover:bg-slate-800" title="Resume (Esc / Tab)">
            <X className="size-6" />
          </button>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SECTIONS.map(section => (
            <div key={section.title} className="rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4">
              <h2 className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">{section.title}</h2>
              <dl className="mt-3 space-y-3">
                {section.keys.map(key => {
                  const info = STAT_INFO[key];
                  // character-specific stats (e.g. Veteran's Instakill) only
                  // show when the run actually has them
                  if (key === 'instakill' && !(run.instakill || c.stats.instakill)) return null;
                  const bd = statBreakdown(run, key);
                  return (
                    <div key={key} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-sm font-semibold text-slate-200" title={info.desc}>{info.label}</dt>
                        <dd className="font-black tabular-nums text-white">{formatStat(info.kind, run[key])}</dd>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-400">{info.desc}</p>
                      <p className="text-[11px] font-bold text-cyan-200/80">{bd.text}</p>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Current Loadout</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {run.weapons.map((w, i) => (
              <div key={w.id || i} className="flex items-center gap-3 rounded-xl border-2 border-white/10 bg-slate-800/70 p-3">
                <span className="text-2xl">{w.icon}</span>
                <span>
                  <span className="block font-black leading-tight">{w.name}</span>
                  <span className="block text-xs text-slate-400">{w.rarity} • {Math.round(w.damage)} dmg • {w.rate}s cooldown • {run.viewport?rangeLabel(effectiveRange(w,run,run.viewport),run.viewport):`${w.range} reach rating (viewport scaled)`} • {DESIGNATIONS[w.pattern] || w.slotType}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4 text-sm font-semibold text-slate-300">
          <p><span className="font-black text-white">Passive — </span>{c.passive}</p>
          <p className="mt-1"><span className="font-black text-white">{c.special.name} — </span>{c.special.desc}</p>
          <p className="mt-1 font-bold text-cyan-200">
            Granted on selection • E / touch • {Math.ceil(run.specialCooldown || 0)}s remaining / {c.special.cooldown}s cooldown
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <GameButton onClick={onClose}>Back to it</GameButton>
        </div>
      </div>
    </div>
  );
}