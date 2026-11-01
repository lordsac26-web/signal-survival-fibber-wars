import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_ICON_ATLAS, TOOL_ICON_CELLS, TOOL_ICON_BY_ARCHETYPE, toolCell, toolSlugFor } from '@/game/art/toolAtlas';
import { WEAPON_ARCHETYPES, createGenerator } from '@/game/data/generation';
import { decodePng } from './pngDecode.mjs';

// The shipped atlas must be the processed 2432×256 RGBA sheet, and every rect
// we paint from must be in-bounds, non-empty and clean (transparent outside,
// no magenta keying leftovers). This is the parse/in-bounds guard for the
// icon lookup — it never touches stats, prices or loot rules.
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

test('atlas file: HTTP-equivalent copy present, exactly 2432×256, transparent corners', () => {
  assert.equal(atlas.width, TOOL_ICON_ATLAS.width);
  assert.equal(atlas.height, TOOL_ICON_ATLAS.height);
  for (const [x, y] of [[0, 0], [atlas.width - 1, 0], [0, atlas.height - 1], [atlas.width - 1, atlas.height - 1]]) {
    assert.equal(alphaAt(x, y), 0, `corner ${x},${y} must be transparent`);
  }
  assert(TOOL_ICON_ATLAS.url.startsWith('/assets/tools/'), 'icons load from the app’s own asset folder');
  console.log('TOOL_ATLAS_EVIDENCE', JSON.stringify({ bytes: bytes.length, width: atlas.width, height: atlas.height, cells: cells.length }));
});

test('every manifest rect is in-bounds, contains opaque art, and leaves its cell margin transparent', () => {
  assert.equal(Object.keys(TOOL_ICON_CELLS).length, 19, '19 tools, one entry each — style rows are not extra items');
  for (const [slug, variant, rect] of cells) {
    assert(rect.w > 0 && rect.h > 0, `${slug}/${variant} has a non-empty rect`);
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= atlas.width && rect.y + rect.h <= atlas.height, `${slug}/${variant} in-bounds`);
    let opaque = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (alphaAt(x, y) > 200) opaque++;
    assert(opaque >= 40, `${slug}/${variant} is not empty (opaque ${opaque})`);
    // Nothing painted outside the rect inside its own 128px cell box: no
    // gridline, label or neighbouring-icon fragments can leak into an icon.
    const cellX = Math.floor(rect.x / TOOL_ICON_ATLAS.cell) * TOOL_ICON_ATLAS.cell;
    const cellY = variant === 'B' ? TOOL_ICON_ATLAS.cell : 0;
    let bleed = 0;
    for (let y = cellY; y < cellY + TOOL_ICON_ATLAS.cell; y++) for (let x = cellX; x < cellX + TOOL_ICON_ATLAS.cell; x++) {
      const inside = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      if (!inside && alphaAt(x, y) > 10) bleed++;
    }
    assert(bleed <= 4, `${slug}/${variant} cell margin clean (bleed ${bleed})`);
  }
});

test('no magenta keying halo survives inside any icon', () => {
  for (const [slug, variant, rect] of cells) {
    let magenta = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const [r, g, b, a] = px(x, y);
      if (a > 10 && r > 230 && g < 40 && b > 230) magenta++;
    }
    assert.equal(magenta, 0, `${slug}/${variant} magenta pixels`);
  }
});

test('icon lookup: style A is default, unknown style falls back to A, unmapped items resolve to null (glyph fallback)', () => {
  assert.deepEqual(toolCell('otdr'), TOOL_ICON_CELLS.otdr.A);
  assert.deepEqual(toolCell('otdr', 'B'), TOOL_ICON_CELLS.otdr.B);
  assert.deepEqual(toolCell('otdr', 'nope'), TOOL_ICON_CELLS.otdr.A);
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