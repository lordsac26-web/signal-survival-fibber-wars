import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OUTAGE,outageActive,outageMovement,outageKillHeal} from '@/game/combat/outage';
import {CHARACTERS,characterById} from '@/game/data/characters';
import {createRun,normalizeRun} from '@/game/progression/runRules';
import {unlockMet} from '@/game/data/unlocks';
import {guideEntries} from '@/game/data/reference';
const c=characterById('isr');
test('ISR reused once, original stats/kits/career gate and saves retained; ability granted on selection',()=>{
 assert.equal(CHARACTERS.filter(c=>c.id==='isr').length,1);assert.equal(CHARACTERS.length,13);
 assert.deepEqual([c.stats.maxHp,c.stats.speed,c.stats.damage,c.start,c.altStart,c.restriction],[105,210,.8,['power'],['otdr'],'any']);
 assert(unlockMet({squirrelDefeated:true},c));assert(!unlockMet({squirrelDefeated:false},c));
 let r=createRun(c,false,'isr','existing-isr-save');assert(r.specialUnlocked);assert.equal(r.specialCooldown,0);
 let n=normalizeRun({...r,character:{id:'isr'},specialCooldown:30,kills:123});assert.equal(n.runId,r.runId);assert.equal(n.kills,123);assert.equal(n.specialCooldown,25);assert.equal(n.character.special.name,'Outage Declaration');
 assert(guideEntries().Characters.find(x=>x.id==='isr').body.includes('75%'));assert(c.special.desc.includes('bosses'));
});
test('outage: exactly 8s, cooldown25 from activation, strongest slow with restoration and no destructive speed mutation',()=>{
 assert.deepEqual(OUTAGE,{duration:8,cooldown:25,movement:.25,heal:5});
 for(const independent of [1,.65,.3,.1,0]){assert.equal(outageMovement(8,50,independent),Math.min(.25,independent));assert.equal(outageMovement(0,50,independent),independent);assert.equal(outageMovement(8,0,independent),independent)}
 assert(outageActive(1/60,1));assert(!outageActive(0,1));assert(!outageActive(1,0));
});
test('outage kill healing: owned credited deaths only, +5 current HP, exact cap, no revive or out-of-window grant',()=>{
 const p={hp:50,maxHp:100};assert.equal(outageKillHeal(p,8,false),0);assert.equal(outageKillHeal(p,0,true),0);assert.equal(p.hp,50);
 assert.equal(outageKillHeal(p,8,true),5);assert.equal(p.hp,55);p.hp=98;assert.equal(outageKillHeal(p,1,true),2);assert.equal(p.hp,100);assert.equal(p.maxHp,100);assert.equal(outageKillHeal(p,1,true),0);
 p.hp=0;assert.equal(outageKillHeal(p,8,true),0);assert.equal(p.hp,0);
});
test('input/timer HUD and guarded owner-only kill hook; no spawn/attack/damage penalties or multiplayer credit path',()=>{
 const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');assert(engine.includes('function kill(e){if(!e.active)return;'));assert(engine.includes('outageKillHeal(p,specialTimer,true)'));
 assert(!engine.includes('outage?2.2'));assert(!engine.includes('powerMult'));assert(engine.includes('spawnDoubleChance(run.wave))'));assert(engine.includes('if(charId===\'isr\')slowMul=outageMovement(specialTimer,p.hp,slowMul)'));
 const arena=readFileSync(new URL('../../components/game/GameArena.jsx',import.meta.url),'utf8');assert(arena.includes("if (k === 'e') input.current.special = true"));
 const button=readFileSync(new URL('../../components/game/SpecialButton.jsx',import.meta.url),'utf8');assert(button.includes('onPointerDown'));assert(button.includes('if(ready)input.current.special=true'));assert(button.includes('hud.specialRemaining'));assert(button.includes('disabled={!ready}'));
 assert(readFileSync(new URL('../../pages/Multiplayer.jsx',import.meta.url),'utf8').includes('Nothing here connects players yet'));
});