import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTERS,characterById} from '@/game/data/characters';
import {freshProfile,migrateProfile} from '@/game/progression/profileModel';
import {createRun,normalizeRun} from '@/game/progression/runRules';
import {RETIRED_CHARACTER_IDS,DEFAULT_CHARACTER_ID} from '@/game/progression/rosterMigration';
import {guideEntries} from '@/game/data/reference';
import {validateProfile} from 'profileValidation';
import {activateSignature} from '@/game/combat/signatures';
import {decodePng} from './pngDecode.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('exact remaining roster and guide; live cards have portraits; selection enforces both career gates',()=>{
  const ids=['nomad','veteran','oracle','don','admin','engineer','clone','isr'];assert.deepEqual(CHARACTERS.map(c=>c.id),ids);assert.deepEqual(guideEntries().Characters.map(c=>c.id),ids);
  const portraits=read('components/game/CharacterPortrait.jsx');for(const id of ids)assert(portraits.includes(`c.id==='${id}'`));
  const select=read('components/game/CharacterSelect.jsx');assert(select.includes('CHARACTERS.map'));assert(select.includes('unlockMet(save,c)'));assert.equal(freshProfile().unlocked.length,6);
  for(const id of RETIRED_CHARACTER_IDS){assert.equal(characterById(id),undefined);assert(!portraits.includes(`c.id==='${id}'`))}
  for(const id of ['callback','deepclean','fortify','barrier','deadline','frenzy'])assert.equal(activateSignature({character:{special:{id}}},{},{}),null);
});
test('all six selected ids and checkpoints remap without losing career, inventory, locked offers or original history',()=>{
  for(const id of RETIRED_CHARACTER_IDS){
    const run=createRun(characterById('nomad'),false,12,'legacy-'+id);run.character={id};run.wave=9;run.signal=420;run.xp=17;run.specialCooldown=99;run.items=[{id:'earned',mods:[]}];run.weapons=Array.from({length:6},(_,i)=>({...run.weapons[0],id:'owned-'+i}));run.deployables=[{structure:'turretMount',stacks:1}];run.shop={offers:[{id:'locked',cost:123},null,null,null]};run.lockedIds=['locked'];
    const raw={version:4,runs:23,totalKills:4567,selectedCharacter:id,highWaveByCharacter:{[id]:14},summaries:[{characterId:id,runId:'past'}],loadouts:[`${id}:alt`],checkpoint:{phase:'shop',run}};
    const before=JSON.stringify(raw),p=migrateProfile(raw),n=p.checkpoint.run;
    assert.equal(JSON.stringify(raw),before);assert.equal(p.selectedCharacter,DEFAULT_CHARACTER_ID);assert.equal(p.runs,23);assert.equal(p.totalKills,4567);assert.equal(p.highWaveByCharacter[id],14);assert.equal(p.summaries[0].characterId,id);assert(p.loadouts.includes(`${id}:alt`));assert(!p.unlocked.includes(id));
    assert.equal(n.character.id,'nomad');assert.equal(n.runId,run.runId);assert.equal(n.wave,9);assert.equal(n.signal,420);assert.equal(n.xp,17);assert.equal(n.weapons.length,6);assert.deepEqual(n.items.map(({id,mods})=>({id,mods})),run.items);assert.equal(n.items[0].rarity,'common');assert.deepEqual(n.lockedIds,['locked']);assert.equal(n.shop.offers[0].cost,123);assert.equal(n.deployables[0].structure,'turretMount');assert.equal(n.specialCooldown,0);
    assert.doesNotThrow(()=>validateProfile(p,'owner',raw));assert.equal(normalizeRun(n).character.id,'nomad');
  }
});
test('Admin select portrait is exactly padded idle frame zero; percent-first copy, cap and ability survive',()=>{
  const idle=decodePng(readFileSync(new URL('../../../public/assets/admin/idle-front.png',import.meta.url))),portrait=decodePng(readFileSync(new URL('../../../public/assets/admin/portrait.png',import.meta.url)));
  for(let y=0;y<118;y++)for(let x=0;x<76;x++)assert.deepEqual(portrait.rgba.subarray(((y+10)*76+x)*4,((y+10)*76+x)*4+4),idle.rgba.subarray((y*608+x)*4,(y*608+x)*4+4));
  const c=characterById('admin');assert(c.passive.includes('30% Dodge (capped at 50% total), 75% damage dealt, 4 slots, mixed tools'));assert.equal(c.stats.damage,.75);assert.equal(c.slots,4);assert(c.special.desc.includes('20s cooldown'));assert(c.special.desc.includes('The meeting could have been an email.'));assert(read('components/game/CharacterCard.jsx').includes('<details'));
});