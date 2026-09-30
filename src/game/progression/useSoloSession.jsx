import { useRef, useState } from 'react';
import { resumeAudio } from '@/game/audio';
import { saveCheckpoint, recordRun, updateProfile } from '@/game/storage';
import { createRun, normalizeRun, rebuildStats } from '@/game/progression/runRules';
import { enterShop, shopTransaction } from '@/game/shop/shopRules';
import { createGenerator } from '@/game/data/generation';
export const upgradeChoices=run=>{const g=createGenerator(run.seed+run.level*3571+17);return [g.passive(run.luck),g.passive(run.luck),g.passive(run.luck)]};
export default function useSoloSession(profile){
  const [screen,setScreen]=useState('menu'),[run,setRun]=useState(null),[newUnlocks,setUnlocks]=useState([]);
  const current=useRef(null),phase=useRef('menu');
  const navigate=where=>{phase.current=where;setScreen(where)};
  const assign=(value,where,persist=true)=>{const next=persist?saveCheckpoint(value,where):value;current.current=next;setRun(next);navigate(where)};
  const start=(c,useAlt)=>{
    const alt=useAlt && profile.loadouts.includes(`${c.id}:alt`);resumeAudio();
    const next={...createRun(c,alt,Math.floor(Math.random()*0x7fffffff)),useAlt:alt};
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
    const next=rebuildStats({...r,level:r.level+1,pendingLevels:r.pendingLevels-1,items:[...r.items,{...item,levelUpgrade:true}]});
    const where=next.pendingLevels>0?'upgrade':'shop';assign(where==='shop'?enterShop(next):next,where);
  };
  const shopAction=event=>{const next=shopTransaction(current.current,event);assign(next,'shop')};
  const nextWave=()=>{if(phase.current!=='shop')return;const r=current.current;assign({...r,wave:r.wave+1,hp:Math.min(r.maxHp,r.hp+Math.ceil(r.maxHp*.22))},'game',false)};
  return {screen,run,newUnlocks,navigate,start,newRun,resume,finish,upgrade,shopAction,nextWave};
}