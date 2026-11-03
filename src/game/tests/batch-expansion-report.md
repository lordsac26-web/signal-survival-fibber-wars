# Overnight roster / encounter / arena batch

## Status
- A DONE: removed all six requested player definitions, retired ability branches/range profiles, generic portrait decorations, and retired shop preferences. Remaining roster exactly: Night-Shift Nomad, 30 Year Veteran, OTDR Oracle, Dispatch Don, No Accountability Admin, Contractor Clone, Internet Services Representative. Five immediate choices; Clone/ISR retain their career gates. Fixed reversed unlockMet arguments on select; count copy is derived from the roster.
- B DONE: Admin already existed, including Meeting Invite and death hold. Its character-select portrait was still generic. Added AdminPortrait to selection and Field Guide, using idle strip frame zero, with 10 transparent pixels above it in the existing 76x128 portrait box. Required flavor, joke, 30% dodge / 50% cap, 75% damage, four mixed slots, 4s contact immunity and 20s cooldown are present. Expandable exact stats remain. Existing mechanics unchanged; server validation now honors the already-existing four-slot Admin limit too.
- C DONE: upgraded the existing crosstalk enemy identity, not a duplicate. Processed 33 source frames and integrated zig-zag approach, rooted crouch telegraph, locked short lunge, recovery, normal defenses/meeting immunity, sprite rendering and guide. Optional blink deliberately omitted for fairness and reduced complexity.
- D DONE: upgraded the existing attenuation elite identity. Genuine left/right sprites, kiting, locked sonic cone and one-shot Focus buff. Uses the ordinary existing spawn clock/active budget with conservative acceptance and max one living Apparition. There was no separate elite-only pool to reuse; no new spawn clock or additional body budget was introduced.
- E DONE: Router boss in the same engine-owned enemy pool, outside ordinary ENEMIES rolls. Existing boss gates alternate: Squirrel 20/40/60..., Router 30/50/70... . One boss per gate. Uses the existing single HUD boss meter; no mini HP meters. Clearing a Router gate does not incorrectly unlock ISR's Squirrel milestone.
- F DONE (follow-up): the earlier 404 was a mistyped URL plus a redirect; the verified direct CDN URL supplied the Worksite source. It was copied into the app's own arena asset folder (no runtime hotlink), preloaded and baked once like Office, and added as a third selectable theme beside Signal Grid and Office. Signal Grid remains the default because on-device readability over the busy rocky terrain is still only verified by simulation, not in a real browser.

## Migration and residual references
`rookie`, `frenzy`, `cleaner`, `bucket`, `patty`, `deadline` selected ids and resumable checkpoints silently migrate to `nomad`. Night-Shift Nomad was chosen because its six unrestricted mixed-tool slots preserve the retired characters' possible inventories. Current signature cooldown/progress and alternate-kit activation reset; health/stats use normal normalization for the new character. Run id, wave, seed, XP, Signal, equipped instance ids/mods, passive items, deployables, locked offer identity/price, earned progression and completed-run history are retained. Console records the remap once per retired id per session, without account information. Client/server agree, including old Dispatch aliases and legacy characterId checkpoint fields. Old per-character career totals, summaries and earned alternate-kit history are intentionally retained; they do not create playable cards. The legacy `frenzy`, `cleaner`, `bucket` career badge ids remain stable, not character definitions. Bucket Truck Keys, Cleaner weapon and other similarly named tools/items remain. No uncertain preexisting asset/debug/report archives were deleted. No account records were bulk rewritten.

## Measured source art and crop decisions
All supplied character/enemy sheets were opaque, including both nominal RGBA PNGs (alpha was 255 throughout). Individual figure bounds were measured; no uniform source-grid assumption. Pixel keying removes bright magenta, bounded nearest-body fringe recolouring removes JPEG-purple remnants without punching silhouette holes. Frames are repacked without resampling into transparent cells, with nearest-neighbor drawing. Source crops/counts are recorded beside the PNGs in animation.json.

| Enemy | Measured band counts | Repacked cell | State mapping |
|---|---|---|---|
| Critter | 4 / 5 / 5 / 6 / 5 / 4 / 4 = 33 | 136x96 | First band idle; fourth band genuine LEFT run, mirrored for right; seventh band RIGHT crouch/lunge, mirrored for left. Third band reads as back-facing, not dissolution. Other bands retained as source-derived optional art; no blink behavior. |
| Apparition | 8 / 8 / 8 / **7** / 8 = 39 | 128x128 | Genuine right/left; attack poses 1-4 warn, pose 5 releases, 6-7 recover. Label says 6 but seven figures are visible/measured. Fifth pose's wave is separated from the body and rotated/scaled/clipped to the shared cone. Hover body anchors are stable per row. |
| Router | 8 / 8 / 8 / 8 / **7** / 8 = 47 | 128x128 | Genuine right/left; UP row used for either vertical travel without turning the machine upside down. Seven windup poses despite label 6. All eight fire poses; yellow beam separated from body. Ground baseline at atlas y=120. |

Headers/labels excluded by crop position, and Router grid divider columns excluded individually. Pixel tests show no bright-magenta remnants in any processed output and substantial central body pixels in every animation cell. Original source images and unused Critter bands remain intentionally as provenance, not speculative assets to delete.

## Exact balance decisions
Existing normal scaling stays HP x(1+0.28*(wave-1)), chase speed x(1+0.025*(wave-1)), contact x(1+0.05*(wave-1)). Existing pickup Signal/XP/rarity/price rules are unchanged.

### Critter
- Base HP 22 (was 50), chase 106 units/s (was 72), contact 12 (was 14), radius 15. Pickup value remains 5.
- Eligible wave 4+, full ordinary identity weight 1, same existing active caps and trickle attempts.
- Positive-forward zig-zag with 0.36 lateral amplitude, sine frequency 11 radians/s.
- Trigger within 125 units and on screen. First cooldown 1.5s; windup 0.4s; lunge 0.23s at 330 units/s, maximum travel 75.9; recovery 0.45s; cooldown 2.8s from start of recovery. Aim locks at windup.
- No contact damage during windup/recovery; at most one contact attempt during each lunge. Existing armor/dodge/invulnerability and Admin contact immunity still govern it. ISR/structure slows apply exactly once to both chase and lunge. Lunge body stays inside a 36-unit visible margin.
- No blink, invisibility, ranged attack, extra spawn body or special loot.

### Apparition
- Existing HP 145, speed 46 units/s, contact 30, radius 28, pickup value 12 retained.
- Eligible wave 6+, acceptance weight 0.2 relative to its existing ordinary candidate slot, at most one live. This is not a promise of 20% of all spawns; failed acceptance falls back to Lag. Existing global caps/attempts remain.
- Normal cone 22 base damage x normal wave damage scale; 32-degree half-angle (64 total), range 34% of shorter logical canvas side, capped at 300 units. Range/aim frozen at windup. Standard defenses and 0.55s hit grace. No collider inflation beyond visible cone.
- First cone cooldown 2.5s, windup 0.8s over first four poses, release on fifth, 0.24s release visual, 0.35s recovery, 4.6s cooldown from release. Exactly one damage check on release; no lingering damage.
- Focus is rooted and nondamaging for 1.5s. First eligible at 6s, then 11s cooldown from completion. Empowers ONLY next cone: half-angle 45 degrees (90 total), 1.5x damage (33 base); normal afterward. No damaging nova.
- Desired kite distance min(190, 70% of current reach); retreats below 80% of desired, holds up to desired, approaches beyond it. This scales kiting down on mobile so it can actually fire within its shorter range.
- Body/hand anchor: cone emitter +/-22 units horizontally, same body height. Actual wave and hit geometry use the same frozen muzzle origin and aim. Camera movement hiding a charge cancels it safely.

### R.O.U.S.
- Base HP 1100 x existing boss HP scale (1+0.19*(wave-1)); speed 48 units/s, contact 32, collider radius 32. Base boss pickup value 30 uses existing Signal/XP scaling, no new loot rules.
- Boss gates 30,50,70... instead of stacking with Squirrel; Squirrel retains 20,40,60... . Not an ordinary roll and no additional spawn timer.
- Beam 28 base damage x(1+0.05*(wave-1)); standard defenses and 0.55s grace. Half-angle 28 degrees (56 total). Reach 62% of shorter logical visible side, cap 390.
- First attack 3s after spawn; rooted 1.2s / seven-pose warning, 0.8s / eight-frame fire. ONE damage pulse at start of final/widest frame (0.7s into fire), never repeated or lingering. Recovery 0.5s, attack cooldown 7s from fire start. Earlier beam frames grow from 25% to 100% reach; only widest frame can damage, inside the drawn exact wedge.
- Ground-anchored full-body visibility: 60-unit horizontal, 100-unit top, 16-unit bottom margin; hiding a charge by moving the camera cancels it. Cone emitter +/-20 horizontal and -32 vertical from the leg baseline, shared by beam art and geometry. Beam is naturally clipped to the canvas, not HUD DOM.

## Arena choice and performance
Character selection has an Arena backdrop select: Signal Grid (default), Office or Worksite. Theme is stored on the run, preserved through checkpoints/intermissions, not automatically rotated. Desks, spools, trenches and pipes are cosmetic; no collision or pathfinding changes. Each themed floor decodes once and is cached as an offscreen 1100x800 world bitmap. Aspect-preserving centered cover adds a two-unit overscan to eliminate floating-point seams. A baked 48% dark-teal contrast wash plus edge vignette keeps each floor subdued and unit-readable. Per-frame drawing is an unscaled bitmap blit beneath pickups, Pudding puddles, meeting table, structures, enemies, projectiles and player; existing camera/DPR transforms are unchanged. Worksite uses the same bake path as Office; its source JPEG (1024x687, 115,532 bytes) is copied locally as provenance with a pixel-exact PNG runtime conversion, mirroring the Office asset convention.

## Files and assets changed
### Runtime / presentation
- `src/game/data/characters.js`, `combat.js`, `reference.js`, new `newEncounterGuide.js`, `bosses.js`
- `src/game/combat/signatures.js`, `rangeConfig.js`, `jitter.js`, new `crosstalk.js`, new `coneAttack.js`
- `src/game/signalEngine.js`
- `src/game/art/characterSprites.js`, new `crosstalkSpriteDefinition.js`, `crosstalkSpriteAnimation.js`, `coneEnemySprites.js`, `drawConeEnemy.js`, `arenaFloor.js`
- `src/game/progression/profileModel.js`, `runRules.js`, `useSoloSession.jsx`, new `rosterMigration.js`
- `src/game/shop/shopRules.js` (retired-character preferences only)
- `base44/shared/profileValidation.ts` (no new backend function)
- `src/components/game/CharacterSelect.jsx`, `CharacterPortrait.jsx`, `GameArena.jsx`, new `AdminPortrait.jsx`, new `ArenaThemePicker.jsx`; `src/pages/FieldGuide.jsx`
### Assets
- Updated `public/assets/admin/portrait.png` only, not Admin gameplay strips.
- New `public/assets/crosstalk/`: original source.jpg, animation.json, idle/stand/back/move/glitch/scatter/lunge/portrait.png.
- New `public/assets/attenuation/`: source.png, animation.json, idle/right/left/attack/focus/portrait/wave.png.
- New `public/assets/rous/`: source.png, animation.json, idle/right/left/up/windup/fire/portrait/beam.png.
- `public/assets/arenas/office.jpg` provenance and office.png runtime image. Follow-up: `public/assets/arenas/worksite.jpg` (copied from the verified direct CDN URL) plus pixel-exact worksite.png runtime image. No hotlinks at runtime.
### Tests
- New `rosterCleanup.test.mjs`, `crosstalk.test.mjs`, `coneEnemies.test.mjs`, `newEnemyAssets.test.mjs`, `arenaFloor.test.mjs`.
- Updated roster/default-character/extra-argument assumptions in `core.test.mjs`, `buckettruck.test.mjs`, `turretCrew.test.mjs`, `oracleRange.test.mjs`, `oracleEngine.test.mjs`, `lagsprite.test.mjs`, `pudding.test.mjs`, `isrOutage.test.mjs`, `threeArt.test.mjs`.
- `engineHarness.mjs` loads new art and records boss HUD outputs. Existing targeted encounter RNG fixtures in `startupSim.test.mjs` / `encounterCorrections.test.mjs` updated for expanded eligibility; ISR heal wait covers its full 8s window; Admin blast fixture uses a slow-firing tool so the small normal enemies survive until the blast assertion. No production cadence changed for these fixtures.
- Temporary `encounterProbe.test.mjs` deleted after checking ordinary spawn seeds. Fixed-RNG encounters exist only in regression tests; no force-spawn hook, debug route or temporary live encounter ships.

## Verification evidence and limitations
### Automated, not browser visual evidence
- Full suite: **216 tests passed, zero failed**. `npm run test:solo` exit 0.
- `npm run lint` exit 0; `npm run build` exit 0. Build only warns about old Browserslist metadata; no package changes made.
- Oracle baseline: new Critter, Apparition and Router simulations run at both 375x500 and 1100x800 playable-canvas sizes. Actual engine registry/pool records and actual sprite draw commands show ordinary Critter/Apparition spawns and Router's boss gate. Router uses HUD boss data; all new states pause and engine cleanup removes animation scheduling. Exact cone edge/range, single pulse, Focus gating, body-presence/pink-pixel checks, lunge bounds, source counts and Office draw layering/cover are regression tested.
- Six removed-id migrations tested across profile, checkpoint, cloud validator, locked shop prices and career history; selected portrait's pixels compared with padded Admin idle0. Existing full tests still cover Admin, Macrobend, 1.35x Keys truck, weapon audit, icon atlas, Pete, Squirrel, ISR, Pudding, Veteran, Jitter, Don crew, turret slot rule, save ownership/conflict rules, separated HUD/canvas, camera-relative ranges, density and two-lock shop.
- Existing playerProfile load endpoint returned 200. This was read-only; no live account progression or save was rewritten for verification, and no claim is made that a real migrated account was saved/reloaded in a browser.
### NOT VERIFIED in a real browser
No desktop/mobile rasterized playback, human readability inspection, animation feel, end-to-end character-select interaction, live cloud save round-trip or actual-device performance check was performed. Pixel/body tests and draw-command recordings are not proof of visual polish, no one-pixel bleed, exact floating-baseline feel or real phone FPS. Worksite and Office were inspected as supplied artwork, but unit readability over them remains unverified in a real browser; this is why Classic remains the default. Nothing was published by the assistant.

Section F follow-up verification (worksite): 218/218 tests pass (216 prior + 2 new worksite registration/layer tests, 4 total in arenaFloor.test.mjs), lint and build exit 0. The worksite asset loads from the app-owned public path through the same preload used in production, decodes at exactly 1024x687, bakes one cover blit plus the contrast wash and vignette, is cached on first preload, and in full engine runs at 375x500 and 1100x800 its blit is the first drawImage of every frame beneath all hazards and actors, with viewport, player clamping and bounds identical to a floor-less run. The only source-level consumption of the floor is the draw blit (no movement/spawning/collision contact), and HUD separation remains structural (flex regions, no overlays). All of this is draw-command and simulation evidence; no in-browser visual verification was performed.

Testing Agent follow-up goals: “Play Oracle on Signal Grid and Office at mobile and desktop sizes; inspect the three enemies' facing, uninterrupted body art, telegraph/release boundaries, single-hit damage, boss meter and HUD separation.” “Select Admin, check the portrait/copy, use Meeting Invite, then resume a migrated retired-character save without losing career or inventory.”