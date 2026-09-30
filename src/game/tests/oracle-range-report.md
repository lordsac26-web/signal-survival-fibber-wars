# Oracle art + viewport-proportionate range correction

Scope: Oracle art and attack reach only. No save storage/schema/backend, roster ids/stats/hitbox, economy, enemy stats, multiplayer, or other character sprite replacements were changed. Character descriptions and tool/range reference text were corrected to match the new reach definition. Existing pooled Canvas simulation, fixed-step loop, camera/shake, aiming, synthesized audio and separate special/projectile VFX remain.

## Actual assets and integration

- Confirmed current stable roster id is `oracle` in characters.js; the manifest was not used to invent an id.
- Public movement upload: `https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/6000b350b_oracle-movement.png`.
- Public portrait upload: `https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/ddab5b16f_oracle-portrait.png`.
- Exact manifest upload: `https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/e3ac4cbf8_oracle-animation.json`.
- Stored exact bytes at `/assets/oracle/movement.png`, `/assets/oracle/portrait.png`, `/assets/oracle/animation.json` under project public/. Build copied all three into dist/assets/oracle/. No expiring attachment URL is used. Original URLs remain in the shared mapping for provenance/HTTP tests.
- Actual unauthenticated HTTP responses: movement 200, 112380 bytes, 448×320; portrait 200, 5612 bytes, 256×256. Automated tests inflated and unfiltered the actual PNG pixel data and verified SHA-256 equality against local copies, not merely filename/metadata assertions.
- Visually inspected the supplied atlas image: down row 0, left row 64, right row 128, up row 192. Side rows appeared directionally coherent in static inspection; no mirror/swap was applied. Seven columns per row are used. This does NOT establish live animation quality.
- Note from pixel decoding: alpha>200 foot pixels end at source y=57 or 58 depending on frame; source maximum alpha is 254 for the atlas and 253 for the portrait. The provided fixed y=58 foot anchor is retained; original pixels were not shifted or replaced.
- Shared art definition + cached preload promise load/decode both images and validate the local manifest before simulation starts. One alpha-preserving hurt atlas is created once. Load failures block startup with an explicit error and Retry button; the engine refuses an unpreloaded Oracle instead of silently drawing the old shape.
- Oracle-only state is updated from actual player displacement, including mobile joystick input. Four directions, last-facing directional idle, 8fps movement, stopped animation when stationary/blocked, 48-world-unit transparent cell size, and foot anchor at the unchanged player's world/collision center. Rounded destination coordinates; no per-frame image requests, canvases, art allocations or React animation state.
- Smoothing is disabled only during Oracle draw and restored afterward, so existing enemies/other characters keep their previous image interpolation. Damage selects the cached hurt atlas only on actual HP loss. Auto-aim direction and special/projectile graphics are independent of movement facing.
- The portrait is used by existing shared CharacterPortrait → character-select cards, Field Guide → Characters → Oracle, and Career Gallery → Technicians → Oracle. Other character portrait rendering is untouched. No duplicate About page was added. The portrait uses the Image component, meaningful alt text, transparent proportional sizing and nearest-neighbor CSS; failed portraits show an explicit error.

## Root cause and audit

Old targeting/area radius: weapon.range × run.range in fixed world units. Old launch lifetime: that product / projectile speed. Oracle starting OTDR therefore reached 520 × 1.35 = 702 units independently of a 390-unit mobile visible width. No DPR multiplication or infinite beam loop was found. Beam/beamSweep were already moving piercing pulses, not permanent full-map beams. Chain was already three fan shots, not recursive/global bounces.

Corrected: one effectiveRange helper governs target lookup, launch budget, eligibility, area radius, turret/helper/structure firing, named signatures, HUD and paused per-tool reach. Viewport = Canvas CSS bounding dimensions / camera scale; DPR is only a backing-store/render transform. ResizeObserver and resize recalculate temporary viewport state, including while paused, without rewriting saved modifiers. Launched shots retain their original budget on live resize.

## Exact new formula

Let S = min(CSS width, CSS height) / camera zoom.
Let B = original weapon's canonical reach rating (from WEAPON_ARCHETYPES; fallback current rating for runtime signature/structure configs).
Let F = profile reference rating; G = clamp(sqrt(B/F), 0.7, 1.1).
Let Q = sqrt(max(0.01, current weapon rating/B)); weapon quality bonuses therefore remain meaningful even when its baseline family factor is capped.
Let M = saved run.range, unchanged; optional flat fields add world units once.

Effective reach = clamp(S × profile baseline fraction × G × Q × M + run.rangeFlat + weapon.rangeFlat, 0, S × profile cap).

- Ordinary ranged: baseline 0.26, reference 330, cap 0.42; Oracle ordinary ranged cap 0.44.
- Turret/helper/structure firing: baseline 0.24, reference 330, cap 0.42 (Oracle 0.44). Placement radii/coordinates are unchanged.
- Melee/nova/cone/orbiting: baseline 0.12, reference 105, cap 0.18.
- Chain fan: baseline 0.15, reference 210, cap 0.18, zero bounces. Each of the three pulses gets the same single distance budget. No global target scan or new bounce behavior was invented.
- Named signatures: Callback 0.32/cap 0.40; Clause and Deep Clean 0.30/cap 0.40; Frenzy burst 0.12/cap 0.18. Full Trace is the explicit exception: baseline 0.40/cap 0.60, so Oracle's base M=1.35 yields 54% of the short view. HUD shows actual signature units and percent.
- Saved percent modifier convention is additive percentage points: Oracle 1.35 + gear 0.03 = 1.38, NOT 1.35×1.03 and NOT 135 world units. Current generated items do not roll flat range fields; optional flats, if present, mean world units before the cap. Legacy weapon.range is now a normalized reach rating, not an absolute map distance. No stored values are converted or accumulated on resize.

Projectiles advance by min(speed×dt, remaining distance) BEFORE swept collision. Traveled distance is deducted regardless of lifetime and direction; lifetime is only a failsafe. Enemy centers beyond the frozen origin cap are rejected even if their body radius overlaps the endpoint. Piercing shots do not replenish the budget. Mortar impacts are clipped to the original reach envelope. Rendered pulse fronts cannot extend into nonexistent remaining travel. Melee/cone are matching 120° aimed sectors; nova/orbiting and burst signatures remain radial. The transient sector outline uses the same radius/angle as collision and is preallocated, not an extra simulation entity.

## Logged numeric examples (world units)

Desktop Canvas CSS 1280×720: existing camera scale max(1,1280/1100,720/800) = 1.163636; shorter visible world side S=618.75. Mobile CSS 390×700: zoom=1, S=390. Landscape 700×390 yields the same short-side ranges. All values are invariant under DPR 1/2/3.

| Weapon/role | Old default | New desktop default | New mobile default | Old upgraded (+1 factor) | New desktop upgraded | New mobile upgraded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ordinary Power Meter | 330 | 160.875 | 101.4 | 660 | 259.875 | 163.8 |
| Oracle OTDR | 702 | 238.899 | 150.579 | 1222 | 272.25 | 171.6 |
| Ordinary Cleaver | 92 | 69.502 | 43.807 | 184 | 111.375 | 70.2 |

An ordinary OTDR without Oracle's modifier has baseline 28.6% of the shorter side; Oracle starting OTDR is 38.61%, bounded below the 50% center-to-short-wall distance. The table's large +1 modifier is a test vector to demonstrate upgraded caps, not a newly granted bonus.

## Actual verification results

- npm run test:solo: 32 passed, 0 failed (21 existing regressions + 11 new checks).
- New checks: actual HTTP PNG decode/hash/dimensions/transparency/manifest; shared UI/engine wiring; four directions/stop/resume/anchor/smoothing/hurt; cached loader/decode/retry/error; logical CSS desktop/mobile/orientation/zoom and DPR; inside/outside eligibility, flat/percent/weapon bonuses, no saved-state accumulation; large-dt/high-speed/piercing endpoint; rendered beam front/tail limits; bounded fan/arc/signature budgets; actual engine movement/idle/resize and actual engine damage branch with mocked Canvas/DOM.
- Actual engine tests boot createSignalEngine with mocked DOM/Canvas/RAF and exercise its real fixed updates/render dispatch, rather than only testing a detached animation helper. They prove which atlas/crop is selected and that the real damage branch chooses the cached hurt image; they do not prove browser-decoded pixel presentation or frame-time smoothness.
- npm run build: exit 0, all local art files present in dist/assets/oracle/.
- npm run lint: exit 0, no lint errors.
- Existing nonblocking notices only: outdated Browserslist metadata and Node experimental loader warning for tests. No package install or unrelated cleanup.

## Unverified / blockers

No asset-download, build or lint blocker remains. Live browser visual playback, side-frame continuity during motion, pixel appearance, weapon aim, and mobile touch interaction have NOT been playtested. Native browser Image.decode is called by the loader, but automated loader/engine tests mock browser objects; actual source PNG decoding was verified independently in Node. No 500-enemy performance claim is made.

Use Testing Agent for: 'Select Oracle, inspect its portrait in the Field Guide/character select/gallery, walk all four directions and stop/resume using keyboard and touch, take damage, verify sprite tint and independent targeting, rotate/resize, and confirm ordinary shots stay within the displayed reach while Full Trace shows its named exception.'

## Precise changed files

New asset/data files:
- public/assets/oracle/movement.png
- public/assets/oracle/portrait.png
- public/assets/oracle/animation.json

New art/UI/range modules:
- src/game/art/characterSprites.js
- src/game/art/spriteLoader.js
- src/game/art/spriteAnimation.js
- src/components/game/OraclePortrait.jsx
- src/components/game/RangeReadout.jsx
- src/game/combat/rangeConfig.js
- src/game/combat/effectiveRange.js
- src/game/combat/projectileTravel.js

Modified integration/reference files:
- src/game/signalEngine.js
- src/game/performance/drawProjectile.js
- src/game/combat/signatures.js
- src/game/data/characters.js (range descriptions only, not roster ids/stats)
- src/game/data/reference.js
- src/game/data/stats.js (range label/description only)
- src/components/game/CharacterPortrait.jsx
- src/components/game/GalleryScreen.jsx
- src/components/game/GameArena.jsx
- src/components/game/GameHUD.jsx
- src/components/game/StatsScreen.jsx
- src/components/game/IntermissionInventory.jsx (reach-rating label only)
- src/pages/FieldGuide.jsx

New verification files:
- src/game/tests/oracleRange.test.mjs
- src/game/tests/oracleEngine.test.mjs
- src/game/tests/pngDecode.mjs
- src/game/tests/oracle-range-report.md