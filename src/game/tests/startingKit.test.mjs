import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, characterById } from '@/game/data/characters';
import { createRun, allowedWeapon } from '@/game/progression/runRules';
import { STARTER_OFFER_COUNT, startingOffers, startingPickCount, canPick, kitComplete, applyStartingKit } from '@/game/progression/startingKit';
import { WEAPON_ARCHETYPES } from '@/game/data/generation';
import { canCombine } from '@/game/items/tiers';
import { freshProfile } from '@/game/progression/profileModel';
import { validateProfile } from 'profileValidation';
import { simulateCampaign } from '@/game/tests/balanceCampaign.mjs';

const nomad = () => characterById('nomad');
const veteran = () => characterById('veteran');

test('starting offers: four distinct legal Basic tools, direct damage guaranteed, deterministic per seed', () => {
  for (const c of CHARACTERS) for (const seed of [1, 42, 7919, 20261103]) {
    const { offers, limitedBy } = startingOffers(c, seed);
    assert.equal(limitedBy, null, `${c.id} should not hit the pool limit`);
    assert.equal(offers.length, STARTER_OFFER_COUNT);
    assert.equal(new Set(offers.map(o => o.baseId)).size, offers.length, 'no duplicate identities inside the four');
    assert(offers.every(o => allowedWeapon(c, o)), `${c.id} was offered an illegal tool`);
    assert(offers.every(o => o.rarity === 'common' && o.tierVersion === 1));
    assert(offers.filter(o => o.pattern === 'turret').length <= 1, 'at most one turret offer, mirroring the one-per-technician cap');
    assert(offers.some(o => o.pattern !== 'turret'), 'at least one direct-damage tool so the run can never open unusable');
    const again = startingOffers(c, seed);
    assert.deepEqual(again.offers.map(o => [o.id, o.name, o.baseId]), offers.map(o => [o.id, o.name, o.baseId]), 'same seed + same character must roll identical offers');
  }
});

test('offers vary across seeds and honour ranged-only technicians', () => {
  const sets = new Set();
  for (let s = 1; s <= 40; s++) sets.add(startingOffers(nomad(), s).offers.map(o => o.baseId).sort().join(','));
  assert(sets.size >= 10, 'different seeds should produce different offer sets');
  const oracle = characterById('oracle');
  for (let s = 1; s <= 25; s++) {
    const { offers } = startingOffers(oracle, s);
    assert(offers.every(o => o.slotType === 'ranged'), 'ranged-only technician must never be offered a melee tool');
  }
});

test('a legal pool smaller than four is offered in full, unpadded, and the character is reported', () => {
  const { offers, limitedBy } = startingOffers(nomad(), 7, WEAPON_ARCHETYPES.slice(0, 3));
  assert.equal(offers.length, 3);
  assert.equal(limitedBy, 'nomad');
  assert.equal(new Set(offers.map(o => o.baseId)).size, 3);
  assert(offers.every(o => allowedWeapon(nomad(), o)));
});

test('pick requirements: the Veteran checks out exactly two, everyone else exactly one', () => {
  assert.equal(startingPickCount(veteran()), 2);
  assert(CHARACTERS.every(c => c.id !== 'veteran' ? startingPickCount(c) === 1 : true));
  for (const c of CHARACTERS) for (const seed of [5, 991]) {
    const { offers } = startingOffers(c, seed);
    const run = createRun(c, false, seed, `kit-${c.id}-${seed}`);
    const need = startingPickCount(c);
    const picked = offers.slice(0, need).map(o => o.id);
    const next = applyStartingKit(run, picked);
    assert.equal(next.weapons.length, need);
    assert(next.weapons.every(w => w.id.startsWith(`${run.runId}-start-`) && allowedWeapon(c, w) && w.rarity === 'common'));
    assert.equal(next.specialUnlocked, true, 'signature grant untouched');
    assert(validateProfile({ ...freshProfile(), checkpoint: { phase: 'ready', run: next } }, 'owner'));
    assert.throws(() => applyStartingKit(run, offers.slice(0, need + 1).map(o => o.id)), /exactly/);
    assert.throws(() => applyStartingKit(run, picked.slice(0, Math.max(0, need - 1))), /exactly/);
    assert.throws(() => applyStartingKit(run, ['not-an-offer']), /Unknown/);
  }
});

test('two-pick turret conflict: only one deployable turret tool can ever be selected', () => {
  const mk = (id, baseId, pattern) => ({ id, baseId, pattern, slotType: pattern === 'turret' ? 'ranged' : 'melee', rarity: 'common', name: baseId });
  const tray = mk('t1', 'tray', 'turret'), closure = mk('t2', 'closure', 'turret'), cleaver = mk('c1', 'cleaver', 'melee'), power = mk('p1', 'power', 'projectile');
  const offers = [tray, closure, cleaver, power];
  assert(canPick(veteran(), offers, [], 't1'));
  assert(!canPick(veteran(), offers, ['t1'], 't2'), 'a second turret tool must not be selectable after a turret pick');
  assert(canPick(veteran(), offers, ['t1'], 'c1'), 'a direct-damage second pick stays available');
  assert(!kitComplete(veteran(), offers, ['t1']));
  assert(kitComplete(veteran(), offers, ['t1', 'c1']));
  assert(!kitComplete(veteran(), offers, ['t1', 't2']), 'a double-turret kit is never complete');
  for (let s = 1; s <= 50; s++) {
    const rolled = startingOffers(veteran(), s).offers;
    assert(rolled.filter(o => o.pattern === 'turret').length <= 1, 'generation itself never offers two turret tools');
  }
});

test('starter tools are ordinary Basic-tier inventory: slots, combining and profile validation', () => {
  const { offers } = startingOffers(nomad(), 1234);
  const run = applyStartingKit(createRun(nomad(), false, 1234, 'ladder'), [offers[0].id]);
  assert.equal(run.weapons.length, 1);
  const twin = { ...run.weapons[0], id: 'twin' };
  assert(canCombine(run.weapons[0], twin), '2 Basic -> Rare via the existing tier ladder');
  assert(legalKitOk(run));
});
function legalKitOk(run) {
  return run.weapons.length <= run.character.slots && run.weapons.every(w => allowedWeapon(run.character, w));
}

const campaignSeeds = Array.from({ length: 12 }, (_, i) => 7919 * (i + 1) + 20261103);
const median = values => { const sorted = [...values].sort((a, b) => a - b), mid = sorted.length / 2; return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2; };
// Solo wave-1 clearing power of an offer: sustained single-target DPS for
// direct tools, cap × damage / fire for auto-deployed turret sentries.
const score = o => o.pattern === 'turret' ? o.turret.cap * o.damage / o.turret.fire : o.damage / o.rate * (o.pattern === 'chain' ? 3 : 1);

test('random openings: best-case and worst-case legal picks keep the Phase 2 balance targets', { timeout: 900000 }, async () => {
  const report = {};
  for (const kind of ['best', 'worst']) for (const moving of [false, true]) {
    const runs = [];
    for (const seed of campaignSeeds) {
      const ranked = [...startingOffers(nomad(), seed).offers].sort((a, b) => score(b) - score(a));
      runs.push(await simulateCampaign(seed, moving, 30, kind === 'best' ? ranked[0] : ranked.at(-1)));
    }
    const label = `${moving ? 'mover' : 'camper'}${kind === 'best' ? 'Best' : 'Worst'}`;
    report[label] = { deaths: runs.map(r => r.deathWave), medianDeath: median(runs.map(r => r.deathWave ?? 31)), reached20: runs.filter(r => r.reached >= 20).length };
  }
  console.log('STARTER_CAMPAIGNS', JSON.stringify({ ...report, seeds: campaignSeeds }));
  for (const key of ['camperBest', 'camperWorst']) assert(report[key].medianDeath <= 8, `${key} median death wave ${report[key].medianDeath} exceeds the wave-8 ceiling`);
  for (const key of ['moverBest', 'moverWorst']) assert(report[key].reached20 >= campaignSeeds.length / 2, `Only ${report[key].reached20}/${campaignSeeds.length} ${key} movers reached wave 20`);
});