// export type BrandColors = {
//   name: string;
//   primary: string;
//   accent: string;
// };

// export const BRAND_COLOR_STORAGE_KEY =
//   "binhlaig_dashboard_brand_colors";

// export const DEFAULT_BRAND_COLORS: BrandColors = {
//   name: "Binhlaig",
//   primary: "#0B1F3A",
//   accent: "#D4A017",
// };

// export function applyBrandColors(colors: BrandColors) {
//   if (typeof document === "undefined") return;

//   const root = document.documentElement;

//   root.style.setProperty("--brand-primary", colors.primary);
//   root.style.setProperty("--brand-accent", colors.accent);
// }

// export function saveBrandColors(colors: BrandColors) {
//   if (typeof window === "undefined") return;

//   window.localStorage.setItem(
//     BRAND_COLOR_STORAGE_KEY,
//     JSON.stringify(colors),
//   );

//   applyBrandColors(colors);
// }

// export function getStoredBrandColors(): BrandColors {
//   if (typeof window === "undefined") {
//     return DEFAULT_BRAND_COLORS;
//   }

//   try {
//     const stored = JSON.parse(
//       window.localStorage.getItem(
//         BRAND_COLOR_STORAGE_KEY,
//       ) || "null",
//     ) as Partial<BrandColors> | null;

//     if (stored?.primary && stored?.accent) {
//       return {
//         name: stored.name || "Custom",
//         primary: stored.primary,
//         accent: stored.accent,
//       };
//     }
//   } catch {
//     // Default color ကို အသုံးပြုမည်
//   }

//   return DEFAULT_BRAND_COLORS;
// }






export type BrandColors = {
  name: string;
  primary: string;
  accent: string;
};

export const BRAND_COLOR_STORAGE_KEY =
  "binhlaig_brand_colors";

export const BRAND_PRESETS: BrandColors[] = [
  {
    name: "Binhlaig",
    primary: "#0B1F3A",
    accent: "#D4A017",
  },
  {
    name: "Ocean",
    primary: "#075985",
    accent: "#38BDF8",
  },
  {
    name: "Emerald",
    primary: "#064E3B",
    accent: "#34D399",
  },
  {
    name: "Violet",
    primary: "#4C1D95",
    accent: "#A78BFA",
  },
  {
    name: "Rose",
    primary: "#881337",
    accent: "#FB7185",
  },
  {
    name: "Amber",
    primary: "#78350F",
    accent: "#FBBF24",
  },
];

export const DEFAULT_BRAND_COLORS =
  BRAND_PRESETS[0];

function isHexColor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^#[0-9a-f]{6}$/i.test(value)
  );
}

export function applyBrandColors(
  colors: BrandColors,
) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.setProperty(
    "--brand-primary",
    colors.primary,
  );

  root.style.setProperty(
    "--brand-accent",
    colors.accent,
  );
}

export function saveBrandColors(
  colors: BrandColors,
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    BRAND_COLOR_STORAGE_KEY,
    JSON.stringify(colors),
  );

  applyBrandColors(colors);

  window.dispatchEvent(
    new CustomEvent("brand-colors-changed", {
      detail: colors,
    }),
  );
}

export function getStoredBrandColors(): BrandColors {
  if (typeof window === "undefined") {
    return DEFAULT_BRAND_COLORS;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        BRAND_COLOR_STORAGE_KEY,
      ) || "null",
    ) as Partial<BrandColors> | null;

    if (
      stored &&
      isHexColor(stored.primary) &&
      isHexColor(stored.accent)
    ) {
      return {
        name: stored.name || "Custom",
        primary: stored.primary,
        accent: stored.accent,
      };
    }
  } catch {
    // Invalid data ဖြစ်လျှင် default color သုံးမည်
  }

  return DEFAULT_BRAND_COLORS;
}