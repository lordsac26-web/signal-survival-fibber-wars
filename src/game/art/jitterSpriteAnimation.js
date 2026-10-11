import { JITTER } from '@/game/combat/jitter';
export function jitterFrame(s,moving=true){
 if(s.phase==='charge')return {row:3,index:s.remaining>.8?0:1};
 if(s.phase==='recover'){const t=JITTER.recovery-s.remaining;return {row:3,index:t<.12?2:t<.25?3:4}}
 if(s.melee>0)return {row:2,index:Math.max(0,Math.min(3,Math.floor((1/3-s.melee)*12+1e-6)))};
 return moving?{row:1,index:Math.floor(s.clock*10)%5}:{row:0,index:Math.floor(s.clock*5)%4};
}
export function drawJitterSprite(ctx,art,s,x,y,moving){
 const d=art.definition,f=jitterFrame(s,moving),k=d.sourceScale;
 const smooth=ctx.imageSmoothingEnabled;ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.translate(Math.round(x),Math.round(y+d.groundOffset));
 if(s.phase==='charge')ctx.translate(Math.sin(s.clock*55)>0?1:-1,0);
 if(s.facing==='left')ctx.scale(-1,1);
 ctx.drawImage(art.atlas,f.index*d.cellW,f.row*d.cellH,d.cellW,d.cellH,Math.round(-d.anchorX*k),Math.round(-d.anchorY*k),Math.round(d.cellW*k),Math.round(d.cellH*k));
 ctx.restore();ctx.imageSmoothingEnabled=smooth;
 if(s.phase==='charge'||s.phase==='recover'){
  ctx.save();const charging=s.phase==='charge';ctx.globalAlpha=charging?.3+.45*(1-s.remaining/JITTER.telegraph):s.remaining/JITTER.recovery*.65;
  ctx.strokeStyle=charging?'#67e8f9':'#fde047';ctx.fillStyle='#67e8f9';ctx.lineWidth=charging?2:3;
  ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),JITTER.radius,0,Math.PI*2);ctx.stroke();
  if(charging){ctx.globalAlpha=.08;ctx.fill()}ctx.restore();
 }
}