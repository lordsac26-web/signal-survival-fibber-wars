// FIBER SPLICE SURGE — the Field Engineer's granted signature. The cabinet
// plants at his feet (an engine-owned world object): 0.8s telegraphed arming,
// then 4 pulses over 4s. Each pulse expands a visible blue ring that hits
// every impairment inside SURGE.ringRadius exactly once per pulse and
// repairs his deployed units (20% of max HP, plus +30% attack speed for 5s).
// Pure numbers live here so the timing, caps and damage stay unit-testable.
import { WEAPONS } from '@/game/data/combat';

export const SURGE = Object.freeze({
  cooldown: 18, arming: .8, pulses: 4, pulseWindow: 4,
  ringRadius: 170, repairPct: .2, haste: .3, hasteDuration: 5
});

export const surgeTotal = () => SURGE.arming + SURGE.pulseWindow;
export const surgePulseTimes = () => Array.from({ length: SURGE.pulses }, (_, i) =>
  SURGE.arming + (i + 1) * (SURGE.pulseWindow / SURGE.pulses));

// Pulse damage rides the same quadratic wave curve as enemy HP (see
// combat/difficulty.js enemyHpMultiplier: 1 + .18n + .006n², n = wave − 1),
// so one pulse stays a roughly constant fraction of an ordinary impairment's
// HP at every wave, while his level and combined weapon tiers keep pushing it
// up inside that fraction. hit() still applies his damage multiplier and crit.
export function surgePulseDamage(run, wave) {
  const n = Math.max(0, (wave || 1) - 1);
  const gear = (run.weapons || []).reduce((s, w) => {
    const v = typeof w === 'string' ? WEAPONS[w] : w;
    return s + (v.damage || 0);
  }, 0);
  const base = 12 + 2 * (run.level || 0) + .6 * gear;
  return Math.round(base * (1 + .18 * n + .006 * n * n));
}