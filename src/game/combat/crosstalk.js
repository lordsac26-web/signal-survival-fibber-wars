export const CROSSTALK=Object.freeze({hp:22,speed:106,damage:12,radius:15,wave:4,weight:1,windup:.4,lunge:.23,recovery:.45,cooldown:2.8,initialCooldown:1.5,triggerRange:125,lungeSpeed:330,weave:.36,weaveHz:11,blink:false});
export const createCritterState=()=>({phase:'chase',clock:0,remaining:0,cooldown:CROSSTALK.initialCooldown,angle:0,struck:false,facing:'left'});
export function stepCritter(s,dt,{alive=true,playerAlive=true,dx=0,dy=0,visible=false}={}){
  if(!alive){s.phase='dead';return null}
  if(s.phase==='dead')return null;
  s.clock+=dt;s.cooldown=Math.max(0,s.cooldown-dt);
  if(s.phase==='chase'){
    if(Math.abs(dx)>3)s.facing=dx<0?'left':'right';
    if(playerAlive&&visible&&s.cooldown<=1e-8&&Math.hypot(dx,dy)<=CROSSTALK.triggerRange){s.phase='windup';s.remaining=CROSSTALK.windup;s.angle=Math.atan2(dy,dx);s.struck=false;s.facing=dx<0?'left':'right';return 'windup'}
  }else{
    s.remaining=Math.max(0,s.remaining-dt);
    if(s.remaining<=1e-8){
      if(s.phase==='windup'){s.phase='lunge';s.remaining=CROSSTALK.lunge;return 'lunge'}
      if(s.phase==='lunge'){s.phase='recover';s.remaining=CROSSTALK.recovery;s.cooldown=CROSSTALK.cooldown;return 'recover'}
      s.phase='chase';
    }
  }
  return null;
}
export function critterVelocity(s,angle,speed,slow=1){
  if(s.phase==='lunge')return {x:Math.cos(s.angle)*CROSSTALK.lungeSpeed*slow,y:Math.sin(s.angle)*CROSSTALK.lungeSpeed*slow};
  if(s.phase!=='chase')return {x:0,y:0};
  const side=Math.sin(s.clock*CROSSTALK.weaveHz)*CROSSTALK.weave;
  return {x:(Math.cos(angle)-Math.sin(angle)*side)*speed,y:(Math.sin(angle)+Math.cos(angle)*side)*speed};
}
export const critterContactReady=s=>s.phase==='chase'||(s.phase==='lunge'&&!s.struck);
export function clampCritterLunge(e,bounds){
  const m=36;e.x=Math.max(bounds.x+m,Math.min(bounds.x+bounds.width-m,e.x));e.y=Math.max(bounds.y+m,Math.min(bounds.y+bounds.height-m,e.y));
}