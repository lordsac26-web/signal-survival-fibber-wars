import { characterSprite, enemySpriteDef, structureSpriteDef } from '@/game/art/characterSprites';
const cache=new Map();
function image(url,width,height){return new Promise((resolve,reject)=>{
  const img=new globalThis.Image();
  img.onload=async()=>{try{await img.decode();if(img.naturalWidth!==width || img.naturalHeight!==height)throw new Error(`Unexpected image size: ${img.naturalWidth}×${img.naturalHeight}`);resolve(img)}catch(error){reject(error)}};
  img.onerror=()=>reject(new Error(`Sprite image failed to load: ${url}`));img.src=url;
})}
function matches(manifest,spec){for(const [key,expected] of Object.entries(spec)){const actual=key.split('.').reduce((o,p)=>o?.[p],manifest);if(actual!==expected)return false}return true}
function hurtAtlas(atlas,width,height,tint){const hurt=document.createElement('canvas');hurt.width=width;hurt.height=height;const ctx=hurt.getContext('2d');ctx.drawImage(atlas,0,0);ctx.globalCompositeOperation='source-atop';ctx.fillStyle=tint;ctx.fillRect(0,0,width,height);return hurt}
// One shared preload path for every sprite definition (characters and enemies).
// Atlas/portrait/manifest start in parallel; per-definition extras (attack
// atlas, hurt tint) resolve after the core set validates.
function preloadSprite(definition){
  if(!definition)return Promise.resolve(null);
  if(cache.has(definition))return cache.get(definition);
  const atlasW=definition.atlasW ?? definition.width,atlasH=definition.atlasH ?? definition.height,portraitSize=definition.portraitSize||256,portraitW=definition.portraitW||portraitSize,portraitH=definition.portraitH||portraitSize;
  const spec=definition.manifestSpec || {columns:definition.columns,rows:definition.rows,frameWidth:definition.cell,frameHeight:definition.cell,'anchor.y':definition.anchorY};
  const promise=Promise.all([
    image(definition.atlas,atlasW,atlasH),
    image(definition.portrait,portraitW,portraitH),
    fetch(definition.manifest).then(r=>{if(!r.ok)throw new Error(`Sprite manifest HTTP ${r.status}`);return r.json()})
  ]).then(async([atlas,portrait,manifest])=>{
    if(!matches(manifest,spec))throw new Error('Sprite manifest does not match atlas');
    const art={definition,atlas,portrait};
    for(const [key,url,width,height] of definition.extras || [])art[key]=await image(url,width,height);
    if(definition.attackW)art.attack=await image(definition.attack,definition.attackW,definition.attackH);
    if(definition.hurtTint)art.hurt=hurtAtlas(atlas,atlasW,atlasH,definition.hurtTint);
    return art;
  }).catch(error=>{cache.delete(definition);throw error});
  cache.set(definition,promise);return promise;
}
export const preloadCharacterSprite=id=>preloadSprite(characterSprite(id));
export const preloadEnemySprite=kind=>preloadSprite(enemySpriteDef(kind));
export const preloadStructureSprite=id=>preloadSprite(structureSpriteDef(id));