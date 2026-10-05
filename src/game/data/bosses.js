// The first true boss. Spawned by the engine at the wave-20 gate and every
// 10 waves after (see bossWave). Kept OUT of ENEMIES in combat.js so the
// ordinary spawn pool can never pick it.
//
// Number rationale: enemies scale HP by (1 + 0.19 × (wave − 1)); at wave 20
// that is ×4.61, so 520 base HP ≈ 2,397 effective HP — about 3.6× a wave-20
// Attenuation Apparition (~669 HP), i.e. a focused 20–30s kill that cannot be
// face-tanked (22 contact damage) and cannot be instakilled (boss flag).
// Speed 95 keeps the boss a genuine chase threat and lets it actually escape
// between FEC casts, without outrunning any player build.
export const SQUIRREL=Object.freeze({
  id:'squirrel',name:'Fiber-Nibbling Squirrel',color:'#b4763f',
  hp:520,speed:95,damage:22,r:26,value:30,
  // FEC: 55°-total cone locked in aim at windup start; 7 pellets at 290 units/s
  // cross the 340-unit reach in ~1.2s, so strafing sideways during the 0.8s
  // tail-fluffing windup cleanly dodges it. 5s cooldown between casts.
  cone:Object.freeze({half:27.5*Math.PI/180,range:340,damage:16,pellets:7,speed:290,cooldown:5,windup:.8}),
  intro:'A SQUIRREL HAS CHEWED THE AERIAL DROP!',
  phaseFlash:'THE SQUIRREL PUFFS UP — FLEEING, AND FIRING FEC!',
  flavor:"Officially, aerial fiber fails from weather. Unofficially, it is one squirrel with strong opinions about cable texture. It chews the drop for the crunch, causes the outage, and files no incident report. At half health it stops being brave and starts being a logistics problem: it flees, hides behind other impairments, and lobs FEC (Fiber-Encrusted Crap) from cover.",
  counter:'Strafe during the tail-fluffing windup; the cone aim is locked the moment it starts. Chase it between casts — it cannot cast while running.'
});
export const bossWave=wave=>wave>=20&&wave%10===0;