import { isrFrame, isrTile } from '@/game/art/isrSpriteAnimation';
// Same fixed logical-body scale for EVERY tile, including padded wide effects.
export function drawISRTile(ctx,art,f,x,y){
 const k=art.definition.worldSize/64;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));if(f.mirror)ctx.scale(-1,1);
 ctx.drawImage(f.image,f.sx,f.sy,f.w,f.h,Math.round(-f.ax*k),Math.round(-f.ay*k),Math.round(f.w*k),Math.round(f.h*k));ctx.restore();
}
export function isrMuzzlePoint(art,state,x,y){
 const f=isrFrame(art,state),mu=art.manifest.muzzles[f.key]?.[f.frame];
 if(!mu)throw Error('ISR firing frame has no laptop muzzle');
 const k=art.definition.worldSize/64;
 return {x:x+(f.mirror?-1:1)*(mu[0]-f.ax)*k,y:y+(mu[1]-f.ay)*k};
}
export function drawISR(ctx,art,s,x,y){
 const prev=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
 const frame=isrFrame(art,s);
 if(s.special>0){ctx.save();ctx.globalAlpha*=.65;drawISRTile(ctx,art,isrTile(art,'outageFx',Math.floor(s.clock*6)%2),x,y);ctx.restore()}
 drawISRTile(ctx,art,frame,x,y);
 if(s.special>0&&s.heal>0&&frame.key!=='heal')drawISRTile(ctx,art,isrTile(art,'healFx',Math.floor((.45-s.heal)*8)%2),x,y);
 ctx.imageSmoothingEnabled=prev;
}