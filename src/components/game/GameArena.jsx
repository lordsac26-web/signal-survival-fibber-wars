import { useEffect, useRef, useState } from 'react';
import { createSignalEngine } from '@/game/signalEngine';
import GameHUD from '@/components/game/GameHUD';
import TouchControls from '@/components/game/TouchControls';

export default function GameArena({ run, onFinish }) {
  const canvas=useRef(null),input=useRef({x:0,y:0}),[hud,setHud]=useState(run),[flash,setFlash]=useState(''),[shake,setShake]=useState(false);
  useEffect(()=>{const down=e=>{const k=e.key.toLowerCase();if(['arrowup','w'].includes(k))input.current.y=-1;if(['arrowdown','s'].includes(k))input.current.y=1;if(['arrowleft','a'].includes(k))input.current.x=-1;if(['arrowright','d'].includes(k))input.current.x=1;};const up=e=>{const k=e.key.toLowerCase();if(['arrowup','w','arrowdown','s'].includes(k))input.current.y=0;if(['arrowleft','a','arrowright','d'].includes(k))input.current.x=0;};window.addEventListener('keydown',down);window.addEventListener('keyup',up);const clean=createSignalEngine(canvas.current,run,input,{hud:setHud,finish:onFinish,flash:t=>{setFlash(t);setTimeout(()=>setFlash(''),650)},shake:()=>{setShake(true);setTimeout(()=>setShake(false),120)}});return()=>{clean();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};},[]);
  return <main className={`relative h-screen w-screen overflow-hidden bg-slate-950 ${shake?'game-shake':''}`}><canvas ref={canvas} className="h-full w-full"/><GameHUD hud={hud} wave={run.wave} weapons={run.weapons}/><TouchControls input={input}/>{flash&&<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><span className="-rotate-3 rounded-lg bg-amber-300 px-5 py-2 text-2xl font-black text-slate-950 shadow-[5px_5px_0_#ea580c]">{flash}</span></div>}</main>
}