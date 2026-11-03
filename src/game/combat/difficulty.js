// One source for bodies, contact, projectiles, clones and bosses; never stack twice.
export const DIFFICULTY=Object.freeze({baseHp:2.5,hpLinear:.18,hpQuadratic:.006,damageLinear:.12,speedLinear:.004,speedCap:1.25,eliteHp:1.35,eliteDamage:1.15,signalReduction:.25,signalHorizon:25});
export const enemyHpMultiplier=(wave,elite=false)=>{const n=Math.max(0,wave-1);return DIFFICULTY.baseHp*(1+DIFFICULTY.hpLinear*n+DIFFICULTY.hpQuadratic*n*n)*(elite?DIFFICULTY.eliteHp:1)};
export const enemyDamageMultiplier=(wave,elite=false)=>(1+DIFFICULTY.damageLinear*Math.max(0,wave-1))*(elite?DIFFICULTY.eliteDamage:1);
export const enemySpeedMultiplier=wave=>Math.min(DIFFICULTY.speedCap,1+DIFFICULTY.speedLinear*Math.max(0,wave-1));
export const signalMultiplier=wave=>1-DIFFICULTY.signalReduction*Math.min(1,Math.max(0,wave-1)/DIFFICULTY.signalHorizon);
export function scaledEnemy(base,wave,elite=!!base.elite){const hp=base.hp*enemyHpMultiplier(wave,elite);return {hp,max:hp,speed:base.speed*enemySpeedMultiplier(wave),damage:base.damage*enemyDamageMultiplier(wave,elite),value:+(base.value*signalMultiplier(wave)).toFixed(4)}}