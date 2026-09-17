import { useRef } from 'react';

export default function TouchControls({ input }) {
  const pad=useRef(null);
  const move=e=>{const t=e.touches?.[0]||e;const r=pad.current.getBoundingClientRect();const x=t.clientX-(r.left+r.width/2),y=t.clientY-(r.top+r.height/2),m=Math.max(1,Math.hypot(x,y));input.current={x:x/m,y:y/m};};
  const stop=()=>{input.current={x:0,y:0};};
  return <div ref={pad} onTouchStart={move} onTouchMove={move} onTouchEnd={stop} className="absolute bottom-5 left-5 z-20 flex size-28 touch-none items-center justify-center rounded-full border-2 border-white/25 bg-slate-950/35 md:hidden" aria-label="Movement joystick"><div className="size-12 rounded-full border-2 border-cyan-100/50 bg-cyan-300/40"/></div>
}