import { ENEMIES, WEAPONS } from '@/game/signalData';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function createSignalEngine(canvas, run, input, callbacks) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W=0,H=0,last=performance.now(), raf, spawn=0, hudTick=0, over=false;
  const duration = Math.min(90, 20 + (run.wave-1)*4);
  let time=duration, signal=run.signal, kills=run.kills, xp=run.xp || 0, levels=0;
  const p={x:0,y:0,r:17,hp:run.hp,maxHp:run.maxHp,inv:0,regen:0};
  const enemies=[], shots=[], drops=[], particles=[], zones=[];
  const cooldowns=run.weapons.map(()=>0);

  function resize(){ const r=canvas.getBoundingClientRect(); W=r.width;H=r.height;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0); if(!p.x){p.x=W/2;p.y=H/2;} }
  function addEnemy(){ const keys=Object.keys(ENEMIES).slice(0,Math.min(7,2+Math.floor(run.wave/2))); const kind=keys[Math.floor(Math.random()*keys.length)]; const base=ENEMIES[kind], edge=Math.floor(Math.random()*4), pad=35; let x=edge===1?W+pad:edge===3?-pad:Math.random()*W; let y=edge===0?-pad:edge===2?H+pad:Math.random()*H; enemies.push({...base,kind,x,y,hp:base.hp*(1+(run.wave-1)*.19),max:base.hp*(1+(run.wave-1)*.19),speed:base.speed*(1+(run.wave-1)*.025),phase:Math.random()*6}); }
  function nearest(range=9999){ let best=null,bd=range; for(const e of enemies){const d=dist(p,e);if(d<bd){best=e;bd=d;}} return best; }
  function burst(x,y,color,count=8){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:(Math.random()-.5)*150,life:.45,color});}
  function hit(e,damage,color){ const crit=Math.random()<run.crit; const amount=damage*run.damage*(crit?2:1);e.hp-=amount;burst(e.x,e.y,color,crit?10:3);if(crit)callbacks.flash?.('CRITICAL SPLICE!'); }
  function attack(w){ const t=nearest(w.range*run.range);if(!t)return; const a=Math.atan2(t.y-p.y,t.x-p.x);if(w.type==='nova'||w.type==='slash'){ for(const e of enemies)if(dist(p,e)<w.range*run.range)hit(e,w.damage,w.color); shots.push({x:p.x,y:p.y,r:8,max:w.range*run.range,life:.22,color:w.color,nova:true}); if(w.heal)p.hp=Math.min(p.maxHp,p.hp+w.heal); } else {shots.push({x:p.x,y:p.y,vx:Math.cos(a)*520,vy:Math.sin(a)*520,r:w.type==='pierce'?7:5,life:w.range*run.range/520,damage:w.damage,color:w.color,pierce:w.type==='pierce',seen:new Set()});} }
  function update(dt){
    time-=dt;p.inv=Math.max(0,p.inv-dt);p.regen+=dt*run.regen;if(p.regen>=1){const h=Math.floor(p.regen);p.hp=Math.min(p.maxHp,p.hp+h);p.regen-=h;}
    let ix=input.current.x,iy=input.current.y; if(ix||iy){const m=Math.hypot(ix,iy)||1;p.x+=ix/m*run.speed*dt;p.y+=iy/m*run.speed*dt;}p.x=clamp(p.x,p.r,W-p.r);p.y=clamp(p.y,p.r,H-p.r);
    spawn-=dt; if(spawn<=0){const count=1+(Math.random()<Math.min(.55,run.wave*.05)?1:0);for(let i=0;i<count;i++)addEnemy();spawn=Math.max(.18,.82-run.wave*.045);}
    run.weapons.forEach((id,i)=>{cooldowns[i]-=dt;const w=WEAPONS[id];if(w&&cooldowns[i]<=0){attack(w);cooldowns[i]=w.rate/run.attackSpeed;}});
    for(const s of shots){s.life-=dt;if(s.nova){s.r+=(s.max-s.r)*.35;continue;}s.x+=s.vx*dt;s.y+=s.vy*dt;for(const e of enemies){if(dist(s,e)<s.r+e.r&&!s.seen.has(e)){hit(e,s.damage,s.color);s.seen.add(e);if(!s.pierce)s.life=0;}}}
    for(const e of enemies){e.phase+=dt*5;const a=Math.atan2(p.y-e.y,p.x-e.x);e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;if(dist(p,e)<p.r+e.r&&p.inv<=0){p.hp-=Math.max(2,e.damage-run.armor*1.5);p.inv=.55;burst(p.x,p.y,'#ffffff',14);callbacks.shake?.();}}
    for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.hp<=0){kills++;xp+=e.value;drops.push({x:e.x,y:e.y,r:5,value:e.value});burst(e.x,e.y,e.color,12);enemies.splice(i,1);}}
    for(const d of drops){const dd=dist(p,d);if(dd<110){d.x+=(p.x-d.x)*dt*6;d.y+=(p.y-d.y)*dt*6;}if(dd<p.r+10){signal+=d.value;d.got=true;while(xp>=18+(run.level+levels)*8){xp-=18+(run.level+levels)*8;levels++;callbacks.flash?.('SIGNAL LEVEL UP!');}}}
    for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;}
    for(const arr of [shots,drops,particles])for(let i=arr.length-1;i>=0;i--)if(arr[i].life<=0||arr[i].got)arr.splice(i,1);
    if((p.hp<=0||time<=0)&&!over){over=true;cancelAnimationFrame(raf);callbacks.finish({ ...run,hp:Math.max(0,p.hp),signal,kills,xp,pendingLevels:levels,won:p.hp>0 });}
    hudTick-=dt;if(hudTick<=0){callbacks.hud({hp:p.hp,maxHp:p.maxHp,time:Math.max(0,time),signal,kills});hudTick=.1;}
  }
  function blob(e){ctx.save();ctx.translate(e.x,e.y+Math.sin(e.phase)*2);ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(0,0,e.r,0,7);ctx.fill();ctx.fillStyle='#fff';for(let i=0;i<e.eyes;i++){const x=(i-(e.eyes-1)/2)*7;ctx.beginPath();ctx.arc(x,-4,4,0,7);ctx.fill();ctx.fillStyle='#172033';ctx.beginPath();ctx.arc(x+1,-4,2,0,7);ctx.fill();ctx.fillStyle='#fff';}ctx.fillStyle='#172033';ctx.fillRect(-5,7,10,3);ctx.restore();}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#172d32';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(83,211,190,.09)';ctx.lineWidth=1;for(let x=0;x<W;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.fillStyle='rgba(255,255,255,.035)';for(let i=0;i<10;i++)ctx.fillRect((i*191)%W,(i*113)%H,60,5);for(const d of drops){ctx.shadowBlur=12;ctx.shadowColor='#67e8f9';ctx.fillStyle='#67e8f9';ctx.beginPath();ctx.arc(d.x,d.y,5,0,7);ctx.fill();ctx.shadowBlur=0;}for(const e of enemies)blob(e);for(const s of shots){ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=5;if(s.nova){ctx.globalAlpha=Math.max(0,s.life*4);ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.stroke();ctx.globalAlpha=1;}else{ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();}}for(const q of particles){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,3,3);}ctx.globalAlpha=1;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=run.character.color;ctx.beginPath();ctx.arc(0,0,p.r,0,7);ctx.fill();ctx.fillStyle=run.character.vest;ctx.fillRect(-14,2,28,16);ctx.fillStyle='#f8fafc';ctx.fillRect(-8,-5,6,7);ctx.fillRect(3,-5,6,7);ctx.fillStyle='#172033';ctx.fillRect(-6,-3,2,3);ctx.fillRect(5,-3,2,3);ctx.fillStyle=run.character.color;ctx.fillRect(-20,-17,40,8);ctx.restore();}
  function frame(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();if(!over)raf=requestAnimationFrame(frame);}
  resize();window.addEventListener('resize',resize);raf=requestAnimationFrame(frame);
  return()=>{over=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
}