import { useState } from 'react';
import ToolIcon from '@/components/game/ToolIcon';
import GameButton from '@/components/game/GameButton';
import { tierInfo } from '@/game/items/tiers';
import { sellValue } from '@/game/shop/selling';

// Docked sell window for the intermission inventory: every sellable owned
// item with icon, name, tier and its live sell price (half the current shop
// value, floored to 1). One tap selects, Sell arms a confirm, the second tap
// harvests the Signal and frees the slot. The last remaining tool is listed
// but protected. Scrollable and touch-sized so it never overlaps the HUD.
export default function SellPanel({ run, onSell }) {
  const [selectedId, setSelectedId] = useState(null);
  const [armed, setArmed] = useState(false);
  const rows = [...run.weapons, ...run.items, ...(run.deployables || [])].map(item => ({
    item,
    value: sellValue(item, run.wave),
    protectedTool: item.baseId && run.weapons.length <= 1
  }));
  const selected = rows.find(r => r.item.id === selectedId && r.value != null && !r.protectedTool);
  const confirm = () => { if (!selected) return; onSell(selected.item.id); setArmed(false); setSelectedId(null); };
  return <section className="mt-4 rounded-xl bg-game-panel p-4" aria-label="Sell from the inventory">
    <h3 className="font-bold">Sell from the van <span className="text-game-muted">• half the current shop value</span></h3>
    {!rows.length ? <p className="mt-2 text-sm text-game-muted">Nothing to sell yet.</p> : (
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {rows.map(({ item, value, protectedTool }) => {
          const locked = value == null || protectedTool;
          return <button key={item.id} disabled={locked} onClick={() => { setSelectedId(item.id); setArmed(false); }}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border p-2 text-left ${selectedId === item.id ? 'border-game-signal bg-slate-900' : 'border-white/10 bg-slate-950/60'} ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <span className="flex min-w-0 items-center gap-2">
              <ToolIcon item={item} size={24}/>
              <span className="min-w-0">
                <b className="block truncate text-sm">{item.name}</b>
                <span className="text-xs" style={{ color: tierInfo(item.rarity).color }}>{tierInfo(item.rarity).label}{item.baseId ? ' tool' : item.deploy ? ' deployable' : ' passive'}</span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-black text-game-signal">{locked ? (value == null ? 'Not sellable' : 'Last tool — protected') : `+${value}`}</span>
          </button>;
        })}
      </div>
    )}
    {selected && <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-game-muted">Selected: {selected.item.name} for {selected.value} Signal</span>
      <GameButton tone="dark" onClick={() => (armed ? confirm() : setArmed(true))}>{armed ? `Confirm — sell for ${selected.value}` : `Sell ${selected.item.name}`}</GameButton>
      {armed && <GameButton tone="dark" onClick={() => setArmed(false)}>Cancel</GameButton>}
    </div>}
  </section>;
}