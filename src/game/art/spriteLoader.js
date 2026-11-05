import { characterSprite, enemySpriteDef, structureSpriteDef } from '@/game/art/characterSprites';
import { TOOL_ICON_ATLAS } from '@/game/art/toolAtlas';
const cache=new Map();
function image(url,width,height){return new Promise((resolve,reject)=>{
  const img=new globalThis.Image();
  img.onload=async()=>{try{await img.decode();if(img.naturalWidth!==width || img.naturalHeight!==height)throw new Error(`Unexpected image size: ${img.naturalWidth}×${img.naturalHeight}`);resolve(img)}catch(error){reject(error)}};
  img.onerror=()=>reject(new Error(`Sprite image failed to load: ${url}`));img.src=url;
})}
function matches(manifest,spec){for(const [key,expected] of Object.entries(spec)){const actual=key.split('.').reduce((o,p)=>o?.[p],manifest);if(actual!==expected)return key}return null}
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
    const mismatch=matches(manifest,spec);
    if(mismatch){const actual=mismatch.split('.').reduce((o,p)=>o?.[p],manifest);throw new Error(`Sprite manifest mismatch: ${mismatch}, expected ${spec[mismatch]}, received ${actual}`);}
    const art={definition,atlas,portrait,...(definition.seated?{manifest}:{})};
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
// Shared tool/item icon atlas (store, inventory, HUD bar, Field Guide). One
// image for every menu icon: this loads and size-validates it once so the
// first shop screen never flashes an empty icon; failures resolve to null and
// each icon simply keeps its existing glyph.
let toolAtlasPromise=null;
export const preloadToolAtlas=()=>toolAtlasPromise || (toolAtlasPromise=image(TOOL_ICON_ATLAS.url,TOOL_ICON_ATLAS.width,TOOL_ICON_ATLAS.height).catch(()=>null));
// Static single-image art (deployable sprites): loaded once, size-validated.
// The barricade A-frame and the two splice-cabinet states are local copies of
// the public uploads (same bytes, so offline tests read the identical file).
export const STATIC_SPRITES=Object.freeze({
  barricade:{path:'/assets/barricade/barricade.png',width:88,height:96,source:'https://media.base44.com/images/public/6aab67049cd04a621f2adf4f/4aab76b35_barricade.png'},
  spliceCabinetIdle:{path:'/assets/splicecabinet/idle.png',width:96,height:85,source:'https://media.base44.com/images/public/6aab67049cd04a621f2adf4f/00c91b85e_splice-cabinet.png'},
  spliceCabinetActive:{path:'/assets/splicecabinet/active.png',width:82,height:96,source:'https://media.base44.com/images/public/6aab67049cd04a621f2adf4f/85bdf3d55_splice-cabinet-active.png'}
});
const staticCache=new Map();
export function preloadStaticSprite(key){
  const def=STATIC_SPRITES[key];if(!def)return Promise.reject(new Error('Unknown static sprite: '+key));
  if(staticCache.has(key))return staticCache.get(key);
  const promise=image(def.path,def.width,def.height).catch(error=>{staticCache.delete(key);throw error});
  staticCache.set(key,promise);return promise;
}