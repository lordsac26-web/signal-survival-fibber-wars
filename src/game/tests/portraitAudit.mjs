// Portrait audit (run via alias-loader): verifies the engineer source sheet
// against the owner's original upload, then audits every playable-character
// portrait and the engineer idle frame for grid lines, label/border remnants,
// magenta bleed, and white keying fringes.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { CHARACTER_SPRITES } from '@/game/art/characterSprites';

const read = p => readFileSync(new URL(p.replace('../public', '../../../public'), import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const decode = b => { const p = PNG.sync.read(b); return { width: p.width, height: p.height, rgba: new Uint8Array(p.data) }; };

// 1) source sheet integrity: local copy must be byte-identical to the owner's upload
const local = read('../public/assets/engineer/source.png');
console.log('engineer source.png:', local.length, 'bytes', sha(local));
const remote = await fetch('https://media.base44.com/images/public/6aab67049cd04a621f2adf4f/a2754efa9_field-engineer-source.png', { redirect: 'follow', signal: AbortSignal.timeout(30000) });
const remoteBytes = Buffer.from(await remote.arrayBuffer());
console.log('remote original  :', remoteBytes.length, 'bytes', sha(remoteBytes), 'status', remote.status);
console.log('SOURCE MATCHES OWNER UPLOAD:', sha(local) === sha(remoteBytes));

// 2) per-image audit
function audit(label, bytes, cellX = 0, cellY = 0, cellW = null, cellH = null) {
  const img = decode(bytes);
  const W = cellW ?? img.width, H = cellH ?? img.height;
  let opaque = 0, magenta = 0, pinkish = 0, white = 0, maxy = -1, minx = 99, maxx = -1, miny = 99;
  const rowRun = new Array(H).fill(0), colRun = new Array(W).fill(0);
  let run = 0;
  for (let y = 0; y < H; y++) { run = 0;
    for (let x = 0; x < W; x++) {
      const i = ((y + cellY) * img.width + (x + cellX)) * 4, a = img.rgba[i + 3];
      if (a > 40) { opaque++; run++; rowRun[y] = Math.max(rowRun[y], run);
        if (y > maxy) maxy = y; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y;
        const r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
        if (r > 235 && g < 90 && b > 235) magenta++;
        if (r > 200 && g < 100 && b > 100 && b < 235) pinkish++;
        if (r > 225 && g > 225 && b > 225) white++;
      } else run = 0;
    }
  }
  for (let x = 0; x < W; x++) { run = 0;
    for (let y = 0; y < H; y++) {
      const i = ((y + cellY) * img.width + (x + cellX)) * 4;
      if (img.rgba[i + 3] > 40) { run++; colRun[x] = Math.max(colRun[x], run); } else run = 0;
    }
  }
  // straight-line remnants: a fully-spanning run that is not the figure itself
  const spanRow = rowRun.map((v, y) => ({ y, v })).filter(o => o.v >= W * .9);
  const spanCol = colRun.map((v, x) => ({ x, v })).filter(o => o.v >= H * .9);
  // boundary white fringe: near-white opaque pixels touching transparency
  let fringe = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y + cellY) * img.width + (x + cellX)) * 4;
    if (img.rgba[i + 3] <= 40) continue;
    const r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
    if (r < 215 || g < 215 || b < 215) continue;
    let touches = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ((ny + cellY) * img.width + (nx + cellX)) * 4;
      if (img.rgba[j + 3] <= 40) touches = true;
    }
    if (touches) fringe++;
  }
  console.log(`${label}: ${img.width}x${img.height}${cellW ? ` cell ${W}x${H}@${cellX},${cellY}` : ''} opaque=${opaque} magenta=${magenta} pinkish=${pinkish} white=${white} fringe=${fringe} bounds=[${minx},${miny}..${maxx},${maxy}] spanningRows=${JSON.stringify(spanRow)} spanningCols=${JSON.stringify(spanCol)}`);
}

console.log('--- engineer portrait (current) ---');
audit('portrait.png', read('../public/assets/engineer/portrait.png'));
console.log('--- engineer idle frame 0 (source-derived strip) ---');
audit('idle-front f0', read('../public/assets/engineer/idle-front.png'), 0, 0, 67, 83);
console.log('--- all character portraits ---');
for (const [id, def] of Object.entries(CHARACTER_SPRITES)) {
  if (!def.portrait) { console.log(`${id}: (no portrait path)`); continue; }
  try { audit(`${id} portrait`, read('../public' + def.portrait)); }
  catch (e) { console.log(`${id} portrait: MISSING/BROKEN — ${e.message}`); }
}