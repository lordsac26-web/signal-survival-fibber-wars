import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
const LINKS=[['Solo','/player'],['Multiplayer','/multiplayer'],['Field Guide','/field-guide'],['Settings','/settings']];
export default function SiteNav() {
  const {isAuthenticated}=useAuth();
  return <nav aria-label="Main navigation" className="border-b border-game-signal/20 bg-game-bg"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 py-4 text-game-ink">
    <Link to="/" className="font-display text-base font-bold sm:text-lg">MHF <span className="text-game-signal">/ FIBBER WARS</span></Link>
    <div className="flex flex-wrap gap-2 text-sm font-bold">{LINKS.map(([name,path])=>
      <NavLink key={path} to={path} className={({isActive})=>`flex min-h-11 items-center rounded-lg px-3 transition-colors duration-200 focus-visible:outline focus-visible:outline-game-signal ${isActive?'bg-game-signal text-game-bg':'text-game-ink hover:bg-game-signal/15 hover:text-white'}`}>{name}</NavLink>)}
      <Link className="flex min-h-11 items-center rounded-lg border border-game-signal/60 bg-game-panel px-3 text-game-ink transition-colors duration-200 hover:border-game-signal hover:bg-game-signal/15 focus-visible:outline focus-visible:outline-game-signal" to={isAuthenticated?'/player':'/login?returnTo=%2Fplayer'}>{isAuthenticated?'My profile':'Sign in'}</Link>
    </div></div></nav>;
}