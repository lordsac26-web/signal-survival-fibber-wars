import { ENEMIES, WEAPONS } from '@/game/data/combat';
import { STRUCTURES } from '@/game/data/structures';
import ObjectPool from '@/game/performance/ObjectPool';
import SpatialHash from '@/game/performance/SpatialHash';
import { enemySprite } from '@/game/performance/spriteAtlas';
import { drawProjectile } from '@/game/performance/drawProjectile';
import { sfx } from '@/game/audio';
import { TUNING, signalForLevel, waveDuration, spawnInterval, spawnDoubleChance, maxActiveEnemies } from '@/game/data/tuning';
import { activateSignature } from '@/game/combat/signatures';
import { drawHelper } from '@/game/performance/drawHelper';
import { effectiveRange, updateVisibleViewport, withinReach, areaCanHit } from '@/game/combat/effectiveRange';
import { SIGNATURE_RANGE_WEAPONS } from '@/game/combat/rangeConfig';
import { advanceProjectile, projectileCanHit } from '@/game/combat/projectileTravel';
import { createSpriteAnimation, updateSpriteAnimation, drawCharacterSprite } from '@/game/art/spriteAnimation';
import { createLagAnimation, updateLagAnimation, drawLagSprite } from '@/game/art/enemySpriteAnimation';
import { drawTruckTurret } from '@/game/art/structureSprite';
import { structureSpriteDef } from '@/game/art/characterSprites';
import { SQUIRREL, bossWave } from '@/game/data/bosses';
import { createSquirrelAnimation, updateSquirrelAnimation, drawSquirrelSprite } from '@/game/art/squirrelSpriteAnimation';
import { createDonAnimation, updateDonAnimation, drawDonSprite } from '@/game/art/donSpriteAnimation';

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
export function createSignalEngine(canvas,run,input,cb,paused={current:false},characterArt=null,enemyArt=null,structureArt=null,squirrelArt=null){
 const ctx=canvas.getContext('2d',{alpha:false}),grid=new SpatialHash(96),charId=run.character.id;
 let dpr=Math.min(devicePixelRatio||1,2);
 if(run.character.id==='oracle'&&!characterArt)throw new Error('Oracle art must be preloaded before combat');
 const spriteState=characterArt&&run.character.id==='oracle'?createSpriteAnimation():characterArt&&charId==='don'?createDonAnimation():null;
 const sqArt=squirrelArt&&squirrelArt.definition?squirrelArt:null;
 const lagArt=enemyArt&&enemyArt.definition?enemyArt:null;
 const truckArt=structureArt&&structureArt.definition?structureArt:null,truckDef=truckArt?structureSpriteDef('bucket'):null;
 const viewport={width:1100,height:800},signatureWeapon=SIGNATURE_RANGE_WEAPONS[run.character.special.id];
 const areaFx={life:0,x:0,y:0,reach:0,angle:0,half:Math.PI,color:'#fff',limit:Infinity,originX:0,originY:0};
 const enemies=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,hp:0,r:10,lastShot:-1}));
 const shots=new ObjectPool(320,i=>({poolIndex:i,active:false,x:0,y:0,prevX:0,prevY:0,originX:0,originY:0,maxReach:0,remaining:0,traveled:0,vx:0,vy:0,r:5,life:0,id:0,pen:0,mortar:false,pattern:'projectile',boom:false}));
 const particles=new ObjectPool(300,i=>({poolIndex:i,active:false,x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}));
 const pickups=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,value:1}));
 const numbers=new ObjectPool(48,i=>({poolIndex:i,active:false,x:0,y:0,life:0,value:0,crit:false}));
 const foeShots=new ObjectPool(64,i=>({poolIndex:i,active:false,x:0,y:0,prevX:0,prevY:0,vx:0,vy:0,r:6,remaining:0,traveled:0,life:0,damage:0,color:'#a16207',pattern:'foe'}));
 const turrets=new ObjectPool(48,i=>({poolIndex:i,active:false,x:0,y:0,hp:0,inv:0,r:13,wid:null,mode:'pellet',color:'#f59e0b',life:0,maxLife:1,fireCd:0,fire:.5,damage:10,range:300,born:0,lookA:0,weapon:null}));
 const structures=new ObjectPool(24,i=>({poolIndex:i,active:false,type:null,x:0,y:0,life:0,maxLife:1,r:20,born:0,uses:0,rearm:0,power:1,fireCd:0,lookA:0}));
 const W=1100,H=800;
 let viewW=W,viewH=H,scale=1,camX=0,camY=0,last=performance.now(),acc=0,raf,spawn=0,hudClock=0,soundClock=0,shotId=0,over=false,stress=false,lowFx=false,separate=true,fps=60,fpsClock=0,frames=0,lastNumber=0;
 let slow=0,timeScale=1,shakeMag=0;
 const duration=waveDuration(run.wave);let time=duration,signal=run.signal,earnedSignal=run.earnedSignal||0,kills=run.kills,xp=run.xp||0,levels=0,specialCooldown=run.specialCooldown||0,specialTimer=0,damageDealt=run.damageDealt||0;const killsByType={...(run.killsByType||{})};
 let healed=run.healed||0,damageTaken=run.damageTaken||0,xpEarnedWave=0;const startKills=run.kills,startEarned=run.earnedSignal||0;
 const p={x:0,y:0,r:17,hp:run.hp,maxHp:run.maxHp,inv:0,regen:0};let hurtBoost=0,firstBlockUsed=false;const cooldowns=new Float32Array(run.weapons.length);
 let queryX=0,queryY=0,queryR=0,queryDamage=0,queryColor='#fff',queryShot=null,queryHits=0,queryStruct=null,nearestBest=null,nearestDist=0;
 let queryLimit=Infinity,queryOriginX=0,queryOriginY=0,queryArcAngle=0,queryArcHalf=Math.PI;
 // deployable state: per-structure-type cooldowns, the (tiny) active structure
 // list, and the pedestal attack-speed buff (recomputed every fixed step)
 const deployCds={...(run.deployCds||{})};let activeStructs=[],structCount=0,pedestalBuff=0;
 const structCap=()=>6+Math.floor((run.engineering||0)/10);
 const deployCdMax=(item,d)=>d.cd*(1-.12*Math.min((item.stacks||1)-1,3));
 function addShake(v){shakeMag=Math.min(20,shakeMag+v)}
 function updateCamera(){camX=Math.round(clamp(p.x-viewW/2,0,Math.max(0,W-viewW)));camY=Math.round(clamp(p.y-viewH/2,0,Math.max(0,H-viewH)))}
 function publishReach(){cb.reach?.({viewport:{...viewport},weaponRanges:run.weapons.map(w=>effectiveRange(weaponOf(w),run,viewport)),signatureReach:signatureWeapon?effectiveRange(signatureWeapon,run,viewport):0})}
 function resize(){const r=canvas.getBoundingClientRect();scale=Math.max(1,r.width/W,r.height/H);updateVisibleViewport(viewport,r.width,r.height,scale);viewW=viewport.width;viewH=viewport.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.imageSmoothingEnabled=true;grid.resize(W,H);if(!p.x){p.x=W/2;p.y=H/2}updateCamera();publishReach()}
 function particle(x,y,color,count){if(lowFx)count=Math.min(2,count);for(let i=0;i<count;i++){let q=particles.acquire();if(!q){q=particles.items[(shotId+i)%particles.items.length];}q.x=x;q.y=y;q.vx=(Math.random()-.5)*150;q.vy=(Math.random()-.5)*150;q.life=.42;q.color=color}}
 function damageNumber(x,y,value,crit){if(performance.now()-lastNumber<45)return;lastNumber=performance.now();let n=numbers.acquire();if(!n)return;n.x=x;n.y=y;n.life=.55;n.value=Math.round(value);n.crit=crit}
 function kill(e){kills++;killsByType[e.kind]=(killsByType[e.kind]||0)+1;const d=pickups.acquire();if(d){d.x=e.x;d.y=e.y;d.value=e.value+(Math.random()<(run.bonusSignal||0)?e.value:0)}if((run.luck||0)&&Math.random()<run.luck*.002){const b=pickups.acquire();if(b){b.x=e.x+7;b.y=e.y+7;b.value=e.value}}if(run.cleaningKillsHeal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+run.cleaningKillsHeal);healed+=p.hp-before}particle(e.x,e.y,e.color,lowFx?2:10);if(e.elite)addShake(5);enemies.release(e)}
 // STAT HOOKS: damage/attackSpeed/crit/range multiply or trigger here;
 // spliceQuality adds craftsmanship damage; cleanliness is a damage bonus vs
 // dirty impairments; instakill fails the inspection instantly; lifeSteal is
 // % of damage dealt returned as HP; knockback (item stat + crit special) shoves.
 // NOTE: hit() multiplies by run.damage — callers pass UN-multipled base damage.
 function hit(e,base,color,melee=false){if(!e.active)return;const crit=Math.random()<(run.crit||0);let amount=base*run.damage*(crit?2:1)*(1+(run.spliceQuality||0)*.004);if(e.dirty)amount*=1+(run.cleanliness||0)*.01;if(!e.boss&&Math.random()<(run.instakill||0)){amount=e.hp+1;cb.flash('FIBBER CLAUSE!')}e.hp-=amount;damageDealt+=amount;queryHits++;particle(e.x,e.y,color,crit?8:2);damageNumber(e.x,e.y,amount,crit);if(crit){const kb=(run.critKnockback||0)+(run.knockback||0);if(kb){const a=Math.atan2(e.y-p.y,e.x-p.x);e.x+=Math.cos(a)*kb*8;e.y+=Math.sin(a)*kb*8}slow=.04;addShake(3)}if(run.lifeSteal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount*run.lifeSteal);healed+=p.hp-before}if(e.hp<=0)kill(e)}
 // Shared player-damage path: contact and the boss's FEC pellets both funnel
 // through armor, dodge, signalStrength and the hurt flash.
 function damagePlayer(dmg){if(Math.random()<=Math.min(.6,run.dodge||0))return;const amount=Math.max(2,dmg-run.armor*1.5)*(1-Math.min(.4,(run.signalStrength||0)*.003));p.hp-=amount;if(spriteState)spriteState.hurt=.18;damageTaken+=amount;if(run.hitSpeedBoost)hurtBoost=2;sfx('hit');particle(p.x,p.y,'#fff',12);addShake(4)}
 function areaVisitor(e){if(e.active && areaCanHit(e,queryX,queryY,queryR,queryArcAngle,queryArcHalf) && (queryLimit===Infinity || withinReach(e.x,e.y,queryOriginX,queryOriginY,queryLimit)))hit(e,queryDamage,queryColor,true)}
 function shotVisitor(e){const s=queryShot;if(!s.active||!e.active||e.lastShot===s.id||s.boom)return;if(projectileCanHit(s,e)){e.lastShot=s.id;if(s.mortar){const dx=s.x-s.prevX,dy=s.y-s.prevY,l=dx*dx+dy*dy,t=l?clamp(((e.x-s.prevX)*dx+(e.y-s.prevY)*dy)/l,0,1):0;s.x=s.prevX+t*dx;s.y=s.prevY+t*dy;s.boom=true;return}hit(e,s.damage,s.color,false);if(!s.pierce){if(s.pen>0)s.pen--;else shots.release(s)}}}
 function nearestVisitor(e){if(!e.active)return;const d=Math.hypot(e.x-queryX,e.y-queryY);if(d<nearestDist){nearestBest=e;nearestDist=d}}
 function nearest(range){queryX=p.x;queryY=p.y;nearestBest=null;nearestDist=range;grid.visit(p.x,p.y,range,nearestVisitor);return nearestBest}
 function nearestAt(x,y,range){queryX=x;queryY=y;nearestBest=null;nearestDist=range;grid.visit(x,y,range,nearestVisitor);return nearestBest}
 function activeFoeCount(){let n=0;for(let i=0;i<enemies.items.length;i++)if(enemies.items[i].active)n++;return n}
 function spawnEnemy(kind,force){if(!force&&activeFoeCount()>=maxActiveEnemies(run.wave))return;const e=enemies.acquire();if(!e)return;const base=ENEMIES[kind||TYPES[(Math.random()*Math.min(TYPES.length,2+(run.wave/2|0)))|0]],edge=(Math.random()*4)|0,pad=35;e.kind=kind||TYPES[TYPES.indexOf(base)];if(!e.kind){for(let i=0;i<TYPES.length;i++)if(ENEMIES[TYPES[i]]===base)e.kind=TYPES[i]}e.x=edge===1?camX+viewW+pad:edge===3?camX-pad:camX+Math.random()*viewW;e.y=edge===0?camY-pad:edge===2?camY+viewH+pad:camY+Math.random()*viewH;// DENSITY REBALANCE: fewer simultaneous bodies (see maxActiveEnemies) are
// compensated with steeper per-wave HP scaling (.19 → .28) plus a new
// contact-damage scale. The boss keeps its own literal .19 scaling untouched.
e.hp=base.hp*(1+(run.wave-1)*.28);e.max=e.hp;e.speed=base.speed*(1+(run.wave-1)*.025);e.damage=base.damage*(1+(run.wave-1)*.02);e.r=base.r;e.value=Math.round(base.value*(1+TUNING.signalWaveScale*(run.wave-1)));e.color=base.color;e.elite=!!base.elite;e.dirty=!!base.dirty;e.sound=base.sound;e.lastShot=-1;e.sprite=enemySprite(e.kind,base);
 if(e.kind==='lag'&&lagArt){e.art=lagArt;e.anim=createLagAnimation()}}
 // SQUIRREL BOSS: spawns at the wave-20 gate (then every 10 waves). Phase 1
 // chases the player; at <=50% HP it flees, keeps other impairments between
 // itself and the player, and casts the telegraphed FEC cone between retreats.
 let bossSpawned=false;
 function spawnBoss(){if(!sqArt||!SQUIRREL)return;const e=enemies.acquire();if(!e)return;
  const edge=(Math.random()*4)|0,pad=60;e.kind=SQUIRREL.id;
  e.x=edge===1?camX+viewW+pad:edge===3?camX-pad:camX+Math.random()*viewW;e.y=edge===0?camY-pad:edge===2?camY+viewH+pad:camY+Math.random()*viewH;
  e.hp=SQUIRREL.hp*(1+(run.wave-1)*.19);e.max=e.hp;e.speed=SQUIRREL.speed*(1+(run.wave-1)*.025);e.damage=SQUIRREL.damage;e.r=SQUIRREL.r;e.value=Math.round(SQUIRREL.value*(1+TUNING.signalWaveScale*(run.wave-1)));e.color=SQUIRREL.color;e.elite=true;e.boss=true;e.dirty=false;e.sound='boss';e.lastShot=-1;e.sprite=null;e.art=null;e.anim=null;
  e.sq={...createSquirrelAnimation(),art:sqArt,phase:1,castCd:2,wind:0,cast:0,aim:0};
  cb.flash(SQUIRREL.intro);addShake(6)}
 function fireCone(e){const c=SQUIRREL.cone,step=c.pellets>1?c.half*2/(c.pellets-1):0;
  for(let k=0;k<c.pellets;k++){const a=e.sq.aim+(k-(c.pellets-1)/2)*step,f=foeShots.acquire();if(!f)break;
   f.x=f.prevX=e.x;f.y=f.prevY=e.y;f.vx=Math.cos(a)*c.speed;f.vy=Math.sin(a)*c.speed;f.remaining=c.range;f.traveled=0;f.life=c.range/c.speed+.5;f.damage=c.damage;f.r=6;sfx('packet')}
  addShake(3)}
 // Returns this frame's steering angle and speed for the squirrel only.
 function squirrelUpdate(e,dt){const s=e.sq,d=SQUIRREL,wasWind=s.wind>0;
  if(s.phase===1&&e.hp<=e.max*.5){s.phase=2;s.castCd=1.2;cb.flash(SQUIRREL.phaseFlash);addShake(6)}
  s.cast=Math.max(0,s.cast-dt);s.wind=Math.max(0,s.wind-dt);s.castCd-=dt;
  if(wasWind&&!s.wind)fireCone(e);
  if(s.phase===2&&s.wind<=0&&s.cast<=0&&s.castCd<=0&&distance(p,e)<d.cone.range*.95){s.wind=d.cone.windup;s.cast=d.cone.windup+.25;s.castCd=d.cone.cooldown;s.aim=Math.atan2(p.y-e.y,p.x-e.x);sfx('boss')}
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
 function attack(w){if(w.turret){deployTurret(w);return}const reach=effectiveRange(w,run,viewport),t=nearest(reach);if(!t)return;const a=Math.atan2(t.y-p.y,t.x-p.x),pattern=w.pattern||'projectile';sfx(w.family||'laser');queryHits=0;if(['melee','nova','cone','orbiting'].includes(pattern)){queryX=p.x;queryY=p.y;queryR=reach;queryDamage=w.damage;queryColor=w.color;queryLimit=Infinity;queryArcAngle=a;queryArcHalf=['melee','cone'].includes(pattern)?Math.PI/3:Math.PI;grid.visit(p.x,p.y,reach,areaVisitor);showArea();if(w.heal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+w.heal);healed+=p.hp-before}particle(p.x,p.y,w.color,7)}else{launch(w,a,p.x,p.y,reach);if(pattern==='chain'){launch(w,a-.16,p.x,p.y,reach);launch(w,a+.16,p.x,p.y,reach)}}}
 // AUTO-DEPLOY TURRET WEAPONS: every rate/attackSpeed seconds, drop a sentry
 // near the player instead of firing directly. Turret damage/HP/lifetime/cap
 // all scale with the weapon's rolls + Engineering (see structures.js for
 // per-archetype tuning: life, cap, fire, mode).
 function deployTurret(w){const cfg=w.turret;
  let count=0;for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(t.active&&t.wid===w.id)count++}
  if(count>=cfg.cap+Math.floor((run.engineering||0)/15))return; // silently at cap — HUD shows the live turrets
  const t=turrets.acquire();if(!t)return;const a=Math.random()*6.28;
  t.wid=w.id;t.mode=cfg.mode;t.color=w.color;t.born=0;t.inv=0;t.r=13;
  t.x=clamp(p.x+Math.cos(a)*26,20,W-20);t.y=clamp(p.y+Math.sin(a)*26,20,H-20);
  t.life=t.maxLife=cfg.life+(run.engineering||0)*.04;
  t.fire=cfg.fire;t.fireCd=cfg.fire*.4;
  t.damage=w.damage*(1+(run.engineering||0)*.01)*(1+(run.turretQuality||0)*.004);
  t.weapon=w;t.range=w.range;t.hp=20+(run.engineering||0)*2;t.lookA=a+Math.PI;
  sfx('deploy');particle(t.x,t.y,'#d6d3d1',lowFx?2:8)}
 function turretContact(e){const t=queryStruct;if(!e.active||t.inv>0)return;if(Math.hypot(e.x-t.x,e.y-t.y)<t.r+e.r+4){t.hp-=e.damage*.5;t.inv=.5}}
 function turretsUpdate(dt){for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(!t.active)continue;
  t.born+=dt;t.inv=Math.max(0,t.inv-dt);t.fireCd-=dt;t.life-=dt;
  if(t.mode==='helper'){const a=t.helperIndex*Math.PI/2;t.x+=(p.x+Math.cos(a)*38-t.x)*Math.min(1,dt*4);t.y+=(p.y+Math.sin(a)*38-t.y)*Math.min(1,dt*4)}
  if(t.life<=0||t.hp<=0){particle(t.x,t.y,'#94a3b8',lowFx?2:5);turrets.release(t);continue} // quiet despawn — no shake spam
  if(t.inv<=0){queryStruct=t;grid.visit(t.x,t.y,t.r+40,turretContact)} // impairments dent the sentry on contact
  if(t.fireCd<=0){const reach=effectiveRange(t.weapon,run,viewport,'turret'),target=nearestAt(t.x,t.y,reach);
   if(target){const ang=Math.atan2(target.y-t.y,target.x-t.x);t.lookA=ang;t.fireCd=t.fire;
    if(t.mode==='pellet'||t.mode==='helper'){launch({damage:t.damage,range:t.range,pattern:'projectile',color:t.color},ang,t.x,t.y,reach);sfx('snip')}
    else if(t.mode==='mortar'){launch({damage:t.damage,range:t.range,pattern:'mortar',color:t.color,mortar:true,speed:260},ang,t.x,t.y,reach);sfx('packet')}
    else if(t.mode==='pulse'){launch({damage:t.damage,range:t.range,pattern:'pierce',color:t.color,speed:620},ang,t.x,t.y,reach);sfx('laser')}
    else{for(let k=-2;k<=2;k++)launch({damage:t.damage,range:t.range,pattern:'projectile',color:t.color},ang+k*.22,t.x,t.y,reach);sfx('spark')}
   }else t.fireCd=.12}}}
 // Player-placed structures: expire quietly (fade is handled in draw), mounts
 // fire through the same projectile pool, pedestals set the attack-speed buff.
 function structuresUpdate(dt){activeStructs.length=0;
  for(let i=0;i<structures.items.length;i++){const s=structures.items[i];if(!s.active)continue;
   s.born+=dt;s.life-=dt;s.rearm=Math.max(0,s.rearm-dt);
   if(s.life<=0){particle(s.x,s.y,'#94a3b8',lowFx?2:4);structures.release(s);continue}
   activeStructs.push(s)}
  structCount=activeStructs.length;pedestalBuff=0;
  for(let i=0;i<activeStructs.length;i++){const s=activeStructs[i],def=STRUCTURES[s.type];if(!def)continue;
   if(def.kind==='turret'){s.fireCd-=dt;if(s.fireCd<=0){const reach=effectiveRange(def,run,viewport,'turret'),target=nearestAt(s.x,s.y,reach);if(target){const ang=Math.atan2(target.y-s.y,target.x-s.x);s.lookA=ang;launch({damage:def.damage*(1+.2*(s.power-1))*(1+(run.engineering||0)*.01),range:def.range,pattern:'projectile',color:def.color},ang,s.x,s.y,reach);sfx('snip');s.fireCd=def.fire}else s.fireCd=.15}}
   else if(def.kind==='buff'&&Math.hypot(p.x-s.x,p.y-s.y)<s.r)pedestalBuff=Math.max(pedestalBuff,def.buff+.05*(s.power-1))}}
 // Q-key placement: structure appears AT the player, respecting per-type
 // cooldown and the total permit cap (6 + Engineering/10).
 function placeStructure(){const list=run.deployables||[];if(!list.length)return;
  const idx=Math.min(Math.max(0,input.current.deploySel||0),list.length-1);
  const item=list[idx],def=STRUCTURES[item.structure];if(!def)return;
  if((deployCds[item.structure]||0)>0){cb.flash(`REBOOTING ${def.name.toUpperCase()} — ${Math.ceil(deployCds[item.structure])}s`);return}
  let count=0;for(let i=0;i<structures.items.length;i++)if(structures.items[i].active)count++;
  if(count>=structCap()){cb.flash('PERMIT LIMIT: TOO MUCH STRUCTURE');return}
  const s=structures.acquire();if(!s){cb.flash('PERMIT LIMIT');return}
  s.active=true;s.type=item.structure;s.x=clamp(p.x,30,W-30);s.y=clamp(p.y,30,H-30);
  s.born=0;s.life=s.maxLife=def.life+(run.engineering||0)*.06;s.r=def.r;
  s.power=Math.min(item.stacks||1,TUNING.deployRankCap);s.rearm=0;s.fireCd=.3;s.lookA=Math.random()*6.28;s.uses=def.uses||0;
  deployCds[item.structure]=deployCdMax(item,def);
  sfx('deploy');particle(p.x,p.y,'#d6d3d1',lowFx?3:8);cb.flash(`${def.name.toUpperCase()} DEPLOYED`)}
 function signatureTurret(cfg){const t=turrets.acquire();if(!t)return false;const a=cfg.index*Math.PI/2,helper=cfg.mode==='helper';
  Object.assign(t,{x:p.x+(helper?Math.cos(a)*22:0),y:p.y+(helper?Math.sin(a)*22:0),wid:`signature-${run.character.id}`,mode:cfg.mode,helperIndex:cfg.index,color:cfg.color,born:0,inv:0,r:13,life:cfg.life,maxLife:cfg.life,fire:cfg.fire,fireCd:.15,damage:cfg.damage*(1+(run.engineering||0)*.01)*(1+(run.turretQuality||0)*.004),range:cfg.range,weapon:{range:cfg.range,pattern:'turret'},hp:35+(run.engineering||0),lookA:0});return true}
 function signatureBarrier(){let count=0;for(const s of structures.items)if(s.active)count++;if(count>=structCap())return false;const st=structures.acquire();if(!st)return false;const d=STRUCTURES.barricade;Object.assign(st,{type:'barricade',x:p.x,y:p.y,born:0,life:d.life,maxLife:d.life,r:d.r,power:1,rearm:0,uses:0,fireCd:0,lookA:0});return true}
 function activateSpecial(){if(specialCooldown>0)return;const timer=activateSignature(run,p,{launch,area:(r,d,color)=>explode(p.x,p.y,d,color,effectiveRange(signatureWeapon,run,viewport)),heal:amount=>{const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount);healed+=p.hp-before},turret:signatureTurret,barrier:signatureBarrier});if(timer===null){cb.flash('NO PERMIT SPACE — TRY AGAIN');return}specialTimer=timer;specialCooldown=run.character.special.cooldown;sfx('special');cb.flash(run.character.special.name.toUpperCase());addShake(5);particle(p.x,p.y,'#ffffff',lowFx?6:16)}
 function separateVisitor(other){const e=queryShot;if(!other.active||other===e)return;let dx=e.x-other.x,dy=e.y-other.y,d2=dx*dx+dy*dy,min=e.r+other.r;if(d2>0&&d2<min*min){const push=(min-Math.sqrt(d2))*.025;e.x+=dx*push;e.y+=dy*push}}
 function fixedUpdate(dt){const oldX=p.x,oldY=p.y;areaFx.life=Math.max(0,areaFx.life-dt);time-=dt;soundClock-=dt;hurtBoost=Math.max(0,hurtBoost-dt);p.inv=Math.max(0,p.inv-dt);specialCooldown=Math.max(0,specialCooldown-dt);specialTimer=Math.max(0,specialTimer-dt);for(const k in deployCds)if(deployCds[k]>0)deployCds[k]=Math.max(0,deployCds[k]-dt);p.regen+=dt*run.regen;if(p.regen>=1){const h=p.regen|0,before=p.hp;p.hp=Math.min(p.maxHp,p.hp+h);healed+=p.hp-before;p.regen-=h}let ix=input.current.x,iy=input.current.y;if(ix||iy){const m=Math.hypot(ix,iy)||1,boost=(specialTimer>0?(run.character.special.id==='sprint'?1.8:run.character.special.id==='deadline'?1.5:1):1)*(hurtBoost>0?1.3:1);p.x+=ix/m*run.speed*boost*dt;p.y+=iy/m*run.speed*boost*dt}p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r); if(spriteState){if(run.character.id==='oracle')updateSpriteAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition);else{spriteState.signal=specialTimer>0?1:0;updateDonAnimation(spriteState,p.x-oldX,p.y-oldY,dt,characterArt.definition)}}if(input.current.special){input.current.special=false;activateSpecial()}
  // deployable input: C cycles the selected item (HUD highlight follows), Q places it
  if(input.current.cycle){input.current.cycle=false;const list=run.deployables||[];if(list.length){const cur=Math.min(Math.max(0,input.current.deploySel||0),list.length-1);const nxt=(cur+1)%list.length;input.current.deploySel=nxt;cb.flash(`DEPLOY: ${list[nxt].name}`)}}
  if(input.current.deploy){input.current.deploy=false;placeStructure()}
  updateCamera();
  if(!bossSpawned&&bossWave(run.wave)){bossSpawned=true;spawnBoss()}
  spawn-=dt;if(spawn<=0){spawnEnemy();if(Math.random()<spawnDoubleChance(run.wave))spawnEnemy();spawn=spawnInterval(run.wave)}grid.clear();
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active)grid.insert(e)}
  structuresUpdate(dt); // mounts fire + pedestal buff, uses the freshly built enemy grid
  for(let i=0;i<run.weapons.length;i++){cooldowns[i]-=dt;const w=weaponOf(run.weapons[i]);if(w&&cooldowns[i]<=0){attack(w);cooldowns[i]=w.rate/(run.attackSpeed*(1+pedestalBuff)*((run.character.special.id==='frenzy'&&specialTimer>0)?2.5:1))}}
  turretsUpdate(dt);
  for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(!s.active)continue;const ended=advanceProjectile(s,dt);queryShot=s;grid.visit((s.prevX+s.x)/2,(s.prevY+s.y)/2,Math.hypot(s.x-s.prevX,s.y-s.prevY)/2+s.r+34,shotVisitor);if(!s.active)continue;if(s.boom || ended){if(s.mortar)explode(s.x,s.y,s.damage,s.color,Math.min(55,s.maxReach*.25),s);shots.release(s)}}
  // Enemy projectiles (FEC pellets): travel, then one hit on the player each;
  // a 0.3s grace window after any hit keeps a full volley from dumping at once.
  for(let i=0;i<foeShots.items.length;i++){const s=foeShots.items[i];if(!s.active)continue;const ended=advanceProjectile(s,dt);if(!ended&&p.inv<=0&&distance(p,s)<p.r+s.r){damagePlayer(s.damage);p.inv=.3;foeShots.release(s);continue}if(ended||s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)foeShots.release(s)}
  // STAT HOOKS: armor flat-reduces contact damage; dodge is a capped (60%)
  // chance to ignore it entirely; signalStrength resists impairment damage.
  // STRUCTURES: barricades shove enemies out (local steering, tiny m), traps
  // chomp + shove, snares slow — none of it touches the player.
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(!e.active)continue;let a=Math.atan2(p.y-e.y,p.x-e.x),spd=e.speed;
   let slowMul=1;
   for(let k=0;k<activeStructs.length;k++){const st=activeStructs[k];if(!st.active)continue;const def=STRUCTURES[st.type];if(!def)continue;
    if(def.kind==='block'){const dx=e.x-st.x,dy=e.y-st.y,sd=Math.hypot(dx,dy),min=st.r+e.r;if(sd<min){const push=(min-sd)*.55;e.x+=dx/(sd||1)*push;e.y+=dy/(sd||1)*push}}
    else if(def.kind==='trap'&&st.rearm<=0&&st.uses>0){const sd=Math.hypot(e.x-st.x,e.y-st.y);if(sd<st.r+e.r){st.rearm=.7;st.uses--;hit(e,def.chomp*(1+.2*(st.power-1)),'#f87171',false);const ba=Math.atan2(e.y-st.y,e.x-st.x);e.x+=Math.cos(ba)*22;e.y+=Math.sin(ba)*22;sfx('snip');if(st.uses<=0){particle(st.x,st.y,'#f87171',lowFx?2:6);structures.release(st);structCount--}}}
    else if(def.kind==='slow'){if(Math.hypot(e.x-st.x,e.y-st.y)<st.r)slowMul=Math.min(slowMul,1-(def.slow+.05*(st.power-1)))}}
   if(e.sq)({a,spd}=squirrelUpdate(e,dt));
   const mvx=Math.cos(a)*spd*slowMul,mvy=Math.sin(a)*spd*slowMul;
   e.x+=mvx*dt;e.y+=mvy*dt;
   if(e.anim)updateLagAnimation(e.anim,mvx*dt,mvy*dt,dt,lagArt.definition)
   else if(e.sq)updateSquirrelAnimation(e.sq,mvx,mvy,dt,sqArt.definition)
   if(separate){queryShot=e;grid.visit(e.x,e.y,e.r+28,separateVisitor)}
   if(distance(p,e)<p.r+e.r&&p.inv<=0){if(e.anim)e.anim.attack=.35;if(run.firstHitBlocked&&!firstBlockUsed){firstBlockUsed=true;cb.flash('FIRST HIT POLITELY DECLINED')}else damagePlayer(e.damage);p.inv=.55}}
  for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(!d.active)continue;const dd=distance(p,d);if(dd<120*(run.character.pickupScale||1)){d.x+=(p.x-d.x)*dt*7;d.y+=(p.y-d.y)*dt*7}if(dd<p.r+10){signal+=d.value;earnedSignal+=d.value;xp+=d.value*TUNING.xpPickupFactor;xpEarnedWave+=d.value*TUNING.xpPickupFactor;sfx('pickup');pickups.release(d);while(xp>=signalForLevel(run.level+levels)){xp-=signalForLevel(run.level+levels);levels++;sfx('level');cb.flash('SIGNAL LEVEL UP!')}}}
  for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(!q.active)continue;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;if(q.life<=0)particles.release(q)}for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;n.y-=25*dt;n.life-=dt;if(n.life<=0)numbers.release(n)}if(soundClock<=0){for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active){sfx(e.sound);break}}soundClock=.35+Math.random()*.35}
  if((p.hp<=0||time<=0)&&!over){over=true;const harvest=p.hp>0?Math.round(run.harvesting||0):0;signal+=harvest;earnedSignal+=harvest;sfx(p.hp<=0?'death':'clear');cancelAnimationFrame(raf);cb.finish({...run,hp:Math.max(0,p.hp),signal,earnedSignal,kills,xp,pendingLevels:levels,specialProgress:0,specialUnlocked:true,specialCooldown,deployCds:{...deployCds},won:p.hp>0,damageDealt:Math.round(damageDealt),healed:Math.round(healed),damageTaken:Math.round(damageTaken),killsByType,lastWaveMetrics:{duration:duration-Math.max(0,time),kills:kills-startKills,earnedSignal:earnedSignal-startEarned,xpEarned:+xpEarnedWave.toFixed(2),levelsGained:levels}})}
  hudClock-=dt;if(hudClock<=0){const depList=run.deployables||[],depIdx=depList.length?Math.min(Math.max(0,input.current.deploySel||0),depList.length-1):0;cb.hud({hp:p.hp,maxHp:p.maxHp,time:Math.max(0,time),signal,earnedSignal,xp,xpTarget:signalForLevel(run.level+levels),level:run.level+levels,kills,specialUnlocked:true,specialCooldown,specialName:run.character.special.name,fps:Math.round(fps),stress,viewport:{...viewport},weaponRanges:run.weapons.map(w=>effectiveRange(weaponOf(w),run,viewport)),signatureReach:signatureWeapon?effectiveRange(signatureWeapon,run,viewport):0,
   deploy:depList.length?{items:depList.map((d,i)=>({icon:d.icon,name:d.name,stacks:d.stacks,cd:deployCds[d.structure]||0,cdMax:deployCdMax(d,STRUCTURES[d.structure]),selected:i===depIdx})),structures:structCount,cap:structCap()}:null});hudClock=.1}
 }
 // Silly-but-mandated accessories: every turret and structure gets a hard hat
 // and googly eyes (pupils track whatever it's currently aiming at).
 function drawHardHat(x,y){ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(x,y,7,Math.PI,0);ctx.fill();ctx.fillRect(x-8,y-1,16,2)}
 function drawEyes(x,y,a){const px=Math.cos(a)*1.5,py=Math.sin(a)*1.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-4,y,3.2,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+4,y,3.2,0,7);ctx.fill();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x-4+px,y+py,1.5,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+4+px,y+py,1.5,0,7);ctx.fill()}
 function drawTurretBody(x,y,color,a,r){ctx.strokeStyle='#475569';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-r,y+r);ctx.moveTo(x,y);ctx.lineTo(x+r,y+r);ctx.moveTo(x,y);ctx.lineTo(x,y+r);ctx.stroke();ctx.fillStyle='#334155';ctx.fillRect(x-r+2,y-r+2,r*2-4,r*2-6);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*(r+6),y+Math.sin(a)*(r+6));ctx.stroke();drawHardHat(x,y-r+2);drawEyes(x,y,a)}
 function draw(){
  const sx=Math.round((Math.random()-.5)*shakeMag),sy=Math.round((Math.random()-.5)*shakeMag);
  const zoom=dpr*scale;
  ctx.setTransform(zoom,0,0,zoom,Math.round((sx-camX)*zoom),Math.round((sy-camY)*zoom));
  ctx.fillStyle='#172d32';ctx.fillRect(camX-24,camY-24,viewW+48,viewH+48);
  ctx.strokeStyle='rgba(83,211,190,.08)';ctx.lineWidth=1;for(let x=Math.floor(camX/48)*48;x<camX+viewW;x+=48){ctx.beginPath();ctx.moveTo(x,camY-24);ctx.lineTo(x,camY+viewH+24);ctx.stroke()}for(let y=Math.floor(camY/48)*48;y<camY+viewH;y+=48){ctx.beginPath();ctx.moveTo(camX-24,y);ctx.lineTo(camX+viewW+24,y);ctx.stroke()}
  ctx.strokeStyle='rgba(103,232,249,.25)';ctx.lineWidth=2;ctx.strokeRect(0,0,W,H);
  if(areaFx.life>0){ctx.save();if(areaFx.limit!==Infinity){ctx.beginPath();ctx.arc(Math.round(areaFx.originX),Math.round(areaFx.originY),areaFx.limit,0,Math.PI*2);ctx.clip()}ctx.globalAlpha=areaFx.life/.12*.4;ctx.strokeStyle=areaFx.color;ctx.lineWidth=2;ctx.beginPath();const x=Math.round(areaFx.x),y=Math.round(areaFx.y);if(areaFx.half<Math.PI)ctx.moveTo(x,y);ctx.arc(x,y,areaFx.reach,areaFx.angle-areaFx.half,areaFx.angle+areaFx.half);if(areaFx.half<Math.PI)ctx.closePath();ctx.stroke();ctx.restore()}
  ctx.fillStyle='#67e8f9';for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(d.active&&d.x>camX-8&&d.x<camX+viewW+8&&d.y>camY-8&&d.y<camY+viewH+8)ctx.fillRect(Math.round(d.x)-4,Math.round(d.y)-4,8,8)}
  // structures (under enemies): pop-in scale, fade out during the last 1.5s of life
  for(let i=0;i<structures.items.length;i++){const st=structures.items[i];if(!st.active)continue;const def=STRUCTURES[st.type];if(!def)continue;const x=Math.round(st.x),y=Math.round(st.y),grow=Math.min(1,st.born*4);
   ctx.globalAlpha=(st.life<1.5?Math.max(.2,st.life/1.5):1)*(.4+.6*grow);
   if(def.kind==='turret'){if(truckArt&&st.type===truckDef.structureType)drawTruckTurret(ctx,truckArt,st.born,x,y,grow);else drawTurretBody(x,y,def.color,st.lookA,13*grow+3)}
   else if(def.kind==='block'){ctx.fillStyle='#fb923c';ctx.fillRect(x-st.r,y-8,st.r*2,16);ctx.fillStyle='#fff';for(let k=0;k<4;k++)ctx.fillRect(x-st.r+6+k*12,y-8,5,16);drawHardHat(x,y-14);drawEyes(x,y-2,st.lookA)}
   else if(def.kind==='trap'){ctx.fillStyle='#525252';ctx.fillRect(x-14,y-8,28,14);ctx.fillStyle='#ef4444';for(let k=0;k<5;k++){ctx.fillRect(x-12+k*6,y-8,3,6);ctx.fillRect(x-9+k*6,y-2,3,6)}drawHardHat(x,y-16);drawEyes(x,y-4,st.lookA)}
   else if(def.kind==='slow'){ctx.fillStyle='rgba(34,211,238,.12)';ctx.beginPath();ctx.arc(x,y,st.r*grow,0,7);ctx.fill();ctx.strokeStyle='rgba(103,232,249,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,st.r*.66*grow,0,4.6);ctx.stroke();drawEyes(x,y,st.lookA)}
   else if(def.kind==='buff'){ctx.fillStyle='rgba(250,204,21,.10)';ctx.beginPath();ctx.arc(x,y,st.r*grow,0,7);ctx.fill();ctx.fillStyle='#a8a29e';ctx.fillRect(x-12,y,24,10);ctx.fillRect(x-8,y-8,16,8);drawHardHat(x,y-12);drawEyes(x,y-2,st.lookA)}
   ctx.globalAlpha=1}
  for(let i=0;i<turrets.items.length;i++){const t=turrets.items[i];if(!t.active)continue;const grow=Math.min(1,t.born*4);ctx.globalAlpha=t.life<1?Math.max(.2,t.life):1;if(t.mode==='helper')drawHelper(ctx,Math.round(t.x),Math.round(t.y),t.color);else drawTurretBody(Math.round(t.x),Math.round(t.y),t.color,t.lookA,t.r*grow+3);ctx.globalAlpha=1}
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&e.art&&e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40)drawLagSprite(ctx,e.art,e.anim,e.x,e.y)}
  for(let k=0;k<TYPES.length;k++){const kind=TYPES[k];for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&!e.art&&e.kind===kind&&e.x>camX-40&&e.x<camX+viewW+40&&e.y>camY-40&&e.y<camY+viewH+40)ctx.drawImage(e.sprite,Math.round(e.x-e.sprite.width/2),Math.round(e.y-e.sprite.height/2))}}
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&e.sq&&e.x>camX-90&&e.x<camX+viewW+90&&e.y>camY-90&&e.y<camY+viewH+90)drawSquirrelSprite(ctx,e.sq.art,e.sq,e.x,e.y)}
  for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(s.active&&s.x>camX-28&&s.x<camX+viewW+28&&s.y>camY-28&&s.y<camY+viewH+28)drawProjectile(ctx,s)}
  for(let i=0;i<foeShots.items.length;i++){const s=foeShots.items[i];if(s.active&&s.x>camX-28&&s.x<camX+viewW+28&&s.y>camY-28&&s.y<camY+viewH+28)drawProjectile(ctx,s)}
  for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(q.active&&q.x>=camX&&q.x<=camX+viewW&&q.y>=camY&&q.y<=camY+viewH){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(Math.round(q.x),Math.round(q.y),3,3)}}ctx.globalAlpha=1;
  for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;ctx.fillStyle=n.crit?'#fde047':'#fff';ctx.font=n.crit?'bold 18px Chivo':'bold 13px Chivo';ctx.fillText(n.value,Math.round(n.x),Math.round(n.y))}
  const px=Math.round(p.x),py=Math.round(p.y);
  if(spriteState){if(run.character.id==='oracle')drawCharacterSprite(ctx,characterArt,spriteState,p.x,p.y);else drawDonSprite(ctx,characterArt,spriteState,p.x,p.y)}else {ctx.fillStyle=run.character.color;ctx.beginPath();ctx.arc(px,py,p.r,0,7);ctx.fill();ctx.fillStyle=run.character.vest;ctx.fillRect(px-14,py+2,28,16);ctx.fillStyle=run.character.belt;ctx.fillRect(px-15,py+11,30,5);ctx.fillStyle=run.character.color;ctx.fillRect(px-20,py-17,40,8);ctx.fillStyle='#fff';ctx.fillRect(px-8,py-5,6,7);ctx.fillRect(px+3,py-5,6,7);}if(specialTimer>0){ctx.strokeStyle='#fde047';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,25+Math.sin(performance.now()*.02)*5,0,7);ctx.stroke()}}
 function key(e){if(e.key==='F9'){stress=!stress;if(stress){for(let i=0;i<500;i++)spawnEnemy(null,true)}cb.flash(stress?'STRESS MODE: 500 IMPAIRMENTS':'STRESS MODE OFF')}} window.addEventListener('keydown',key);resize();sfx('wave');if(run.wave%5===0)sfx('boss');
 function frame(now){
  if(paused.current){last=now;if(!over)raf=requestAnimationFrame(frame);return}
  let delta=Math.min(MAX_DT,(now-last)/1000);last=now;
  slow=Math.max(0,slow-delta);
  const target=slow>0?.1:1;
  timeScale+=(target-timeScale)*Math.min(1,delta*18);
  if(Math.abs(timeScale-target)<.005)timeScale=target;
  delta*=timeScale;
  acc+=delta;while(acc>=STEP&&!over){fixedUpdate(STEP);acc-=STEP}
  shakeMag*=Math.exp(-7*delta);if(shakeMag<.05)shakeMag=0;
  draw();frames++;fpsClock+=delta;if(fpsClock>=1){fps=frames/fpsClock;frames=0;fpsClock=0;lowFx=fps<52;separate=fps>=42}if(!over)raf=requestAnimationFrame(frame)
 }raf=requestAnimationFrame(frame);window.addEventListener('resize',resize);
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 return()=>{over=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('keydown',key)}
}