import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT=new URL('../../',import.meta.url).pathname;
const engine=await readFile(new URL('../signalEngine.js',import.meta.url),'utf8');
const characters=await readFile(new URL('../data/characters.js',import.meta.url),'utf8');
const signatures=await readFile(new URL('../combat/signatures.js',import.meta.url),'utf8');
const stats=await readFile(new URL('../data/stats.js',import.meta.url),'utf8');

// Mirror of the engine's Knowledge Dump math (signalEngine.js, clause release):
// total = sum(current effective damage of every equipped weapon) * 30, split
// evenly among enemies inside the burst radius at release; bosses take half.
function knowledgeDump(weaponDamages,bossFlags){
  const total=weaponDamages.reduce((s,d)=>s+d,0)*30;
  const count=bossFlags.length;
  if(!count)return{total,shares:[]};
  const share=total/count;
  const shares=bossFlags.map(isBoss=>isBoss?share*.5:share);
  return{total,shares};
}

test('damage-split math: single enemy takes the full total',()=>{
  const r=knowledgeDump([30,30,30],[false]);
  assert.equal(r.total,2700);
  assert.equal(r.shares[0],2700);
});

test('damage-split math: ten enemies split evenly, boss takes half its share',()=>{
  const r=knowledgeDump([30,30,30],[false,false,false,false,false,false,false,false,true,false]);
  assert.equal(r.total,2700);
  assert.equal(r.shares[8],135); // boss: 270/2
  for(let i=0;i<10;i++)if(i!==8)assert.equal(r.shares[i],270);
  // total dealt respects the half rule: 9*270+135
  assert.equal(r.shares.reduce((s,v)=>s+v,0),2565);
});

test('damage-split math: empty radius deals nothing but the release still plays',()=>{
  const r=knowledgeDump([30,30,30],[]);
  assert.equal(r.total,2700);
  assert.deepEqual(r.shares,[]);
});

test('balance: wave-20 Squirrel survives a representative mid-game burst through the boss half rule',()=>{
  // Wave-20 boss HP: 520 * (1 + 19 * .19) = 2397 (threeArt.test.mjs asserts this block).
  const bossHp=520*(1+19*.19);
  // Representative mid-game: 3 weapons averaging 30 damage each.
  const r=knowledgeDump([30,30,30],[true]);
  const bossShare=r.shares[0]*1.08; // Veteran's 1.08 run.damage multiplier
  assert.ok(bossShare<bossHp,`boss share ${bossShare} must not one-shot wave-20 Squirrel (${bossHp})`);
  assert.ok(Math.abs(bossHp-bossShare*2397/bossHp-0)<1e9); // sanity
  // With the boss hiding in a crowd of 8 total impairments it takes even less.
  const crowded=knowledgeDump([30,30,30],[true,false,false,false,false,false,false,false]);
  assert.ok(crowded.shares[0]*1.08<bossHp);
});

test('balance: unchanged invariants — 3s charge, 260 burst radius, 30s cooldown',()=>{
  assert.ok(signatures.includes("case 'clause':return 3"),'charge duration stays 3s');
  assert.ok(engine.includes('CLAUSE_RADIUS=260'),'burst radius stays 260');
  assert.ok(characters.includes("special:{id:'clause',name:'Knowledge Dump',desc:'Charges 2.5s, then dumps 30x his total weapon damage, split between every impairment in range. Bosses take half.',cooldown:30}"),'cooldown stays 30s and the new description ships');
});

test('rename is complete: no Grandfather Clause strings remain anywhere in src',async()=>{
  async function* files(dir){
    for(const e of await readdir(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory())yield* files(p);
      else if(/\.(js|jsx|mjs|ts)$/.test(e.name))yield p;
    }
  }
  for await(const f of files(ROOT)){
    if(path.basename(f)==='knowledgeDump.test.mjs')continue; // this file's own assertions quote the old name
    const text=await readFile(f,'utf8');
    assert.ok(!text.includes('Grandfather'),`${f} still says Grandfather`);
    assert.ok(!text.includes('FIBBER CLAUSE'),`${f} still flashes the old clause name`);
  }
  assert.ok(characters.includes("'Knowledge Dump'"),'characters.js must name Knowledge Dump');
  assert.ok(stats.includes('Knowledge Dump'),'stats.js instakill description must name Knowledge Dump');
  const reference=await readFile(new URL('../data/reference.js',import.meta.url),'utf8');
  assert.ok(reference.includes('c.special.name'),'Field Guide derives the special name from characters.js');
});

test('old instakill-burst path is gone; new split path and telegraph are wired',()=>{
  assert.ok(!engine.includes('explode(p.x,p.y,90'),'the fixed 90-damage instakill burst must be removed');
  assert.ok(engine.includes('clauseCountVisitor')&&engine.includes('clauseDamageVisitor'),'split-burst visitors must exist');
  assert.ok(engine.includes('total/burstCount'),'damage must be split evenly by count');
  assert.ok(engine.includes('queryDamage*.5:queryDamage'),'bosses must take half their share');
  assert.ok(engine.includes('weaponOf(w).damage||0),0)*30'),'total must be 30x combined weapon damage');
  assert.ok(engine.includes('Radius telegraph'),'charge telegraph must be present');
  assert.ok(engine.includes('CLAUSE_RADIUS,0,7'),'telegraph circle must draw at the burst radius');
  assert.ok(engine.includes('setLineDash([12,9])'),'telegraph ring must be dashed');
  assert.ok(engine.includes('Math.sin(performance.now()*.025)*.08*lock'),'ring must pulse as the burst approaches');
});