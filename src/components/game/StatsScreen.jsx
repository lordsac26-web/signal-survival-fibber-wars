import { X } from 'lucide-react';
import GameButton from '@/components/game/GameButton';

// Which run fields to show and how to format each one. This is the whole
// reason the stats screen was cheap to build: every value referenced here is
// already a plain number sitting on the `run` object — computed once by
// applyMods() in generation.js whenever the player levels up or buys
// something — so this component only has to read and format, never compute.
//
// The three format kinds exist because the underlying numbers aren't all the
// same *kind* of number, even though they're all just floats at runtime:
//   'multiplier' — stored as 1.0 = baseline, e.g. run.damage = 1.15 means
//                  "115% of a weapon's own base damage". applyMods does
//                  n[stat] *= 1 + value for these (see generation.js).
//   'percent'    — stored directly as a 0–1 fraction (run.crit = .08 means
//                  an 8% chance), added rather than multiplied by applyMods.
//   'flat'       — a plain additive number with no implied scale (armor,
//                  regen-per-second, and the four "fieldwork" stats below).
const STAT_SECTIONS = [
  {
    title: 'Combat',
    rows: [
      ['damage', 'Damage', 'multiplier'],
      ['attackSpeed', 'Attack Speed', 'multiplier'],
      ['crit', 'Crit Chance', 'percent'],
      ['range', 'Range', 'multiplier'],
      ['knockback', 'Knockback', 'flat'],
      ['pierce', 'Pierce', 'flat'],
      ['lifeSteal', 'Life Steal', 'percent']
    ]
  },
  {
    title: 'Survival',
    rows: [
      ['maxHp', 'Jacket Integrity', 'flat'],
      ['regen', 'Regen / sec', 'flat'],
      ['armor', 'Armor', 'flat'],
      ['dodge', 'Dodge', 'percent'],
      ['speed', 'Move Speed', 'multiplier']
    ]
  },
  {
    // NOTE FOR FUTURE-YOU (or whoever reads this): as of this writing,
    // harvesting / signalStrength / cleanliness / spliceQuality don't
    // actually change anything in signalEngine.js — they're rolled by loot
    // and displayed on shop items, but nothing reads them back out yet.
    // `engineering` is the one exception: the Bucket-Truck/Dispatch special
    // abilities add it straight onto their damage (see the 'fortify'/'crew'
    // branch in activateSpecial()). Showing the inert ones here is still the
    // right call — an accurate stat sheet beats a curated one — but worth
    // knowing so a "why didn't this number do anything" moment doesn't read
    // as a bug in this screen.
    title: 'Fieldwork',
    rows: [
      ['harvesting', 'Harvesting', 'flat'],
      ['signalStrength', 'Signal Strength', 'flat'],
      ['cleanliness', 'Cleanliness', 'flat'],
      ['spliceQuality', 'Splice Quality', 'flat'],
      ['engineering', 'Engineering', 'flat'],
      ['luck', 'Luck', 'flat']
    ]
  }
];

function formatStat(kind, rawValue) {
  const value = rawValue || 0;
  if (kind === 'multiplier' || kind === 'percent') return `${Math.round(value * 100)}%`;
  return Math.round(value * 10) / 10; // one decimal place is enough for regen etc; whole flat stats just round cleanly
}

export default function StatsScreen({ run, onClose }) {
  const c = run.character;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/92 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black uppercase tracking-[.3em] text-amber-300">Paused • Wave {run.wave}</p>
            <h1 className="text-3xl font-black uppercase sm:text-4xl" style={{ color: c.color }}>{c.name}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">{c.tag}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border-2 border-white/20 bg-slate-900 p-2 hover:bg-slate-800" title="Resume (Esc)">
            <X className="size-6" />
          </button>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STAT_SECTIONS.map(section => (
            <div key={section.title} className="rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4">
              <h2 className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">{section.title}</h2>
              <dl className="mt-3 space-y-2">
                {section.rows.map(([key, label, kind]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <dt className="font-semibold text-slate-300">{label}</dt>
                    <dd className="font-black tabular-nums">{formatStat(kind, run[key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Current Loadout</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {run.weapons.map((w, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border-2 border-white/10 bg-slate-800/70 p-3">
                <span className="text-2xl">{w.icon}</span>
                <span>
                  <span className="block font-black leading-tight">{w.name}</span>
                  <span className="block text-xs text-slate-400">{Math.round(w.damage)} dmg • {w.rate}s cooldown</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-white/10 bg-slate-900/80 p-4 text-sm font-semibold text-slate-300">
          <p><span className="font-black text-white">Passive — </span>{c.passive}</p>
          <p className="mt-1"><span className="font-black text-white">{c.special.name} — </span>{c.special.desc}</p>
        </div>

        <div className="mt-6 flex justify-center">
          <GameButton onClick={onClose}>Back to it</GameButton>
        </div>
      </div>
    </div>
  );
}
