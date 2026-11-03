import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, TIER_IDS, tierId, tierPrice, canCombine, combineStatus, itemIdentity } from '@/game/items/tiers';
import { normalizeItem, scaleItem, deployStats } from '@/game/items/itemScaling';
import { combinePair, combineInto } from '@/game/items/combining';
import { createGenerator, WEAPON_ARCHETYPES } from '@/game/data/generation';
import { createRun, normalizeRun } from '@/game/progression/runRules';
import { characterById } from '@/game/data/characters';
import { priceOffer } from '@/game/shop/itemPricing';
import { TUNING } from '@/game/data/tuning';
import { validateProfile } from 'profileValidation';
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
const weapon=tier=>createGenerator(88).weapon(0,[WEAPON_ARCHETYPES[0]],tier);
const passive=tier=>createGenerator(88).passive(0,undefined,tier,'Slack Coils');
const deploy=tier=>scaleItem({id:'dep',deploy:true,deployId:'bucket_keys',structure:'turretMount',name:'Bucket Truck Keys',baseStats:{mods:[]}},tier);
for(const [name,make] of [['weapon',weapon],['passive',passive],['deployable',deploy]]){
  test(`${name}: every ladder step, no cross-tier merge, terminal Overclocked`,()=>{
    for(let index=0;index<TIER_IDS.length-1;index++){
      const tier=TIER_IDS[index],a={...make(tier),id:'a'},b={...make(tier),id:'b'};
      const before=JSON.stringify([a,b]),result=combinePair(a,b);
      assert.equal(result.item.rarity,TIER_IDS[index+1]);assert.equal(JSON.stringify([a,b]),before);
      assert(!canCombine(a,make(TIER_IDS[index+1])));
      assert.match(result.notice.title,new RegExp(TIERS[TIER_IDS[index+1]].label));
    }
    const top=make('overclocked');assert(!canCombine(top,top));assert.throws(()=>combinePair(top,top),/same identity and tier/);
    assert.equal(combineStatus({},top),'Max tier');assert.equal(combineInto([top],{...top,id:'top-2'}).items.length,2);
  });
}
test('exact identity boundaries and no premium combining',()=>{
  const a=weapon('common');assert(!canCombine(a,{...a,baseId:'otdr'}));
  assert(!canCombine(passive('common'),{...passive('common'),name:'Dust Caps'}));
  assert(!canCombine(deploy('common'),{...deploy('common'),deployId:'cone_kit',structure:'barricade'}));
  assert(!canCombine(a,{...a,premium:true}));assert.equal(itemIdentity({...a,premium:true}),null);
  assert.equal(itemIdentity({...deploy('common'),deployId:undefined,id:'legacy-instance'}),'deployable:bucket_keys');
});
test('tier-scaled base stats, inverse intervals, effect magnitudes, prices and no repeated scaling',()=>{
  for(const [tier,{power,price}] of Object.entries(TIERS)){
    const w=weapon(tier),p=passive(tier),d=deployStats(deploy(tier));
    close(w.damage,24*power);close(w.rate,.7/power);close(w.range,92*power);
    for(let i=0;i<p.mods.length;i++)close(p.mods[i].value,p.baseStats.mods[i].value*power);
    close(d.damage,9*power);close(d.life,12*power);close(d.cd,14/power);close(d.fire,.45/power);
    assert.deepEqual(normalizeItem(JSON.parse(JSON.stringify(w))),w);
    assert.deepEqual(scaleItem(w,tier),w);
    if(price===null)assert.throws(()=>tierPrice(80,tier),/never sold/);
    else {assert.equal(tierPrice(80,tier),Math.round(80*price));assert.equal(priceOffer({...w,baseCost:80},4).cost,Math.round(Math.round(80*price)*(1+3*TUNING.priceWaveScale)))}
  }
  assert.deepEqual(Object.values(TIERS).map(t=>t.power),[1,1.35,1.85,2.5,3.4]);
  assert.deepEqual(Object.values(TIERS).map(t=>t.price),[1,1.6,2.4,3.5,null]);
  assert.equal(tierId('Common'),'common');assert.equal(TIERS.common.label,'Basic');
});
test('incoming roll snapshot wins, tier chain cascades, and module inheritance is loss-explicit',()=>{
  const incoming={...weapon('common'),id:'incoming',module:{id:'damage',name:'Damage x2'}},owned={...weapon('common'),id:'owned',module:{id:'range',name:'Range x2'}};
  const result=combinePair(owned,incoming);assert.deepEqual(result.item.module,incoming.module);assert.match(result.notice.description,/incoming.*destroyed/);
  assert.deepEqual(combinePair(owned,{...incoming,module:null}).item.module,owned.module);
  assert.deepEqual(combinePair({...owned,module:null},incoming).item.module,incoming.module);
  const chain=combineInto([owned,{...weapon('rare'),id:'rare'},{...weapon('epic'),id:'epic'}],incoming);
  assert.equal(chain.items.length,1);assert.equal(chain.item.rarity,'legendary');assert.equal(chain.notices.length,3);
  assert.deepEqual(chain.item.module,incoming.module);
  const passiveA=passive('common'),passiveB={...passive('common'),baseStats:{mods:[{stat:'armor',label:'Armor',value:3}]}};
  const merged=combinePair(passiveA,passiveB).item;assert.deepEqual(merged.baseStats,passiveB.baseStats);close(merged.mods[0].value,4.05);
});
test('legacy rarity migration, preserved rank bonuses, locked cost, server acceptance and JSON roundtrip',()=>{
  const run=createRun(characterById('nomad'),false,99,'tier-migration');
  const raw={...run,weapons:[{id:'legacy',baseId:'power',pattern:'projectile',rarity:'Legendary',name:'Legacy',damage:33,rate:.8,range:330,mods:[{stat:'armor',value:3}]}],deployables:[{id:'legacy-deploy',structure:'turretMount',name:'Bucket Truck Keys',rarity:'Rare',stacks:2}],shop:{wave:1,offers:[{...weapon('rare'),id:'lock',cost:123},null,null,null],sequence:1,rerolls:0},lockedIds:['lock']};
  const before=JSON.stringify(raw),normalized=normalizeRun(raw),roundtrip=normalizeRun(JSON.parse(JSON.stringify(normalized)));
  assert.equal(JSON.stringify(raw),before);assert.equal(normalized.weapons[0].rarity,'legendary');close(normalized.weapons[0].damage,55);
  assert.equal(normalized.deployables[0].stacks,2);assert.equal(normalized.shop.offers[0].cost,123);
  assert.deepEqual(roundtrip,normalized);assert.doesNotThrow(()=>validateProfile({checkpoint:{phase:'shop',run:roundtrip}},'owner'));
});
test('Overclocked never randomly rolls, Legendary wave gate holds, and Clone fresh rolls remain Basic/Rare',()=>{
  const early=createGenerator(813,1);for(let i=0;i<600;i++)assert.notEqual(early.weapon().rarity,'legendary');
  for(const cap of [null,'Rare']){
    const generator=createGenerator(42,40,cap);
    for(let i=0;i<600;i++)for(const item of [generator.weapon(),generator.passive(),generator.deployable()]){
      assert.notEqual(item.rarity,'overclocked');if(cap)assert(['common','rare'].includes(item.rarity));
    }
  }
});