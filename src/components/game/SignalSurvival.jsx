import { useState } from 'react';
import { loadSave, recordRun } from '@/game/storage';
import MenuScreen from '@/components/game/MenuScreen';
import CharacterSelect from '@/components/game/CharacterSelect';
import GameArena from '@/components/game/GameArena';
import UpgradeScreen from '@/components/game/UpgradeScreen';
import ShopScreen from '@/components/game/ShopScreen';
import SummaryScreen from '@/components/game/SummaryScreen';
import GalleryScreen from '@/components/game/GalleryScreen';

export default function SignalSurvival(){
  const [screen,setScreen]=useState('menu'),[save,setSave]=useState(loadSave),[run,setRun]=useState(null),[unlocked,setUnlocked]=useState(false);
  const start=c=>{setRun({character:c,wave:1,level:0,hp:c.stats.maxHp,signal:0,kills:0,xp:0,pendingLevels:0,weapons:[...c.start],...c.stats});setScreen('game')};
  const finish=next=>{setRun(next);if(!next.won){const was=save.unlocked.includes('nomad'),fresh=recordRun(next);setSave(fresh);setUnlocked(!was&&fresh.unlocked.includes('nomad'));setScreen('summary')}else if(next.pendingLevels>0)setScreen('upgrade');else setScreen('shop')};
  const upgrade=u=>{const next=u.apply({...run,level:run.level+1,pendingLevels:run.pendingLevels-1});setRun(next);setScreen(next.pendingLevels>0?'upgrade':'shop')};
  const nextWave=()=>{setRun(r=>({...r,wave:r.wave+1,hp:Math.min(r.maxHp,r.hp+Math.ceil(r.maxHp*.22))}));setScreen('game')};
  if(screen==='menu')return <MenuScreen save={save} onPlay={()=>setScreen('select')} onGallery={()=>setScreen('gallery')}/>;
  if(screen==='gallery')return <GalleryScreen save={save} onBack={()=>setScreen('menu')}/>;
  if(screen==='select')return <CharacterSelect save={save} onBack={()=>setScreen('menu')} onSelect={start}/>;
  if(screen==='game')return <GameArena key={run.wave} run={run} onFinish={finish}/>;
  if(screen==='upgrade')return <UpgradeScreen onPick={upgrade}/>;
  if(screen==='shop')return <ShopScreen run={run} onChange={setRun} onContinue={nextWave}/>;
  return <SummaryScreen run={run} newlyUnlocked={unlocked} onMenu={()=>setScreen('menu')} onRetry={()=>setScreen('select')}/>;
}