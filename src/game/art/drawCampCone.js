import { coneOrigin } from '@/game/combat/coneAttack';
// Shared world-space warning, under sprites; the arc is exactly the hit geometry.
export default function drawCampCone(ctx,state){
  if(!state||!['windup','fire'].includes(state.phase))return;
  const origin=coneOrigin(state);ctx.save();ctx.fillStyle=state.phase==='fire'?'rgba(251,113,133,.38)':'rgba(251,191,36,.13)';ctx.strokeStyle=state.phase==='fire'?'#fb7185':'#fbbf24';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(Math.round(origin.x),Math.round(origin.y));ctx.arc(Math.round(origin.x),Math.round(origin.y),state.reach,state.angle-state.half,state.angle+state.half);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}