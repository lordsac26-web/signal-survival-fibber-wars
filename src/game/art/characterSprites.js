// Stable ids verified against characters.js and combat.js ENEMIES. Local files
// are processed transparent atlases (background keyed, frames repacked).
const source='https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/';

// ── Shared helper: builds a technician sprite definition from measured atlas data.
// Each character has: idle-front (atlas), walk-side, walk-left (true art),
// attack, special — all as horizontally tiled, foot-aligned, equal-cell strips.
function tech(id,portraitW,portraitH,idle,walk,walkLeft,attack,special){
  const extras=[
    ['walk',`/assets/${id}/walk-side.png`,walk.atlasW,walk.atlasH],
    ['walkLeft',`/assets/${id}/walk-left.png`,walkLeft.atlasW,walkLeft.atlasH],
    ['attack',`/assets/${id}/attack.png`,attack.atlasW,attack.atlasH],
    ['special',`/assets/${id}/special.png`,special.atlasW,special.atlasH]
  ];
  return Object.freeze({
    atlas:`/assets/${id}/idle-front.png`,portrait:`/assets/${id}/portrait.png`,manifest:`/assets/${id}/animation.json`,hurtTint:'rgba(251,113,133,.6)',
    extras,
    atlasW:idle.atlasW,atlasH:idle.atlasH,cellW:idle.cellW,cellH:idle.cellH,columns:idle.frames,
    walkColumns:walk.frames,walkCellW:walk.cellW,walkCellH:walk.cellH,
    walkLeftColumns:walkLeft.frames,walkLeftCellW:walkLeft.cellW,walkLeftCellH:walkLeft.cellH,
    attackColumns:attack.frames,attackCellW:attack.cellW,attackCellH:attack.cellH,
    specialColumns:special.frames,specialCellW:special.cellW,specialCellH:special.cellH,
    idleBreathFrames:6,idleFps:5,walkFps:10,attackFps:12,specialFps:3,
    attackDuration:.4,gestureHold:.8,muzzle:attack.muzzle,
    worldSize:52,anchorX:.5,anchorY:.9,portraitW,portraitH,
    manifestSpec:{
      frameWidth:idle.cellW,frameHeight:idle.cellH,
      'idleFront.columns':idle.frames,
      'walkSide.columns':walk.frames,'walkSide.facing':'right',
      'walkLeft.columns':walkLeft.frames,'walkLeft.facing':'left',
      'attack.columns':attack.frames,
      'special.columns':special.frames,
      fps:8,
      ...(attack.muzzle?{'muzzle.x':attack.muzzle.x,'muzzle.y':attack.muzzle.y}:{})
    }
  });
}

export const CHARACTER_SPRITES=Object.freeze({
oracle:Object.freeze({
  atlas:'/assets/oracle/movement.png',portrait:'/assets/oracle/portrait.png',hurtTint:'rgba(251,113,133,.6)',
  manifest:'/assets/oracle/animation.json',
  sources:{atlas:source+'6000b350b_oracle-movement.png',portrait:source+'ddab5b16f_oracle-portrait.png',manifest:source+'e3ac4cbf8_oracle-animation.json'},
  width:448,height:320,cell:64,columns:7,rows:5,fps:8,worldSize:48,
  anchorX:.5,anchorY:.90625,
  directions:{down:0,left:64,right:128,up:192},idleRow:256
}),
veteran:Object.freeze(tech('veteran',78,132,
  {atlasW:675,atlasH:120,cellW:75,cellH:120,frames:9},
  {atlasW:544,atlasH:113,cellW:68,cellH:113,frames:8},
  {atlasW:544,atlasH:113,cellW:68,cellH:113,frames:8},
  {atlasW:792,atlasH:124,cellW:132,cellH:124,frames:6},
  {atlasW:1939,atlasH:119,cellW:277,cellH:119,frames:7}
)),
clone:Object.freeze(tech('clone',74,124,
  {atlasW:648,atlasH:112,cellW:72,cellH:112,frames:9},
  {atlasW:504,atlasH:114,cellW:63,cellH:114,frames:8},
  {atlasW:520,atlasH:115,cellW:65,cellH:115,frames:8},
  {atlasW:720,atlasH:112,cellW:120,cellH:112,frames:6},
  {atlasW:1448,atlasH:114,cellW:181,cellH:114,frames:8}
)),
don:Object.freeze(tech('don',94,136,
  {atlasW:792,atlasH:124,cellW:88,cellH:124,frames:9},
  {atlasW:608,atlasH:122,cellW:76,cellH:122,frames:8},
  {atlasW:616,atlasH:120,cellW:77,cellH:120,frames:8},
  {atlasW:888,atlasH:114,cellW:111,cellH:114,frames:8},
  {atlasW:1912,atlasH:117,cellW:239,cellH:117,frames:8}
)),
nomad:Object.freeze(tech('nomad',76,140,
  {atlasW:684,atlasH:138,cellW:76,cellH:138,frames:9},
  {atlasW:648,atlasH:138,cellW:72,cellH:138,frames:9},
  {atlasW:648,atlasH:138,cellW:72,cellH:138,frames:9},
  {atlasW:984,atlasH:138,cellW:164,cellH:138,frames:6,muzzle:{x:1,y:96,cellW:164,cellH:138}},
  {atlasW:1584,atlasH:138,cellW:198,cellH:138,frames:8}
))
});
export const characterSprite=id=>CHARACTER_SPRITES[id]||null;

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
}),
// Dirty-Connector Blob — processed from a 1024×683 magenta-bg sheet.
// 5 rows: idle(10), walk-right(9), walk-left(9), attack(9, frames 3-4 emit
// brown spit), special(7, golden enrage ring). Row-5 merged ring box split
// by scanning for low-content columns within the wide region.
dirty:Object.freeze(tech('blob',90,98,
  {atlasW:910,atlasH:92,cellW:91,cellH:92,frames:10},
  {atlasW:792,atlasH:82,cellW:88,cellH:82,frames:9},
  {atlasW:747,atlasH:81,cellW:83,cellH:81,frames:9},
  {atlasW:1251,atlasH:86,cellW:139,cellH:86,frames:9},
  {atlasW:1932,atlasH:115,cellW:276,cellH:115,frames:7}
)),
squirrel:Object.freeze({
  atlas:'/assets/squirrel/idle-front.png',attack:'/assets/squirrel/fec-attack.png',portrait:'/assets/squirrel/portrait.png',manifest:'/assets/squirrel/animation.json',
  extras:[['back','/assets/squirrel/idle-back.png',1020,170],['walk','/assets/squirrel/walk-side.png',1020,170]],
  sources:{atlas:source+'74fcd8572_boss_idle_front.png',attack:source+'cdaad81d2_boss_fec_attack.png',portrait:source+'f08b0630c_boss_portrait.png',back:source+'4dab873b1_boss_idle_back.png',walk:source+'56d978f24_boss_walk_side.png'},
  atlasW:1020,atlasH:170,cell:170,columns:6,rows:1,idleFps:6,walkFps:10,worldSize:76,
  attackW:1100,attackH:200,attackFrameW:220,attackFrameH:200,coneFrames:5,windup:.8,releaseHold:.25,
  portraitW:147,portraitH:187,
  manifestSpec:{frameWidth:170,frameHeight:170,'idleFront.columns':6,'idleBack.columns':6,'walkSide.columns':6,'walkSide.facing':'right','attackAtlas.frameWidth':220,'attackAtlas.frameHeight':200,'attackAtlas.columns':5,fps:8}
})});
export const enemySpriteDef=id=>ENEMY_SPRITES[id]||null;

// Bucket-Truck turret — EXCLUSIVE to the shop's Bucket Truck Keys deployable
// (turretMount). Per its manifest the 3 tiles are near-duplicate poses of the
// same truck, NOT a boom sweep — rendered as a slow ~1.5s/frame idle cycle
// only, never presented as target tracking. The Boss's signature sentry and
// all other turrets keep their placeholders; no googly eyes on the truck.
export const STRUCTURE_SPRITES=Object.freeze({
bucket:Object.freeze({
  atlas:'/assets/buckettruck/turret.png',portrait:'/assets/buckettruck/icon.png',
  manifest:'/assets/buckettruck/animation.json',
  sources:{atlas:source+'53bcc4815_buckettruck-turret.png',icon:source+'8c553ef43_buckettruck-icon.png',manifest:source+'cb0ba0033_buckettruck-animation.json'},
  atlasW:690,atlasH:190,tileW:230,tileH:190,columns:3,rows:1,fps:1.5,idleCycle:3,worldSize:64,anchorY:174,portraitW:234,portraitH:204,
  structureType:'turretMount',
  manifestSpec:{structureId:'bucket_truck_turret',tileWidth:230,tileHeight:190,rightEdgeAnchorX:210,groundBaselineY:174,'animation.type':'idle_cycle','animation.fps':1.5}
}),
// Pedestal Turret — multi-strip animated turret from a 1024×683 magenta-bg sheet.
// 4 strips: deploy(9f), rotate/aim(8f), fire(7f), retract(9f). Each strip is
// foot-aligned (baselineY) and center-anchored (anchorX). Muzzle offset is
// relative to the fire strip's anchor. worldSize scales the pedestal to ~56px.
pedestal_turret:Object.freeze({
  atlas:'/assets/turret/deploy.png',portrait:'/assets/turret/icon.png',
  manifest:'/assets/turret/animation.json',
  sources:{atlas:source+'d47806fb3_turret.png',icon:source+'d47806fb3_turret.png',manifest:source+'d47806fb3_turret.png'},
  extras:[
    ['rotate','/assets/turret/rotate.png',616,98],
    ['fire','/assets/turret/fire.png',553,101],
    ['retract','/assets/turret/retract.png',639,106]
  ],
  atlasW:729,atlasH:111, // deploy strip
  strips:{
    deploy:{cellW:81,cellH:111,columns:9,baselineY:109,anchorX:31},
    rotate:{cellW:77,cellH:98,columns:8,baselineY:96,anchorX:38},
    fire:{cellW:79,cellH:101,columns:7,baselineY:99,anchorX:37},
    retract:{cellW:71,cellH:106,columns:9,baselineY:104,anchorX:28}
  },
  muzzle:{x:35,y:49},worldSize:56,portraitW:73,portraitH:106,structureType:'turretMount',
  manifestSpec:{structureId:'pedestal_turret','strips.deploy.cellW':81,'strips.deploy.cellH':111,'strips.deploy.columns':9,'strips.rotate.cellW':77,'strips.rotate.cellH':98,'strips.rotate.columns':8,'strips.fire.cellW':79,'strips.fire.cellH':101,'strips.fire.columns':7,'strips.retract.cellW':71,'strips.retract.cellH':106,'strips.retract.columns':9}
})
});
export const structureSpriteDef=id=>STRUCTURE_SPRITES[id]||null;