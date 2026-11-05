# Multiplayer correction checkpoint

## Implemented: priority 1, enemy visibility

Code inspection identified incomplete snapshot hydration in `coopArenaSync.js`: Ditch Witch, Apparition/R.O.U.S., Crosstalk and Jitter received abbreviated state objects without `clock`. Their renderers calculate atlas columns from that clock, producing NaN source rectangles that canvas can silently ignore. Ditch's `animT` was being incremented although its renderer reads `clock`. Hydration now uses the existing species state constructors and advances render-only clocks, without running local attack state machines.

Additional corrections:
- Dead snapshot IDs and duplicate pooled IDs are removed during reconciliation; malformed coordinates are not added to drawable pools.
- A single co-op enemy body pass handles ordinary enemies, elites, clones and bosses, including unknown species. It does not depend on the ordinary enemy-type list to draw a boss fallback.
- Actual drawImage calls are guarded against unready images, non-finite coordinates and atlas crops outside image bounds. Failed or absent bodies get type-specific, visible pixel silhouettes at the same authoritative position; no target, reward or collider is invented.
- Each co-op enemy draw isolates alpha/compositing and nested canvas state. Diagnostics are deduplicated by species and failure reason.
- Failed enemy asset loads in co-op can use visible pixel bodies; solo's existing asset/startup policy is unchanged.
- Authoritative mode no longer falls through to solo simulation while waiting for a snapshot. F9 cannot inject independent local stress-test enemies into a shared room. Existing authoritative peer support-fire suppression remains intact.

Changed existing files:
- `src/game/multiplayer/coopArenaSync.js`
- `src/game/signalEngine.js`
- `src/components/game/GameArena.jsx`

New focused modules:
- `src/game/art/enemyDrawGuard.js`
- `src/game/art/drawEnemyBody.js`
- `src/game/multiplayer/enemyVisibilityDebug.js`

## Development diagnostic harness

In a development preview, add `enemyDebug=1` alongside the existing multiplayer room query parameter. The canvas shows enemy IDs, collider circles, expected living in-view IDs, drawn-body counts and fallback counts. `run.coopVisibilityReport` also contains the snapshot sequence, expected/drawn IDs, missing IDs and fallback reasons. The body pass includes an overscan margin, so drawn counts can include enemies whose colliders are just outside the view.

## Verification boundaries

`npm run build` completed successfully. No gameplay suite, screenshot audit, two-account session, retina/mobile rendering session or reconnect playtest was run in this checkpoint. The root cause above is established from the state/frame-selection code path; visual confirmation in a real shared session remains required. Use the Testing Agent for those flow checks, including every species and deliberately failed assets.

## Deferred, not represented as completed

1. Server-owned private participant offer streams, ownership validation and reconnect replay. Current personal-offer behavior has not been changed or validated here.
2. Canonical world/range normalization. Both current engine and actor declare 1100×800 world bounds; this checkpoint does not change either dimension, camera sizing, range formulas or the existing 1.2 multiplier. No range cap correction is claimed.
3. Requested meeting-table and additional deployable artwork integration.

No publication action was taken.