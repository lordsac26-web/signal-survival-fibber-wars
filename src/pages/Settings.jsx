import { useAuth } from '@/lib/AuthContext';
import SiteNav from '@/components/game/SiteNav';
import AudioControls from '@/components/game/AudioControls';
import SaveStatus from '@/components/game/SaveStatus';
import useProfile from '@/game/progression/useProfile';
export default function Settings(){
  const {user}=useAuth(),state=useProfile(user?.id);
  return <main className="game-grid min-h-screen px-5 text-game-ink"><SiteNav/><section className="mx-auto max-w-xl rounded-3xl border border-game-signal/30 bg-game-panel p-5 sm:p-6"><h1 className="font-heading text-2xl font-bold sm:text-3xl">Break-room settings</h1><p className="mt-3 text-game-muted">Procedural audio, no external soundtrack. Signed-in settings travel with your profile; guest settings stay on this device.</p>{user && <div className="mt-4"><SaveStatus state={state}/></div>}{(!user || (state.ownerId===user.id && state.status!=='loading' && !state.conflict)) && <AudioControls key={`${state.ownerId}-${state.revision}`}/>}<p className="mt-5 text-sm text-game-muted">Movement: WASD / arrows / touch joystick. Signature: E / touch button. Rare purchased structures: Q, cycle with C. Stats and pause: Tab / Esc / clipboard.</p></section></main>;
}