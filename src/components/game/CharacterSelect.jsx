import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { CHARACTERS, WEAPONS } from '@/game/signalData';
import GameButton from '@/components/game/GameButton';

export default function CharacterSelect({ save, onBack, onSelect }) {
  return <main className="game-grid min-h-screen p-5 text-white sm:p-10"><div className="mx-auto max-w-4xl">
    <button onClick={onBack} className="mb-8 flex min-h-11 cursor-pointer items-center gap-2 font-bold text-cyan-100 hover:text-white"><ArrowLeft/> Back to Break Room</button>
    <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Choose Your <span className="text-cyan-300">Technician</span></h1>
    <p className="mt-2 text-lg text-slate-300">Who clocked in for this nonsense?</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">{CHARACTERS.map(c=>{const open=save.unlocked.includes(c.id);return <article key={c.id} className={`relative overflow-hidden rounded-3xl border-2 p-6 ${open?'border-cyan-300/40 bg-slate-900/80':'border-white/10 bg-slate-950/70 opacity-70'}`}>
      <div className="mb-5 flex items-center gap-4"><div className="relative size-20 rounded-full border-4 border-slate-800" style={{background:c.vest}}><div className="absolute -top-2 left-2 h-6 w-14 rounded-t-full" style={{background:c.color}}/></div><div><h2 className="text-2xl font-black">{c.name}</h2><p className="font-bold text-cyan-200">{c.tag}</p></div></div>
      <p className="min-h-12 text-slate-300">{c.blurb}</p><div className="my-5 rounded-xl bg-slate-950/60 p-3 font-bold text-amber-200">Starts with: {WEAPONS[c.start[0]].name}</div>
      {open?<GameButton onClick={()=>onSelect(c)} className="w-full">Clock In</GameButton>:<div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-800 font-black uppercase"><LockKeyhole className="size-5"/>{c.unlock}</div>}
    </article>})}</div>
  </div></main>
}