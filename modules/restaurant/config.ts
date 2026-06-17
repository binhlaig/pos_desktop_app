import type { BusinessType } from "@/lib/business-type";

export const restaurantModuleConfig = {
  key: "restaurant",
  label: "Restaurant",
  businessType: "RESTAURANT" satisfies BusinessType,
} as const;
