import type { BusinessType } from "@/lib/business-type";

export const fashionModuleConfig = {
  key: "fashion",
  label: "Fashion",
  businessType: "FASHION" satisfies BusinessType,
} as const;
