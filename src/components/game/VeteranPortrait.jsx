import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { characterSprite } from '@/game/art/characterSprites';
export default function VeteranPortrait({name='30 Year Veteran'}) {
  const [failed,setFailed]=useState(false);
  const def=characterSprite('veteran');
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">Veteran portrait failed to load.</span>;
  return <Image src={def.portrait} alt={`${name} — supplied pixel-art portrait`} fittingType="fit" className="size-20 shrink-0 object-contain" style={{imageRendering:'pixelated'}} width={def.portraitW} height={def.portraitH} onError={()=>setFailed(true)}/>;
}