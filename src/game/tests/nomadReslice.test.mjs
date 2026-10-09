import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { characterSprite } from '@/game/art/characterSprites.js';

// Regression tests for the Nomad sprite re-slice fix.
// Verifies: no stray pixels at cell top, shared baseline consistency,
// correct frame counts, and muzzle offset within torso height band.

const NOMAD_DIR = '../../../public/assets/nomad/';
const MANIFEST = JSON.parse(
  await readFile(new URL(NOMAD_DIR + 'animation.json', import.meta.url), 'utf8')
);

// Decode PNG and return per-cell analysis
async function analyzeAtlas(file, cellW, cellH, cols) {
  const { PNG } = await import('pngjs');
  const buf = await readFile(new URL(NOMAD_DIR + file, import.meta.url));
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  const cells = [];
  for (let c = 0; c < cols; c++) {
    let topCount = 0, totalCount = 0, firstOpaqueY = -1, lastOpaqueY = -1;
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const idx = (y * width + (c * cellW + x)) * 4;
        if (data[idx + 3] > 10) {
          totalCount++;
          if (y < 6) topCount++;
          if (firstOpaqueY < 0) firstOpaqueY = y;
          lastOpaqueY = y;
        }
      }
    }
    cells.push({ col: c, topCount, totalCount, firstOpaqueY, lastOpaqueY });
  }
  return cells;
}

test('Nomad sprite definition matches the re-sliced manifest', () => {
  const def = characterSprite('nomad');
  assert.ok(def, 'Nomad sprite definition must exist');
  assert.equal(def.atlasW, 684, 'idle atlas width');
  assert.equal(def.atlasH, 138, 'idle atlas height');
  assert.equal(def.cellW, 76, 'idle cell width');
  assert.equal(def.cellH, 138, 'idle cell height');
  assert.equal(def.columns, 9, 'idle columns');
  assert.equal(def.walkColumns, 9, 'walk columns');
  assert.equal(def.walkCellW, 72, 'walk cell width');
  assert.equal(def.walkCellH, 138, 'walk cell height');
  assert.equal(def.walkLeftColumns, 9, 'walkLeft columns');
  assert.equal(def.attackColumns, 6, 'attack columns (was 11, now 6)');
  assert.equal(def.attackCellW, 164, 'attack cell width');
  assert.equal(def.attackCellH, 138, 'attack cell height');
  assert.equal(def.specialColumns, 8, 'special columns (was 10, now 8)');
  assert.equal(def.specialCellW, 198, 'special cell width');
  assert.equal(def.specialCellH, 138, 'special cell height');
  assert.ok(def.muzzle, 'Nomad must have a muzzle offset');
  assert.equal(def.muzzle.x, 1, 'muzzle x (pixels right of body center)');
  assert.equal(def.muzzle.y, 96, 'muzzle y (pixels above baseline)');
  assert.equal(def.muzzle.cellW, 164, 'muzzle cellW');
  assert.equal(def.muzzle.cellH, 138, 'muzzle cellH');
});

test('Nomad manifest validates against sprite definition manifestSpec', () => {
  const def = characterSprite('nomad');
  for (const [key, expected] of Object.entries(def.manifestSpec)) {
    const actual = key.split('.').reduce((o, p) => o?.[p], MANIFEST);
    assert.equal(actual, expected, `Manifest key ${key}: expected ${expected}, got ${actual}`);
  }
});

test('Nomad walk frames have NO stray pixels at cell top (the original defect)', async () => {
  const cells = await analyzeAtlas('walk-side.png', 72, 138, 9);
  for (const cell of cells) {
    assert.equal(cell.topCount, 0, `Walk cell ${cell.col} must have 0 opaque pixels in top 6 rows (was ~250)`);
  }
});

test('Nomad walkLeft frames have minimal stray pixels at cell top', async () => {
  const cells = await analyzeAtlas('walk-left.png', 72, 138, 9);
  for (const cell of cells) {
    assert.ok(cell.topCount <= 5, `WalkLeft cell ${cell.col} topCount must be <= 5, got ${cell.topCount}`);
  }
});

test('Nomad attack atlas has 6 real frames with no stray fragments', async () => {
  const cells = await analyzeAtlas('attack.png', 164, 138, 6);
  assert.equal(cells.length, 6, 'attack must have exactly 6 cells');
  for (const cell of cells) {
    assert.ok(cell.totalCount > 4000, `Attack cell ${cell.col} must be a real frame (totalCount > 4000), got ${cell.totalCount}`);
    assert.equal(cell.topCount, 0, `Attack cell ${cell.col} must have 0 stray pixels at top`);
  }
});

test('Nomad special atlas has 8 real frames with no stray fragments', async () => {
  const cells = await analyzeAtlas('special.png', 198, 138, 8);
  assert.equal(cells.length, 8, 'special must have exactly 8 cells');
  for (const cell of cells) {
    assert.ok(cell.totalCount > 5000, `Special cell ${cell.col} must be a real frame (totalCount > 5000), got ${cell.totalCount}`);
    assert.equal(cell.topCount, 0, `Special cell ${cell.col} must have 0 stray pixels at top`);
  }
});

test('Nomad all frames share the same baseline (lowest body pixel at y=137)', async () => {
  const sharedBaseline = 137;
  const allAtlases = [
    { file: 'idle-front.png', cellW: 76, cellH: 138, cols: 9 },
    { file: 'walk-side.png', cellW: 72, cellH: 138, cols: 9 },
    { file: 'walk-left.png', cellW: 72, cellH: 138, cols: 9 },
    { file: 'attack.png', cellW: 164, cellH: 138, cols: 6 },
    { file: 'special.png', cellW: 198, cellH: 138, cols: 8 },
  ];
  for (const { file, cellW, cellH, cols } of allAtlases) {
    const cells = await analyzeAtlas(file, cellW, cellH, cols);
    for (const cell of cells) {
      assert.equal(cell.lastOpaqueY, sharedBaseline, `${file} cell ${cell.col}: lowest pixel must be at baseline ${sharedBaseline}, got ${cell.lastOpaqueY}`);
    }
  }
});

test('Nomad muzzle offset is within the torso height band', () => {
  const def = characterSprite('nomad');
  const muzzleYFrac = def.muzzle.y / def.muzzle.cellH;
  // Muzzle should be at mid-torso: between 40% and 80% of cell height above feet
  assert.ok(muzzleYFrac > 0.4 && muzzleYFrac < 0.8, `Muzzle y fraction should be 0.4-0.8, got ${muzzleYFrac.toFixed(3)}`);
});

test('Nomad muzzle x offset is small (hand near body center)', () => {
  const def = characterSprite('nomad');
  const muzzleXFrac = def.muzzle.x / def.muzzle.cellW;
  assert.ok(Math.abs(muzzleXFrac) < 0.05, `Muzzle x fraction should be < 0.05, got ${muzzleXFrac.toFixed(4)}`);
});