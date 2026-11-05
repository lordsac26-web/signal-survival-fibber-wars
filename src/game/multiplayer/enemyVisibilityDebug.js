// Opt-in development harness: /multiplayer?room=...&enemyDebug=1.
// The report is inspectable by tooling without feeding anything back into combat.
export default function enemyVisibilityDebug(ctx, run, enemies, drawn, bounds) {
  if (!import.meta.env.DEV || !run.coopAuthoritative) return;
  const inView = e => e.x + (e.r || 0) >= bounds.x && e.x - (e.r || 0) <= bounds.x + bounds.width && e.y + (e.r || 0) >= bounds.y && e.y - (e.r || 0) <= bounds.y + bounds.height;
  const expected = (run.coopWorldRef?.current?.enemies || []).filter(e => e.hp > 0 && inView(e)).map(e => e.id);
  const bodyIds = new Set(drawn.map(e => e.id));
  const report = { seq: run.coopWorldRef?.current?.seq, expected, drawn: drawn.map(e => e.id), missing: expected.filter(id => !bodyIds.has(id)), fallbacks: drawn.filter(e => e.fallback) };
  run.coopVisibilityReport = report;
  if (new URLSearchParams(window.location.search).get('enemyDebug') !== '1') return;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  for (const e of enemies) {
    if (!e.active || e.hp <= 0 || !inView(e)) continue;
    ctx.strokeStyle = bodyIds.has(e.netId) ? '#67e8f9' : '#ff3344';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillText(`${e.kind} #${e.netId}`, e.x - e.r, e.y - e.r - 4);
  }
  ctx.fillStyle = '#102b32'; ctx.fillRect(bounds.x + 5, bounds.y + 5, 300, 34);
  ctx.fillStyle = report.missing.length ? '#ff3344' : '#67e8f9';
  ctx.fillText(`Alive ${expected.length} | bodies ${drawn.length} | missing ${report.missing.length}`, bounds.x + 10, bounds.y + 19);
  ctx.fillText(`Fallback bodies ${report.fallbacks.length}`, bounds.x + 10, bounds.y + 32); ctx.restore();
}