// TOOL / ITEM ICON ATLAS — the processed 2432×256 sheet (128px cells, 19 tools
// × 2 cosmetic style rows). Every rect below is copied verbatim from the
// supplied manifest; no geometry is inferred here. Icons are painted with
// background-position (components/game/ToolIcon.jsx), so one image serves the
// store, level-up cards, inventory, HUD bar and Field Guide.
export const TOOL_ICON_ATLAS = Object.freeze({
  url: '/assets/tools/tools-items-atlas.png',
  source: 'https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/c9c6d4e0d_tools-items-atlas.png',
  width: 2432,
  height: 256,
  cell: 128
});

const R = (x, y, w, h) => Object.freeze({ x, y, w, h });

// A = default style everywhere. B is a cosmetic alternate only (featured shop
// offer), never a second item, tier, rarity or animation frame.
export const TOOL_ICON_CELLS = Object.freeze({
  'fiber-cleaver': { A: R(30, 23, 68, 82), B: R(30, 154, 68, 76) },
  otdr: { A: R(148, 22, 88, 84), B: R(148, 151, 88, 82) },
  'fusion-splicer': { A: R(277, 22, 86, 84), B: R(277, 151, 86, 82) },
  vfl: { A: R(405, 22, 86, 83), B: R(405, 151, 86, 82) },
  'optical-power-meter': { A: R(539, 22, 73, 83), B: R(539, 151, 73, 82) },
  'fiber-stripper': { A: R(663, 22, 82, 84), B: R(663, 151, 81, 82) },
  'one-click-cleaner': { A: R(788, 22, 88, 84), B: R(788, 151, 88, 82) },
  'kevlar-cutters': { A: R(919, 22, 81, 84), B: R(919, 151, 81, 82) },
  'splice-tray-sentry': { A: R(1057, 23, 62, 82), B: R(1056, 151, 63, 81) },
  'closure-cannon': { A: R(1181, 24, 70, 80), B: R(1178, 152, 75, 79) },
  'launch-cable-nest': { A: R(1296, 27, 96, 74), B: R(1296, 156, 96, 72) },
  'fan-out-splitter': { A: R(1427, 28, 90, 71), B: R(1427, 157, 90, 70) },
  'patch-cord-whip': { A: R(1564, 30, 72, 68), B: R(1564, 158, 71, 68) },
  'midspan-access-tool': { A: R(1695, 30, 65, 68), B: R(1695, 158, 65, 67) },
  'buffer-tube-blaster': { A: R(1805, 27, 102, 74), B: R(1805, 156, 102, 72) },
  'dead-zone-eliminator': { A: R(1940, 27, 87, 74), B: R(1940, 156, 87, 72) },
  'fairy-bell': { A: R(2073, 27, 78, 74), B: R(2073, 156, 78, 72) },
  'loose-tube-launcher': { A: R(2200, 28, 79, 71), B: R(2200, 156, 79, 71) },
  'loader-dowel': { A: R(2320, 27, 96, 74), B: R(2320, 156, 96, 72) }
});

// Existing weapon archetype id (WEAPON_ARCHETYPES / WEAPONS key) → icon slug.
// 'switch' (Optical Switch Snapper) has no sheet counterpart and keeps its
// emoji glyph — the documented fallback.
export const TOOL_ICON_BY_ARCHETYPE = Object.freeze({
  cleaver: 'fiber-cleaver',
  otdr: 'otdr',
  splicer: 'fusion-splicer',
  vfl: 'vfl',
  power: 'optical-power-meter',
  stripper: 'fiber-stripper',
  cleaner: 'one-click-cleaner',
  cutters: 'kevlar-cutters',
  tray: 'splice-tray-sentry',
  closure: 'closure-cannon',
  cable: 'launch-cable-nest',
  fanout: 'fan-out-splitter',
  jumper: 'patch-cord-whip',
  midspan: 'midspan-access-tool',
  blaster: 'buffer-tube-blaster',
  deadzone: 'dead-zone-eliminator',
  bell: 'fairy-bell',
  rocket: 'loose-tube-launcher',
  dowel: 'loader-dowel'
});

// Accepts a generator weapon/item object, a WEAPONS key, or a guide entry id.
export function toolSlugFor(item) {
  if (!item) return null;
  if (typeof item === 'string') return TOOL_ICON_BY_ARCHETYPE[item] || (TOOL_ICON_CELLS[item] ? item : null);
  if (item.baseId && TOOL_ICON_BY_ARCHETYPE[item.baseId]) return TOOL_ICON_BY_ARCHETYPE[item.baseId];
  return TOOL_ICON_CELLS[item.slug] ? item.slug : null;
}

// Style falls back to A when a B rect is ever missing, so an icon can never
// render as an empty box because of a variant request.
export function toolCell(slug, variant = 'A') {
  const entry = TOOL_ICON_CELLS[slug];
  if (!entry) return null;
  return entry[variant] || entry.A;
}