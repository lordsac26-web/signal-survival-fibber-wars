// Playtest audit — A) per-character aiming/muzzle transforms and attack
// facing, B) crew-helper HP scaling, C) HUD/canvas separation contract.
// Muzzle numbers below were PIXEL-MEASURED from the processed atlases
// (leading-edge pass over each attack strip's chest band), not hand-tuned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { characterSprite } from '@/game/art/characterSprites.js';
import { createTechAnimation, techFrame } from '@/game/art/techSpriteAnimation.js';
import { techMuzzlePoint } from '@/game/combat/muzzle.js';
import { crewMuzzle } from '@/game/art/crewHelper.js';
import { crewHelperHp } from '@/game/combat/signatures.js';

const engineSource = await readFile(new URL('../signalEngine.js', import.meta.url), 'utf8');
const signaturesSource = await readFile(new URL('../combat/signatures.js', import.meta.url), 'utf8');

// ── A) muzzle anchors and transforms ─────────────────────────────────────────
test('every playable character defines a measured muzzle anchor', () => {
  for (const id of ['oracle', 'veteran', 'clone', 'don', 'nomad']) {
    const def = characterSprite(id);
    assert.ok(def.muzzle, `${id} must define a muzzle`);
    assert.ok(def.muzzle.x > 0 && def.muzzle.y > 0, `${id} muzzle is a positive cell-local point`);
  }
});

test('muzzle transform: forward at torso height aiming right, symmetric mirror aiming left', () => {
  const EXPECTED = { veteran: [127.2, 68.3], clone: [127.3, 72.2], don: [122.1, 69.2], nomad: [130.5, 78.1], oracle: [108.25, 82.75] };
  for (const [id, [ex, ey]] of Object.entries(EXPECTED)) {
    const def = characterSprite(id);
    const p = techMuzzlePoint(def, 1, 100, 100);
    assert.ok(Math.abs(p.x - ex) < 0.6 && Math.abs(p.y - ey) < 0.6, `${id}: right muzzle (${p.x.toFixed(1)},${p.y.toFixed(1)}) expected (${ex},${ey})`);
    const l = techMuzzlePoint(def, -1, 100, 100);
    assert.ok(Math.abs((p.x - 100) + (l.x - 100)) < 1e-9, `${id}: left/right mirror symmetric about the body`);
    assert.ok(Math.abs(p.y - l.y) < 1e-9, `${id}: muzzle height unchanged by facing`);
    const top = 100 - def.worldSize * def.anchorY, foot = 100 + def.worldSize * (1 - def.anchorY);
    assert.ok(p.y > top && p.y < foot - 5, `${id}: muzzle inside the figure band, above the feet`);
  }
});

test('muzzle never spawns at the feet, knees or cell center (regression on the old origin bugs)', () => {
  for (const id of ['veteran', 'clone', 'don', 'nomad', 'oracle']) {
    const def = characterSprite(id), p = techMuzzlePoint(def, 1, 100, 100);
    assert.ok(p.x > 100, `${id}: muzzle leads the body when aiming right`);
    assert.ok(p.y < 100 - 15, `${id}: muzzle is well above the collision point (${p.y.toFixed(1)})`);
  }
});

test('crew helpers fire from the measured hand point of their own figure, mirrored', () => {
  const ci = characterSprite('don').crewInd;
  for (let i = 0; i < 4; i++) {
    const [mx, my] = crewMuzzle(ci, { helperIndex: i, lookA: 0, x: 100, y: 100 });
    assert.ok(mx > 100 && mx < 125, `helper ${i}: hand forward of the figure (${mx.toFixed(1)})`);
    assert.ok(my > 50 && my < 82, `helper ${i}: hand at chest height above the feet (${my.toFixed(1)})`);
    const [lx] = crewMuzzle(ci, { helperIndex: i, lookA: Math.PI, x: 100, y: 100 });
    assert.ok(Math.abs((mx - 100) + (lx - 100)) < 1e-9, `helper ${i}: mirror symmetric`);
  }
});

test('attack frames mirror toward the target side; walk facing is untouched', () => {
  const def = characterSprite('veteran');
  const art = { definition: def, atlas: 'idle', walk: 'walk', walkLeft: 'walkLeft', attack: 'attack', special: 'special' };
  const s = createTechAnimation();
  s.moving = false; s.attack = .4;
  assert.equal(techFrame(art, s).mirror, false, 'default: right-facing attack art, unmirrored');
  s.attackFace = 'left';
  assert.equal(techFrame(art, s).mirror, true, 'attack mirrors when the target is left');
  s.attack = 0; s.moving = true; s.side = 'left'; s.frame = 0;
  assert.equal(techFrame(art, s).image, 'walkLeft');
  assert.equal(techFrame(art, s).mirror, false, 'walk-left keeps its true left art');
});

test('engine wiring: target-facing with dead-zone, muzzle-aimed vectors, helpers re-aim each shot', () => {
  assert.match(engineSource, /if\(Math\.abs\(t\.x-p\.x\)>10\)spriteState\.attackFace=t\.x<p\.x\?'left':'right'/, 'dead-zone prevents flicker on near-vertical targets');
  assert.match(engineSource, /const aim=\(def\?\.muzzle\|\|charId==='isr'\)\?Math\.atan2\(t\.y-my,t\.x-mx\):a/, 'projectile vector starts at the transformed muzzle, including ISR current-frame laptop');
  assert.match(engineSource, /ang=Math\.atan2\(target\.y-my,target\.x-mx\)/, 'turret/helper volleys re-aim from the muzzle');
  assert.match(engineSource, /if\(!t\)return/, 'no-target fallback: no shot and no attack anim');
  assert.doesNotMatch(engineSource, /if\!\(pedArt&&t\.weaponTurret\)\)return \[t\.x,t\.y\]/, 'feet-only turret muzzle origin removed');
  assert.match(engineSource, /crewMuzzle\(characterArt\.definition\.crewInd,t\)/, 'helpers originate at the measured hand point');
  assert.match(engineSource, /pedestalMuzzlePoint/, 'pedestal barrel-tip muzzle helper exists');
  // no duplicate art: crew path unchanged from the Don v2 fix
  assert.match(engineSource, /drawCrewHelper\(ctx,characterArt,t\)/);
  assert.match(engineSource, /else drawHelper\(ctx,Math\.round\(t\.x\),Math\.round\(t\.y\),t\.color\)\}/);
});

// ── B) crew-helper HP ────────────────────────────────────────────────────────
test('crew helper HP: modest base, ~9%/wave scaling, never immortal, pure per-spawn value', () => {
  assert.equal(crewHelperHp(3, 0), 53);
  assert.equal(crewHelperHp(8, 0), 73);
  assert.equal(crewHelperHp(15, 0), 102);
  assert.equal(crewHelperHp(20, 0), 122);
  assert.equal(crewHelperHp(20, 10), 142, 'engineering bonus preserved');
  assert.ok(crewHelperHp(60, 0) < 320, 'never immortal-tank even at extreme waves');
  assert.ok(crewHelperHp(20, 0) > crewHelperHp(15, 0) && crewHelperHp(15, 0) > crewHelperHp(8, 0), 'monotonic wave scaling');
  assert.equal(crewHelperHp(20, 0), crewHelperHp(20, 0), 'deterministic (no compounding)');
});
test('engine: crew HP is applied once at spawn and dead helpers are released promptly', () => {
  assert.match(engineSource, /hp:cfg\.mode==='helper'\?crewHelperHp\(run\.wave,run\.engineering\)/, 'wave-scaled HP at spawn');
  assert.match(engineSource, /if\(t\.life<=0\|\|t\.hp<=0\)\{particle\(t\.x,t\.y,'#94a3b8'/, 'death/cleanup path intact');
  assert.match(signaturesSource, /export function crewHelperHp/, 'formula lives in the shared combat module');
});

// ── C) HUD/canvas separation ────────────────────────────────────────────────
test('layout: dvh viewport unit (no mobile page scroll) and dev-only DOM overlap assertion present', async () => {
  const s = await readFile(new URL('../../components/game/GameArena.jsx', import.meta.url), 'utf8');
  assert.match(s, /h-\[100dvh\] w-screen/, 'dynamic viewport height so mobile URL bars never push the footer offscreen');
  assert.match(s, /HUD region overlaps the canvas/, 'dev runtime geometry assertion');
  assert.match(s, /data-hud-region/, 'measured HUD regions tagged');
  const gh = await readFile(new URL('../../components/game/GameHUD.jsx', import.meta.url), 'utf8');
  const mf = await readFile(new URL('../../components/game/MatchFooter.jsx', import.meta.url), 'utf8');
  assert.match(gh, /data-hud-region/);
  assert.match(mf, /data-hud-region/);
});