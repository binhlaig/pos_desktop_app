import type { BusinessType } from "@/lib/business-type";

export const fruitModuleConfig = {
  key: "fruit",
  label: "Fruit",
  businessType: "FRUIT" satisfies BusinessType,
} as const;
