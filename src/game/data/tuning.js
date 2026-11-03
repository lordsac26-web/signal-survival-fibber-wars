// Phase 2: readable low-density encounters, compounding progression, shared sinks.
export const TUNING = Object.freeze({
  xpPickupFactor: .65, levelBase: 45, levelLinear: 18, levelQuadratic: 3,
  levelCompound:1.30, targetEarlyLevelsPerWave:1, shopSlots:4, maxLocks:2,
  deployOfferChance:.02, premiumOfferChance:.01, premiumPriceMultiplier:3, premiumReferencePrice:36,
  deployBasePrice:80, deployRankCap:2, overclockRankCap:2, cloneOverclockCap:3,
  itemStatWaveScale:.06, rerollBase:4, dodgeCap:.5, critCap:1,
  priceWaveScale:.06, signalWaveScale:0, legendaryWave:10, epicWaveGain:.3, epicWaveCap:12
});
export const signalForLevel=level=>Math.ceil(level<=5?TUNING.levelBase+level*TUNING.levelLinear+level*level*TUNING.levelQuadratic:210*Math.pow(TUNING.levelCompound,level-5));
export const waveDuration=wave=>Math.min(90,20+(wave-1)*4);
export const spawnInterval=wave=>Math.max(.32,.72-wave*.022);
export const spawnDoubleChance=wave=>wave>=8?0:Math.min(.18,wave*.03);
export const maxActiveEnemies=wave=>Math.min(14,6+Math.floor(Math.max(0,wave-1)/6));