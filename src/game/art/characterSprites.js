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
}),don:Object.freeze({
  atlas:'/assets/don/idle-front.png',portrait:'/assets/don/portrait.png',manifest:'/assets/don/animation.json',hurtTint:'rgba(251,113,133,.6)',
  extras:[['back','/assets/don/idle-back.png',1170,190],['walk','/assets/don/walk-side.png',1170,190],['signal','/assets/don/signal-poses.png',520,190]],
  sources:{atlas:source+'cd24a6944_don_idle_front.png',portrait:source+'0a52d8d76_don-portrait.png',back:source+'b3e497e7f_don_idle_back.png',walk:source+'54be9d69f_don_walk_side.png',signal:source+'017a98330_don_signal_poses.png'},
  atlasW:1170,atlasH:190,cellW:130,cellH:190,columns:9,rows:1,idleFps:5,walkFps:10,gestureHold:.8,signalFrameW:130,
  worldSize:52,anchorX:.5,anchorY:.9,portraitW:127,portraitH:193,
  manifestSpec:{frameWidth:130,frameHeight:190,'idleFront.columns':9,'idleBack.columns':9,'walkSide.columns':9,'walkSide.facing':'right','signalPoses.columns':4,fps:8}
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
}),squirrel:Object.freeze({
  atlas:'/assets/squirrel/idle-front.png',attack:'/assets/squirrel/fec-attack.png',portrait:'/assets/squirrel/portrait.png',manifest:'/assets/squirrel/animation.json',
  extras:[['back','/assets/squirrel/idle-back.png',1020,170],['walk','/assets/squirrel/walk-side.png',1020,170]],
  sources:{atlas:source+'74fcd8572_boss_idle_front.png',attack:source+'cdaad81d2_boss_fec_attack.png',portrait:source+'f08b0630c_boss_portrait.png',back:source+'4dab873b1_boss_idle_back.png',walk:source+'56d978f24_boss_walk_side.png'},
  atlasW:1020,atlasH:170,cell:170,columns:6,rows:1,idleFps:6,walkFps:10,worldSize:76,
  attackW:1100,attackH:200,attackFrameW:220,attackFrameH:200,coneFrames:5,windup:.8,releaseHold:.25,
  portraitW:147,portraitH:187,
  manifestSpec:{frameWidth:170,frameHeight:170,'idleFront.columns':6,'idleBack.columns':6,'walkSide.columns':6,'walkSide.facing':'right','attackAtlas.frameWidth':220,'attackAtlas.frameHeight':200,'attackAtlas.columns':5,fps:8}
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