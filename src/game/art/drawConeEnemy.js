import { APPARITION, ROUTER_ATTACK, coneOrigin } from '@/game/combat/coneAttack';
const sector=(ctx,s)=>{const o=coneOrigin(s);ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.arc(o.x,o.y,s.reach,s.angle-s.half,s.angle+s.half);ctx.closePath()};
export default function drawConeEnemy(ctx,art,s,x,y){
  const d=art.definition,c=d===undefined?APPARITION:d.manifestSpec.id==='rous'?ROUTER_ATTACK:APPARITION,router=c.id==='rous';
  let key=s.phase==='focus'?'focus':s.phase==='windup'?(router?'windup':'attack'):s.phase==='fire'?(router?'fire':'attack'):s.phase==='recover'&&!router?'attack':s.phase==='chase'?(router&&Math.abs(s.vy)>Math.abs(s.vx)?'up':s.facing):'idle';
  let count=d.counts[key],progress=0;
  if(s.phase==='windup')progress=1-s.remaining/c.windup;
  if(s.phase==='fire')progress=1-s.remaining/c.fire;
  if(s.phase==='focus')progress=1-s.remaining/c.focus;
  let frame=['focus','windup','fire'].includes(s.phase)?Math.min(count-1,Math.floor(progress*count)):Math.floor(s.clock*7)%count;
  if(!router&&s.phase==='windup')frame=Math.min(3,Math.floor(progress*4));
  if(!router&&s.phase==='fire')frame=4;
  if(!router&&s.phase==='recover')frame=Math.min(6,5+Math.floor((1-s.remaining/c.recovery)*2));
  const scale=d.worldSize/128,img=key==='idle'?art.atlas:art[key];
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y));if(['attack','windup','fire'].includes(key)&&s.facing==='left')ctx.scale(-1,1);
  ctx.drawImage(img,frame*128,0,128,128,Math.round(-64*scale),Math.round(-d.anchorY*scale),Math.round(d.worldSize),Math.round(d.worldSize));ctx.restore();
  if(s.phase==='focus'){ctx.save();ctx.strokeStyle='#93c5fd';ctx.globalAlpha=.4+progress*.5;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,18+progress*38,0,Math.PI*2);ctx.stroke();ctx.restore()}
  if(s.phase!=='windup'&&s.phase!=='fire')return;
  ctx.save();sector(ctx,s);ctx.strokeStyle=router?'#fde047':'#93c5fd';ctx.fillStyle=router?'#fde047':'#93c5fd';ctx.lineWidth=2;ctx.globalAlpha=s.phase==='windup'?.12:s.released?.35:.15;ctx.fill();ctx.globalAlpha=.65;ctx.stroke();
  if(s.phase==='fire'){
    sector(ctx,s);ctx.clip();const o=coneOrigin(s);ctx.translate(o.x,o.y);ctx.rotate(s.angle);ctx.globalAlpha=.9;ctx.imageSmoothingEnabled=false;
    const height=2*s.reach*Math.tan(s.half),width=router?s.reach*(.25+.75*frame/7):s.reach;
    if(router)ctx.drawImage(art.beam,frame*128,0,128,112,0,-height/2,width,height);
    else ctx.drawImage(art.wave,0,0,128,104,0,-height/2,width,height);
  }
  ctx.restore();
}