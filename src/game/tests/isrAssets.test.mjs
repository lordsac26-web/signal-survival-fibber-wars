import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePng} from './pngDecode.mjs';
import definition from '@/game/art/isrSpriteDefinition';
import {createISRAnimation,isrFrame,updateISRAnimation} from '@/game/art/isrSpriteAnimation';
import {isrMuzzlePoint,drawISR} from '@/game/art/drawISR';
import {makeRecordingCtx} from './engineHarness.mjs';
const dir=new URL('../../../public/assets/isr/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('animation.json',dir)));
const art={definition,manifest:m};
for(const [key,name] of Object.entries({atlas:'idle-front',walk:'walk-side',walkLeft:'walk-left',attack:'attack',special:'special',heal:'heal',healFx:'heal-fx',outageFx:'outage-fx'}))art[key]={src:name};
test('ISR source is actually opaque; explicit source rows 10/9/9/9/9, not a uniform grid',()=>{
 const p=decodePng(readFileSync(new URL('source.png',dir)));assert.deepEqual([p.width,p.height],[1024,683]);
 for(let i=3;i<p.rgba.length;i+=4)assert.equal(p.rgba[i],255);
 assert.deepEqual(m.rows.map(r=>r.x.length),[10,9,9,9,9]);assert(m.rows[4].x[4][1]-m.rows[4].x[4][0]>180);
 for(const r of m.rows)for(const [x0,x1] of r.x){assert(x0>=0&&x1<1024);assert(r.y[0]>=0&&r.y[1]<683)}
});
test('ISR output PNGs are genuinely transparent, nonempty, contain no background palette; digits are removed at source',()=>{
 const sheet=decodePng(readFileSync(new URL('clean-sheet.png',dir)));
 for(const [x0,y0,x1,y1] of m.processing.removedLabels)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)assert.equal(sheet.rgba[(y*1024+x)*4+3],0);
 for(const [name,o] of Object.entries(m.outputs)){
  const p=decodePng(readFileSync(new URL(name+'.png',dir)));assert.deepEqual([p.width,p.height],[o.width,o.height]);let visible=0,clear=0;
  for(let i=0;i<p.rgba.length;i+=4){if(p.rgba[i+3]){visible++;assert(!(p.rgba[i]>=233&&p.rgba[i+2]>=238&&p.rgba[i+1]<=12),'background palette leaked in '+name)}else clear++}
  assert(visible>50&&clear>100,name);
 }
});
test('ISR normal tiles preserve wheel baseline, laptop muzzles and true seated opposite directions',()=>{
 for(const key of ['idle-front','walk-side','walk-left']){let p=decodePng(readFileSync(new URL(key+'.png',dir))),o=m.outputs[key];
  for(let f=0;f<o.indices.length;f++){let bottom=-1;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(p.rgba[(y*p.width+f*64+x)*4+3]>100)bottom=Math.max(bottom,y);assert(bottom>=61&&bottom<=63,`${key}:${f} baseline ${bottom}`)}
 }
 let s=createISRAnimation();updateISRAnimation(s,-1,1,.2);assert.equal(isrFrame(art,s).key,'walkLeft');updateISRAnimation(s,1,-1,.2);assert.equal(isrFrame(art,s).key,'walk');
 s.attack=.4;s.attackFace='left';assert.equal(isrFrame(art,s).key,'walkLeft');
});
test('ISR firing frame uses its own laptop point, mirrored around chair anchor; no upright rotation',()=>{
 for(const active of [false,true])for(const face of ['left','right'])for(const a of [.4,.25,.1]){
  let s={...createISRAnimation(),special:active?7:0,attack:a,attackFace:face,moving:true,frame:5};let f=isrFrame(art,s),mu=m.muzzles[f.key][f.frame],p=isrMuzzlePoint(art,s,550,400),k=52/64;
  assert.equal(p.x,550+(f.mirror?-1:1)*(mu[0]-f.ax)*k);assert.equal(p.y,400+(mu[1]-f.ay)*k);assert(p.y<380,'not knees or wheels');
  let rec=makeRecordingCtx();drawISR(rec.ctx,art,s,550,400);assert(!rec.record.some(r=>r[0]==='rotate'));assert(rec.record.filter(r=>r[0]==='drawImage').every(r=>r.slice(2).every(Number.isFinite)));
 }
});
test('ISR startup one-shot semantics, heal only from kill flag, movement and firing retain priority',()=>{
 let s={...createISRAnimation(),special:8};assert.equal(isrFrame(art,s).frame,0);s.special=7.75;assert.equal(isrFrame(art,s).frame,7);s.special=7;assert.equal(isrFrame(art,s).key,'attack');
 s.heal=.45;assert.equal(isrFrame(art,s).key,'heal');s.moving=true;assert.equal(isrFrame(art,s).key,'walk');s.attack=.4;assert.equal(isrFrame(art,s).key,'attack');s.special=0;updateISRAnimation(s,0,0,.016);assert.equal(s.heal,0);
});