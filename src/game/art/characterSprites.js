// Stable roster id verified against characters.js. Local files are byte-identical public uploads.
const source='https://base44.app/api/apps/6aab67049cd04a621f2adf4f/files/mp/public/6aab67049cd04a621f2adf4f/';
export const CHARACTER_SPRITES=Object.freeze({oracle:Object.freeze({
  atlas:'/assets/oracle/movement.png',portrait:'/assets/oracle/portrait.png',
  manifest:'/assets/oracle/animation.json',
  sources:{atlas:source+'6000b350b_oracle-movement.png',portrait:source+'ddab5b16f_oracle-portrait.png',manifest:source+'e3ac4cbf8_oracle-animation.json'},
  width:448,height:320,cell:64,columns:7,rows:5,fps:8,worldSize:48,
  anchorX:.5,anchorY:.90625,
  // Inspected supplied atlas: row 1 faces left, row 2 right, all seven columns usable.
  directions:{down:0,left:64,right:128,up:192},idleRow:256
})});
export const characterSprite=id=>CHARACTER_SPRITES[id] || null;