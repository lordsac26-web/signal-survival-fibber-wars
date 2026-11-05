// FIELD ENGINEER acceptance suite: the 4-slot budget and per-category caps,
// deployable instance limits (3 per item vs the roster's 2), Fiber Splice
// Surge timing/damage/no-double-hit through the real engine, and the sprite
// sheet/portrait integrity after the magenta-key processing pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterById } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { createRun, rebuildStats, ENGINEER_CAPS, engineerCategory, engineerCapReason, engineerWeaponCapBlocked } from '@/game/progression/runRules';
import { acquireItem, hasCombineTarget } from '@/game/items/acquisition';
import { enterShop, shopTransaction, offerReason, swapTargets } from '@/game/shop/shopRules';
import { validateProfile } from 'profileValidation';
import { TUNING } from '@/game/data/tuning';
import { structureCap, structureItemCap, turretInstanceCap, ENGINEER_DEPLOY_CD_MULT, turretStats, structureTurretStats, PLACE_PROXIMITY } from '@/game/combat/deployableRules';
import { SURGE, surgeTotal, surgePulseTimes, surgePulseDamage } from '@/game/combat/fiberSplice';
import { STRUCTURES } from '@/game/data/structures';
import { characterSprite } from '@/game/art/characterSprites';
import { decodePng } from './pngDecode.mjs';
import { AVERAGE_BUILDS } from './balanceCampaign.mjs';
import { makeCanvas, pump, createSignalEngine, preloadCharacterSprite, preloadEnemySprite, preloadStructureSprite } from './engineHarness.mjs';

const weapon = (id, rarity = 'common') => ({ ...WEAPONS[id], baseId: id, id: `w-${id}`, rarity, mods: [] });
const eng = () => createRun(characterById('engineer'), false, 42, 'eng-test');
// The owner's legal full kit: 1 deployable tool + 1 ranged + 1 melee + 1 passive = exactly 4 slots.
const fullKit = () => ({ ...eng(), weapons: [weapon('tray'), weapon('vfl'), weapon('cleaver')], items: [{ id: 'gear', mods: [] }], deployables: [] });

test('caps: 4-slot budget with 1 ranged / 2 melee / 4 deployable per category; category classification is exact', () => {
  assert.deepEqual(ENGINEER_CAPS, { total: 4, ranged: 1, melee: 2, deployable: 4 });
  assert.equal(engineerCategory(weapon('tray')), 'deployable', 'turret-pattern tools are deployables');
  assert.equal(engineerCategory(weapon('cleaver')), 'melee');
  assert.equal(engineerCategory(weapon('vfl')), 'ranged');
  assert.equal(engineerCategory({ id: 'p', mods: [] }), 'passive');
  assert.equal(engineerCategory({ deploy: true, structure: 'barricade' }), 'deployable');
  assert.equal(engineerWeaponCapBlocked(eng(), weapon('cutters')), false, 'fresh kit has headroom for a melee add');
  assert.equal(engineerWeaponCapBlocked(eng(), weapon('otdr')), true, 'ranged slot is already taken by the starting power meter');
  const full = fullKit();
  assert.equal(engineerWeaponCapBlocked(full, weapon('otdr')), true, 'ranged slot taken');
  assert.equal(engineerWeaponCapBlocked(full, weapon('cutters')), true, 'budget full blocks even a legal-category add');
  assert.equal(engineerCapReason([...full.weapons, weapon('power')]), 'Ranged cap: 1 of 1 — replace or combine first');
  assert.equal(engineerCapReason([...full.weapons, weapon('cutters')]), '', 'a 2nd melee fits');
  assert.equal(engineerCapReason([...full.weapons, weapon('splicer'), weapon('cutters')]), 'Melee cap: 2 of 2 — replace or combine first');
  assert.equal(engineerCapReason([...full.weapons, weapon('cutters'), { deploy: true, structure: 'barricade' }]), 'Slot cap: 4 of 4 — sell or combine first');
  const character = characterById('engineer');
  assert(!character.unlock, 'immediately selectable');
  assert.equal(character.special.id, 'surge');
  assert(character.special.desc.includes('20% max HP'), 'repair magnitude is in the ability text');
});

test('acquisition: full-budget passive refused, same-category replacement keeps the kit at 4, illegal cross-category replacement refused', () => {
  const run = fullKit();
  assert.throws(() => acquireItem(run, { id: 'pass', name: 'p', mods: [], rarity: 'common' }), /exactly 4 items total/);
  assert.throws(() => acquireItem(run, weapon('power')), /exactly 4 items total/, 'a plain add with no replacement hits the budget guard');
  const next = acquireItem(run, weapon('power'), { replaceId: 'w-vfl' });
  assert.deepEqual(next.weapons.map(w => w.baseId).sort(), ['cleaver', 'power', 'tray']);
  assert.equal(next.items.length, 1);
  assert.equal(next.weapons.length + next.items.length + next.deployables.length, 4);
  // swapping the deployable slot for a ranged tool exceeds the ranged cap — the post-add validation catches it
  assert.throws(() => acquireItem(run, weapon('power'), { replaceId: 'w-tray' }), /Ranged cap/);
  // the full shop path routes the same swap through the picker
  const s = { ...run, shop: { wave: 1, offers: [{ ...weapon('power'), cost: 50 }, null, null, null], sequence: 1, rerolls: 0 }, signal: 100 };
  const bought = shopTransaction(s, { type: 'buy', offerId: 'w-power', replaceId: 'w-vfl' });
  assert.deepEqual(bought.weapons.map(w => w.baseId).sort(), ['cleaver', 'power', 'tray']);
  assert.equal(bought.signal, 50);
});

test('shop: capped weapons stay offerable through the same-category swap; a full-budget engineer is never offered a passive or deployable item', () => {
  const run = fullKit();
  const rangedOffer = weapon('otdr');
  assert.equal(offerReason(run, rangedOffer), '');
  assert.deepEqual(swapTargets(run, rangedOffer).map(w => w.id), ['w-vfl']);
  assert.equal(offerReason(run, { id: 'pass', name: 'p', mods: [], rarity: 'common', cost: 10 }), 'Field Engineer carries exactly 4 items total — sell or combine first.');
  for (let wave = 1; wave <= 60; wave++) {
    const s = enterShop({ ...run, wave, signal: 9999 });
    for (const o of s.shop.offers) {
      assert(o, `wave ${wave}: offers never run dry`);
      assert(o.baseId, `wave ${wave}: no passive or deployable item at a full budget`);
      assert(swapTargets(s, o).length > 0 || hasCombineTarget(s, o), `wave ${wave}: every offered tool has a legal path (same-category swap or combine target)`);
      assert.equal(offerReason(s, o), '', `wave ${wave}: offered tools are purchasable`);
    }
  }
});

test('server validation: engineer category caps are enforced on saves', () => {
  const legal = eng();
  assert.doesNotThrow(() => validateProfile({ checkpoint: { phase: 'ready', run: legal } }, 'owner'));
  const twoRanged = { ...legal, weapons: [weapon('power'), weapon('otdr')] };
  assert.throws(() => validateProfile({ checkpoint: { phase: 'ready', run: twoRanged } }, 'owner'), /category cap/);
  const fiveItems = { ...legal, items: [{ id: 'a', mods: [] }, { id: 'b', mods: [] }, { id: 'c', mods: [] }] };
  assert.throws(() => validateProfile({ checkpoint: { phase: 'ready', run: fiveItems } }, 'owner'), /budget exceeded/);
});

test('deployable instance caps: engineer 3 per item / 12 global, everyone else 2 / 2; 60% re-arm; sentries inherit his multipliers', () => {
  const e = eng(), other = createRun(characterById('don'), false, 42, 'don-test');
  assert.equal(TUNING.engineerDeployInstanceCap, 3);
  assert.equal(structureItemCap(e), 3);
  assert.equal(structureItemCap(other), TUNING.structureCap);
  assert.equal(TUNING.structureCap, 2);
  assert.equal(turretInstanceCap(e), 3);
  assert.equal(turretInstanceCap(other), TUNING.deployInstanceCap);
  assert.equal(TUNING.deployInstanceCap, 2);
  assert.equal(structureCap(e), TUNING.engineerStructureCap);
  assert.equal(TUNING.engineerStructureCap, 12);
  assert.equal(structureCap(other), 2);
  assert.equal(ENGINEER_DEPLOY_CD_MULT, .6);
  assert.equal(PLACE_PROXIMITY, 90);
  const boosted = { ...e, damage: 2, attackSpeed: 2 };
  const own = turretStats(boosted, weapon('tray'), { fire: .45 });
  assert(Math.abs(own.damage - 13 * 1.1 * 2) < 1e-9, 'his sentry damage rides weapon roll + engineering + HIS damage multiplier');
  assert.equal(own.fire, .225, 'his sentry fire rate rides HIS attack speed');
  const foreign = turretStats({ ...other, damage: 2, attackSpeed: 2 }, weapon('tray'), { fire: .45 });
  assert(Math.abs(foreign.damage - 13 * 1.08) < 1e-9, "Don's sentry ignores his damage multiplier");
  assert.equal(foreign.fire, .45, "Don's sentry ignores his attack speed");
  const mount = structureTurretStats(boosted, STRUCTURES.turretMount, 1);
  assert(Math.abs(mount.damage - 9 * 1.1 * 2) < 1e-9);
  assert.equal(mount.fire, .225);
});

test('campaign fixture: the engineer average build fits his exact 4-slot budget with the shared gear passive', () => {
  const build = AVERAGE_BUILDS.engineer.mover;
  assert.deepEqual(build, ['tray', 'vfl', 'cleaver']);
  assert.equal(engineerCapReason([...build.map(id => weapon(id)), { id: 'fixture-gear', mods: [] }]), '', 'the fixture must be acquirable or every intermission purchase refuses');
  for (const id of ['nomad', 'veteran', 'oracle', 'don', 'admin', 'clone', 'isr']) assert(AVERAGE_BUILDS[id].mover.length >= 4, `${id} fixture untouched`);
});

// ---- real-engine encounters -------------------------------------------------
const names = ['lag', 'bucket', 'squirrel', 'dirty', 'pedestal_turret', 'packet', 'jitter', 'pete', 'bend', 'crosstalk', 'attenuation', 'rous'];
const artCache = new Map();
async function arts() {
  if (!artCache.has('e')) {
    const rest = await Promise.all(names.map((id, i) => [1, 4].includes(i) ? preloadStructureSprite(id) : preloadEnemySprite(id)));
    artCache.set('e', [await preloadCharacterSprite('engineer'), ...rest]);
  }
  return artCache.get('e');
}
function context() { const cache = {}; return new Proxy({ imageSmoothingEnabled: false }, { get(t, key) { return t[key] ?? (cache[key] ??= String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : () => {}); }, set(t, key, value) { t[key] = value; return true; } }); }
async function encounter(configure) {
  const run = createRun(characterById('engineer'), false, 42, 'eng-enc');
  configure(run);
  const canvas = makeCanvas(1100, 800, { ctx: context() });
  const input = { current: { x: 0, y: 0 } };
  const state = { flashes: [], events: [], samples: [] };
  const cleanup = createSignalEngine(canvas, run, input, {
    simulation: true, hud() {}, flash: m => state.flashes.push(m), finish: r => { state.finished = r }, event: e => state.events.push(e), inspect: s => state.samples.push(s)
  }, { current: false }, ...(await arts()));
  return { run, input, state, cleanup };
}

test('engine placement: one deployable item fields 3 concurrent instances, the 4th is refused while all live', { timeout: 120000 }, async () => {
  const h = await encounter(r => { r.wave = 6; r.hp = 3000; r.maxHp = 3000; r.armor = 60; r.deployables = [{ id: 'cone', structure: 'barricade', name: 'Traffic Barricade Kit', icon: '🚧', stacks: 1, deploy: true }] });
  try {
    pump(1 / 60);
    const posts = () => h.state.samples.at(-1)?.posts ?? [];
    const place = () => { h.input.current.deploy = true; pump(1 / 60); };
    const step = () => { h.input.current.x = 1; pump(.5); h.input.current.x = 0; };
    place(); assert.equal(posts().length, 1, 'first barricade placed');
    // each placement re-arms in 9s x .6 = 5.4s; the barricade lives 20s, so three overlap
    step(); pump(5); place();
    step(); pump(5); place();
    assert.equal(posts().length, 3, 'three concurrent instances of one item (engineer cap), not the roster 2');
    step(); pump(5); // past the re-arm; all three still alive (life 20s)
    place();
    assert.equal(posts().length, 3);
    assert(h.state.flashes.some(f => f.includes('ALL ITS UNITS OUT')), '4th placement refused at the per-item cap');
    assert(!h.state.flashes.some(f => f.includes('PERMIT LIMIT')), 'the 12-structure global cap is not what refused it');
  } finally { h.cleanup(); }
});

test('Fiber Splice Surge numbers: arming .8s, 4 pulses over 4s, ring 170, repair 20% + 30% haste for 5s, damage rides the wave curve', () => {
  assert.deepEqual(SURGE, { cooldown: 18, arming: .8, pulses: 4, pulseWindow: 4, ringRadius: 170, repairPct: .2, haste: .3, hasteDuration: 5 });
  assert.equal(surgeTotal(), 4.8);
  assert.deepEqual(surgePulseTimes(), [1.8, 2.8, 3.8, 4.8]);
  const character = characterById('engineer');
  assert.equal(character.special.cooldown, 18);
  const kit = { weapons: [weapon('tray'), weapon('power')], level: 0 };
  assert.equal(surgePulseDamage(kit, 1), 33, 'wave 1: 12 + .6 x (13+22) gear');
  assert.equal(surgePulseDamage(kit, 10), Math.round(33 * (1 + .18 * 9 + .006 * 81)), 'wave 10 rides the quadratic curve');
  assert.equal(surgePulseDamage(kit, 20), Math.round(33 * (1 + .18 * 19 + .006 * 361)), 'wave 20 rides the quadratic curve');
  assert.equal(surgePulseDamage({ ...kit, level: 3 }, 1), 39, '+2 per level');
  assert.equal(surgePulseDamage({ weapons: [], level: 0 }, 1), 12, 'bare kit floor');
});

test('engine surge: the cabinet plants at his feet, all 4 pulses fire (including the final one), each pulse hits an in-range impairment exactly once', { timeout: 120000 }, async () => {
  const h = await encounter(r => { r.wave = 6; r.hp = 5000; r.maxHp = 5000; r.armor = 80; r.crit = 0; r.spliceQuality = 0; r.weapons = []; });
  try {
    pump(14); // wave-6 impairments are slow and tanky; let them converge to his feet first
    h.input.current.special = true; pump(.1); // one frame consumes the press, the next plants the cabinet
    const start = h.state.events.find(e => e.type === 'surgeStart');
    assert(start, 'surge activates');
    assert.equal(start.duration, 4.8);
    assert.equal(start.arming, .8);
    assert.equal(start.radius, 170);
    assert(Math.abs(start.x - 550) < 1 && Math.abs(start.y - 400) < 1, 'the cabinet plants at his feet');
    pump(5.5);
    const pulses = h.state.events.filter(e => e.type === 'surgePulse');
    assert.equal(pulses.length, 4, 'all four pulses fire, including the final pulse at the window end');
    const damage = surgePulseDamage(h.run, 6);
    for (const p of pulses) assert.equal(p.damage, damage, 'pulse damage matches the report');
    // no double-hit: between consecutive pulses no impairment loses more than one pulse of HP
    const times = surgePulseTimes();
    const snap = limit => h.state.samples.filter(s => s.surge && s.surge.elapsed < limit).at(-1);
    let landed = 0;
    for (let k = 0; k < 4; k++) {
      const before = snap(times[k]), after = snap(k < 3 ? times[k + 1] : 4.85);
      const a = new Map(after.foes.map(f => [f.index, f]));
      for (const f of before.foes) {
        const later = a.get(f.index);
        if (!later) continue;
        const drop = f.hp - later.hp;
        assert(drop <= damage + 1e-9, `foe ${f.index} lost ${drop} HP between pulses ${k + 1} and ${k + 2} — a single pulse may only hit once`);
        if (Math.hypot(f.x - start.x, f.y - start.y) < start.radius - 20 && drop > damage - 1e-9) landed++;
      }
    }
    assert(landed > 0, 'at least one in-range impairment takes exactly one full pulse of damage');
  } finally { h.cleanup(); }
});

test('engine surge repair: a deployed turret mount receives the repair haste while the pulses run', { timeout: 120000 }, async () => {
  const h = await encounter(r => { r.wave = 6; r.hp = 5000; r.maxHp = 5000; r.armor = 80; r.crit = 0; r.spliceQuality = 0; r.weapons = []; r.deployables = [{ id: 'mount', structure: 'turretMount', name: 'Turret Mount', icon: '🔩', stacks: 1, deploy: true }] });
  try {
    pump(14); // impairments converge
    h.input.current.deploy = true; pump(1 / 60); // Q: plant the mount
    assert(h.state.samples.at(-1)?.posts?.some(p => p.type === 'turretMount'), 'mount placed');
    h.input.current.special = true; pump(.1);
    pump(5);
    assert(h.state.samples.some(s => s.posts?.some(p => p.type === 'turretMount' && p.haste > 0)), 'the mount carries the +30% repair haste during the pulse window');
  } finally { h.cleanup(); }
});

test('engineer sheet: every strip decodes at declared size, frames nonempty and bottom-aligned, no bright magenta; manifest matches the definition; portrait is a bottom-anchored figure inside the frame', () => {
  const def = characterSprite('engineer');
  assert.equal(def.anchorY, .9);
  assert.equal(def.worldSize, 64);
  assert.equal(def.deathColumns, 8);
  assert.deepEqual(def.muzzle, { x: 89, y: 36, cellW: 128, cellH: 81 });
  const manifest = JSON.parse(readFileSync(new URL('../../../public/assets/engineer/animation.json', import.meta.url)));
  const resolve = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  for (const [key, value] of Object.entries(def.manifestSpec)) assert.deepEqual(resolve(manifest, key), value, `manifest ${key}`);
  const cellSpec = { 'idle-front.png': [8, 67, 83], 'walk-side.png': [8, 68, 80], 'walk-left.png': [8, 61, 78], 'attack.png': [7, 128, 81], 'special.png': [8, 121, 103], 'death.png': [8, 129, 82] };
  for (const [file, [frames, cw, ch]] of Object.entries(cellSpec)) {
    const img = decodePng(readFileSync(new URL(`../../../public/assets/engineer/${file}`, import.meta.url)));
    assert.equal(img.width, frames * cw, `${file} width`);
    assert.equal(img.height, ch, `${file} height`);
    for (let f = 0; f < frames; f++) {
      let opaque = 0, lowest = -1;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = (y * img.width + f * cw + x) * 4;
        if (img.rgba[i + 3] > 40) {
          opaque++; if (y > lowest) lowest = y;
          const r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
          assert(!(r > 235 && g < 90 && b > 235), `${file} frame ${f}: bright magenta residue`);
        }
      }
      assert(opaque > 40, `${file} frame ${f} is nonempty`);
      assert(lowest >= ch - 6, `${file} frame ${f} body reaches the cell baseline (bottom-aligned)`);
    }
  }
  // The portrait is the resampled figure bottom-anchored in a 67x93 field
  // (smaller than the cell so the selection card crops nothing).
  const portrait = decodePng(readFileSync(new URL('../../../public/assets/engineer/portrait.png', import.meta.url)));
  assert.equal(portrait.width, def.portraitW);
  assert.equal(portrait.height, def.portraitH);
  let opaque = 0, minx = 99, miny = 99, maxx = -1, maxy = -1;
  for (let y = 0; y < portrait.height; y++) for (let x = 0; x < portrait.width; x++) {
    const i = (y * portrait.width + x) * 4, a = portrait.rgba[i + 3];
    if (a > 40) {
      opaque++;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      const r = portrait.rgba[i], g = portrait.rgba[i + 1], b = portrait.rgba[i + 2];
      assert(!(r > 235 && g < 90 && b > 235), 'portrait has no bright magenta residue');
    }
  }
  assert(opaque > 400, 'portrait holds a full figure');
  assert.equal(maxy, portrait.height - 1, 'figure is bottom-anchored on the baseline');
  assert(miny > 0 && maxx < portrait.width - 1 && minx > 0, 'figure sits inside the frame with margin');
});