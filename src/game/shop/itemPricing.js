import { wavePriceMultiplier } from '@/game/shop/economy';
import { tierPrice } from '@/game/items/tiers';
export function priceOffer(item,wave){
  const cost=item.premium?item.cost:tierPrice(item.baseCost,item.rarity);
  return {...item,cost:Math.round(cost*wavePriceMultiplier(wave))};
}