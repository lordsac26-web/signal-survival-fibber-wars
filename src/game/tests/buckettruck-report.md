# Bucket-Truck turret real-art integration

Scope honored exactly: ONLY the Bucket-Truck Boss's turret-placement visual (his 'Aerial Closure' signature deploy, special id 'fortify' → signature turret wid `signature-bucket`) and the shop's Bucket Truck Keys deployable (id `bucket_keys` → structure `turretMount`) got the real art, plus the Field Guide/character-info picture for Bucket-Truck Boss. Saves, combat, turret hitbox/HP/damage/placement, the range fix, economy, all other characters/enemies/structures and their hard-hat/googly-eyes placeholders are untouched — the truck is the only structure drawn WITHOUT googly eyes, per the art.

## Static vs idle cycle — decision

Added the SLOW IDLE CYCLE (manifest `fps: 1.5`, 3 poses, ~0.67s per pose), computed from the placed structure's `born` timer — no new animation state. Reasoning: the manifest itself recommends this ("cycle slowly between them for a subtle idle settle"), it needs zero extra state (frame = floor(born×1.5) % 3 at draw time), and it cannot be mistaken for tracking since all three poses are near-duplicates. It is never presented anywhere as a sweep/aim animation; nothing in the UI or copy claims target tracking. The 16 unused smaller poses from rows 2–4 of the user's sheet were NOT used (edge-speckle noise, inconsistent proportions — per the processing notes); if more poses are wanted later, that limitation stands.

## Before → After

Before: both the Q-key Turret Mount (structures pool) and the Boss signature turret (turrets pool, mode 'pellet') rendered via `drawTurretBody` — a procedural brown/slate stick-frame tripod with a colored barrel, yellow hard hat and googly eyes.

After: both draw the FIBERNET bucket truck from the real atlas (230×190 tiles), displayed at 64px wide (worldSize), centered on the structure point with the manifest's ground baseline (tile-local y=174, wheel contact) anchored to it, pop-in grow scaling and end-of-life fade preserved from the old branch, rounded coordinates, imageSmoothingEnabled=false only during the draw. Weapon-archetype turrets, Don's helper crew, and every non-truck structure still use drawTurretBody/drawHelper unchanged. No googly eyes on the truck.

## Files changed

New local asset copies (byte-identical to the public uploads; SHA-256 verified in tests; copied into dist/ by the build):
- `public/assets/buckettruck/turret.png` (690×190, 113543 B), `icon.png` (234×204, 36579 B), `animation.json` (2020 B)

New code:
- `src/game/art/structureSprite.js` — `truckFrame()` (pure idle-cycle selector) + `drawTruckTurret()` (centered, ground-anchored, rounded, smoothing-off draw)
- `src/components/game/StructurePortrait.jsx` — Field Guide picture via the shared Image component, explicit load-failure message
- `src/game/tests/buckettruck.test.mjs` — 4 new tests

Modified:
- `src/game/art/characterSprites.js` — added `STRUCTURE_SPRITES.bucket` definition (atlas/icon/manifest local paths + public source URLs, tile 230×190, worldSize 64, anchorY 174, idleCycle 3, manifestSpec) + `structureSpriteDef()`; notes that the 3 tiles are near-duplicate poses, not a sweep
- `src/game/art/spriteLoader.js` — loader now honors `portraitW`/`portraitH` (the icon is 234×204, not square; Oracle/Lag unaffected, they default to 256×256) and gained `preloadStructureSprite()`, reusing the exact same preload/validate path as characters and enemies
- `src/game/signalEngine.js` — new optional `structureArt` argument; in the draw loops, `turretMount` structures and the `signature-bucket` turret draw the truck (via `truckDef.structureType` / `truckDef.signatureWid`), everything else keeps its placeholder; no gameplay changes
- `src/components/game/GameArena.jsx` — preloads character + Lag Sprite + Bucket-Truck art in parallel before combat; failure blocks start with the existing visible retry button (honest failure, no silent placeholder fallback)
- `src/pages/FieldGuide.jsx` — Characters tab now renders `StructurePortrait` for the Bucket-Truck Boss entry (icon, 234×204)

## Shop icon note

The shop deployable card (ShopOffer) has NO icon slot (it shows rarity, name, stat chips, price) — the "if it has an icon slot" condition does not hold, so nothing was added there. The '🔑' keys emoji remains the Bucket Truck Keys ITEM icon in the HUD deployable list and the touch Deploy button (that's the keys item itself, not the turret structure); say the word if you want the truck icon there instead.

## Verification

- Both public PNGs: HTTP 200, exact dimensions (690×190, 234×204), PNG-decoded with proper transparency; local copies SHA-256-identical to the uploads; manifest fetched raw (HTTP 200, byte-identical locally) and validated: structureId `bucket_truck_turret`, tileWidth 230, tileHeight 190, rightEdgeAnchorX 210, groundBaselineY 174, idle_cycle @ 1.5fps, 3 frames at x 0/230/460.
- Engine wiring asserted in source: truck only for `turretMount` + `signature-bucket`; GameArena passes all three preloaded art sets.
- Real-engine test: booted the actual engine twice — Bucket Boss with the special pressed → signature turret draws the truck, advancing from pose_a (sx 0) to pose_b (sx 230) as the idle cycle elapses; Rookie owning Bucket Truck Keys with the deploy flag → turretMount structure draws the truck.
- `npm run test:solo`: 42 passed, 0 failed (38 prior + 4 new). `npm run build`: exit 0, dist contains the truck assets. `npm run lint`: exit 0.

## Not verified

Live in-browser playback has NOT been verified: how the truck reads at 64px in real gameplay, the subtle idle wobble feel, and mobile rendering are unconfirmed in this environment. Use the Testing Agent: 'Play as Bucket-Truck Boss, press E to place the signature turret and verify a FIBERNET bucket truck appears with a very slow three-pose idle wobble, then buy Bucket Truck Keys in the shop, press Q, and verify the same truck appears; check the Field Guide Characters tab shows the truck icon on the Bucket-Truck Boss card.'