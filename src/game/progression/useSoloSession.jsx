import { useRef, useState } from 'react';
import { resumeAudio } from '@/game/audio';
import { saveCheckpoint, recordRun, updateProfile } from '@/game/storage';
import { createRun, normalizeRun, advanceRunWave } from '@/game/progression/runRules';
import { applyStartingKit } from '@/game/progression/startingKit';
import { enterShop, shopTransaction } from '@/game/shop/shopRules';
import { pickUpgrade, upgradeChoices, rerollUpgradeChoices, skipUpgrade } from '@/game/progression/upgradeRules';
import { toast } from '@/components/ui/use-toast';
export { upgradeChoices } from '@/game/progression/upgradeRules';
export default function useSoloSession(profile){
  const [screen,setScreen]=useState('menu'),[run,setRun]=useState(null),[newUnlocks,setUnlocks]=useState([]);
  const current=useRef(null),phase=useRef('menu');
  const navigate=where=>{phase.current=where;setScreen(where)};
  const assign=(value,where,persist=true)=>{const {combineNotices=[],...clean}=value;const next=persist?saveCheckpoint(clean,where):clean;current.current=next;setRun(next);navigate(where);for(const notice of combineNotices)toast({...notice,duration:3500,className:'combine-flash'})};
  const start=(c,useAlt)=>{
    const alt=useAlt && profile.loadouts.includes(`${c.id}:alt`);resumeAudio();
    const next={...createRun(c,alt,Math.floor(Math.random()*0x7fffffff)),useAlt:alt};
    current.current=next;setRun(next);navigate('loadout'); // tool choice first; nothing persists until it is confirmed
  };
  const confirmKit=pickedIds=>{
    if(phase.current!=='loadout')return;
    const next=applyStartingKit(current.current,pickedIds);
    saveCheckpoint(next,'ready');assign(next,'game',false);
  };
  const newRun=()=>{if(profile.checkpoint && !window.confirm('Start a new run and discard the resumable solo checkpoint? Career history stays.'))return;updateProfile(p=>({...p,checkpoint:null}));navigate('select')};
  const resume=()=>{const cp=profile.checkpoint;if(!cp)return;const next=normalizeRun(cp.run);if(!next)return;resumeAudio();assign(next,cp.phase==='ready'?'game':cp.phase,false)};
  const finish=next=>{
    if(phase.current!=='game')return;
    if(!next.won){current.current=next;setRun(next);const result=recordRun(next);setUnlocks(result.newUnlocks);navigate('summary');return}
    const where=next.pendingLevels>0?'upgrade':'shop';assign(where==='shop'?enterShop(next):next,where);
  };
  const upgrade=item=>{
    const r=current.current;if(phase.current!=='upgrade' || !upgradeChoices(r).some(i=>i.id===item.id))return;
    const next=pickUpgrade(r,item.id);
    const where=next.pendingLevels>0?'upgrade':'shop';assign(where==='shop'?enterShop(next):next,where);
  };
  const shopAction=event=>{const next=shopTransaction(current.current,event);assign(next,'shop')};
  const reroll=()=>{if(phase.current!=='upgrade')return;try{assign(rerollUpgradeChoices(current.current),'upgrade')}catch(e){toast({title:'Reroll unavailable',description:e.message})}};
  const skip=()=>{if(phase.current!=='upgrade')return;const next=skipUpgrade(current.current);const where=next.pendingLevels>0?'upgrade':'shop';assign(where==='shop'?enterShop(next):next,where)};
  const nextWave=()=>{if(phase.current!=='shop')return;assign(advanceRunWave(current.current),'game',false)};
  return {screen,run,newUnlocks,navigate,start,confirmKit,newRun,resume,finish,upgrade,reroll,skip,shopAction,nextWave};
}