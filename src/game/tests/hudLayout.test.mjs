// REGRESSION: gameplay HUD text must never overlap the canvas.
//
// ROOT CAUSE (playtest-verified): the old match layout was a fullscreen
// `h-full w-screen` canvas with EVERY HUD element (top HUD, boss bar, weapon
// slots, Special/Deploy buttons, flash toasts) absolutely overlaid on top of
// it, while the engine derived its camera viewport from the canvas element's
// own rect. The strip under the HUD text was therefore LIVE play area where
// both the player and impairments could vanish beneath text. No safe-rect or
// inset clamp ever existed to compensate.
//
// FIX UNDER TEST: structural separation — <header> / canvas region / <footer>
// are flex siblings in normal flow inside a fixed-height column. The canvas
// element is exactly the leftover visible space, and the engine (unchanged
// contract) sizes its camera viewport, DPR backing buffer, spawn visibility
// and attack ranges from that same element rect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async p => await readFile(new URL('../../' + p, import.meta.url), 'utf8');

test('arena: header → canvas region → footer are flow siblings in a fixed column; no gameplay text overlays the canvas', async () => {
  const s = await read('components/game/GameArena.jsx');
  // The match screen is a fixed-height flex COLUMN (no overlays in flow).
  assert.match(s, /className="relative flex h-\[100dvh\] w-screen flex-col overflow-hidden bg-slate-950"/);
  // The old centered flash overlay over the canvas is gone (flash lives in the footer).
  assert.doesNotMatch(s, /pointer-events-none absolute inset-0 z-20/);
  // DOM ORDER: header first, then the canvas region, then the footer, then the
  // paused-only StatsScreen — flow siblings, each in its own region.
  const header = s.indexOf('<GameHUD'), region = s.indexOf('relative min-h-0 flex-1'),
        footer = s.indexOf('<MatchFooter'), stats = s.indexOf('StatsScreen run=');
  assert.ok(header > -1 && region > -1 && footer > -1 && stats > -1, 'all three regions plus stats present');
  assert.ok(header < region && region < footer && footer < stats, 'header → canvas → footer order');
  // The canvas region is the ONLY flexible child: its element rect is exactly
  // the space not occupied by header/footer (canvas never extends behind HUD).
  assert.match(s, /<div className="relative min-h-0 flex-1">\s*\n\s*<canvas ref=\{canvas\} className="block h-full w-full" \/>/);
});

test('header: GameHUD is a flow <header>, not an overlay; boss bar/tools/range all live inside it', async () => {
  const s = await read('components/game/GameHUD.jsx');
  assert.match(s, /return <header className="pointer-events-none w-full shrink-0 border-b-2/);
  // No PAGE-level overlay positioning in the header (intra-slot absolute — a
  // cooldown ring inside a fixed-size slot button — is fine and expected).
  assert.doesNotMatch(s, /absolute inset-x-0|inset-0 top-0|absolute top-0/);
  assert.match(s, /<BossBar boss=\{hud\.boss\}\/>/);
  assert.match(s, /<RangeReadout hud=\{hud\}\/>/);
  assert.doesNotMatch(s, /ProgressMeters/); // XP/earned-signal text moved to the footer
  // All gameplay readouts still present in the header region.
  for (const piece of ['Jacket Integrity', 'Wave {wave}', 'hud.signal', 'hud.kills', 'hud.time']) assert.ok(s.includes(piece), `header keeps readout: ${piece}`);
});

test('footer: XP readout, flash and Special/Deploy buttons live below the canvas with no absolute positioning', async () => {
  const f = await read('components/game/MatchFooter.jsx');
  assert.match(f, /<footer className="w-full shrink-0/);
  assert.doesNotMatch(f, /absolute/);
  for (const piece of ['ProgressMeters', 'SpecialButton', 'DeployButton', 'aria-live']) assert.ok(f.includes(piece), `footer keeps: ${piece}`);
  const sp = await read('components/game/SpecialButton.jsx');
  const dp = await read('components/game/DeployButton.jsx');
  // Root elements are flow buttons (intra-button absolute rings are fine).
  assert.match(sp, /className="flex size-16/);
  assert.doesNotMatch(sp, /className="absolute|bottom-\d+|right-\d+|md:bottom|md:left/);
  assert.match(dp, /className="(?:relative )?flex size-16/);
  assert.doesNotMatch(dp, /className="absolute bottom|bottom-40|bottom-6|left-5|left-6|md:bottom|md:left/);
  // Touch targets stay ≥64px in the footer (mobile readability preserved).
  assert.match(sp, /size-16/); assert.match(dp, /size-16/);
});

test('touch controls remain inside the canvas region, text-free and transparent — never concealing text over units', async () => {
  const s = await read('components/game/GameArena.jsx');
  const region = s.slice(s.indexOf('relative min-h-0 flex-1'), s.indexOf('<MatchFooter'));
  assert.ok(region.includes('<TouchControls input={input} />'), 'TouchControls lives in the canvas region');
  const tc = await read('components/game/TouchControls.jsx');
  assert.doesNotMatch(tc, /[>"][A-Za-z]{3,}[<"]/); // no text labels on the pad
  assert.match(tc, /bg-white\/5/); // near-transparent input zone, never a concealing panel
  assert.doesNotMatch(tc, /bg-slate-950\/35/);
});

test('engine contract: camera viewport, DPR buffer and ranges derive from the canvas element rect only — no safe-rect insets (no double reservation)', async () => {
  const s = await read('game/signalEngine.js');
  assert.match(s, /const r=canvas\.getBoundingClientRect\(\);/);
  assert.match(s, /updateVisibleViewport\(viewport,r\.width,r\.height,scale\)/);
  assert.match(s, /new ResizeObserver\(resize\)/);
  assert.match(s, /canvas\.width=Math\.round\(r\.width\*dpr\)/);
  // No leftover safe-rect/HUD inset logic anywhere: separation is structural,
  // so reserving extra space would double-count the header height.
  assert.doesNotMatch(s, /safeRect|safe-rect|hudInset|topInset|bottomInset|safeArea|playRect/i);
  // Attack-range rule unchanged: shortest side of the VISIBLE logical viewport
  // (not DPR, not the full world), so ranges stay correct at every canvas size.
  const er = await read('game/combat/effectiveRange.js');
  assert.match(er, /const short=Math\.min\(viewport\.width,viewport\.height\);/);
  assert.match(er, /out\.width=Math\.max\(1,cssWidth\)\/Math\.max\(\.01,zoom\);out\.height=Math\.max\(1,cssHeight\)\/Math\.max\(\.01,zoom\);/);
});