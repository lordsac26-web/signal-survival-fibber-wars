# Signal Survival: solo-first milestone report

## Implemented in this pass

- Public cartoon-telecom landing at `/`, public searchable/tabbed Field Guide at `/field-guide`, and public audio settings at `/settings`. Player profile and lobby routes require Base44 authentication. All four existing authentication flows are registered; their templates were not rewritten. No payment integration or paywall was added.
- Account-bound v4 profile manager with a separate local cache/outbox per user id, cloud loading/saving, visible saved/saving/offline/error/conflict status, manual retry, and explicit copy selection on conflicts. Unowned legacy local data requires an explicit one-time claim; it never automatically merges into another account. Legacy cloud rows remain readable.
- Owner-only RLS on SaveSync reads/creates/updates/deletes retained. playerProfile authenticates the caller, filters by that caller's creator id, checks ownership, validates checkpoint restrictions, uses revision-conditional updates, and acknowledges stable commit ids idempotently. This is a private solo-save boundary, not a claim of tamper-proof client-authoritative game results.
- Permanent lifetime records, badges, alternate kits, discoveries, best waves by character, recent summaries, selected character/loadout, settings, completed run ids and safe-boundary solo checkpoints are stored separately from run equipment. Death clears the checkpoint rather than the career. Existing legacy unlock ids become non-character badges.
- All 11 characters immediately selectable; Dispatch Don replaces Dispatch Dave, including old dispatch/dave/dispatch_dave ids, per-character best waves and alternate-kit ids. New No Accountability Admin, Permit Patty and Deadline Customer are present.
- Every signature is granted on selection. No kill/Signal/elite gate remains. Don creates four temporary following/shooting technicians. Bucket creates one sentry at the player's current coordinates, without needing a shop item. Veteran has 8 slots and max 4 tools per family; Oracle is ranged-only; Frenzy is melee-only. Restrictions are applied to starts, offers, purchases/swaps, restored checkpoints and server validation. The server also rejects changing a character within the same run id. Boss-marked enemies are excluded from instakill (no new boss is present yet).
- Shop inventory is checkpoint data, not unsaved component state. Four slots; max two locks retain the exact offer, item id, rolls, rarity and cost across rerolls and next intermissions. Rerolls refresh only unlocked slots. Buying/unlocking clears the relevant lock; run end clears the run.
- Rare premium offers require an eligible owned Epic/Legendary. The picker previews damage/interval/rarity/reach before committing, targets the existing weapon id, preserves other offers and locks, and charges only at commit. Epic promotion preserves existing rolls and changes base damage by the Legendary/Epic power ratio. Legendary overclocks add 10% base damage and shorten the base interval by 5%, max two ranks.
- Intermissions expose weapons, rolled modifiers, passives, upgrade ranks, granted signatures and retained cooldowns, and full base + inventory stat breakdowns. Tab/touch stats access remains available. XP and earned/spendable Signal are separate; spending never reduces XP or earned Signal.
- Existing fixed-step Canvas loop, integer coordinates, camera transforms, spatial hash, object pools, cached enemy sprites and synthesized audio remain. No WebGL/3D gameplay renderer was introduced. Original enemy HP/speed/contact damage/spawn-density formulas remain.

## Tuning defaults

Source: `src/game/data/tuning.js`.

| Setting | Default |
| --- | --- |
| XP per pickup | 0.65 × pickup Signal value (35% reduction) |
| XP level threshold | 45 + 18L + 2L² |
| Early leveling target | approximately 1 level per wave, not a guarantee |
| Fresh shop slots | 4 |
| Shop lock limit | 2 |
| Combined deployable/turret fresh-offer attempt chance | 2%; lower if no legal candidate exists |
| Premium fresh-offer chance | 1%, only with an eligible owned weapon |
| Premium reference price / multiplier | 36 / 3× = 108 Signal |
| Rare deployable base price | 80 before rarity/rank scaling |
| Purchased structure rank cap | 2, separate from weapon rarity |
| Legendary overclock cap | 2 |
| Reroll price | 4 + 2 × prior rerolls in this intermission |
| Dodge / Crit caps | 60% / 100% |

`balanceAudit.js` records observed per-wave kills, earned Signal, XP and levels at boundaries; the most recent 30 samples are retained. No completed human playtest rate measurements were available during implementation. Spawn-supply estimates assume every spawn is killed and every ordinary drop collected, excluding luck/bonus pickups: wave 1 old/new XP 73.50 / 47.77; wave 2 105.60 / 68.64; wave 3 138.00 / 89.70. These are estimates, not actual kill/collection rates.

## Actual bugs found and addressed

- One global local-save key could be synced into whichever account was currently logged in.
- Cloud failures silently disappeared, and in-flight changes could be skipped.
- No shop stock, locks, purchases or intermission checkpoint survived refresh.
- Positive Luck subtracted from the rarity roll and made Common items more likely.
- Replacing a weapon retained its modifier contributions indefinitely; Pierce/Knockback also lacked explicit zero baselines for rebuilding.
- The original shop forced two weapon slots (including frequent auto-turrets) and attempted a deployable in the fourth slot 45% of the time.
- The signature gate used spendable Signal and kill-count conditions rather than character selection.
- The stats toggle keyboard handler captured the initial closed state and could fail to close via keyboard.
- `Explosion on splice failure` and `Every 20th pickup rings Dispatch` had no active combat implementation. They no longer roll; legacy labels are not documented as working current effects.
- Generated cleaner weapons omitted the starter's healing hook.
- Auto-turret damage applied player Splice Quality twice; it now applies once through the shared hit path.
- Small percentage rolls, such as +0.3% Instakill, were displayed as +0%; displays now retain fractional percentages.

## Test evidence

- `npm run test:solo`: 21 passing, 0 failing deterministic automated checks.
- Coverage includes roster/alternate-kit legality, legacy migration, unique run completion, load sanitization, Veteran family caps, exact lock persistence through rerolls/next shops/serialized checkpoints, double-purchase prevention, XP/earned-Signal independence, removed weapon bonuses, premium targeting/cancellation/non-mutation/rank limits, granted signature hooks/helper count, server owner/restriction/rank checks, immutable character choice, percentage formatting, and positive Luck.
- A 20,000-slot synthetic fresh-offer audit with an eligible Epic measured 400 combined deployable/turret offers (2%) and 200 premium offers (1%). This is a deterministic sampling test, not a human gameplay measurement. Restricted-character samples produced no forbidden weapon offers.
- Profile-store tests use mocked cloud responses to check independent account caches/outboxes, lost-response idempotent retries, explicit conflicts and one-time legacy claiming. They are not real two-account browser tests.
- Live backend checks: load returned 200; initialized the current caller's empty v4 profile at revision 1; a conditional update advanced it to revision 2; replaying the same commit returned revision 2 unchanged; a stale revision returned an explicit conflict; a mismatched owner and invalid checkpoint phase were rejected with 400. The final load returned the stored revision 2 profile. No fake completed runs or other-user accounts were inserted.
- `npm run build`: exit 0. `npm run lint`: exit 0.
- Non-blocking warnings: old Browserslist metadata and Node's experimental custom-loader notice for the dependency-free tests. No extra npm package was installed.

## Deferred / not verified

- Backhoe of Doom, its telegraphed dig/trench/recovery AI, and optional additional bosses: NOT implemented.
- Playable co-op, independent multiplayer character selection/inventory/shops/locks, ready transitions, room chat, reconnect policy and room scaling: NOT implemented. The lobby clearly states this and disables create/join. No polling/localStorage/entity-update system was presented as multiplayer.
- Capability inspection confirmed Base44's authenticated stateful Actor WebSocket runtime. No external hosting account, paid service, OAuth permission or manual API credential is required for the planned built-in implementation. No actor was deployed in this milestone. Next step is an authenticated server-authoritative room actor (planned path `base44/actors/FibberCoop/entry.ts`), private UUID-based invitations, validated membership/actions, bounded snapshots/interpolation and disconnect handling, followed by two real browser sessions verifying the actual WebSocket handshake and state sync. The actor deployment generates its connection secret automatically; do not manually supply or rotate it for setup.
- Real browser sign-up/login/logout, real two-account RLS isolation, cross-device recovery, live intermission resume and rendered premium-picker interactions still need Testing Agent QA. Example goal: 'Use two independent accounts; migrate a legacy career, buy and lock two offers, reroll, refresh and Continue; confirm the other account cannot see or modify that profile and that completing the resumed run does not duplicate rewards.'
- Mobile/desktop visual QA and 500-enemy frame-time performance have NOT been benchmarked or verified. Preserving the renderer architecture is not a performance-test claim.

## Art provenance

No third-party sprite, texture, sound or boss-AI pack was imported. Added landing illustration and character portraits are original procedural Canvas/SVG cartoon art. Existing procedural enemy textures and synthesized audio are reused. No claim is made that an external art pack provides boss behavior.

## Files changed / created

### Persistence and validation
- base44/entities/SaveSync.jsonc
- base44/functions/playerProfile/entry.ts (new)
- base44/shared/profileValidation.ts (new)
- src/game/storage.js
- src/game/progression/profileModel.js (new)
- src/game/progression/runRules.js (new)
- src/game/progression/useProfile.jsx (new)
- src/game/progression/useSoloSession.jsx (new)

### Data, balance and combat
- src/game/data/characters.js
- src/game/data/combat.js
- src/game/data/generation.js
- src/game/data/stats.js
- src/game/data/unlocks.js
- src/game/data/tuning.js (new)
- src/game/data/reference.js (new)
- src/game/data/balanceAudit.js (new)
- src/game/combat/signatures.js (new)
- src/game/performance/drawHelper.js (new)
- src/game/signalEngine.js
- src/game/audio.js

### Routes, public pages and tokens
- src/App.jsx
- src/pages/Home.jsx
- src/pages/Player.jsx (new)
- src/pages/FieldGuide.jsx (new)
- src/pages/Settings.jsx (new)
- src/pages/Multiplayer.jsx (new; disabled honest lobby)
- src/index.css
- tailwind.config.js

### Game UI
- src/components/game/SignalSurvival.jsx
- src/components/game/MenuScreen.jsx
- src/components/game/CharacterSelect.jsx
- src/components/game/GalleryScreen.jsx
- src/components/game/GameArena.jsx
- src/components/game/GameHUD.jsx
- src/components/game/StatsScreen.jsx
- src/components/game/ShopScreen.jsx
- src/components/game/SiteNav.jsx (new)
- src/components/game/LandingArtwork.jsx (new)
- src/components/game/LoginRedirect.jsx (new)
- src/components/game/CharacterPortrait.jsx (new)
- src/components/game/CharacterCard.jsx (new)
- src/components/game/CareerChallenges.jsx (new)
- src/components/game/SaveStatus.jsx (new)
- src/components/game/ProgressMeters.jsx (new)
- src/components/game/ShopOffer.jsx (new)
- src/components/game/PurchasePicker.jsx (new)
- src/components/game/IntermissionInventory.jsx (new)
- src/components/game/IntermissionStats.jsx (new)
- src/components/game/IntermissionStatsControl.jsx (new)

### Verification
- package.json (dependency-free test script only)
- src/game/tests/alias-loader.mjs (new)
- src/game/tests/core.test.mjs (new)
- src/game/tests/profileStore.test.mjs (new)
- src/game/tests/milestone-report.md (this report)