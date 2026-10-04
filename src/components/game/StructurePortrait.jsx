import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { structureSpriteDef } from '@/game/art/characterSprites';
export default function StructurePortrait({id,name}){
  const [failed,setFailed]=useState(false);
  const def=structureSpriteDef(id);
  if(!def)return null;
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">{name} portrait failed to load.</span>;
  return <Image src={def.portrait} alt={`${name} — supplied FIBERNET bucket-truck portrait`} fittingType="fit" className="size-20 shrink-0 object-contain" width={def.portraitW} height={def.portraitH} onError={()=>setFailed(true)}/>;
}