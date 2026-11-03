// Guarantees replace ordinary spawn capacity. No teleports or extra-cap ambushes.
export function createEncounterDirector(wave,random=Math.random){
  let forward=false,ranged=wave<5,pincer=wave<8;
  return {
    reserved:()=>pincer?0:2,
    next(elapsed,active,cap,heading=0){
      if(!forward&&active<cap){forward=true;return [{angle:heading+(random()-.5)*Math.PI*2/3,tag:'forward'}]}
      if(!ranged&&elapsed>=1&&active<cap){ranged=true;return [{kind:'attenuation',angle:random()*Math.PI*2,tag:'ranged'}]}
      if(!pincer&&elapsed>=2&&active<=cap-2){pincer=true;const edge=Math.floor(random()*4);return [{edge,tag:'pincer'},{edge:(edge+2)%4,tag:'pincer'}]}
      return [];
    }
  };
}
export function perimeterSpawn(player,bounds,angle,pad=35){
  const dx=Math.cos(angle),dy=Math.sin(angle),tx=dx>1e-8?(bounds.x+bounds.width-player.x)/dx:dx< -1e-8?(bounds.x-player.x)/dx:Infinity,ty=dy>1e-8?(bounds.y+bounds.height-player.y)/dy:dy< -1e-8?(bounds.y-player.y)/dy:Infinity,t=Math.max(0,Math.min(tx,ty))+pad;
  return {x:player.x+dx*t,y:player.y+dy*t};
}