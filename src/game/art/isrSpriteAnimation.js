// Chair movement stays responsive during startup, firing, and heal feedback.
export const createISRAnimation=()=>({side:'right',attackFace:'right',frame:0,clock:0,moving:false,hurt:0,attack:0,special:0,heal:0});
export function updateISRAnimation(s,dx,dy,dt){
 s.hurt=Math.max(0,s.hurt-dt);s.attack=Math.max(0,s.attack-dt);
 s.heal=s.special>0?Math.max(0,s.heal-dt):0;
 s.moving=Math.abs(dx)+Math.abs(dy)>.001;
 if(s.moving&&Math.abs(dx)>.001)s.side=dx<0?'left':'right';
 s.clock+=dt;s.frame=Math.floor(s.clock*8)%9;
}
const names={atlas:'idle-front',walk:'walk-side',walkLeft:'walk-left',special:'special',attack:'attack',outageFx:'outage-fx',heal:'heal',healFx:'heal-fx'};
export function isrTile(art,key,frame,mirror=false){
 const d=art.manifest.outputs[names[key]],i=Math.max(0,Math.min(d.indices.length-1,frame));
 return {key,image:art[key],frame:i,sx:i*d.cellW,sy:0,w:d.cellW,h:d.cellH,ax:d.anchorX,ay:d.anchorY,mirror};
}
export function isrFrame(art,s){
 if(s.attack>0){
  const frame=s.moving?s.frame:Math.floor(Math.max(0,.4-s.attack)*12);
  if(s.special>0)return isrTile(art,'attack',Math.min(2,frame),s.attackFace==='left');
  return isrTile(art,s.attackFace==='left'?'walkLeft':'walk',frame);
 }
 if(s.moving)return isrTile(art,s.side==='left'?'walkLeft':'walk',s.frame);
 if(s.special>0){
  if(s.heal>0)return isrTile(art,'heal',Math.floor((.45-s.heal)*8)%2);
  const elapsed=8-s.special,{startupOrder,startupDuration}=art.manifest.special;
  if(elapsed<startupDuration)return isrTile(art,'special',startupOrder[Math.min(3,Math.floor(elapsed/.12))]);
  return isrTile(art,'attack',0);
 }
 return isrTile(art,'atlas',Math.floor(s.clock*5)%10);
}