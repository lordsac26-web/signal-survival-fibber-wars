import { ArrowLeft, CheckCircle2, LockKeyhole, RadioTower } from 'lucide-react';
import { CHARACTERS } from '@/game/data/characters';
import { WEAPON_ARCHETYPES } from '@/game/data/generation';
import { CHALLENGES, ACHIEVEMENTS, LOADOUTS } from '@/game/data/unlocks';

function Bar({ value, goal }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${Math.min(100, goal ? (value / goal) * 100 : 0)}%` }} />
      </div>
      <div className="mt-1 text-right text-xs font-black tabular-nums text-cyan-200">{value}/{goal}</div>
    </div>
  );
}

export default function GalleryScreen({ save, onBack }) {
  return (
    <main className="game-grid min-h-screen p-5 text-white sm:p-10">
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="mb-7 flex min-h-11 cursor-pointer items-center gap-2 font-bold text-cyan-100 hover:text-white"><ArrowLeft /> Break Room</button>
        <h1 className="text-4xl font-black uppercase">Field Manual</h1>
        <p className="mt-2 text-slate-300">
          {(save.unlocked || []).length}/{CHARACTERS.length} technicians • {save.totalKills || 0} career repairs • {save.runs || 0} shifts • best haul {save.bestSignal || 0} Signal • {save.deaths || 0} truck rolls
        </p>

        <h2 className="mt-9 text-xl font-black uppercase text-cyan-200">Technicians</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHARACTERS.map(c => {
            const done = (save.unlocked || []).includes(c.id) || c.id === 'rookie';
            const ch = CHALLENGES.find(x => x.id === c.id);
            return (
              <div key={c.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center gap-3">
                  {done ? <RadioTower className="shrink-0 text-cyan-300" /> : <LockKeyhole className="shrink-0 text-slate-500" />}
                  <div><b>{c.name}</b><p className="text-sm text-slate-400">{done ? `${c.passive} • ${c.special.name}` : ch.desc}</p></div>
                </div>
                {!done && <div className="mt-3"><Bar value={ch.progress(save)} goal={ch.goal} /></div>}
              </div>
            );
          })}
        </div>

        <h2 className="mt-9 text-xl font-black uppercase text-amber-200">Starting Toolkits</h2>
        <p className="mt-1 text-sm text-slate-400">Career milestones unlock alternate starting loadouts — pick them on the character select screen.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LOADOUTS.map(l => {
            const done = (save.loadouts || []).includes(l.id);
            return (
              <div key={l.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center gap-3">
                  {done ? <CheckCircle2 className="shrink-0 text-emerald-300" /> : <LockKeyhole className="shrink-0 text-slate-500" />}
                  <div><b>{l.charName}</b><p className="text-sm text-slate-400">{l.tools}</p></div>
                </div>
                <p className={`mt-2 text-xs font-bold ${done ? 'text-emerald-300' : 'text-slate-400'}`}>{done ? 'Unlocked' : l.desc}</p>
                {!done && <div className="mt-2"><Bar value={l.progress(save)} goal={l.goal} /></div>}
              </div>
            );
          })}
        </div>

        <h2 className="mt-9 text-xl font-black uppercase text-rose-200">Achievements</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map(a => {
            const done = (save.achievements || []).includes(a.id);
            return (
              <div key={a.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center gap-3">
                  {done ? <CheckCircle2 className="shrink-0 text-emerald-300" /> : <LockKeyhole className="shrink-0 text-slate-500" />}
                  <div><b>{a.name}</b><p className="text-sm text-slate-400">{a.desc}</p></div>
                </div>
                {!done && <div className="mt-2"><Bar value={a.progress(save)} goal={a.goal} /></div>}
              </div>
            );
          })}
        </div>

        <h2 className="mt-9 text-xl font-black uppercase text-amber-200">Generator Archetypes</h2>
        <div className="mt-3 grid gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {WEAPON_ARCHETYPES.map(w => (
            <div key={w[0]} className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
              <span className="mr-3 text-2xl">{w[7]}</span><b>{w[1]}</b>
              <p className="mt-2 text-sm text-slate-400">{w[2]} pattern • Thousands of possible shop names</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}