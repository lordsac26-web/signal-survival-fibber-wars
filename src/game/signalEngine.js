import { ENEMIES, WEAPONS } from '@/game/data/combat';
import ObjectPool from '@/game/performance/ObjectPool';
import SpatialHash from '@/game/performance/SpatialHash';
import { enemySprite } from '@/game/performance/spriteAtlas';
import { sfx } from '@/game/audio';

const TYPES=Object.keys(ENEMIES),STEP=1/60,MAX_DT=.033;
const clamp=(n,a,b)=>n<a?a:n>b?b:n;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const weaponOf=w=>typeof w==='string'?WEAPONS[w]:w;

// `paused` is a mutable ref object (the same pattern already used for `input`
// a few lines below) rather than a plain boolean argument, because a plain
// boolean is only read once, when createSignalEngine() is first called. React
// re-renders don't re-invoke this function — the engine is created exactly
// once per wave (see the `key={run.wave}` on <GameArena>'s <canvas> owner) — so
// the only way for React state (a click on a "view stats" button) to reach
// into an already-running rAF loop is a ref whose `.current` the loop reads
// fresh every frame. Defaulted so any existing caller that doesn't pass one
// still works exactly as before (game just never pauses).
export function createSignalEngine(canvas,run,input,cb,paused={current:false}){
 const ctx=canvas.getContext('2d',{alpha:false}),dpr=Math.min(devicePixelRatio||1,2),grid=new SpatialHash(96);
 const enemies=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,hp:0,r:10,lastShot:-1}));
 const shots=new ObjectPool(320,i=>({poolIndex:i,active:false,x:0,y:0,vx:0,vy:0,r:5,life:0,id:0}));
 const particles=new ObjectPool(300,i=>({poolIndex:i,active:false,x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}));
 const pickups=new ObjectPool(650,i=>({poolIndex:i,active:false,x:0,y:0,value:1}));
 const numbers=new ObjectPool(48,i=>({poolIndex:i,active:false,x:0,y:0,life:0,value:0,crit:false}));
 let W=0,H=0,last=performance.now(),acc=0,raf,spawn=0,hudClock=0,soundClock=0,shotId=0,over=false,hitStop=0,stress=false,lowFx=false,separate=true,fps=60,fpsClock=0,frames=0,lastNumber=0;
 const duration=Math.min(90,20+(run.wave-1)*4); let time=duration,signal=run.signal,kills=run.kills,xp=run.xp||0,levels=0,progress=run.specialProgress||0,unlocked=run.specialUnlocked||false,specialCooldown=0,specialTimer=0;const trigger=run.character.special.type;let eliteKills=trigger==='elite'?progress:0,meleeHits=trigger==='melee'?progress:0,healed=trigger==='healing'?progress:0,damageTaken=trigger==='damage'?progress:0;
 const p={x:0,y:0,r:17,hp:run.hp,maxHp:run.maxHp,inv:0,regen:0};let hurtBoost=0,firstBlockUsed=false;const cooldowns=new Float32Array(run.weapons.length);
 let queryX=0,queryY=0,queryR=0,queryDamage=0,queryColor='#fff',queryShot=null,queryHits=0,nearestBest=null,nearestDist=0;
 function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);grid.resize(W,H);if(!p.x){p.x=W/2;p.y=H/2}}
 function particle(x,y,color,count){if(lowFx)count=Math.min(2,count);for(let i=0;i<count;i++){let q=particles.acquire();if(!q){q=particles.items[(shotId+i)%particles.items.length];}q.x=x;q.y=y;q.vx=(Math.random()-.5)*150;q.vy=(Math.random()-.5)*150;q.life=.42;q.color=color}}
 function damageNumber(x,y,value,crit){if(performance.now()-lastNumber<45)return;lastNumber=performance.now();let n=numbers.acquire();if(!n)return;n.x=x;n.y=y;n.life=.55;n.value=Math.round(value);n.crit=crit}
 function kill(e){kills++;xp+=e.value;if(e.elite)eliteKills++;const d=pickups.acquire();if(d){d.x=e.x;d.y=e.y;d.value=e.value+(Math.random()<(run.bonusSignal||0)?e.value:0)}if(run.cleaningKillsHeal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+run.cleaningKillsHeal);healed+=p.hp-before}particle(e.x,e.y,e.color,lowFx?2:10);if(e.elite)cb.shake();enemies.release(e)}
 function hit(e,base,color,melee=false){if(!e.active)return;const crit=Math.random()<(run.crit||0);let amount=base*run.damage*(crit?2:1);if(Math.random()<(run.instakill||0)){amount=e.hp+1;cb.flash('FIBBER CLAUSE!')}e.hp-=amount;queryHits++;if(melee)meleeHits++;particle(e.x,e.y,color,crit?8:2);damageNumber(e.x,e.y,amount,crit);if(crit){if(run.critKnockback){const a=Math.atan2(e.y-p.y,e.x-p.x);e.x+=Math.cos(a)*run.critKnockback*8;e.y+=Math.sin(a)*run.critKnockback*8}hitStop=.04;cb.shake()}if(run.lifeSteal&&Math.random()<run.lifeSteal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+1);healed+=p.hp-before}if(e.hp<=0)kill(e)}
 function areaVisitor(e){if(e.active&&Math.hypot(e.x-queryX,e.y-queryY)<queryR+e.r)hit(e,queryDamage,queryColor,true)}
 function shotVisitor(e){const s=queryShot;if(!s.active||!e.active||e.lastShot===s.id)return;if(Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r){e.lastShot=s.id;hit(e,s.damage,s.color,false);if(!s.pierce)shots.release(s)}}
 function nearestVisitor(e){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<nearestDist){nearestBest=e;nearestDist=d}}
 function nearest(range){nearestBest=null;nearestDist=range;grid.visit(p.x,p.y,range,nearestVisitor);return nearestBest}
 function spawnEnemy(kind){const e=enemies.acquire();if(!e)return;const base=ENEMIES[kind||TYPES[(Math.random()*Math.min(TYPES.length,2+(run.wave/2|0)))|0]],edge=(Math.random()*4)|0,pad=35;e.kind=kind||TYPES[TYPES.indexOf(base)];if(!e.kind){for(let i=0;i<TYPES.length;i++)if(ENEMIES[TYPES[i]]===base)e.kind=TYPES[i]}e.x=edge===1?W+pad:edge===3?-pad:Math.random()*W;e.y=edge===0?-pad:edge===2?H+pad:Math.random()*H;e.hp=base.hp*(1+(run.wave-1)*.19);e.max=e.hp;e.speed=base.speed*(1+(run.wave-1)*.025);e.damage=base.damage;e.r=base.r;e.value=base.value;e.color=base.color;e.elite=!!base.elite;e.sound=base.sound;e.lastShot=-1;e.sprite=enemySprite(e.kind,base)}
 function launch(w,angle){const s=shots.acquire();if(!s)return;s.id=++shotId;s.x=p.x;s.y=p.y;s.vx=Math.cos(angle)*540;s.vy=Math.sin(angle)*540;s.r=w.helper?9:w.pattern==='beam'?7:5;s.life=w.range*run.range/540;s.damage=w.damage;s.color=w.color;s.helper=!!w.helper;s.pierce=['pierce','beam','beamSweep'].includes(w.pattern)}
 function attack(w){const t=nearest(w.range*run.range);if(!t)return;const a=Math.atan2(t.y-p.y,t.x-p.x),pattern=w.pattern||'projectile';sfx(w.family||'laser');queryHits=0;if(['melee','nova','cone','orbiting'].includes(pattern)){queryX=p.x;queryY=p.y;queryR=w.range*run.range;queryDamage=w.damage;queryColor=w.color;grid.visit(p.x,p.y,queryR,areaVisitor);if(w.heal){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+w.heal);healed+=p.hp-before}particle(p.x,p.y,w.color,7)}else{launch(w,a);if(pattern==='chain'){launch(w,a-.16);launch(w,a+.16)}}}
 function unlockCheck(){const sp=run.character.special;if(!sp||unlocked)return;if(sp.type==='kills')progress=kills;else if(sp.type==='signal')progress=signal;else if(sp.type==='elite')progress=eliteKills;else if(sp.type==='melee')progress=meleeHits;else if(sp.type==='healing')progress=healed;else if(sp.type==='damage')progress=damageTaken;else if(sp.type==='wave')progress=run.wave;if(progress>=sp.goal){unlocked=true;sfx('special');cb.flash(`SPECIAL UNLOCKED: ${sp.name} — Press E`)}}
 function activateSpecial(){if(!unlocked||specialCooldown>0)return;const id=run.character.special.id;specialCooldown=run.character.special.cooldown;specialTimer=5;sfx('special');cb.flash(run.character.special.name.toUpperCase());cb.shake();if(id==='clause'){enemies.each(e=>{if(distance(p,e)<260)hit(e,e.hp+1,'#fbbf24')})}else if(id==='trace'){enemies.each(e=>hit(e,90,'#22d3ee'))}else if(id==='deepclean'){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+45);healed+=p.hp-before;queryX=p.x;queryY=p.y;queryR=260;queryDamage=55;queryColor='#34d399';grid.visit(p.x,p.y,260,areaVisitor)}else if(id==='fortify'||id==='crew'){for(let i=0;i<12;i++)launch({damage:42+(run.engineering||0),range:500,pattern:'pierce',color:'#fbbf24',helper:id==='crew'},i*Math.PI/6)}else if(id==='callback'){queryX=p.x;queryY=p.y;queryR=300;queryDamage=80;queryColor='#67e8f9';grid.visit(p.x,p.y,300,areaVisitor)}particle(p.x,p.y,'#ffffff',lowFx?8:28)}
 function separateVisitor(other){const e=queryShot;if(!other.active||other===e)return;let dx=e.x-other.x,dy=e.y-other.y,d2=dx*dx+dy*dy,min=e.r+other.r;if(d2>0&&d2<min*min){const push=(min-Math.sqrt(d2))*.025;e.x+=dx*push;e.y+=dy*push}}
 function fixedUpdate(dt){if(hitStop>0){hitStop-=dt;return}time-=dt;soundClock-=dt;hurtBoost=Math.max(0,hurtBoost-dt);p.inv=Math.max(0,p.inv-dt);specialCooldown=Math.max(0,specialCooldown-dt);specialTimer=Math.max(0,specialTimer-dt);p.regen+=dt*run.regen;if(p.regen>=1){const h=p.regen|0,before=p.hp;p.hp=Math.min(p.maxHp,p.hp+h);healed+=p.hp-before;p.regen-=h}let ix=input.current.x,iy=input.current.y;if(ix||iy){const m=Math.hypot(ix,iy)||1,boost=((run.character.special.id==='sprint'&&specialTimer>0)?1.8:1)*(hurtBoost>0?1.3:1);p.x+=ix/m*run.speed*boost*dt;p.y+=iy/m*run.speed*boost*dt}p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r);if(input.current.special){input.current.special=false;activateSpecial()}
  spawn-=dt;if(spawn<=0){spawnEnemy();if(Math.random()<Math.min(.65,run.wave*.05))spawnEnemy();spawn=Math.max(.1,.76-run.wave*.045)}grid.clear();
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active)grid.insert(e)}
  for(let i=0;i<run.weapons.length;i++){cooldowns[i]-=dt;const w=weaponOf(run.weapons[i]);if(w&&cooldowns[i]<=0){attack(w);cooldowns[i]=w.rate/(run.attackSpeed*((run.character.special.id==='frenzy'&&specialTimer>0)?2.5:1))}}
  for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(!s.active)continue;s.life-=dt;if(s.life<=0){shots.release(s);continue}s.x+=s.vx*dt;s.y+=s.vy*dt;queryShot=s;grid.visit(s.x,s.y,s.r+34,shotVisitor)}
  for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(!e.active)continue;const a=Math.atan2(p.y-e.y,p.x-e.x);e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;if(separate){queryShot=e;grid.visit(e.x,e.y,e.r+28,separateVisitor)}if(distance(p,e)<p.r+e.r&&p.inv<=0){if(run.firstHitBlocked&&!firstBlockUsed){firstBlockUsed=true;cb.flash('FIRST HIT POLITELY DECLINED')}else if(Math.random()>run.dodge){const dmg=Math.max(2,e.damage-run.armor*1.5);p.hp-=dmg;damageTaken+=dmg;if(run.hitSpeedBoost)hurtBoost=2;sfx('hit');particle(p.x,p.y,'#fff',12);cb.shake()}p.inv=.55}}
  for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(!d.active)continue;const dd=distance(p,d);if(dd<120){d.x+=(p.x-d.x)*dt*7;d.y+=(p.y-d.y)*dt*7}if(dd<p.r+10){signal+=d.value;sfx('pickup');pickups.release(d);while(xp>=18+(run.level+levels)*8){xp-=18+(run.level+levels)*8;levels++;sfx('level');cb.flash('SIGNAL LEVEL UP!')}}}
  for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(!q.active)continue;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;if(q.life<=0)particles.release(q)}for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;n.y-=25*dt;n.life-=dt;if(n.life<=0)numbers.release(n)}if(soundClock<=0){for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active){sfx(e.sound);break}}soundClock=.35+Math.random()*.35}unlockCheck();
  if((p.hp<=0||time<=0)&&!over){over=true;sfx(p.hp<=0?'death':'clear');cancelAnimationFrame(raf);cb.finish({...run,hp:Math.max(0,p.hp),signal,kills,xp,pendingLevels:levels,specialProgress:progress,specialUnlocked:unlocked,won:p.hp>0})}
  hudClock-=dt;if(hudClock<=0){cb.hud({hp:p.hp,maxHp:p.maxHp,time:Math.max(0,time),signal,kills,specialUnlocked:unlocked,specialCooldown,specialName:run.character.special.name,fps:Math.round(fps),stress});hudClock=.1}
 }
 function draw(){ctx.fillStyle='#172d32';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(83,211,190,.08)';ctx.lineWidth=1;for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.fillStyle='#67e8f9';for(let i=0;i<pickups.items.length;i++){const d=pickups.items[i];if(d.active&&d.x>-8&&d.x<W+8&&d.y>-8&&d.y<H+8)ctx.fillRect(d.x-4,d.y-4,8,8)}for(let k=0;k<TYPES.length;k++){const kind=TYPES[k];for(let i=0;i<enemies.items.length;i++){const e=enemies.items[i];if(e.active&&e.kind===kind&&e.x>-40&&e.x<W+40&&e.y>-40&&e.y<H+40)ctx.drawImage(e.sprite,e.x-e.sprite.width/2,e.y-e.sprite.height/2)}}for(let i=0;i<shots.items.length;i++){const s=shots.items[i];if(s.active&&s.x>-10&&s.x<W+10&&s.y>-10&&s.y<H+10){ctx.fillStyle=s.color;if(s.helper){ctx.fillRect(s.x-7,s.y-4,14,12);ctx.fillStyle='#fde047';ctx.fillRect(s.x-9,s.y-9,18,5)}else{ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill()}}}for(let i=0;i<particles.items.length;i++){const q=particles.items[i];if(q.active&&q.x>=0&&q.x<=W&&q.y>=0&&q.y<=H){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,3,3)}}ctx.globalAlpha=1;for(let i=0;i<numbers.items.length;i++){const n=numbers.items[i];if(!n.active)continue;ctx.fillStyle=n.crit?'#fde047':'#fff';ctx.font=n.crit?'bold 18px Chivo':'bold 13px Chivo';ctx.fillText(n.value,n.x,n.y)}ctx.fillStyle=run.character.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();ctx.fillStyle=run.character.vest;ctx.fillRect(p.x-14,p.y+2,28,16);ctx.fillStyle=run.character.belt;ctx.fillRect(p.x-15,p.y+11,30,5);ctx.fillStyle=run.character.color;ctx.fillRect(p.x-20,p.y-17,40,8);ctx.fillStyle='#fff';ctx.fillRect(p.x-8,p.y-5,6,7);ctx.fillRect(p.x+3,p.y-5,6,7);if(specialTimer>0){ctx.strokeStyle='#fde047';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,25+Math.sin(performance.now()*.02)*5,0,7);ctx.stroke()}}
 function key(e){if(e.key==='F9'){stress=!stress;if(stress){for(let i=0;i<500;i++)spawnEnemy()}cb.flash(stress?'STRESS MODE: 500 IMPAIRMENTS':'STRESS MODE OFF')}} window.addEventListener('keydown',key);resize();sfx('wave');if(run.wave%5===0)sfx('boss');
 function frame(now){
  // PAUSE CHECK — this is the entire pause feature. When paused.current is
  // true we skip fixedUpdate() (so enemies/cooldowns/regen/the timer all
  // simply stop advancing) and skip draw() (so the last real frame just sits
  // there on screen, like a paused video). We still keep `last=now` on every
  // paused frame so that whenever paused.current flips back to false, the
  // very next real frame computes a small, normal delta instead of one giant
  // delta covering the entire time the stats screen was open (which would
  // otherwise make fixedUpdate() run hundreds of catch-up steps at once).
  // We also still call requestAnimationFrame so the loop keeps ticking over
  // at ~60fps while paused, ready to resume the instant the flag flips —
  // the alternative (cancelling raf and starting a fresh loop on resume) is
  // more efficient but adds a second place `over`/cleanup has to agree on,
  // which isn't worth it for a menu that's only open for a few seconds.
  if(paused.current){last=now;if(!over)raf=requestAnimationFrame(frame);return}
  const delta=Math.min(MAX_DT,(now-last)/1000);last=now;acc+=delta;while(acc>=STEP&&!over){fixedUpdate(STEP);acc-=STEP}draw();frames++;fpsClock+=delta;if(fpsClock>=1){fps=frames/fpsClock;frames=0;fpsClock=0;lowFx=fps<52;separate=fps>=42}if(!over)raf=requestAnimationFrame(frame)
 }raf=requestAnimationFrame(frame);window.addEventListener('resize',resize);
 return()=>{over=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('keydown',key)}
}