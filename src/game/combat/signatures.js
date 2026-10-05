// Granted abilities operate only on engine-owned pools; no React frame updates.
export function activateSignature(run,p,api){
  switch(run.character.special.id){
    case 'callback':api.area(300,80,'#67e8f9');return 0;
    case 'clause':api.area(260,90,'#fbbf24');return 0;
    case 'trace':for(let i=0;i<12;i++)api.launch({damage:90,range:700,rangeProfile:'trace',pattern:'pierce',color:'#22d3ee'},i*Math.PI/6);return 0;
    case 'deepclean':api.heal(45);api.area(260,55,'#34d399');return 0;
    case 'fortify':return api.turret({mode:'pellet',index:0,life:8,damage:30,range:340,fire:.4,color:'#facc15'})?0:null;
    case 'crew':{let placed=0;for(let i=0;i<4;i++)if(api.turret({mode:'helper',index:i,life:8,damage:18,range:280,fire:.65,color:'#38bdf8'}))placed++;return placed?0:null}
    case 'frenzy':api.area(120,60,'#c084fc');return 5;
    case 'meeting':p.inv=Math.max(p.inv,1.5);return 1.5;
    case 'barrier':return api.barrier()?0:null;
    case 'sprint':return 5;
    case 'deadline':return 4;
    case 'cash':return 8;   // double Signal on every drop while the timer runs
    case 'outage':return 8; // −50% player damage + slowed spawns while it runs
    default:return null;
  }
}