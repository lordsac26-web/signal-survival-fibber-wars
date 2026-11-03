import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterById } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { MEETING, meetingTableSpot, meetingBlastTotal, meetingBlastShare } from '@/game/combat/meetingInvite';
import { characterSprite } from '@/game/art/characterSprites';
import { legalLoadout, normalizeRun, normalizeWeapon, rebuildStats } from '@/game/progression/runRules';
import { shopTransaction } from '@/game/shop/shopRules';
import { statBreakdown } from '@/game/data/stats';
import { guideEntries } from '@/game/data/reference';
import { startEncounter, baseRun, pump } from './engineHarness.mjs';
import { decodePng } from './pngDecode.mjs';

const file = p => readFileSync(new URL('../../../public' + p, import.meta.url));
const def = characterSprite('admin');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('admin assets: manifest matches, all six strips decode at exact sizes, every cell nonempty, zero magenta', () => {
  const manifest = JSON.parse(file(def.manifest));
  for (const [key, expected] of Object.entries(def.manifestSpec)) {
    const actual = key.split('.').reduce((o, k) => o?.[k], manifest);
    assert.equal(actual, expected, `manifest ${key}`);
  }
  assert.deepEqual(def.muzzle, { x: 169, y: 40, cellW: 232, cellH: 102 });
  const strips = [
    ['idle-front.png', 608, 118, 76, 118, 8],
    ['walk-side.png', 528, 107, 66, 107, 8],
    ['walk-left.png', 496, 103, 62, 103, 8],
    ['attack.png', 1624, 102, 232, 102, 7],
    ['special.png', 1216, 125, 152, 125, 8],
    ['death.png', 826, 88, 118, 88, 7],
    ['portrait.png', 76, 128, 76, 128, 1]
  ];
  const isMagenta = (r, g, b) => r > 180 && b > 140 && g < 100;
  for (const [name, w, h, cw, ch, cols] of strips) {
    const png = decodePng(file('/assets/admin/' + name));
    assert.equal(png.width, w, name);
    assert.equal(png.height, h, name);
    let magenta = 0;
    const opaque = new Array(cols).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = png.rgba[i], g = png.rgba[i + 1], b = png.rgba[i + 2], a = png.rgba[i + 3];
      if (a > 0) { if (isMagenta(r, g, b)) magenta++; opaque[Math.min(cols - 1, (x / cw) | 0)]++; }
    }
    assert.equal(magenta, 0, `${name}: no magenta halo`);
    for (let k = 0; k < cols; k++) assert.ok(opaque[k] > 200, `${name} cell ${k} has body pixels (${opaque[k]})`);
  }
});

test('admin art: genuine left-facing walk art (not a mirror of the right row), solo activation frames only', () => {
  const walkR = decodePng(file('/assets/admin/walk-side.png'));
  const walkL = decodePng(file('/assets/admin/walk-left.png'));
  // Mirror walk-right frame k over its body centre, align to the left strip
  // (bottom-anchored, centre-offset), and compare opaque masks. A
  // programmatic mirror of the same pose would match almost exactly;
  // genuine left art differs heavily in every frame.
  for (let k = 0; k < 8; k++) {
    let mismatch = 0;
    for (let y = 0; y < 103; y++) for (let x = 0; x < 62; x++) {
      const a = walkL.rgba[(y * 496 + k * 62 + x) * 4 + 3] > 0;
      const b = walkR.rgba[((y + 4) * 528 + k * 66 + (63 - x)) * 4 + 3] > 0;
      if (a !== b) mismatch++;
    }
    assert.ok(mismatch > 500, `walk-left frame ${k} is genuine art, not a mirrored copy (${mismatch} mask pixels differ)`);
  }
  assert.equal(def.specialActivationFrames, 3, 'engine plays only the three solo phone/gesture activation frames');
  assert.equal(def.specialDuration, MEETING.duration);
  assert.equal(def.idleBreathFrames, 6); // idle frames 6-7 are the mug-lift gestures
  assert.equal(def.deathColumns, 7);
});

test('admin stat contract: 30% dodge, 75% damage, 4 mixed slots, 20s Meeting Invite, stable id and starter kit', () => {
  const c = characterById('admin');
  assert.equal(c.id, 'admin');
  assert.deepEqual(c.start, ['stripper']);
  assert.equal(c.slots, 4);
  assert.equal(c.restriction, 'any');
  assert.equal(c.stats.dodge, .30);
  assert.equal(c.stats.damage, .75);
  assert.equal(c.special.id, 'meeting');
  assert.equal(c.special.cooldown, 20);
  assert.equal(MEETING.duration, 4);
  assert.equal(MEETING.blastRadius, 150);
  assert.equal(MEETING.damageMult, 8);
});

test('dodge cap: 30% base + gear clamps at the 50% global cap, and the UI shows the capped note', () => {
  const run = baseRun('admin');
  run.items = [{ id: 'i', mods: [{ stat: 'dodge', value: .3 }] }];
  const next = rebuildStats(run);
  assert.equal(next.dodge, .5, 'cap applies after base + all gear sources');
  assert.match(statBreakdown(next, 'dodge').text, /capped at 50%/);
  const overkill = rebuildStats({ ...run, items: [{ id: 'i', mods: [{ stat: 'dodge', value: .9 }] }] });
  assert.equal(overkill.dodge, .5);
});

test('4-slot limit: acquisition blocked at five tools, enforced as a swap, legacy saves trimmed to four', () => {
  const c = characterById('admin');
  const mk = (id, base) => ({ ...WEAPONS[base], baseId: base, id, mods: [] });
  const four = ['cleaver', 'otdr', 'power', 'stripper'].map((b, i) => normalizeWeapon(mk(`w${i}`, b)));
  const five = [...four, normalizeWeapon(mk('w4', 'cleaner'))];
  assert.ok(legalLoadout(c, four));
  assert.ok(!legalLoadout(c, five), 'five tools never fit the Admin');
  const run = baseRun('admin');
  run.signal = 100;
  run.weapons = four;
  run.shop = { wave: 1, sequence: 1, rerolls: 0, offers: [{ id: 'offer1', baseId: 'cleaner', pattern: 'cone', slotType: 'melee', family: 'squirt', damage: 15, rate: .72, range: 155, mods: [], cost: 10, rarity: 'Common' }] };
  assert.throws(() => shopTransaction(run, { type: 'buy', offerId: 'offer1' }), /slot or family cap reached/);
  const swapped = shopTransaction(run, { type: 'buy', offerId: 'offer1', replaceId: 'w0' });
  assert.equal(swapped.weapons.length, 4, 'a 5th tool is only ever a replacement, never a 5th slot');
  assert.ok(swapped.weapons.some(w => w.baseId === 'cleaner'));
  const legacy = normalizeRun({ runId: 'r1', checkpointId: 'r1:start', character: { id: 'admin' }, wave: 3, hp: 50, weapons: five, items: [], deployables: [] });
  assert.equal(legacy.weapons.length, 4, 'legacy 5-6 tool admin saves normalize down to four');
});

test('meeting table spawn clamp: fully inside the view and world, degenerate windows fall back to world bounds', () => {
  const r = MEETING.tableRadius;
  for (const [px, py, vx, vy, vw, vh] of [[20, 20, 0, 0, 1100, 800], [550, 400, 0, 0, 1100, 800], [560, 40, 340, 250, 440, 300], [1080, 780, 540, 390, 560, 410]]) {
    const s = meetingTableSpot(px, py, vx, vy, vw, vh, 1100, 800);
    assert.ok(s.x >= r + 12 && s.x <= 1100 - r - 12 && s.y >= r + 12 && s.y <= 800 - r - 12, `in world bounds at ${px},${py}`);
  }
  const tiny = meetingTableSpot(550, 400, 540, 390, 20, 20, 1100, 800);
  assert.ok(tiny.x >= r + 12 && tiny.x <= 1100 - r - 12 && tiny.y >= r + 12 && tiny.y <= 800 - r - 12);
  assert.equal(meetingBlastShare(meetingBlastTotal(8), 8), 8);
  assert.equal(meetingBlastTotal(88), 704);
});

test('engine: table in-bounds, contact damage declined for exactly 4s, lure redirects, then damage resumes; pause freezes; reactivation blocked', async () => {
  const e = await startEncounter({
    charId: 'admin', width: 1100, height: 800,
    configure: run => { run.wave = 1; run.regen = 0; run.crit = 0; run.luck = 0; run.cleanliness = 0; run.spliceQuality = 0; run.hp = 3000; run.maxHp = 3000; }
  });
  try {
    e.until(() => e.samples.some(s => s.player.hp < 3000), 25); // first damage landed (wave 1: lag + pudding contact and goo)
    e.input.current.special = true;
    e.until(() => e.events.some(ev => ev.type === 'meetingStart'), 5);
    const start = e.events.find(ev => ev.type === 'meetingStart');
    assert.equal(start.radius, MEETING.blastRadius);
    assert.equal(start.duration, MEETING.duration);
    assert.ok(start.x >= MEETING.tableRadius + 12 && start.x <= 1100 - MEETING.tableRadius - 12 && start.y >= MEETING.tableRadius + 12 && start.y <= 800 - MEETING.tableRadius - 12, 'table fully inside world bounds');
    // pause freezes every meeting clock: no sim steps while paused
    const pausedSamples = e.samples.length;
    e.paused.current = true;
    pump(1.5);
    assert.equal(e.samples.length, pausedSamples, 'no fixed steps while paused');
    e.paused.current = false;
    // walk into the lured crowd at the table so contact keeps knocking during the meeting
    e.input.current.x = Math.sign(start.x - e.state.player.x);
    e.input.current.y = Math.sign(start.y - e.state.player.y);
    pump(.5);
    e.input.current.x = 0; e.input.current.y = 0;
    e.until(() => e.events.some(ev => ev.type === 'meetingExplode'), 10);
    const window = e.samples.filter(s => s.meeting);
    assert.ok(window.length > 10, 'meeting samples recorded');
    // Safe sample: no goo within reach of the player — at wave 1 the only
    // non-contact damage source is a puddle tick, which needs adjacency.
    const safe = s => !s.puddles.some(d => Math.hypot(d.x - s.player.x, d.y - s.player.y) < 45);
    const contact = s => s.foes.some(f => Math.hypot(f.x - s.player.x, f.y - s.player.y) < f.radius + s.player.r + 2);
    assert.ok(window.some(s => safe(s) && contact(s)), 'an enemy was in contact range during the meeting');
    for (let i = 1; i < window.length; i++) {
      const a = window[i - 1], b = window[i];
      if (safe(a) && safe(b)) assert.equal(b.player.hp, a.player.hp, 'contact damage declined between consecutive safe frames (regen 0)');
    }
    const lure = window.some(s => {
      const foes = s.foes;
      if (foes.length < 2) return false;
      const dT = foes.reduce((acc, f) => acc + Math.hypot(f.x - s.meeting.x, f.y - s.meeting.y), 0);
      const dP = foes.reduce((acc, f) => acc + Math.hypot(f.x - s.player.x, f.y - s.player.y), 0);
      return dT < dP;
    });
    assert.ok(lure, 'enemies steered toward the table over the player while lured');
    const explode = e.events.find(ev => ev.type === 'meetingExplode');
    assert.ok(near(explode.time - start.time, 4, 1 / 60 + 1e-3), `blast at exactly 4s (${explode.time - start.time})`);
    assert.equal(e.events.filter(ev => ev.type === 'meetingExplode').length, 1, 'one explosion per activation');
    assert.ok(e.state.specialCooldown > 15 && e.state.specialCooldown <= 16.5, `cooldown running at expiry (${e.state.specialCooldown})`);
    // reactivation blocked while on cooldown
    e.input.current.special = true;
    pump(2);
    assert.equal(e.events.filter(ev => ev.type === 'meetingStart').length, 1);
    // after the meeting, damage resumes on the player standing in the crowd
    const hpAtExplosion = e.state.player.hp;
    e.until(() => e.state.player.hp < hpAtExplosion, 12);
  } finally { e.cleanup(); }
});

test('engine: blast math — 8x combined weapon damage split evenly, applied once per enemy through the 0.75 multiplier', async () => {
  const e = await startEncounter({
    charId: 'admin', width: 1100, height: 800,
    configure: run => { run.crit = 0; run.luck = 0; run.cleanliness = 0; run.spliceQuality = 0; run.hp = 3000; run.maxHp = 3000; }
  });
  try {
    e.until(() => e.state && e.state.foes.length >= 5 && e.state.foes.some(f => Math.hypot(f.x - e.state.player.x, f.y - e.state.player.y) < 150), 40);
    for (const s of e.samples) assert.ok(near(s.damageDealt % 6, 0, 1e-9), `0.75 x 8 stripper damage applied exactly once (${s.damageDealt})`);
    e.input.current.special = true;
    e.until(() => e.events.some(ev => ev.type === 'meetingStart'), 5);
    e.until(() => e.events.some(ev => ev.type === 'meetingExplode'), 10);
    const explode = e.events.find(ev => ev.type === 'meetingExplode');
    assert.equal(explode.total, 64, '8x the single 8-damage stripper');
    assert.ok(explode.targets >= 1, 'at least one enemy in the blast radius');
    assert.ok(near(explode.share * explode.targets, 64, .01), 'split sums back to the total');
    const before = e.samples.filter(s => s.meeting).at(-1), after = e.samples.filter(s => !s.meeting && !s.dying).at(-1);
    const blastSum = explode.share * explode.targets * .75;
    const delta = after.damageDealt - before.damageDealt;
    assert.ok(delta >= blastSum - 1e-9, `blast damage applied (${delta} vs ${blastSum})`);
    assert.ok(near((delta - blastSum) % 6, 0, 1e-9), `remaining delta is whole stripper hits only (${delta - blastSum})`);
    assert.ok(e.rec.record.some(r => r[0] === 'arc' && r[3] === MEETING.blastRadius), 'the exact blast radius was drawn as the ground telegraph');
  } finally { e.cleanup(); }
});

test('engine: defeat plays the death strip briefly, then the unchanged game-over flow (won:false)', async () => {
  const e = await startEncounter({
    charId: 'admin', width: 1100, height: 800,
    configure: run => { run.hp = 40; run.maxHp = 40; run.crit = 0; }
  });
  try {
    e.until(() => e.events.some(ev => ev.type === 'deathSequence'), 40);
    assert.equal(e.finished, null, 'the results screen does not jump instantly on a defeat');
    assert.ok(e.samples.at(-1).dying > 0, 'dying hold active');
    try { e.until(() => e.finished !== null, 5); } catch { /* the engine legitimately stops once the game-over payload lands */ }
    assert.ok(e.finished, 'game-over flow ran after the brief strip');
    assert.equal(e.finished.won, false);
    assert.equal(e.finished.hp, 0);
    assert.ok(e.rec.record.some(r => r[0] === 'drawImage' && r[3] === 118 && r[4] === 88), 'the death strip was actually drawn');
  } finally { e.cleanup(); }
});

test('oracle baseline regression: engine still runs and weapons still fire for the standing baseline character', async () => {
  const e = await startEncounter({ charId: 'oracle', width: 1100, height: 800 });
  try {
    e.until(() => e.events.some(ev => ev.type === 'weaponTrigger'), 12);
    assert.ok(e.events.some(ev => ev.type === 'weaponTrigger'));
    assert.equal(e.finished, null);
  } finally { e.cleanup(); }
});

test('field guide: Admin entry carries the flavor, capped-dodge note, 4 slots and the Meeting Invite card', () => {
  const ch = guideEntries().Characters.find(x => x.id === 'admin');
  assert.ok(ch, 'guide entry exists');
  assert.match(ch.body, /Polo shirt, fancy shoes, and a coffee in hand/);
  assert.match(ch.body, /30% Dodge \(capped at 50% total\)/);
  assert.match(ch.body, /4 slots; mixed tools/);
  assert.match(ch.body, /Meeting Invite/);
  assert.match(ch.body, /round table/);
  assert.match(ch.body, /20s cooldown/);
  assert.match(ch.body, /The meeting could have been an email/);
  assert.match(ch.detail, /Dodge 30%/);
});