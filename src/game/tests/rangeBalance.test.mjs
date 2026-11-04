import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS, characterById } from '@/game/data/characters';
import { createRun } from '@/game/progression/runRules';
import { effectiveRange, updateVisibleViewport } from '@/game/combat/effectiveRange';
import { BASE_RANGE_RATINGS, RANGE_PROFILES, RANGE_MULTIPLIER, rangeProfile, SIGNATURE_RANGE_WEAPONS } from '@/game/combat/rangeConfig';
import { CAMP_ATTACK } from '@/game/combat/antiCamp';

// RANGE BALANCE PIN: one shared flat multiplier on the FINAL effective reach.
// These tests pin (1) the constant, (2) that it applies to every profile's
// final reach exactly (after = capped reach × multiplier, independently
// recomputed), (3) the guard that no default attack from arena center reaches
// the far side of the map, (4) that reach still derives from the visible
// logical short side with identical intent on mobile, and (5) that the
// elite standoff distance is not trivially inside every weapon's reach.

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const view=(w,h,z=1)=>updateVisibleViewport({},w,h,z);
// Full-map viewport: 1100×800 world visible at zoom 1 — the largest reach the
// engine can produce. Arena center (550,400); far side of the map along the
// shorter axis is 400 units away (= short/2 when the whole map is visible).
const fullMap=()=>view(1100,800,1);
// Independent recomputation of the capped pre-multiplier reach, so the pin
// reads "after === before formula × RANGE_MULTIPLIER" without re-calling the
// code under test with doctored inputs.
function cappedReach(weapon,run,viewport){
  const key=rangeProfile(weapon),profile=RANGE_PROFILES[key] || RANGE_PROFILES.ranged;
  const short=Math.min(viewport.width,viewport.height);
  const rating=BASE_RANGE_RATINGS[weapon.baseId] || weapon.range || profile.reference;
  const familyScale=clamp(Math.sqrt(rating/profile.reference),.7,1.1);
  const quality=Math.sqrt(Math.max(.01,(weapon.range || rating)/rating));
  const cap=(key==='ranged' || key==='turret') && run.character?.id==='oracle' ? .44 : profile.cap;
  return clamp(short*profile.base*familyScale*quality*Math.max(0,run.range ?? 1)+(run.rangeFlat || 0)+(weapon.rangeFlat || 0),0,short*cap);
}
const defaultKits=()=>CHARACTERS.flatMap(c=>[false,true].map(alt=>({character:c,alt,run:createRun(c,alt,1,`rb-${c.id}-${alt}`)})));

test('RANGE_MULTIPLIER is pinned at 1.20 and multiplies the final reach of every profile exactly once',()=>{
  assert.equal(RANGE_MULTIPLIER,1.2);
  const samples=defaultKits().flatMap(({character,run})=>run.weapons.map(w=>({character,tool:w.baseId,run,weapon:w})));
  for(const viewport of [fullMap(),view(390,700),view(1280,720,1280/1100),view(700,390)])
    for(const {run,weapon} of samples)
      assert.equal(effectiveRange(weapon,run,viewport),cappedReach(weapon,run,viewport)*RANGE_MULTIPLIER,
        `${run.character.id} ${weapon.baseId} reach is not capped-reach × ${RANGE_MULTIPLIER}`);
  // the multiplier lives in exactly one runtime place — no second application anywhere else
  const er=readFileSync(new URL('../combat/effectiveRange.js',import.meta.url),'utf8');
  assert.equal((er.match(/\*RANGE_MULTIPLIER/g)||[]).length,1);
  const engine=readFileSync(new URL('../signalEngine.js',import.meta.url),'utf8');
  assert(!engine.includes('RANGE_MULTIPLIER'),'the engine must not re-multiply range; effectiveRange owns the single shared multiplier');
});

test('center-to-far-wall guard: no default attack from arena center reaches the far side of the map, before or after the multiplier',()=>{
  const viewport=fullMap(),centerToShortWall=Math.min(viewport.width,viewport.height)/2;
  const rows=[];
  for(const {character,run} of defaultKits())
    for(const w of run.weapons){
      const after=effectiveRange(w,run,viewport);
      assert(after<=centerToShortWall,`default ${character.id} ${w.baseId} reach ${after.toFixed(1)} exceeds the ${centerToShortWall}-unit center-to-wall distance`);
      rows.push({kit:character.id,tool:w.baseId,before:+(after/RANGE_MULTIPLIER).toFixed(1),after:+after.toFixed(1)});
    }
  // granted signature reach weapons obey the same guard (Full Trace keeps its named exception)
  for(const id of ['clause','crew']){
    const owner=id==='clause'?'veteran':'don',run=createRun(characterById(owner),false,1,`rb-sig-${id}`);
    const after=effectiveRange(SIGNATURE_RANGE_WEAPONS[id],run,viewport);
    assert(after<=centerToShortWall,`signature ${id} reach ${after.toFixed(1)} exceeds the ${centerToShortWall}-unit center-to-wall distance`);
    rows.push({kit:`signature:${id}`,tool:id,before:+(after/RANGE_MULTIPLIER).toFixed(1),after:+after.toFixed(1)});
  }
  const worst=rows.reduce((a,b)=>b.after>a.after?b:a);
  console.log('RANGE_CENTER_GUARD',JSON.stringify({viewport:'1100x800 (full map visible)',centerToShortWall,worstDefaultAttack:worst,perKit:rows}));
  assert(worst.after<centerToShortWall);
});

test('reach still scales from the visible logical short side — identical intent on mobile, DPR never enters',()=>{
  const run=createRun(characterById('nomad'),false,1,'rb-viewport'),weapon=run.weapons[0];
  const full=fullMap(),mobile=view(390,700),rotated=view(700,390);
  const rFull=effectiveRange(weapon,run,full),rMobile=effectiveRange(weapon,run,mobile);
  assert.equal(rMobile,effectiveRange(weapon,run,rotated)); // orientation independence
  assert(Math.abs(rFull/Math.min(full.width,full.height)-rMobile/Math.min(mobile.width,mobile.height))<1e-9); // strictly proportional to the visible short side
  assert(rFull>rMobile); // a zoomed-in mobile viewport sees proportionally less world reach
});

test('elite standoff is not trivially inside every weapon reach; margins logged',()=>{
  const viewport=fullMap(),standoff=CAMP_ATTACK.kiteDistance;
  const reaches=[];
  for(const {character,run} of defaultKits())
    for(const w of run.weapons)
      reaches.push({kit:character.id,tool:w.baseId,reach:+effectiveRange(w,run,viewport).toFixed(1),margin:+(effectiveRange(w,run,viewport)-standoff).toFixed(1)});
  const closest=reaches.reduce((a,b)=>Math.abs(b.margin)<Math.abs(a.margin)?b:a);
  console.log('RANGE_STANDOFF',JSON.stringify({standoff,closest,all:reaches}));
  // some default archetype (melee) still cannot touch a standoff elite
  assert(reaches.some(r=>r.reach<standoff),'every default weapon reaching the standoff would make standoff positioning meaningless');
});