# Lag Sprite real-art integration

Scope: the Lag Sprite enemy only. All other enemies keep their placeholder canvas sprites, stats, spawns and counters; saves, economy, combat math, the range fix, and all other character art are untouched. Lag Sprite stats/balance unchanged (hp 20, speed 64, damage 8, r 13, value 2 — verified byte-for-byte in tests, only a `flavor` field added). Its melee-only nature was confirmed in the data (contact damage; no projectile/pattern fields).

## Before → After

Rendering (before): `enemySprite('lag', …)` drew a one-time static canvas — yellow radial-gradient circle with two googly eyes and two cream mouth arcs. Every Lag Sprite was identical, never animated, no facing, no attack pose.

Rendering (after): cached preloaded atlases from the shared Oracle sprite-definition/loader/preload infrastructure (generalized, not forked):
- Movement atlas 384×128 (6×2, 64px cells): row 0 front/idle, row 1 side walk, 8fps, driven by actual per-enemy movement like the player's Oracle animation; side row mirrors for left.
- Attack atlas 128×64: one-shot swipe frame (col 0 front / col 1 side) shown ~0.35s at contact strikes — visual only; hit timing, damage, and invulnerability windows are unchanged.
- Drawn centered on the collision point like all other enemies (worldSize 48 vs the old ~38px placeholder), rounded coordinates, smoothing disabled only during the draw and restored after.

Description (before): Field Guide Enemies entry was pure generated stats ("20 base HP × … 8 contact damage … Counter: Keep distance and use rapid shots…").

Description (after): same entry now opens with the exact flavor text — "Small, annoying melee-only creature. Tiny glitchy digital sprite that looks like a lagging network packet or a delayed signal." — followed by the unchanged generated stats line. The guide's Enemies tab now also shows the real 256×256 portrait above the Lag Sprite entry (no portrait for enemies without art). Stats text everywhere else is generated from the same untouched data.

## Files changed

New asset copies (byte-identical to the public uploads, copied into `dist/assets/lagsprite/` by the build):
- `public/assets/lagsprite/movement.png` (46519 B), `attack.png` (7181 B), `portrait.png` (6476 B), `animation.json`

New code:
- `src/game/art/enemySpriteAnimation.js` — lag animation state/update, pure `lagFrame()` selector (front/side/attack/mirror), centered draw
- `src/components/game/EnemyPortrait.jsx` — portrait via the shared Image component, explicit load-failure message

Modified:
- `src/game/art/characterSprites.js` — added `ENEMY_SPRITES.lag` definition + `enemySpriteDef()`; Oracle def gains its `hurtTint` (value moved from the loader, no behavior change)
- `src/game/art/spriteLoader.js` — one generic `preloadSprite()` path for characters AND enemies (parallel atlas/portrait/manifest, per-definition manifest validation, optional attack atlas/hurt tint); `preloadEnemySprite()` added
- `src/game/signalEngine.js` — optional `enemyArt` argument; spawned Lag Sprites get animation state; movement-driven 8fps update in the enemy loop; `.attack=.35` set at contact strikes; animated draw pass in `draw()`, placeholder loop skips art-bearing enemies
- `src/components/game/GameArena.jsx` — preloads character art and Lag Sprite art in parallel before combat starts; failure blocks start with a retry button (messages now generic: "Retry sprite assets")
- `src/game/data/combat.js` — flavor field on `lag` only
- `src/game/data/reference.js` — Enemies guide body prepends the flavor when present
- `src/pages/FieldGuide.jsx` — Enemies tab renders `EnemyPortrait` when a sprite def exists
- `src/game/tests/oracleRange.test.mjs` — GameArena wiring assertion updated to the new parallel preload (oracle substring `preloadCharacterSprite(run.character.id)` still asserted)

New verification:
- `src/game/tests/lagsprite.test.mjs` — 6 tests: HTTP 200 + exact dimensions (384×128, 128×64, 256×256) + PNG decode + SHA-256 equality with local files + per-frame foot baselines (all exactly 58) + manifest assertions; melee-only/stat-preservation + engine/guide/asset wiring; exact Field Guide flavor text; 8fps walk-cycle math and row/mirror selection; attack one-shot frames and smoothing restore; loader caching and a real `createSignalEngine` boot spawning animated Lag Sprites that draw the actual atlas (front row, frame advancing), with placeholder-only behavior when no art is passed.

## Art inspection notes

- Pixel-inspected before wiring: front row is symmetric (camera-facing); side-row white highlights concentrate right (42 vs 5) → the side row faces RIGHT, so left movement is drawn mirrored. All 12 movement frames have the opaque foot baseline at exactly y=58; bodies stay within their cells.
- Frame 5 of both rows carries far more white pixels (191/131 vs ~40) than frames 0–4 — likely a larger highlight or pose accent. It plays as part of the 6-frame loop; whether it reads as a smooth bob or a visible "pop" cannot be judged from pixels.
- Manifest nit (not worked around, just noted): its `notes` mention "Column 6 in both rows is a distinct attack-swipe pose", but the shipped movement atlas is exactly 6 columns and the manifest's own idle/side animations list 6 frames (x 0–320) — the note describes the pre-split source sheet. The `enemyId` is `lag_sprite` while the roster id is `lag`; the definition maps them and the manifest is validated against its real fields.
- The manifest itself flags that animation smoothness and side-facing need visual QA — the facing half is now settled (right-facing measured), but cycle smoothness is not.

## Results

- `npm run test:solo`: 38 passed, 0 failed (existing 32 + 6 new).
- `npm run build`: exit 0; `dist/assets/lagsprite/` contains all four files.
- `npm run lint`: exit 0.
- Only notices: outdated Browserslist metadata (pre-existing).

## Not verified

Live in-browser playback has NOT been verified: walk-cycle smoothness, how the mirrored left walk reads, the one-shot swipe timing feel in real gameplay, and mobile rendering are unconfirmed in this environment. Use the Testing Agent: 'Start any run, let Lag Sprites approach from above and the sides, verify their sprite animates at a steady pace in the right directions with mirrored left movement, shows the swipe pose when one touches you, and check the Lag Sprite portrait and description in the Field Guide Enemies tab.'