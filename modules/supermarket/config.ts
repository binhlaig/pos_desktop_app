import type { BusinessType } from "@/lib/business-type";

export const supermarketModuleConfig = {
  key: "supermarket",
  label: "Supermarket",
  businessType: "SUPERMARKET" satisfies BusinessType,
} as const;
