import { useState } from 'react';
import ItemStats from '@/components/game/ItemStats';
import { TIERS } from '@/game/items/tiers';
import { scaleItem } from '@/game/items/itemScaling';
export default function GuideItemDetails({item}){
  const [tier,setTier]=useState('common'),preview=scaleItem(item,tier);
  return <div className="mt-3 space-y-3">
    <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-game-muted">Preview tier
      <select value={tier} onChange={event=>setTier(event.target.value)} className="min-h-11 rounded-lg border border-game-signal/30 bg-game-bg px-3 text-game-ink">{Object.entries(TIERS).map(([id,info])=><option key={id} value={id}>{info.label}</option>)}</select>
    </label>
    <ItemStats item={preview}/>
    {!item.baseId && !item.deploy && <p className="text-xs text-game-muted">Illustrative seeded roll. Actual passive bonuses and effects are generated on acquisition; identity always follows the name.</p>}
  </div>;
}