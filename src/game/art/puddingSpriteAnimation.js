import { PUDDING } from '@/game/combat/puddles';

// Packet-Loss Pudding animation + drawing. Movement is a 10-frame cycle
// (row 1: 4 poses, row 2: 6 poses, both facing right — left is mirrored).
// The melee strip (neutral, extend, impact, recover) plays at 12fps on the
// ordinary contact tick: the existing single contact hit IS the melee, no
// extra damage is added. Telegraph plays the 4 glowing charge poses with a
// render-only shake (logical position stays rooted, so the drop anchor never
// jitters). The drop strip's first 2 poses play as a brief release flash on
// the enemy; poses 3-4 (flattened goo) belong to the ground puddle instead.
export const MELEE_LEN=1/3;

export const createPuddingAnimation=()=>({frame:0,clock:0,facing:'right',motionAxis:null,telegraph:false,teleClock:0,melee:0,dropT:0});

export function updatePuddingAnimation(state,dx,dy,dt,def){
 state.melee=Math.max(0,state.melee-dt);
 state.dropT=Math.max(0,state.dropT-dt);
 if(state.telegraph){state.teleClock+=dt;state.frame=Math.floor(state.teleClock*8)%def.chargeColumns;return}
 state.teleClock=0;
 if(state.dropT>0){state.frame=Math.min(def.dropEnemyFrames-1,Math.floor((.25-state.dropT)*8));return}
 if(state.melee>0){state.frame=Math.min(def.attackColumns-1,Math.floor((MELEE_LEN-state.melee)*def.attackFps));return}
 const moving=Math.abs(dx)+Math.abs(dy)>.001;
 if(!moving){state.clock=0;state.frame=0;return}
 const motionAxis=Math.abs(dx)>.01?'horizontal':'vertical';
 if(state.motionAxis!==motionAxis){state.motionAxis=motionAxis;state.clock=0}
 if(motionAxis==='horizontal')state.facing=dx<0?'left':'right';
 state.clock+=dt;
 state.frame=Math.floor(state.clock*(motionAxis==='vertical'?def.fps/2:def.fps)+1e-6)%def.columns;
}

// Pure frame selection so wiring is testable without a canvas.
export function puddingFrame(art,state){
 const d=art.definition;
 if(state.telegraph){const i=Math.min(d.chargeColumns-1,state.frame);return{image:art.charge,sx:i*d.chargeCellW,sy:0,w:d.chargeCellW,h:d.chargeCellH,ax:d.chargeAnchors[i][0],ay:d.chargeAnchors[i][1],bodyTop:d.chargeBodyTops[i],mirror:state.facing==='left'}}
 if(state.dropT>0){const i=Math.min(d.dropEnemyFrames-1,state.frame);return{image:art.drop,sx:i*d.dropCellW,sy:0,w:d.dropCellW,h:d.dropCellH,ax:d.dropAnchors[i][0],ay:d.dropAnchors[i][1],bodyTop:d.dropBodyTops[i],mirror:state.facing==='left'}}
 if(state.melee>0){const i=state.frame;return{image:art.attack,sx:i*d.attackCellW,sy:0,w:d.attackCellW,h:d.attackCellH,ax:d.attackAnchors[i][0],ay:d.attackAnchors[i][1],bodyTop:d.attackBodyTops[i],mirror:state.facing==='left'}}
 const i=state.frame%d.columns,rowA=i<d.moveAColumns;
 return{image:art.atlas,sx:(rowA?i:i-d.moveAColumns)*d.cellW,sy:rowA?0:d.cellH,w:d.cellW,h:d.cellH,ax:d.moveAnchors[i][0],ay:d.moveAnchors[i][1],bodyTop:d.moveBodyTops[i],mirror:state.facing==='left'};
}

// Body frames: the measured foot anchor (ax) maps to the entity point and the
// body's vertical center rides the collision circle; enemies stay centered on
// their collision point like every other enemy sprite.
export function drawPuddingSprite(ctx,art,state,x,y){
 const f=puddingFrame(art,state),k=art.definition.worldSize/art.definition.cellH;
 const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));
 if(state.telegraph)ctx.translate((state.teleClock*46)%2<1?1:-1,0); // render-only telegraph shake
 if(f.mirror)ctx.scale(-1,1);
 ctx.drawImage(f.image,f.sx,f.sy,f.w,f.h,Math.round(-f.ax*k),Math.round(-(f.ay+f.bodyTop)/2*k),Math.round(f.w*k),Math.round(f.h*k));
 ctx.restore();
 if(state.telegraph){ // cyan pulse ring on the exact drop spot (cosmetic telegraph)
  const p=state.teleClock/PUDDING.telegraph;
  ctx.save();ctx.globalAlpha=.25+.35*Math.min(1,p);ctx.strokeStyle='#67e8f9';ctx.lineWidth=2;ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),PUDDING.radius,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore();
 }
 ctx.imageSmoothingEnabled=prev;
}