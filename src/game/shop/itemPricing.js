import { TUNING } from '@/game/data/tuning';
import { tierPrice } from '@/game/items/tiers';
export function priceOffer(item,wave){
  const cost=item.premium?item.cost:tierPrice(item.baseCost,item.rarity);
  return {...item,cost:Math.round(cost*(1+TUNING.priceWaveScale*(wave-1)))};
}