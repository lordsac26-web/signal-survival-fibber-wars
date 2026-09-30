export default function ProgressMeters({hud}) {
  const target=hud.xpTarget || 1,value=hud.xp || 0;
  return <div className="mx-auto mt-2 max-w-sm rounded-lg bg-game-panel/90 px-3 py-2 text-xs font-bold text-game-ink"><div className="flex flex-wrap justify-between gap-2"><span>XP {value.toFixed(1)} / {target} • L{hud.level || 0}</span><span>Earned Signal {Math.round(hud.earnedSignal || 0)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-game-bg"><div className="h-full bg-game-signal" style={{width:`${Math.min(100,value/target*100)}%`}}/></div></div>;
}