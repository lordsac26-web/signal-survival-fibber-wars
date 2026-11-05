import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENEMIES } from '@/game/data/combat';
import { ENEMY_SPRITES } from '@/game/art/characterSprites';
import { DITCH, createDitchState, stepDitch, ditchVelocity, ditchContactReady, clampDitchBounds, ditchRockBurst } from '@/game/combat/ditchWitch';
import { ditchFrame, drawDitchTelegraph, drawDitchWitch, drawDitchRock } from '@/game/art/ditchWitchSpriteAnimation';
import { pickEnemyKind } from '@/game/combat/jitter';
import { guideEntries } from '@/game/data/reference';
import { decodePng } from './pngDecode.mjs';
import { startEncounter, pump } from './engineHarness.mjs';

const pub = rel => readFileSync(new URL('../../../public' + rel, import.meta.url));

test('ditch witch assets: source sheet, 6 strips, rocks VFX, portrait and manifest match declared dimensions and baseline', () => {
  const def = ENEMY_SPRITES.ditch;
  assert.ok(def, 'ditch sprite definition registered');
  const jpg = pub(def.sources.localSheet);
  assert.equal(jpg[0], 0xff);
  assert.equal(jpg[1], 0xd8, 'source sheet is a valid JPEG');

  const manifest = JSON.parse(pub(def.manifest));
  for (const [k, expected] of Object.entries(def.manifestSpec)) {
    const actual = k.split('.').reduce((o, p) => o?.[p], manifest);
    assert.equal(actual, expected, `manifest ${k}`);
  }

  const strips = [
    ['idle', def.atlas, def.counts.idle],
    ['drive', '/assets/ditchwitch/drive.png', def.counts.drive],
    ['windup', '/assets/ditchwitch/windup.png', def.counts.windup],
    ['charge', '/assets/ditchwitch/charge.png', def.counts.charge],
    ['dig', '/assets/ditchwitch/dig.png', def.counts.dig],
    ['death', '/assets/ditchwitch/death.png', def.counts.death],
  ];
  for (const [name, rel, frames] of strips) {
    const png = decodePng(pub(rel));
    assert.equal(png.width, frames * def.cellW, `${name} width`);
    assert.equal(png.height, def.cellH, `${name} height`);
    // Top-left corner of every cell is transparent (JPEG background & border removed)
    for (let f = 0; f < frames; f++) {
      const idx = (f * def.cellW) * 4;
      assert.equal(png.rgba[idx + 3], 0, `${name} frame ${f} top-left transparent`);
      let opaque = 0, trackMaxY = 0;
      for (let y = 0; y < def.cellH; y++) {
        for (let x = f * def.cellW; x < (f + 1) * def.cellW; x++) {
          if (png.rgba[(y * png.width + x) * 4 + 3] > 20) {
            opaque++;
            const cx = x - f * def.cellW;
            if (cx >= 24 && cx <= 110 && y > trackMaxY) trackMaxY = y;
          }
        }
      }
      assert(opaque > 900, `${name} frame ${f} has substantial sprite content (${opaque})`);
      assert(Math.abs(trackMaxY - def.baselineY) <= 4, `${name} frame ${f} track baselineY (${trackMaxY} vs ${def.baselineY})`);
    }
  }

  const rocks = decodePng(pub('/assets/ditchwitch/rocks.png'));
  assert.equal(rocks.width, 108);
  assert.equal(rocks.height, 96);
  assert.equal(rocks.rgba[3], 0, 'rocks VFX top-left transparent');

  const portrait = decodePng(pub(def.portrait));
  assert.equal(portrait.width, def.portraitW);
  assert.equal(portrait.height, def.portraitH);
});

test('ditch witch data & spawn gate: wave 6+, chassis-only collider, bounded replacement weight', () => {
  const e = ENEMIES.ditch;
  assert.ok(e, 'ditch in ENEMIES');
  assert.equal(e.hp, DITCH.hp);
  assert.equal(e.speed, DITCH.speed);
  assert.equal(e.damage, DITCH.damage);
  assert.equal(e.r, DITCH.radius);
  assert.equal(e.r, 26, 'collider restricted to tracked chassis, not extended blade');
  assert.equal(e.elite, true);
  assert.equal(e.dirty, true);

  const types = Object.keys(ENEMIES);
  let seed = 42;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let w = 1; w <= 5; w++) {
    for (let i = 0; i < 2000; i++) {
      assert.notEqual(pickEnemyKind(types, w, random), 'ditch', `no ditch on wave ${w}`);
    }
  }
  let count = 0;
  for (let i = 0; i < 10000; i++) {
    if (pickEnemyKind(types, 6, random) === 'ditch') count++;
  }
  assert(count > 400 && count < 1100, `wave 6 ditch spawn frequency reasonable: ${count}/10000`);
});

test('ditch witch state machine: alternates Blade Charge and Dig & Rock Spray, locks direction, cancels on death', () => {
  const s = createDitchState(() => 0);
  assert.equal(s.cooldown, DITCH.initialMin);
  assert.equal(s.phase, 'chase');

  // Advance cooldown until ready, within activationRange and visible
  stepDitch(s, DITCH.initialMin + 0.05, { alive: true, playerAlive: true, dx: 120, dy: 0, visible: true });
  assert.equal(s.phase, 'windup');
  assert.equal(s.mode, 'charge');
  assert.equal(s.angle, 0);
  assert.equal(ditchVelocity(s, 0, DITCH.speed).x, 0, 'rooted during windup');
  assert.equal(ditchContactReady(s), false, 'no contact hit during windup');

  // Player moves perpendicular during windup; locked angle must not track
  stepDitch(s, DITCH.windup + 0.01, { alive: true, playerAlive: true, dx: 0, dy: 200, visible: true });
  assert.equal(s.phase, 'charge');
  assert.equal(s.angle, 0, 'charge direction stays locked to windup angle');
  const v = ditchVelocity(s, Math.PI / 2, DITCH.speed);
  assert.equal(Math.round(v.x), DITCH.chargeSpeed);
  assert.equal(Math.round(v.y), 0);
  assert.equal(ditchContactReady(s), true);
  s.struck = true;
  assert.equal(ditchContactReady(s), false, 'at most one strike per blade charge');

  // Finish charge -> recovery -> chase
  stepDitch(s, DITCH.chargeDuration + 0.01, { alive: true, playerAlive: true, dx: 100, dy: 0, visible: true });
  assert.equal(s.phase, 'recover');
  assert.equal(s.cooldown, DITCH.cooldown);
  stepDitch(s, DITCH.recovery + 0.01, { alive: true, playerAlive: true, dx: 100, dy: 0, visible: true });
  assert.equal(s.phase, 'chase');

  // Next special alternates to Dig & Rock Spray
  stepDitch(s, DITCH.cooldown + 0.05, { alive: true, playerAlive: true, dx: -140, dy: 0, visible: true });
  assert.equal(s.phase, 'windup');
  assert.equal(s.mode, 'rock');
  assert.equal(s.facing, 'left');
  stepDitch(s, DITCH.windup + 0.01, { alive: true, playerAlive: true, dx: -140, dy: 0, visible: true });
  assert.equal(s.phase, 'dig');
  const act = stepDitch(s, DITCH.rockReleaseTime + 0.01, { alive: true, playerAlive: true, dx: -140, dy: 0, visible: true });
  assert.equal(act, 'rock-fire');
  const burst = ditchRockBurst({ x: 400, y: 300, damage: 20 }, s);
  assert.equal(burst.length, DITCH.rockCount);
  assert.equal(burst[0].damage, 20 * DITCH.rockDamageFactor);

  // Death mid-dig cancels immediately
  stepDitch(s, 0.05, { alive: false });
  assert.equal(s.phase, 'dead');
  assert.equal(s.remaining, 0);
  assert.equal(s.vfxT, 0);
});

test('ditch witch engine encounter: spawns at wave 6+, telegraphs, charges, sprays rocks, and leaves wreck on death', async () => {
  const realRandom = Math.random;
  // At wave 6, eligible has 7 items and 'dirty' is at index 3; 3.1/7 selects 'dirty' with frac=0.1 < 0.35 -> 'ditch'
  Math.random = () => 3.1 / 7;
  try {
    const enc = await startEncounter({
      width: 1280,
      height: 800,
      configure: run => {
        run.wave = 6;
        run.hp = run.maxHp = 50000;
        run.weapons = [{ id: 'wreck-test', name: 'Wreck Test', pattern: 'nova', range: 900, damage: 0, rate: 0.1, color: '#fff' }];
      }
    });
    // Wait until a Ditch Witch spawns naturally from the wave-6 pool
    enc.until(() => enc.samples.some(s => s.ditchWitches?.length > 0), 10);
    const first = enc.samples.find(s => s.ditchWitches?.length > 0).ditchWitches[0];
    assert.equal(first.r, 26);
    assert(enc.samples.every(s => (s.ditchWitches?.length || 0) <= DITCH.maxActive), 'respects maxActive cap');

    // Wait for both Blade Charge and Dig & Rock Spray to fire
    enc.until(() => enc.events.some(e => e.type === 'ditchPhase' && e.phase === 'charge'), 20);
    enc.until(() => enc.events.some(e => e.type === 'ditchRocks' && e.count === 3), 20);
    assert(enc.samples.some(s => (s.rocks?.length || 0) > 0), 'rock projectiles spawned into foeShots');

    // Arm the clearing tool to kill the Ditch Witch and verify wreck animation spawns
    enc.run.weapons[0].damage = 5000;
    enc.until(() => enc.samples.some(s => (s.wrecks?.length || 0) > 0), 5);
    enc.cleanup();
  } finally {
    Math.random = realRandom;
  }
});

test('ditch witch field guide entry is present and complete', () => {
  const g = guideEntries();
  const entry = g.Enemies.find(e => e.id === 'ditch');
  assert.ok(entry, 'Field Guide has ditch entry');
  assert.equal(entry.title, 'Ditch Witch');
  assert(entry.body.includes('Blade Charge'));
  assert(entry.body.includes('Dig & Rock Spray'));
  assert(entry.detail.includes('Spawn gate: wave 6+'));
  assert(entry.detail.includes('chassis collider radius 26'));
});