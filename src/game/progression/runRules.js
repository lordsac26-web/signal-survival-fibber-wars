import { characterById } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';
import { applyMods, WEAPON_ARCHETYPES } from '@/game/data/generation';
import { TUNING } from '@/game/data/tuning';
export const weaponSlot = w => ['melee','chain','nova','orbiting'].includes(w.pattern) ? 'melee' : 'ranged';
export const allowedWeapon = (c, w) => c.restriction === 'any' || !c.restriction || weaponSlot(w) === c.restriction;
export function legalLoadout(c, weapons) {
  if (weapons.length > (c.slots || 6) || new Set(weapons.map(w => w.id)).size !== weapons.length) return false;
  if (weapons.some(w => !allowedWeapon(c, w))) return false;
  return !c.familyCap || ['melee','ranged'].every(k => weapons.filter(w => weaponSlot(w) === k).length <= c.familyCap);
}
export function normalizeWeapon(w, index = 0) {
  const obj = typeof w === 'string' ? {...WEAPONS[w],baseId:w} : {...w};
  return {...obj,id:obj.id || `legacy-tool-${index}-${obj.baseId}`,slotType:weaponSlot(obj),rarity:obj.rarity || 'Common',mods:obj.mods || [],overclockRank:Math.min(TUNING.overclockRankCap,obj.overclockRank || 0)};
}
export function rebuildStats(run) {
  let next = {...run,...run.character.stats,cleaningKillsHeal:0,bonusSignal:0,hitSpeedBoost:0,critKnockback:0,turretQuality:0,firstHitBlocked:0,spliceExplosion:0};
  for (const item of [...run.weapons,...run.items]) next = applyMods(next,item);
  next.hp = Math.min(next.maxHp,Math.max(0,run.hp));
  next.dodge = Math.min(TUNING.dodgeCap,Math.max(0,next.dodge));
  next.crit = Math.min(TUNING.critCap,Math.max(0,next.crit));
  return next;
}
export function normalizeRun(raw) {
  if (!raw) return null;
  const c = characterById(raw.character?.id || raw.characterId);
  if (!c || !raw.runId || raw.hp <= 0 || !Number.isInteger(raw.wave) || raw.wave < 1) return null;
  const weapons = [];
  for (const value of raw.weapons || []) {const w=normalizeWeapon(value,weapons.length);if(WEAPON_ARCHETYPES.some(a=>a[0]===w.baseId && a[2]===w.pattern) && allowedWeapon(c,w) && legalLoadout(c,[...weapons,w])) weapons.push(w)}
  if (!weapons.length) weapons.push(...c.start.map((id,i)=>normalizeWeapon({...WEAPONS[id],baseId:id,id:`${raw.runId}-starter-${i}`})));
  const items = (raw.items || []).filter(i=>!i.baseId && !i.deploy && !i.premium);
  const next = {...raw,signal:raw.signal || 0,xp:raw.xp || 0,level:raw.level || 0,kills:raw.kills || 0,earnedSignal:raw.earnedSignal ?? raw.signal ?? 0,character:c,weapons,items,specialUnlocked:true,deployables:(raw.deployables || []).filter(d=>d.structure!==c.signatureStructure).map(d=>({...d,stacks:Math.min(TUNING.deployRankCap,d.stacks || 1)})),lockedIds:(raw.lockedIds || []).slice(0,TUNING.maxLocks)};
  if(next.shop) next.shop={...next.shop,offers:(next.shop.offers || []).map(i=>!i || !i.baseId || allowedWeapon(c,i) ? i : null)};
  next.lockedIds=next.lockedIds.filter(id=>next.shop?.offers?.some(i=>i?.id===id));
  return rebuildStats(next);
}
export function createRun(c, useAlt, seed, id) {
  const runId = id || crypto.randomUUID();
  const ids = useAlt && c.altStart ? c.altStart : c.start;
  return normalizeRun({runId,checkpointId:`${runId}:start`,character:c,wave:1,level:0,hp:c.stats.maxHp,signal:0,earnedSignal:0,kills:0,xp:0,pendingLevels:0,buys:0,seed,weapons:ids.map((baseId,i)=>({...WEAPONS[baseId],baseId,id:`${runId}-start-${i}`})),items:[],deployables:[],lockedIds:[],specialCooldown:0});
}