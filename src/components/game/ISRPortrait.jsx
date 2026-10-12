import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { characterSprite } from '@/game/art/characterSprites';
export default function ISRPortrait({name='Internet Services Representative'}){
 const [failed,setFailed]=useState(false),d=characterSprite('isr');
 if(failed)return <span role="alert" className="w-20 shrink-0 text-xs text-destructive">ISR portrait could not load.</span>;
 return <Image src={d.portrait} alt={`${name}, headset and laptop, seated in a rolling chair`} fittingType="fit" className="size-20 shrink-0" style={{imageRendering:'pixelated'}} width={64} height={64} onError={()=>setFailed(true)}/>;
}