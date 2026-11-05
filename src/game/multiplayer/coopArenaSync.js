import { characterById } from '@/game/data/characters';

export function stepCoopPeers(run, dt, api) {
  if (!run.coop) return;

  const events = run.coopEvents?.current;
  if (Array.isArray(events) && events.length) {
    const batch = events.splice(0, events.length);
    for (const ev of batch) {
      if (!ev || ev.seat === run.coopSeat) continue;
      if (ev.kind === 'heal_pulse' && ev.amount > 0 && api.player.hp > 0) {
        api.heal(ev.amount);
        api.particle(api.player.x, api.player.y, '#22c55e', 10);
        api.flash(`${ev.name} SHARED +${Math.round(ev.amount)} HP`);
      } else if (ev.kind === 'boss_damage' && ev.amount > 0) {
        api.damageBoss(ev.amount);
      } else if (ev.kind === 'special') {
        api.particle(ev.x || api.player.x, ev.y || api.player.y, '#fde047', 12);
        if (ev.label) api.flash(`${ev.name}: ${ev.label}`);
      } else if (ev.kind === 'ping') {
        api.particle(ev.x || api.player.x, ev.y || api.player.y, '#67e8f9', 16);
        api.flash(`${ev.name} PINGED THE FIELD`);
      }
    }
  }

  const peers = run.coopPeers?.current;
  if (!Array.isArray(peers)) return;
  for (const peer of peers) {
    if (!peer || peer.seat === run.coopSeat) continue;
    const tx = Number.isFinite(peer.x) ? peer.x : 550;
    const ty = Number.isFinite(peer.y) ? peer.y : 400;
    peer.rx = (peer.rx ?? tx) + (tx - (peer.rx ?? tx)) * Math.min(1, dt * 12);
    peer.ry = (peer.ry ?? ty) + (ty - (peer.ry ?? ty)) * Math.min(1, dt * 12);
    if (!peer.alive || peer.hp <= 0) continue;

    peer.fireCd = (peer.fireCd ?? 0.45) - dt;
    if (peer.fireCd <= 0) {
      const w = peer.weapons?.[0];
      const reach = Math.min(320, Math.max(150, w?.range || 230));
      const target = api.nearestAt(peer.rx, peer.ry, reach);
      if (target) {
        const ang = Math.atan2(target.y - (peer.ry - 16), target.x - peer.rx);
        api.launch(
          {
            damage: Math.max(6, (w?.damage || 12) * 0.65),
            range: reach,
            pattern: 'projectile',
            color: w?.color || '#67e8f9',
            speed: 520
          },
          ang,
          peer.rx,
          peer.ry - 16,
          reach
        );
        peer.fireCd = 0.65;
      } else {
        peer.fireCd = 0.2;
      }
    }
  }
}

export function drawCoopPeers(ctx, run) {
  if (!run.coop) return;
  const peers = run.coopPeers?.current;
  if (!Array.isArray(peers) || !peers.length) return;

  for (const peer of peers) {
    if (!peer || peer.seat === run.coopSeat) continue;
    const x = Math.round(peer.rx ?? peer.x ?? 550);
    const y = Math.round(peer.ry ?? peer.y ?? 400);
    const ch = characterById(peer.characterId || 'oracle');
    const alive = peer.alive !== false && (peer.hp ?? 1) > 0;

    ctx.save();
    ctx.globalAlpha = alive ? 0.92 : 0.45;

    // Co-op ground ring
    ctx.strokeStyle = alive ? '#67e8f9' : '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 6, 19, 0, Math.PI * 2);
    ctx.stroke();

    // Allied technician body & hard hat
    ctx.fillStyle = ch.color || '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ch.vest || '#facc15';
    ctx.fillRect(x - 12, y + 2, 24, 14);
    ctx.fillStyle = ch.belt || '#1e293b';
    ctx.fillRect(x - 13, y + 10, 26, 4);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x, y - 12, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 13, y - 13, 26, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 7, y - 5, 5, 6);
    ctx.fillRect(x + 2, y - 5, 5, 6);

    if ((peer.special || 0) > 0) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 4, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Overhead HP bar + seat callsign
    const ratio = Math.max(0, Math.min(1, (peer.hp || 0) / Math.max(1, peer.maxHp || 100)));
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(x - 22, y - 34, 44, 6);
    ctx.fillStyle = ratio > 0.35 ? '#22d3ee' : '#f87171';
    ctx.fillRect(x - 21, y - 33, Math.round(42 * ratio), 4);

    ctx.font = 'bold 11px Chivo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(`P${peer.seat} ${String(peer.name || 'Tech').slice(0, 10)}`, x, y - 39);
    ctx.restore();
  }
}