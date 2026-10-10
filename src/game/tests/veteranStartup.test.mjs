// Regression for the Veteran playtest blocker: the shared startup preload
// (GameArena's Promise.all over the character + lag + bucket + pedestal_turret
// + squirrel + blob definitions) failed for EVERY character because the new
// pedestal_turret definition declared no portrait size, so the loader demanded
// the 256×256 default while the actual icon file is 73×106 — surfacing as
// "Sprite assets could not start: Unexpected image size: 73×106" when selecting
// the 30 Year Veteran.
//
// The test mirrors the loader's exact dimension logic against the real files on
// disk for every definition, so any future definition/file mismatch (including
// the portrait default trap) fails here instead of at game start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTER_SPRITES, ENEMY_SPRITES, STRUCTURE_SPRITES } from '@/game/art/characterSprites';
import { decodePng } from './pngDecode.mjs';

const file=relPath=>readFileSync(new URL('../../../public'+relPath,import.meta.url));
// Mirrors spriteLoader.js: portraitSize default 256, then portraitW/H fall back to it.
const expectedPortraitOf=d=>[d.portraitW||d.portraitSize||256,d.portraitH||d.portraitSize||256];
// Mirrors spriteLoader.js matches(): every dotted spec key must equal the manifest value.
function manifestMatches(manifest,spec){
  for(const [key,expected] of Object.entries(spec)){
    const actual=key.split('.').reduce((o,p)=>o?.[p],manifest);
    if(actual!==expected)return `manifest key ${key}: expected ${expected}, got ${actual}`;
  }
  return null;
}

const definitions={
  veteran:CHARACTER_SPRITES.veteran,
  pedestal_turret:STRUCTURE_SPRITES.pedestal_turret,
  bucket:STRUCTURE_SPRITES.bucket,
  lag:ENEMY_SPRITES.lag,
  squirrel:ENEMY_SPRITES.squirrel,
  dirty:ENEMY_SPRITES.dirty
};

test('startup preload regression: every shared definition matches its local file sizes exactly (portrait default trap included)',()=>{
  const failures=[];
  for(const [id,d] of Object.entries(definitions)){
    // atlas (or movement atlas for lag/squirrel naming) must decode at declared size
    const atlasW=d.atlasW??d.width,atlasH=d.atlasH??d.height;
    const atlasDecoded=decodePng(file(d.atlas));
    if(atlasDecoded.width!==atlasW||atlasDecoded.height!==atlasH)failures.push(`${id} atlas ${d.atlas}: expected ${atlasW}x${atlasH}, got ${atlasDecoded.width}x${atlasDecoded.height}`);
    // portrait: the exact check that failed — default 256 vs actual icon size
    const [pw,ph]=expectedPortraitOf(d);
    const portraitDecoded=decodePng(file(d.portrait));
    if(portraitDecoded.width!==pw||portraitDecoded.height!==ph)failures.push(`${id} portrait ${d.portrait}: expected ${pw}x${ph}, got ${portraitDecoded.width}x${portraitDecoded.height}`);
    // manifest must exist, parse, and satisfy manifestSpec
    const manifest=JSON.parse(file(d.manifest));
    const mismatch=manifestMatches(manifest,d.manifestSpec);
    if(mismatch)failures.push(`${id} ${mismatch}`);
  }
  assert.deepEqual(failures,[],`sprite startup mismatches: ${failures.join('; ')}`);
});

test('specific regression: pedestal turret icon is 73x106 and the definition no longer relies on the 256 default',()=>{
  const icon=decodePng(file('/assets/turret/icon.png'));
  assert.equal(icon.width,73);assert.equal(icon.height,106);
  const d=STRUCTURE_SPRITES.pedestal_turret;
  assert.equal(d.portraitW,73);assert.equal(d.portraitH,106);
  assert.equal(expectedPortraitOf(d)[0],73);
});

test('veteran startup simulation: all six assets a Veteran run preloads decode at declared sizes with valid manifests',()=>{
  // The full GameArena Promise.all: character + lag + bucket + pedestal_turret + squirrel + blob
  for(const [id,d] of Object.entries(definitions)){
    const atlasDecoded=decodePng(file(d.atlas));
    assert.ok(atlasDecoded.width>0,`${id} atlas decodes`);
    if(d.extras)for(const [key,rel,w,h] of d.extras){
      const extra=decodePng(file(rel));
      if(w&&h){assert.equal(extra.width,w,`${id} extra ${key}`);assert.equal(extra.height,h,`${id} extra ${key}`)}
    }
    if(d.attackW){
      const attack=decodePng(file(d.attack));
      assert.equal(attack.width,d.attackW,`${id} attack`);
      assert.equal(attack.height,d.attackH,`${id} attack`);
    }
  }
  // Veteran-specific: manifest declares veteran; per-strip files decode at the
  // exact sizes tech() declares (the first test only covers atlas + portrait).
  const v=CHARACTER_SPRITES.veteran;
  assert.equal(JSON.parse(file(v.manifest)).characterId,'veteran');
  assert.equal(v.atlasW/v.cellW,v.columns);
  for(const [rel,w,h,label] of [
    ['/assets/veteran/walk-side.png',v.walkColumns*v.walkCellW,v.walkCellH,'walk'],
    ['/assets/veteran/walk-left.png',v.walkLeftColumns*v.walkLeftCellW,v.walkLeftCellH,'walkLeft'],
    ['/assets/veteran/attack.png',v.attackColumns*v.attackCellW,v.attackCellH,'attack'],
    ['/assets/veteran/special.png',v.specialColumns*v.specialCellW,v.specialCellH,'special']
  ]){
    const decoded=decodePng(file(rel));
    assert.equal(decoded.width,w,`veteran ${label} width`);
    assert.equal(decoded.height,h,`veteran ${label} height`);
  }
});