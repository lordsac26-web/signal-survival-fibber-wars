// Geometry is center-point based: no hidden collider padding outside the art.
export const APPARITION=Object.freeze({id:'attenuation',wave:6,weight:.2,maxActive:1,windup:.8,fire:.24,recovery:.35,cooldown:4.6,initialCooldown:2.5,rangeFactor:.34,maxRange:300,half:32*Math.PI/180,damage:22,focus:1.5,focusCooldown:11,initialFocus:6,focusHalf:45*Math.PI/180,focusDamage:1.5,kiteDistance:190});
export const ROUTER_ATTACK=Object.freeze({id:'rous',windup:1.2,fire:.8,recovery:.5,cooldown:7,initialCooldown:3,rangeFactor:.62,maxRange:390,half:28*Math.PI/180,damage:28,focus:0,kiteDistance:0});
export const createConeState=c=>({phase:'chase',clock:0,remaining:0,cooldown:c.initialCooldown,focusCooldown:c.initialFocus||Infinity,empowered:false,poweredShot:false,spent:false,released:false,angle:0,reach:0,half:c.half,damage:c.damage,x:0,y:0,facing:'right',vx:0,vy:0});
export function coneContains(s,x,y){const dx=x-s.x,dy=y-s.y,d=Math.hypot(dx,dy);return d<=s.reach+1e-8&&(d<1e-8||(dx*Math.cos(s.angle)+dy*Math.sin(s.angle))/d>=Math.cos(s.half)-1e-8)}
export function stepCone(s,c,dt,{alive=true,playerAlive=true,x=0,y=0,tx=0,ty=0,shortSide=800,visible=false}={}){
  if(!alive){s.phase='dead';s.empowered=false;return null}
  if(s.phase==='dead')return null;
  s.clock+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.focusCooldown=Math.max(0,s.focusCooldown-dt);
  if(s.phase==='chase'){
    if(Math.abs(tx-x)>3)s.facing=tx<x?'left':'right';
    if(!playerAlive||!visible)return null;
    if(c.focus&&s.focusCooldown<=1e-8&&!s.empowered){s.phase='focus';s.remaining=c.focus;s.x=x;s.y=y;return 'focus'}
    const reach=Math.min(c.maxRange,shortSide*c.rangeFactor);
    if(s.cooldown<=1e-8&&Math.hypot(tx-x,ty-y)<=reach*.95){s.phase='windup';s.remaining=c.windup;s.angle=Math.atan2(ty-y,tx-x);s.x=x;s.y=y;s.reach=reach;s.poweredShot=s.empowered;s.empowered=false;s.half=s.poweredShot?c.focusHalf:c.half;s.damage=c.damage*(s.poweredShot?c.focusDamage:1);s.spent=false;s.released=false;return 'windup'}
  }else{
    s.remaining=Math.max(0,s.remaining-dt);
    if(s.phase==='fire'&&!s.released&&c.id==='rous'&&s.remaining<=c.fire/8+1e-8){s.released=true;return 'release'}
    if(s.remaining<=1e-8){
      if(s.phase==='focus'){s.phase='chase';s.empowered=true;s.focusCooldown=c.focusCooldown;s.cooldown=0;return 'focused'}
      if(s.phase==='windup'){s.phase='fire';s.remaining=c.fire;s.cooldown=c.cooldown;if(c.id!=='rous'){s.released=true;return 'release'}return 'fire'}
      if(s.phase==='fire'){s.phase='recover';s.remaining=c.recovery;return 'recover'}
      s.phase='chase';s.poweredShot=false;
    }
  }
  return null;
}
export function consumeConeHit(s,x,y,inv=0){if(s.spent||!s.released||s.phase!=='fire')return false;s.spent=true;return inv<=0&&coneContains(s,x,y)}
export function cancelHiddenCharge(s,bounds,margin=60){
  if(s.phase==='chase'||s.phase==='dead'||(s.x>=bounds.x+margin&&s.x<=bounds.x+bounds.width-margin&&s.y>=bounds.y+margin&&s.y<=bounds.y+bounds.height-margin))return false;
  s.empowered=s.empowered||s.poweredShot;s.phase='chase';s.remaining=0;s.cooldown=.75;s.spent=true;s.released=false;return true;
}
export function casterVelocity(s,c,angle,speed,dist){if(s.phase!=='chase')return {x:0,y:0};const direction=c.kiteDistance&&dist<c.kiteDistance*.8?-1:c.kiteDistance&&dist<c.kiteDistance?0:1;return {x:Math.cos(angle)*speed*direction,y:Math.sin(angle)*speed*direction}}