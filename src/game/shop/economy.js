import { TUNING } from '@/game/data/tuning';
export const wavePriceMultiplier=wave=>1+TUNING.priceWaveScale*Math.max(0,wave-1);
export const rerollCost=(wave,rerolls=0)=>Math.ceil(TUNING.rerollBase*wavePriceMultiplier(wave)*Math.pow(1.35,Math.max(0,rerolls)));
export const healingCost=wave=>Math.ceil(12*wavePriceMultiplier(wave));
export const healingAmount=run=>Math.min(run.maxHp-run.hp,Math.ceil(run.maxHp*.22));
export function buyHealing(run){
  const amount=healingAmount(run),cost=healingCost(run.wave);
  if(amount<=0)throw new Error('Integrity is already full');
  if(run.signal<cost)throw new Error('Not enough spendable Signal');
  return {...run,hp:run.hp+amount,signal:run.signal-cost};
}