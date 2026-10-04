// Stable ids verified against characters.js (oracle) and combat.js ENEMIES (lag). Local files are byte-identical public uploads.
const source='https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/';
export const CHARACTER_SPRITES=Object.freeze({oracle:Object.freeze({
  atlas:'/assets/oracle/movement.png',portrait:'/assets/oracle/portrait.png',hurtTint:'rgba(251,113,133,.6)',
  manifest:'/assets/oracle/animation.json',
  sources:{atlas:source+'6000b350b_oracle-movement.png',portrait:source+'ddab5b16f_oracle-portrait.png',manifest:source+'e3ac4cbf8_oracle-animation.json'},
  width:448,height:320,cell:64,columns:7,rows:5,fps:8,worldSize:48,
  anchorX:.5,anchorY:.90625,
  // Inspected supplied atlas: row 1 faces left, row 2 right, all seven columns usable.
  directions:{down:0,left:64,right:128,up:192},idleRow:256
})});
export const characterSprite=id=>CHARACTER_SPRITES[id] || null;
// Lag Sprite enemy — same definition/manifest/anchor convention as the character sprites,
// plus an attack atlas. Pixel-inspected: front row is camera-facing (symmetric highlights);
// side-row highlights sit right → the side row faces RIGHT, so left movement mirrors it.
export const ENEMY_SPRITES=Object.freeze({lag:Object.freeze({
  atlas:'/assets/lagsprite/movement.png',attack:'/assets/lagsprite/attack.png',portrait:'/assets/lagsprite/portrait.png',
  manifest:'/assets/lagsprite/animation.json',
  sources:{atlas:source+'2492cec76_lagsprite-movement.png',attack:source+'1dfb1e925_lagsprite-attack.png',portrait:source+'645d0e291_lagsprite-portrait.png',manifest:source+'c1df7b69d_lagsprite-animation.json'},
  atlasW:384,atlasH:128,cell:64,columns:6,rows:2,fps:8,worldSize:48,
  anchorX:.5,anchorY:.90625,portraitSize:256,attackW:128,attackH:64,
  frontRow:0,sideRow:64,sideFaces:'right',attackFront:0,attackSide:64,
  manifestSpec:{frameWidth:64,frameHeight:64,'anchor.x':.5,'anchor.y':.90625,'movementAtlas.columns':6,'movementAtlas.rows':2,'attackAtlas.columns':2,'attackAtlas.rows':1,fps:8}
})});
export const enemySpriteDef=id=>ENEMY_SPRITES[id] || null;
// Bucket-Truck turret — EXCLUSIVE to the shop's Bucket Truck Keys deployable
// (turretMount). Per its manifest the 3 tiles are near-duplicate poses of the
// same truck, NOT a boom sweep — rendered as a slow ~1.5s/frame idle cycle
// only, never presented as target tracking. The Boss's signature sentry and
// all other turrets keep their placeholders; no googly eyes on the truck.
export const STRUCTURE_SPRITES=Object.freeze({bucket:Object.freeze({
  atlas:'/assets/buckettruck/turret.png',portrait:'/assets/buckettruck/icon.png',
  manifest:'/assets/buckettruck/animation.json',
  sources:{atlas:source+'53bcc4815_buckettruck-turret.png',icon:source+'8c553ef43_buckettruck-icon.png',manifest:source+'cb0ba0033_buckettruck-animation.json'},
  atlasW:690,atlasH:190,tileW:230,tileH:190,columns:3,rows:1,fps:1.5,idleCycle:3,worldSize:64,anchorY:174,portraitW:234,portraitH:204,
  structureType:'turretMount',
  manifestSpec:{structureId:'bucket_truck_turret',tileWidth:230,tileHeight:190,rightEdgeAnchorX:210,groundBaselineY:174,'animation.type':'idle_cycle','animation.fps':1.5}
})});
export const structureSpriteDef=id=>STRUCTURE_SPRITES[id] || null;