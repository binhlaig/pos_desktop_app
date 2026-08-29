


"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  ClipboardList,
  Coffee,
  Package,
  Receipt,
  ShoppingCart,
  Sparkles,
  Store,
  Table2,
  Utensils,
  Settings,
  Shirt,
  Users,
  Boxes,
  Grid2X2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  RESTAURANT_POS_PATH,
  SUPERMARKET_POS_PATH,
  restaurantRoutes,
  supermarketRoutes,
} from "@/lib/business-type";
import { getStoredOwnerToken } from "@/lib/auth-storage";

type BusinessType =
  | "SUPERMARKET"
  | "RESTAURANT"
  | "FASHION"
  | "FRUIT"
  | "BOTH";

type ModuleType =
  | "SUPERMARKET"
  | "RESTAURANT"
  | "FASHION"
  | "REPORTS"
  | "MANAGEMENT";

type QuickLinkType = ModuleType;

type QuickLink = {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
  badge: string;
  color: string;
  type: QuickLinkType;
};

type StatCard = {
  label: string;
  value: string;
  icon: ElementType;
  color: string;
};

const fashionRoutes = {
  pos: "/dashboard/fashion/register",
} as const;

const restaurantServingPath = "/dashboard/restaurant/serving";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const RESTAURANT_REFRESH_MS = 10_000;
const TOKEN_KEYS = [
  "pos_access_token",
  "pos_shop_owner_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
] as const;

type ModuleSection = {
  id: ModuleType;
  label: string;
  title: string;
  description: string;
  icon: ElementType;
  color: string;
  pages: QuickLink[];
};

const moduleSections: ModuleSection[] = [
  {
    id: "SUPERMARKET",
    label: "Supermarket",
    title: "Supermarket Module",
    description: "POS, products, receipts",
    icon: Store,
    color: "from-emerald-500 to-teal-500",
    pages: [
      {
        label: "Supermarket POS",
        description: "Barcode scan, cart, payment",
        href: SUPERMARKET_POS_PATH,
        icon: ShoppingCart,
        badge: "Cashier",
        color: "from-emerald-500 to-teal-500",
        type: "SUPERMARKET",
      },
      {
        label: "Products",
        description: "Manage supermarket products and stock",
        href: supermarketRoutes.products,
        icon: Package,
        badge: "Stock",
        color: "from-blue-500 to-cyan-500",
        type: "SUPERMARKET",
      },
      {
        label: "Receipts",
        description: "Supermarket sales receipt history",
        href: supermarketRoutes.receipts,
        icon: Receipt,
        badge: "Sales",
        color: "from-violet-500 to-purple-500",
        type: "SUPERMARKET",
      },
    ],
  },
  {
    id: "RESTAURANT",
    label: "Restaurant",
    title: "Restaurant Module",
    description: "POS, menu, table, kitchen",
    icon: ChefHat,
    color: "from-orange-500 to-rose-500",
    pages: [
      {
        label: "Restaurant POS",
        description: "Dine-in, takeaway, table order",
        href: RESTAURANT_POS_PATH,
        icon: ChefHat,
        badge: "Cashier",
        color: "from-orange-500 to-rose-500",
        type: "RESTAURANT",
      },
      {
        label: "Restaurant Menu",
        description: "Food and drink menu setup",
        href: restaurantRoutes.menu,
        icon: Utensils,
        badge: "Menu",
        color: "from-amber-500 to-orange-500",
        type: "RESTAURANT",
      },
      {
        label: "Tables",
        description: "Create and manage restaurant tables",
        href: restaurantRoutes.tables,
        icon: Table2,
        badge: "Tables",
        color: "from-pink-500 to-rose-500",
        type: "RESTAURANT",
      },
      {
        label: "Kitchen",
        description: "Kitchen tickets and cooking status",
        href: restaurantRoutes.kitchen,
        icon: Coffee,
        badge: "Kitchen",
        color: "from-slate-700 to-slate-900",
        type: "RESTAURANT",
      },
      {
        label: "Serving",
        description: "Ready dishes and customer delivery",
        href: restaurantServingPath,
        icon: Truck,
        badge: "Runner",
        color: "from-emerald-500 to-teal-500",
        type: "RESTAURANT",
      },
      {
        label: "Orders",
        description: "Restaurant order management",
        href: restaurantRoutes.orders,
        icon: ClipboardList,
        badge: "Orders",
        color: "from-indigo-500 to-blue-500",
        type: "RESTAURANT",
      },
    ],
  },
  {
    id: "FASHION",
    label: "Fashion",
    title: "Fashion Module",
    description: "POS, fashion products, receipts",
    icon: Shirt,
    color: "from-fuchsia-500 to-pink-500",
    pages: [
      {
        label: "Fashion POS",
        description: "Checkout for clothing and accessories",
        href: fashionRoutes.pos,
        icon: Shirt,
        badge: "Cashier",
        color: "from-fuchsia-500 to-pink-500",
        type: "FASHION",
      },
    ],
  },
  {
    id: "REPORTS",
    label: "Reports",
    title: "Reports Module",
    description: "Sales and receipts",
    icon: BarChart3,
    color: "from-purple-500 to-fuchsia-500",
    pages: [
      {
        label: "Receipts Report",
        description: "Receipt records and reprint tools",
        href: "/settings/receipts",
        icon: Receipt,
        badge: "Reports",
        color: "from-violet-500 to-indigo-500",
        type: "REPORTS",
      },
    ],
  },
  {
    id: "MANAGEMENT",
    label: "Management",
    title: "Management Module",
    description: "Staff, tasks, settings",
    icon: ShieldCheck,
    color: "from-sky-500 to-blue-500",
    pages: [
      {
        label: "Staff",
        description: "Manage staff accounts and roles",
        href: "/dashboard/staff",
        icon: Users,
        badge: "Admin",
        color: "from-sky-500 to-blue-500",
        type: "MANAGEMENT",
      },
      {
        label: "Settings",
        description: "Shop settings and system controls",
        href: "/dashboard/settings",
        icon: Settings,
        badge: "System",
        color: "from-slate-500 to-slate-800",
        type: "MANAGEMENT",
      },
    ],
  },
];

type DashboardTicket = {
  id: number;
  ticketNo?: string | null;
  tableNo?: string | null;
  orderType?: string | null;
  status?: string | null;
  createdAt?: string | null;
  items?: { id: number; quantity?: number | null; status?: string | null }[];
};

type DashboardTable = {
  id: number;
  status?: string | null;
};

type DashboardOrder = {
  id: number;
  status?: string | null;
  total?: number | string | null;
  grandTotal?: number | string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type RestaurantLiveData = {
  tickets: DashboardTicket[];
  tables: DashboardTable[];
  orders: DashboardOrder[];
};

type RestaurantMetrics = {
  todaySales: number;
  todayOrders: number;
  openOrders: number;
  activeTables: number;
  totalTables: number;
  newTickets: number;
  cookingTickets: number;
  readyTickets: number;
  activeKitchenTickets: number;
};

function getAccessToken() {
  if (typeof window === "undefined") return null;

  const ownerToken = getStoredOwnerToken()?.trim();
  if (ownerToken) return ownerToken;

  for (const key of TOKEN_KEYS) {
    const token = window.localStorage.getItem(key)?.trim();
    if (token) return token;
  }

  return null;
}

function authorizationValue(token: string) {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  const root = asRecord(value);
  const candidate =
    root.data || root.content || root.items || root.tickets || root.tables || root.orders;
  if (Array.isArray(candidate)) return candidate as T[];

  const nested = asRecord(candidate);
  const nestedList = nested.content || nested.items || nested.data;
  return Array.isArray(nestedList) ? (nestedList as T[]) : [];
}

async function apiError(response: Response, fallback: string) {
  const body = asRecord(await response.clone().json().catch(() => null));
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  return (await response.text().catch(() => "")) || fallback;
}

async function fetchDashboardList<T>(path: string, token: string, label: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Authorization: authorizationValue(token) },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await apiError(response, `${label} data ယူမရပါ။`));
  }

  return unwrapList<T>(await response.json().catch(() => []));
}

function statusOf(value?: string | null) {
  return String(value || "NEW").trim().toUpperCase();
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function elapsedMinutes(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp)
    ? 0
    : Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)} Ks`;
}

function numericValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--:--"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeBusinessType(value?: string | null): BusinessType {
  const upper = value?.toUpperCase();

  if (upper === "SUPERMARKET") return "SUPERMARKET";
  if (upper === "RESTAURANT") return "RESTAURANT";
  if (upper === "FASHION") return "FASHION";
  if (upper === "FRUIT") return "FRUIT";
  if (upper === "BOTH") return "BOTH";

  return "SUPERMARKET";
}

function getBusinessTypeFromStorage(): BusinessType {
  if (typeof window === "undefined") return "SUPERMARKET";

  const value =
    localStorage.getItem("business_type") ||
    localStorage.getItem("businessType") ||
    localStorage.getItem("pos_business_type");

  return normalizeBusinessType(value);
}

function getAllowedModules(businessType: BusinessType): ModuleType[] {
  if (businessType === "BOTH") {
    return [
      "SUPERMARKET",
      "RESTAURANT",
      "FASHION",
      "REPORTS",
      "MANAGEMENT",
    ];
  }

  if (businessType === "RESTAURANT") {
    return ["RESTAURANT", "REPORTS", "MANAGEMENT"];
  }

  if (businessType === "FASHION") {
    return ["FASHION", "REPORTS", "MANAGEMENT"];
  }

  return ["SUPERMARKET", "REPORTS", "MANAGEMENT"];
}

function getTitle(businessType: BusinessType) {
  if (businessType === "RESTAURANT") return "Restaurant Dashboard";
  if (businessType === "FASHION") return "Fashion Dashboard";
  if (businessType === "BOTH") return "POS Dashboard";
  return "Supermarket Dashboard";
}

function getDescription(businessType: BusinessType) {
  if (businessType === "RESTAURANT") {
    return "စားသောက်ဆိုင် POS, table, menu, kitchen, order များကို module အလိုက် စီမံရန်";
  }

  if (businessType === "BOTH") {
    return "Supermarket, Restaurant နဲ့ Fashion POS များကို module အလိုက် စီမံရန်";
  }

  if (businessType === "FASHION") {
    return "Fashion POS, product, receipt များကို module အလိုက် စီမံရန်";
  }

  return "Supermarket POS, product, receipt များကို module အလိုက် စီမံရန်";
}

function getStatCards(
  businessType: BusinessType,
  restaurantMetrics?: RestaurantMetrics,
): StatCard[] {
  if (businessType === "RESTAURANT") {
    return [
      {
        label: "Today Sales",
        value: restaurantMetrics
          ? formatMoney(restaurantMetrics.todaySales)
          : "—",
        icon: BarChart3,
        color: "bg-orange-500",
      },
      {
        label: "Open Orders",
        value: restaurantMetrics
          ? String(restaurantMetrics.openOrders)
          : "—",
        icon: ClipboardList,
        color: "bg-indigo-500",
      },
      {
        label: "Active Tables",
        value: restaurantMetrics
          ? `${restaurantMetrics.activeTables}/${restaurantMetrics.totalTables}`
          : "—",
        icon: Table2,
        color: "bg-pink-500",
      },
      {
        label: "Kitchen Tickets",
        value: restaurantMetrics
          ? String(restaurantMetrics.activeKitchenTickets)
          : "—",
        icon: Coffee,
        color: "bg-slate-900",
      },
    ];
  }

  if (businessType === "BOTH") {
    return [
      {
        label: "Today Sales",
        value: "0 Ks",
        icon: BarChart3,
        color: "bg-orange-500",
      },
      {
        label: "Products",
        value: "0",
        icon: Package,
        color: "bg-blue-500",
      },
      {
        label: "Open Orders",
        value: "0",
        icon: ClipboardList,
        color: "bg-indigo-500",
      },
      {
        label: "Active Tables",
        value: "0",
        icon: Table2,
        color: "bg-pink-500",
      },
    ];
  }

  if (businessType === "FASHION") {
    return [
      {
        label: "Today Sales",
        value: "0 Ks",
        icon: BarChart3,
        color: "bg-fuchsia-500",
      },
      {
        label: "Fashion Products",
        value: "0",
        icon: Shirt,
        color: "bg-pink-500",
      },
      {
        label: "Receipts",
        value: "0",
        icon: Receipt,
        color: "bg-violet-500",
      },
      {
        label: "Cashier",
        value: "POS",
        icon: ShoppingCart,
        color: "bg-slate-950",
      },
    ];
  }

  return [
    {
      label: "Today Sales",
      value: "0 Ks",
      icon: BarChart3,
      color: "bg-emerald-500",
    },
    {
      label: "Products",
      value: "0",
      icon: Package,
      color: "bg-blue-500",
    },
    {
      label: "Receipts",
      value: "0",
      icon: Receipt,
      color: "bg-violet-500",
    },
    {
      label: "Cashier",
      value: "POS",
      icon: ShoppingCart,
      color: "bg-slate-950",
    },
  ];
}

function ModuleButton({
  id,
  label,
  description,
  icon: Icon,
  pageCount,
}: {
  id: ModuleType;
  label: string;
  description: string;
  icon: ElementType;
  pageCount: number;
}) {
  return (
    <a
      href={`#${id.toLowerCase()}-module`}
      className="group rounded-[1.5rem] border border-white/70 bg-white/85 p-4 text-left text-slate-900 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white group-hover:bg-orange-500">
          <Icon size={20} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{label}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
              {pageCount}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}

function QuickLinkCard({ item }: { item: QuickLink }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group">
      <Card className="h-full overflow-hidden rounded-[1.75rem] border-white/70 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200">
        <CardContent className="p-0">
          <div className={`h-2 bg-gradient-to-r ${item.color}`} />

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${item.color} text-white shadow-lg`}
              >
                <Icon size={26} />
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {item.badge}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-black text-slate-950">
              {item.label}
            </h3>

            <p className="mt-2 min-h-[40px] text-sm font-semibold leading-5 text-slate-500">
              {item.description}
            </p>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
              Open
              <ArrowRight
                size={18}
                className="transition group-hover:translate-x-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ModuleSectionCard({ section }: { section: ModuleSection }) {
  const Icon = section.icon;

  return (
    <section id={`${section.id.toLowerCase()}-module`} className="space-y-5">
      <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${section.color} text-white shadow-lg`}
              >
                <Icon size={28} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {section.description}
                </p>
              </div>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-500">
              {section.pages.length} Pages
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.pages.map((item) => (
              <QuickLinkCard key={`${item.type}-${item.href}`} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function WorkspaceCard({
  type,
  title,
  description,
  icon: Icon,
  primaryHref,
  primaryLabel,
  links,
}: {
  type: "SUPERMARKET" | "RESTAURANT";
  title: string;
  description: string;
  icon: ElementType;
  primaryHref: string;
  primaryLabel: string;
  links: { label: string; href: string }[];
}) {
  const isRestaurant = type === "RESTAURANT";

  return (
    <Card
      className={`overflow-hidden rounded-[2rem] bg-white shadow-sm ${
        isRestaurant ? "border-orange-100" : "border-emerald-100"
      }`}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg ${
              isRestaurant
                ? "bg-orange-500 shadow-orange-500/25"
                : "bg-emerald-500 shadow-emerald-500/25"
            }`}
          >
            <Icon size={28} />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button
            asChild
            className={`rounded-2xl font-black ${
              isRestaurant
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>

          {links.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="outline"
              className="rounded-2xl font-black"
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [businessType, setBusinessType] =
    useState<BusinessType>("SUPERMARKET");
  const [restaurantData, setRestaurantData] = useState<RestaurantLiveData>({
    tickets: [],
    tables: [],
    orders: [],
  });
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantRefreshing, setRestaurantRefreshing] = useState(false);
  const [restaurantError, setRestaurantError] = useState("");
  const [restaurantUpdatedAt, setRestaurantUpdatedAt] = useState<Date | null>(
    null,
  );

  const loadRestaurantData = useCallback(async (silent = false) => {
    silent ? setRestaurantRefreshing(true) : setRestaurantLoading(true);

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Login token မရှိပါ။ Login ပြန်ဝင်ပါ။");

      const [ticketResult, tableResult, orderResult] =
        await Promise.allSettled([
          fetchDashboardList<DashboardTicket>(
            "/api/restaurant/kitchen/tickets",
            token,
            "Kitchen",
          ),
          fetchDashboardList<DashboardTable>(
            "/api/restaurant/tables",
            token,
            "Tables",
          ),
          fetchDashboardList<DashboardOrder>(
            "/api/restaurant/orders",
            token,
            "Orders",
          ),
        ]);

      const errors: string[] = [];
      setRestaurantData((current) => ({
        tickets:
          ticketResult.status === "fulfilled"
            ? ticketResult.value
            : current.tickets,
        tables:
          tableResult.status === "fulfilled"
            ? tableResult.value
            : current.tables,
        orders:
          orderResult.status === "fulfilled"
            ? orderResult.value
            : current.orders,
      }));

      if (ticketResult.status === "rejected") {
        errors.push(
          `Kitchen: ${ticketResult.reason instanceof Error ? ticketResult.reason.message : "Load error"}`,
        );
      }
      if (tableResult.status === "rejected") {
        errors.push(
          `Tables: ${tableResult.reason instanceof Error ? tableResult.reason.message : "Load error"}`,
        );
      }
      if (orderResult.status === "rejected") {
        errors.push(
          `Orders: ${orderResult.reason instanceof Error ? orderResult.reason.message : "Load error"}`,
        );
      }

      setRestaurantError(errors.join(" · "));
      setRestaurantUpdatedAt(new Date());
    } catch (error) {
      setRestaurantError(
        error instanceof Error ? error.message : "Restaurant dashboard load error",
      );
    } finally {
      setRestaurantLoading(false);
      setRestaurantRefreshing(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
    setBusinessType(getBusinessTypeFromStorage());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (businessType !== "RESTAURANT" && businessType !== "BOTH") return;

    void loadRestaurantData();
    const interval = window.setInterval(() => {
      void loadRestaurantData(true);
    }, RESTAURANT_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadRestaurantData(true);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [businessType, loadRestaurantData]);

  const restaurantMetrics = useMemo<RestaurantMetrics>(() => {
    const newTickets = restaurantData.tickets.filter(
      (ticket) => statusOf(ticket.status) === "NEW",
    ).length;
    const cookingTickets = restaurantData.tickets.filter(
      (ticket) => statusOf(ticket.status) === "COOKING",
    ).length;
    const readyTickets = restaurantData.tickets.filter(
      (ticket) => statusOf(ticket.status) === "READY",
    ).length;
    const todayOrders = restaurantData.orders.filter((order) =>
      isToday(order.createdAt || order.created_at),
    );
    const openOrders = restaurantData.orders.filter((order) => {
      const status = statusOf(order.status);
      return status !== "PAID" && status !== "CANCELLED" && status !== "DONE";
    }).length;
    const activeTables = restaurantData.tables.filter((table) => {
      const status = statusOf(table.status);
      return status === "BUSY" || status === "OCCUPIED";
    }).length;

    return {
      todaySales: todayOrders
        .filter((order) => statusOf(order.status) === "PAID")
        .reduce(
          (sum, order) =>
            sum + numericValue(order.total ?? order.grandTotal),
          0,
        ),
      todayOrders: todayOrders.length,
      openOrders,
      activeTables,
      totalTables: restaurantData.tables.length,
      newTickets,
      cookingTickets,
      readyTickets,
      activeKitchenTickets: newTickets + cookingTickets + readyTickets,
    };
  }, [restaurantData]);

  const activeRestaurantTickets = useMemo(
    () =>
      restaurantData.tickets
        .filter((ticket) => {
          const status = statusOf(ticket.status);
          return status === "NEW" || status === "COOKING" || status === "READY";
        })
        .sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime(),
        )
        .slice(0, 6),
    [restaurantData.tickets],
  );

  const allowedModules = useMemo(
    () => getAllowedModules(businessType),
    [businessType]
  );

  const visibleModuleSections = useMemo(() => {
    return moduleSections.filter((section) =>
      allowedModules.includes(section.id)
    );
  }, [allowedModules]);

  const statCards = useMemo(() => {
    return getStatCards(businessType, restaurantMetrics);
  }, [businessType, restaurantMetrics]);

  const title = getTitle(businessType);
  const description = getDescription(businessType);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0,#f8fafc_35%,#eef2ff_100%)] p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl lg:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-300/30 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div
                suppressHydrationWarning
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-orange-600 ring-1 ring-orange-100"
              >
                <Sparkles size={16} />
                {mounted ? businessType : "Loading..."}
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                {title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                {description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:min-w-[280px]">
              {businessType === "SUPERMARKET" && (
                <Button
                  asChild
                  className="h-14 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                >
                  <Link href={SUPERMARKET_POS_PATH}>
                    <ShoppingCart size={18} />
                    Open Supermarket POS
                  </Link>
                </Button>
              )}

              {businessType === "RESTAURANT" && (
                <Button
                  asChild
                  className="h-14 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
                >
                  <Link href={RESTAURANT_POS_PATH}>
                    <ChefHat size={18} />
                    Open Restaurant POS
                  </Link>
                </Button>
              )}

              {businessType === "FASHION" && (
                <Button
                  asChild
                  className="h-14 rounded-2xl bg-fuchsia-500 text-sm font-black text-white shadow-lg shadow-fuchsia-500/25 hover:bg-fuchsia-600"
                >
                  <Link href={fashionRoutes.pos}>
                    <Shirt size={18} />
                    Open Fashion POS
                  </Link>
                </Button>
              )}

              {businessType === "BOTH" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    asChild
                    className="h-14 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                  >
                    <Link href={SUPERMARKET_POS_PATH}>
                      <ShoppingCart size={18} />
                      Supermarket
                    </Link>
                  </Button>

                  <Button
                    asChild
                    className="h-14 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
                  >
                    <Link href={RESTAURANT_POS_PATH}>
                      <ChefHat size={18} />
                      Restaurant
                    </Link>
                  </Button>

                  <Button
                    asChild
                    className="h-14 rounded-2xl bg-fuchsia-500 text-sm font-black text-white shadow-lg shadow-fuchsia-500/25 hover:bg-fuchsia-600"
                  >
                    <Link href={fashionRoutes.pos}>
                      <Shirt size={18} />
                      Fashion
                    </Link>
                  </Button>

                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.label}
                className="rounded-[1.75rem] border-white/70 bg-white/85 shadow-sm backdrop-blur-xl"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${item.color}`}
                  >
                    <Icon size={22} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {item.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {(businessType === "RESTAURANT" || businessType === "BOTH") && (
          <section className="overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ChefHat size={22} className="text-orange-500" />
                  <h2 className="text-xl font-black text-slate-950">
                    Restaurant Live Operations
                  </h2>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Kitchen, Serving နှင့် table status ကို ၁၀ စက္ကန့်တိုင်း update လုပ်ပါမယ်။
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-600 sm:inline-flex">
                  Live · {restaurantUpdatedAt ? formatTime(restaurantUpdatedAt.toISOString()) : "--:--"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadRestaurantData(true)}
                  disabled={restaurantRefreshing}
                  className="rounded-xl font-black"
                >
                  <RefreshCcw
                    size={16}
                    className={restaurantRefreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {restaurantError && (
              <div className="m-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span>{restaurantError}</span>
              </div>
            )}

            {restaurantLoading ? (
              <div className="grid min-h-72 place-items-center p-6 text-center">
                <div>
                  <Loader2 size={30} className="mx-auto animate-spin text-orange-500" />
                  <p className="mt-3 text-sm font-black text-slate-600">
                    Restaurant live data loading...
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid items-start gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "New",
                        value: restaurantMetrics.newTickets,
                        icon: Clock3,
                        style: "bg-blue-50 text-blue-600",
                      },
                      {
                        label: "Cooking",
                        value: restaurantMetrics.cookingTickets,
                        icon: ChefHat,
                        style: "bg-orange-50 text-orange-600",
                      },
                      {
                        label: "Ready",
                        value: restaurantMetrics.readyTickets,
                        icon: PackageCheck,
                        style: "bg-emerald-50 text-emerald-600",
                      },
                      {
                        label: "Active Tables",
                        value: `${restaurantMetrics.activeTables}/${restaurantMetrics.totalTables}`,
                        icon: Table2,
                        style: "bg-pink-50 text-pink-600",
                      },
                    ].map((stage) => {
                      const Icon = stage.icon;
                      return (
                        <div
                          key={stage.label}
                          className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                        >
                          <div className={`grid h-9 w-9 place-items-center rounded-xl ${stage.style}`}>
                            <Icon size={18} />
                          </div>
                          <p className="mt-3 text-2xl font-black text-slate-950">
                            {stage.value}
                          </p>
                          <p className="text-xs font-black text-slate-500">
                            {stage.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button asChild className="rounded-xl bg-orange-500 font-black hover:bg-orange-600">
                      <Link href={RESTAURANT_POS_PATH}>POS</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl font-black">
                      <Link href={restaurantRoutes.kitchen}>Kitchen</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl font-black">
                      <Link href={restaurantServingPath}>Serving</Link>
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                    <div>
                      <h3 className="font-black text-slate-950">Active Kitchen Tickets</h3>
                      <p className="text-xs font-semibold text-slate-500">
                        ကြာနေသော ticket ကို အပေါ်ဆုံးပြထားပါတယ်။
                      </p>
                    </div>
                    <Link
                      href={restaurantRoutes.kitchen}
                      className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-600"
                    >
                      View all
                    </Link>
                  </div>

                  {activeRestaurantTickets.length === 0 ? (
                    <div className="grid min-h-56 place-items-center p-6 text-center">
                      <div>
                        <CheckCircle2 size={34} className="mx-auto text-emerald-500" />
                        <p className="mt-3 font-black text-slate-800">
                          Active kitchen ticket မရှိပါ
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activeRestaurantTickets.map((ticket) => {
                        const status = statusOf(ticket.status);
                        const wait = elapsedMinutes(ticket.createdAt);
                        const itemCount = (ticket.items || []).reduce(
                          (sum, item) => sum + Number(item.quantity || 1),
                          0,
                        );
                        const statusStyle =
                          status === "READY"
                            ? "bg-emerald-50 text-emerald-600"
                            : status === "COOKING"
                              ? "bg-orange-50 text-orange-600"
                              : "bg-blue-50 text-blue-600";

                        return (
                          <Link
                            key={ticket.id}
                            href={restaurantRoutes.kitchen}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-slate-950">
                                  {ticket.ticketNo || `KT-${ticket.id}`}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusStyle}`}>
                                  {status}
                                </span>
                                {wait >= 15 && (
                                  <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                                    DELAYED
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs font-bold text-slate-500">
                                {ticket.orderType === "DINE_IN"
                                  ? `Table ${ticket.tableNo || "-"}`
                                  : ticket.orderType || "Order"}
                                {` · ${itemCount} items · ${formatTime(ticket.createdAt)}`}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-xs font-black ${wait >= 15 ? "text-red-500" : "text-slate-500"}`}>
                              <Clock3 size={14} /> {wait} min
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Grid2X2 className="text-orange-500" size={22} />
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Business Modules
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Module တစ်ခုချင်းစီအလိုက် page များကို ခွဲကြည့်နိုင်ပါတယ်။
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {visibleModuleSections.map((tab) => (
              <ModuleButton
                key={tab.id}
                id={tab.id}
                label={tab.label}
                description={tab.description}
                icon={tab.icon}
                pageCount={tab.pages.length}
              />
            ))}
          </div>
        </section>

        <div className="space-y-5">
          {visibleModuleSections.length > 0 ? (
            visibleModuleSections.map((section) => (
              <ModuleSectionCard key={section.id} section={section} />
            ))
          ) : (
            <Card className="rounded-[2rem] border-dashed border-slate-200 bg-white/70">
              <CardContent className="p-10 text-center">
                <Boxes className="mx-auto h-10 w-10 text-slate-400" />
                <h3 className="mt-3 text-lg font-black text-slate-800">
                  No module pages
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  ဒီ module အတွက် route မရှိသေးပါ။
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {(businessType === "SUPERMARKET" || businessType === "BOTH") && (
          <WorkspaceCard
            type="SUPERMARKET"
            title="Supermarket Workspace"
            description="Barcode, product, receipt, cashier sale"
            icon={Store}
            primaryHref={SUPERMARKET_POS_PATH}
            primaryLabel="POS"
            links={[
              {
                label: "Products",
                href: supermarketRoutes.products,
              },
              {
                label: "Receipts",
                href: supermarketRoutes.receipts,
              },
            ]}
          />
        )}

        {(businessType === "RESTAURANT" || businessType === "BOTH") && (
          <WorkspaceCard
            type="RESTAURANT"
            title="Restaurant Workspace"
            description="Table, menu, kitchen ticket, restaurant order"
            icon={ChefHat}
            primaryHref={RESTAURANT_POS_PATH}
            primaryLabel="POS"
            links={[
              {
                label: "Tables",
                href: restaurantRoutes.tables,
              },
              {
                label: "Kitchen",
                href: restaurantRoutes.kitchen,
              },
              {
                label: "Serving",
                href: restaurantServingPath,
              },
            ]}
          />
        )}
      </div>
    </main>
  );
}
