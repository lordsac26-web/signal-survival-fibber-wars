import StatChips from '@/components/game/StatChips';

// Decluttered item stats (mobile-first): the collapsed default is the short
// percent-term chips; the full calculation (exact weapon base numbers and the
// complete mod list) hides behind a large tap-target "Details" disclosure.
export default function ItemStats({ item }) {
  return <div>
    <StatChips item={item}/>
    {item.baseId && <details className="mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg pr-2 text-xs font-bold text-game-signal">Details</summary>
      <p className="text-xs leading-relaxed text-game-muted">{Math.round(item.damage)} base damage • {item.rate}s interval • {item.range} reach rating (viewport-scaled) • mods: {(item.mods || []).map(m => `+${m.value} ${m.label}`).join(', ') || 'none'}</p>
    </details>}
  </div>;
}