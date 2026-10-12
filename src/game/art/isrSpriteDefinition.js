// Supplied 1024×683 sheet: explicit source crops and measured wheel/laptop
// anchors in animation.json. Normal logical box is 64²; effect padding never
// changes body scale. Genuine seated right AND left rows, no standing poses.
export default Object.freeze({
 seated:true,atlas:'/assets/isr/idle-front.png',portrait:'/assets/isr/portrait.png',manifest:'/assets/isr/animation.json',
 atlasW:640,atlasH:64,cellW:64,cellH:64,columns:10,worldSize:52,anchorX:.5,anchorY:62/64,
 portraitW:64,portraitH:64,hurtTint:'rgba(251,113,133,.6)',
 walkColumns:9,walkLeftColumns:9,attackColumns:3,specialColumns:9,
 extras:[['walk','/assets/isr/walk-side.png',576,64],['walkLeft','/assets/isr/walk-left.png',576,64],
  ['attack','/assets/isr/attack.png',288,80],['special','/assets/isr/special.png',1296,96],
  ['outageFx','/assets/isr/outage-fx.png',288,96],['heal','/assets/isr/heal.png',128,64],['healFx','/assets/isr/heal-fx.png',128,64]],
 manifestSpec:{characterId:'isr',frameWidth:64,frameHeight:64,'idleFront.columns':10,
  'walkSide.columns':9,'walkSide.facing':'right','walkLeft.columns':9,'walkLeft.facing':'left',
  'attack.columns':3,'special.columns':9,'heal.columns':2,'heal.amount':5,'fx.columns':2,fps:8}
});