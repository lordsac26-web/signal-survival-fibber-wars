import { STAT_MOD_POOL } from '@/game/data/generation';
export function passivePoolFor(characterId){
  const preferred={oracle:['range','crit'],admin:['dodge','speed'],nomad:['speed','luck'],don:['maxHp','engineering']}[characterId] || ['damage','maxHp'];
  return STAT_MOD_POOL.concat(STAT_MOD_POOL.filter(mod=>preferred.includes(mod[0])));
}