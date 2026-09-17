import { RadioTower, Skull, Timer } from 'lucide-react';
import { WEAPONS } from '@/game/signalData';

export default function GameHUD({ hud, wave, weapons }) {
  const hp=Math.max(0,hud.hp||0), max=hud.maxHp||1;
  return <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 text-white sm:p-5">
    <div className="mx-auto flex max-w-6xl items-start justify-between gap-2">
      <div className="w-36 sm:w-60"><div className="mb-1 flex justify-between text-xs font-black uppercase"><span>Jacket Integrity</span><span>{Math.ceil(hp)}/{max}</span></div><div className="h-5 overflow-hidden rounded-md border-2 border-slate-950 bg-slate-900"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-[width] duration-200" style={{width:`${hp/max*100}%`}}/></div></div>
      <div className="rounded-xl border-2 border-cyan-200 bg-slate-950/85 px-4 py-2 text-center shadow-lg"><div className="text-xs font-black uppercase tracking-widest text-cyan-200">Wave {wave}</div><div className="flex items-center gap-2 text-2xl font-black tabular-nums"><Timer className="size-5"/>{Math.ceil(hud.time||0)}s</div></div>
      <div className="space-y-1 rounded-xl bg-slate-950/75 px-3 py-2 text-sm font-black"><div className="flex gap-2 text-cyan-200"><RadioTower className="size-4"/>{hud.signal||0}</div><div className="flex gap-2 text-rose-300"><Skull className="size-4"/>{hud.kills||0}</div></div>
    </div>
    <div className="mt-3 flex justify-center gap-1">{Array.from({length:6},(_,i)=><div key={i} className="flex size-10 items-center justify-center rounded-lg border-2 border-white/20 bg-slate-950/75 text-xl" title={weapons[i]?WEAPONS[weapons[i]].name:'Empty tool slot'}>{weapons[i]?WEAPONS[weapons[i]].icon:'·'}</div>)}</div>
  </div>
}