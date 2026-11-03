export const ARENA_THEMES=Object.freeze([{id:'classic',name:'Signal Grid'},{id:'office',name:'Office'}]);
const cache=new Map();
export function coverRect(iw,ih,w,h){const scale=Math.max((w+2)/iw,(h+2)/ih);return {x:(w-iw*scale)/2,y:(h-ih*scale)/2,width:iw*scale,height:ih*scale}}
export function bakeArenaFloor(image,w=1100,h=800){
  const floor=document.createElement('canvas');floor.width=w;floor.height=h;const ctx=floor.getContext('2d');
  const r=coverRect(image.naturalWidth,image.naturalHeight,w,h);ctx.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,r.x,r.y,r.width,r.height);
  ctx.fillStyle='rgba(15,41,46,.48)';ctx.fillRect(0,0,w,h);
  const shade=ctx.createRadialGradient(w/2,h/2,h*.12,w/2,h/2,w*.65);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);return floor;
}
export function preloadArenaFloor(theme){
  if(theme!=='office')return Promise.resolve(null);
  if(!cache.has(theme))cache.set(theme,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{image.decode().then(()=>resolve(bakeArenaFloor(image)),error=>{cache.delete(theme);reject(error)})};image.onerror=()=>{cache.delete(theme);reject(new Error('Office floor failed to load'))};image.src='/assets/arenas/office.png'}));
  return cache.get(theme);
}