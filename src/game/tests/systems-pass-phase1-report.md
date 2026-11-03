# Big systems pass: Phase 1 delivery report

## Status and scope

| Phase | Status | Delivery |
|---|---|---|
| 1: Tier ladder and combining | DONE, automated checks passed; browser checks outstanding | Five-tier items, acquisition auto-combining, manual inventory combining, duplicate shop opportunities, tier stats/prices, save migration, shared card details and Field Guide previews |
| 2: Difficulty and economy scaling | NOT DONE | Deferred as the next coherent phase. No new enemy/economy curves or anti-camp behaviours have been implemented. |
| 3: Turret rebalance and modules | NOT DONE | Deferred until Phase 2. No install/replace flow, module drops, new atlas columns, or turret DPS rebalance yet. |

Only Phase 1 was implemented in this delivery. No publication was performed. The supplied module art is intentionally not appended yet: its required position is before Phase 3, after Phase 2. The current 7936×256 icon sheet, restored original pixels, rect mapping and icon tests are unchanged.

## Phase 1 behaviour

- Display ladder: Basic → Rare → Epic → Legendary → Overclocked.
- Stored ids: `common`, `rare`, `epic`, `legendary`, `overclocked`.
- Existing saved items actually used capitalized ids. The reader accepts those, converts to lowercase, and infers an un-tiered base snapshot using the old strength factors (1, 1.15, 1.3, 1.5). New items store an explicit snapshot and version so reloads never multiply them again.
- Two matching identities at the same non-terminal tier combine. Weapon identity is `baseId`, passive identity is its name key, and deployable identity is the stable deployable id, resolved from its structure for legacy records.
- Different tiers and different identities never combine. Premium cards never combine. Multiple terminal Overclocked copies remain separate.
- Shop purchase, level-up selection and the shared loot acquisition operation all use the same auto-combine path. There is no separate loot-drop UI to modify.
- Acquisition combines before checking weapon slots or family caps, allowing an exact matching purchase at full capacity. Cascade merges work when the newly promoted item meets another owned item at its new tier.
- Existing saved pairs can be manually combined from weapon, passive and deployable inventory cards. Combining costs no Signal, rebuilds equipped bonuses and persists through the existing checkpoint flow.
- A short, reduced-motion-aware flash and toast name each result, for example `Combined: Rare Fiber Cleaver`.
- Invalid/stale purchases and combine actions cannot charge or consume an item twice.

### Choices made where the brief allowed interpretation

1. **Incoming base roll wins.** The result uses the incoming copy's un-tiered rolls and special effect, promoted to the next tier. Rolls are not concatenated or regenerated; combining does not add the random-roll slots that a newly generated higher-tier item may have.
2. **Module inheritance is future-compatible now.** If either copy has a module, it survives. If both do, the incoming module wins and the toast explicitly says the other was destroyed. This is data-level inheritance only, not Phase 3 installation or replacement UI.
3. **Clone's fresh rolls stay capped at Rare.** Its premium tune-up cap remains three, but combining can climb the entire new ladder. Forced duplicate offers also respect its Basic/Rare sale ceiling, so a Clone that combined an Epic cannot buy an Epic duplicate directly.
4. **The existing one-turret-weapon limit remains.** An exact same-tier turret duplicate can now be bought and combined into that slot. A different archetype or tier cannot add a second turret. Existing legacy multi-turret saves are not destructively trimmed.
5. **Legacy deployable ranks survive.** Old rank-one/rank-two bonuses and structure cooldown state are retained. New copies use the tier ladder instead of incrementing a separate loot rank; a merge keeps the higher pre-existing legacy rank rather than adding ranks.
6. **Useful magnitudes improve with tier.** Weapon damage, healing, reach ratings, turret lifetime, passive rolled bonuses and numerical passive effects multiply by the tier factor. Weapon/deployment/fire intervals divide by it. Deployable damage, duration, footprint/reach and control magnitude scale, with slowing capped at 90%. Active caps, trap-use counts and binary triggers stay fixed. Existing viewport reach caps still apply. Basic cadence is unchanged; higher-tier cadence deliberately improves.
7. **Premium tune-ups remain distinct from tier.** Their existing bounded 10% damage / 5% interval adjustments remain separate, including Clone's three-tune-up limit. Epic premium promotion now uses the shared tier-scaling operation. The Overclocked tier is reached by combining Legendary pairs, not by purchasing a premium card.

## Final Phase 1 multipliers and prices

| Tier | Stored id | Base-stat strength | Base-price multiplier | Direct weapon price, wave 1 | Passive price, wave 1 | Turret weapon / deployable price, wave 1 |
|---|---|---:|---:|---:|---:|---:|
| Basic | common | 1.00 | 1.0 | 27 | 24 | 80 |
| Rare | rare | 1.35 | 1.6 | 43 | 38 | 128 |
| Epic | epic | 1.85 | 2.4 | 65 | 58 | 192 |
| Legendary | legendary | 2.50 | 3.5 | 95 | 84 | 280 |
| Overclocked | overclocked | 3.40 | Not sold | Not sold | Not sold | Not sold |

Tier prices are rounded, then the existing wave multiplier is applied and rounded again. **Until Phase 2, that multiplier is still `1 + 0.30 × (wave − 1)`, not the requested Phase 2 0.06 curve.** Premium reference pricing, reroll costs, between-wave healing and the other economy rules remain unchanged in this phase.

## Duplicate shop opportunities

- A deterministic 30% per-visit check can reserve one unlocked slot for an owned identity at exactly its current tier, excluding terminal Overclocked items.
- Fresh ordinary slots suppress accidental exact owned-tier duplicates; rerolls do not create another duplicate opportunity during that same visit.
- Locked matching offers are retained, counted as the visit's opportunity, and prevent manufacturing another one. The two-lock limit and exact locked prices remain intact. Pre-existing locked content is not discarded to force a new duplicate.
- Character weapon restrictions, Veteran family preference, character-preferred passive roll pools, Clone's roll ceiling, premium eligibility and signature exclusions are retained.
- Sampling result: **359 duplicate visits / 1,200 eligible sampled visits = 29.9167%**. Every sampled duplicate matched both identity and tier; no sampled visit manufactured more than one; rerolls did not create another.
- Existing special-offer sampling: 385 deployable/turret offers in 20,000 fresh slots (1.925%); 191 premium offers (0.955%). These remain near their previous 2% and 1% attempt rates.

## Item presentation

The same details component displays category, named tier, already tier-scaled base stats, rolled bonuses, special effects, any installed-module metadata, and combine status in shop cards, level-up choices and intermission inventory cards. Status is `1/2 for next tier`, `2/2 combines to [tier]`, `Max tier`, or `Does not combine` for premium cards.

The Field Guide covers all 20 weapon archetypes, all 35 passive name keys and all five deployables with selectable previews of all five tiers. Passive rolls are honestly labelled illustrative seeded examples, because a name does not fix its procedurally generated bonuses. Combat stats also display Basic instead of Common. There are no module cards yet; that category's actual items and UI are Phase 3 work.

## Verification

### Automated/unit/headless simulation only

- **236 tests passed, 0 failed**: the existing 219 tests plus 17 new tests.
- Existing tests were updated only where their old contract contradicted the requested new behaviour: capitalized rarity output, unconditional turret duplicate blocking, migration metadata, and isolating wave-roll scaling from the new tier multipliers. Their remaining assertions were retained; tests were not skipped.
- New coverage: every combine-ladder step for weapons/passives/deployables; terminal behaviour; no cross-tier or cross-identity merging; premium exclusion; cascade merges; incoming-roll and module inheritance; full-capacity acquisition; manual and level-up acquisition; stale actions; no stale inventory bonuses; tier stat/pricing multipliers; JSON save/resume stability and server validator acceptance; Clone limits; Legendary's fresh-roll wave gate; no random Overclocked drops; duplicate visit rate and budget; lock preservation; Field Guide item coverage.
- Existing headless engine regressions for enemies, bosses, Admin, arenas, sprite assets, Basic weapon cadence, and HUD/canvas separation passed. No new enemy scaling, enemy art or arena logic was introduced.
- `npm run lint`: passed.
- `npm run build`: passed. The existing non-blocking Browserslist age warning remains.
- Confirmed unchanged in this delivery: the atlas image/rect module; enemy/boss/tuning definitions; arena floors; the arena component and HUD component.

### Real browser

| Viewport | Result |
|---|---|
| 390×844 | NOT VERIFIED |
| Desktop | NOT VERIFIED |

No browser playtest, screenshot-based visual proof, toast/flash raster check, touch interaction check, or live cloud-save round trip was performed. The passing checks above are unit tests, recorded-canvas/headless simulations and build checks, not browser verification.

Use the Testing Agent for these remaining browser goals: "At 390×844, buy a matching tool with a full loadout, confirm it combines without replacement, reload the checkpoint, and check the result and toast" and "On desktop, manually combine a saved passive/deployable pair and inspect all tier previews in the Field Guide."

## Phase 2 report: NOT DONE

- Requested enemy HP/contact/speed and elite/boss multipliers: not implemented or tuned.
- Lower simultaneous-enemy caps, ranged guarantees, pincers and anti-camp elite behaviour: not implemented.
- Reduced per-kill Signal, compound thresholds, 0.06 shop growth, compounding reroll costs and scaled sinks: not implemented.
- Acceptance sim (a), camper six-weapon median death by wave 8: **NOT RUN**.
- Acceptance sim (b), moving average build reaching wave 20 in at least half of seeds: **NOT RUN**.
- Acceptance sim (c), wave-1/wave-20 TTK targets: **NOT RUN**.
- The requested final wave-by-wave HP/damage/cap/DPS/TTK/Signal/threshold table is **not produced** because no Phase 2 balance has been implemented or calibrated. No acceptance claim is made from the existing regression suite.

## Phase 3 report: NOT DONE

- The four turret-deploying archetypes remain Splice Tray Sentry, Closure Cannon, Launch Cable Nest and Fan-Out Splitter.
- Their phase-3 base-DPS reduction to 45–60% of comparable direct fire has **not** been implemented. No before/after DPS comparison is claimed. Higher-tier scaling from Phase 1 is active, but is not a turret rebalance.
- Four module items, Rare/Epic shop rolls, module inventory, turret-only installation, single-slot replacement confirmation, doubled rate/damage/range, and 5-HP turret-kill healing: not implemented.
- Module installation/replacement/gating tests: not added, because the feature does not exist yet. Existing module metadata inheritance during combining is tested.
- The supplied four transparent 128×128 cells have not been downloaded, recropped or regenerated, and the atlas has not been changed to 8448×256 yet. The append and new width/66-column/cell-count contract belong immediately before Phase 3.

## Files changed

### New
- `src/game/items/tiers.js`
- `src/game/items/itemScaling.js`
- `src/game/items/combining.js`
- `src/game/items/acquisition.js`
- `src/game/progression/upgradeRules.js`
- `src/game/shop/itemPricing.js`
- `src/game/shop/duplicateOffers.js`
- `src/game/shop/rollPools.js`
- `src/game/data/itemReference.js`
- `src/components/game/InventoryItemCard.jsx`
- `src/components/game/GuideItemDetails.jsx`
- `src/game/tests/tierLadder.test.mjs`
- `src/game/tests/itemAcquisition.test.mjs`
- `src/game/tests/systems-pass-phase1-report.md`

### Modified
- `src/game/data/generation.js`
- `src/game/data/characters.js` (Clone's player-facing rule description)
- `src/game/data/stats.js` (Basic display terminology)
- `src/game/data/reference.js`
- `src/game/progression/runRules.js`
- `src/game/progression/useSoloSession.jsx`
- `src/game/shop/shopRules.js`
- `src/game/signalEngine.js` (consume tier-scaled deployable definition snapshots)
- `src/components/game/ItemStats.jsx`
- `src/components/game/IntermissionInventory.jsx`
- `src/components/game/ShopOffer.jsx`
- `src/components/game/ShopScreen.jsx`
- `src/components/game/UpgradeScreen.jsx`
- `src/components/game/PurchasePicker.jsx`
- `src/components/game/StatsScreen.jsx`
- `src/pages/FieldGuide.jsx`
- `src/index.css` (requested combine flash and reduced-motion handling)
- `src/game/tests/core.test.mjs`
- `src/game/tests/rosterCleanup.test.mjs`
- `src/game/tests/turretCrew.test.mjs