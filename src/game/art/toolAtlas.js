// TOOL / ITEM ICON ATLAS — the processed 7936×256 v2 sheet (128px cells, 62
// columns × 2 cosmetic style rows; row B holds the original 19 alternate-style
// cells only). Rect geometry comes from the supplied v2 manifest; the
// manifest's auto-generated display names are not authoritative — the id/name
// maps below are. Icons are painted with background-position
// (components/game/ToolIcon.jsx), so one image serves the store, level-up
// cards, inventory, HUD bar, Field Guide and Gallery.
export const TOOL_ICON_ATLAS = Object.freeze({
  url: '/assets/tools/tools-items-atlas-v2.png',
  source: 'https://media.base44.com/images/public/6aab67049cd04a621f2adf4f/fc37a3eda_tools-items-atlas-v2.png',
  width: 7936,
  height: 256,
  cell: 128
});

const R = (x, y, w, h) => Object.freeze({ x, y, w, h });

// A = default style everywhere. B is a cosmetic alternate only (featured shop
// offer), never a second item, tier, rarity or animation frame. The 43 v2
// additions are A-only; toolCell() falls back to A whenever a B rect is
// missing, so no new entry needs one.
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
  'loader-dowel': { A: R(2320, 27, 96, 74), B: R(2320, 156, 96, 72) },
  // ── v2 additions (43): Optical Switch Snapper (weapon), the 35 passive
  // field-gear names, the 5 deployables and the 2 premium shop-only cards.
  // A-only: missing B falls back to A in toolCell().
  'optical-switch-snapper': { A: R(2466, 40, 60, 48) },
  'fusion-splice-protectors': { A: R(2594, 40, 60, 48) },
  'heat-shrinks': { A: R(2738, 35, 44, 41) },
  'buffer-tubes': { A: R(2850, 35, 60, 57) },
  'strength-members': { A: R(2978, 37, 60, 54) },
  'gel-filled-tubes': { A: R(3106, 35, 60, 57) },
  'dust-caps': { A: R(3234, 39, 60, 49) },
  'connector-boots': { A: R(3362, 42, 60, 44) },
  'otdr-launch-cables': { A: R(3507, 34, 43, 42) },
  'cleaning-wipes': { A: R(3623, 34, 49, 60) },
  'ipa-pens': { A: R(3748, 34, 56, 60) },
  'hard-hats': { A: R(3874, 38, 60, 52) },
  'safety-vests': { A: R(4006, 34, 51, 60) },
  'traffic-cones': { A: R(4136, 34, 48, 60) },
  'drop-cloths': { A: R(4258, 39, 60, 49) },
  'service-loops': { A: R(4386, 45, 60, 37) },
  'slack-coils': { A: R(4546, 34, 22, 46) },
  'red-light-roves': { A: R(4642, 34, 60, 59) },
  'kevlar-tufts': { A: R(4783, 34, 47, 46) },
  'fiber-fish-tape': { A: R(4898, 37, 60, 53) },
  'mystery-pigtail': { A: R(5046, 36, 40, 31) },
  'rack-mount-snacks': { A: R(5154, 46, 60, 36) },
  'label-maker': { A: R(5284, 34, 55, 60) },
  'splice-on-connector': { A: R(5410, 41, 60, 45) },
  'weatherproof-closure': { A: R(5538, 43, 60, 41) },
  'cable-lube': { A: R(5698, 34, 20, 48) },
  'utility-locates': { A: R(5806, 34, 36, 60) },
  'pedestal-key': { A: R(5928, 34, 47, 60) },
  'vault-pump': { A: R(6058, 34, 43, 60) },
  'tone-generator': { A: R(6185, 34, 45, 60) },
  'handhole-lid': { A: R(6315, 36, 51, 42) },
  'safety-glasses': { A: R(6434, 45, 60, 37) },
  'launch-reel': { A: R(6562, 39, 60, 50) },
  'ribbon-fan-out': { A: R(6699, 36, 51, 41) },
  'emergency-jumper': { A: R(6825, 38, 53, 34) },
  'test-set-battery': { A: R(6946, 37, 60, 53) },
  'bucket-keys': { A: R(7074, 35, 60, 58) },
  'traffic-barricade-kit': { A: R(7202, 38, 60, 51) },
  'portable-pedestal': { A: R(7339, 34, 42, 60) },
  'rat-guard': { A: R(7470, 36, 48, 38) },
  'slack-coil-snare': { A: R(7586, 37, 60, 53) },
  'osha-has-left-the-chat': { A: R(7726, 34, 45, 51) },
  'overtime-overclock': { A: R(7859, 34, 43, 48) }
});

// Existing weapon archetype id (WEAPON_ARCHETYPES / WEAPONS key) → icon slug.
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
  dowel: 'loader-dowel',
  switch: 'optical-switch-snapper'
});

// Passive field gear (level-up cards and shop offers) — keyed by the stable
// PASSIVE_ITEM_TABLE display name, NOT the generated p-<number> offer id.
export const PASSIVE_ICON_BY_NAME = Object.freeze({
  'Fusion Splice Protectors': 'fusion-splice-protectors',
  'Heat Shrinks': 'heat-shrinks',
  'Buffer Tubes': 'buffer-tubes',
  'Strength Members': 'strength-members',
  'Gel-Filled Tubes': 'gel-filled-tubes',
  'Dust Caps': 'dust-caps',
  'Connector Boots': 'connector-boots',
  'OTDR Launch Cables': 'otdr-launch-cables',
  'Cleaning Wipes': 'cleaning-wipes',
  'IPA Pens': 'ipa-pens',
  'Hard Hats': 'hard-hats',
  'Safety Vests': 'safety-vests',
  'Traffic Cones': 'traffic-cones',
  'Drop Cloths': 'drop-cloths',
  'Service Loops': 'service-loops',
  'Slack Coils': 'slack-coils',
  'Red-Light Roves': 'red-light-roves',
  'Kevlar Tufts': 'kevlar-tufts',
  'Fiber Fish Tape': 'fiber-fish-tape',
  'Mystery Pigtail': 'mystery-pigtail',
  'Rack-Mount Snacks': 'rack-mount-snacks',
  'Label Maker': 'label-maker',
  'Splice-On Connector': 'splice-on-connector',
  'Weatherproof Closure': 'weatherproof-closure',
  'Cable Lube': 'cable-lube',
  'Utility Locates': 'utility-locates',
  'Pedestal Key': 'pedestal-key',
  'Vault Pump': 'vault-pump',
  'Tone Generator': 'tone-generator',
  'Handhole Lid': 'handhole-lid',
  'Safety Glasses': 'safety-glasses',
  'Launch Reel': 'launch-reel',
  'Ribbon Fan-Out': 'ribbon-fan-out',
  'Emergency Jumper': 'emergency-jumper',
  'Test Set Battery': 'test-set-battery'
});

// Deployable shop items — keyed by the stable DEPLOYABLES display name, so
// shop offers, the HUD deploy bar and the mobile Deploy button all resolve
// through one map. Emoji icons remain the last-resort fallback.
export const DEPLOYABLE_ICON_BY_NAME = Object.freeze({
  'Bucket Truck Keys': 'bucket-keys',
  'Traffic Barricade Kit': 'traffic-barricade-kit',
  'Rat Guard': 'rat-guard',
  'Slack Coil Snare': 'slack-coil-snare',
  'Portable Pedestal': 'portable-pedestal'
});

// Premium shop-only cards — keyed by stable display name.
export const PREMIUM_ICON_BY_NAME = Object.freeze({
  'OSHA Has Left the Chat': 'osha-has-left-the-chat',
  'Overtime Overclock': 'overtime-overclock'
});

// Accepts a generator weapon/item object, a WEAPONS key, an archetype id or a
// guide/gallery slug string, or an item keyed by its stable display name
// (passives, deployables, premium cards). Unmapped items resolve to null so
// the caller falls back to the item's own glyph.
export function toolSlugFor(item) {
  if (!item) return null;
  if (typeof item === 'string') return TOOL_ICON_BY_ARCHETYPE[item] || (TOOL_ICON_CELLS[item] ? item : null);
  if (item.baseId && TOOL_ICON_BY_ARCHETYPE[item.baseId]) return TOOL_ICON_BY_ARCHETYPE[item.baseId];
  if (item.name) {
    const byName = DEPLOYABLE_ICON_BY_NAME[item.name] || PASSIVE_ICON_BY_NAME[item.name] || PREMIUM_ICON_BY_NAME[item.name];
    if (byName) return byName;
  }
  return TOOL_ICON_CELLS[item.slug] ? item.slug : null;
}

// Style falls back to A when a B rect is ever missing, so an icon can never
// render as an empty box because of a variant request.
export function toolCell(slug, variant = 'A') {
  const entry = TOOL_ICON_CELLS[slug];
  if (!entry) return null;
  return entry[variant] || entry.A;
}