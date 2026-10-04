import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { characterSprite } from '@/game/art/characterSprites';
export default function DonPortrait({name='Dispatch Don'}) {
  const [failed,setFailed]=useState(false);
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">Dispatch Don portrait failed to load.</span>;
  return <Image src={characterSprite('don').portrait} alt={`${name} — supplied pixel-art portrait`} fittingType="fit" className="size-20 shrink-0 object-contain" style={{imageRendering:'pixelated'}} width={127} height={193} onError={()=>setFailed(true)}/>;
}