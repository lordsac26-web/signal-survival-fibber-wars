import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_ICON_ATLAS, TOOL_ICON_CELLS, TOOL_ICON_BY_ARCHETYPE, PASSIVE_ICON_BY_NAME, DEPLOYABLE_ICON_BY_NAME, PREMIUM_ICON_BY_NAME, toolCell, toolSlugFor } from '@/game/art/toolAtlas';
import { WEAPON_ARCHETYPES, PASSIVE_ITEM_TABLE, createGenerator } from '@/game/data/generation';
import { DEPLOYABLES } from '@/game/data/structures';
import { decodePng } from './pngDecode.mjs';

// The shipped atlas must be the processed 7936×256 v2 sheet, and every rect
// we paint must be in-bounds, non-empty, free of the sheet's baked edge frame,
// and free of magenta keying leftovers. This is the parse/in-bounds guard for
// the icon lookup — it never touches stats, prices or loot rules.
const bytes = readFileSync(new URL('../../../public/assets/tools/tools-items-atlas-v2.png', import.meta.url));
const atlas = decodePng(bytes);
const alphaAt = (x, y) => atlas.rgba[(y * atlas.width + x) * 4 + 3];
const px = (x, y) => {
  const i = (y * atlas.width + x) * 4;
  return [atlas.rgba[i], atlas.rgba[i + 1], atlas.rgba[i + 2], atlas.rgba[i + 3]];
};
const cells = [];
for (const [slug, variants] of Object.entries(TOOL_ICON_CELLS)) {
  for (const [variant, rect] of Object.entries(variants)) cells.push([slug, variant, rect]);
}
const colFill = (c, x) => { let n = 0; for (let y = c.y; y < c.y + c.h; y++) if (alphaAt(x, y) > 20) n++; return n / c.h; };
const rowFill = (c, y) => { let n = 0; for (let x = c.x; x < c.x + c.w; x++) if (alphaAt(x, y) > 20) n++; return n / c.w; };
const opaqueCount = c => { let n = 0; for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) if (alphaAt(x, y) > 200) n++; return n; };

test('atlas file: local copy of the processed v2 sheet, exactly 7936×256, transparent corners', () => {
  assert.equal(atlas.width, TOOL_ICON_ATLAS.width);
  assert.equal(atlas.height, TOOL_ICON_ATLAS.height);
  for (const [x, y] of [[0, 0], [atlas.width - 1, 0], [0, atlas.height - 1], [atlas.width - 1, atlas.height - 1]]) {
    assert.equal(alphaAt(x, y), 0, `corner ${x},${y} must be transparent`);
  }
  assert(TOOL_ICON_ATLAS.url.startsWith('/assets/tools/'), 'icons load from the app’s own asset folder');
  console.log('TOOL_ATLAS_EVIDENCE', JSON.stringify({ bytes: bytes.length, width: atlas.width, height: atlas.height, cells: cells.length }));
});

test('every rect is in-bounds, non-empty, with no full-height frame bar on any edge; style B exists only for the original 19 tools', () => {
  assert.equal(Object.keys(TOOL_ICON_CELLS).length, 62, '62 icons, one entry each — style rows are not extra items');
  const withB = Object.entries(TOOL_ICON_CELLS).filter(([, v]) => v.B);
  assert.equal(withB.length, 19, 'row B holds the original 19 alternate-style cells only');
  for (const [slug, variant, c] of cells) {
    assert(c.w > 0 && c.h > 0, `${slug}/${variant} has a non-empty rect`);
    assert(c.x >= 0 && c.y >= 0 && c.x + c.w <= atlas.width && c.y + c.h <= atlas.height, `${slug}/${variant} in-bounds`);
    const opaque = opaqueCount(c);
    assert(opaque >= 40, `${slug}/${variant} is not empty (opaque ${opaque})`);
    // A crop still carrying the sheet's baked edge frame would show a
    // full-height bar at the icon's edge.
    for (const [edge, fill] of [['left', colFill(c, c.x)], ['right', colFill(c, c.x + c.w - 1)], ['top', rowFill(c, c.y)], ['bottom', rowFill(c, c.y + c.h - 1)]]) {
      assert(fill < 0.85, `${slug}/${variant} ${edge} edge has a frame bar (fill ${fill.toFixed(2)})`);
    }
    // Nothing drawn outside this cell's 128px box — icons never bleed into a neighbour.
    const cellX = Math.floor(c.x / TOOL_ICON_ATLAS.cell) * TOOL_ICON_ATLAS.cell;
    const cellY = variant === 'B' ? TOOL_ICON_ATLAS.cell : 0;
    for (let y = cellY; y < cellY + TOOL_ICON_ATLAS.cell; y++) for (let x = cellX; x < cellX + TOOL_ICON_ATLAS.cell; x++) {
      const inside = x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;
      if (!inside) assert(alphaAt(x, y) <= 10 || (x >= c.x - 6 && x < c.x + c.w + 6 && y >= c.y - 6 && y < c.y + c.h + 6), `${slug}/${variant} content escapes its cell at ${x},${y}`);
    }
  }
});

test('no magenta keying seam survives in any crop (no bright background magenta, no long purple fringe)', () => {
  let broad = 0, strict = 0, maxV = 0, maxH = 0;
  for (const [slug, variant, c] of cells) {
    for (let y = c.y; y < c.y + c.h; y++) {
      let run = 0;
      for (let x = c.x; x < c.x + c.w; x++) {
        const [r, g, b, a] = px(x, y);
        const isBroad = a > 20 && r > 100 && b > 100 && g < 70 && Math.abs(r - b) < 40;
        if (a > 10 && r > 200 && b > 180 && g < 60) strict++;
        if (isBroad) { broad++; run++; maxH = Math.max(maxH, run); } else run = 0;
      }
    }
    for (let x = c.x; x < c.x + c.w; x++) {
      let run = 0;
      for (let y = c.y; y < c.y + c.h; y++) {
        const [r, g, b, a] = px(x, y);
        if (a > 20 && r > 100 && b > 100 && g < 70 && Math.abs(r - b) < 40) { run++; maxV = Math.max(maxV, run); } else run = 0;
      }
    }
  }
  assert.equal(strict, 0, 'no background-coloured magenta pixels');
  assert(broad <= 40, `purple fringe pixels kept to stray specks (${broad})`);
  assert(maxV <= 4 && maxH <= 4, `no fringe line (v${maxV}/h${maxH})`);
  console.log('TOOL_FRINGE_EVIDENCE', JSON.stringify({ strictMagenta: strict, purpleSpecks: broad, maxVerticalRun: maxV, maxHorizontalRun: maxH }));
});

test('icon lookup: style A is default, unknown or missing style falls back to A, unmapped items resolve to null (glyph fallback)', () => {
  assert.deepEqual(toolCell('otdr'), TOOL_ICON_CELLS.otdr.A);
  assert.deepEqual(toolCell('otdr', 'B'), TOOL_ICON_CELLS.otdr.B);
  assert.deepEqual(toolCell('otdr', 'nope'), TOOL_ICON_CELLS.otdr.A);
  assert.notDeepEqual(TOOL_ICON_CELLS.otdr.A, TOOL_ICON_CELLS.otdr.B, 'B is a distinct cosmetic crop');
  assert.deepEqual(toolCell('bucket-keys', 'B'), TOOL_ICON_CELLS['bucket-keys'].A, 'v2 additions have no B cell and fall back to A');
  assert.equal(toolCell('not-a-tool'), null);
  assert.equal(toolSlugFor(null), null);
  assert.equal(toolSlugFor({ name: 'Mystery Pigtail', icon: '◆' }), 'mystery-pigtail');
  assert.equal(toolSlugFor({ baseId: 'cleaver' }), 'fiber-cleaver');
  assert.equal(toolSlugFor('tray'), 'splice-tray-sentry');
  assert.equal(toolSlugFor('switch'), 'optical-switch-snapper');
  assert.equal(toolSlugFor({ name: 'Definitely Not Real Gear', icon: '◆' }), null);
});

test('coverage: every weapon archetype maps to a distinct atlas cell', () => {
  const archetypes = WEAPON_ARCHETYPES.map(a => a[0]);
  for (const id of Object.keys(TOOL_ICON_BY_ARCHETYPE)) assert(archetypes.includes(id), `${id} is a real archetype`);
  assert.deepEqual(archetypes.filter(id => !TOOL_ICON_BY_ARCHETYPE[id]), [], 'no archetype is left on a glyph fallback');
  const slugs = Object.values(TOOL_ICON_BY_ARCHETYPE);
  assert.equal(new Set(slugs).size, slugs.length, 'no two archetypes share one icon');
  for (const slug of slugs) assert(TOOL_ICON_CELLS[slug], `${slug} exists in the atlas`);
  console.log('TOOL_ICON_COVERAGE', JSON.stringify({ archetypes: archetypes.length, mapped: archetypes.length, fallbacks: [] }));
});

test('mapping completeness: every weapon id, passive name, deployable and premium card resolves to a rect with real art', () => {
  assert.equal(Object.keys(PASSIVE_ICON_BY_NAME).length, PASSIVE_ITEM_TABLE.length, 'every passive table name is mapped, no extras');
  assert.equal(Object.keys(DEPLOYABLE_ICON_BY_NAME).length, DEPLOYABLES.length, 'every deployable is mapped');
  const entries = [
    ...WEAPON_ARCHETYPES.map(a => [`weapon ${a[0]}`, a[0], TOOL_ICON_BY_ARCHETYPE[a[0]]]),
    ...PASSIVE_ITEM_TABLE.map(n => [`passive ${n}`, { name: n, icon: '◆' }, PASSIVE_ICON_BY_NAME[n]]),
    ...DEPLOYABLES.map(d => [`deployable ${d.id}`, { name: d.name, icon: d.icon, deploy: true, structure: d.structure }, DEPLOYABLE_ICON_BY_NAME[d.name]]),
    ['premium OSHA Has Left the Chat', { name: 'OSHA Has Left the Chat', icon: '↑', premium: true }, PREMIUM_ICON_BY_NAME['OSHA Has Left the Chat']],
    ['premium Overtime Overclock', { name: 'Overtime Overclock', icon: '↑', premium: true }, PREMIUM_ICON_BY_NAME['Overtime Overclock']]
  ];
  for (const [label, input, slug] of entries) {
    assert(slug, `${label} has a mapped slug`);
    const resolved = toolSlugFor(input);
    assert.equal(resolved, slug, `${label} resolves by ${typeof input === 'string' ? 'id' : 'name'}`);
    const cell = toolCell(slug);
    assert(cell, `${label} has a rect`);
    const opaque = opaqueCount(cell);
    assert(opaque >= 40, `${label} art is non-empty (opaque ${opaque})`);
  }
  // The glyph fallback is reserved for genuinely unmapped ids only.
  assert.equal(toolSlugFor('not-a-slug'), null);
  assert.equal(toolSlugFor({ name: 'Unknown Field Gear', icon: '◆' }), null);
  assert.equal(toolCell('not-in-atlas'), null);
  console.log('TOOL_MAPPING_EVIDENCE', JSON.stringify({ mapped: entries.length, unmappedFallbacks: 0 }));
});

test('generated shop/level-up items resolve through the same lookup (weapons and passives both paint cells)', () => {
  const g = createGenerator(4242, 3);
  for (let i = 0; i < 12; i++) {
    const weapon = g.weapon();
    assert.equal(toolSlugFor(weapon), TOOL_ICON_BY_ARCHETYPE[weapon.baseId]);
    assert(toolCell(toolSlugFor(weapon)), `${weapon.baseId} paints a cell`);
    const passive = g.passive();
    assert.equal(toolSlugFor(passive), PASSIVE_ICON_BY_NAME[passive.name], `${passive.name} resolves by name`);
    assert(toolCell(toolSlugFor(passive)), `${passive.name} paints a cell`);
  }
});