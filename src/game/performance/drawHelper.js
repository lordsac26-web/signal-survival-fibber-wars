export function drawHelper(ctx,x,y,color){
  ctx.fillStyle='#172033';ctx.fillRect(x-9,y-1,18,22);
  ctx.fillStyle=color;ctx.fillRect(x-7,y+3,14,11);
  ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(x,y-4,8,Math.PI,0);ctx.fill();ctx.fillRect(x-10,y-5,20,3);
  ctx.fillStyle='#fff';ctx.fillRect(x-6,y-1,5,5);ctx.fillRect(x+1,y-1,5,5);
  ctx.fillStyle='#172033';ctx.fillRect(x-3,y,2,3);ctx.fillRect(x+3,y,2,3);
  ctx.fillStyle='#fff7d0';ctx.fillRect(x-5,y+4,2,8);ctx.fillRect(x+3,y+4,2,8);
}