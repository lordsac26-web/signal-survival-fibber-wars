import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { characterSprite } from '@/game/art/characterSprites';
export default function OraclePortrait({name='OTDR Oracle'}) {
  const [failed,setFailed]=useState(false);
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">Oracle portrait failed to load.</span>;
  return <Image src={characterSprite('oracle').portrait} alt={`${name} — supplied pixel-art portrait`} fittingType="fit" className="size-20 shrink-0 object-contain" style={{imageRendering:'pixelated'}} width={256} height={256} onError={()=>setFailed(true)}/>;
}