import { simulateCampaign } from '@/game/tests/balanceCampaign.mjs';
// Second independent block of campaign seeds (mover build only) for the
// range-multiplier confidence check. Deleted after measurement.
const seeds = Array.from({ length: 12 }, (_, i) => 7919 * (i + 13) + 20261103);
const results = [];
for (const seed of seeds) { const r = await simulateCampaign(seed, true); results.push({ seed, deathWave: r.deathWave, reached: r.reached }); }
console.log('MOVER_EXTRA', JSON.stringify({ deaths: results.map(r => r.deathWave), reached20: results.filter(r => r.reached >= 20).length, total: 12 }));