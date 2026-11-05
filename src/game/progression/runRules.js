import { characterById } from '@/game/data/characters';
import { migrateCharacterId } from '@/game/progression/rosterMigration';
import { WEAPONS } from '@/game/data/combat';
import { applyMods, WEAPON_ARCHETYPES } from '@/game/data/generation';
import { TUNING } from '@/game/data/tuning';
import { normalizeItem } from '@/game/items/itemScaling';
import { ARENA_THEMES, pickArenaTheme } from '@/game/art/arenaFloor';
export const weaponSlot = w => ['melee','chain','nova','orbiting'].includes(w.pattern) ? 'melee' : 'ranged';
export const allowedWeapon = (c, w) => c.restriction === 'any' || !c.restriction || weaponSlot(w) === c.restriction;
export function legalLoadout(c, weapons) {
  if (weapons.length > (c.slots || 6) || new Set(weapons.map(w => w.id)).size !== weapons.length) return false;
  if (weapons.some(w => !allowedWeapon(c, w))) return false;
  return !c.familyCap || ['melee','ranged'].every(k => weapons.filter(w => weaponSlot(w) === k).length <= c.familyCap);
}
// Field Engineer: exactly 4 item slots shared across tools, passives and
// deployables (a module rides on its weapon).
export const itemBudgetUsed = run => (run.weapons || []).length + (run.items || []).length + (run.deployables || []).length;
export const itemBudgetCap = run => run.character?.id === 'engineer' ? 4 : Infinity;
// FIELD ENGINEER LOADOUT CAPS (owner rule): 4 total item slots with
// per-category caps inside them — at most 1 RANGED weapon, 2 MELEE weapons,
// and 4 DEPLOYABLE items (turret tools + structure deployables count as one
// category); passives count against the total only. Legal builds include
// 4 deployables, 1 ranged + 3 deployables, 2 melee + 2 deployables, or
// 1 ranged + 2 melee + 1 deployable.
export const ENGINEER_CAPS = Object.freeze({ total: 4, ranged: 1, melee: 2, deployable: 4 });
export const engineerCategory = item => !item ? null
  : item.deploy || item.pattern === 'turret' ? 'deployable'
  : item.baseId ? (['melee', 'chain', 'nova', 'orbiting'].includes(item.pattern) ? 'melee' : 'ranged')
  : 'passive';
export function engineerCounts(inventory) {
  const c = { ranged: 0, melee: 0, deployable: 0, passive: 0, total: 0 };
  for (const i of inventory || []) { const k = engineerCategory(i); if (k) { c[k]++; c.total++; } }
  return c;
}
// First violated cap as a clear reason, exactly like the shop displays it.
export function engineerCapReason(inventory) {
  const c = engineerCounts(inventory);
  if (c.ranged > ENGINEER_CAPS.ranged) return `Ranged cap: ${ENGINEER_CAPS.ranged} of ${ENGINEER_CAPS.ranged} — replace or combine first`;
  if (c.melee > ENGINEER_CAPS.melee) return `Melee cap: ${ENGINEER_CAPS.melee} of ${ENGINEER_CAPS.melee} — replace or combine first`;
  if (c.deployable > ENGINEER_CAPS.deployable) return `Deployable cap: ${ENGINEER_CAPS.deployable} of ${ENGINEER_CAPS.deployable} — replace or combine first`;
  if (c.total > ENGINEER_CAPS.total) return `Slot cap: ${ENGINEER_CAPS.total} of ${ENGINEER_CAPS.total} — sell or combine first`;
  return '';
}
// Does a plain (no-replacement) weapon add hit an engineer cap? The shop uses
// this to route the purchase through the replacement picker instead of a
// guaranteed refusal.
export function engineerWeaponCapBlocked(run, item) {
  if (run?.character?.id !== 'engineer' || !item?.baseId) return false;
  const counts = engineerCounts([...(run.weapons || []), ...(run.items || []), ...(run.deployables || [])]);
  const cat = engineerCategory(item), cap = cat === 'deployable' ? 4 : cat === 'melee' ? 2 : 1;
  return counts[cat] >= cap || counts.total >= ENGINEER_CAPS.total;
}
export function normalizeWeapon(w, index = 0, rankCap = TUNING.overclockRankCap) {
  const obj = typeof w === 'string' ? {...WEAPONS[w],baseId:w} : {...w};
  return normalizeItem({...obj,id:obj.id || `legacy-tool-${index}-${obj.baseId}`,slotType:weaponSlot(obj),rarity:obj.rarity || 'common',mods:obj.mods || [],overclockRank:Math.min(rankCap,obj.overclockRank || 0)});
}
export function rebuildStats(run) {
  let next = {...run,...run.character.stats,cleaningKillsHeal:0,bonusSignal:0,hitSpeedBoost:0,critKnockback:0,turretQuality:0,firstHitBlocked:0,spliceExplosion:0};
  for (const item of [...run.weapons,...run.items]) next = applyMods(next,item);
  // statMods: upgrades applied outside the inventory (the Field Engineer's
  // full-budget level-ups) — folded in on every rebuild like held items.
  for (const item of run.statMods || []) next = applyMods(next,item);
  next.hp = Math.min(next.maxHp,Math.max(0,run.hp));
  next.dodge = Math.min(TUNING.dodgeCap,Math.max(0,next.dodge));
  next.crit = Math.min(TUNING.critCap,Math.max(0,next.crit));
  return next;
}
export function normalizeRun(raw) {
  if (!raw) return null;
  const previousId=raw.character?.id || raw.characterId;
  const migratedId=migrateCharacterId(previousId);
  const c = characterById(migratedId);
  if (!c || !raw.runId || raw.hp <= 0 || !Number.isInteger(raw.wave) || raw.wave < 1) return null;
  const rankCap = c.id === 'clone' ? TUNING.cloneOverclockCap : TUNING.overclockRankCap;
  const weapons = [];
  for (const value of raw.weapons || []) {const w=normalizeWeapon(value,weapons.length,rankCap);if(WEAPON_ARCHETYPES.some(a=>a[0]===w.baseId && a[2]===w.pattern) && allowedWeapon(c,w) && legalLoadout(c,[...weapons,w])) weapons.push(w)}
  if (!weapons.length) weapons.push(...c.start.map((id,i)=>normalizeWeapon({...WEAPONS[id],baseId:id,id:`${raw.runId}-starter-${i}`},i,rankCap)));
  const items = (raw.items || []).filter(i=>!i.baseId && !i.deploy && !i.premium).map((i,index)=>normalizeItem({...i,id:i.id || `${raw.runId}:legacy-passive:${index}`}));
  const rawTheme = raw.arenaTheme === 'night-worksite' ? 'nightWorksite' : raw.arenaTheme;
  const arenaTheme = ARENA_THEMES.some(t => t.id === rawTheme) ? rawTheme : pickArenaTheme(raw.seed, raw.wave || 1);
  const next = {...raw,arenaTheme,signal:raw.signal || 0,xp:raw.xp || 0,level:raw.level || 0,kills:raw.kills || 0,earnedSignal:raw.earnedSignal ?? raw.signal ?? 0,character:c,weapons,items,specialUnlocked:true,deployables:(raw.deployables || []).filter(d=>d.structure!==c.signatureStructure).map((d,index)=>normalizeItem({...d,deploy:true,id:d.id || `${raw.runId}:legacy-deploy:${index}`,stacks:Math.min(TUNING.deployRankCap,d.stacks || 1)})),lockedIds:(raw.lockedIds || []).slice(0,TUNING.maxLocks)};
  if(migratedId!==previousId && c.id!=='don')Object.assign(next,{specialCooldown:0,specialProgress:0,useAlt:false});
  if(c.id==='isr')next.specialCooldown=Math.min(c.special.cooldown,Math.max(0,raw.specialCooldown||0));
  if(next.shop) next.shop={...next.shop,offers:(next.shop.offers || []).map(i=>!i?null:i.baseId&&!allowedWeapon(c,i)?null:normalizeItem(i))};
  next.lockedIds=next.lockedIds.filter(id=>next.shop?.offers?.some(i=>i?.id===id));
  return rebuildStats(next);
}
export function advanceRunWave(run) {
  const wave = (run.wave || 1) + 1;
  return {...run,wave,arenaTheme:pickArenaTheme(run.seed,wave,run.arenaTheme)};
}
export function createRun(c, useAlt, seed, id) {
  const runId = id || crypto.randomUUID();
  const ids = useAlt && c.altStart ? c.altStart : c.start;
  return normalizeRun({runId,checkpointId:`${runId}:start`,character:c,wave:1,level:0,hp:c.stats.maxHp,signal:0,earnedSignal:0,kills:0,xp:0,pendingLevels:0,buys:0,seed,arenaTheme:pickArenaTheme(seed,1),weapons:ids.map((baseId,i)=>({...WEAPONS[baseId],baseId,id:`${runId}-start-${i}`})),items:[],deployables:[],lockedIds:[],specialCooldown:0});
}