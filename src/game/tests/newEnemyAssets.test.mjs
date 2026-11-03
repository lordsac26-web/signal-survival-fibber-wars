import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {enemySpriteDef} from '@/game/art/characterSprites';
import {decodePng} from './pngDecode.mjs';
import drawConeEnemy from '@/game/art/drawConeEnemy';
import {APPARITION,ROUTER_ATTACK,createConeState} from '@/game/combat/coneAttack';
import {makeRecordingCtx} from './engineHarness.mjs';
const asset=(id,n)=>readFileSync(new URL('../../../public/assets/'+id+'/'+n,import.meta.url));
for(const id of ['crosstalk','attenuation','rous'])test(`${id}: all measured strips decode, manifest counts match, nonempty continuous body in every cell, no bright magenta`,()=>{
  const def=enemySpriteDef(id),manifest=JSON.parse(asset(id,'animation.json'));
  for(const [key,val] of Object.entries(def.manifestSpec))assert.equal(key.split('.').reduce((o,k)=>o?.[k],manifest),val);
  for(const name of readdirSync(new URL('../../../public/assets/'+id,import.meta.url)).filter(n=>n.endsWith('.png')&&n!=='source.png')){
    const p=decodePng(asset(id,name));let pink=0;for(let i=0;i<p.rgba.length;i+=4)if(p.rgba[i+3]&&p.rgba[i]>180&&p.rgba[i+2]>140&&p.rgba[i+1]<100)pink++;assert.equal(pink,0,name);
    if(['wave.png','beam.png','portrait.png'].includes(name))continue;
    const n=manifest.counts[name.replace('.png','')],cw=manifest.frameWidth;assert(n);assert.equal(p.width,n*cw);assert.equal(p.height,manifest.frameHeight);
    for(let k=0;k<n;k++){let body=0;for(let y=15;y<p.height-3;y++)for(let x=cw*.25|0;x<cw*.75;x++)if(p.rgba[(y*p.width+k*cw+x)*4+3])body++;assert(body>600,`${name} frame ${k} body ${body}`)}
  }
});
test('cone drawings use genuine left/right/up strips and exact shared clipping wedge; release draws wave/beam',()=>{
  for(const [id,c] of [['attenuation',APPARITION],['rous',ROUTER_ATTACK]]){
    const definition=enemySpriteDef(id),art={definition,atlas:{id:'idle'},right:{id:'right'},left:{id:'left'},up:{id:'up'},focus:{id:'focus'},attack:{id:'attack'},windup:{id:'windup'},fire:{id:'fire'},wave:{id:'wave'},beam:{id:'beam'}};
    const s=createConeState(c);s.facing='left';const {ctx,record}=makeRecordingCtx();drawConeEnemy(ctx,art,s,500,400);assert(record.some(r=>r[0]==='drawImage'&&r[1]===art.left));s.facing='right';s.vy=10;drawConeEnemy(ctx,art,s,500,400);assert(record.some(r=>r[0]==='drawImage'&&r[1]===(id==='rous'?art.up:art.right)));
    Object.assign(s,{phase:'fire',remaining:.001,released:true,x:500,y:400,angle:.8,half:c.half,reach:200});drawConeEnemy(ctx,art,s,500,400);assert(record.some(r=>r[0]==='clip'));assert(record.some(r=>r[0]==='arc'&&r[1]===500&&r[2]===400&&r[3]===200&&Math.abs(r[4]-(.8-c.half))<1e-8));assert(record.some(r=>r[0]==='drawImage'&&r[1]===(id==='rous'?art.beam:art.wave)));
  }
});