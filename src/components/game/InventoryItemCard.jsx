import ToolIcon from '@/components/game/ToolIcon';
import ItemStats from '@/components/game/ItemStats';
import { matchingItems } from '@/game/items/tiers';
export default function InventoryItemCard({item,run,onCombine}){
  const pair=matchingItems(run,item).length>=2;
  return <article className="rounded-xl border border-game-signal/20 bg-game-panel p-4">
    <div className="flex items-center gap-2"><ToolIcon item={item} size={34}/><b>{item.name}</b></div>
    <div className="mt-2"><ItemStats item={item} run={run}/></div>
    {item.baseId && (item.overclockRank || 0)>0 && <p className="mt-2 text-xs text-game-muted">Premium tune-ups: {item.overclockRank}/{run.character.id==='clone'?3:2} (separate from tier)</p>}
    {item.deploy && <p className="mt-2 text-xs text-game-muted">Q placement • {Math.ceil(run.deployCds?.[item.structure] || 0)}s cooldown remaining{item.stacks>1?` • preserved legacy rank ${item.stacks}`:''}</p>}
    {pair && onCombine && <button onClick={()=>onCombine(item.id)} className="mt-3 min-h-11 w-full rounded-lg border border-game-signal px-3 font-bold text-game-signal">Combine matching pair</button>}
  </article>;
}