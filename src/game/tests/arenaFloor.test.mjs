import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_THEMES,coverRect,bakeArenaFloor,preloadArenaFloor} from '@/game/art/arenaFloor';
import {makeRecordingCtx,makeCanvas,pump,startEncounter} from './engineHarness.mjs';
import {normalizeRun,createRun} from '@/game/progression/runRules';
import {characterById} from '@/game/data/characters';
import {decodePng} from './pngDecode.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('All three themes registered; Office and Worksite assets are full-size local artwork; Classic stays default',async()=>{
  assert.deepEqual(ARENA_THEMES.map(t=>t.id),['classic','office','worksite']);
  const office=decodePng(readFileSync(new URL('../../../public/assets/arenas/office.png',import.meta.url)));
  const worksite=decodePng(readFileSync(new URL('../../../public/assets/arenas/worksite.png',import.meta.url)));
  assert.deepEqual([office.width,office.height],[1024,687]);
  assert.deepEqual([worksite.width,worksite.height],[1024,687]);
  const jpg=readFileSync(new URL('../../../public/assets/arenas/worksite.jpg',import.meta.url));
  assert.deepEqual([...jpg.slice(0,4)],[0xff,0xd8,0xff,0xe0],'worksite source JPEG provenance present');
  assert.equal(await preloadArenaFloor('classic'),null,'Signal Grid stays the drawn-grid default with no bitmap');
  assert(read('components/game/CharacterSelect.jsx').includes("useState('classic')"),'classic remains the default selection');
  for(const theme of ['office','worksite']){const r=createRun(characterById('oracle'),false,1,theme);r.arenaTheme=theme;assert.equal(normalizeRun(r).arenaTheme,theme,`${theme} survives run normalization`)}
});
test('aspect-preserving cover has no seams or stretching; backdrop baked once into world then drawn beneath all actors/hazards',()=>{
  for(const [w,h] of [[1100,800],[375,667],[1280,800]]){const r=coverRect(1024,687,w,h);assert(r.width>=w&&r.height>=h);assert(Math.abs(r.width/r.height-1024/687)<1e-8);assert(r.x<=0&&r.y<=0)}
  const old=document.createElement,{ctx,record}=makeRecordingCtx();document.createElement=()=>makeCanvas(1100,800,{ctx});try{const floor=bakeArenaFloor({naturalWidth:1024,naturalHeight:687});assert.deepEqual([floor.width,floor.height],[1100,800]);assert.equal(record.filter(r=>r[0]==='drawImage').length,1)}finally{document.createElement=old}
  const engine=read('game/signalEngine.js'),floor=engine.indexOf('if(arenaFloor)ctx.drawImage(arenaFloor,0,0)');assert(floor>0);for(const token of ['PACKET-LOSS PUDDING ground goo','if(meeting.active){const tx','// structures (under enemies)'])assert(floor<engine.indexOf(token));assert(read('components/game/GameArena.jsx').includes('preloadArenaFloor(run.arenaTheme)'));assert(read('components/game/GameArena.jsx').includes('min-h-0 flex-1'));
});
test('Worksite floor preloads once from the app-owned asset, bakes the wash + vignette cover exactly once',async()=>{
  assert(read('game/art/arenaFloor.js').includes("worksite:'/assets/arenas/worksite.png'"),'runtime image is the app-owned asset, never a hotlink');
  const promise=preloadArenaFloor('worksite');
  assert.strictEqual(preloadArenaFloor('worksite'),promise,'the floor is preloaded and baked once, then cached');
  const bakeRecord=[];const old=document.createElement;
  document.createElement=()=>{const {ctx,record}=makeRecordingCtx();bakeRecord.push(record);return makeCanvas(1100,800,{ctx})};
  let floor;try{floor=await promise}finally{document.createElement=old}
  const blits=bakeRecord.flatMap(r=>r).filter(e=>e[0]==='drawImage');
  assert.equal(blits.length,1,'one aspect-preserving cover blit');
  assert.deepEqual([blits[0][6],blits[0][7]],[Math.min(blits[0][6],0),Math.min(blits[0][7],0)],'cover overscans the world origin (no seams)');
  assert.ok(blits[0][8]>=1100&&blits[0][9]>=800,'cover fills the 1100x800 world');
  assert.ok(bakeRecord.flatMap(r=>r).filter(e=>e[0]==='fillRect').length>=2,'dark-teal contrast wash and edge vignette both applied for unit readability');
  assert.deepEqual([floor.width,floor.height],[1100,800],'baked once at world size');
});
test('Worksite engine: floor blit is the first drawImage of every frame at mobile and desktop widths, under all hazards and actors; bounds untouched',async()=>{
  const engine=read('game/signalEngine.js');
  assert.equal(engine.match(/arenaFloor/g).length,3,'floor is consumed only by the draw blit, never by movement, spawning or collision');
  for(const [width,height] of [[375,500],[1100,800]]){
    const h=await startEncounter({width,height,configure:r=>{r.arenaTheme='worksite'}});
    try{
      pump(1);
      const draws=h.rec.record.filter(r=>r[0]==='drawImage');
      const firstBlit=draws.find(r=>r[1]===h.arenaFloor);
      assert.ok(firstBlit,'floor blit recorded');
      assert.equal(draws.indexOf(firstBlit),0,`floor blit precedes every actor, hazard and structure draw (${width}x${height})`);
      assert.deepEqual([firstBlit[2],firstBlit[3]],[0,0]);
      assert.equal(firstBlit.meta.alpha,1,'opaque floor');
      pump(2);
      const blits=h.rec.record.filter(r=>r[0]==='drawImage'&&r[1]===h.arenaFloor).length;
      assert.ok(blits>=Math.floor(3*60),`blitted every frame (${blits})`);
      const after=h.rec.record.filter(r=>r[0]==='drawImage'&&r[1]!==h.arenaFloor&&h.rec.record.indexOf(r)>h.rec.record.indexOf(firstBlit));
      assert.ok(after.length>0,`actor art drawn above the floor (${after.length})`);
      const classic=await startEncounter({width,height});
      try{
        pump(1);
        assert.deepEqual([classic.huds.at(-1).viewport.width,classic.huds.at(-1).viewport.height],[h.huds.at(-1).viewport.width,h.huds.at(-1).viewport.height],'viewport and gameplay bounds identical with and without the floor');
        assert.deepEqual([Math.round(classic.state.player.x),Math.round(classic.state.player.y)],[Math.round(h.state.player.x),Math.round(h.state.player.y)],'player spawn and clamping unchanged');
        assert.ok(!classic.rec.record.some(r=>r[0]==='drawImage'&&r[1]===h.arenaFloor),'classic draws no bitmap');
      }finally{classic.cleanup()}
    }finally{h.cleanup()}
  }
});