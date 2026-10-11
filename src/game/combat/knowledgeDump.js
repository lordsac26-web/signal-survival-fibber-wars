// The supplied strip's fourth cell (zero-based 3), not its last cell, is impact.
export const KNOWLEDGE_DUMP=Object.freeze({charge:2.5,recovery:.5,impactHold:.12,total:3,chargeFrames:[0,1,2],impactFrame:3,recoveryFrames:[4,5,6]});
export function knowledgeDumpPhase(remaining){
 if(remaining<=0)return 'idle';
 const elapsed=KNOWLEDGE_DUMP.total-remaining;
 return elapsed<KNOWLEDGE_DUMP.charge-1e-8?'charge':elapsed<KNOWLEDGE_DUMP.charge+KNOWLEDGE_DUMP.impactHold-1e-8?'impact':'recovery';
}
export function knowledgeDumpFrame(remaining){
 const d=KNOWLEDGE_DUMP,elapsed=Math.max(0,d.total-remaining),phase=knowledgeDumpPhase(remaining);
 if(phase==='charge')return d.chargeFrames[Math.min(2,Math.floor(elapsed/d.charge*3))];
 if(phase==='impact')return d.impactFrame;
 const progress=(elapsed-d.charge-d.impactHold)/(d.recovery-d.impactHold);
 return d.recoveryFrames[Math.max(0,Math.min(2,Math.floor(progress*3)))];
}