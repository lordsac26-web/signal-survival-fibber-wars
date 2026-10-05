// Playtest targets, not guaranteed outcomes. Spawn density is unchanged.
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
export const spawnInterval = wave => Math.max(.14, .72 - wave * .035);
export const spawnDoubleChance = wave => Math.min(.75, wave * .05);