import { PETE } from '@/game/data/bosses';
import { MACRO } from '@/game/combat/macrobend';
export const JITTER=Object.freeze({telegraph:1,recovery:.45,cooldown:12,initialMin:10,initialMax:15,radius:76*1.20,damage:12,activationRange:130,spawnWeight:.5});
export const createJitterState=(random=Math.random)=>({phase:'chase',remaining:0,cooldown:JITTER.initialMin+random()*(JITTER.initialMax-JITTER.initialMin),clock:0,melee:0,facing:'right'});
export function stepJitter(s,dt,{alive=true,playerAlive=true,dist=Infinity,visible=false,targetDx=0}={}){
 if(!alive){s.phase='dead';s.remaining=0;return null}
 if(s.phase==='dead')return null;
 s.clock+=dt;s.melee=Math.max(0,s.melee-dt);s.cooldown=Math.max(0,s.cooldown-dt);
 if(Math.abs(targetDx)>2)s.facing=targetDx<0?'left':'right';
 if(s.phase==='charge'){
  s.remaining=Math.max(0,s.remaining-dt);
  if(s.remaining<=1e-8){s.phase='recover';s.remaining=JITTER.recovery;s.cooldown=JITTER.cooldown;return 'fire'}
 }else if(s.phase==='recover'){
  s.remaining=Math.max(0,s.remaining-dt);if(s.remaining<=1e-8)s.phase='chase';
 }else if(s.cooldown<=1e-8&&playerAlive&&visible&&dist<=JITTER.activationRange){s.phase='charge';s.remaining=JITTER.telegraph;s.melee=0;return 'charge'}
 return null;
}
export function jitterVelocity(s,angle,speed){
 if(s.phase!=='chase')return {x:0,y:0};
 // Positive forward speed and a small lateral scuttle, never random wandering.
 const forward=speed*(.88+.12*Math.sin(s.clock*13)),side=speed*.14*Math.sin(s.clock*19);
 return {x:Math.cos(angle)*forward-Math.sin(angle)*side,y:Math.sin(angle)*forward+Math.cos(angle)*side};
}
export const jitterPulseHits=(s,dist,inv)=>s.phase==='recover'&&inv<=0&&dist<=JITTER.radius;
export function pickEnemyKind(types,wave,random=Math.random){
  const eligible=types.slice(0,Math.min(types.length,2+(wave/2|0))).filter(id=>id!=='peteMini');
  if(wave>=PETE.minWave&&!eligible.includes('pete'))eligible.push('pete');
  // MACROBEND BEAST: explicit wave-4 gate (the slice alone would surface it at
  // wave 6) and the same half-weight gate the Jitter Bug uses.
  if(wave>=MACRO.wave&&!eligible.includes('bend'))eligible.push('bend');
  const kind=eligible[Math.floor(random()*eligible.length)];
  if(kind!=='jitter'&&kind!=='bend'&&kind!=='pete')return kind;
  if(kind==='jitter'&&random()<JITTER.spawnWeight)return kind;
  if(kind==='bend'&&random()<MACRO.spawnWeight)return kind;
  if(kind==='pete'&&random()<PETE.spawnWeight)return kind;
  const ordinary=eligible.filter(id=>id!==kind);return ordinary[Math.floor(random()*ordinary.length)];
}