import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRecordingCtx,makeCanvas,pump,baseRun,rafMap,preloadCharacterSprite,preloadEnemySprite,preloadStructureSprite,createSignalEngine} from './engineHarness.mjs';

async function session({ width, height, seconds, jitterOnly=false }) {
  const rec = makeRecordingCtx();
  const canvas = makeCanvas(width, height, rec);
  const run = baseRun();
  if(jitterOnly)run.weapons=[]; // survive long enough to exercise repeated novas, no baseline changes
  const input = { current: { x: 0, y: 0, special: false, deploy: false, cycle: false, deploySel: 0 } };
  const paused = { current: false };
  const huds = []; let finished = null; const flashes = [];
  const cb = {
    hud: h => huds.push(h),
    reach: () => {},
    finish: r => { finished = r; },
    flash: t => flashes.push(t),
  };

  // Identical preload list/order to GameArena.
  const arts = await Promise.all([
    preloadCharacterSprite(run.character.id), preloadEnemySprite('lag'), preloadStructureSprite('bucket'),
    preloadStructureSprite('pedestal_turret'), preloadEnemySprite('squirrel'), preloadEnemySprite('dirty'),
    preloadEnemySprite('packet'), preloadEnemySprite('jitter'),
  ]);
  assert.ok(arts[0], 'character art resolved');

  const dispose = createSignalEngine(canvas, run, input, cb, paused,
    arts[0], arts[1], arts[2], arts[4], arts[5], arts[3], arts[6], arts[7]);

  // Script: hold right for the first 4s (movement/camera), then wiggle
  // diagonally, and fire the special once mid-session.
  const stoppedAt = pump(seconds, f => {
    if(jitterOnly)return;
    if (f < 240) { input.current.x = 1; input.current.y = 0; }
    else { input.current.x = (f % 120 < 60) ? .7 : -.7; input.current.y = (f % 90 < 45) ? .7 : -.7; }
    if (f === 1200) input.current.special = true;
  });

  const camXs = rec.record.filter(r => r[0] === 'fillRect').map(r => r[1] + 24); // backdrop = camX-24
  const setTs = rec.record.filter(r => r[0] === 'setTransform').map(r => r[4]);
  const timerFirst = huds[0]?.time, timerLast = huds[huds.length - 1]?.time;
  const killsMax = Math.max(...huds.map(h => h.kills));
  const xpLast = huds[huds.length - 1]?.xp;
  const hpMin = Math.min(...huds.map(h => h.hp));
  const fpsMin = Math.min(...huds.map(h => h.fps));
  dispose();

  const jitterDraws=rec.record.filter(r=>r[0]==='drawImage'&&r[1]?.naturalWidth===1200&&r[1]?.naturalHeight===800);
  return { stoppedAt, camXs, setTs, huds, timerFirst, timerLast, killsMax, xpLast, hpMin, fpsMin, finished, flashes, jitterDraws };
}

test('runtime startup sim (mobile 375×667): 40s of play — engine loop never stops, timer decreases, input moves player, enemies die', async () => {
  const r = await session({ width: 375, height: 667, seconds: 40 });
  assert.equal(r.stoppedAt, -1, `engine rAF chain stopped scheduling at frame ${r.stoppedAt} (freeze signature)`);
  assert.ok(!r.finished, 'run finished early (player death would mask the freeze window)');
  assert.ok(r.huds.length > 100, `HUD published ${r.huds.length} samples`);
  assert.ok(Math.abs(r.timerFirst - 40) < .1, `timer starts at the 40s wave duration (${r.timerFirst})`);
  assert.ok(r.timerLast < r.timerFirst - 15, `wave timer decreased (40 → ${r.timerLast})`);
  // held-right input must move the player and with it the camera (viewport 375 < world 1100)
  const moved = Math.max(...r.camXs) - Math.min(...r.camXs);
  assert.ok(moved > 100, `camera moved ${moved}u under held input (player movement)`);
  assert.ok(r.killsMax > 0, `kills recorded (${r.killsMax}) — enemies took real damage`);
  assert.ok(r.xpLast > 0, `XP recorded (${r.xpLast})`);
  assert.ok(r.hpMin < 2000, 'contact/enemy threat registered (hp dipped from max)');
  assert.ok(r.fpsMin >= 50, `sim maintained >=50fps (min ${r.fpsMin})`);
});

test('runtime startup sim (desktop 1280×800): 40s of play — engine loop never stops, timer decreases, combat progresses', async () => {
  const r = await session({ width: 1280, height: 800, seconds: 40 });
  assert.equal(r.stoppedAt, -1, `engine rAF chain stopped scheduling at frame ${r.stoppedAt} (freeze signature)`);
  assert.ok(!r.finished, 'run finished early (player death would mask the freeze window)');
  assert.ok(r.huds.length > 100, `HUD published ${r.huds.length} samples`);
  assert.ok(r.timerLast < r.timerFirst - 15, `wave timer decreased (20 → ${r.timerLast})`);
  assert.ok(r.killsMax > 0, `kills recorded (${r.killsMax})`);
  assert.ok(r.xpLast > 0, `XP recorded (${r.xpLast})`);
  assert.ok(r.hpMin < 2000, 'contact/enemy threat registered');
});

test('runtime pause/reset contract: paused loop holds the timer (and sim time), cleanup stops everything', async () => {
  const rec = makeRecordingCtx();
  const canvas = makeCanvas(375, 667, rec);
  const run = baseRun();
  const input = { current: { x: 0, y: 0 } };
  const paused = { current: false };
  const huds = [];
  const cb = { hud: h => huds.push(h), reach: () => {}, finish: () => {}, flash: () => {} };
  const arts = await Promise.all([
    preloadCharacterSprite(run.character.id), preloadEnemySprite('lag'), preloadStructureSprite('bucket'),
    preloadStructureSprite('pedestal_turret'), preloadEnemySprite('squirrel'), preloadEnemySprite('dirty'),
    preloadEnemySprite('packet'), preloadEnemySprite('jitter'),
  ]);
  const dispose = createSignalEngine(canvas, run, input, cb, paused,
    arts[0], arts[1], arts[2], arts[4], arts[5], arts[3], arts[6], arts[7]);
  pump(3);
  const before = huds[huds.length - 1]?.time;
  paused.current = true;
  pump(5); // 5 real seconds with the overlay up: sim time must be frozen
  const held = huds[huds.length - 1]?.time;
  paused.current = false;
  pump(12); // 0.2s — guarantees a fresh 10Hz HUD sample
  const after = huds[huds.length - 1]?.time;
  dispose();
  assert.equal(rafMap.size, 0, 'cleanup cancelled the loop');
  assert.equal(held, before, `timer frozen while paused (${before} → ${held})`);
  assert.ok(after < before, `timer resumed after unpausing (${before} → ${after})`);
});

for(const [width,height] of [[375,667],[1280,800]])test(`Jitter-specific real engine simulation ${width}×${height}: chase / melee / charge / nova / recovery`,async()=>{
 const random=Math.random;Math.random=()=>.49; // existing ordinary slot picks jitter, no extra spawn entry
 let r;try{r=await session({width,height,seconds:40,jitterOnly:true})}finally{Math.random=random}
 assert.equal(r.stoppedAt,-1);assert(!r.finished);assert(r.jitterDraws.length>0);
 for(const draw of r.jitterDraws){assert(draw.slice(2).every(Number.isFinite));assert(draw[2]>=0&&draw[2]+draw[4]<=1200);assert(draw[3]>=0&&draw[3]+draw[5]<=800)}
 assert(r.jitterDraws.some(d=>d[3]===200),'move row rendered');
 assert(r.jitterDraws.some(d=>d[3]===400),'contact melee row rendered');
 for(const x of [0,240,480,720,960])assert(r.jitterDraws.some(d=>d[3]===600&&d[2]===x),`special frame ${x/240} rendered`);
 assert(r.hpMin<2000,'actual enemy threat reached player');
});