// Boss anti-pin (Squirrel, Repeat Pete, R.O.U.S.): the three heavies are not
// stun-lockable. A boss that is TRYING to move but barely moving — wedged on
// a wall or barricade — accumulates a blocked clock; past the threshold it
// spends a short sidestep burst moving perpendicular to its intended heading
// (alternating side, flipped toward arena center) and then reacquires the
// player normally. Knockback juggling is handled separately by the bosses'
// knockback resistance in hit(); this module guards geometric pinning.
export const PIN = Object.freeze({
  threshold: 1.5,       // seconds of blocked movement before the sidestep
  sidestepTime: .8,     // sidestep burst length
  realizedFraction: .25,// "realized < 25% of intended" counts as blocked
  minSpeed: 8,          // rooted bosses (want ≈ 0) never accumulate
  sidestepBoost: 1.15   // sidestep moves a touch faster than the chase
});

export const createPinState = () => ({ blocked: 0, sidestep: 0, dir: 1 });

// Feed the intended velocity and the position delta actually realized this
// step. Returns true while the sidestep override should drive movement.
export function stepPin(pin, dt, wantX, wantY, realizedX, realizedY) {
  if (pin.sidestep > 0) { pin.sidestep = Math.max(0, pin.sidestep - dt); return true; }
  const want = Math.hypot(wantX, wantY) * dt, realized = Math.hypot(realizedX, realizedY);
  if (want > PIN.minSpeed * dt && realized < want * PIN.realizedFraction) pin.blocked += dt;
  else pin.blocked = Math.max(0, pin.blocked - dt * 2);
  if (pin.blocked >= PIN.threshold) { pin.blocked = 0; pin.sidestep = PIN.sidestepTime; pin.dir *= -1; return true; }
  return false;
}

// Perpendicular to the intended heading, on the alternating side, flipped
// toward arena center so the wall that caused the pin never re-blocks it.
export function sidestepVelocity(pin, wantX, wantY, speed, centerX, centerY, x, y) {
  const l = Math.hypot(wantX, wantY) || 1;
  let px = -wantY / l * pin.dir, py = wantX / l * pin.dir;
  if (px * (centerX - x) + py * (centerY - y) < 0) { px = -px; py = -py; }
  return { x: px * speed, y: py * speed };
}