const reported = new Set();
export function reportEnemyVisual(kind, reason) {
  const key = `${kind}:${reason}`;
  if (reported.has(key)) return;
  reported.add(key);
  console.warn(`[Enemy body: ${kind}] ${reason}`);
}
// Validate the actual atlas crop, not merely the presence of an art object.
// Native canvas silently ignores NaN drawImage arguments, leaving a live collider invisible.
export function guardedEnemyDraw(ctx, draw) {
  let depth = 0, bodies = 0, failure = '';
  const guard = new Proxy(ctx, { get(target, key) {
    if (key === 'save') return () => { target.save(); depth++; };
    if (key === 'restore') return () => { if (depth > 0) { target.restore(); depth--; } };
    if (key === 'drawImage') return (image, ...args) => {
      const w = image?.naturalWidth ?? image?.width, h = image?.naturalHeight ?? image?.height;
      if (!(w > 0 && h > 0) || !args.every(Number.isFinite) || image.complete === false) { failure = 'Unready image or non-finite atlas frame'; return; }
      if (args.length === 8 && (args[0] < 0 || args[1] < 0 || args[2] <= 0 || args[3] <= 0 || args[0] + args[2] > w + .01 || args[1] + args[3] > h + .01)) { failure = 'Atlas frame outside image bounds'; return; }
      target.drawImage(image, ...args); bodies++;
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  }, set(target, key, value) { target[key] = value; return true; } });
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  try { draw(guard); } catch (error) { failure = error.message || 'Sprite renderer failed'; }
  finally { while (depth > 0) { ctx.restore(); depth--; } ctx.restore(); }
  return { drawn: bodies > 0 && !failure, failure: failure || (bodies ? '' : 'No drawable sprite body') };
}

// Tiny type-specific emergency pixel bodies, never new targets or colliders.
export function drawEnemyFallback(ctx, e) {
  const kind = e.kind || 'unknown', size = Math.max(16, (e.r || 14) * 2), p = size / 10;
  const machine = ['ditch', 'rous'].includes(kind), bug = ['jitter', 'crosstalk'].includes(kind);
  const rows = machine ? ['0011111100','0111111110','1111111111','1111111111','0111111110','1110011111','1110011111'] : bug ? ['0100000010','0011111100','1111111111','0111111110','1111111111','0011111100','0100000010'] : kind === 'attenuation' ? ['0001111000','0011111100','0111111110','0111111110','0111111110','1111111111','1101101101'] : kind === 'squirrel' ? ['1100000011','1110110111','0111111110','0011111100','0111111111','0111111111','1100001100'] : ['0001111000','0011111100','0111111110','1111111111','1111111111','0111111110','1100000011'];
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
  const x = Math.round(e.x - size / 2), y = Math.round(e.y - size / 2);
  ctx.fillStyle = '#102b32'; ctx.fillRect(x - 2, y - 2, size + 4, p * rows.length + 4);
  ctx.fillStyle = e.color || '#fb7185';
  rows.forEach((row, iy) => [...row].forEach((v, ix) => { if (v === '1') ctx.fillRect(x + ix * p, y + iy * p, Math.ceil(p), Math.ceil(p)); }));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + p * 3, y + p * 2, p, p); ctx.fillRect(x + p * 6, y + p * 2, p, p);
  ctx.restore();
}