import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { characterSprite } from '@/game/art/characterSprites';
export default function AdminPortrait({name='No Accountability Admin'}){
  const [failed,setFailed]=useState(false);
  const def=characterSprite('admin');
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">Admin portrait failed to load.</span>;
  return <Image src={def.portrait} alt={`${name} — idle frame 0`} fittingType="fit" className="size-20 shrink-0 object-contain" style={{imageRendering:'pixelated'}} width={def.portraitW} height={def.portraitH} onError={()=>setFailed(true)}/>;
}