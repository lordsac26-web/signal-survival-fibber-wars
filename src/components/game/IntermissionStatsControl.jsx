import { useEffect, useState } from 'react';
import StatsScreen from '@/components/game/StatsScreen';
export default function IntermissionStatsControl({run}){
  const [show,setShow]=useState(false);
  useEffect(()=>{const key=e=>{if(e.repeat || e.target.closest?.('[role="dialog"]'))return;if(e.key==='Tab'){e.preventDefault();setShow(v=>!v)}else if(e.key==='Escape')setShow(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
  return <><button className="mt-4 min-h-11 rounded-xl border border-game-signal/40 bg-game-panel px-4 font-bold" onClick={()=>setShow(true)}>Open stats panel • Tab</button>{show && <StatsScreen run={run} onClose={()=>setShow(false)}/>}</>;
}