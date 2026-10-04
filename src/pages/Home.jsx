import { Link } from 'react-router-dom';
import SiteNav from '@/components/game/SiteNav';
import Logo from '@/components/game/Logo';
import { Image } from '@/components/ui/image';
export default function Home(){
  return <main className="min-h-screen font-body text-game-ink"><SiteNav/>
    <section className="relative overflow-hidden border-b border-game-signal/20">
      <Image src="/assets/landing/hero.jpg" alt="Painted dusk scene at the fault site: the crane and bucket-truck turret, Dispatch Don, a dirty-connector blob and the squirrel boss" fittingType="fill" className="absolute inset-0 h-full w-full"/>
      {/* Dark gradient overlay: keeps the title and buttons legible over the bright dusk sky at every crop. */}
      <div className="absolute inset-0 bg-gradient-to-t from-game-bg via-game-bg/70 to-game-bg/20"/>
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-16 text-center sm:py-20 lg:py-24">
        <Logo/>
        <p className="mt-8 max-w-lg text-xl leading-relaxed text-game-ink/90">The job site has gone feral. Dispatch says it’s a quick fix. Dispatch is fibbing.</p>
        <p className="mt-4 font-bold text-game-signal">Eleven characters. One van. Absolutely no sensible bend radius.</p>
        <div className="mt-8 grid w-full gap-3 sm:grid-cols-2"><Link to="/player" className="flex min-h-14 items-center justify-center rounded-xl border-2 border-game-signal bg-game-signal px-5 font-black uppercase text-game-bg">Clock in • Solo</Link><Link to="/multiplayer" className="flex min-h-14 items-center justify-center rounded-xl border-2 border-game-warm/50 bg-game-panel px-5 font-black uppercase text-game-warm">Multiplayer lobby</Link><Link to="/field-guide" className="flex min-h-12 items-center justify-center rounded-xl border border-game-signal/30 bg-game-bg/60 px-5 font-bold">How to Play / Field Guide</Link><Link to="/settings" className="flex min-h-12 items-center justify-center rounded-xl border border-game-signal/30 bg-game-bg/60 px-5 font-bold">Settings</Link></div>
        <p className="mt-5 text-sm text-game-ink/70">Read the guide without signing in. Sign in when you enter your player profile. No paywall.</p>
      </div>
    </section>
    <div className="game-grid pb-12 pt-6"><footer className="mx-auto max-w-6xl px-5 text-center text-sm text-game-muted">Mid-Hudson Fibber: We found the fault. It was probably in the paperwork.</footer></div>
  </main>;
}