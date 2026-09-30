// A small directional streak makes fast shots legible without extra sprites or allocations.
export function drawProjectile(ctx, shot) {
  const x = Math.round(shot.x), y = Math.round(shot.y);
  if (shot.helper) {
    ctx.fillStyle = '#10232e';ctx.fillRect(x - 8, y - 6, 16, 16);
    ctx.fillStyle = '#fbbf24';ctx.fillRect(x - 9, y - 9, 18, 5);
    ctx.fillStyle = '#fff';ctx.fillRect(x - 4, y - 2, 3, 3);ctx.fillRect(x + 2, y - 2, 3, 3);
    return;
  }
  if (shot.mortar) {
    ctx.fillStyle = '#192733';ctx.beginPath();ctx.arc(x, y, 9, 0, 7);ctx.fill();
    ctx.strokeStyle = shot.color;ctx.lineWidth = 2;ctx.beginPath();ctx.arc(x, y, 8, 0, 7);ctx.stroke();
    ctx.fillStyle = '#fff4df';ctx.beginPath();ctx.arc(x - 2, y - 2, 3, 0, 7);ctx.fill();
    return;
  }
  const length = Math.min(shot.traveled ?? Infinity,shot.pierce || shot.pattern === 'beam' ? 21 : 13);
  const front = Math.min(4,shot.remaining ?? 4);
  const speed = Math.hypot(shot.vx, shot.vy) || 1;
  const dx = shot.vx / speed, dy = shot.vy / speed;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#10232e';ctx.lineWidth = shot.pierce ? 9 : 7;
  ctx.beginPath();ctx.moveTo(x - dx * length, y - dy * length);ctx.lineTo(Math.round(x + dx * front), Math.round(y + dy * front));ctx.stroke();
  ctx.strokeStyle = shot.color;ctx.lineWidth = shot.pierce ? 6 : 4;
  ctx.beginPath();ctx.moveTo(x - dx * length, y - dy * length);ctx.lineTo(Math.round(x + dx * front), Math.round(y + dy * front));ctx.stroke();
  ctx.fillStyle = '#ffffff';ctx.beginPath();ctx.arc(Math.round(x + dx * front), Math.round(y + dy * front), shot.pierce ? 3 : 2.5, 0, 7);ctx.fill();
}