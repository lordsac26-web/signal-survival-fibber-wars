import InventoryItemCard from '@/components/game/InventoryItemCard';
import IntermissionStats from '@/components/game/IntermissionStats';
import SellPanel from '@/components/game/SellPanel';

import IntermissionStatsControl from '@/components/game/IntermissionStatsControl';

export default function IntermissionInventory({run,onCombine,onSell}) {
  return <section className="mt-8">
    <h2 className="font-heading text-2xl font-bold">Your field kit</h2>
    <p className="mt-2 text-sm text-game-muted">{run.character.name} • {run.weapons.length}/{run.character.slots} slots • {run.character.restriction} tools • Character is fixed for this run.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{run.weapons.map(item=><InventoryItemCard key={item.id} item={item} run={run} onCombine={onCombine}/>)}</div>
    <details open className="mt-4 rounded-xl bg-game-panel p-4"><summary className="min-h-11 cursor-pointer font-bold">Passive inventory and level-up gear ({run.items.length})</summary>
      {!run.items.length && <p className="text-sm text-game-muted">No passive gear yet.</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{run.items.map(item=><InventoryItemCard key={item.id} item={item} run={run} onCombine={onCombine}/>)}</div>
    </details>
    <details open className="mt-4 rounded-xl bg-game-panel p-4"><summary className="min-h-11 cursor-pointer font-bold">Deployables ({(run.deployables || []).length})</summary>
      {!(run.deployables || []).length && <p className="text-sm text-game-muted">No deployables yet.</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{(run.deployables || []).map(item=><InventoryItemCard key={item.id} item={item} run={run} onCombine={onCombine}/>)}</div>
    </details>
    <div className="mt-4 rounded-xl border border-game-warm/30 bg-game-panel p-4"><b>{run.character.special.name} • E / touch • {Math.ceil(run.specialCooldown || 0)}s remaining / {run.character.special.cooldown}s cooldown</b><p className="mt-2 text-sm text-game-muted">{run.character.special.desc}</p></div>
    <IntermissionStatsControl run={run}/><IntermissionStats run={run}/>
    <SellPanel run={run} onSell={onSell}/>
  </section>;
}