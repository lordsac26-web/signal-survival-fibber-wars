// DITCH WITCH — tracked orange trencher elite (wave 6+).
// Conservative elite tuning relative to Macrobend Beast (wave 4, HP 49.6, spd 78.2, dmg 11.5)
// and Attenuation Apparition (wave 5, HP 145, spd 46, dmg 30):
// Base HP 110, speed 58 units/s, contact/charge 20, collider r=26 (chassis only,
// never sized to the extended blade or scattered rock VFX). Alternates two
// telegraphed, dodgeable specials with a 0.65s recovery window and 9s cooldown:
// 1. Blade Charge: 0.85s rooted wind-up -> 0.45s locked-direction rush at 290 units/s (~130.5 units).
// 2. Dig & Rock Spray: 0.85s rooted wind-up -> 0.55s rooted dig that fires 3 rock projectiles
//    in a locked 30° forward fan at 0.28s into the dig.
// Unfinished attacks cancel immediately on death; wreck animation plays without blocking.
export const DITCH=Object.freeze({
  hp:110,speed:58,damage:20,radius:26,value:10,
  wave:6,spawnWeight:.35,maxActive:2,
  activationRange:260,windup:.85,
  chargeDuration:.45,chargeSpeed:290,
  digDuration:.55,rockReleaseTime:.28,
  rockCount:3,rockSpread:.26,rockSpeed:230,rockRange:220,rockRadius:7,rockDamageFactor:.85,
  recovery:.65,cooldown:9,initialMin:5,initialMax:8,
  deathDuration:.55,arenaMargin:38,bladeReach:34
});

export const createDitchState=(random=Math.random)=>({
  phase:'chase',mode:'charge',nextMode:'charge',
  clock:0,remaining:0,cooldown:DITCH.initialMin+random()*(DITCH.initialMax-DITCH.initialMin),
  angle:0,facing:'right',struck:false,rocksFired:false,rootX:0,rootY:0,vfxT:0
});

export function stepDitch(s,dt,{alive=true,playerAlive=true,dx=0,dy=0,visible=false}={}){
  if(!alive){
    s.phase='dead';s.remaining=0;s.vfxT=0;s.struck=false;s.rocksFired=false;
    return null;
  }
  if(s.phase==='dead')return null;
  s.clock+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.vfxT=Math.max(0,s.vfxT-dt);
  if(s.phase==='chase'){
    if(Math.abs(dx)>3)s.facing=dx<0?'left':'right';
    const dist=Math.hypot(dx,dy);
    if(playerAlive&&visible&&s.cooldown<=1e-8&&dist<=DITCH.activationRange){
      s.mode=s.nextMode;s.nextMode=s.mode==='charge'?'rock':'charge';
      s.phase='windup';s.remaining=DITCH.windup;
      s.angle=Math.atan2(dy,dx);s.facing=dx<0?'left':'right';
      s.struck=false;s.rocksFired=false;
      return s.mode==='charge'?'windup-charge':'windup-rock';
    }
    return null;
  }
  s.remaining=Math.max(0,s.remaining-dt);
  if(s.phase==='windup'){
    if(s.remaining<=1e-8){
      if(s.mode==='charge'){
        s.phase='charge';s.remaining=DITCH.chargeDuration;return 'charge';
      }
      s.phase='dig';s.remaining=DITCH.digDuration;s.rocksFired=false;return 'dig';
    }
    return null;
  }
  if(s.phase==='charge'){
    if(s.remaining<=1e-8){
      s.phase='recover';s.remaining=DITCH.recovery;s.cooldown=DITCH.cooldown;return 'recover';
    }
    return null;
  }
  if(s.phase==='dig'){
    const elapsed=DITCH.digDuration-s.remaining;
    if(!s.rocksFired&&elapsed>=DITCH.rockReleaseTime-1e-8){
      s.rocksFired=true;s.vfxT=.32;return 'rock-fire';
    }
    if(s.remaining<=1e-8){
      s.phase='recover';s.remaining=DITCH.recovery;s.cooldown=DITCH.cooldown;return 'recover';
    }
    return null;
  }
  if(s.phase==='recover'&&s.remaining<=1e-8){
    s.phase='chase';
  }
  return null;
}

export function ditchVelocity(s,angle,speed,slow=1){
  if(s.phase==='charge')return {x:Math.cos(s.angle)*DITCH.chargeSpeed*slow,y:Math.sin(s.angle)*DITCH.chargeSpeed*slow};
  if(s.phase!=='chase')return {x:0,y:0};
  return {x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
}

export const ditchContactReady=s=>s.phase==='chase'||(s.phase==='charge'&&!s.struck);

export function clampDitchBounds(e,bounds){
  const m=DITCH.arenaMargin;
  e.x=Math.max(bounds.x+m,Math.min(bounds.x+bounds.width-m,e.x));
  e.y=Math.max(bounds.y+m,Math.min(bounds.y+bounds.height-m,e.y));
}

export function ditchRockOrigin(e,s){
  return {
    x:e.x+Math.cos(s.angle)*DITCH.bladeReach,
    y:e.y+Math.sin(s.angle)*DITCH.bladeReach
  };
}

export function ditchRockBurst(e,s){
  const origin=ditchRockOrigin(e,s),out=[];
  const mid=(DITCH.rockCount-1)/2;
  for(let i=0;i<DITCH.rockCount;i++){
    const a=s.angle+(i-mid)*DITCH.rockSpread;
    out.push({
      x:origin.x,y:origin.y,
      vx:Math.cos(a)*DITCH.rockSpeed,vy:Math.sin(a)*DITCH.rockSpeed,
      remaining:DITCH.rockRange,life:DITCH.rockRange/DITCH.rockSpeed+.4,
      r:DITCH.rockRadius,damage:e.damage*DITCH.rockDamageFactor,
      angle:a
    });
  }
  return out;
}