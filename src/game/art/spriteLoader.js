import { characterSprite } from '@/game/art/characterSprites';
const cache=new Map();
function image(url,width,height){return new Promise((resolve,reject)=>{
  const img=new globalThis.Image();
  img.onload=async()=>{try{await img.decode();if(img.naturalWidth!==width || img.naturalHeight!==height)throw new Error(`Unexpected image size: ${img.naturalWidth}×${img.naturalHeight}`);resolve(img)}catch(error){reject(error)}};
  img.onerror=()=>reject(new Error(`Oracle image failed to load: ${url}`));img.src=url;
})}
export function preloadCharacterSprite(id){
  const definition=characterSprite(id);if(!definition)return Promise.resolve(null);
  if(cache.has(id))return cache.get(id);
  const promise=Promise.all([image(definition.atlas,448,320),image(definition.portrait,256,256),fetch(definition.manifest).then(r=>{if(!r.ok)throw new Error(`Oracle manifest HTTP ${r.status}`);return r.json()})]).then(([atlas,portrait,manifest])=>{
    if(manifest.columns!==7 || manifest.rows!==5 || manifest.frameWidth!==64 || manifest.frameHeight!==64 || manifest.anchor.y!==definition.anchorY)throw new Error('Oracle manifest does not match atlas');
    // A single precomputed alpha-preserving hurt atlas, never a per-frame canvas/filter.
    const hurt=document.createElement('canvas');hurt.width=448;hurt.height=320;
    const ctx=hurt.getContext('2d');ctx.drawImage(atlas,0,0);ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(251,113,133,.6)';ctx.fillRect(0,0,448,320);
    return {definition,atlas,portrait,hurt};
  }).catch(error=>{cache.delete(id);throw error});
  cache.set(id,promise);return promise;
}