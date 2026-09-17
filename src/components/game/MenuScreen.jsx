import { RadioTower, Trophy, Wrench } from 'lucide-react';
import GameButton from '@/components/game/GameButton';
import Logo from '@/components/game/Logo';

export default function MenuScreen({ save, onPlay, onGallery }) {
  return <main className="game-grid flex min-h-screen items-center justify-center overflow-hidden p-5 text-white">
    <section className="relative z-10 w-full max-w-2xl text-center">
      <Logo />
      <p className="mx-auto mt-8 max-w-md text-pretty text-lg font-semibold leading-relaxed text-slate-200">The job site has gone feral. Grab your tools, restore the Signal, and try not to violate the bend radius.</p>
      <div className="mx-auto mt-8 grid max-w-md gap-4 sm:grid-cols-2">
        <GameButton onClick={onPlay} className="sm:col-span-2"><RadioTower className="mr-2 inline size-5"/>Start Shift</GameButton>
        <GameButton tone="dark" onClick={onGallery}><Wrench className="mr-2 inline size-5"/>Unlocks</GameButton>
        <div className="flex min-h-12 items-center justify-center rounded-xl border-2 border-white/10 bg-slate-950/40 px-4 font-bold text-slate-200"><Trophy className="mr-2 size-5 text-amber-300"/>Best: Wave {save.highWave}</div>
      </div>
      <p className="mt-9 text-sm font-bold uppercase tracking-widest text-cyan-100/70">Move: WASD / Arrow Keys / Touch</p>
    </section>
  </main>
}