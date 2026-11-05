import { WEAPON_ARCHETYPES, createGenerator, seeded } from '@/game/data/generation';
import { allowedWeapon, legalLoadout, normalizeWeapon, rebuildStats } from '@/game/progression/runRules';
import { TUNING } from '@/game/data/tuning';

// STARTING KIT CHOICE: every run opens with four rolled Basic tools instead
// of a preset kit. Generation lives in ONE function (startingOffers) seeded
// from the run seed, so a reroll can be added later by re-rolling the seed.
export const STARTER_OFFER_COUNT = 4;
const isTurret = a => a[2] === 'turret';

export function legalStartPool(c, pool = WEAPON_ARCHETYPES) {
  return pool.filter(a => allowedWeapon(c, { pattern: a[2] }));
}

export function startingPickCount(c) {
  return c.id === 'veteran' ? 2 : 1;
}

// Seeded from the run seed: same seed + same character always produce the
// same four offers. Offers respect the character's tool restrictions, carry
// no duplicate identities, offer at most ONE deployable turret tool (mirrors
// the shop's one-per-technician inventory cap), and always include at least
// one direct-damage tool. A legal pool smaller than four offers everything
// legal and reports which character hit the limit.
export function startingOffers(c, seed, pool = WEAPON_ARCHETYPES, useAlt = false) {
  const legal = legalStartPool(c, pool);
  const want = Math.min(STARTER_OFFER_COUNT, legal.length);
  const limitedBy = legal.length < STARTER_OFFER_COUNT ? c.id : null;
  const r = seeded(seed);
  const order = [...legal];
  for (let i = 0; i < order.length && i < want; i++) { // partial Fisher-Yates
    const j = i + ((r() * (order.length - i)) | 0);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const chosen = [];
  let turretOffered = false;
  if (useAlt && Array.isArray(c.altStart)) {
    for (const id of c.altStart) {
      if (chosen.length >= want) break;
      const a = legal.find(x => x[0] === id);
      if (!a || chosen.includes(a)) continue;
      if (isTurret(a)) { if (turretOffered) continue; turretOffered = true; }
      chosen.push(a);
    }
  }
  for (const a of order) {
    if (chosen.length >= want) break;
    if (chosen.includes(a)) continue;
    if (isTurret(a)) { if (turretOffered) continue; turretOffered = true; }
    chosen.push(a);
  }
  // Safety guard: a run can never open with four pure-utility picks.
  if (want > 1 && chosen.every(isTurret)) {
    const swap = legal.find(a => !isTurret(a));
    if (swap) chosen[chosen.length - 1] = swap;
  }
  const gen = createGenerator(seed);
  return { offers: chosen.map(a => gen.weapon(0, [a], 'Common')), limitedBy };
}

// Selection rules for the pick screen: distinct identities only, the exact
// per-character pick count, and at most one turret tool across all picks.
export function canPick(c, offers, pickedIds, id) {
  const item = offers.find(o => o.id === id);
  if (!item || pickedIds.includes(id) || pickedIds.length >= startingPickCount(c)) return false;
  if (item.pattern === 'turret' && offers.some(o => pickedIds.includes(o.id) && o.pattern === 'turret')) return false;
  return true;
}

export function kitComplete(c, offers, pickedIds) {
  if (pickedIds.length !== startingPickCount(c)) return false;
  const picked = offers.filter(o => pickedIds.includes(o.id));
  return picked.length === pickedIds.length && picked.filter(o => o.pattern === 'turret').length <= 1;
}

// The pick commits: selected tools become owned, equipped Basic-tier weapons
// occupying slots normally, and the rest of the run (signature grant, stats,
// shop rules) is untouched.
export function applyStartingKit(run, pickedIds) {
  const { offers } = startingOffers(run.character, run.seed, WEAPON_ARCHETYPES, Boolean(run.useAlt));
  const picked = pickedIds.map(id => offers.find(o => o.id === id));
  if (picked.some(w => !w)) throw new Error('Unknown starting tool');
  if (new Set(pickedIds).size !== pickedIds.length) throw new Error('Each starting tool may be picked once');
  if (pickedIds.length !== startingPickCount(run.character)) throw new Error(`${run.character.name} checks out exactly ${startingPickCount(run.character)} starting tool(s)`);
  if (picked.filter(w => w.pattern === 'turret').length > 1) throw new Error('Only one deployable turret tool per technician');
  const rankCap = run.character.id === 'clone' ? TUNING.cloneOverclockCap : TUNING.overclockRankCap;
  const weapons = picked.map((w, i) => normalizeWeapon({ ...w, id: `${run.runId}-start-${i}` }, i, rankCap));
  if (!legalLoadout(run.character, weapons)) throw new Error('Starting kit violates loadout rules');
  return rebuildStats({ ...run, weapons });
}