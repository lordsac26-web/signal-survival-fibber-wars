// Playtest targets, not guaranteed outcomes. Enemy spawn density is unchanged.
export const TUNING = Object.freeze({
  xpPickupFactor: .65, levelBase: 45, levelLinear: 18, levelQuadratic: 2,
  targetEarlyLevelsPerWave: 1, shopSlots: 4, maxLocks: 2,
  deployOfferChance: .02, premiumOfferChance: .01, premiumPriceMultiplier: 3, premiumReferencePrice: 36,
  deployBasePrice: 80, deployRankCap: 2, overclockRankCap: 2,
  rerollBase: 4, rerollStep: 2, dodgeCap: .6, critCap: 1
});
export const signalForLevel = level => TUNING.levelBase + level * TUNING.levelLinear + level * level * TUNING.levelQuadratic;
export const waveDuration = wave => Math.min(90, 20 + (wave - 1) * 4);
export const spawnInterval = wave => Math.max(.1, .76 - wave * .045);
export const spawnDoubleChance = wave => Math.min(.65, wave * .05);