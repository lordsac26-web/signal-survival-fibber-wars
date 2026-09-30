import { useEffect, useRef } from 'react';
import { ENEMIES } from '@/game/data/combat';
import { enemySprite } from '@/game/performance/spriteAtlas';
export default function LandingArtwork() {
  const ref=useRef(null);
  useEffect(()=>{
    const ctx=ref.current.getContext('2d');ctx.clearRect(0,0,600,380);
    ctx.fillStyle='#152936';ctx.fillRect(0,0,600,380);ctx.strokeStyle='#2a555a';ctx.lineWidth=2;
    for(let x=0;x<600;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,380);ctx.stroke()}
    ctx.strokeStyle='#67e8f9';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(20,330);ctx.bezierCurveTo(80,80,200,380,260,185);ctx.bezierCurveTo(320,0,420,250,570,70);ctx.stroke();
    ctx.fillStyle='#f8fafc';ctx.fillRect(60,150,190,80);ctx.fillRect(180,110,70,70);ctx.fillStyle='#fbbf24';ctx.fillRect(60,185,190,15);ctx.fillStyle='#38bdf8';ctx.fillRect(190,120,45,45);ctx.fillStyle='#172033';ctx.beginPath();ctx.arc(95,235,22,0,7);ctx.arc(215,235,22,0,7);ctx.fill();
    ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(325,220,30,0,7);ctx.fill();ctx.fillStyle='#f97316';ctx.fillRect(294,240,62,48);ctx.fillStyle='#fff';ctx.fillRect(306,214,13,15);ctx.fillRect(330,214,13,15);ctx.fillStyle='#172033';ctx.fillRect(312,218,5,7);ctx.fillRect(334,218,5,7);ctx.fillRect(290,268,70,10);ctx.fillStyle='#facc15';ctx.fillRect(287,191,76,13);
    for(const [kind,x,y] of [['jitter',460,130],['packet',470,300],['bend',545,215]]){const s=enemySprite(kind,ENEMIES[kind]);ctx.drawImage(s,x-40,y-40,80,80)}
    ctx.fillStyle='#f8fafc';ctx.font='bold 18px sans-serif';ctx.fillText('MYSTERY OUTAGE, REAL ATTITUDE.',35,45);
  },[]);
  return <div className="overflow-hidden rounded-3xl border-2 border-game-signal/30"><canvas ref={ref} width="600" height="380" role="img" aria-label="Cartoon fiber technician, company van, fiber cable and familiar googly-eyed impairments" className="h-auto w-full"/></div>;
}