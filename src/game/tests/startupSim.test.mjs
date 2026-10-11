import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// RUNTIME STARTUP/FREEZE VERIFICATION (not a unit test): executes the REAL
// signal engine end to end — real asset preloading from public/assets, real
// fixed-step simulation at 60fps, real input — and asserts the loop keeps
// scheduling (a stopped rAF chain is exactly the browser freeze signature),
// the wave timer decreases, enemies spawn and die (kills/XP), contact damage
// happens, and held input moves the player (camera follows). Run for 40
// simulated play seconds on a mobile (375×667) and a desktop (1280×800)
// canvas rect, mirroring GameArena's preload list and engine argument order.

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const pub = rel => path.join(rootDir, 'public', rel.replace(/^https?:\/\/[^/]+/, ''));

// ── Browser environment shims (installed once, before engine imports) ──────
let rafSeq = 1;
const rafMap = new Map();
globalThis.requestAnimationFrame = cb => { const id = rafSeq++; rafMap.set(id, cb); return id; };
globalThis.cancelAnimationFrame = id => { rafMap.delete(id); };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.devicePixelRatio = 2;
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// Canvas + 2D context factory is installed here so the sprite loader's
// hurt-atlas tinting (document.createElement('canvas')) works in Node.
function makeRecordingCtx() {
  const record = [];
  const target = {};
  return {
    record,
    ctx: new Proxy(target, {
      get: (t, k) => {
        if (k === 'canvas') return null;
        if (k in t) return t[k];
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient')
          return (...a) => { record.push([k, ...a]); return { addColorStop() {} }; };
        if (k === 'getLineDash') return () => [];
        if (k === 'measureText') return () => ({ width: 10 });
        return (...a) => { record.push([k, ...a]); return undefined; };
      },
      set: (t, k, v) => { t[k] = v; return true; },
    }),
  };
}
function makeCanvas(width, height, rec) {
  return {
    width: 0, height: 0, style: {},
    getContext: () => rec.ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }),
    addEventListener() {}, removeEventListener() {},
  };
}
globalThis.document = {
  createElement: tag => (tag === 'canvas' ? makeCanvas(0, 0, makeRecordingCtx()) : { style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }),
  addEventListener() {}, removeEventListener() {},
  querySelectorAll: () => [],
  documentElement: { scrollHeight: 0 },
};
class FakeAudioParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { gain: new FakeAudioParam(), connect() {} }; }
  createOscillator() { return { type: '', frequency: new FakeAudioParam(), connect() {}, start() {}, stop() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  resume() { return Promise.resolve(); }
}
globalThis.AudioContext = FakeAudioContext;

// Image stub: reads the real PNG header so naturalWidth/naturalHeight are the
// file's actual dimensions — the sprite loader's size validation stays honest.
const pngSize = b => (b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);
globalThis.Image = class {
  constructor() { this._ok = false; }
  set src(url) { queueMicrotask(() => this._load(url)); }
  get src() { return this._src; }
  _load(url) {
    try {
      const bytes = readFileSync(pub(url));
      const [w, h] = pngSize(bytes) || (() => { throw new Error('not a png: ' + url); })();
      this._src = url; this._ok = true;
      this.naturalWidth = w; this.naturalHeight = h; this.width = w; this.height = h;
      if (this.onload) this.onload();
    } catch (e) {
      this._err = e;
      if (this.onerror) this.onerror(e);
    }
  }
  decode() { return this._ok ? Promise.resolve() : Promise.reject(this._err); }
};

// fetch shim: serves /assets/… manifests and files from public/.
globalThis.fetch = async url => {
  const bytes = readFileSync(pub(url));
  return { ok: true, status: 200, json: async () => JSON.parse(bytes.toString()), text: async () => bytes.toString() };
};

// Canvas + 2D context stub. Drawing is a no-op, but the background fillRect
// and setTransform calls are RECORDED so the harness can read the live
// camera position (draw() fills the camera-anchored backdrop first).
// Frame pump: drains the engine's rAF registrations like a real browser.
// Returns false if the engine stopped scheduling — the freeze signature.
let simNow = -1; // monotonic across pump calls — the engine's dt must never go negative
function pump(seconds, script) {
  if (simNow < 0) simNow = performance.now();
  const step = 1000 / 60;
  let t = simNow;
  for (let f = 0; f < seconds * 60; f++) {
    t += step;
    simNow = t;
    const cbs = [...rafMap.values()];
    rafMap.clear();
    for (const cb of cbs) cb(t);
    if (rafMap.size === 0) return f;
    if (script) script(f);
  }
  return -1; // never stopped
}

// ── Run object: OTDR Oracle baseline, identical construction to the app ────
const { createRun } = await import('@/game/progression/runRules.js');
const { characterById } = await import('@/game/data/characters.js');
const baseRun = () => {
  const run = createRun(characterById('oracle'), false, 'startup-sim', 'startup-sim-run');
  // Simulation survivability only: a huge HP pool so the 40s session never
  // ends early (finish → loop stop would mask freeze detection), and wave 6
  // gives a 40s wave timer matching the 40s session. Combat values stay the
  // app's own.
  run.wave = 6; run.maxHp = 2000; run.hp = 2000; run.armor = 4;
  return run;
};

const { preloadCharacterSprite, preloadEnemySprite, preloadStructureSprite } = await import('@/game/art/spriteLoader.js');
const { createSignalEngine } = await import('@/game/signalEngine.js');

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