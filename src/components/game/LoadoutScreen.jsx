import { useMemo, useState } from 'react';
import { startingOffers, startingPickCount, canPick, kitComplete } from '@/game/progression/startingKit';
import ItemStats from '@/components/game/ItemStats';
import ToolIcon from '@/components/game/ToolIcon';
import { tierInfo } from '@/game/items/tiers';

// Start-of-run loadout pick: four rolled Basic tools in the shop/upgrade card
// language, shown right after character select and before wave 1. The 30
// Year Veteran picks two; everyone else picks one. The screen never shares
// space with the gameplay canvas — it replaces the view entirely.
export default function LoadoutScreen({ run, onConfirm, onBack }) {
  const { offers, limitedBy } = useMemo(() => startingOffers(run.character, run.seed), [run.character.id, run.seed]);
  const [picked, setPicked] = useState([]);
  const need = startingPickCount(run.character);
  const toggle = id => setPicked(picked.includes(id) ? picked.filter(p => p !== id) : canPick(run.character, offers, picked, id) ? [...picked, id] : picked);
  const ready = kitComplete(run.character, offers, picked);
  const pickedItems = offers.filter(o => picked.includes(o.id));
  return (
    <main className="game-grid min-h-screen p-5 text-game-ink sm:p-10">
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="mb-5 min-h-11 font-bold text-game-signal">← Back to roster</button>
        <h1 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Tool check-out</h1>
        <p className="mt-2 text-game-muted">The truck holds four rolled tools. Choose {need === 2 ? '2 weapons' : '1 weapon'} for {run.character.name} — the rest stays on the shelf.</p>
        {limitedBy && <p className="mt-2 text-game-warm">{run.character.name} only has {offers.length} legal tools on the truck; everything available is shown.</p>}
        <p className="mt-3 text-sm font-bold uppercase tracking-wide text-game-signal" aria-live="polite">{picked.length} / {need} selected</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {offers.map(o => {
            const selected = picked.includes(o.id);
            const selectable = selected || canPick(run.character, offers, picked, o.id);
            return (
              <button key={o.id} type="button" aria-pressed={selected} onClick={() => toggle(o.id)}
                className={`flex min-h-64 flex-col rounded-2xl border-2 bg-game-panel p-5 text-left sm:min-h-72 ${selected ? 'ring-4 ring-game-signal' : ''} ${selectable ? 'hover:bg-game-panel/80' : 'cursor-not-allowed opacity-40'}`}
                style={{ borderColor: tierInfo(o.rarity).color }}>
                <div className="flex items-start gap-3"><ToolIcon item={o} size={46}/><h2 className="min-w-0 font-heading text-lg font-bold leading-tight">{o.name}</h2></div>
                <div className="mt-3 flex-1"><ItemStats item={o} run={{...run, weapons: pickedItems}} incoming/></div>
                <p className="mt-3 min-h-5 text-xs font-bold text-game-signal">{selected ? 'Selected' : ''}</p>
              </button>
            );
          })}
        </div>
        <button disabled={!ready} onClick={() => onConfirm(picked)} className="mt-6 min-h-12 w-full rounded-xl bg-game-warm px-6 font-bold text-game-bg disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {ready ? 'Clock in' : `Choose ${need - picked.length} more`}
        </button>
      </div>
    </main>
  );
}