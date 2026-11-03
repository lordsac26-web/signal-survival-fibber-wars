import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_THEMES,coverRect,bakeArenaFloor,preloadArenaFloor} from '@/game/art/arenaFloor';
import {makeRecordingCtx,makeCanvas} from './engineHarness.mjs';
import {normalizeRun,createRun} from '@/game/progression/runRules';
import {characterById} from '@/game/data/characters';
import {decodePng} from './pngDecode.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('Office is full-size decoded artwork; Worksite is not offered with its missing source; Classic default preserved',async()=>{
  const p=decodePng(readFileSync(new URL('../../../public/assets/arenas/office.png',import.meta.url)));assert.deepEqual([p.width,p.height],[1024,687]);assert.deepEqual(ARENA_THEMES.map(t=>t.id),['classic','office']);assert.equal(await preloadArenaFloor('classic'),null);assert(read('components/game/CharacterSelect.jsx').includes("useState('classic')"));
  const r=createRun(characterById('oracle'),false,1,'office');r.arenaTheme='office';assert.equal(normalizeRun(r).arenaTheme,'office');
});
test('aspect-preserving cover has no seams or stretching; backdrop baked once into world then drawn beneath all actors/hazards',()=>{
  for(const [w,h] of [[1100,800],[375,667],[1280,800]]){const r=coverRect(1024,687,w,h);assert(r.width>=w&&r.height>=h);assert(Math.abs(r.width/r.height-1024/687)<1e-8);assert(r.x<=0&&r.y<=0)}
  const old=document.createElement,{ctx,record}=makeRecordingCtx();document.createElement=()=>makeCanvas(1100,800,{ctx});try{const floor=bakeArenaFloor({naturalWidth:1024,naturalHeight:687});assert.deepEqual([floor.width,floor.height],[1100,800]);assert.equal(record.filter(r=>r[0]==='drawImage').length,1)}finally{document.createElement=old}
  const engine=read('game/signalEngine.js'),floor=engine.indexOf('if(arenaFloor)ctx.drawImage(arenaFloor,0,0)');assert(floor>0);for(const token of ['PACKET-LOSS PUDDING ground goo','if(meeting.active){const tx','// structures (under enemies)'])assert(floor<engine.indexOf(token));assert(read('components/game/GameArena.jsx').includes('preloadArenaFloor(run.arenaTheme)'));assert(read('components/game/GameArena.jsx').includes('min-h-0 flex-1'));
});