import { DEPLOYABLES } from '@/game/data/structures';
import { TUNING } from '@/game/data/tuning';
import { TIERS, tierId, tierInfo, tierPrice } from '@/game/items/tiers';
import { scaleItem } from '@/game/items/itemScaling';

export const WEAPON_ARCHETYPES=[
['cleaver','Fiber Cleaver','melee','#fde047',24,.7,92,'✂'],['splicer','Fusion Splicer','nova','#c084fc',31,.92,120,'⚡'],['otdr','OTDR','pierce','#22d3ee',34,1.25,520,'⌁'],['vfl','Visual Fault Locator','beam','#ef4444',9,.28,390,'↗'],['power','Optical Power Meter','projectile','#38bdf8',22,.8,330,'▣'],['stripper','Fiber Stripper','projectile','#fb923c',8,.22,145,'≋'],['cleaner','One-Click Cleaner','cone','#34d399',15,.72,155,'◉'],['cutters','Kevlar Cutters','melee','#f472b6',42,1.05,105,'✕'],['tray','Splice Tray Sentry','turret','#f59e0b',13,3.2,300,'▤',{life:6,cap:3,fire:.45,mode:'pellet'}],['closure','Closure Cannon','turret','#f97316',46,4.5,420,'◎',{life:7,cap:2,fire:1.5,mode:'mortar'}],['cable','Launch Cable Nest','turret','#22d3ee',26,3.8,520,'⌇',{life:8,cap:2,fire:1,mode:'pulse'}],['fanout','Fan-Out Splitter','turret','#a3e635',9,3.4,230,'≡',{life:5,cap:3,fire:1.15,mode:'spread'}],['jumper','Patch Cord Whip','chain','#a3e635',18,1.6,210,'∿'],['midspan','Midspan Access Tool','pierce','#fb7185',29,.9,280,'⌇'],['blaster','Buffer Tube Blaster','cone','#60a5fa',17,.48,230,'◖'],['deadzone','Dead Zone Eliminator','beamSweep','#e879f9',25,.7,360,'⌁'],['switch','Optical Switch Snapper','chain','#2dd4bf',21,1.7,260,'⌘'],['bell','Fairy Bell','orbiting','#f9a8d4',16,.42,170,'♢'],['rocket','Loose-Tube Launcher','thrown','#f97316',38,1.4,350,'◉'],['dowel','Loader-Dowel','projectile','#a8a29e',48,1.6,300,'▮']
];
export const PUN_PREFIXES=['Greased-Lightning','Budget','OSHA-Violating','Refurbished','Cursed-but-Certified','Gently Used','Fleet-Surplus','Quantum','Loader-Dowel','Manager-Approved','Truck-Rolled','After-Hours','Overtime','Unlabeled','Mystery-Van','Bend-Insensitive','Squeaky-Clean','Zero-Downtime','Hot-Melt','Cold-Shrink','Emergency','Backordered','Hand-Me-Down','Union-Break','High-Vis','Low-Loss','Field-Tested','Coffee-Powered','Dispatch-Issued','Definitely-Calibrated'];
export const PUN_SUFFIXES=['of Questionable OTDR Results','with Extra Slack','from Bay Three','of the Eternal Ticket','and Associates','Plus Tax','of Dubious Provenance','with a Dust Cap','for Indoor Use Only','of Maximum Uptime','with Free Truck Roll','of Reduced Reflection','Mk. II-ish','from the Back of the Van','of Tiny Bend Radius','with Bonus Gel','of Certified Nonsense','at 1550 nm','of Sudden Escalation','with One Good Battery','of Unplanned Maintenance','and a Service Loop','of Full Bars','with Mystery Firmware','of the Night Shift','with Added Jacket','of Peak Fibber','of Splice Excellence','of Signal Recovery','with Googly Eyes'];
export const RARITY=TIERS;
// Player-facing tool designation, shown in the shop, loadout panel and Field
// Guide so a weapon's combat class is explicit at a glance.
export const DESIGNATIONS={melee:'Melee',nova:'Melee',chain:'Melee (fan)',orbiting:'Melee (nova)',projectile:'Ranged',thrown:'Ranged',pierce:'Piercing projectile',beamSweep:'Piercing projectile',beam:'Beam',cone:'Cone',turret:'Deployable'};
export const STAT_MOD_POOL=[['damage','Damage %',.02,.06],['attackSpeed','Attack Speed',.02,.06],['crit','Crit Chance',.01,.04],['range','Range',.01,.04],['knockback','Knockback',1,3],['lifeSteal','Life Steal',.005,.025],['pierce','Pierce',1,1],['cleanliness','Cleanliness',1,5],['signalStrength','Signal Strength',1,5],['spliceQuality','Splice Quality',1,5],['armor','Armor',1,2],['dodge','Dodge',.01,.035],['speed','Speed',.01,.04],['maxHp','HP',3,9],['regen','Regen',.3,1],['harvesting','Harvesting',1,5],['engineering','Engineering',1,5],['luck','Luck',1,5],['instakill','Instakill',.002,.007]];
export const PASSIVE_ITEM_TABLE=['Fusion Splice Protectors','Heat Shrinks','Buffer Tubes','Strength Members','Gel-Filled Tubes','Dust Caps','Connector Boots','OTDR Launch Cables','Cleaning Wipes','IPA Pens','Hard Hats','Safety Vests','Traffic Cones','Drop Cloths','Service Loops','Slack Coils','Red-Light Roves','Kevlar Tufts','Fiber Fish Tape','Mystery Pigtail','Rack-Mount Snacks','Label Maker','Splice-On Connector','Weatherproof Closure','Cable Lube','Utility Locates','Pedestal Key','Vault Pump','Tone Generator','Handhole Lid','Safety Glasses','Launch Reel','Ribbon Fan-Out','Emergency Jumper','Test Set Battery'];
export const SPECIAL_EFFECTS=['Repairs restore Jacket Integrity','Enemies occasionally drop bonus Signal','Gain a brief speed boost when hit','Critical hits knock impairments backward','Turrets inherit extra Splice Quality','First hit each wave is politely declined'];
export function seeded(seed){let s=(seed>>>0)||1;return()=>((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296)}
const one=(a,r)=>a[(r()*a.length)|0];
// Wave/level-gated tiers: Legendary cannot roll before TUNING.legendaryWave
// (about level 10); Epic weight grows with progress, capped so late runs still
// land mostly Rare/Basic. Luck shifts weight Basic toward better tiers.
// `cap` clamps fresh rolls (Clone: Rare); owned items can combine higher.
// Overclocked is never selected here. The fallback respects the wave gate.
function rarity(r,luck=0,wave=1,cap=null){const bonus=Math.min(20,Math.max(0,luck)*.2),w=Math.max(1,wave|0),ceiling=cap?tierId(cap):null;let roll=r()*100;for(const [name,v] of Object.entries(RARITY)){if(name==='overclocked')continue;let weight=v.weight+(name==='common'?-bonus:name==='rare'?bonus*.5:name==='epic'?bonus*.35:bonus*.15);if(name==='epic')weight=ceiling==='rare'?0:weight+Math.min(TUNING.epicWaveCap,w*TUNING.epicWaveGain);if(name==='legendary'&&(w<TUNING.legendaryWave||ceiling==='rare'))weight=0;roll-=weight;if(roll<=0)return name}return ceiling || (w>=TUNING.legendaryWave?'legendary':'epic')}
// Item stat rolls scale with progression: each wave multiplies rolled values
// by (1 + TUNING.itemStatWaveScale × (wave − 1)), capped at 2× — so buffs on
// newly rolled items get fatter as the run goes deeper.
function mods(r,rar,pool=STAT_MOD_POOL,wave=1){const info=tierInfo(rar),out=[],scale=Math.min(2,1+TUNING.itemStatWaveScale*((wave||1)-1));for(let i=0;i<info.rolls;i++){const m=one(pool,r),v=(m[2]+r()*(m[3]-m[2]))*scale;out.push({stat:m[0],label:m[1],value:+v.toFixed(m[2]<.01?3:m[2]<1?2:0)})}return out}
export function createGenerator(seed,wave=1,cap=null){
  const r=seeded(seed);
  return {
    weapon(luck=0,pool=WEAPON_ARCHETYPES,forcedRarity=null){
      const a=one(pool,r),rar=forcedRarity?tierId(forcedRarity):rarity(r,luck,wave,cap),m=mods(r,rar,STAT_MOD_POOL,wave);
      const melee=['melee','chain','nova','orbiting'].includes(a[2]),baseCost=a[8]?TUNING.deployBasePrice:27;
      return scaleItem({id:`w-${(r()*1e9)|0}`,baseId:a[0],turret:a[8]||null,heal:a[0]==='cleaner'?2:0,name:`${one(PUN_PREFIXES,r)} ${a[1]} ${one(PUN_SUFFIXES,r)}`,archetype:a[1],pattern:a[2],slotType:melee?'melee':'ranged',family:a[0]==='splicer'?'spark':melee?'melee':a[0]==='cleaner'?'squirt':['beam','pierce','beamSweep'].includes(a[2])?'laser':'snip',color:a[3],icon:a[7],rarity:rar,baseCost,cost:rar==='overclocked'?0:tierPrice(baseCost,rar),baseStats:{damage:a[4],rate:a[5],range:a[6],heal:a[0]==='cleaner'?2:0,turret:a[8]||null,mods:m},desc:DESIGNATIONS[a[2]] || a[2]},rar);
    },
    passive(luck=0,pool=STAT_MOD_POOL,forcedRarity=null,forcedName=null){
      const rar=forcedRarity?tierId(forcedRarity):rarity(r,luck,wave,cap),m=mods(r,rar,pool,wave);
      return scaleItem({id:`p-${(r()*1e9)|0}`,name:forcedName || one(PASSIVE_ITEM_TABLE,r),icon:'◆',rarity:rar,baseStats:{mods:m},special:r()<.28?one(SPECIAL_EFFECTS,r):null,baseCost:24,cost:rar==='overclocked'?0:tierPrice(24,rar)},rar);
    },
    deployable(luck=0){
      const d=one(DEPLOYABLES,r),rar=rarity(r,luck,wave,cap);
      return scaleItem({...d,id:`d-${(r()*1e9)|0}`,deployId:d.id,deploy:true,rarity:rar,baseStats:{mods:[]},baseCost:TUNING.deployBasePrice,cost:tierPrice(TUNING.deployBasePrice,rar)},rar);
    }
  };
}
export function applyMods(run,item){const n={...run};for(const m of item.mods||[]){if(['damage','attackSpeed','range'].includes(m.stat))n[m.stat]+=m.value;else if(m.stat==='speed')n.speed*=1+m.value;else if(['crit','dodge','lifeSteal'].includes(m.stat))n[m.stat]=(n[m.stat]||0)+m.value;else n[m.stat]=(n[m.stat]||0)+m.value}const special={
'Repairs restore Jacket Integrity':['cleaningKillsHeal',2],'Cleaning kills restore Jacket Integrity':['cleaningKillsHeal',2],'Enemies occasionally drop bonus Signal':['bonusSignal',.15],'Gain a brief speed boost when hit':['hitSpeedBoost',1],'Critical hits knock impairments backward':['critKnockback',3],'Turrets inherit extra Splice Quality':['turretQuality',5],'First hit each wave is politely declined':['firstHitBlocked',1]};if(special[item.special]){const[k,v]=special[item.special];n[k]=(n[k]||0)+v*(['firstHitBlocked','hitSpeedBoost'].includes(k)?1:(item.specialPower || 1))}if(n.hp>n.maxHp)n.hp=n.maxHp;return n}
export const dailySeed=()=>{const d=new Date();return Number(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`)};