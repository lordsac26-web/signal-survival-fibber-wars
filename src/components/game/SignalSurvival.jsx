import { useEffect } from 'react';
import useProfile from '@/game/progression/useProfile';
import useSoloSession from '@/game/progression/useSoloSession';
import SaveStatus from '@/components/game/SaveStatus';
import MenuScreen from '@/components/game/MenuScreen';
import CharacterSelect from '@/components/game/CharacterSelect';
import GameArena from '@/components/game/GameArena';
import UpgradeScreen from '@/components/game/UpgradeScreen';
import ShopScreen from '@/components/game/ShopScreen';
import SummaryScreen from '@/components/game/SummaryScreen';
import GalleryScreen from '@/components/game/GalleryScreen';
export default function SignalSurvival({ownerId}) {
  const state=useProfile(ownerId),s=useSoloSession(state.profile);
  useEffect(()=>{if(state.conflict)s.navigate('menu')},[state.conflict]);
  if(state.ownerId!==ownerId || state.status==='loading')return <main className="game-grid min-h-screen p-8 text-game-ink" role="status">Loading your player profile…</main>;
  if(state.conflict)return <main className="game-grid min-h-screen p-8 text-game-ink"><div className="mx-auto max-w-2xl"><SaveStatus state={state}/></div></main>;
  let content;
  if(s.screen==='menu')content=<MenuScreen save={state.profile} onPlay={s.newRun} onContinue={s.resume} onGallery={()=>s.navigate('gallery')}/>;
  else if(s.screen==='gallery')content=<GalleryScreen save={state.profile} onBack={()=>s.navigate('menu')}/>;
  else if(s.screen==='select')content=<CharacterSelect save={state.profile} onBack={()=>s.navigate('menu')} onSelect={s.start}/>;
  else if(s.screen==='game')content=<GameArena key={`${s.run.runId}-${s.run.wave}`} run={s.run} onFinish={s.finish}/>;
  else if(s.screen==='upgrade')content=<UpgradeScreen key={`${s.run.wave}-${s.run.level}`} run={s.run} onPick={s.upgrade}/>;
  else if(s.screen==='shop')content=<ShopScreen run={s.run} onAction={s.shopAction} onContinue={s.nextWave} onProfile={()=>s.navigate('menu')}/>;
  else content=<SummaryScreen run={s.run} newUnlocks={s.newUnlocks} onMenu={()=>s.navigate('menu')} onRetry={()=>s.navigate('select')}/>;
  return <>{s.screen!=='game' && <div className="bg-game-bg px-5 pt-3 text-game-ink"><div className="mx-auto max-w-6xl"><SaveStatus state={state}/></div></div>}{content}</>;
}