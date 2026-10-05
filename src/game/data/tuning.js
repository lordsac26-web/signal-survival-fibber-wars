// Playtest targets, not guaranteed outcomes. Wave density follows the
// "rotator-style" pacing: a LOW cap on simultaneous actives with a steady
// trickle of spawns, and per-wave HP/damage scaling instead of body count.
// Economy follow-up: shop prices now scale with the wave (Brotato-style tier
// growth), kill Signal scales mildly, Legendary loot is gated behind the
// level-10 mark, and level thresholds steepen late to slow power-creep.
export const TUNING = Object.freeze({
  xpPickupFactor: .65, levelBase: 45, levelLinear: 18, levelQuadratic: 3,
  targetEarlyLevelsPerWave: 1, shopSlots: 4, maxLocks: 2,
  deployOfferChance: .02, premiumOfferChance: .01, premiumPriceMultiplier: 3, premiumReferencePrice: 36,
  deployBasePrice: 80, deployRankCap: 2, overclockRankCap: 2,
  rerollBase: 4, rerollStep: 2, dodgeCap: .6, critCap: 1,
  priceWaveScale: .3, signalWaveScale: .04,
  legendaryWave: 10, epicWaveGain: .3, epicWaveCap: 12
});
export const signalForLevel = level => TUNING.levelBase + level * TUNING.levelLinear + level * level * TUNING.levelQuadratic;
export const waveDuration = wave => Math.min(90, 20 + (wave - 1) * 4);
// Trickle pacing (was a flood: interval floor .14s, double chance up to .75).
// Spawn attempts slow as waves rise and the double-spawn chance tops out low.
export const spawnInterval = wave => Math.max(.32, .72 - wave * .022);
export const spawnDoubleChance = wave => Math.min(.4, wave * .03);
// Simultaneous-actives cap — the readability ceiling. Roughly linear early
// (12 + 1.4/wave) and hard-capped at 34 so late waves stay legible; ordinary
// spawn attempts that would exceed it are skipped, the boss never is.
export const maxActiveEnemies = wave => Math.min(34, Math.floor(12 + wave * 1.4));