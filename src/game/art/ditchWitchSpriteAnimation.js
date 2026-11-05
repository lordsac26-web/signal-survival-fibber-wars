import { DITCH, ditchRockOrigin } from '@/game/combat/ditchWitch';

export function ditchFrame(art,state,moving=true){
  const d=art.definition,mirror=state.facing==='left';
  if(state.phase==='dying'||state.phase==='dead'){
    const p=Math.min(1,Math.max(0,state.deathProgress??0));
    const idx=Math.min(d.counts.death-1,Math.floor(p*d.counts.death));
    return {image:art.death,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'death',frame:idx};
  }
  if(state.phase==='windup'){
    const p=1-Math.max(0,state.remaining)/DITCH.windup;
    const idx=Math.min(d.counts.windup-1,Math.floor(p*d.counts.windup));
    return {image:art.windup,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'windup',frame:idx};
  }
  if(state.phase==='charge'){
    const p=1-Math.max(0,state.remaining)/DITCH.chargeDuration;
    const idx=Math.min(d.counts.charge-1,Math.floor(p*d.counts.charge));
    return {image:art.charge,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'charge',frame:idx};
  }
  if(state.phase==='dig'){
    const p=1-Math.max(0,state.remaining)/DITCH.digDuration;
    const idx=Math.min(d.counts.dig-1,Math.floor(p*d.counts.dig));
    return {image:art.dig,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'dig',frame:idx};
  }
  if(state.phase==='chase'&&moving){
    const idx=Math.floor(state.clock*d.driveFps)%d.counts.drive;
    return {image:art.drive,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'drive',frame:idx};
  }
  const idx=Math.floor(state.clock*d.idleFps)%d.counts.idle;
  return {image:art.atlas,sx:idx*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror,strip:'idle',frame:idx};
}

export function drawDitchTelegraph(ctx,state,x,y){
  if(state.phase!=='windup')return;
  const frac=1-Math.max(0,state.remaining)/DITCH.windup;
  const ox=Math.round(x),oy=Math.round(y);
  ctx.save();
  if(state.mode==='charge'){
    const len=DITCH.chargeSpeed*DITCH.chargeDuration+DITCH.radius;
    const ex=Math.round(x+Math.cos(state.angle)*len),ey=Math.round(y+Math.sin(state.angle)*len);
    ctx.globalAlpha=.14+frac*.22;ctx.strokeStyle='#fb923c';ctx.lineWidth=DITCH.radius*1.6;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.globalAlpha=.45+frac*.4;ctx.strokeStyle='#fdba74';ctx.lineWidth=2;ctx.setLineDash([10,6]);
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
  }else{
    const half=DITCH.rockSpread*1.25,reach=DITCH.rockRange;
    ctx.globalAlpha=.12+frac*.2;ctx.fillStyle='#f59e0b';
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.arc(ox,oy,reach,state.angle-half,state.angle+half);ctx.closePath();ctx.fill();
    ctx.globalAlpha=.4+frac*.4;ctx.strokeStyle='#fde047';ctx.lineWidth=2;ctx.setLineDash([8,6]);
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.arc(ox,oy,reach,state.angle-half,state.angle+half);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawDitchWitch(ctx,art,state,x,y,moving=true){
  if(!art||!art.definition)return;
  const d=art.definition,f=ditchFrame(art,state,moving);
  const scale=d.worldSize/d.cellH;
  const dw=Math.round(d.cellW*scale),dh=Math.round(d.worldSize);
  const ax=Math.round(d.anchorX*scale),ay=Math.round((d.baselineY-d.cellH*.32)*scale);
  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y));
  if(f.mirror)ctx.scale(-1,1);
  ctx.drawImage(f.image,f.sx,f.sy,f.w,f.h,-ax,-ay,dw,dh);
  // Separated rock-spray burst VFX drawn at the blade tip so the body hitbox
  // is never sized to the scattered rocks.
  if(state.vfxT>0&&art.rocks){
    const rw=Math.round(108*scale*.85),rh=Math.round(96*scale*.85);
    ctx.globalAlpha=Math.min(1,state.vfxT/.16);
    ctx.drawImage(art.rocks,0,0,108,96,Math.round(DITCH.bladeReach*.7),-Math.round(rh*.65),rw,rh);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled=prev;
}

export function drawDitchRock(ctx,art,s){
  const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
  ctx.save();
  ctx.translate(Math.round(s.x),Math.round(s.y));
  ctx.rotate((s.traveled||0)*.05);
  if(art&&art.rocks){
    // Crop the central outlined boulder from the separated rocks VFX sheet (x=20..42, y=14..36)
    ctx.drawImage(art.rocks,20,14,22,22,-9,-9,18,18);
  }else{
    ctx.fillStyle='#78716c';ctx.beginPath();ctx.arc(0,0,s.r||7,0,7);ctx.fill();
  }
  ctx.restore();
  ctx.imageSmoothingEnabled=prev;
}
export default drawDitchWitch;