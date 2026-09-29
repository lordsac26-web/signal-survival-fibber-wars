import { useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { CHARACTERS } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { CHALLENGES } from '@/game/data/unlocks';
import GameButton from '@/components/game/GameButton';

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

function KitButton({ active, ...props }) {
  return (
    <button
      {...props}
      className={`min-h-10 cursor-pointer rounded-lg border-2 px-2 text-xs font-black uppercase tracking-wide ${active ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/20 bg-slate-800 text-slate-300 hover:border-cyan-300/60'}`}
    />
  );
}

export default function CharacterSelect({ save, onBack, onSelect }) {
  const [alt, setAlt] = useState({});
  const names = ids => ids.map(id => WEAPONS[id].name).join(' + ');
  return (
    <main className="game-grid min-h-screen p-5 text-white sm:p-10">
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="mb-8 flex min-h-11 cursor-pointer items-center gap-2 font-bold text-cyan-100 hover:text-white"><ArrowLeft /> Back to Break Room</button>
        <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Choose Your <span className="text-cyan-300">Technician</span></h1>
        <p className="mt-2 text-lg text-slate-300">Who clocked in for this nonsense?</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CHARACTERS.map(c => {
            const open = save.unlocked.includes(c.id) || c.id === 'rookie';
            const ch = CHALLENGES.find(x => x.id === c.id);
            const altOk = (save.loadouts || []).includes(`${c.id}:alt`);
            const useAlt = !!alt[c.id] && altOk;
            return (
              <article key={c.id} className={`relative overflow-hidden rounded-3xl border-2 p-6 ${open ? 'border-cyan-300/40 bg-slate-900/80' : 'border-white/10 bg-slate-950/70 opacity-70'}`}>
                <div className="mb-5 flex items-center gap-4">
                  <div className="relative size-20 shrink-0 rounded-full border-4 border-slate-800" style={{ background: c.vest }}>
                    <div className="absolute bottom-3 inset-x-1 h-2" style={{ background: c.belt }} />
                    <div className="absolute -top-2 left-2 h-6 w-14 rounded-t-full" style={{ background: c.color }} />
                  </div>
                  <div><h2 className="text-xl font-black">{c.name}</h2><p className="font-bold text-cyan-200">{c.tag}</p></div>
                </div>
                <p className="min-h-12 text-sm text-slate-300">{c.blurb}</p>
                {open ? (
                  <>
                    <div className="my-4 rounded-xl bg-slate-950/60 p-3 text-sm font-bold text-amber-200">{names(useAlt ? c.altStart : c.start)} • Special: {c.special.name}</div>
                    {altOk && (
                      <div className="mb-4 grid grid-cols-2 gap-2" title={`Alternate kit: ${names(c.altStart)}`}>
                        <KitButton active={!useAlt} onClick={() => setAlt(a => ({ ...a, [c.id]: false }))}>Standard Kit</KitButton>
                        <KitButton active={useAlt} onClick={() => setAlt(a => ({ ...a, [c.id]: true }))}>Alt Kit</KitButton>
                      </div>
                    )}
                    <GameButton onClick={() => onSelect(c, useAlt)} className="w-full">Clock In</GameButton>
                  </>
                ) : (
                  <div className="rounded-xl bg-slate-800 p-3">
                    <div className="flex items-center gap-2 text-sm font-black uppercase"><LockKeyhole className="size-5 shrink-0" />{ch.desc}</div>
                    <div className="mt-2"><Bar value={ch.progress(save)} goal={ch.goal} /></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}