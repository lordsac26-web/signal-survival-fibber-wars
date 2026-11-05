// Per-character real-engine balance campaigns (playtest item 2): every
// technician with an average legal build, moving and stationary, measured
// through the same verified engine harness as the Phase 2 campaigns. The
// Oracle camper band and the wave-20 clear requirement come from the owner's
// armour brief; the printed table is the before/after evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateCampaign } from '@/game/tests/balanceCampaign.mjs';
import { CHARACTERS } from '@/game/data/characters';

const seeds = [911, 1723, 2741, 3671];
const median = values => { const sorted = [...values].sort((a,b)=>a-b), mid = sorted.length/2; return sorted.length%2 ? sorted[Math.floor(mid)] : (sorted[mid-1]+sorted[mid])/2 };
const chars = CHARACTERS.map(c=>c.id);

test('every technician with an average build clears wave 20 moving; campers die inside the early band', {timeout: 600000}, async()=>{
  const report = {};
  for(const id of chars){
    const campers = [], movers = [];
    for(const seed of seeds){ campers.push(await simulateCampaign(seed,false,30,null,id)); movers.push(await simulateCampaign(seed,true,30,null,id)); }
    report[id] = {
      camperMedian: median(campers.map(r=>r.deathWave ?? 31)),
      camperDeaths: campers.map(r=>r.deathWave),
      moverClears: movers.filter(r=>r.reached>=20).length,
      moverDeaths: movers.map(r=>r.deathWave)
    };
  }
  console.log('CHARACTER_BALANCE_TABLE', JSON.stringify({seeds, report}));
  for(const id of chars) assert(report[id].moverClears >= seeds.length/2, `${id} movers clearing wave 20: ${report[id].moverClears}/${seeds.length}`);
  for(const id of chars) assert(report[id].camperMedian <= 8, `${id} camper median ${report[id].camperMedian} exceeds the wave-8 band`);
});