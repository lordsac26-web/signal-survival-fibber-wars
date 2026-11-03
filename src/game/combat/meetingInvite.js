// MEETING INVITE — the No Accountability Admin's granted signature.
// The table is an engine-owned world object (see signalEngine.js): it spawns
// fully inside the visible viewport AND the world, lures every ordinary enemy
// for exactly `duration` seconds while the Admin is contact-damage immune,
// then ONE blast of `damageMult` x his combined current weapon damage is
// split evenly across every enemy inside `blastRadius` (bosses take the full
// share). Aggro returns to the player the instant it expires. Pure helpers
// live here so the spawn clamp and blast math stay unit-testable.
export const MEETING = Object.freeze({
  duration: 4, cooldown: 20, tableRadius: 34, blastRadius: 150, damageMult: 8
});
const clampN = (n, a, b) => n < a ? a : n > b ? b : n;
// Spawn spot: `offset` units from the player toward the arena center, then
// clamped so the whole table sits inside the current camera viewport AND the
// world. If the viewport-inset rect degenerates (tiny window), fall back to
// world-bounds-only clamping around the player — never offscreen, never out
// of bounds, and the open arena has no unreachable pockets.
export function meetingTableSpot(px, py, camX, camY, viewW, viewH, W, H, r = MEETING.tableRadius, offset = 46) {
  const dx = W / 2 - px, dy = H / 2 - py, l = Math.hypot(dx, dy) || 1;
  const xMin = Math.max(r + 12, camX + r + 8), xMax = Math.min(W - r - 12, camX + viewW - r - 8);
  const yMin = Math.max(r + 12, camY + r + 8), yMax = Math.min(H - r - 12, camY + viewH - r - 8);
  if (xMin > xMax || yMin > yMax) return { x: clampN(px, r + 12, W - r - 12), y: clampN(py, r + 12, H - r - 12) };
  return { x: clampN(px + dx / l * offset, xMin, xMax), y: clampN(py + dy / l * offset, yMin, yMax) };
}
export const meetingBlastTotal = weaponDamageSum => weaponDamageSum * MEETING.damageMult;
export const meetingBlastShare = (total, count) => count > 0 ? total / count : 0;