const cache = {};

// Draw once per enemy type; hundreds of enemies reuse the same small texture.
export function enemySprite(kind, enemy) {
  if (cache[kind]) return cache[kind];
  const r = enemy.r, size = r * 2 + 12, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), m = size / 2;
  ctx.translate(m, m);
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  if (kind === 'jitter') {
    for (let i = 0; i < 20; i++) {
      const a = i * Math.PI / 10, d = i % 2 ? r - 2 : r + 3;
      i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
  } else if (kind === 'packet' || kind === 'dirty') {
    ctx.moveTo(-r, 2);ctx.bezierCurveTo(-r, -r, -3, -r - 3, 2, -r);
    ctx.bezierCurveTo(r + 4, -r, r + 2, -2, r, 6);
    ctx.quadraticCurveTo(r, r + 2, 0, r - 1);ctx.quadraticCurveTo(-r, r + 2, -r, 2);
  } else if (kind === 'attenuation') {
    ctx.arc(0, -3, r, Math.PI, 0);ctx.lineTo(r, r - 3);
    ctx.lineTo(r * .55, r - 8);ctx.lineTo(0, r - 2);
    ctx.lineTo(-r * .55, r - 8);ctx.lineTo(-r, r - 3);ctx.closePath();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  const fill = ctx.createRadialGradient(-r * .38, -r * .55, 1, 0, 0, r * 1.45);
  fill.addColorStop(0, '#ffffff');fill.addColorStop(.17, enemy.color);fill.addColorStop(1, '#172033');
  ctx.fillStyle = fill;ctx.fill();ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0d1d2a';ctx.lineWidth = 2;ctx.stroke();
  ctx.lineWidth = 1.5;
  if (kind === 'bend') {
    ctx.strokeStyle = '#fff3c3';ctx.beginPath();ctx.arc(0, 0, r * .62, .4, 4.9);ctx.stroke();
    ctx.strokeStyle = '#3b1f18';ctx.beginPath();ctx.moveTo(-r * .15, -r * .6);ctx.lineTo(r * .22, -.5);ctx.lineTo(-r * .2, r * .65);ctx.stroke();
  } else if (kind === 'crosstalk') {
    ctx.strokeStyle = '#b8fff5';ctx.beginPath();ctx.arc(-r * .25, 0, r * .49, .3, 5.7);ctx.moveTo(r * .25 + r * .49, 0);ctx.arc(r * .25, 0, r * .49, 0, 5.7);ctx.stroke();
  } else if (kind === 'lag') {
    ctx.strokeStyle = '#fff5ce';for (let i = 0; i < 2; i++) {ctx.beginPath();ctx.arc(0, 5, r * (.52 + i * .25), 3.75, 5.65);ctx.stroke()}
  } else if (kind === 'dirty') {
    ctx.fillStyle = '#563b63';for (const [a, b, s] of [[-.5,-.55,3],[.6,.3,4],[-.7,.55,2]]) {ctx.beginPath();ctx.arc(a * r,b * r,s,0,7);ctx.fill()}
  } else if (kind === 'packet') {
    ctx.strokeStyle = '#ffd5df';ctx.beginPath();ctx.moveTo(-r * .7,r * .35);ctx.lineTo(-r * .3,r * .1);ctx.lineTo(0,r * .45);ctx.lineTo(r * .6,r * .12);ctx.stroke();
  }
  const eyes = enemy.eyes || 2, spacing = Math.min(8, r * 1.4 / Math.max(1, eyes - 1));
  for (let i = 0; i < eyes; i++) {
    const ex = (i - (eyes - 1) / 2) * spacing, ey = -r * .18;
    ctx.fillStyle = '#101e2a';ctx.beginPath();ctx.arc(ex, ey, 4.7, 0, 7);ctx.fill();
    ctx.fillStyle = '#fff';ctx.beginPath();ctx.arc(ex, ey - .5, 3.5, 0, 7);ctx.fill();
    ctx.fillStyle = '#1b2838';ctx.beginPath();ctx.arc(ex + 1, ey, 1.7, 0, 7);ctx.fill();
  }
  if (enemy.elite) {ctx.strokeStyle = '#ffe08a';ctx.lineWidth = 2;ctx.beginPath();ctx.arc(0, 0, r + 2, .25, 2.9);ctx.stroke()}
  cache[kind] = canvas;
  return canvas;
}