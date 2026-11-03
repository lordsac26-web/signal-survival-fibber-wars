import { CROSSTALK } from '@/game/combat/crosstalk';
export default function drawCrosstalk(ctx,art,s,x,y){
  const d=art.definition,wind=s.phase==='windup',lunge=s.phase==='lunge';
  const key=wind||lunge?'lunge':s.phase==='chase'?'move':'atlas';
  const count=key==='move'?6:4,baseFace=key==='move'?'left':'right';
  const frame=wind?0:lunge?Math.min(3,Math.floor((1-s.remaining/CROSSTALK.lunge)*4)):Math.floor(s.clock*(key==='move'?11:6))%count;
  const scale=d.worldHeight/d.cellH;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y));if(s.facing!==baseFace&&key!=='atlas')ctx.scale(-1,1);
  ctx.drawImage(art[key],frame*d.cellW,0,d.cellW,d.cellH,Math.round(-d.anchorX*scale),Math.round(-d.anchorY*scale),Math.round(d.cellW*scale),Math.round(d.cellH*scale));ctx.restore();
  if(wind){const reach=CROSSTALK.lungeSpeed*CROSSTALK.lunge;ctx.save();ctx.strokeStyle='#a5f3fc';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(Math.round(x),Math.round(y));ctx.lineTo(Math.round(x+Math.cos(s.angle)*reach),Math.round(y+Math.sin(s.angle)*reach));ctx.stroke();ctx.restore()}
}