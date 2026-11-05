const source='https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/4d2db1b88_ditch-witch-source.jpg';

export default Object.freeze({
  atlas:'/assets/ditchwitch/idle.png',
  portrait:'/assets/ditchwitch/portrait.png',
  manifest:'/assets/ditchwitch/animation.json',
  sources:{sheet:source,localSheet:'/assets/ditchwitch/ditch-witch-source.jpg'},
  hurtTint:'rgba(251,113,133,.6)',
  atlasW:768,atlasH:120,cellW:192,cellH:120,columns:4,
  portraitW:192,portraitH:120,
  worldSize:84,anchorX:72,baselineY:114,baseFacing:'right',
  idleFps:6,driveFps:10,windupFps:4,chargeFps:12,digFps:8,deathFps:9,
  counts:Object.freeze({idle:4,drive:6,windup:3,charge:5,dig:4,death:5}),
  extras:Object.freeze([
    ['drive','/assets/ditchwitch/drive.png',1152,120],
    ['windup','/assets/ditchwitch/windup.png',576,120],
    ['charge','/assets/ditchwitch/charge.png',960,120],
    ['dig','/assets/ditchwitch/dig.png',768,120],
    ['death','/assets/ditchwitch/death.png',960,120],
    ['rocks','/assets/ditchwitch/rocks.png',108,96]
  ]),
  manifestSpec:Object.freeze({
    id:'ditchWitch',
    frameWidth:192,
    frameHeight:120,
    anchorX:72,
    baselineY:114,
    baseFacing:'right',
    'counts.idle':4,
    'counts.drive':6,
    'counts.windup':3,
    'counts.charge':5,
    'counts.dig':4,
    'counts.death':5,
    'rocksVfx.width':108,
    'rocksVfx.height':96
  })
});