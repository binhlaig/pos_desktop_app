import {
  Armchair,
  ChefHat,
  ClipboardList,
  HandPlatter,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Utensils,
} from "lucide-react";
import type { ComponentType } from "react";

export type BusinessType =
  | "SUPERMARKET"
  | "RESTAURANT"
  | "FASHION"
  | "FRUIT"
  | "BOTH";
export type BusinessPageType =
  | "SUPERMARKET"
  | "RESTAURANT"
  | "FASHION"
  | "COMMON";

export const DASHBOARD_HOME = "/dashboard";
export const SUPERMARKET_POS_PATH = "/dashboard/register";
export const RESTAURANT_POS_PATH = "/dashboard/restaurant-pos";
export const FASHION_POS_PATH = "/dashboard/fashion/register";

export const POS_CASHIER_ROUTES = [
  SUPERMARKET_POS_PATH,
  RESTAURANT_POS_PATH,
  FASHION_POS_PATH,
] as const;

export const restaurantRoutes = {
  menu: "/dashboard/restaurant/menu",
  tables: "/dashboard/restaurant/tables",
  kitchen: "/dashboard/restaurant/kitchen",
  orders: "/dashboard/restaurant/orders",
} as const;

export const supermarketRoutes = {
  products: "/dashboard/products",
  receipts: "/dashboard/receipts",
} as const;

export const commonRoutes = {
  staff: "/dashboard/staff",
  settings: "/dashboard/settings",
} as const;

export type SidebarItem = {
  label: string;
  href: string;
  businessPageType: BusinessPageType;
  icon: ComponentType<{ className?: string }>;
  featureKeys?: string[];
};

const supermarketSidebarItems: SidebarItem[] = [
  {
    label: "Supermarket POS",
    href: SUPERMARKET_POS_PATH,
    businessPageType: "SUPERMARKET",
    icon: ShoppingCart,
    featureKeys: ["posRegisterEnabled"],
  },
  {
    label: "Products",
    href: supermarketRoutes.products,
    businessPageType: "SUPERMARKET",
    icon: Package,
    featureKeys: ["productsEnabled"],
  },
  {
    label: "Receipts",
    href: supermarketRoutes.receipts,
    businessPageType: "SUPERMARKET",
    icon: ReceiptText,
    featureKeys: ["receiptsEnabled"],
  },
];

const restaurantSidebarItems: SidebarItem[] = [
  {
    label: "Restaurant POS",
    href: RESTAURANT_POS_PATH,
    businessPageType: "RESTAURANT",
    icon: Utensils,
    featureKeys: ["restaurantPosEnabled", "allowRestaurant"],
  },
  {
    label: "Restaurant Menu",
    href: restaurantRoutes.menu,
    businessPageType: "RESTAURANT",
    icon: Store,
    featureKeys: ["restaurantPosEnabled", "allowRestaurant"],
  },
  {
    label: "Tables",
    href: restaurantRoutes.tables,
    businessPageType: "RESTAURANT",
    icon: Armchair,
    featureKeys: ["restaurantTablesEnabled", "allowTableOrder"],
  },
  {
    label: "Kitchen",
    href: restaurantRoutes.kitchen,
    businessPageType: "RESTAURANT",
    icon: ChefHat,
    featureKeys: ["restaurantKitchenEnabled", "allowKitchen"],
  },
  {
    label: "Orders",
    href: restaurantRoutes.orders,
    businessPageType: "RESTAURANT",
    icon: ClipboardList,
    featureKeys: ["restaurantOrdersEnabled", "allowRestaurant"],
  },
{
 label: "Services",
  href: "/dashboard/restaurant/serving",
  businessPageType: "RESTAURANT",
  icon: HandPlatter ,
},
];

const commonSidebarItems: SidebarItem[] = [
  {
    label: "Dashboard",
    href: DASHBOARD_HOME,
    businessPageType: "COMMON",
    icon: LayoutDashboard,
    featureKeys: ["dashboardEnabled"],
  },
  {
    label: "Staff",
    href: commonRoutes.staff,
    businessPageType: "COMMON",
    icon: Users,
    featureKeys: ["staffEnabled"],
  },
  {
    label: "Settings",
    href: commonRoutes.settings,
    businessPageType: "COMMON",
    icon: Settings,
  },
];

function parseBusinessType(value: unknown): BusinessType | null {
  const text = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!text) return null;
  if (
    ["SUPERMARKET", "MARKET", "RETAIL", "GROCERY", "STORE", "SHOP"].includes(
      text
    )
  ) {
    return "SUPERMARKET";
  }
  if (["RESTAURANT", "RESTO", "FOOD", "CAFE", "BAR"].includes(text)) {
    return "RESTAURANT";
  }
  if (
    ["FASHION", "CLOTHING", "CLOTHES", "APPAREL", "BOUTIQUE"].includes(text)
  ) {
    return "FASHION";
  }
  if (
    ["FRUIT", "FRUITS", "PRODUCE", "FRUIT_SHOP", "FRUIT_STORE"].includes(text)
  ) {
    return "FRUIT";
  }
  if (
    [
      "BOTH",
      "ALL",
      "MIXED",
      "SUPERMARKET_RESTAURANT",
      "RESTAURANT_SUPERMARKET",
    ].includes(text)
  ) {
    return "BOTH";
  }

  return null;
}

export function normalizeBusinessType(value: unknown): BusinessType {
  return parseBusinessType(value) ?? "SUPERMARKET";
}

export function isSupermarket(value: unknown): boolean {
  const type = normalizeBusinessType(value);

  return type === "SUPERMARKET" || type === "BOTH";
}

export function isRestaurant(value: unknown): boolean {
  const type = normalizeBusinessType(value);

  return type === "RESTAURANT" || type === "BOTH";
}

export function isFashion(value: unknown): boolean {
  return normalizeBusinessType(value) === "FASHION";
}

export function isFruit(value: unknown): boolean {
  return normalizeBusinessType(value) === "FRUIT";
}

export function getHomePathByBusinessType(type: BusinessType | null): string {
  if (type === "SUPERMARKET") return SUPERMARKET_POS_PATH;
  if (type === "RESTAURANT") return RESTAURANT_POS_PATH;
  if (type === "FASHION") return FASHION_POS_PATH;
  return DASHBOARD_HOME;
}

export function canAccessBusinessPage(
  businessType: BusinessType | null,
  pageType: BusinessPageType
): boolean {
  if (pageType === "COMMON") return true;
  if (!businessType) return true;
  if (businessType === "BOTH") return true;
  return businessType === pageType;
}

export function isPosCashierRoute(pathname: string): boolean {
  return POS_CASHIER_ROUTES.some((route) => pathname.startsWith(route));
}

export function getAllowedSidebarItemsByBusinessType(
  businessType: BusinessType | null
): SidebarItem[] {
  if (businessType === "SUPERMARKET") {
    return [...commonSidebarItems, ...supermarketSidebarItems];
  }

  if (businessType === "RESTAURANT") {
    return [...commonSidebarItems, ...restaurantSidebarItems];
  }

  if (businessType === "BOTH") {
    return [
      ...commonSidebarItems,
      ...supermarketSidebarItems,
      ...restaurantSidebarItems,
    ];
  }

  return commonSidebarItems;
}

function isExplicitlyFalse(value: unknown) {
  return value === false || value === "false" || value === 0 || value === "0";
}

export function filterSidebarItemsByFeatures(
  items: SidebarItem[],
  features: Record<string, unknown> | null | undefined
) {
  if (!features) return items;

  return items.filter((item) => {
    if (item.href === commonRoutes.settings) return true;
    if (!item.featureKeys?.length) return true;

    return !item.featureKeys.some((key) => isExplicitlyFalse(features[key]));
  });
}

export function getPageTypeByPath(pathname: string): BusinessPageType {
  if (
    pathname.startsWith(SUPERMARKET_POS_PATH) ||
    pathname.startsWith(supermarketRoutes.products) ||
    pathname.startsWith(supermarketRoutes.receipts)
  ) {
    return "SUPERMARKET";
  }

  if (
    pathname.startsWith(RESTAURANT_POS_PATH) ||
    pathname.startsWith("/dashboard/restaurant/")
  ) {
    return "RESTAURANT";
  }

  if (pathname.startsWith(FASHION_POS_PATH)) {
    return "FASHION";
  }

  return "COMMON";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function pickBusinessType(payload: unknown): BusinessType | null {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const shop = asRecord(root.shop);
  const user = asRecord(root.user);

  const candidates = [
    root.businessType,
    root.business_type,
    root.shopType,
    root.shop_type,
    root.type,
    data.businessType,
    data.business_type,
    data.shopType,
    data.shop_type,
    shop.businessType,
    shop.business_type,
    shop.shopType,
    shop.shop_type,
    user.businessType,
    user.business_type,
  ];

  for (const candidate of candidates) {
    const type = parseBusinessType(candidate);

    if (type) return type;
  }

  return null;
}

export function decodeJwtBusinessType(token: string | null | undefined) {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    if (typeof window === "undefined") return null;

    const json = atob(padded);

    return pickBusinessType(JSON.parse(json));
  } catch {
    return null;
  }
}

export function getStoredBusinessType(): BusinessType | null {
  if (typeof window === "undefined") return null;

  const direct =
    localStorage.getItem("pos_business_type") ||
    localStorage.getItem("businessType") ||
    localStorage.getItem("shop_business_type");

  const fromDirect = parseBusinessType(direct);
  if (fromDirect) return fromDirect;

  const profile = localStorage.getItem("pos_shop_owner_profile");
  if (!profile) return null;

  try {
    return pickBusinessType(JSON.parse(profile));
  } catch {
    return null;
  }
}

export function storeBusinessType(businessType: BusinessType | null) {
  if (typeof window === "undefined" || !businessType) return;

  localStorage.setItem("pos_business_type", businessType);
}
