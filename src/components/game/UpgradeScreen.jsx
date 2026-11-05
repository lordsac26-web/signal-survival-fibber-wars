import { useEffect, useMemo } from 'react';
import { upgradeChoices } from '@/game/progression/upgradeRules';
import { levelRerollCost } from '@/game/shop/economy';
import { itemBudgetUsed } from '@/game/progression/runRules';
import { tierInfo } from '@/game/items/tiers';
import GameButton from '@/components/game/GameButton';
import ItemStats from '@/components/game/ItemStats';
import ToolIcon from '@/components/game/ToolIcon';
export default function UpgradeScreen({run,onPick,onReroll,onSkip}){
  const choices=useMemo(()=>upgradeChoices(run),[run.seed,run.level,run.luck,run.character.id,run.levelRerolls]);
  const cost=levelRerollCost(run.wave,run.levelRerolls||0);
  const affordable=(run.signal||0)>=cost;
  const fullKit=run.character.id==='engineer'&&itemBudgetUsed(run)>=4;
  // Keyboard accessibility: R rerolls when affordable (touch uses the button).
  useEffect(()=>{const key=e=>{if((e.key==='r'||e.key==='R')&&!e.repeat&&affordable&&onReroll){e.preventDefault();onReroll()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[affordable,onReroll]);
  return <main className="game-grid flex min-h-screen items-center justify-center p-5 text-white"><section className="w-full max-w-4xl"><div className="text-center"><p className="font-black uppercase tracking-[.3em] text-cyan-200">Signal Acquired</p><h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl md:text-5xl">Choose an Upgrade</h1><p className="mt-2 text-slate-300">Procedurally approved professional development.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{choices.map(u=><button key={u.id} onClick={()=>onPick(u)} className="min-h-44 cursor-pointer rounded-3xl border-2 bg-slate-900/90 p-5 text-left sm:min-h-60 sm:p-6 hover:bg-slate-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/60" style={{borderColor:tierInfo(u.rarity).color}}><ToolIcon item={u} size={56}/><div className="mt-4 text-xs font-black uppercase" style={{color:tierInfo(u.rarity).color}}>{tierInfo(u.rarity).label}</div><h2 className="mt-1 text-2xl font-black text-white">{u.name}</h2><div className="mt-3"><ItemStats item={u} run={run} incoming/></div></button>)}</div>
  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
    <GameButton tone="dark" disabled={!affordable} onClick={onReroll} title="Replace all three options (desktop: R)">Reroll choices • {cost} Signal</GameButton>
    {fullKit&&onSkip&&<GameButton tone="dark" onClick={onSkip}>Kit is full — decline the upgrade</GameButton>}
  </div>
  <p className="mt-2 text-center text-xs text-slate-400">Rerolling replaces all three options and never repeats the current set.</p></section></main>}