// Server boundary, not a simulation or anti-cheat claim. Mirrors roster equip rules.
const ids=['rookie','nomad','veteran','oracle','frenzy','cleaner','bucket','don','admin','patty','deadline','clone','isr'];
const patterns={cleaver:'melee',splicer:'nova',otdr:'pierce',vfl:'beam',power:'projectile',stripper:'projectile',cleaner:'cone',cutters:'melee',tray:'turret',closure:'turret',cable:'turret',fanout:'turret',jumper:'chain',midspan:'pierce',blaster:'cone',deadzone:'beamSweep',switch:'chain',bell:'orbiting',rocket:'thrown',dowel:'projectile'};
const melee=w=>['melee','chain','nova','orbiting'].includes(w.pattern);
const rename=id=>['dispatch','dave','dispatch_dave'].includes(id)?'don':id;
export function validateProfile(data,userId,previous=null) {
  if(!data || typeof data!=='object' || Array.isArray(data) || JSON.stringify(data).length>700000) throw new Error('Invalid or oversized profile');
  const p=structuredClone(data);if(p.ownerId && p.ownerId!==userId) throw new Error('Profile owner mismatch');p.ownerId=userId;p.version=4;p.unlocked=ids;
  if(p.checkpoint){
    if(!['ready','shop','upgrade'].includes(p.checkpoint.phase))throw new Error('Unknown checkpoint boundary');
    const r=p.checkpoint.run,c=rename(r?.character?.id);if(!r || !ids.includes(c) || typeof r.runId!=='string' || r.runId.length>80 || !Number.isInteger(r.wave) || r.wave<1 || r.wave>10000 || !Number.isFinite(r.hp) || r.hp<=0) throw new Error('Invalid solo checkpoint');
    if(previous?.checkpoint?.run?.runId===r.runId && rename(previous.checkpoint.run.character?.id)!==c)throw new Error('Character cannot change midway through a run');
    r.character.id=c;if(c==='don')r.character.name='Dispatch Don';r.specialUnlocked=true;
    if(!Array.isArray(r.weapons) || r.weapons.length>(c==='veteran'?8:6) || new Set(r.weapons.map(w=>w.id)).size!==r.weapons.length) throw new Error('Tool slots or duplicate instance ids invalid');
    if(r.weapons.some(w=>!w || typeof w.id!=='string' || patterns[w.baseId]!==w.pattern || !Number.isFinite(w.damage) || w.damage<0 || !Number.isFinite(w.rate) || w.rate<=0 || (c==='frenzy'&&!melee(w)) || (c==='oracle'&&melee(w)))) throw new Error('Forbidden or malformed weapon');
    if(c==='veteran' && [true,false].some(k=>r.weapons.filter(w=>melee(w)===k).length>4)) throw new Error('Veteran requires max 4 tools per family');
    if((r.lockedIds || []).length>2 || new Set(r.lockedIds || []).size!==(r.lockedIds || []).length) throw new Error('At most two shop locks');
    if((r.lockedIds || []).some(id=>!r.shop?.offers?.some(i=>i?.id===id))) throw new Error('Locked offer missing');
    if(r.shop && (!Array.isArray(r.shop.offers) || r.shop.offers.length!==4))throw new Error('Shop requires exactly four slots');
    if(r.shop?.offers?.some(w=>w?.baseId && (patterns[w.baseId]!==w.pattern || (c==='frenzy'&&!melee(w)) || (c==='oracle'&&melee(w))))) throw new Error('Forbidden shop offer');
    if((r.deployables || []).some(d=>!Number.isInteger(d.stacks) || d.stacks<1 || d.stacks>2)) throw new Error('Deployable loot rank cap exceeded');
    for(const field of ['signal','xp','level','kills','earnedSignal']) if(!Number.isFinite(r[field]) || r[field]<0) throw new Error(`Invalid ${field}`);
  }
  return p;
}