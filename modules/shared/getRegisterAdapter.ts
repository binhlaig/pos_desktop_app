import { normalizeBusinessType } from "@/lib/business-type";
import { fashionRegisterAdapter } from "@/modules/fashion/registerAdapter";
import { fruitRegisterAdapter } from "@/modules/fruit/registerAdapter";
import { restaurantRegisterAdapter } from "@/modules/restaurant/registerAdapter";
import type { RegisterAdapter } from "@/modules/shared/registerTypes";
import { supermarketRegisterAdapter } from "@/modules/supermarket/registerAdapter";

export function getRegisterAdapter(businessType: unknown): RegisterAdapter {
  const normalized = normalizeBusinessType(businessType);

  if (normalized === "RESTAURANT") return restaurantRegisterAdapter;
  if (normalized === "FASHION") return fashionRegisterAdapter;
  if (normalized === "FRUIT") return fruitRegisterAdapter;

  return supermarketRegisterAdapter;
}
