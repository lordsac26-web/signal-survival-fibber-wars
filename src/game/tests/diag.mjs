import { simulateCampaign } from '@/game/tests/balanceCampaign.mjs';
for (const charId of ['nomad','engineer']) {
  const r = await simulateCampaign(911, true, 8, null, charId);
  const rows = r.rows.map(row => `w${row.wave}:k${row.kills}hp${Math.round(row.hp)}lv${row.level}`).join(' ');
  console.log(charId, 'deathWave', r.deathWave, rows);
}