// Retired ids survive only in migration and historical career records.
export const RETIRED_CHARACTER_IDS=Object.freeze(['rookie','frenzy','cleaner','bucket','patty','deadline']);
export const DEFAULT_CHARACTER_ID='nomad';
const logged=new Set();
export function migrateCharacterId(id){
  if(['dispatch','dave','dispatch_dave'].includes(id))return 'don';
  if(!RETIRED_CHARACTER_IDS.includes(id))return id;
  if(!logged.has(id)){console.info(`[roster migration] ${id} -> ${DEFAULT_CHARACTER_ID}; career history and inventory retained`);logged.add(id)}
  return DEFAULT_CHARACTER_ID;
}