import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepCoopPeers, drawCoopPeers } from '@/game/multiplayer/coopArenaSync';
import { makeRecordingCtx } from './engineHarness.mjs';

test('CoopRoom actor and Multiplayer WebSocket wiring are registered', () => {
  const actorSrc = readFileSync(new URL('../../../base44/actors/CoopRoom/entry.ts', import.meta.url), 'utf8');
  assert(actorSrc.includes("import { Actor } from 'base44:runtime/actors'"), 'uses Base44 runtime Actor');
  assert(actorSrc.includes('export default class CoopRoom extends Actor'), 'exports default CoopRoom actor');
  assert(actorSrc.includes('handleConnect') && actorSrc.includes('handleMessage') && actorSrc.includes('handleClose'), 'implements lifecycle hooks');

  const hookSrc = readFileSync(new URL('../multiplayer/useCoopRoom.js', import.meta.url), 'utf8');
  assert(hookSrc.includes('base44.actors.CoopRoom(roomId).connect'), 'connects to CoopRoom WebSocket actor');

  const mpSrc = readFileSync(new URL('../../pages/Multiplayer.jsx', import.meta.url), 'utf8');
  assert(mpSrc.includes('useCoopRoom'), 'Multiplayer page uses WebSocket room hook');
});

test('stepCoopPeers and drawCoopPeers interpolate teammates, fire support shots, and apply allied combat events', () => {
  const peersRef = {
    current: [
      { seat: 1, name: 'Host', characterId: 'oracle', x: 550, y: 400, hp: 100, maxHp: 100, alive: true },
      {
        seat: 2,
        name: 'Partner',
        characterId: 'engineer',
        x: 620,
        y: 420,
        hp: 90,
        maxHp: 120,
        alive: true,
        weapons: [{ name: 'Cleaver', damage: 20, range: 240, color: '#67e8f9' }]
      }
    ]
  };
  const eventsRef = {
    current: [
      { seat: 2, name: 'Partner', kind: 'heal_pulse', amount: 15 },
      { seat: 2, name: 'Partner', kind: 'boss_damage', amount: 40 }
    ]
  };

  let healed = 0;
  let bossDamaged = 0;
  let shotsLaunched = 0;
  const flashes = [];

  const run = {
    coop: true,
    coopSeat: 1,
    coopPeers: peersRef,
    coopEvents: eventsRef
  };

  stepCoopPeers(run, 0.5, {
    player: { x: 550, y: 400, hp: 70, maxHp: 100 },
    heal: (amt) => {
      healed += amt;
    },
    damageBoss: (amt) => {
      bossDamaged += amt;
    },
    nearestAt: () => ({ x: 680, y: 420 }),
    launch: () => {
      shotsLaunched += 1;
    },
    particle() {},
    flash: (msg) => flashes.push(msg)
  });

  assert.equal(healed, 15, 'applies allied heal pulse');
  assert.equal(bossDamaged, 40, 'applies shared boss damage');
  assert.equal(shotsLaunched, 1, 'partner fires support projectile at nearby enemy');
  assert.equal(eventsRef.current.length, 0, 'drains processed combat events');
  assert(Number.isFinite(peersRef.current[1].rx) && Number.isFinite(peersRef.current[1].ry), 'interpolates peer render coordinates');

  const rec = makeRecordingCtx();
  drawCoopPeers(rec.ctx, run);
  assert(rec.record.some((r) => r[0] === 'fillText' && String(r[1]).includes('P2 Partner')), 'renders partner callsign in world space');
});