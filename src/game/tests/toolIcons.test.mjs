import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_ICON_ATLAS, TOOL_ICON_CELLS, TOOL_ICON_BY_ARCHETYPE, toolCell, toolSlugFor } from '@/game/art/toolAtlas';
import { WEAPON_ARCHETYPES, createGenerator } from '@/game/data/generation';
import { decodePng } from './pngDecode.mjs';

// The shipped atlas must be the processed 2432×256 RGBA sheet, and every rect
// we paint must be in-bounds, non-empty, free of the sheet's baked edge frame,
// and free of magenta keying leftovers. This is the parse/in-bounds guard for
// the icon lookup — it never touches stats, prices or loot rules.
const bytes = readFileSync(new URL('../../../public/assets/tools/tools-items-atlas.png', import.meta.url));
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

test('atlas file: local copy of the processed sheet, exactly 2432×256, transparent corners', () => {
  assert.equal(atlas.width, TOOL_ICON_ATLAS.width);
  assert.equal(atlas.height, TOOL_ICON_ATLAS.height);
  for (const [x, y] of [[0, 0], [atlas.width - 1, 0], [0, atlas.height - 1], [atlas.width - 1, atlas.height - 1]]) {
    assert.equal(alphaAt(x, y), 0, `corner ${x},${y} must be transparent`);
  }
  assert(TOOL_ICON_ATLAS.url.startsWith('/assets/tools/'), 'icons load from the app’s own asset folder');
  console.log('TOOL_ATLAS_EVIDENCE', JSON.stringify({ bytes: bytes.length, width: atlas.width, height: atlas.height, cells: cells.length }));
});

test('every rect is in-bounds, non-empty, with no full-height frame bar on any edge', () => {
  assert.equal(Object.keys(TOOL_ICON_CELLS).length, 19, '19 tools, one entry each — style rows are not extra items');
  for (const [slug, variant, c] of cells) {
    assert(c.w > 0 && c.h > 0, `${slug}/${variant} has a non-empty rect`);
    assert(c.x >= 0 && c.y >= 0 && c.x + c.w <= atlas.width && c.y + c.h <= atlas.height, `${slug}/${variant} in-bounds`);
    let opaque = 0;
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) if (alphaAt(x, y) > 200) opaque++;
    assert(opaque >= 40, `${slug}/${variant} is not empty (opaque ${opaque})`);
    // The supplied sheet baked a 1px opaque/empty frame beside some cells. Any
    // crop still carrying it would show a full-height bar at the icon's edge.
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

test('icon lookup: style A is default, unknown style falls back to A, unmapped items resolve to null (glyph fallback)', () => {
  assert.deepEqual(toolCell('otdr'), TOOL_ICON_CELLS.otdr.A);
  assert.deepEqual(toolCell('otdr', 'B'), TOOL_ICON_CELLS.otdr.B);
  assert.deepEqual(toolCell('otdr', 'nope'), TOOL_ICON_CELLS.otdr.A);
  assert.notDeepEqual(TOOL_ICON_CELLS.otdr.A, TOOL_ICON_CELLS.otdr.B, 'B is a distinct cosmetic crop');
  assert.equal(toolCell('not-a-tool'), null);
  assert.equal(toolSlugFor(null), null);
  assert.equal(toolSlugFor({ name: 'Mystery Pigtail', icon: '◆' }), null); // passive gear keeps its glyph
  assert.equal(toolSlugFor({ baseId: 'cleaver' }), 'fiber-cleaver');
  assert.equal(toolSlugFor('tray'), 'splice-tray-sentry');
});

test('coverage: every weapon archetype has an atlas icon or an explicit documented fallback', () => {
  const fallbacks = ['switch']; // Optical Switch Snapper has no sheet counterpart
  const archetypes = WEAPON_ARCHETYPES.map(a => a[0]);
  for (const id of Object.keys(TOOL_ICON_BY_ARCHETYPE)) assert(archetypes.includes(id), `${id} is a real archetype`);
  const unmapped = archetypes.filter(id => !TOOL_ICON_BY_ARCHETYPE[id]);
  assert.deepEqual(unmapped, fallbacks, 'only the documented fallback is unmapped');
  const slugs = Object.values(TOOL_ICON_BY_ARCHETYPE);
  assert.equal(new Set(slugs).size, slugs.length, 'no two archetypes share one icon');
  for (const slug of slugs) assert(TOOL_ICON_CELLS[slug], `${slug} exists in the atlas`);
  console.log('TOOL_ICON_COVERAGE', JSON.stringify({ archetypes: archetypes.length, mapped: archetypes.length - unmapped.length, fallbacks: unmapped }));
});

test('generated shop/level-up items resolve through the same lookup (weapons mapped, passives fall back)', () => {
  const g = createGenerator(4242, 3);
  for (let i = 0; i < 12; i++) {
    const weapon = g.weapon();
    assert.equal(toolSlugFor(weapon), TOOL_ICON_BY_ARCHETYPE[weapon.baseId]);
    assert(toolCell(toolSlugFor(weapon)), `${weapon.baseId} paints a cell`);
    const passive = g.passive();
    assert.equal(toolSlugFor(passive), null, 'passive gear keeps its ◆ glyph');
  }
});