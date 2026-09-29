import { itemDeltas } from '@/game/data/stats';

// Explicit stat-delta chips for shop and level-up cards: green "+3 Armor",
// red "−5% Speed". Repeated rolls of the same stat merge into one chip.
export default function StatChips({ item }) {
  const deltas = itemDeltas(item);
  if (!deltas.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {deltas.map(d => (
        <span
          key={d.stat}
          className={`rounded-md px-1.5 py-0.5 text-xs font-black tabular-nums ${d.positive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}
        >
          {d.text}
        </span>
      ))}
    </div>
  );
}