// ISR-only temporary impairment. No enemy speed mutation, spawn or damage changes.
export const OUTAGE=Object.freeze({duration:8,cooldown:25,movement:.25,heal:5});
export const outageActive=(remaining,hp)=>remaining>1e-8&&hp>0;
export const outageMovement=(remaining,hp,independent=1)=>outageActive(remaining,hp)?Math.min(independent,OUTAGE.movement):independent;
// Called once from the owning engine's guarded enemy-death path, never on hits.
// Explicit ownership prevents a future shared-room caller crediting another player.
export function outageKillHeal(player,remaining,owned){
 if(!owned||!outageActive(remaining,player.hp))return 0;
 const amount=Math.max(0,Math.min(OUTAGE.heal,player.maxHp-player.hp));
 player.hp+=amount;
 return amount;
}