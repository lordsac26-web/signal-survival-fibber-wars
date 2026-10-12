// Real engine status composition; recording canvas is NOT browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {startEncounter,pump} from './engineHarness.mjs';
test('ISR expiry restores the independently timed Slack Coil Snare slow, not baseline and not a compounded slow',async()=>{
 const random=Math.random;Math.random=()=>.15;
 const h=await startEncounter({width:375,height:667,charId:'isr',configure:r=>{r.weapons=[];r.regen=0;r.crit=0;r.dodge=1;r.deployables=[{structure:'snare',name:'Independent snare',stacks:1}]}});
 try{
  pump(5);h.input.current.deploy=true;h.input.current.special=true;pump(1/60);
  const start=h.state.time;assert.equal(h.state.specialTimer,8);assert(h.state.enemies.every(e=>e.motion.slow===.25));
  h.until(()=>h.state.specialTimer===0,9);assert(Math.abs(h.state.time-start-8)<1e-7);
  assert(h.state.enemies.some(e=>Math.abs(e.motion.slow-.55)<1e-7),'snare is still active after ISR expiry');
  h.until(()=>h.state.enemies.every(e=>e.motion.slow===1),5);assert(h.state.time>=start+12-1e-7,'independent status expires on its own schedule');
 }finally{h.cleanup();Math.random=random}
});