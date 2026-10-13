import { MACRO } from '@/game/combat/macrobend';
// Macrobend Beast animation. The special strip carries the whole cast:
// frames 0-2 are the coil (squeeze) poses, frame 3 is the twist-release held
// through the first half of recovery, frame 4 the snap-back. Drawn centered
// on the collider like every other enemy sprite; strips are per-frame
// bottom-packed cells so one worldSize keeps body sizes visually equal.
export const createBendAnimation=()=>({clock:0,frame:0,moving:false,facing:'right',attack:0,phase:'chase',coilT:-1,releaseF:-1});
export function updateBendAnimation(state,mvx,mvy,dt,mac){
 state.attack=Math.max(0,state.attack-dt);
 const moving=Math.abs(mvx)+Math.abs(mvy)>.001;
 if(moving){state.clock+=dt;if(mvx<-.001)state.facing='left';else if(mvx>.001)state.facing='right'}
 state.moving=moving;
 state.phase=mac?mac.phase:'chase';
 state.coilT=mac&&mac.phase==='coil'?1-mac.remaining/MACRO.telegraph:-1;
 state.releaseF=mac&&mac.phase==='recover'?(mac.remaining>MACRO.recovery/2?3:4):-1;
}
// Pure frame selection so wiring is testable without a canvas.
export function bendFrame(art,state){
 const d=art.definition;
 if(state.phase==='coil')return {image:art.special,sx:Math.min(2,Math.floor(Math.max(0,state.coilT)*3))*d.specialCellW,sy:0,w:d.specialCellW,h:d.specialCellH,mirror:state.facing==='left'};
 if(state.releaseF>=0)return {image:art.special,sx:state.releaseF*d.specialCellW,sy:0,w:d.specialCellW,h:d.specialCellH,mirror:state.facing==='left'};
 if(state.attack>0)return {image:art.attack,sx:Math.min(d.attackColumns-1,Math.floor((1-state.attack/.35)*d.attackColumns))*d.attackCellW,sy:0,w:d.attackCellW,h:d.attackCellH,mirror:state.facing==='left'};
 if(state.moving)return {image:art.walk,sx:Math.floor(state.clock*d.walkFps)%d.walkColumns*d.walkCellW,sy:0,w:d.walkCellW,h:d.walkCellH,mirror:state.facing==='left'};
 return {image:art.atlas,sx:Math.floor(state.clock*d.idleFps)%d.columns*d.cellW,sy:0,w:d.cellW,h:d.cellH,mirror:state.facing==='left'};
}
export function drawBendSprite(ctx,art,state,x,y){
 const d=art.definition,f=bendFrame(art,state);
 const h=d.worldSize,w=Math.round(d.worldSize*f.w/f.h);
 const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));if(f.mirror)ctx.scale(-1,1);
 ctx.drawImage(f.image,f.sx,f.sy,f.w,f.h,Math.round(-w/2),Math.round(-h/2),w,h);
 ctx.restore();ctx.imageSmoothingEnabled=previousSmoothing;
}
// Cast ring: the cropped ring sprite spins with travel distance, drawn as a
// ~28-unit diameter orb centered on the projectile point.
export function drawBendRing(ctx,art,s){
 const img=art.ring,d=art.definition,size=28;
 const previousSmoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
 ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y));ctx.rotate((s.traveled||0)*.04);
 ctx.drawImage(img,-size*d.extras[3][2]/d.extras[3][3]/2,-size/2,size*116/92,size);
 ctx.restore();ctx.imageSmoothingEnabled=previousSmoothing;
}