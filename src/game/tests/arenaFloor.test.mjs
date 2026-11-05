import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_THEMES,ARENA_BACKGROUND_IDS,MULTIPLAYER_ARENA_CHOICES,FLOORS,pickArenaTheme,resolveMultiplayerArena,coverRect,bakeArenaFloor,preloadArenaFloor} from '@/game/art/arenaFloor';
import {makeRecordingCtx,makeCanvas,pump,startEncounter} from './engineHarness.mjs';
import {normalizeRun,createRun,advanceRunWave} from '@/game/progression/runRules';
import {characterById} from '@/game/data/characters';
import {decodePng} from './pngDecode.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('All five themes registered; Office, Worksite, Vault and Night Worksite assets are full-size local artwork with JPEG provenance',async()=>{
  assert.deepEqual(ARENA_THEMES.map(t=>t.id),['classic','office','worksite','vault','nightWorksite']);
  assert.deepEqual(ARENA_BACKGROUND_IDS,['office','worksite','vault','nightWorksite']);
  for(const [id,pngFile,jpgFile] of [
    ['office','office.png','office.jpg'],
    ['worksite','worksite.png','worksite.jpg'],
    ['vault','vault.png','vault.jpg'],
    ['nightWorksite','night-worksite.png','night-worksite.jpg']
  ]){
    assert.equal(FLOORS[id],`/assets/arenas/${pngFile}`);
    const png=decodePng(readFileSync(new URL(`../../../public/assets/arenas/${pngFile}`,import.meta.url)));
    assert.deepEqual([png.width,png.height],[1024,687],`${id} PNG dimensions`);
    const jpg=readFileSync(new URL(`../../../public/assets/arenas/${jpgFile}`,import.meta.url));
    assert.deepEqual([...jpg.slice(0,3)],[0xff,0xd8,0xff],`${id} source JPEG provenance present`);
  }
  assert.equal(await preloadArenaFloor('classic'),null,'Signal Grid stays the drawn-grid fallback with no bitmap');
  for(const theme of ['classic','office','worksite','vault','nightWorksite']){
    const r=createRun(characterById('oracle'),false,1,theme);
    r.arenaTheme=theme;
    assert.equal(normalizeRun(r).arenaTheme,theme,`${theme} survives run normalization`);
  }
});

test('Solo uses deterministic run-seeded random backgrounds at run start and between waves without a solo picker or immediate repeats; Multiplayer host supports specific map or Random',()=>{
  const selectSrc=read('components/game/CharacterSelect.jsx');
  assert(!selectSrc.includes('ArenaThemePicker'),'Solo character select does not show a manual backdrop picker');
  const seen=new Set();
  for(let seed=1;seed<=40;seed++){
    let run=createRun(characterById('oracle'),false,seed,`seed-${seed}`);
    assert(ARENA_BACKGROUND_IDS.includes(run.arenaTheme),`run start picks a registered background (${run.arenaTheme})`);
    assert.equal(run.arenaTheme,pickArenaTheme(seed,1),'run start is deterministic for seed');
    seen.add(run.arenaTheme);
    for(let w=1;w<12;w++){
      const prev=run.arenaTheme;
      run=advanceRunWave(run);
      assert.equal(run.wave,w+1);
      assert(ARENA_BACKGROUND_IDS.includes(run.arenaTheme));
      assert.notEqual(run.arenaTheme,prev,`wave ${w}->${w+1} avoids immediate repeat (${prev})`);
      assert.equal(run.arenaTheme,pickArenaTheme(seed,w+1,prev),'wave transition is deterministic from seed + wave');
      seen.add(run.arenaTheme);
    }
  }
  assert.deepEqual([...seen].sort(),[...ARENA_BACKGROUND_IDS].sort(),'all four backgrounds are reachable across seeded runs');
  assert.deepEqual(MULTIPLAYER_ARENA_CHOICES.map(c=>c.id),['random','classic','office','worksite','vault','nightWorksite']);
  assert.equal(resolveMultiplayerArena('vault',99,4,'office'),'vault','host fixed map overrides random');
  assert.equal(resolveMultiplayerArena('nightWorksite',99,4,'vault'),'nightWorksite','host fixed Night Worksite');
  assert.equal(resolveMultiplayerArena('random',99,4,'vault'),pickArenaTheme(99,4,'vault'),'host Random shares deterministic seed/wave selection with all clients');
  assert.notEqual(resolveMultiplayerArena('random',99,4,'vault'),'vault','host Random avoids immediate repeat');
});

test('aspect-preserving cover has no seams or stretching; backdrop baked once into world then drawn beneath all actors/hazards',()=>{
  for(const [w,h] of [[1100,800],[375,667],[1280,800]]){const r=coverRect(1024,687,w,h);assert(r.width>=w&&r.height>=h);assert(Math.abs(r.width/r.height-1024/687)<1e-8);assert(r.x<=0&&r.y<=0)}
  const old=document.createElement,{ctx,record}=makeRecordingCtx();document.createElement=()=>makeCanvas(1100,800,{ctx});try{const floor=bakeArenaFloor({naturalWidth:1024,naturalHeight:687});assert.deepEqual([floor.width,floor.height],[1100,800]);assert.equal(record.filter(r=>r[0]==='drawImage').length,1)}finally{document.createElement=old}
  const engine=read('game/signalEngine.js'),floor=engine.indexOf('if(arenaFloor)ctx.drawImage(arenaFloor,0,0)');assert(floor>0);for(const token of ['PACKET-LOSS PUDDING ground goo','if(meeting.active){const tx','// structures (under enemies)'])assert(floor<engine.indexOf(token));assert(read('components/game/GameArena.jsx').includes('preloadArenaFloor(run.arenaTheme)'));assert(read('components/game/GameArena.jsx').includes('min-h-0 flex-1'));
});

test('Worksite, Vault and Night Worksite floors preload once from app-owned assets and bake the wash + vignette cover exactly once',async()=>{
  const floorSrc=read('game/art/arenaFloor.js');
  for(const path of ['/assets/arenas/office.png','/assets/arenas/worksite.png','/assets/arenas/vault.png','/assets/arenas/night-worksite.png']){
    assert(floorSrc.includes(path),`${path} is app-owned, never hotlinked`);
  }
  for(const theme of ['worksite','vault','nightWorksite']){
    const promise=preloadArenaFloor(theme);
    assert.strictEqual(preloadArenaFloor(theme),promise,`${theme} floor is preloaded and baked once, then cached`);
    const bakeRecord=[];const old=document.createElement;
    document.createElement=()=>{const {ctx,record}=makeRecordingCtx();bakeRecord.push(record);return makeCanvas(1100,800,{ctx})};
    let floor;try{floor=await promise}finally{document.createElement=old}
    const blits=bakeRecord.flatMap(r=>r).filter(e=>e[0]==='drawImage');
    assert.equal(blits.length,1,`${theme}: one aspect-preserving cover blit`);
    assert.deepEqual([blits[0][6],blits[0][7]],[Math.min(blits[0][6],0),Math.min(blits[0][7],0)],`${theme}: cover overscans the world origin (no seams)`);
    assert.ok(blits[0][8]>=1100&&blits[0][9]>=800,`${theme}: cover fills the 1100x800 world`);
    assert.ok(bakeRecord.flatMap(r=>r).filter(e=>e[0]==='fillRect').length>=2,`${theme}: contrast wash and edge vignette applied`);
    assert.deepEqual([floor.width,floor.height],[1100,800],`${theme}: baked once at world size`);
  }
});

test('Engine: Vault, Night Worksite and Worksite floor blits are the first drawImage of every frame at mobile and desktop widths, under all hazards and actors, never swapping mid-combat or adding obstacle collisions',async()=>{
  const engine=read('game/signalEngine.js');
  assert.equal(engine.match(/arenaFloor/g).length,3,'floor is consumed only by the draw blit, never by movement, spawning or collision');
  for(const theme of ['worksite','vault','nightWorksite']){
    for(const [width,height] of [[375,500],[1100,800]]){
      let hViewport,hPos,floorRef;
      const h=await startEncounter({width,height,configure:r=>{r.arenaTheme=theme;r.dodge=1;r.crit=0}});
      try{
        floorRef=h.arenaFloor;
        pump(1);
        const draws=h.rec.record.filter(r=>r[0]==='drawImage');
        const firstBlit=draws.find(r=>r[1]===h.arenaFloor);
        assert.ok(firstBlit,`${theme} floor blit recorded`);
        assert.equal(draws.indexOf(firstBlit),0,`${theme} floor blit precedes every actor, hazard and structure draw (${width}x${height})`);
        assert.deepEqual([firstBlit[2],firstBlit[3]],[0,0]);
        assert.equal(firstBlit.meta.alpha,1,'opaque floor');
        h.input.current.x=1;h.input.current.y=.5;
        pump(2);
        assert.equal(h.run.arenaTheme,theme,'arena theme never swaps mid-combat');
        const blits=h.rec.record.filter(r=>r[0]==='drawImage'&&r[1]===h.arenaFloor).length;
        assert.ok(blits>=Math.floor(3*60),`${theme} blitted every frame (${blits})`);
        const after=h.rec.record.filter(r=>r[0]==='drawImage'&&r[1]!==h.arenaFloor&&h.rec.record.indexOf(r)>h.rec.record.indexOf(firstBlit));
        assert.ok(after.length>0,`actor art drawn above ${theme} floor (${after.length})`);
        hViewport=h.huds.at(-1).viewport;
        hPos=h.samples.filter(s=>s.player.x>550).slice(0,115).map(s=>[Math.round(s.player.x),Math.round(s.player.y)]);
      }finally{h.cleanup()}
      const classic=await startEncounter({width,height,configure:r=>{r.arenaTheme='classic';r.dodge=1;r.crit=0}});
      try{
        pump(1);
        classic.input.current.x=1;classic.input.current.y=.5;
        pump(2);
        assert.deepEqual([classic.huds.at(-1).viewport.width,classic.huds.at(-1).viewport.height],[hViewport.width,hViewport.height],'viewport and gameplay bounds identical with and without the floor');
        assert.deepEqual(classic.samples.filter(s=>s.player.x>550).slice(0,115).map(s=>[Math.round(s.player.x),Math.round(s.player.y)]),hPos,'painted trenches, vaults and desks are cosmetic only (identical step-by-step movement trajectory)');
        assert.ok(!classic.rec.record.some(r=>r[0]==='drawImage'&&r[1]===floorRef),'classic draws no bitmap');
      }finally{classic.cleanup()}
    }
  }
});