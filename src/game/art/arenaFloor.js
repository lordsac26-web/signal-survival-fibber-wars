export const ARENA_THEMES=Object.freeze([{id:'classic',name:'Signal Grid'},{id:'office',name:'Office'},{id:'worksite',name:'Worksite'},{id:'vault',name:'Vault'},{id:'nightWorksite',name:'Night Worksite'}]);
export const ARENA_BACKGROUND_IDS=Object.freeze(['office','worksite','vault','nightWorksite']);
export const MULTIPLAYER_ARENA_CHOICES=Object.freeze([{id:'random',name:'Random'},...ARENA_THEMES]);
// Runtime floor images live in the app's own assets (never hotlinked); the
// matching source JPEG beside each PNG is provenance for the crop pipeline.
export const FLOORS=Object.freeze({office:'/assets/arenas/office.png',worksite:'/assets/arenas/worksite.png',vault:'/assets/arenas/vault.png',nightWorksite:'/assets/arenas/night-worksite.png','night-worksite':'/assets/arenas/night-worksite.png'});
const cache=new Map();
function seedHash(seed,wave){
  const str=`${seed??1}:${wave}`;let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}
export function pickArenaTheme(seed,wave=1,previousTheme=null,pool=ARENA_BACKGROUND_IDS){
  if(!pool||!pool.length)return 'classic';
  if(pool.length===1)return pool[0];
  let prev=previousTheme==='night-worksite'?'nightWorksite':previousTheme;
  if(!prev&&wave>1){
    const startWave=Math.max(1,wave-32);
    for(let w=startWave;w<wave;w++){
      const choices=prev&&pool.includes(prev)?pool.filter(id=>id!==prev):pool;
      prev=choices[seedHash(seed,w)%choices.length];
    }
  }
  const choices=prev&&pool.includes(prev)?pool.filter(id=>id!==prev):pool;
  return choices[seedHash(seed,wave)%choices.length];
}
export function resolveMultiplayerArena(choice='random',seed=1,wave=1,previousTheme=null){
  const normalized=choice==='night-worksite'?'nightWorksite':choice;
  if(normalized&&normalized!=='random'&&ARENA_THEMES.some(t=>t.id===normalized))return normalized;
  return pickArenaTheme(seed,wave,previousTheme);
}
export function coverRect(iw,ih,w,h){const scale=Math.max((w+2)/iw,(h+2)/ih);return {x:(w-iw*scale)/2,y:(h-ih*scale)/2,width:iw*scale,height:ih*scale}}
export function bakeArenaFloor(image,w=1100,h=800){
  const floor=document.createElement('canvas');floor.width=w;floor.height=h;const ctx=floor.getContext('2d');
  const r=coverRect(image.naturalWidth,image.naturalHeight,w,h);ctx.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,r.x,r.y,r.width,r.height);
  ctx.fillStyle='rgba(15,41,46,.48)';ctx.fillRect(0,0,w,h);
  const shade=ctx.createRadialGradient(w/2,h/2,h*.12,w/2,h/2,w*.65);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);return floor;
}
export function preloadArenaFloor(theme){
  const src=FLOORS[theme];
  if(!src)return Promise.resolve(null);
  if(!cache.has(theme))cache.set(theme,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{image.decode().then(()=>resolve(bakeArenaFloor(image)),error=>{cache.delete(theme);reject(error)})};image.onerror=()=>{cache.delete(theme);reject(new Error('Arena floor failed to load'))};image.src=src}));
  return cache.get(theme);
}