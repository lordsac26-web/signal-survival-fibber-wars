// Loaded assets are wrappers {definition, groundPuddle, ...}, NOT definitions.
export function puddingFootPoint(art,x,y){
 const d=art.definition,k=d.worldSize/d.cellH;
 return {x,y:y+(d.chargeAnchors[0][1]-d.chargeBodyTops[0])/2*k};
}
export function drawGroundPuddle(ctx,art,puddle){
 const d=art.definition,cw=d.puddleCellW,ch=d.puddleCellH,k=d.puddleScale;
 if(!Number.isFinite(cw*ch*k)||!art.groundPuddle)throw new Error('Invalid ground-puddle texture or dimensions');
 const fade=puddle.life<1?Math.max(0,puddle.life):1;
 const smooth=ctx.imageSmoothingEnabled;ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.globalAlpha=fade*.95;
 ctx.drawImage(art.groundPuddle,0,0,cw,ch,Math.round(puddle.x-cw*k/2),Math.round(puddle.y-ch*k/2),Math.round(cw*k),Math.round(ch*k));
 ctx.restore();ctx.imageSmoothingEnabled=smooth;
}