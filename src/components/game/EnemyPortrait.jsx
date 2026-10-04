import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { enemySpriteDef } from '@/game/art/characterSprites';
export default function EnemyPortrait({id,name}){
  const [failed,setFailed]=useState(false);
  const def=enemySpriteDef(id);
  if(!def)return null;
  if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">{name} portrait failed to load.</span>;
  return <Image src={def.portrait} alt={`${name} — supplied pixel-art portrait`} fittingType="fit" className="size-20 shrink-0 object-contain" style={{imageRendering:'pixelated'}} width={256} height={256} onError={()=>setFailed(true)}/>;
}