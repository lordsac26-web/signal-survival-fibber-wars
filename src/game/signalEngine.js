import { ENEMIES, WEAPONS } from '@/game/data/combat';
import { STRUCTURES } from '@/game/data/structures';
import { deployStats } from '@/game/items/itemScaling';
import ObjectPool from '@/game/performance/ObjectPool';
import SpatialHash from '@/game/performance/SpatialHash';
import { enemySprite } from '@/game/performance/spriteAtlas';
import { drawProjectile } from '@/game/performance/drawProjectile';
import { sfx } from '@/game/audio';
import { TUNING, signalForLevel, waveDuration, spawnInterval, spawnDoubleChance, maxActiveEnemies } from '@/game/data/tuning';
import { activateSignature, crewHelperHp } from '@/game/combat/signatures';
import { drawHelper } from '@/game/performance/drawHelper';
import { techMuzzlePoint } from '@/game/combat/muzzle';
import { effectiveRange, updateVisibleViewport, withinReach, areaCanHit } from '@/game/combat/effectiveRange';
import { SIGNATURE_RANGE_WEAPONS } from '@/game/combat/rangeConfig';
import { advanceProjectile, projectileCanHit } from '@/game/combat/projectileTravel';
import { createSpriteAnimation, updateSpriteAnimation, drawCharacterSprite } from '@/game/art/spriteAnimation';
import { createLagAnimation, updateLagAnimation, drawLagSprite } from '@/game/art/enemySpriteAnimation';
import { drawTruckTurret, drawPedestalTurret, truckMuzzlePoint } from '@/game/art/structureSprite';
import { drawCrewHelper, crewMuzzle } from '@/game/art/crewHelper';
import { PUDDING, initPuddingState, stepPuddingState, puddleMitigation } from '@/game/combat/puddles';
import { createPuddingAnimation, updatePuddingAnimation, drawPuddingSprite } from '@/game/art/puddingSpriteAnimation';
import { structureSpriteDef } from '@/game/art/characterSprites';
import { SQUIRREL, ROUS, bossWave, bossKind, PETE } from '@/game/data/bosses';
import { createSquirrelAnimation, updateSquirrelAnimation, squirrelRelease, drawSquirrelSprite } from '@/game/art/squirrelSpriteAnimation';
import { createTechAnimation, updateTechAnimation, drawTechSprite, drawTechEnemy, drawTechDeathFrame } from '@/game/art/techSpriteAnimation';
import { JITTER, createJitterState, stepJitter, jitterVelocity, jitterPulseHits, pickEnemyKind } from '@/game/combat/jitter';
import { drawJitterSprite } from '@/game/art/jitterSpriteAnimation';
import { drawGroundPuddle, puddingFootPoint } from '@/game/art/groundPuddle';
import { KNOWLEDGE_DUMP } from '@/game/combat/knowledgeDump';
import { outageMovement, outageKillHeal } from '@/game/combat/outage';
import { createISRAnimation, updateISRAnimation } from '@/game/art/isrSpriteAnimation';
import { drawISR, isrMuzzlePoint } from '@/game/art/drawISR';
import { MACRO, createBendState, stepBend, bendVelocity } from '@/game/combat/macrobend';
import { createBendAnimation, updateBendAnimation, drawBendSprite, drawBendRing } from '@/game/art/bendSpriteAnimation';
import { MEETING, meetingTableSpot } from '@/game/combat/meetingInvite';
import { SURGE, surgeTotal, surgePulseTimes, surgePulseDamage } from '@/game/combat/fiberSplice';
import { createCritterState, stepCritter, critterVelocity, critterContactReady, clampCritterLunge } from '@/game/combat/crosstalk';
import drawCrosstalk from '@/game/art/crosstalkSpriteAnimation';
import { DITCH, createDitchState, stepDitch, ditchVelocity, ditchContactReady, clampDitchBounds, ditchRockBurst } from '@/game/combat/ditchWitch';
import { drawDitchWitch, drawDitchTelegraph, drawDitchRock } from '@/game/art/ditchWitchSpriteAnimation';
import { loadedCharacterSprite, loadedEnemySprite } from '@/game/art/spriteLoader';
import { APPARITION, ROUTER_ATTACK, createConeState, stepCone, consumeConeHit, casterVelocity, cancelHiddenCharge } from '@/game/combat/coneAttack';
import drawConeEnemy from '@/game/art/drawConeEnemy';
import { scaledEnemy, enemyDamageMultiplier } from '@/game/combat/difficulty';
import { turretInstanceCap, structureItemCap, structureCap, turretStats, structureTurretStats, PLACE_PROXIMITY, ENGINEER_DEPLOY_CD_MULT } from '@/game/combat/deployableRules';
import { createEncounterDirector, perimeterSpawn } from '@/game/combat/encounterDirector';
import { CAMP_ATTACK, createCampState, updateCamp, campVelocity } from '@/game/combat/antiCamp';
import drawCampCone from '@/game/art/drawCampCone';
import { PIN,createPinState,stepPin,sidestepVelocity } from '@/game/combat/bossAntiPin';
import { stepCoopPeers, drawCoopPeers, syncAuthoritativeCoopWorld } from '@/game/multiplayer/coopArenaSync';

const TYPES=Object.keys(ENEMIES),STEP=1/60,MAX_DT=.033;
const clamp=(n,a,b)=>n<a?a:n>b?b:n;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const weaponOf=w=>typeof w==='string'?WEAPONS[w]:w;


// RENDER-SMOOTHNESS CONTRACT (fixes the combat jitter/tearing reports):
// 1. Every draw coordinate is Math.round()ed — subpixel drawImage under a
//    devicePixelRatio transform is what made hit/knockback/death animations shimmer.
// 2. Screen shake is an integer camera offset computed ONCE per frame inside
//    draw() with an exponentially-decaying magnitude.
// 3. Crit hit-stop is a brief global time-scale dip (10% for ~40ms, eased back).
// 4. The canvas backing store is integer-sized, only on real resize events.
//
// DEPLOYABLES: weapon-turret archetypes (w.turret) live in the `turrets` pool
// and fire through the same `shots` pool as the player; player-placed
// structures (Q key) live in the `structures` pool. Both integrate with the
// enemy spatial hash for targeting, and structure-vs-enemy steering is a small
// per-enemy loop over the (tiny) active-structure list — no repathing, no O(n²).
export function createSignalEngine(canvas,run,input,cb,paused={current:false},characterArt=null,enemyArt=null,structureArt=null,squirrelArt=null,blobArt=null,pedestalArt=null,puddingArt=null,jitterArt=null,peteArt=null,bendArt=null,critterArt=null,apparitionArt=null,routerArt=null,arenaFloor=null,barricadeArt=null,cabinetArt=null,ditchArt=loadedEnemySprite('ditch')){
 const ctx=canvas.getContext('2d',{alpha:false}),grid=new SpatialHash(96),charId=run.character.id;
 let dpr=Math.min(devicePixelRatio||1,2);
 if(run.character.id==='oracle'&&!characterArt)throw new Error('Oracle art must be preloaded before combat');
 const techChars=['veteran','clone','don','nomad','admin','engineer'];const spriteState=characterArt?(charId==='isr'?createISRAnimation():run.character.id==='oracle'?createSpriteAnimation():techChars.includes(run.character.id)?createTechAnimation():null):null;
 const sqArt=squirrelArt&&squirrelArt.definition?squirrelArt:null;
 const petArt=peteArt&&peteArt.definition?peteArt:null;
 const lagArt=enemyArt&&enemyArt.definition?enemyArt:null;
 const blobArtDef=blobArt&&blobArt.definition?blobArt:null;
 const truckArt=structureArt&&structureArt.definition?structureArt:null,truckDef=truckArt?structureSpriteDef('bucket'):null;
 const pedArt=pedestalArt&&pedestalArt.definition?pedestalArt:null;
 const pudArtDef=puddingArt&&puddingArt.definition?puddingArt:null;
 const bendArtDef=bendArt&&bendArt.definition?bendArt:null;
 const viewport={width:1100,height:800},signatureWeapon=SIGNATURE_RANGE_WEAPONS[run.character.special.id];
 // MEETING INVITE (Admin): the table is an engine-owned world object —
 // spawned fully inside the visible viewport and world, luring enemies while
 // active, exploding exactly once at expiry. dying > 0 holds the Admin's
 // death strip for DEATH_HOLD seconds before the unchanged game-over flow.
 const meeting={active:false,x:0,y:0};const DEATH_HOLD=1.1;
 // FIBER SPLICE SURGE (Field Engineer): the cabinet plants at his feet and
 // 4 pulses fire off the special timer; ring visuals expand per pulse.
 const surge={active:false,x:0,y:0,pulse:0,id:0,rings:[]};
 const areaFx={life:0,x:0,y:0,reach:0,angle:0,half:Math.PI,color:'#fff',limit:Infinity,originX:0,originY:0};
 const enemies=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,hp:0,r:10,lastShot:-1}));
 const shots=new ObjectPool(320,i=>({poolIndex:i,active:false,x:0,y:0,prevX:0,prevY:0,originX:0,originY:0,maxReach:0,remaining:0,traveled:0,vx:0,vy:0,r:5,life:0,id:0,pen:0,mortar:false,pattern:'projectile',boom:false}));
 const particles=new ObjectPool(300,i=>({poolIndex:i,active:false,x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}));
 const pickups=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,value:1}));
 const numbers=new ObjectPool(48,i=>({poolIndex:i,active:false,x:0,y:0,life:0,value:0,crit:false}));
 const foeShots=new ObjectPool(64,i=>({poolIndex:i,active:false,x:0,y:0,prevX:0,prevY:0,vx:0,vy:0,r:6,remaining:0,traveled:0,life:0,damage:0,color:'#a16207',pattern:'foe',ring:false,rock:false}));
 const wrecks=new ObjectPool(8,i=>({poolIndex:i,active:false,x:0,y:0,facing:'right',t:0,dur:DITCH.deathDuration}));
 const turrets=new ObjectPool(48,i=>({poolIndex:i,active:false,x:0,y:0,hp:0,maxHp:0,haste:0,inv:0,r:13,wid:null,mode:'pellet',color:'#f59e0b',life:0,maxLife:1,fireCd:0,fire:.5,damage:10,range:300,born:0,lookA:0,weapon:null}));
 const structures=new ObjectPool(24,i=>({poolIndex:i,active:false,type:null,x:0,y:0,life:0,maxLife:1,r:20,born:0,uses:0,rearm:0,power:1,fireCd:0,haste:0,lookA:0}));
 // Puddle hazards are their own bounded pool — never counted against the
 // enemy cap, cleaned up with the engine instance on reset/wave end.
 const puddles=new ObjectPool(16,i=>({poolIndex:i,active:false,x:0,y:0,born:0,life:PUDDING.puddleLife,maxLife:PUDDING.puddleLife,mirror:false}));
 let puddleTickClock=0,puddleSlowMul=1;
 const W=1100,H=800,CLAUSE_RADIUS=260;
 let viewW=W,viewH=H,scale=1,camX=0,camY=0,last=performance.now(),acc=0,raf,spawn=0,hudClock=0,soundClock=0,shotId=0,over=false,stress=false,lowFx=false,separate=true,fps=60,fpsClock=0,frames=0,lastNumber=0;
 let slow=0,timeScale=1,shakeMag=0,clauseFired=false,burstCount=0,dying=0,deathDone=false;
 const duration=waveDuration(run.wave);let time=duration,signal=run.signal,earnedSignal=run.earnedSignal||0,kills=run.kills,xp=run.xp||0,levels=0,specialCooldown=run.specialCooldown||0,specialTimer=0,damageDealt=run.damageDealt||0;const killsByType={...(run.killsByType||{})};
 let healed=run.healed||0,damageTaken=run.damageTaken||0,xpEarnedWave=0;const startKills=run.kills,startEarned=run.earnedSignal||0;
 const director=createEncounterDirector(run.wave),camp=createCampState(550,400);let heading=0;
 const p={x:0,y:0,r:17,hp:run.hp,maxHp:run.maxHp,inv:0,regen:0};let hurtBoost=0,firstBlockUsed=false;const cooldowns=new Float32Array(run.weapons.length);
 let queryX=0,queryY=0,queryR=0,queryDamage=0,queryColor='#fff',queryShot=null,queryHits=0,queryStruct=null,nearestBest=null,nearestDist=0;
 let queryLimit=Infinity,queryOriginX=0,queryOriginY=0,queryArcAngle=0,queryArcHalf=Math.PI;
 // deployable state: per-structure-type cooldowns, the (tiny) active structure
 // list, and the pedestal attack-speed buff (recomputed every fixed step)
 const deployCds={...(run.deployCds||{})};let activeStructs=[],structCount=0,pedestalBuff=0,placeBlocked=false;
 const structCap=()=>structureCap(run);
 const deployCdMax=(item,d)=>d.cd*(1-.12*Math.min((item.stacks||1)-1,3))*(charId==='engineer'?ENGINEER_DEPLOY_CD_MULT:1);
 function addShake(v){shakeMag=Math.min(20,shakeMag+v)}
 function updateCamera(){camX=Math.round(clamp(p.x-viewW/2,0,Math.max(0,W-viewW)));camY=Math.round(clamp(p.y-viewH/2,0,Math.max(0,H-viewH)))}
 function publishReach(){cb.reach?.({viewport:{...viewport},weaponRanges:run.weapons.map(w=>effectiveRange(weaponOf(w),run,viewport)),signatureReach:signatureWeapon?effectiveRange(signatureWeapon,run,viewport):0})}
 function resize(){const r=canvas.getBoundingClientRect();scale=Math.max(1,r.width/W,r.height/H);updateVisibleViewport(viewport,r.width,r.height,scale);viewW=viewport.width;viewH=viewport.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.imageSmoothingEnabled=true;grid.resize(W,H);if(!p.x){p.x=W/2;p.y=H/2}updateCamera();publishReach()}
 function particle(x,y,color,count){if(lowFx)count=Math.min(2,count);for(let i=0;i<count;i++){let q=particles.acquire();if(!q){q=particles.items[(shotId+i)%particles.items.length];}q.x=x;q.y=y;q.vx=(Math.random()-.5)*150;q.vy=(Math.random()-.5)*150;q.life=.42;q.color=color}}
 function damageNumber(x,y,value,crit){if(performance.now()-lastNumber<45)return;lastNumber=performance.now();let n=numbers.acquire();if(!n)return;n.x=x;n.y=y;n.life=.55;n.value=Math.round(value);n.crit=crit}
 // CASH MONEY: while the clone's signature timer runs, every enemy Signal drop
// (including lucky bonus drops) pays double.
function kill(e){if(!e.active)return;if(e.ditch){stepDitch(e.ditch,0,{alive:false});if(ditchArt){const w=wrecks.acquire();if(w){w.x=e.x;w.y=e.y;w.facing=e.ditch.facing;w.t=0;w.dur=DITCH.deathDuration}}}const gain=charId==='isr'?outageKillHeal(p,specialTimer,true):0;if(gain>0){healed+=gain;if(spriteState){spriteState.heal=.45;spriteState.special=specialTimer}cb.flash(`+${Number(gain.toFixed(1))} HP — OUTAGE DECLARATION`);cb.event?.({type:'outageHeal',time:duration-time,amount:gain,index:e.poolIndex})}cb.event?.({type:'ownedKill',time:duration-time,index:e.poolIndex,kind:e.kind});kills++;killsByType[e.kind]=(killsByType[e.kind]||0)+1;const cashMul=specialTimer>0&&run.character.special.id==='cash'?2:1;const d=pickups.acquire();if(d){d.x=e.x;d.y=e.y;d.value=(e.value+(Math.random()<(run.bonusSignal||0)?e.value:0))*cashMul}if((run.luck||0)&&Math.random()<run.luck*.002){const b=pickups.acquire();if(b){b.x=e.x+7;b.y=e.y+7;b.value=e.value*cashMul}}if(run.cleaningKillsHeal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+run.cleaningKillsHeal);healed+=p.hp-before}particle(e.x,e.y,e.color,lowFx?2:10);if(e.elite)addShake(5);enemies.release(e)}
 // STAT HOOKS: damage/attackSpeed/crit/range multiply or trigger here;
 // spliceQuality adds craftsmanship damage; cleanliness is a damage bonus vs
 // dirty impairments; instakill fails the inspection instantly; lifeSteal is
 // % of damage dealt returned as HP; knockback (item stat + crit special) shoves.
 // NOTE: hit() multiplies by run.damage — callers pass UN-multipled base damage.
 function hit(e,base,color,melee=false){if(!e.active)return;const crit=Math.random()<(run.crit||0);let amount=base*run.damage*(crit?2:1)*(1+(run.spliceQuality||0)*.004);if(e.dirty)amount*=1+(run.cleanliness||0)*.01;if(!e.boss&&Math.random()<(run.instakill||0)){amount=e.hp+1;cb.flash('FIBBER DUMP!')}e.hp-=amount;damageDealt+=amount;queryHits++;particle(e.x,e.y,color,crit?8:2);damageNumber(e.x,e.y,amount,crit);if(crit){const kb=((run.critKnockback||0)+(run.knockback||0))*(1-Math.min(1,e.knockbackResist||0));if(kb){const a=Math.atan2(e.y-p.y,e.x-p.x);e.x+=Math.cos(a)*kb*8;e.y+=Math.sin(a)*kb*8}slow=.04;addShake(3)}if(run.lifeSteal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount*run.lifeSteal);healed+=p.hp-before}if(e.hp<=0)kill(e)}
 // Shared player-damage path: contact and the boss's FEC pellets both funnel
 // through armor, dodge, signalStrength and the hurt flash.
 function clearOutage(){specialTimer=0;if(spriteState){spriteState.special=0;spriteState.heal=0}}
 function damagePlayer(dmg){if(Math.random()<=Math.min(TUNING.dodgeCap,run.dodge||0))return;const amount=Math.max(Math.ceil(dmg*.25),Math.max(2,dmg-run.armor*1.5))*(1-Math.min(.4,(run.signalStrength||0)*.003));p.hp-=amount;if(charId==='isr'&&p.hp<=0)clearOutage();if(spriteState)spriteState.hurt=.18;damageTaken+=amount;if(run.hitSpeedBoost)hurtBoost=2;sfx('hit');particle(p.x,p.y,'#fff',12);addShake(4)}
 function areaVisitor(e){if(e.active && areaCanHit(e,queryX,queryY,queryR,queryArcAngle,queryArcHalf) && (queryLimit===Infinity || withinReach(e.x,e.y,queryOriginX,queryOriginY,queryLimit)))hit(e,queryDamage,queryColor,true)}
 // KNOWLEDGE DUMP split-burst visitors: one pass counts, the second applies the
 // per-enemy share (bosses take half) plus a white hit-flash so coverage reads.
 function clauseCountVisitor(e){if(e.active&&areaCanHit(e,queryX,queryY,queryR,queryArcAngle,queryArcHalf))burstCount++}
 function clauseDamageVisitor(e){if(!e.active||!areaCanHit(e,queryX,queryY,queryR,queryArcAngle,queryArcHalf))return;hit(e,e.boss?queryDamage*.5:queryDamage,'#fde68a',true);particle(e.x,e.y,'#ffffff',lowFx?2:5)}
 function shotVisitor(e){const s=queryShot;if(!s.active||!e.active||e.lastShot===s.id||s.boom)return;if(projectileCanHit(s,e)){e.lastShot=s.id;if(s.mortar){const dx=s.x-s.prevX,dy=s.y-s.prevY,l=dx*dx+dy*dy,t=l?clamp(((e.x-s.prevX)*dx+(e.y-s.prevY)*dy)/l,0,1):0;s.x=s.prevX+t*dx;s.y=s.prevY+t*dy;s.boom=true;return}hit(e,s.damage,s.color,false);if(!s.pierce){if(s.pen>0)s.pen--;else shots.release(s)}}}
 function nearestVisitor(e){if(!e.active)return;const d=Math.hypot(e.x-queryX,e.y-queryY);if(d<nearestDist){nearestBest=e;nearestDist=d}}
 function nearest(range){queryX=p.x;queryY=p.y;nearestBest=null;nearestDist=range;grid.visit(p.x,p.y,range,nearestVisitor);return nearestBest}
 function nearestAt(x,y,range){queryX=x;queryY=y;nearestBest=null;nearestDist=range;grid.visit(x,y,range,nearestVisitor);return nearestBest}
 function activeFoeCount(){return enemies.items.length-enemies.freeCount}
 function spawnEnemy(kind,force,request={}){if(!force&&activeFoeCount()>=maxActiveEnemies(run.wave))return;const e=enemies.acquire();if(!e)return;const base=ENEMIES[kind||pickEnemyKind(TYPES,run.wave)],edge=request.edge??((Math.random()*4)|0),pad=35;e.kind=kind||Object.keys(ENEMIES).find(id=>ENEMIES[id]===base);
 if(request.angle!==undefined)Object.assign(e,perimeterSpawn(p,{x:camX,y:camY,width:viewW,height:viewH},request.angle,pad));
 else{e.x=edge===1?camX+viewW+pad:edge===3?camX-pad:camX+(request.edge!==undefined?.5:Math.random())*viewW;e.y=edge===0?camY-pad:edge===2?camY+viewH+pad:camY+(request.edge!==undefined?.5:Math.random())*viewH}
 Object.assign(e,scaledEnemy(base,run.wave));e.r=base.r;e.color=base.color;e.elite=!!base.elite;e.dirty=!!base.dirty;e.sound=base.sound;e.lastShot=-1;e.sprite=enemySprite(e.kind,base);
 e.art=null;e.anim=null;e.pud=null;e.sq=null;e.jit=null;e.mac=null;e.critter=null;e.ditch=null;e.caster=null;e.campCast=null;e.boss=false;e.pin=null;e.shoutT=0;e.shoutCd=0;e.novaT=0;e.novaCd=0;
 if(e.kind==='ditch'){let live=0;for(const o of enemies.items)if(o!==e&&o.active&&o.kind==='ditch')live++;if(live>=DITCH.maxActive){enemies.release(e);return}e.ditch=createDitchState();e.art=ditchArt}
 if(e.kind==='attenuation'){let live=0;for(const o of enemies.items)if(o!==e&&o.active&&o.kind==='attenuation')live++;if(live>=APPARITION.maxActive){enemies.release(e);return}e.caster=createConeState(APPARITION);e.art=apparitionArt}
 if(e.kind==='crosstalk'){e.critter=createCritterState();e.art=critterArt}
 if(e.kind==='jitter'&&jitterArt){e.art=jitterArt;e.jit=createJitterState()}
 if(e.kind==='lag'&&lagArt){e.art=lagArt;e.anim=createLagAnimation()}if(e.kind==='dirty'&&blobArtDef){e.art=blobArtDef;e.anim=createTechAnimation();e.anim.special=.5}
 if(e.kind==='packet'&&puddingArt){e.art=puddingArt;e.anim=createPuddingAnimation();e.pud=initPuddingState()}
 // REPEAT PETE: the original carries a 30s clone-pulse clock; the mini is a
 // fully independent entity (no clock, never reproduces). Drawn from the same
 // processed strip set, minis scaled down at draw time.
 if(e.kind==='pete'){e.cloneT=PETE.cloneInterval;e.pin=createPinState();e.shoutCd=4}
 if((e.kind==='pete'||e.kind==='peteMini')&&petArt){e.art=petArt;e.anim=createTechAnimation()}
  // MACROBEND BEAST: chase state machine + animation; the cast ring spawns
  // from the stepBend 'fire' action inside the enemy loop.
  if(e.kind==='bend'&&bendArt){e.art=bendArt;e.anim=createBendAnimation();e.mac=createBendState()}
  if(e.elite&&!e.caster&&!e.ditch){e.campConfig={...CAMP_ATTACK,damage:e.damage};e.campCast=createConeState(e.campConfig)}
  cb.event?.({type:'enemySpawn',kind:e.kind,time:duration-time,tag:request.tag||'ordinary',edge:request.edge,x:e.x,y:e.y,hp:e.hp,damage:e.damage,active:activeFoeCount(),forced:!!force});return e;}
 function spawnPeteMini(src){if(activeFoeCount()>=maxActiveEnemies(run.wave))return;const m=enemies.acquire();if(!m)return;const base=ENEMIES.peteMini;
  m.kind='peteMini';m.x=clamp(src.x+(Math.random()<.5?-1:1)*26,20,W-20);m.y=clamp(src.y+(Math.random()<.5?-1:1)*26,20,H-20);
  Object.assign(m,scaledEnemy(base,run.wave,false));m.r=base.r;
  m.color=base.color;m.elite=false;m.dirty=false;m.sound=base.sound;m.lastShot=-1;m.sprite=enemySprite(m.kind,base);
  m.art=null;m.anim=null;m.pud=null;m.sq=null;m.jit=null;m.mac=null;m.critter=null;m.caster=null;m.campCast=null;m.boss=false;m.cloneT=0;m.pin=null;m.shoutT=0;m.shoutCd=0;m.novaT=0;m.novaCd=0;
  if(petArt){m.art=petArt;m.anim=createTechAnimation()}return m;}
 // SQUIRREL BOSS: spawns at the wave-20 gate (then every 10 waves). Phase 1
 // chases the player; at <=50% HP it flees, keeps other impairments between
 // itself and the player, and casts the telegraphed FEC cone between retreats.
 let bossSpawned=false;
 function spawnRouter(){if(!routerArt)return;const e=enemies.acquire();if(!e)return;const b=ROUS,m=60;
  Object.assign(e,{kind:b.id,x:clamp(p.x+viewW*.35,camX+m,camX+viewW-m),y:clamp(p.y-viewH*.3,camY+100,camY+viewH-16),...scaledEnemy(b,run.wave,true),r:b.r,color:b.color,elite:true,boss:true,dirty:false,sound:'boss',lastShot:-1,sprite:null,art:routerArt,anim:null,pud:null,sq:null,jit:null,mac:null,critter:null,campCast:null,caster:createConeState(ROUTER_ATTACK),pin:createPinState(),novaT:0,novaCd:4,shoutT:0,shoutCd:0});cb.flash(b.intro);cb.event?.({type:'bossSpawn',kind:b.id,time:duration-time});addShake(6)}
 function spawnBoss(){if(bossKind(run.wave)==='rous'){spawnRouter();return}if(!sqArt||!SQUIRREL)return;const e=enemies.acquire();if(!e)return;
  const edge=(Math.random()*4)|0,pad=60;e.kind=SQUIRREL.id;
  e.x=edge===1?camX+viewW+pad:edge===3?camX-pad:camX+Math.random()*viewW;e.y=edge===0?camY-pad:edge===2?camY+viewH+pad:camY+Math.random()*viewH;
  Object.assign(e,scaledEnemy(SQUIRREL,run.wave,true));e.r=SQUIRREL.r;e.campConfig={...CAMP_ATTACK,damage:e.damage};e.campCast=createConeState(e.campConfig);e.color=SQUIRREL.color;e.elite=true;e.boss=true;e.dirty=false;e.sound='boss';e.lastShot=-1;e.sprite=null;e.art=null;e.anim=null;e.pud=null;e.jit=null;e.mac=null;e.critter=null;e.caster=null;
  e.sq={...createSquirrelAnimation(),art:sqArt,phase:1,castCd:2,wind:0,cast:0,aim:0,pounceCd:4,pounceT:0,leapT:0,leapA:0,leapSpd:0,recover:0};e.pin=createPinState();e.shoutT=0;e.shoutCd=0;e.novaT=0;e.novaCd=0;
  cb.flash(SQUIRREL.intro);addShake(6)}
 function fireCone(e){const c=SQUIRREL.cone,step=c.pellets>1?c.half*2/(c.pellets-1):0;
  for(let k=0;k<c.pellets;k++){const a=e.sq.aim+(k-(c.pellets-1)/2)*step,f=foeShots.acquire();if(!f)break;
   f.x=f.prevX=e.x;f.y=f.prevY=e.y;f.vx=Math.cos(a)*c.speed;f.vy=Math.sin(a)*c.speed;f.remaining=c.range;f.traveled=0;f.life=c.range/c.speed+.5;f.damage=c.damage*enemyDamageMultiplier(run.wave,true);f.r=6;f.ring=false;sfx('packet')}
  addShake(3)}
  // MACROBEND BEAST cast: ONE ring released instantly at the end of the 1s
  // coil — direction locks to the beast's pose at release and never tracks.
  // Sized to 35% of the shorter visible side, 210 units/s, pops on player hit.
  function bendRing(e){const c=MACRO,angle=Math.atan2(p.y-e.y,p.x-e.x),f=foeShots.acquire();if(!f)return;
  f.ring=true;f.rock=false;f.x=f.prevX=e.x;f.y=f.prevY=e.y;f.vx=Math.cos(angle)*c.ringSpeed;f.vy=Math.sin(angle)*c.ringSpeed;
  f.remaining=Math.min(viewport.width,viewport.height)*c.rangeFactor;f.traveled=0;f.life=f.remaining/c.ringSpeed+.5;f.damage=e.damage;f.r=c.ringRadius;sfx('packet');addShake(2);
  cb.event?.({type:'macrobendRing',time:duration-time,index:e.poolIndex,x:e.x,y:e.y,damage:f.damage})}
  function fireDitchRocks(e){const burst=ditchRockBurst(e,e.ditch);for(const b of burst){const f=foeShots.acquire();if(!f)break;f.ring=false;f.rock=true;f.x=f.prevX=b.x;f.y=f.prevY=b.y;f.vx=b.vx;f.vy=b.vy;f.remaining=b.remaining;f.traveled=0;f.life=b.life;f.damage=b.damage;f.r=b.r;f.color='#78716c'}sfx('packet');addShake(3);cb.event?.({type:'ditchRocks',time:duration-time,index:e.poolIndex,x:e.x,y:e.y,count:burst.length})}
  // Returns this frame's steering angle and speed for the squirrel only.
 function squirrelUpdate(e,dt){const s=e.sq,d=SQUIRREL,wasWind=s.wind>0;
  if(s.phase===1&&e.hp<=e.max*.5){s.phase=2;s.castCd=1.2;cb.flash(SQUIRREL.phaseFlash);addShake(6)}
  s.cast=Math.max(0,s.cast-dt);s.wind=Math.max(0,s.wind-dt);s.castCd-=dt;
  if(wasWind&&!s.wind){fireCone(e);squirrelRelease(s)}
  if(s.phase===2&&s.wind<=0&&s.cast<=0&&s.castCd<=0&&distance(p,e)<d.cone.range*.95){s.wind=d.cone.windup;s.cast=d.cone.windup+.25;s.castCd=d.cone.cooldown;s.aim=Math.atan2(p.y-e.y,p.x-e.x);sfx('boss')}
  // POUNCE (phase-1 close-range answer): cornering the squirrel is
  // dangerous — 1.2s rooted telegraph, a leap whose aim locks at telegraph
  // end, radial impact and a short recover. Cooldown-gated, never during a
  // windup; the trigger sits inside the camp standoff distance.
  s.pounceCd=Math.max(0,(s.pounceCd||0)-dt);
  if(s.pounceT>0){s.pounceT=Math.max(0,s.pounceT-dt);
   if(s.pounceT<=0){s.leapT=SQUIRREL.pounce.leapTime;s.leapA=Math.atan2(p.y-e.y,p.x-e.x);s.leapSpd=Math.max(160,Math.min(SQUIRREL.pounce.leapSpeed,distance(p,e)/SQUIRREL.pounce.leapTime));sfx('boss')}
   return {a:Math.atan2(p.y-e.y,p.x-e.x),spd:0}}
  if(s.leapT>0){s.leapT=Math.max(0,s.leapT-dt);
   if(s.leapT<=0){const lands=p.inv<=0&&distance(p,e)<SQUIRREL.pounce.impactRadius+p.r;
    if(lands){damagePlayer(e.damage*SQUIRREL.pounce.damage);p.inv=.55}
    s.recover=SQUIRREL.pounce.recover;s.pounceCd=SQUIRREL.pounce.cooldown;addShake(7);particle(e.x,e.y,'#fca5a5',lowFx?4:14);
    cb.event?.({type:'squirrelPounce',time:duration-time,hit:lands,x:e.x,y:e.y,radius:SQUIRREL.pounce.impactRadius,damage:e.damage*SQUIRREL.pounce.damage})}
   return {a:s.leapA,spd:s.leapSpd}}
  if(s.recover>0){s.recover=Math.max(0,s.recover-dt);return {a:Math.atan2(p.y-e.y,p.x-e.x),spd:0}}
  if(s.phase===1&&s.wind<=0&&s.cast<=0&&s.castCd<=0&&s.pounceCd<=0&&distance(p,e)<SQUIRREL.pounce.range){
   s.pounceT=SQUIRREL.pounce.telegraph;cb.event?.({type:'squirrelPounceTelegraph',time:duration-time,x:e.x,y:e.y});return {a:Math.atan2(p.y-e.y,p.x-e.x),spd:0}}
  let a;
  if(s.phase===2){ // flee the player, biased toward the nearest crowd to hide behind
   let fx=e.x-p.x,fy=e.y-p.y,fl=Math.hypot(fx,fy)||1;fx/=fl;fy/=fl;
   let cx=0,cy=0,n=0;for(let i=0;i<enemies.items.length;i++){const o=enemies.items[i];if(o.active&&o!==e){cx+=o.x;cy+=o.y;n++}}
   if(n){cx-=e.x;cy-=e.y;const al=Math.hypot(cx,cy)||1;fx+=cx/al*.7;fy+=cy/al*.7}
   a=Math.atan2(fy,fx);
  }else a=Math.atan2(p.y-e.y,p.x-e.x);
  return {a,spd:s.wind>0?0:e.speed}} // holds position during the FEC telegraph
 // AOE burst (Closure Cannon mortar) — sequential grid pass, never nested in a visit
 function showArea(){areaFx.life=.12;areaFx.x=queryX;areaFx.y=queryY;areaFx.reach=queryR;areaFx.angle=queryArcAngle;areaFx.half=queryArcHalf;areaFx.color=queryColor;areaFx.limit=queryLimit;areaFx.originX=queryOriginX;areaFx.originY=queryOriginY}
 function explode(x,y,dmg,color,r,source=null){queryX=x;queryY=y;queryR=r;queryDamage=dmg;queryColor=color;queryArcHalf=Math.PI;queryLimit=source?source.maxReach:Infinity;queryOriginX=source?.originX || 0;queryOriginY=source?.originY || 0;grid.visit(x,y,r,areaVisitor);showArea();particle(x,y,color,lowFx?3:12);addShake(2)}
 // Projectile launch — origin defaults to the player so turrets pass their own x/y.
 // Targeting and travel use one CSS-viewport-derived reach, with no DPR multiplier.
 // Range is frozen for each launch; lifetime is only a failsafe, never the distance budget.
 function launch(w,angle,ox=p.x,oy=p.y,reach=effectiveRange(w,run,viewport)){const s=shots.acquire();if(!s)return;const v=w.speed||540;s.id=++shotId;s.x=s.prevX=s.originX=ox;s.y=s.prevY=s.originY=oy;s.maxReach=s.remaining=reach;s.traveled=0;s.vx=Math.cos(angle)*v;s.vy=Math.sin(angle)*v;s.r=w.helper?9:w.pattern==='beam'?7:5;s.life=reach/v+.5;s.damage=w.damage;s.color=w.color;s.helper=!!w.helper;s.pen=Math.round(run.pierce||0);s.pierce=['pierce','beam','beamSweep'].includes(w.pattern);s.mortar=!!w.mortar;s.pattern=w.pattern;s.boom=false}
 function attack(w){if(w.turret){deployTurret(w);return}const reach=effectiveRange(w,run,viewport),t=nearest(reach);if(!t)return;const a=Math.atan2(t.y-p.y,t.x-p.x),pattern=w.pattern||'projectile';sfx(w.family||'laser');if(spriteState){spriteState.attack=Math.max(spriteState.attack,.4);
  // ATTACK FACING: the attack sheets are left/right-only, so the pose faces
  // the TARGET (not the movement direction). A ±10-unit dead-zone keeps
  // near-vertical targets from flickering the mirror frame to frame.
  if(Math.abs(t.x-p.x)>10)spriteState.attackFace=t.x<p.x?'left':'right'}
 const faceDir=spriteState?((spriteState.attackFace||'right')==='left'?-1:1):(Math.cos(a)<0?-1:1);queryHits=0;if(['melee','nova','cone','orbiting'].includes(pattern)){queryX=p.x;queryY=p.y;queryR=reach;queryDamage=w.damage;queryColor=w.color;queryLimit=Infinity;queryArcAngle=a;queryArcHalf=['melee','cone'].includes(pattern)?Math.PI/3:Math.PI;grid.visit(p.x,p.y,reach,areaVisitor);showArea();cb.event?.({type:'attackHits',weapon:w.name,pattern,hits:queryHits});if(w.heal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+w.heal);healed+=p.hp-before}particle(p.x,p.y,w.color,7)}else{const def=characterArt?.definition;let mx=p.x,my=p.y-(def?.worldSize||48)*.45;
   if(charId==='isr'&&characterArt){const mp=isrMuzzlePoint(characterArt,spriteState,p.x,p.y);mx=mp.x;my=mp.y}
   else if(def){if(def.muzzle){const mp=techMuzzlePoint(def,faceDir,p.x,p.y);mx=mp.x;my=mp.y}else my=p.y+def.worldSize*(1-def.anchorY)-def.worldSize*.57}
   // Aim the projectile exactly from the transformed muzzle toward the actual
   // target (vertical/diagonal included); the upright sprite is never rotated.
   const aim=(def?.muzzle||charId==='isr')?Math.atan2(t.y-my,t.x-mx):a;launch(w,aim,mx,my,reach);if(pattern==='chain'){launch(w,aim-.16,mx,my,reach);launch(w,aim+.16,mx,my,reach)}}}
 // AUTO-DEPLOY TURRET WEAPONS: every rate/attackSpeed seconds, drop a sentry
 // near the player instead of firing directly. Turret damage/HP/lifetime/cap
 // all scale with the weapon's rolls + Engineering (see structures.js for
 // per-archetype tuning: life, cap, fire, mode).
 function deployTurret(w){const cfg=w.turret;
  let count=0;for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(t.active&&t.wid===w.id)count++}
  if(count>=turretInstanceCap(run))return; // silently at cap — HUD shows the live turrets
  const t=turrets.acquire();if(!t)return;const a=Math.random()*6.28;
  t.wid=w.id;t.mode=cfg.mode;t.color=w.color;t.born=0;t.inv=0;t.r=13;
  t.x=clamp(p.x+Math.cos(a)*26,20,W-20);t.y=clamp(p.y+Math.sin(a)*26,20,H-20);
  t.life=t.maxLife=cfg.life+(run.engineering||0)*.04;
  const tStats=turretStats(run,w,cfg);
  t.fire=tStats.fire;t.fireCd=tStats.fire*.4;
  t.damage=tStats.damage;
  t.weapon=w;t.range=w.range;t.hp=t.maxHp=20+(run.engineering||0)*2;t.haste=0;t.lookA=a+Math.PI;
  t.weaponTurret=true; // drawn with the splice-pedestal pack (see draw loop)
  sfx('deploy');particle(t.x,t.y,'#d6d3d1',lowFx?2:8)}
 function turretContact(e){const t=queryStruct;if(!e.active||t.inv>0)return;if(Math.hypot(e.x-t.x,e.y-t.y)<t.r+e.r+4){t.hp-=e.damage*.5;t.inv=.5}}
 // Tray muzzle origin for weapon-turrets drawn with the pedestal pack: the
 // projectile spawns at the fire strip's tray muzzle, mirrored with the aim.
 function pedestalMuzzlePoint(d,x,y,lookA){const f=d.strips.fire,s=d.worldSize/d.strips.deploy.cellW;return [x+(Math.cos(lookA||0)<0?-1:1)*(d.muzzle.x-f.anchorX)*s,y+(d.muzzle.y-f.baselineY)*s]}
 // Muzzle origins for pool turrets: Don's crew helpers fire from the measured
 // hand point of their extracted figure (crewMuzzle — a feet origin was the
 // playtest bug); weapon-deployed pedestal turrets from the fire strip's
 // barrel tip; signature sentries and the placeholder helper from a sensible
 // body-forward point instead of the feet.
 function turretMuzzle(t){if(t.mode==='helper')return characterArt&&characterArt.definition&&characterArt.definition.crewInd?crewMuzzle(characterArt.definition.crewInd,t):[t.x+Math.cos(t.lookA||0)*8,t.y-12];if(!(pedArt&&t.weaponTurret))return [t.x+Math.cos(t.lookA||0)*10,t.y-12];return pedestalMuzzlePoint(pedArt.definition,t.x,t.y,t.lookA)}
 const hasteMul=t=>(t.haste||0)>0?1+SURGE.haste:1; // Fiber Splice Surge: +30% fire clock while the repair haste runs
 function turretsUpdate(dt){for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(!t.active)continue;
  t.born+=dt;t.inv=Math.max(0,t.inv-dt);t.haste=Math.max(0,(t.haste||0)-dt);t.fireCd-=dt*hasteMul(t);t.life-=dt;
  if(t.mode==='helper'){const a=t.helperIndex*Math.PI/2;t.x+=(p.x+Math.cos(a)*38-t.x)*Math.min(1,dt*4);t.y+=(p.y+Math.sin(a)*38-t.y)*Math.min(1,dt*4)}
  if(t.life<=0||t.hp<=0){particle(t.x,t.y,'#94a3b8',lowFx?2:5);turrets.release(t);continue} // quiet despawn — no shake spam
  if(t.inv<=0){queryStruct=t;grid.visit(t.x,t.y,t.r+40,turretContact)} // impairments dent the sentry on contact
  if(t.fireCd<=0){const reach=effectiveRange(t.weapon,run,viewport,'turret'),target=nearestAt(t.x,t.y,reach);
   if(target){let ang=Math.atan2(target.y-t.y,target.x-t.x);t.lookA=ang;t.fireCd=t.fire;const [mx,my]=turretMuzzle(t);ang=Math.atan2(target.y-my,target.x-mx); // re-aim from the muzzle each shot
    if(t.mode==='pellet'||t.mode==='helper'){launch({damage:t.damage,range:t.range,pattern:'projectile',color:t.color},ang,mx,my,reach);sfx('snip')}
    else if(t.mode==='mortar'){launch({damage:t.damage,range:t.range,pattern:'mortar',color:t.color,mortar:true,speed:260},ang,mx,my,reach);sfx('packet')}
    else if(t.mode==='pulse'){launch({damage:t.damage,range:t.range,pattern:'pierce',color:t.color,speed:620},ang,mx,my,reach);sfx('laser')}
    else{for(let k=-2;k<=2;k++)launch({damage:t.damage,range:t.range,pattern:'projectile',color:t.color},ang+k*.22,mx,my,reach);sfx('spark')}
   }else t.fireCd=.12}}}
 // Player-placed structures: expire quietly (fade is handled in draw), mounts
 // fire through the same projectile pool, pedestals set the attack-speed buff.
 function structuresUpdate(dt){activeStructs.length=0;
  for(let i=0;i<structures.items.length;i++){const s=structures.items[i];if(!s.active)continue;
   s.born+=dt;s.life-=dt;s.rearm=Math.max(0,s.rearm-dt);
   if(s.life<=0){particle(s.x,s.y,'#94a3b8',lowFx?2:4);structures.release(s);continue}
   activeStructs.push(s)}
  structCount=activeStructs.length;pedestalBuff=0;
  for(let i=0;i<activeStructs.length;i++){const s=activeStructs[i],def=s.stats||STRUCTURES[s.type];if(!def)continue;
    s.haste=Math.max(0,(s.haste||0)-dt);
    if(def.kind==='turret'){s.fireCd-=dt*hasteMul(s);if(s.fireCd<=0){const reach=effectiveRange(def,run,viewport,'turret'),target=nearestAt(s.x,s.y,reach);if(target){let ang=Math.atan2(target.y-s.y,target.x-s.x);s.lookA=ang;const [mx,my]=truckArt&&truckDef&&s.type===truckDef.structureType?truckMuzzlePoint(truckDef,s.x,s.y,ang):pedArt?pedestalMuzzlePoint(pedArt.definition,s.x,s.y,ang):[s.x,s.y-14];ang=Math.atan2(target.y-my,target.x-mx);const stStats=structureTurretStats(run,def,s.power);launch({damage:stStats.damage,range:def.range,pattern:'projectile',color:def.color},ang,mx,my,reach);sfx('snip');s.fireCd=stStats.fire}else s.fireCd=.15}}
   else if(def.kind==='buff'&&Math.hypot(p.x-s.x,p.y-s.y)<s.r)pedestalBuff=Math.max(pedestalBuff,def.buff+.05*(s.power-1))}}
 // Q-key placement: structure appears AT the player, respecting per-type
 // cooldown and the total permit cap (6 + Engineering/10).
 function placeStructure(){const list=run.deployables||[];if(!list.length)return;
  const idx=Math.min(Math.max(0,input.current.deploySel||0),list.length-1);
  const item=list[idx],def=deployStats(item);if(!def)return;
  if((deployCds[item.structure]||0)>0){cb.flash(`REBOOTING ${def.name.toUpperCase()} — ${Math.ceil(deployCds[item.structure])}s`);return}
  // PLACEMENT RULES (playtest): the per-item instance cap and the proximity
  // exclusion are checked BEFORE the structure is acquired — a rejected
  // placement consumes no cooldown and the press is simply refused.
  let count=0,perItem=0,tooClose=false;for(let i=0;i<structures.items.length;i++){const s=structures.items[i];if(!s.active)continue;count++;if(s.type===item.structure)perItem++;if(Math.hypot(s.x-p.x,s.y-p.y)<PLACE_PROXIMITY)tooClose=true}
  if(count>=structCap()){cb.flash('PERMIT LIMIT: TOO MUCH STRUCTURE');return}
  if(perItem>=structureItemCap(run,item)){cb.flash(structureItemCap(run,item)===1?'UNIQUE GEAR: ONE INSTANCE PER SHIFT':'THIS DEPLOYABLE HAS ALL ITS UNITS OUT');return}
  if(tooClose){cb.flash('BLOCKED: TOO CLOSE TO A DEPLOYABLE');return}
  if(def.kind==='turret'&&!(truckArt&&truckDef&&truckDef.structureType===item.structure))cb.flash('TRUCK ART UNAVAILABLE — PEDESTAL STAND-IN');
  const s=structures.acquire();if(!s){cb.flash('PERMIT LIMIT');return}
  s.active=true;s.type=item.structure;s.x=clamp(p.x,30,W-30);s.y=clamp(p.y,30,H-30);
  s.born=0;s.life=s.maxLife=def.life+(run.engineering||0)*.06;s.r=def.r;
  s.stats=def;s.power=Math.min(item.stacks||1,TUNING.deployRankCap);s.rearm=0;s.fireCd=.3;s.lookA=Math.random()*6.28;s.uses=def.uses||0;
  deployCds[item.structure]=deployCdMax(item,def);
  sfx('deploy');particle(p.x,p.y,'#d6d3d1',lowFx?3:8);cb.flash(`${def.name.toUpperCase()} DEPLOYED`)}
 function novaSparks(x,y){const count=lowFx?4:8;for(let i=0;i<count;i++){const q=particles.acquire();if(!q)break;const a=i*Math.PI*2/count;Object.assign(q,{x:x+Math.cos(a)*JITTER.radius*.9,y:y+Math.sin(a)*JITTER.radius*.9,vx:0,vy:0,life:.2,color:'#67e8f9'})}}
 function spawnPuddle(x,y){const d=puddles.acquire();if(!d)return;d.x=x;d.y=y;d.born=0;d.life=d.maxLife=PUDDING.puddleLife;d.mirror=((Math.round(x*.13)+Math.round(y*.07))&1)===1;cb.event?.({type:'puddleDrop',time:duration-time,index:d.poolIndex,x,y,life:d.life});sfx('packet')}
 function signatureTurret(cfg){const t=turrets.acquire();if(!t)return false;const a=cfg.index*Math.PI/2,helper=cfg.mode==='helper';
  Object.assign(t,{x:p.x+(helper?Math.cos(a)*22:0),y:p.y+(helper?Math.sin(a)*22:0),wid:`signature-${run.character.id}`,mode:cfg.mode,helperIndex:cfg.index,color:cfg.color,born:0,inv:0,r:13,life:cfg.life,maxLife:cfg.life,fire:cfg.fire,fireCd:.15,damage:cfg.damage*(1+(run.engineering||0)*.01)*(1+(run.turretQuality||0)*.004),range:cfg.range,weapon:{range:cfg.range,pattern:'turret'},hp:cfg.mode==='helper'?crewHelperHp(run.wave,run.engineering):35+(run.engineering||0),maxHp:cfg.mode==='helper'?crewHelperHp(run.wave,run.engineering):35+(run.engineering||0),haste:0,lookA:0});return true}
 function spawnMeetingTable(){if(meeting.active)return false;
  const spot=meetingTableSpot(p.x,p.y,camX,camY,viewW,viewH,W,H);
  meeting.active=true;meeting.x=Math.round(spot.x);meeting.y=Math.round(spot.y);
  cb.event?.({type:'meetingStart',time:duration-time,x:meeting.x,y:meeting.y,radius:MEETING.blastRadius,duration:MEETING.duration});
  sfx('deploy');particle(meeting.x,meeting.y,'#d6d3d1',lowFx?4:10);return true}
 // ONE blast at expiry: total = 8x the Admin's combined current weapon
 // damage (the same canonical numbers as Knowledge Dump), split evenly
 // across every enemy inside the radius; bosses take the FULL share.
 function meetingDamageVisitor(e){if(!e.active||!areaCanHit(e,queryX,queryY,queryR,queryArcAngle,queryArcHalf))return;hit(e,queryDamage,'#fbbf24',true);particle(e.x,e.y,'#ffffff',lowFx?2:5)}
 function explodeMeeting(){const total=run.weapons.reduce((s,w)=>s+(weaponOf(w).damage||0),0)*MEETING.damageMult;
  queryX=meeting.x;queryY=meeting.y;queryR=MEETING.blastRadius;queryArcAngle=0;queryArcHalf=Math.PI;burstCount=0;
  grid.visit(meeting.x,meeting.y,MEETING.blastRadius,clauseCountVisitor);
  if(burstCount){queryDamage=total/burstCount;grid.visit(meeting.x,meeting.y,MEETING.blastRadius,meetingDamageVisitor)}
  queryColor='#fbbf24';showArea();particle(meeting.x,meeting.y,'#fbbf24',lowFx?8:24);addShake(8);sfx('burst');
  cb.event?.({type:'meetingExplode',time:duration-time,x:meeting.x,y:meeting.y,radius:MEETING.blastRadius,total,share:burstCount?total/burstCount:0,targets:burstCount})}
  // FIBER SPLICE SURGE pulse: one grid pass over the ring radius; each enemy
  // is tagged with the activation+pulse id so a single pulse can never hit the
  // same impairment twice (and a new pulse always re-tags). The same pulse
  // repairs every deployed unit (20% max HP) and grants +30% attack speed.
  function fireSurgePulse(k){
  const damage=surgePulseDamage(run,run.wave),tag=surge.id*10+k;let hits=0;
  queryX=surge.x;queryY=surge.y;queryR=SURGE.ringRadius;queryArcAngle=0;queryArcHalf=Math.PI;
  grid.visit(surge.x,surge.y,SURGE.ringRadius,e=>{
   if(!e.active||e.surgeHit===tag||!areaCanHit(e,surge.x,surge.y,SURGE.ringRadius,0,Math.PI))return;
   e.surgeHit=tag;hits++;hit(e,damage,'#7fe6f9',true);particle(e.x,e.y,'#ffffff',lowFx?2:4)});
  surge.rings.push({x:surge.x,y:surge.y,t:0});
  for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(!t.active)continue;
   t.hp=Math.min(t.maxHp||t.hp,t.hp+(t.maxHp||t.hp)*SURGE.repairPct);t.haste=SURGE.hasteDuration}
  for(let i=0;i<structures.items.length;i++){const s=structures.items[i];if(!s.active)continue;
   const def=s.stats||STRUCTURES[s.type];if(def?.kind==='turret')s.haste=SURGE.hasteDuration}
  addShake(3);sfx('burst');
  cb.event?.({type:'surgePulse',time:duration-time,pulse:k,x:surge.x,y:surge.y,radius:SURGE.ringRadius,damage,hits})}
  function activateSpecial(){if(specialCooldown>0||p.hp<=0||over||meeting.active||(charId==='isr'&&specialTimer>0))return;  const timer=activateSignature(run,p,{table:spawnMeetingTable,launch,area:(r,d,color)=>explode(p.x,p.y,d,color,effectiveRange(signatureWeapon,run,viewport)),heal:amount=>{const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount);healed+=p.hp-before},turret:signatureTurret});if(timer===null){cb.flash('NO PERMIT SPACE — TRY AGAIN');return}specialTimer=timer;if(run.onCoopSpecial)run.onCoopSpecial(p.x,p.y,run.character.special);if(charId==='isr'&&spriteState){spriteState.special=timer;spriteState.heal=0;cb.event?.({type:'outageStart',time:duration-time,duration:timer,cooldown:run.character.special.cooldown})}if(spriteState&&run.character.special.id==='clause'){spriteState.special=timer;clauseFired=false}specialCooldown=run.character.special.cooldown;sfx(run.character.special.id==='cash'?'cash':run.character.special.id==='outage'?'whistle':run.character.special.id==='clause'?'charge':run.character.special.id==='surge'?'deploy':run.character.special.id==='sprint'?'chug':'special');cb.flash(run.character.special.name.toUpperCase());addShake(5);particle(p.x,p.y,'#ffffff',lowFx?6:16);if(run.character.special.id==='cash'){for(let i=0;i<8;i++){let q=particles.acquire();if(q){q.x=p.x+(Math.random()-.5)*20;q.y=p.y+(Math.random()-.5)*20;q.vx=(Math.random()-.5)*200;q.vy=-100-Math.random()*100;q.life=.5;q.color='#22c55e'}}}}
 function separateVisitor(other){const e=queryShot;if(!other.active||other===e)return;let dx=e.x-other.x,dy=e.y-other.y,d2=dx*dx+dy*dy,min=e.r+other.r;if(d2>0&&d2<min*min){const push=(min-Math.sqrt(d2))*.025;e.x+=dx*push;e.y+=dy*push}}
 // Single completion funnel (wave clear or player defeat): harvest, the
 // solo checkpoint payload, and the meeting/lure cleanup all run exactly
 // once — the death-sequence hold calls the same complete(false).
 function complete(won){if(deathDone)return;deathDone=true;meeting.active=false;const harvest=won?Math.round(run.harvesting||0):0;signal+=harvest;earnedSignal+=harvest;sfx(won?'clear':'death');cancelAnimationFrame(raf);cb.finish({...run,hp:Math.max(0,p.hp),signal,earnedSignal,kills,xp,pendingLevels:levels,specialProgress:0,specialUnlocked:true,specialCooldown,deployCds:{...deployCds},won,damageDealt:Math.round(damageDealt),healed:Math.round(healed),damageTaken:Math.round(damageTaken),killsByType,lastWaveMetrics:{duration:duration-Math.max(0,time),kills:kills-startKills,earnedSignal:earnedSignal-startEarned,xpEarned:+xpEarnedWave.toFixed(2),levelsGained:levels}})}
 function fixedUpdate(dt){
  const oldX=p.x,oldY=p.y;
  if(run.coopAuthoritative&&run.coopWorldRef?.current){
   areaFx.life=Math.max(0,areaFx.life-dt);soundClock-=dt;
   let ix=input.current.x,iy=input.current.y;
   if(ix||iy){const m=Math.hypot(ix,iy)||1,boost=specialTimer>0?(run.character.special.id==='sprint'?1.8:run.character.special.id==='clause'?.3:1):1;p.x+=ix/m*run.speed*boost*dt;p.y+=iy/m*run.speed*boost*dt}
   p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r);
   if(input.current.cycle){input.current.cycle=false;const list=run.deployables||[];if(list.length){const cur=Math.min(Math.max(0,input.current.deploySel||0),list.length-1);const nxt=(cur+1)%list.length;input.current.deploySel=nxt;cb.flash(`DEPLOY: ${list[nxt].name}`)}}
   if(input.current.special){input.current.special=false;run.onCoopAction?.({action:'special'})}
   if(input.current.deploy){input.current.deploy=false;const idx=Math.min(Math.max(0,(input.current.deploySel||0)),Math.max(0,(run.deployables||[]).length-1));run.onCoopAction?.({action:'deploy',deployIndex:idx})}
   run.onCoopInput?.({x:ix,y:iy,viewportW:viewW,viewportH:viewH});
   const synced=syncAuthoritativeCoopWorld({run,dt,p,enemies,shots,foeShots,turrets,structures,pickups,puddles,meeting,surge,arts:{ditchArt,apparitionArt,routerArt,critterArt,jitterArt,lagArt,blobArtDef,puddingArt,pudArtDef,petArt,bendArt,bendArtDef,sqArt},fxCallbacks:{damageNumber,particle,addShake,sfx,flash:cb.flash,showArea:(ax,ay,ar,ac)=>{queryX=ax;queryY=ay;queryR=ar;queryColor=ac;queryArcAngle=0;queryArcHalf=Math.PI;queryLimit=Infinity;showArea()}}});
   if(synced?.world){
    time=synced.world.time;
    if(synced.me){
     signal=synced.me.signal;earnedSignal=synced.me.earnedSignal||0;kills=synced.me.kills||0;xp=synced.me.xp||0;
     levels=synced.me.pendingLevels||0;specialCooldown=synced.me.specialCooldown||0;specialTimer=synced.me.special||0;
     damageDealt=synced.me.damageDealt||0;healed=synced.me.healed||0;damageTaken=synced.me.damageTaken||0;
     if(synced.me.deployCds)Object.assign(deployCds,synced.me.deployCds);
    }
   }
   if(spriteState){if(run.character.id==='oracle')updateSpriteAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition);else{spriteState.special=specialTimer>0?specialTimer:0;if(charId==='isr')updateISRAnimation(spriteState,p.x-oldX,p.y-oldY,dt);else updateTechAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition)}}
   updateCamera();
   for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(!q.active)continue;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;if(q.life<=0)particles.release(q)}
   for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;n.y-=25*dt;n.life-=dt;if(n.life<=0)numbers.release(n)}
   hudClock-=dt;if(hudClock<=0){let boss=synced?.world?.boss||null;const depList=run.deployables||[],depIdx=depList.length?Math.min(Math.max(0,input.current.deploySel||0),depList.length-1):0;cb.hud({hp:p.hp,maxHp:p.maxHp,time:Math.max(0,time),signal,earnedSignal,xp,xpTarget:signalForLevel((synced?.me?.baseLevel||run.level)+levels),level:(synced?.me?.level||run.level+levels),kills,boss,specialUnlocked:true,specialCooldown,specialName:run.character.special.name,characterId:charId,specialRemaining:(charId==='isr'||charId==='admin')?specialTimer:0,fps:Math.round(fps),stress,position:{x:p.x,y:p.y},viewport:{...viewport},weaponRanges:run.weapons.map(w=>effectiveRange(weaponOf(w),run,viewport)),signatureReach:signatureWeapon?effectiveRange(signatureWeapon,run,viewport):0,deploy:depList.length?{items:depList.map((d,i)=>({icon:d.icon,name:d.name,stacks:d.stacks,cd:deployCds[d.structure]||0,cdMax:deployCdMax(d,deployStats(d)),selected:i===depIdx})),structures:structures.items.filter(s=>s.active).length,cap:structCap(),blocked:false}:null});hudClock=.1}
   return;
  }
  areaFx.life=Math.max(0,areaFx.life-dt);time-=dt;soundClock-=dt;hurtBoost=Math.max(0,hurtBoost-dt);p.inv=Math.max(0,p.inv-dt);specialCooldown=Math.max(0,specialCooldown-dt);specialTimer=Math.max(0,specialTimer-dt);if(charId==='isr'){if(specialTimer<1e-8)specialTimer=0;if(specialCooldown<1e-8)specialCooldown=0}if(specialTimer>0&&run.character.special.id==='clause'){const ce=KNOWLEDGE_DUMP.total-specialTimer;if(ce>=KNOWLEDGE_DUMP.charge-1e-8&&!clauseFired){clauseFired=true;cb.event?.({type:'knowledgeImpact',time:duration-time,remaining:specialTimer});// KNOWLEDGE DUMP: the old fixed-90
// instakill burst is gone. At release the total is 30x the Veteran's
// combined current weapon damage, split EVENLY across every impairment
// inside the burst radius; any boss takes half its split share. An empty
// radius still plays the golden release so the pop reads. Damage then
// flows through hit() (run.damage multipliers, crit, etc.), like every
// other source.
 const total=run.weapons.reduce((s,w)=>s+(weaponOf(w).damage||0),0)*30;burstCount=0;queryX=p.x;queryY=p.y;queryR=CLAUSE_RADIUS;queryArcAngle=0;queryArcHalf=Math.PI;grid.visit(p.x,p.y,CLAUSE_RADIUS,clauseCountVisitor);if(burstCount){queryDamage=total/burstCount;grid.visit(p.x,p.y,CLAUSE_RADIUS,clauseDamageVisitor)}queryColor='#fbbf24';showArea();addShake(15);sfx('burst');particle(p.x,p.y,'#fbbf24',lowFx?10:30)}}if(specialTimer<=0)clauseFired=false;
  // MEETING INVITE: exactly 4s after activation the table explodes once,
  // then aggro returns to the player immediately (no permanent retargeting).
  if(meeting.active&&specialTimer<=1e-6){meeting.active=false;explodeMeeting()}
  // FIBER SPLICE SURGE: arm the planted cabinet (fixed at activation), fire
  // pulses on the schedule, then clear state when the timer ends. Pause
  // freezes everything because this whole block runs off specialTimer.
  // The branch stays open while surge.active so the LAST pulse (elapsed
  // exactly 4.8, specialTimer 0) still fires — a strictly `specialTimer>0`
  // gate left pulse 4 to float-rounding luck.
  if((specialTimer>0||surge.active)&&run.character.special.id==='surge'){
   const elapsed=surgeTotal()-specialTimer;
   if(!surge.active){surge.active=true;surge.id++;surge.pulse=0;surge.x=clamp(p.x,30,W-30);surge.y=clamp(p.y,30,H-30);surge.rings.length=0;
    cb.event?.({type:'surgeStart',time:duration-time,x:surge.x,y:surge.y,radius:SURGE.ringRadius,arming:SURGE.arming,duration:surgeTotal()});
    sfx('deploy');particle(surge.x,surge.y,'#7fe6f9',lowFx?4:10)}
   const times=surgePulseTimes();
   while(surge.pulse<SURGE.pulses&&elapsed>=times[surge.pulse]-1e-9){fireSurgePulse(surge.pulse);surge.pulse++}
  }
  if(specialTimer<=0&&surge.active){surge.active=false;surge.rings.length=0}
  for(let i=surge.rings.length-1;i>=0;i--){const r=surge.rings[i];r.t+=dt;if(r.t>=SURGE.pulseWindow/SURGE.pulses)surge.rings.splice(i,1)}
  for(const k in deployCds)if(deployCds[k]>0)deployCds[k]=Math.max(0,deployCds[k]-dt);p.regen+=dt*run.regen;if(p.regen>=1){const h=p.regen|0,before=p.hp;p.hp=Math.min(p.maxHp,p.hp+h);healed+=p.hp-before;p.regen-=h} // PACKET-LOSS PUDDING hazards: expire on a game-time clock (frozen while
 // paused), the strongest slow applies once while inside, and damage runs on
 // ONE shared 0.5s tick clock that overlapping puddles never reset or stack.
 puddleSlowMul=1;
 for(let i=0;i<puddles.items.length;i++){const d=puddles.items[i];if(!d.active)continue;d.born+=dt;d.life=Math.max(0,PUDDING.puddleLife-d.born);if(d.life<=1e-8){puddles.release(d);continue}if(Math.hypot(p.x-d.x,p.y-d.y)<PUDDING.radius+p.r*.5)puddleSlowMul=Math.min(puddleSlowMul,1-PUDDING.slow)}
 puddleTickClock-=dt;if(puddleTickClock<=0){puddleTickClock+=PUDDING.tickInterval;let inP=false;for(let i=0;i<puddles.items.length;i++){const d=puddles.items[i];if(d.active&&Math.hypot(p.x-d.x,p.y-d.y)<PUDDING.radius+p.r*.5){inP=true;break}}if(inP&&p.inv<=0){const before=p.hp;damagePlayer(PUDDING.tickDamage*(1-puddleMitigation(run.cleanliness)));cb.event?.({type:'puddleTick',time:duration-time,damage:before-p.hp})}}
 let ix=input.current.x,iy=input.current.y;if(ix||iy){const m=Math.hypot(ix,iy)||1,boost=(specialTimer>0?(run.character.special.id==='sprint'?1.8:run.character.special.id==='clause'?.3:1):1)*(hurtBoost>0?1.3:1);p.x+=ix/m*run.speed*boost*puddleSlowMul*dt;p.y+=iy/m*run.speed*boost*puddleSlowMul*dt}p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r); if(spriteState){if(run.character.id==='oracle')updateSpriteAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition);else{spriteState.special=specialTimer>0?specialTimer:0;if(charId==='isr')updateISRAnimation(spriteState,p.x-oldX,p.y-oldY,dt);else updateTechAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition)}}if(input.current.special){input.current.special=false;activateSpecial()}
  // deployable input: C cycles the selected item (HUD highlight follows), Q places it
  if(input.current.cycle){input.current.cycle=false;const list=run.deployables||[];if(list.length){const cur=Math.min(Math.max(0,input.current.deploySel||0),list.length-1);const nxt=(cur+1)%list.length;input.current.deploySel=nxt;cb.flash(`DEPLOY: ${list[nxt].name}`)}}
  if(input.current.deploy){input.current.deploy=false;placeStructure()}
  updateCamera();
  // Live placement preview state: red exclusion ring at the feet whenever
  // the selected deployable cannot legally go where the technician stands.
  placeBlocked=false;
  if((run.deployables||[]).length){const list=run.deployables,selIdx=Math.min(Math.max(0,input.current.deploySel||0),list.length-1),sel=list[selIdx],selDef=deployStats(sel);
   if(selDef){let count=0,perItem=0,tooClose=false;for(let i=0;i<structures.items.length;i++){const s=structures.items[i];if(!s.active)continue;count++;if(s.type===sel.structure)perItem++;if(Math.hypot(s.x-p.x,s.y-p.y)<PLACE_PROXIMITY)tooClose=true}
    placeBlocked=count>=structCap()||perItem>=structureItemCap(run,sel)||tooClose}}
  if(!bossSpawned&&bossWave(run.wave)){bossSpawned=true;spawnBoss()}
  // Outage affects locomotion ONLY: ordinary spawn attempts, double chance and caps stay unchanged.
if(ix||iy)heading=Math.atan2(iy,ix);updateCamp(camp,p,dt);
 const requests=director.next(duration-time,activeFoeCount(),maxActiveEnemies(run.wave),heading);
 for(const request of requests)spawnEnemy(request.kind,false,request);
 spawn-=dt;if(spawn<=0){if(activeFoeCount()<maxActiveEnemies(run.wave)-Math.max(director.reserved(),enemies.items.some(e=>e.active&&e.kind==='pete'&&e.cloneT<=1)?1:0)){spawnEnemy();if(Math.random()<spawnDoubleChance(run.wave)&&activeFoeCount()<maxActiveEnemies(run.wave)-director.reserved())spawnEnemy()}spawn=spawnInterval(run.wave)}grid.clear();
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active)grid.insert(e)}
  structuresUpdate(dt); // mounts fire + pedestal buff, uses the freshly built enemy grid
  if(run.coop)stepCoopPeers(run,dt,{player:p,heal:amt=>{const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amt);healed+=p.hp-before},damageBoss:amt=>{for(let i=0;i<enemies.items.length;i++){const b=enemies.items[i];if(b.active&&b.boss){b.hp-=amt;if(b.hp<=0)kill(b);break}}},nearestAt,launch,particle,flash:cb.flash});
  for(let i=0;i<run.weapons.length;i++){cooldowns[i]-=dt;const w=weaponOf(run.weapons[i]);if(w&&cooldowns[i]<=0){const scheduled=w.rate/(run.attackSpeed*(1+pedestalBuff));attack(w);cb.event?.({type:'weaponTrigger',weapon:w.name,index:i,scheduled});cooldowns[i]=scheduled}}
  turretsUpdate(dt);
  for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(!s.active)continue;const ended=advanceProjectile(s,dt);queryShot=s;grid.visit((s.prevX+s.x)/2,(s.prevY+s.y)/2,Math.hypot(s.x-s.prevX,s.y-s.prevY)/2+s.r+34,shotVisitor);if(!s.active)continue;if(s.boom || ended){if(s.mortar)explode(s.x,s.y,s.damage,s.color,Math.min(55,s.maxReach*.25),s);shots.release(s)}}
  // Enemy projectiles (FEC pellets): travel, then one hit on the player each;
  // a 0.3s grace window after any hit keeps a full volley from dumping at once.
  for(let i=0;i<foeShots.items.length;i++){const s=foeShots.items[i];if(!s.active)continue;const ended=advanceProjectile(s,dt);if(!ended&&p.inv<=0&&distance(p,s)<p.r+s.r){damagePlayer(s.damage);p.inv=.3;foeShots.release(s);continue}if(ended||s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)foeShots.release(s)}
  // STAT HOOKS: armor flat-reduces contact damage but can never reduce a hit
  // below 25% of its pre-armor damage (wet-noodle guard); dodge is a capped
  // (50%) chance to ignore it entirely; signalStrength resists impairment damage.
  // STRUCTURES: barricades shove enemies out (local steering, tiny m), traps
  // chomp + shove, snares slow — none of it touches the player.
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(!e.active)continue;const tgt=meeting.active?meeting:p;let a=Math.atan2(tgt.y-e.y,tgt.x-e.x),spd=e.speed;
   let slowMul=1;
   // FACTORY RESET (R.O.U.S.): 1.5s rooted radial telegraph, then a nova that
   // also releases a couple of lag sprites. Never while a cone cast runs.
   if(e.kind==='rous'){e.novaCd=Math.max(0,(e.novaCd||0)-dt);
    if(e.novaT>0){e.novaT=Math.max(0,e.novaT-dt);
     if(e.novaT<=0){const lands=p.inv<=0&&distance(p,e)<ROUS.nova.radius;
      if(lands){damagePlayer(e.damage);p.inv=.55}
      spawnEnemy('lag',true);spawnEnemy('lag',true);
      e.novaCd=ROUS.nova.cooldown;addShake(7);particle(e.x,e.y,'#facc15',lowFx?6:18);
      cb.event?.({type:'rousNova',time:duration-time,hit:lands,x:e.x,y:e.y,radius:ROUS.nova.radius,lags:2})}}
    else if((e.novaCd||0)<=0&&e.caster&&e.caster.phase==='chase'&&distance(p,e)<ROUS.nova.range){e.novaT=ROUS.nova.telegraph;cb.event?.({type:'rousNovaTelegraph',time:duration-time,x:e.x,y:e.y})}}
   if(e.caster&&!(e.novaT>0)){cancelHiddenCharge(e.caster,{x:camX,y:camY,width:viewW,height:viewH},e.boss?60:40,e.boss?100:40,e.boss?16:40);const c=e.boss?ROUTER_ATTACK:APPARITION,act=stepCone(e.caster,c,dt,{alive:e.hp>0,playerAlive:p.hp>0,x:e.x,y:e.y,tx:tgt.x,ty:tgt.y,shortSide:Math.min(viewW,viewH),visible:e.x>camX+55&&e.x<camX+viewW-55&&e.y>camY+(e.boss?100:55)&&e.y<camY+viewH-(e.boss?16:55)});
    if(act)cb.event?.({type:'conePhase',kind:e.kind,phase:act,time:duration-time,index:e.poolIndex,powered:e.caster.poweredShot});
    if(act==='release'){const lands=consumeConeHit(e.caster,p.x,p.y,p.inv);if(lands){damagePlayer(e.caster.damage*enemyDamageMultiplier(run.wave,e.elite));p.inv=.55}cb.event?.({type:'coneRelease',kind:e.kind,time:duration-time,hit:lands,cone:{...e.caster}})}}
   if(e.ditch){const act=stepDitch(e.ditch,dt,{alive:e.active&&e.hp>0,playerAlive:p.hp>0,dx:tgt.x-e.x,dy:tgt.y-e.y,visible:e.x>camX+40&&e.x<camX+viewW-40&&e.y>camY+40&&e.y<camY+viewH-40});
    if(act==='windup-charge'||act==='windup-rock'){e.ditch.rootX=e.x;e.ditch.rootY=e.y}
    if(act==='rock-fire')fireDitchRocks(e);
    if(act)cb.event?.({type:'ditchPhase',phase:act,mode:e.ditch.mode,time:duration-time,index:e.poolIndex})}
   if(e.critter){const act=stepCritter(e.critter,dt,{alive:e.hp>0,playerAlive:p.hp>0,dx:tgt.x-e.x,dy:tgt.y-e.y,visible:e.x>camX+30&&e.x<camX+viewW-30&&e.y>camY+30&&e.y<camY+viewH-30});if(act)cb.event?.({type:'critterPhase',phase:act,time:duration-time,index:e.poolIndex})}
   if(e.jit){const action=stepJitter(e.jit,dt,{alive:e.active&&e.hp>0,playerAlive:p.hp>0,dist:distance(p,e),targetDx:p.x-e.x,visible:e.x-JITTER.radius>=camX&&e.x+JITTER.radius<=camX+viewW&&e.y-JITTER.radius>=camY&&e.y+JITTER.radius<=camY+viewH});
    if(action==='charge'){e.jit.rootX=e.x;e.jit.rootY=e.y}
    if(action==='fire'){if(jitterPulseHits(e.jit,distance(p,e),p.inv)){damagePlayer(JITTER.damage*enemyDamageMultiplier(run.wave,e.elite));p.inv=.55}novaSparks(e.x,e.y);sfx('spark')}
   }
   // MACROBEND BEAST: state-machine step; 'coil' saves the root pose, 'fire'
   // releases the ring from the same spot. Rooted through coil AND recovery.
   if(e.mac&&(!e.campCast||e.campCast.phase==='chase')){const act=stepBend(e.mac,dt,{alive:e.active&&e.hp>0,playerAlive:p.hp>0,dist:distance(p,e),visible:e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40,targetDx:p.x-e.x});
    if(act==='coil'){e.mac.rootX=e.x;e.mac.rootY=e.y;cb.event?.({type:'macrobendCoil',time:duration-time,index:e.poolIndex,x:e.x,y:e.y})}
    if(act==='fire')bendRing(e)}
   // PACKET-LOSS PUDDING cast: within range + on screen + cooldown ready →
   // root in place for the 1s telegraph (drop spot saved at cast start), then
   // collapse into a puddle at that exact spot and instantly resume chasing.
   if(e.pud){const foot=puddingFootPoint(puddingArt,e.x,e.y),act=stepPuddingState(e.pud,dt,{dist:distance(p,e),visible:e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40,playerAlive:p.hp>0,x:foot.x,y:foot.y});
    if(act==='start'){e.pud.rootX=e.x;e.pud.rootY=e.y;e.anim.dropX=e.pud.dropX;e.anim.dropY=e.pud.dropY;cb.event?.({type:'puddingCharge',time:duration-time,index:e.poolIndex,x:e.x,y:e.y,dropX:e.pud.dropX,dropY:e.pud.dropY})}
    if(act==='drop'){spawnPuddle(e.pud.dropX,e.pud.dropY);e.anim.dropT=.25}
    e.anim.telegraph=e.pud.phase==='telegraph'}
   if(e.pud&&e.pud.phase!=='chase')spd=0 // rooted during the telegraph
   // REPEAT PETE clone pulse: root-free — Pete keeps walking while the ring
   // telegraph plays; one independent mini per pulse, only under the cap.
   if(e.kind==='pete'&&e.cloneT>0){e.cloneT-=dt;if(e.cloneT<=0){e.cloneT=PETE.cloneInterval;let minis=0;for(let i=0;i<enemies.items.length;i++){const o=enemies.items[i];if(o.active&&o.kind==='peteMini')minis++}
    if(minis<PETE.miniCap&&p.hp>0){if(spawnPeteMini(e)){if(e.anim)e.anim.special=1.2}else e.cloneT=.25}}}
   // CLIENT ESCALATION (Repeat Pete): 0.9s rooted shout telegraph, then a
   // small-radius shockwave — and the 30s duplicate pulse fires early.
   if(e.kind==='pete'){e.shoutCd=Math.max(0,e.shoutCd-dt);
    if(e.shoutT>0){e.shoutT=Math.max(0,e.shoutT-dt);
     if(e.shoutT<=0){const lands=p.inv<=0&&distance(p,e)<PETE.shockwave.radius;
      if(lands){damagePlayer(e.damage);p.inv=.55}
      e.cloneT=Math.min(e.cloneT,PETE.shockwave.earlyPulse);e.shoutCd=PETE.shockwave.cooldown;addShake(5);particle(e.x,e.y,'#f472b6',lowFx?4:12);
      cb.event?.({type:'peteShout',time:duration-time,hit:lands,x:e.x,y:e.y,radius:PETE.shockwave.radius})}}
    else if(e.shoutCd<=0&&distance(p,e)<PETE.shockwave.range){e.shoutT=PETE.shockwave.telegraph;cb.event?.({type:'peteShoutTelegraph',time:duration-time,x:e.x,y:e.y})}}
   for(let k=0;k<activeStructs.length;k++){const st=activeStructs[k];if(!st.active)continue;const def=st.stats||STRUCTURES[st.type];if(!def)continue;
    if(def.kind==='block'){const dx=e.x-st.x,dy=e.y-st.y,sd=Math.hypot(dx,dy),min=st.r+e.r;if(sd<min){const push=(min-sd)*.55;e.x+=dx/(sd||1)*push;e.y+=dy/(sd||1)*push}}
    else if(def.kind==='trap'&&st.rearm<=0&&st.uses>0){const sd=Math.hypot(e.x-st.x,e.y-st.y);if(sd<st.r+e.r){st.rearm=.7;st.uses--;hit(e,def.chomp*(1+.2*(st.power-1)),'#f87171',false);const ba=Math.atan2(e.y-st.y,e.x-st.x);e.x+=Math.cos(ba)*22;e.y+=Math.sin(ba)*22;sfx('snip');if(st.uses<=0){particle(st.x,st.y,'#f87171',lowFx?2:6);structures.release(st);structCount--}}}
    else if(def.kind==='slow'){if(Math.hypot(e.x-st.x,e.y-st.y)<st.r)slowMul=Math.min(slowMul,1-(def.slow+.05*(st.power-1)))}}
   if(e.pud&&e.pud.phase==='telegraph'){e.x=e.pud.rootX;e.y=e.pud.rootY}
   if(e.jit&&e.jit.phase!=='chase'){e.x=e.jit.rootX;e.y=e.jit.rootY}
   if(e.mac&&e.mac.phase!=='chase'){e.x=e.mac.rootX;e.y=e.mac.rootY}
   if(e.ditch&&(e.ditch.phase==='windup'||e.ditch.phase==='dig')){e.x=e.ditch.rootX;e.y=e.ditch.rootY}
   if(e.sq&&(!e.campCast||e.campCast.phase==='chase'))({a,spd}=squirrelUpdate(e,dt));
   const campBusy=(e.ditch&&e.ditch.phase!=='chase')||(e.mac&&e.mac.phase!=='chase')||(e.sq&&(e.sq.wind>0||e.sq.cast>0||e.sq.pounceT>0||e.sq.leapT>0||e.sq.recover>0))||e.shoutT>0||e.novaT>0;
   if(e.campCast&&!campBusy){const cast=e.campCast;cancelHiddenCharge(cast,{x:camX,y:camY,width:viewW,height:viewH},45,65,45);const visible=e.x>camX+45&&e.x<camX+viewW-45&&e.y>camY+65&&e.y<camY+viewH-45;
    if((camp.active&&!meeting.active)||cast.phase!=='chase'){const act=stepCone(cast,e.campConfig,dt,{alive:e.hp>0,playerAlive:p.hp>0,x:e.x,y:e.y,tx:tgt.x,ty:tgt.y,shortSide:Math.min(viewW,viewH),visible});
     if(act==='release'){const lands=consumeConeHit(cast,p.x,p.y,p.inv);if(lands){damagePlayer(cast.damage);p.inv=.55}cb.event?.({type:'campCone',kind:e.kind,hit:lands,time:duration-time})}}
   }
   if(charId==='isr')slowMul=outageMovement(specialTimer,p.hp,slowMul);
   const velocity=e.novaT>0||e.shoutT>0?{x:0,y:0}:e.campCast&&e.campCast.phase!=='chase'?{x:0,y:0}:e.ditch?ditchVelocity(e.ditch,a,spd*slowMul,slowMul):e.elite&&camp.active&&!meeting.active&&!campBusy&&!e.caster?campVelocity(e,tgt,spd*slowMul,Math.min(viewW,viewH)):e.caster?casterVelocity(e.caster,e.boss?ROUTER_ATTACK:APPARITION,a,spd*slowMul,distance(p,e),Math.min(viewW,viewH)):e.critter?critterVelocity(e.critter,a,spd*slowMul,slowMul):e.mac?bendVelocity(e.mac,a,spd*slowMul):e.jit?jitterVelocity(e.jit,a,spd*slowMul):{x:Math.cos(a)*spd*slowMul,y:Math.sin(a)*spd*slowMul};
   const mvx=velocity.x,mvy=velocity.y;
   if(cb.inspect&&charId==='isr')e.outageMotion={x:mvx,y:mvy,slow:slowMul};
   const preX=e.x,preY=e.y;
   e.x+=mvx*dt;e.y+=mvy*dt;
   // BOSS ANTI-PIN: a boss (Squirrel/Pete/R.O.U.S.) that tries to move but
   // barely moves for 1.5s — wedged on a wall or barricade — spends a short
   // sidestep burst perpendicular to its heading, flipped into the arena, and
   // then reacquires the player. The three heavies cannot be pinned in place.
   if(e.pin&&stepPin(e.pin,dt,mvx,mvy,e.x-preX,e.y-preY)){const sv=sidestepVelocity(e.pin,mvx,mvy,(Math.hypot(mvx,mvy)||e.speed)*PIN.sidestepBoost,W/2,H/2,e.x,e.y);e.x=preX+sv.x*dt;e.y=preY+sv.y*dt}
   if(e.caster){e.caster.vx=mvx;e.caster.vy=mvy;if(e.caster.phase==='chase'){const m=e.boss?60:40;e.x=clamp(e.x,camX+m,camX+viewW-m);e.y=clamp(e.y,camY+(e.boss?100:m),camY+viewH-(e.boss?16:m))}else{e.x=e.caster.x;e.y=e.caster.y}}
   if(e.critter&&e.critter.phase==='lunge')clampCritterLunge(e,{x:camX,y:camY,width:viewW,height:viewH});
   if(e.ditch&&e.ditch.phase==='charge')clampDitchBounds(e,{x:camX,y:camY,width:viewW,height:viewH});
   // SQUIRREL RETREAT BOUNDS: phase-2 flee must keep the boss's full body and
   // collider inside the logical viewport — no clipping offscreen to hide.
   if(e.sq&&e.sq.phase===2){e.x=clamp(e.x,camX+e.r+6,camX+viewW-e.r-6);e.y=clamp(e.y,camY+e.r+6,camY+viewH-e.r-6)}
   if(e.anim){if(e.art===puddingArt)updatePuddingAnimation(e.anim,mvx,mvy,dt,pudArtDef.definition);else if(e.art===blobArtDef){e.anim.special=Math.max(0,e.anim.special-dt);updateTechAnimation(e.anim,mvx*dt,mvy*dt,dt,blobArtDef.definition)}
    else if(petArt&&(e.kind==='pete'||e.kind==='peteMini')){e.anim.special=Math.max(0,e.anim.special-dt);updateTechAnimation(e.anim,mvx*dt,mvy*dt,dt,petArt.definition)}
    else if(e.mac&&bendArtDef)updateBendAnimation(e.anim,mvx,mvy,dt,e.mac)
    else updateLagAnimation(e.anim,mvx*dt,mvy*dt,dt,lagArt.definition)}
   else if(e.sq)updateSquirrelAnimation(e.sq,mvx,mvy,dt,sqArt.definition)
   if(separate&&(!e.campCast||e.campCast.phase==='chase')&&(!e.caster||e.caster.phase==='chase')&&(!e.ditch||e.ditch.phase==='chase')&&(!e.critter||e.critter.phase==='chase')&&(!e.jit||e.jit.phase==='chase')&&(!e.pud||e.pud.phase==='chase')&&(!e.mac||e.mac.phase==='chase')){queryShot=e;grid.visit(e.x,e.y,e.r+28,separateVisitor)}
   if(distance(p,e)<p.r+e.r&&p.inv<=0&&(!e.ditch||ditchContactReady(e.ditch))&&(!e.critter||critterContactReady(e.critter))&&(!e.jit||e.jit.phase==='chase')){if(e.ditch&&e.ditch.phase==='charge'){e.ditch.struck=true;cb.event?.({type:'ditchStrike',time:duration-time,index:e.poolIndex})}if(e.critter&&e.critter.phase==='lunge'){e.critter.struck=true;cb.event?.({type:'critterStrike',time:duration-time,index:e.poolIndex})}if(e.jit&&e.jit.phase==='chase'){e.jit.melee=1/3;e.jit.facing=p.x<e.x?'left':'right'}if(e.anim){if(e.kind==='packet'){e.anim.melee=.34;e.anim.facing=p.x<e.x?'left':'right'}else e.anim.attack=.35}
   // IN A MEETING: contact damage is declined (no i-frames consumed); enemy
   // novas, cast rings, boss pellets and goo hazards still hurt normally.
   if(meeting.active){/* declined */}
   else if(run.firstHitBlocked&&!firstBlockUsed){firstBlockUsed=true;cb.flash('FIRST HIT POLITELY DECLINED');p.inv=.55}
   else{damagePlayer(e.damage);p.inv=.55}}}
  for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(!d.active)continue;const dd=distance(p,d);if(dd<120*(run.character.pickupScale||1)){d.x+=(p.x-d.x)*dt*7;d.y+=(p.y-d.y)*dt*7}if(dd<p.r+10){signal+=d.value;earnedSignal+=d.value;xp+=d.value*TUNING.xpPickupFactor;xpEarnedWave+=d.value*TUNING.xpPickupFactor;sfx('pickup');pickups.release(d);while(xp>=signalForLevel(run.level+levels)){xp-=signalForLevel(run.level+levels);levels++;sfx('level');cb.flash('SIGNAL LEVEL UP!')}}}
  for(let i=0;i<wrecks.items.length;i++){const w=wrecks.items[i];if(!w.active)continue;w.t+=dt;if(w.t>=w.dur)wrecks.release(w)}
  for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(!q.active)continue;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;if(q.life<=0)particles.release(q)}for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;n.y-=25*dt;n.life-=dt;if(n.life<=0)numbers.release(n)}if(soundClock<=0){for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active){sfx(e.sound);break}}soundClock=.35+Math.random()*.35}
  if((p.hp<=0||time<=0)&&!over){over=true;if(charId==='isr')clearOutage();
  // DEATH SEQUENCE: on a player defeat the Admin plays his 6th-row collapse
  // strip briefly (any key skips it) before the unchanged game-over flow.
  if(characterArt&&characterArt.definition.deathColumns&&p.hp<=0){dying=DEATH_HOLD;sfx('death');cb.event?.({type:'deathSequence',time:duration-time})}
  else{sfx(p.hp<=0?'death':'clear');complete(p.hp>0)}}
  hudClock-=dt;if(hudClock<=0){let boss=null;for(let i=0;i<enemies.items.length;i++){const b=enemies.items[i];if(b.active&&(b.sq||b.kind==='rous')){boss={name:b.kind==='rous'?ROUS.name:SQUIRREL.name,hp:Math.max(0,b.hp),max:b.max,phase:b.sq?.phase||1};break}}const depList=run.deployables||[],depIdx=depList.length?Math.min(Math.max(0,input.current.deploySel||0),depList.length-1):0;cb.hud({hp:p.hp,maxHp:p.maxHp,time:Math.max(0,time),signal,earnedSignal,xp,xpTarget:signalForLevel(run.level+levels),level:run.level+levels,kills,boss,specialUnlocked:true,specialCooldown,specialName:run.character.special.name,characterId:charId,specialRemaining:(charId==='isr'||charId==='admin')?specialTimer:0,fps:Math.round(fps),stress,...(cb.simulation||run.coop?{position:{x:p.x,y:p.y}}:{}),viewport:{...viewport},weaponRanges:run.weapons.map(w=>effectiveRange(weaponOf(w),run,viewport)),signatureReach:signatureWeapon?effectiveRange(signatureWeapon,run,viewport):0,
   deploy:depList.length?{items:depList.map((d,i)=>({icon:d.icon,name:d.name,stacks:d.stacks,cd:deployCds[d.structure]||0,cdMax:deployCdMax(d,deployStats(d)),selected:i===depIdx})),structures:structCount,cap:structCap(),blocked:placeBlocked}:null});hudClock=.1}
  // Opt-in automated-test observation only; GameArena supplies neither callback.
  if(cb.inspect)cb.inspect({time:duration-time,player:{...p},slow:puddleSlowMul,specialTimer,specialCooldown,healed,kills,clauseFired,damageDealt,camX,camY,meeting:meeting.active?{x:meeting.x,y:meeting.y,timer:specialTimer,radius:MEETING.blastRadius}:null,dying,
   ...(run.character.special.id==='surge'?{surge:{active:surge.active,x:surge.x,y:surge.y,pulse:surge.pulse,elapsed:surgeTotal()-specialTimer,rings:surge.rings.length},sentries:turrets.items.filter(t=>t.active).map(t=>({index:t.poolIndex,wid:t.wid,hp:t.hp,maxHp:t.maxHp,haste:t.haste})),posts:structures.items.filter(s=>s.active).map(s=>({type:s.type,haste:s.haste,life:s.life}))}:{}),...(charId==='isr'?{enemies:enemies.items.filter(e=>e.active).map(e=>({index:e.poolIndex,kind:e.kind,x:e.x,y:e.y,speed:e.speed,boss:e.boss,hp:e.hp,motion:e.outageMotion})),shots:shots.items.filter(s=>s.active).map(s=>({id:s.id,originX:s.originX,originY:s.originY,vx:s.vx,vy:s.vy})),sprite:{...spriteState}}:{}),puddles:puddles.items.filter(d=>d.active).map(d=>({...d})),puddings:enemies.items.filter(e=>e.active&&e.pud).map(e=>({index:e.poolIndex,x:e.x,y:e.y,hp:e.hp,cast:{...e.pud}})),
  petes:enemies.items.filter(e=>e.active&&(e.kind==='pete'||e.kind==='peteMini')).map(e=>({index:e.poolIndex,kind:e.kind,x:e.x,y:e.y,hp:e.hp,max:e.max,speed:e.speed,damage:e.damage,cloneT:e.cloneT})),
  casters:enemies.items.filter(e=>e.active&&e.caster).map(e=>({index:e.poolIndex,kind:e.kind,x:e.x,y:e.y,cast:{...e.caster}})),
  critters:enemies.items.filter(e=>e.active&&e.critter).map(e=>({index:e.poolIndex,x:e.x,y:e.y,cast:{...e.critter}})),
  ditchWitches:enemies.items.filter(e=>e.active&&e.ditch).map(e=>({index:e.poolIndex,x:e.x,y:e.y,hp:e.hp,max:e.max,speed:e.speed,damage:e.damage,r:e.r,cast:{...e.ditch}})),
  bends:enemies.items.filter(e=>e.active&&e.mac).map(e=>({index:e.poolIndex,x:e.x,y:e.y,hp:e.hp,max:e.max,speed:e.speed,damage:e.damage,cast:{...e.mac}})),
  rings:foeShots.items.filter(s=>s.active&&s.ring).map(s=>({x:s.x,y:s.y,remaining:s.remaining,damage:s.damage})),
  rocks:foeShots.items.filter(s=>s.active&&s.rock).map(s=>({x:s.x,y:s.y,remaining:s.remaining,damage:s.damage,r:s.r})),
  wrecks:wrecks.items.filter(w=>w.active).map(w=>({x:w.x,y:w.y,t:w.t,dur:w.dur,facing:w.facing})),
  foes:enemies.items.filter(e=>e.active).slice(0,40).map(e=>({index:e.poolIndex,kind:e.kind,x:e.x,y:e.y,hp:e.hp,radius:e.r}))});
 }
 // Silly-but-mandated accessories: every turret and structure gets a hard hat
 // and googly eyes (pupils track whatever it's currently aiming at).
 function drawHardHat(x,y){ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(x,y,7,Math.PI,0);ctx.fill();ctx.fillRect(x-8,y-1,16,2)}
 function drawEyes(x,y,a){const px=Math.cos(a)*1.5,py=Math.sin(a)*1.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-4,y,3.2,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+4,y,3.2,0,7);ctx.fill();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x-4+px,y+py,1.5,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+4+px,y+py,1.5,0,7);ctx.fill()}
 function drawTelegraphRing(x,y,r,frac){ctx.save();ctx.globalAlpha=.12+frac*.3;ctx.fillStyle='#fca5a5';ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),r,0,7);ctx.fill();ctx.globalAlpha=.35+frac*.45;ctx.strokeStyle='#f87171';ctx.lineWidth=2;ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),r,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
 function drawTurretBody(x,y,color,a,r){ctx.strokeStyle='#475569';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-r,y+r);ctx.moveTo(x,y);ctx.lineTo(x+r,y+r);ctx.moveTo(x,y);ctx.lineTo(x,y+r);ctx.stroke();ctx.fillStyle='#334155';ctx.fillRect(x-r+2,y-r+2,r*2-4,r*2-6);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*(r+6),y+Math.sin(a)*(r+6));ctx.stroke();drawHardHat(x,y-r+2);drawEyes(x,y,a)}
 function draw(){
  const sx=Math.round((Math.random()-.5)*shakeMag),sy=Math.round((Math.random()-.5)*shakeMag);
  const zoom=dpr*scale;
  ctx.setTransform(zoom,0,0,zoom,Math.round((sx-camX)*zoom),Math.round((sy-camY)*zoom));
  ctx.fillStyle='#172d32';ctx.fillRect(camX-24,camY-24,viewW+48,viewH+48);
  ctx.strokeStyle='rgba(83,211,190,.08)';ctx.lineWidth=1;for(let x=Math.floor(camX/48)*48;x<camX+viewW;x+=48){ctx.beginPath();ctx.moveTo(x,camY-24);ctx.lineTo(x,camY+viewH+24);ctx.stroke()}for(let y=Math.floor(camY/48)*48;y<camY+viewH;y+=48){ctx.beginPath();ctx.moveTo(camX-24,y);ctx.lineTo(camX+viewW+24,y);ctx.stroke()}
  // Pre-scaled world bitmap, beneath every pickup, hazard, structure and actor.
  if(arenaFloor)ctx.drawImage(arenaFloor,0,0);
  ctx.strokeStyle='rgba(103,232,249,.25)';ctx.lineWidth=2;ctx.strokeRect(0,0,W,H);
  if(areaFx.life>0){ctx.save();if(areaFx.limit!==Infinity){ctx.beginPath();ctx.arc(Math.round(areaFx.originX),Math.round(areaFx.originY),areaFx.limit,0,Math.PI*2);ctx.clip()}ctx.globalAlpha=areaFx.life/.12*.4;ctx.strokeStyle=areaFx.color;ctx.lineWidth=2;ctx.beginPath();const x=Math.round(areaFx.x),y=Math.round(areaFx.y);if(areaFx.half<Math.PI)ctx.moveTo(x,y);ctx.arc(x,y,areaFx.reach,areaFx.angle-areaFx.half,areaFx.angle+areaFx.half);if(areaFx.half<Math.PI)ctx.closePath();ctx.stroke();ctx.restore()}
  ctx.fillStyle='#67e8f9';for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(d.active&&d.x>camX-8&&d.x<camX+viewW+8&&d.y>camY-8&&d.y<camY+viewH+8)ctx.fillRect(Math.round(d.x)-4,Math.round(d.y)-4,8,8)}
  // PACKET-LOSS PUDDING ground goo: translucent flattened goo + cyan packet
  // glints, ground-anchored at the saved drop spot, drawn under all actors.
  for(let i=0;i<puddles.items.length;i++){const d=puddles.items[i];if(!d.active||!pudArtDef||d.x<camX-140||d.x>camX+viewW+140||d.y<camY-90||d.y>camY+viewH+90)continue;drawGroundPuddle(ctx,puddingArt,d)}
  // MEETING INVITE world object: the exact blast-radius ground telegraph
  // (subtle fill + dashed ring, drawn for the whole 4s) and the round table
  // with its empty chairs, hard hat and googly eyes (structure convention).
  for(const enemy of enemies.items){if(!enemy.active)continue;if(enemy.campCast)drawCampCone(ctx,enemy.campCast);if(enemy.ditch)drawDitchTelegraph(ctx,enemy.ditch,enemy.x,enemy.y)}
  // Boss close-range answers: pulsing dashed rings sized to the exact effect
  // radius, so the dodge read is honest at all zoom levels.
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(!e.active)continue;
   if(e.sq&&e.sq.pounceT>0)drawTelegraphRing(e.x,e.y,SQUIRREL.pounce.impactRadius,e.sq.pounceT/SQUIRREL.pounce.telegraph);
   else if(e.shoutT>0)drawTelegraphRing(e.x,e.y,PETE.shockwave.radius,e.shoutT/PETE.shockwave.telegraph);
   else if(e.novaT>0)drawTelegraphRing(e.x,e.y,ROUS.nova.radius,e.novaT/ROUS.nova.telegraph);}
  if(meeting.active){const tx=Math.round(meeting.x),ty=Math.round(meeting.y),tr=MEETING.tableRadius;
   ctx.save();ctx.globalAlpha=.07;ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(tx,ty,MEETING.blastRadius,0,7);ctx.fill();
   ctx.globalAlpha=.34;ctx.strokeStyle='#fde68a';ctx.lineWidth=2;ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(tx,ty,MEETING.blastRadius,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore();
   ctx.fillStyle='#4a2f14';ctx.beginPath();ctx.arc(tx,ty,tr,0,7);ctx.fill();
   ctx.fillStyle='#8b5a2b';ctx.beginPath();ctx.arc(tx,ty,tr-5,0,7);ctx.fill();
   for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6,cx2=tx+Math.cos(a)*(tr+13),cy2=ty+Math.sin(a)*(tr+13);ctx.fillStyle='#92400e';ctx.fillRect(Math.round(cx2-6),Math.round(cy2-10),12,14);ctx.fillStyle='#3f2410';ctx.fillRect(Math.round(cx2-4),Math.round(cy2-16),8,6)}
   drawHardHat(tx,ty-tr-4);drawEyes(tx,ty-tr*.25,Math.atan2(p.y-ty,p.x-tx))}
   // FIBER SPLICE SURGE world object: arming telegraph, expanding pulse rings,
   // then the splice cabinet itself (hard hat + googly eyes, structure convention).
   if(surge.active){const sx2=Math.round(surge.x),sy2=Math.round(surge.y),elapsed=surgeTotal()-specialTimer;
   if(elapsed<SURGE.arming){const pr=elapsed/SURGE.arming;ctx.save();ctx.globalAlpha=.2+pr*.25;ctx.strokeStyle='#7fe6f9';ctx.lineWidth=2;ctx.setLineDash([12,9]);ctx.beginPath();ctx.arc(sx2,sy2,SURGE.ringRadius*pr,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
   for(const r of surge.rings){const pr=Math.min(1,r.t/(SURGE.pulseWindow/SURGE.pulses));ctx.save();ctx.globalAlpha=.55*(1-pr);ctx.strokeStyle='#7fe6f9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(Math.round(r.x),Math.round(r.y),Math.max(2,SURGE.ringRadius*pr),0,7);ctx.stroke();ctx.restore()}
   ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#7fe6f9';ctx.beginPath();ctx.arc(sx2,sy2,20,0,7);ctx.fill();ctx.restore();
   const cabArt=cabinetArt&&cabinetArt.idle&&cabinetArt.active?cabinetArt:null;
   if(cabArt){ // user-supplied splice-cabinet sprites: idle through the
    // arming beat, active while the four pulses fire, then idle fading out —
    // bottom anchored on the planted point like every other deployable
    const pulsesDone=surge.pulse>=SURGE.pulses,img=pulsesDone||elapsed<SURGE.arming?cabArt.idle:cabArt.active;
    const ch2=Math.round(72),cw2=Math.round(72*img.width/img.height);
    ctx.save();if(pulsesDone)ctx.globalAlpha=Math.max(0,Math.min(1,specialTimer/.4));
    const prevSm=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(img,sx2-cw2/2,sy2-ch2,cw2,ch2);ctx.imageSmoothingEnabled=prevSm;ctx.restore();
   }else{
   ctx.fillStyle='#0f3d46';ctx.fillRect(sx2-16,sy2-26,32,26);
   ctx.fillStyle='#155e6b';ctx.fillRect(sx2-13,sy2-23,26,20);
   ctx.fillStyle='#7fe6f9';ctx.fillRect(sx2-3,sy2-14,6,10);
   drawHardHat(sx2,sy2-30);drawEyes(sx2,sy2-18,Math.atan2(p.y-sy2,p.x-sx2));}}
  // structures (under enemies): pop-in scale, fade out during the last 1.5s of life
  for(let i=0;i<structures.items.length;i++){const st=structures.items[i];if(!st.active)continue;const def=st.stats||STRUCTURES[st.type];if(!def)continue;const x=Math.round(st.x),y=Math.round(st.y),grow=Math.min(1,st.born*4);
   ctx.globalAlpha=(st.life<1.5?Math.max(.2,st.life/1.5):1)*(.4+.6*grow);
   if(def.kind==='turret'){ // Bucket-Truck Keys items render ONLY with the
    // truck renderer; weapon-deployed turrets keep the pedestal pack.
    if(truckArt&&truckDef&&st.type===truckDef.structureType)drawTruckTurret(ctx,truckArt,st.born,x,y,grow,st.lookA)
    else if(pedArt)drawPedestalTurret(ctx,pedArt,st,x,y,grow)
    else drawTurretBody(x,y,def.color,st.lookA,13*grow+3)}
   else if(def.kind==='block'){
    // Traffic Barricade: the user-supplied striped A-frame sprite, bottom
    // anchored on the structure point; the procedural stripes stay as the
    // asset-free fallback for offline harnesses.
    if(barricadeArt){const bw=Math.round(48),bh=Math.round(48*barricadeArt.height/barricadeArt.width);const prevSm=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;ctx.drawImage(barricadeArt,x-bw/2,y-bh,bw,bh);ctx.imageSmoothingEnabled=prevSm}
    else{ctx.fillStyle='#fb923c';ctx.fillRect(x-st.r,y-8,st.r*2,16);ctx.fillStyle='#fff';for(let k=0;k<4;k++)ctx.fillRect(x-st.r+6+k*12,y-8,5,16);drawHardHat(x,y-14);drawEyes(x,y-2,st.lookA)}}
   else if(def.kind==='trap'){ctx.fillStyle='#525252';ctx.fillRect(x-14,y-8,28,14);ctx.fillStyle='#ef4444';for(let k=0;k<5;k++){ctx.fillRect(x-12+k*6,y-8,3,6);ctx.fillRect(x-9+k*6,y-2,3,6)}drawHardHat(x,y-16);drawEyes(x,y-4,st.lookA)}
   else if(def.kind==='slow'){ctx.fillStyle='rgba(34,211,238,.12)';ctx.beginPath();ctx.arc(x,y,st.r*grow,0,7);ctx.fill();ctx.strokeStyle='rgba(103,232,249,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,st.r*.66*grow,0,4.6);ctx.stroke();drawEyes(x,y,st.lookA)}
   else if(def.kind==='buff'){ctx.fillStyle='rgba(250,204,21,.10)';ctx.beginPath();ctx.arc(x,y,st.r*grow,0,7);ctx.fill();ctx.fillStyle='#a8a29e';ctx.fillRect(x-12,y,24,10);ctx.fillRect(x-8,y-8,16,8);drawHardHat(x,y-12);drawEyes(x,y-2,st.lookA)}
   ctx.globalAlpha=1}
   // REJECTED-PLACEMENT PREVIEW: a red dashed exclusion ring at the
   // technician's feet while the selected deployable cannot legally go there.
   if(placeBlocked){const bx=Math.round(p.x),by=Math.round(p.y);ctx.save();ctx.globalAlpha=.1;ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(bx,by,PLACE_PROXIMITY,0,7);ctx.fill();ctx.globalAlpha=.85;ctx.strokeStyle='#f87171';ctx.lineWidth=2;ctx.setLineDash([9,7]);ctx.beginPath();ctx.arc(bx,by,PLACE_PROXIMITY,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
  for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(!t.active)continue;const grow=Math.min(1,t.born*4);ctx.globalAlpha=t.life<1?Math.max(.2,t.life):1;
   if(t.mode==='helper'){ // Don's crew: the four extracted individual crew
    // sprites while his special runs (local or co-op ally Don); placeholder is
    // the mutually exclusive fallback (asset failure), never drawn alongside.
    const donArt=(run.character.id==='don'?characterArt:null)||loadedCharacterSprite('don');
    if(donArt&&donArt.crewInd&&(run.coop||(run.character.id==='don'&&specialTimer>0)))drawCrewHelper(ctx,donArt,t);else drawHelper(ctx,Math.round(t.x),Math.round(t.y),t.color)}
   else if(t.weaponTurret&&pedArt)drawPedestalTurret(ctx,pedArt,t,Math.round(t.x),Math.round(t.y),grow); // weapon-deployed turrets share the splice-pedestal pack
   else drawTurretBody(Math.round(t.x),Math.round(t.y),t.color,t.lookA,t.r*grow+3);ctx.globalAlpha=1}
  for(let i=0;i<wrecks.items.length;i++){const w=wrecks.items[i];if(w.active&&ditchArt)drawDitchWitch(ctx,ditchArt,{phase:'dying',facing:w.facing,deathProgress:w.t/w.dur,vfxT:0},w.x,w.y,false)}
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&e.art&&e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40){if(e.ditch)drawDitchWitch(ctx,e.art,e.ditch,e.x,e.y,e.ditch.phase==='chase');else if(e.caster)drawConeEnemy(ctx,e.art,e.caster,e.x,e.y);else if(e.critter)drawCrosstalk(ctx,critterArt,e.critter,e.x,e.y);else if(e.jit)drawJitterSprite(ctx,jitterArt,e.jit,e.x,e.y,e.jit.phase==='chase');else if(e.art===puddingArt)drawPuddingSprite(ctx,puddingArt,e.anim,e.x,e.y);else if(e.art===blobArtDef)drawTechEnemy(ctx,e.art,e.anim,e.x,e.y);else if(petArt&&(e.kind==='pete'||e.kind==='peteMini'))drawTechEnemy(ctx,petArt,e.anim,e.x,e.y,e.kind==='peteMini'?PETE.miniScale:1);else if(e.mac&&bendArtDef)drawBendSprite(ctx,bendArtDef,e.anim,e.x,e.y);else drawLagSprite(ctx,e.art,e.anim,e.x,e.y)}}
  for(let k=0;k<TYPES.length;k++){const kind=TYPES[k];for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&!e.art&&e.kind===kind&&e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40)ctx.drawImage(e.sprite,Math.round(e.x-e.sprite.width/2),Math.round(e.y-e.sprite.height/2))}}
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&e.sq&&e.x>camX-90&&e.x<camX+viewW+90&&e.y>camY-90&&e.y<camY+viewH+90)drawSquirrelSprite(ctx,e.sq.art,e.sq,e.x,e.y)}
  for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(s.active&&s.x>camX-28&&s.x<camX+viewW+28&&s.y>camY-28&&s.y<camY+viewH+28)drawProjectile(ctx,s)}
  for(let i=0;i<foeShots.items.length;i++){const s=foeShots.items[i];if(s.active&&s.x>camX-28&&s.x<camX+viewW+28&&s.y>camY-28&&s.y<camY+viewH+28){if(s.rock)drawDitchRock(ctx,ditchArt,s);else if(s.ring&&bendArtDef)drawBendRing(ctx,bendArtDef,s);else drawProjectile(ctx,s)}}
  for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(q.active&&q.x>=camX&&q.x<=camX+viewW&&q.y>=camY&&q.y<=camY+viewH){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(Math.round(q.x),Math.round(q.y),3,3)}}ctx.globalAlpha=1;
  for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;ctx.fillStyle=n.crit?'#fde047':'#fff';ctx.font=n.crit?'bold 18px Chivo':'bold 13px Chivo';ctx.fillText(n.value,Math.round(n.x),Math.round(n.y))}
  if(run.coop)drawCoopPeers(ctx,run);
  const px=Math.round(p.x),py=Math.round(p.y);
  const drawX=specialTimer>0&&run.character.id==='nomad'?p.x+Math.sin(performance.now()*.05)*2:p.x,drawY=specialTimer>0&&run.character.id==='nomad'?p.y+Math.cos(performance.now()*.05)*2:p.y;
  if(charId==='admin'&&dying>0&&characterArt){drawTechDeathFrame(ctx,characterArt,(DEATH_HOLD-dying)/DEATH_HOLD*characterArt.definition.deathColumns,drawX,drawY)}else if(spriteState){if(charId==='isr')drawISR(ctx,characterArt,spriteState,drawX,drawY);else if(run.character.id==='oracle')drawCharacterSprite(ctx,characterArt,spriteState,drawX,drawY);else drawTechSprite(ctx,characterArt,spriteState,drawX,drawY)}else {ctx.fillStyle=run.character.color;ctx.beginPath();ctx.arc(px,py,p.r,0,7);ctx.fill();ctx.fillStyle=run.character.vest;ctx.fillRect(px-14,py+2,28,16);ctx.fillStyle=run.character.belt;ctx.fillRect(px-15,py+11,30,5);ctx.fillStyle=run.character.color;ctx.fillRect(px-20,py-17,40,8);ctx.fillStyle='#fff';ctx.fillRect(px-8,py-5,6,7);ctx.fillRect(px+3,py-5,6,7);}if(specialTimer>0){const sid=run.character.special.id;if(sid==='clause'){const ci=Math.min(1,(KNOWLEDGE_DUMP.total-specialTimer)/KNOWLEDGE_DUMP.charge);
   // Radius telegraph: translucent filled circle + dashed ring at the exact
   // burst radius, following him (he creeps at 30% speed during charge —
   // not rooted). The ring brightens and pulses over the final second to
   // read "locked in"; it pops the moment the burst fires.
   if(!clauseFired){const lock=Math.min(1,Math.max(0,1.5-specialTimer));
    ctx.save();ctx.globalAlpha=.09+ci*.06+lock*.04;ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(px,py,CLAUSE_RADIUS,0,7);ctx.fill();
    ctx.globalAlpha=.3+lock*.4+(lock>0?Math.sin(performance.now()*.025)*.08*lock:0);ctx.strokeStyle='#fde047';ctx.lineWidth=2;ctx.setLineDash([12,9]);ctx.beginPath();ctx.arc(px,py,CLAUSE_RADIUS,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
   if(!clauseFired){ctx.save();ctx.globalAlpha=.2+ci*.3;ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(px,py-20,28+ci*15,0,7);ctx.fill();ctx.restore()}}else if(sid==='cash'){ctx.save();ctx.globalAlpha=.25+Math.sin(performance.now()*.01)*.05;ctx.fillStyle='#22c55e';ctx.beginPath();ctx.arc(px,py-20,25,0,7);ctx.fill();ctx.restore()}else if(sid==='sprint'){ctx.save();ctx.globalAlpha=.2+Math.sin(performance.now()*.008)*.08;ctx.fillStyle='#22d3ee';ctx.beginPath();ctx.arc(px,py-20,24,0,7);ctx.fill();ctx.restore()}else if(sid!=='outage'){ctx.strokeStyle='#fde047';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,25+Math.sin(performance.now()*.02)*5,0,7);ctx.stroke()}}}
 function key(e){if(dying>0){dying=0;complete(false);return}if(e.key==='F9'){stress=!stress;if(stress){for(let i=0;i<500;i++)spawnEnemy(null,true)}cb.flash(stress?'STRESS MODE: 500 IMPAIRMENTS':'STRESS MODE OFF')}} window.addEventListener('keydown',key);resize();sfx('wave');if(run.wave%5===0)sfx('boss');
 function frame(now){
  if(paused.current){last=now;if(!over||dying>0)raf=requestAnimationFrame(frame);return}
  let delta=Math.min(MAX_DT,(now-last)/1000);last=now;
  slow=Math.max(0,slow-delta);
  const target=slow>0?.1:1;
  timeScale+=(target-timeScale)*Math.min(1,delta*18);
  if(Math.abs(timeScale-target)<.005)timeScale=target;
  delta*=timeScale;
  acc+=delta;while(acc>=STEP&&!over){fixedUpdate(STEP);acc-=STEP}
  if(over&&dying>0){dying=Math.max(0,dying-delta);if(dying<=0)complete(false)} // death strip hold (key skips)
  shakeMag*=Math.exp(-7*delta);if(shakeMag<.05)shakeMag=0;
  if(!cb.simulation)draw();frames++;fpsClock+=delta;if(fpsClock>=1){fps=frames/fpsClock;frames=0;fpsClock=0;lowFx=fps<52;separate=fps>=42}if(!over||dying>0)raf=requestAnimationFrame(frame)
 }raf=requestAnimationFrame(frame);window.addEventListener('resize',resize);
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 return()=>{over=true;if(charId==='isr')clearOutage();cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('keydown',key)}
}