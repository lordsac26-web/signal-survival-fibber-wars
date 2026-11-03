import { TOOL_ICON_ATLAS, toolCell, toolSlugFor } from '@/game/art/toolAtlas';
import { preloadToolAtlas } from '@/game/art/spriteLoader';

// Warm the single atlas fetch before the first shop/guide screen paints.
if (typeof window !== 'undefined') preloadToolAtlas();

// Cosmetic tool icon from the shared atlas. Pure CSS background-position
// lookup: the browser fetches the sheet once and every icon reuses it.
// `variant` picks a style row — 'A' everywhere, 'B' only for a featured offer.
// With no mapped cell (or a failed load) it falls back to the item's existing
// glyph, so a card is never blank.
export default function ToolIcon({ item, slug, size = 44, variant = 'A', className = '' }) {
  // A caller may pass an archetype id (Field Guide/Gallery/HUD pass `switch`)
  // or a direct slug — both resolve through toolSlugFor, which now maps ids to
  // v2 cells; the previous direct-cell lookup would have missed id-only slugs.
  const id = toolSlugFor(slug || item);
  const cell = toolCell(id, variant);
  if (!cell) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }}
      >
        {item?.icon || '◆'}
      </span>
    );
  }
  // Longest side fills 92% of the box, aspect preserved (no stretching). The
  // scale/offset stay fractional so the cell's top-left lands exactly on the
  // element's top-left — no edge drift into a neighbouring cell.
  const k = (size * 0.92) / Math.max(cell.w, cell.h);
  const w = Math.max(1, Math.round(cell.w * k));
  const h = Math.max(1, Math.round(cell.h * k));
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        style={{
          width: w,
          height: h,
          backgroundImage: `url(${TOOL_ICON_ATLAS.url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${(TOOL_ICON_ATLAS.width * k).toFixed(3)}px ${(TOOL_ICON_ATLAS.height * k).toFixed(3)}px`,
          backgroundPosition: `${(-cell.x * k).toFixed(3)}px ${(-cell.y * k).toFixed(3)}px`,
          imageRendering: 'pixelated'
        }}
      />
    </span>
  );
}