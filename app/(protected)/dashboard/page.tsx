"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock3,
  Coffee,
  Download,
  Loader2,
  Package,
  PackageCheck,
  Receipt,
  RefreshCcw,
  Settings,
  Shirt,
  ShoppingCart,
  Store,
  Table2,
  TriangleAlert,
  Users,
  Utensils,
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

type RangeDays = 1 | 7 | 30;

type DashboardProduct = {
  id: number | string;
  name?: string | null;
  productName?: string | null;
  product_name?: string | null;
  category?: string | null;
  productQuantityAmount?: number | string | null;
  product_quantity_amount?: number | string | null;
  quantity?: number | string | null;
  stock?: number | string | null;
};

type DashboardReceipt = {
  id: number | string;
  receiptNo?: string | null;
  receipt_no?: string | null;
  status?: string | null;
  grandTotal?: number | string | null;
  grand_total?: number | string | null;
  total?: number | string | null;
  paymentMethod?: string | null;
  payment_method?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  staffName?: string | null;
  staff_name?: string | null;
};

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
  orderNo?: string | null;
  order_no?: string | null;
  status?: string | null;
  total?: number | string | null;
  grandTotal?: number | string | null;
  grand_total?: number | string | null;
  paymentMethod?: string | null;
  payment_method?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  staffName?: string | null;
  staff_name?: string | null;
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

type SalesPoint = {
  key: string;
  day: string;
  date: string;
  sales: number;
  transactions: number;
};

type RecentSale = {
  id: string;
  number: string;
  staff: string;
  amount: number;
  status: string;
  createdAt: string | null;
  href: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const RESTAURANT_REFRESH_MS = 10_000;
const LOW_STOCK_LIMIT = 10;
const fashionRoutes = { pos: "/dashboard/fashion/register" } as const;
const restaurantServingPath = "/dashboard/restaurant/serving";
const TOKEN_KEYS = [
  "pos_access_token",
  "pos_shop_owner_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
] as const;
const STOCK_COLORS = ["#16a34a", "#f59e0b", "#ef4444"];

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
    root.data ||
    root.content ||
    root.items ||
    root.tickets ||
    root.tables ||
    root.orders ||
    root.receipts ||
    root.products;
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
    headers: { Authorization: authorizationValue(token) },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await apiError(response, `${label} အချက်အလက် ရယူ၍မရပါ။`));
  }
  return unwrapList<T>(await response.json().catch(() => []));
}

function numericValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusOf(value?: string | null) {
  return String(value || "NEW").trim().toUpperCase();
}

function isPaid(value?: string | null) {
  return ["PAID", "COMPLETED", "SUCCESS"].includes(statusOf(value));
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

function dateOf(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function chartPointKey(date: Date, days: RangeDays) {
  if (days === 1) {
    return `${dayKey(date)}-${String(date.getHours()).padStart(2, "0")}`;
  }

  return dayKey(date);
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)} ကျပ်`;
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function formatTime(value?: string | null) {
  const date = dateOf(value);
  return date
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
}

function formatDateTime(value?: string | null) {
  const date = dateOf(value);
  return date
    ? date.toLocaleString("my-MM", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function elapsedMinutes(value?: string | null) {
  const date = dateOf(value);
  return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000)) : 0;
}

function productName(product: DashboardProduct) {
  return product.productName || product.product_name || product.name || `ကုန်ပစ္စည်း ${product.id}`;
}

function productQuantity(product: DashboardProduct) {
  return numericValue(
    product.productQuantityAmount ??
      product.product_quantity_amount ??
      product.quantity ??
      product.stock,
  );
}

function receiptCreatedAt(receipt: DashboardReceipt) {
  return receipt.createdAt || receipt.created_at || null;
}

function receiptTotal(receipt: DashboardReceipt) {
  return numericValue(receipt.grandTotal ?? receipt.grand_total ?? receipt.total);
}

function receiptNumber(receipt: DashboardReceipt) {
  return receipt.receiptNo || receipt.receipt_no || `R-${receipt.id}`;
}

function orderCreatedAt(order: DashboardOrder) {
  return order.createdAt || order.created_at || null;
}

function orderTotal(order: DashboardOrder) {
  return numericValue(order.grandTotal ?? order.grand_total ?? order.total);
}

function normalizeBusinessType(value?: string | null): BusinessType {
  const upper = value?.toUpperCase();
  if (upper === "RESTAURANT") return "RESTAURANT";
  if (upper === "FASHION") return "FASHION";
  if (upper === "FRUIT") return "FRUIT";
  if (upper === "BOTH") return "BOTH";
  return "SUPERMARKET";
}

function getBusinessTypeFromStorage(): BusinessType {
  if (typeof window === "undefined") return "SUPERMARKET";
  return normalizeBusinessType(
    localStorage.getItem("business_type") ||
      localStorage.getItem("businessType") ||
      localStorage.getItem("pos_business_type"),
  );
}

function getTitle(type: BusinessType) {
  if (type === "RESTAURANT") return "စားသောက်ဆိုင် အခြေအနေအကျဉ်း";
  if (type === "FASHION") return "ဖက်ရှင်ဆိုင် အခြေအနေအကျဉ်း";
  if (type === "BOTH") return "လုပ်ငန်း အခြေအနေအကျဉ်း";
  return "စူပါမားကတ် အခြေအနေအကျဉ်း";
}

function businessTypeLabel(type: BusinessType) {
  if (type === "RESTAURANT") return "စားသောက်ဆိုင်";
  if (type === "FASHION") return "ဖက်ရှင်ဆိုင်";
  if (type === "FRUIT") return "သစ်သီးဆိုင်";
  if (type === "BOTH") return "လုပ်ငန်းအားလုံး";
  return "စူပါမားကတ်";
}

function statusLabel(value?: string | null) {
  const status = statusOf(value);
  const labels: Record<string, string> = {
    PAID: "ငွေရှင်းပြီး",
    COMPLETED: "ပြီးစီးပြီ",
    SUCCESS: "အောင်မြင်သည်",
    NEW: "အသစ်",
    COOKING: "ချက်ပြုတ်နေသည်",
    READY: "အဆင်သင့်",
    CANCELLED: "ပယ်ဖျက်ထားသည်",
    DONE: "ပြီးစီးပြီ",
  };
  return labels[status] || status;
}

function emptySalesSeries(days: RangeDays) {
  if (days === 1) {
    const today = new Date();
    today.setMinutes(0, 0, 0);

    return Array.from({ length: 24 }, (_, hour) => {
      const date = new Date(today);
      date.setHours(hour, 0, 0, 0);

      return {
        key: chartPointKey(date, days),
        day: `${String(hour).padStart(2, "0")}:00`,
        date: `ယနေ့ ${String(hour).padStart(2, "0")}:00`,
        sales: 0,
        transactions: 0,
      } satisfies SalesPoint;
    });
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return {
      key: chartPointKey(date, days),
      day:
        days === 7
          ? date.toLocaleDateString("my-MM", { weekday: "short" })
          : date.toLocaleDateString("my-MM", { day: "numeric" }),
      date: date.toLocaleDateString("my-MM", { month: "short", day: "numeric" }),
      sales: 0,
      transactions: 0,
    } satisfies SalesPoint;
  });
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "navy",
  loading,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ElementType;
  tone?: "navy" | "blue" | "amber" | "violet";
  loading: boolean;
}) {
  const tones = {
    navy: "bg-blue-950/10 text-blue-900 dark:bg-sky-400/10 dark:text-sky-300",
    blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
            <Icon className="size-5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
            <ArrowUpRight className="size-3" /> တိုက်ရိုက်
          </span>
        </div>
        <p className="mt-4 text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {loading ? "—" : value}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="grid min-h-48 place-items-center p-6 text-center">
      <div>
        <Icon className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>("SUPERMARKET");
  const [rangeDays, setRangeDays] = useState<RangeDays>(1);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [receipts, setReceipts] = useState<DashboardReceipt[]>([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessRefreshing, setBusinessRefreshing] = useState(false);
  const [businessError, setBusinessError] = useState("");
  const [businessUpdatedAt, setBusinessUpdatedAt] = useState<Date | null>(null);
  const [restaurantData, setRestaurantData] = useState<RestaurantLiveData>({
    tickets: [],
    tables: [],
    orders: [],
  });
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantRefreshing, setRestaurantRefreshing] = useState(false);
  const [restaurantError, setRestaurantError] = useState("");
  const [restaurantUpdatedAt, setRestaurantUpdatedAt] = useState<Date | null>(null);

  const loadBusinessData = useCallback(async (silent = false) => {
    silent ? setBusinessRefreshing(true) : setBusinessLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("အကောင့်ဝင်ထားသော token မရှိပါ။ အကောင့်ပြန်ဝင်ပါ။");
      const [productResult, receiptResult] = await Promise.allSettled([
        fetchDashboardList<DashboardProduct>("/api/products", token, "ကုန်ပစ္စည်းများ"),
        fetchDashboardList<DashboardReceipt>(
          "/api/pos/receipts/shop",
          token,
          "ဘောင်ချာများ",
        ),
      ]);
      const errors: string[] = [];
      if (productResult.status === "fulfilled") setProducts(productResult.value);
      else errors.push(
        `ကုန်ပစ္စည်းများ: ${productResult.reason instanceof Error ? productResult.reason.message : "ရယူရာတွင် အမှားရှိသည်"}`,
      );
      if (receiptResult.status === "fulfilled") setReceipts(receiptResult.value);
      else errors.push(
        `ဘောင်ချာများ: ${receiptResult.reason instanceof Error ? receiptResult.reason.message : "ရယူရာတွင် အမှားရှိသည်"}`,
      );
      setBusinessError(errors.join(" · "));
      setBusinessUpdatedAt(new Date());
    } catch (error) {
      setBusinessError(error instanceof Error ? error.message : "ဒက်ရှ်ဘုတ်အချက်အလက် ရယူရာတွင် အမှားရှိသည်");
    } finally {
      setBusinessLoading(false);
      setBusinessRefreshing(false);
    }
  }, []);

  const loadRestaurantData = useCallback(async (silent = false) => {
    silent ? setRestaurantRefreshing(true) : setRestaurantLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("အကောင့်ဝင်ထားသော token မရှိပါ။ အကောင့်ပြန်ဝင်ပါ။");
      const [ticketResult, tableResult, orderResult] = await Promise.allSettled([
        fetchDashboardList<DashboardTicket>(
          "/api/restaurant/kitchen/tickets",
          token,
          "မီးဖိုချောင်",
        ),
        fetchDashboardList<DashboardTable>("/api/restaurant/tables", token, "စားပွဲများ"),
        fetchDashboardList<DashboardOrder>("/api/restaurant/orders", token, "အော်ဒါများ"),
      ]);
      const errors: string[] = [];
      setRestaurantData((current) => ({
        tickets: ticketResult.status === "fulfilled" ? ticketResult.value : current.tickets,
        tables: tableResult.status === "fulfilled" ? tableResult.value : current.tables,
        orders: orderResult.status === "fulfilled" ? orderResult.value : current.orders,
      }));
      if (ticketResult.status === "rejected")
        errors.push(`မီးဖိုချောင်: ${ticketResult.reason instanceof Error ? ticketResult.reason.message : "ရယူရာတွင် အမှားရှိသည်"}`);
      if (tableResult.status === "rejected")
        errors.push(`စားပွဲများ: ${tableResult.reason instanceof Error ? tableResult.reason.message : "ရယူရာတွင် အမှားရှိသည်"}`);
      if (orderResult.status === "rejected")
        errors.push(`အော်ဒါများ: ${orderResult.reason instanceof Error ? orderResult.reason.message : "ရယူရာတွင် အမှားရှိသည်"}`);
      setRestaurantError(errors.join(" · "));
      setRestaurantUpdatedAt(new Date());
    } catch (error) {
      setRestaurantError(
        error instanceof Error ? error.message : "စားသောက်ဆိုင်ဒက်ရှ်ဘုတ် ရယူရာတွင် အမှားရှိသည်",
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
    if (!mounted) return;
    if (businessType !== "RESTAURANT") void loadBusinessData();
  }, [businessType, loadBusinessData, mounted]);

  useEffect(() => {
    if (!mounted || (businessType !== "RESTAURANT" && businessType !== "BOTH")) return;
    void loadRestaurantData();
    const interval = window.setInterval(() => void loadRestaurantData(true), RESTAURANT_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadRestaurantData(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [businessType, loadRestaurantData, mounted]);

  const restaurantMetrics = useMemo<RestaurantMetrics>(() => {
    const todayOrders = restaurantData.orders.filter((order) => isToday(orderCreatedAt(order)));
    const newTickets = restaurantData.tickets.filter((ticket) => statusOf(ticket.status) === "NEW").length;
    const cookingTickets = restaurantData.tickets.filter((ticket) => statusOf(ticket.status) === "COOKING").length;
    const readyTickets = restaurantData.tickets.filter((ticket) => statusOf(ticket.status) === "READY").length;
    const openOrders = restaurantData.orders.filter((order) =>
      !["PAID", "CANCELLED", "DONE", "COMPLETED"].includes(statusOf(order.status)),
    ).length;
    const activeTables = restaurantData.tables.filter((table) =>
      ["BUSY", "OCCUPIED"].includes(statusOf(table.status)),
    ).length;
    return {
      todaySales: todayOrders.filter((order) => isPaid(order.status)).reduce((sum, order) => sum + orderTotal(order), 0),
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

  const paidReceipts = useMemo(() => receipts.filter((receipt) => isPaid(receipt.status)), [receipts]);
  const todayReceipts = useMemo(
    () => paidReceipts.filter((receipt) => isToday(receiptCreatedAt(receipt))),
    [paidReceipts],
  );
  const todaySales = todayReceipts.reduce((sum, receipt) => sum + receiptTotal(receipt), 0) +
    (businessType === "RESTAURANT" || businessType === "BOTH" ? restaurantMetrics.todaySales : 0);
  const todayTransactions = todayReceipts.length +
    (businessType === "RESTAURANT" || businessType === "BOTH" ? restaurantMetrics.todayOrders : 0);

  const stockCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalUnits = 0;
    for (const product of products) {
      const quantity = productQuantity(product);
      totalUnits += Math.max(0, quantity);
      if (quantity <= 0) outOfStock += 1;
      else if (quantity <= LOW_STOCK_LIMIT) lowStock += 1;
      else inStock += 1;
    }
    return { inStock, lowStock, outOfStock, totalUnits };
  }, [products]);

  const stockData = useMemo(
    () => [
      { name: "လက်ကျန်ရှိ", value: stockCounts.inStock },
      { name: "လက်ကျန်နည်း", value: stockCounts.lowStock },
      { name: "ကုန်သွားပြီ", value: stockCounts.outOfStock },
    ],
    [stockCounts],
  );

  const salesData = useMemo(() => {
    const series = emptySalesSeries(rangeDays);
    const byKey = new Map(series.map((point) => [point.key, point]));
    for (const receipt of paidReceipts) {
      const createdAt = dateOf(receiptCreatedAt(receipt));
      const point = createdAt
        ? byKey.get(chartPointKey(createdAt, rangeDays))
        : undefined;
      if (point) {
        point.sales += receiptTotal(receipt);
        point.transactions += 1;
      }
    }
    if (businessType === "RESTAURANT" || businessType === "BOTH") {
      for (const order of restaurantData.orders.filter((item) => isPaid(item.status))) {
        const createdAt = dateOf(orderCreatedAt(order));
        const point = createdAt
          ? byKey.get(chartPointKey(createdAt, rangeDays))
          : undefined;
        if (point) {
          point.sales += orderTotal(order);
          point.transactions += 1;
        }
      }
    }
    return series;
  }, [businessType, paidReceipts, rangeDays, restaurantData.orders]);

  const rangeSales = salesData.reduce((sum, point) => sum + point.sales, 0);
  const rangeTransactions = salesData.reduce((sum, point) => sum + point.transactions, 0);

  const paymentSummary = useMemo(() => {
    const totals = { CASH: 0, CARD: 0, WALLET: 0 };
    for (const receipt of todayReceipts) {
      const method = statusOf(receipt.paymentMethod || receipt.payment_method);
      if (method in totals) totals[method as keyof typeof totals] += receiptTotal(receipt);
    }
    if (businessType === "RESTAURANT" || businessType === "BOTH") {
      for (const order of restaurantData.orders.filter(
        (item) => isPaid(item.status) && isToday(orderCreatedAt(item)),
      )) {
        const method = statusOf(order.paymentMethod || order.payment_method);
        if (method in totals) totals[method as keyof typeof totals] += orderTotal(order);
      }
    }
    return totals;
  }, [businessType, restaurantData.orders, todayReceipts]);

  const lowStockProducts = useMemo(
    () =>
      [...products]
        .filter((product) => productQuantity(product) <= LOW_STOCK_LIMIT)
        .sort((a, b) => productQuantity(a) - productQuantity(b))
        .slice(0, 5),
    [products],
  );

  const activeRestaurantTickets = useMemo(
    () =>
      restaurantData.tickets
        .filter((ticket) => ["NEW", "COOKING", "READY"].includes(statusOf(ticket.status)))
        .sort((a, b) => (dateOf(a.createdAt)?.getTime() || 0) - (dateOf(b.createdAt)?.getTime() || 0))
        .slice(0, 5),
    [restaurantData.tickets],
  );

  const recentSales = useMemo<RecentSale[]>(() => {
    const supermarketSales = paidReceipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      number: receiptNumber(receipt),
      staff: receipt.staffName || receipt.staff_name || "ငွေကိုင်ဝန်ထမ်း",
      amount: receiptTotal(receipt),
      status: statusOf(receipt.status),
      createdAt: receiptCreatedAt(receipt),
      href: supermarketRoutes.receipts,
    }));
    const restaurantSales = restaurantData.orders
      .filter((order) => isPaid(order.status))
      .map((order) => ({
        id: `order-${order.id}`,
        number: order.orderNo || order.order_no || `RO-${order.id}`,
        staff: order.staffName || order.staff_name || "ငွေကိုင်ဝန်ထမ်း",
        amount: orderTotal(order),
        status: statusOf(order.status),
        createdAt: orderCreatedAt(order),
        href: restaurantRoutes.orders,
      }));
    const combined = businessType === "RESTAURANT"
      ? restaurantSales
      : businessType === "BOTH"
        ? [...supermarketSales, ...restaurantSales]
        : supermarketSales;
    return combined
      .sort((a, b) => (dateOf(b.createdAt)?.getTime() || 0) - (dateOf(a.createdAt)?.getTime() || 0))
      .slice(0, 6);
  }, [businessType, paidReceipts, restaurantData.orders]);

  const quickActions = useMemo(() => {
    if (businessType === "BOTH") {
      return [
        { label: "စူပါမားကတ် POS", href: SUPERMARKET_POS_PATH, icon: ShoppingCart },
        { label: "စားသောက်ဆိုင် POS", href: RESTAURANT_POS_PATH, icon: ChefHat },
        { label: "ကုန်ပစ္စည်းများ", href: supermarketRoutes.products, icon: Package },
        { label: "မီးဖိုချောင်", href: restaurantRoutes.kitchen, icon: Coffee },
        { label: "ဘောင်ချာများ", href: supermarketRoutes.receipts, icon: Receipt },
        { label: "ဆက်တင်များ", href: "/dashboard/settings", icon: Settings },
      ];
    }
    if (businessType === "RESTAURANT") {
      return [
        { label: "POS ဖွင့်ရန်", href: RESTAURANT_POS_PATH, icon: ChefHat },
        { label: "မီးဖိုချောင်", href: restaurantRoutes.kitchen, icon: Coffee },
        { label: "စားပွဲများ", href: restaurantRoutes.tables, icon: Table2 },
        { label: "မီနူး", href: restaurantRoutes.menu, icon: Utensils },
        { label: "အော်ဒါများ", href: restaurantRoutes.orders, icon: ClipboardList },
        { label: "ဆက်တင်များ", href: "/dashboard/settings", icon: Settings },
      ];
    }
    if (businessType === "FASHION") {
      return [
        { label: "POS ဖွင့်ရန်", href: fashionRoutes.pos, icon: Shirt },
        { label: "ကုန်ပစ္စည်းများ", href: supermarketRoutes.products, icon: Package },
        { label: "ဘောင်ချာများ", href: supermarketRoutes.receipts, icon: Receipt },
        { label: "ဝန်ထမ်းများ", href: "/dashboard/staff", icon: Users },
        { label: "အစီရင်ခံစာ", href: "/dashboard/reports", icon: BarChart3 },
        { label: "ဆက်တင်များ", href: "/dashboard/settings", icon: Settings },
      ];
    }
    return [
      { label: "POS ဖွင့်ရန်", href: SUPERMARKET_POS_PATH, icon: ShoppingCart },
      { label: "ကုန်ပစ္စည်းများ", href: supermarketRoutes.products, icon: Package },
      { label: "ကုန်လက်ကျန်", href: "/dashboard/inventory", icon: Store },
      { label: "ဘောင်ချာများ", href: supermarketRoutes.receipts, icon: Receipt },
      { label: "ဝန်ထမ်းများ", href: "/dashboard/staff", icon: Users },
      { label: "ဆက်တင်များ", href: "/dashboard/settings", icon: Settings },
    ];
  }, [businessType]);

  const refreshAll = useCallback(() => {
    if (businessType !== "RESTAURANT") void loadBusinessData(true);
    if (businessType === "RESTAURANT" || businessType === "BOTH") void loadRestaurantData(true);
  }, [businessType, loadBusinessData, loadRestaurantData]);

  const exportReport = useCallback(() => {
    const rows = [
      ["ရက်စွဲ", "အရောင်းရငွေ (ကျပ်)", "ငွေရှင်းမှတ်တမ်း"],
      ...salesData.map((point) => [point.date, String(point.sales), String(point.transactions)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      rangeDays === 1
        ? "pos-dashboard-today.csv"
        : `pos-dashboard-${rangeDays}-days.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [rangeDays, salesData]);

  const dashboardLoading = businessLoading || restaurantLoading;
  const dashboardRefreshing = businessRefreshing || restaurantRefreshing;
  const updatedAt = [businessUpdatedAt, restaurantUpdatedAt]
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const displayError = [businessError, restaurantError].filter(Boolean).join(" · ");
  const showStock = businessType !== "RESTAURANT";
  const dateRangeLabel =
    rangeDays === 1
      ? new Date().toLocaleDateString("my-MM", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : salesData.length
        ? `${salesData[0].date} – ${salesData[salesData.length - 1].date}`
        : "—";

  /*
   * Date labels and Recharts depend on the browser locale/time zone.
   * Render a deterministic shell during SSR and the first client render,
   * then show the real dashboard after hydration has completed.
   */
  if (!mounted) {
    return (
      <main
        className="min-h-screen bg-muted/30 p-3 text-foreground sm:p-5 lg:p-6"
        aria-busy="true"
        aria-label="ဒက်ရှ်ဘုတ် ရယူနေသည်"
      >
        <div className="mx-auto flex max-w-[1600px] animate-pulse flex-col gap-4">
          <div className="h-[116px] rounded-2xl border border-border/60 bg-card shadow-sm" />
          <div className="h-[390px] rounded-2xl bg-blue-950/90 shadow-lg" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-[142px] rounded-2xl border border-border/60 bg-card shadow-sm"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 p-3 text-foreground sm:p-5 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-800 dark:text-sky-300">
              {mounted ? businessTypeLabel(businessType) : "POS"} ဒက်ရှ်ဘုတ်
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{getTitle(businessType)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              အရောင်း၊ ငွေရှင်းမှတ်တမ်း၊ ကုန်လက်ကျန်နှင့် လုပ်ငန်းအခြေအနေများကို တစ်နေရာတည်းတွင် ကြည့်ရှုနိုင်သည်။
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-background p-1">
              {([1, 7, 30] as RangeDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    rangeDays === days
                      ? "bg-blue-950 text-white shadow-sm dark:bg-sky-300 dark:text-blue-950"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {days === 1 ? "ဒီနေ့" : days === 7 ? "၇ ရက်" : "ဒီလ"}
                </button>
              ))}
            </div>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-4" /> {dateRangeLabel}
            </span>
            <Button type="button" variant="outline" className="rounded-xl" onClick={exportReport}>
              <Download className="size-4" /> အစီရင်ခံစာထုတ်ရန်
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-blue-950 text-white hover:bg-blue-900 dark:bg-sky-300 dark:text-blue-950 dark:hover:bg-sky-200"
              onClick={refreshAll}
              disabled={dashboardRefreshing}
            >
              <RefreshCcw className={`size-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />
              ပြန်လည်ရယူရန်
            </Button>
          </div>
        </section>

        {displayError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0b1f3a_0%,#0a2547_52%,#07182f_100%)] text-white shadow-lg shadow-blue-950/15">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">အရောင်းအခြေအနေ</h2>
                <p className="mt-1 text-xs text-blue-100/70">
                  {rangeDays === 1
                    ? "ယနေ့ နာရီအလိုက် အရောင်းရငွေနှင့် ငွေရှင်းမှတ်တမ်း"
                    : `နောက်ဆုံး ${rangeDays === 7 ? "၇ ရက်" : "၃၀ ရက်"} အရောင်းရငွေနှင့် ငွေရှင်းမှတ်တမ်း`}
                </p>
              </div>
              <div className="flex items-center gap-5 text-xs text-blue-100/80">
                <span><strong className="block text-base text-white">{formatMoney(rangeSales)}</strong>အရောင်းရငွေ</span>
                <span><strong className="block text-base text-white">{rangeTransactions}</strong>ငွေရှင်းမှတ်တမ်း</span>
              </div>
            </div>
            <div className="h-[290px] p-3 sm:h-[340px] sm:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7dd3fc" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#7dd3fc" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="transaction-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" opacity={0.12} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#dbeafe", fontSize: 11 }} minTickGap={18} />
                  <YAxis yAxisId="sales" axisLine={false} tickLine={false} tick={{ fill: "#dbeafe", fontSize: 10 }} tickFormatter={compactMoney} />
                  <YAxis yAxisId="transactions" orientation="right" hide />
                  <Tooltip
                    contentStyle={{ background: "#07182f", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12 }}
                    labelStyle={{ color: "#dbeafe" }}
                    formatter={(value, name) => [name === "sales" ? formatMoney(Number(value)) : Number(value), name === "sales" ? "အရောင်းရငွေ" : "ငွေရှင်းမှတ်တမ်း"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
                  />
                  <Legend formatter={(value) => value === "sales" ? "အရောင်းရငွေ" : "ငွေရှင်းမှတ်တမ်း"} />
                  <Area yAxisId="sales" type="monotone" dataKey="sales" stroke="#7dd3fc" strokeWidth={2.5} fill="url(#sales-fill)" />
                  <Area yAxisId="transactions" type="monotone" dataKey="transactions" stroke="#a5b4fc" strokeWidth={2} fill="url(#transaction-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="ယနေ့အရောင်း" value={formatMoney(todaySales)} helper={`ငွေရှင်းပြီး ${todayTransactions} ခု`} icon={Banknote} tone="navy" loading={dashboardLoading} />
          <StatCard label="ငွေရှင်းမှတ်တမ်း" value={todayTransactions.toLocaleString()} helper={`ရွေးထားသောကာလအတွင်း ${rangeTransactions} ခု`} icon={Receipt} tone="blue" loading={dashboardLoading} />
          {showStock ? (
            <StatCard label="စုစုပေါင်းကုန်လက်ကျန်" value={stockCounts.totalUnits.toLocaleString()} helper={`ကုန်ပစ္စည်း ${products.length} မျိုး`} icon={Package} tone="violet" loading={dashboardLoading} />
          ) : (
            <StatCard label="အသုံးပြုနေသောစားပွဲ" value={`${restaurantMetrics.activeTables}/${restaurantMetrics.totalTables}`} helper={`ဖွင့်ထားသောအော်ဒါ ${restaurantMetrics.openOrders} ခု`} icon={Table2} tone="violet" loading={dashboardLoading} />
          )}
          {showStock ? (
            <StatCard label="ကုန်လက်ကျန်နည်း" value={(stockCounts.lowStock + stockCounts.outOfStock).toLocaleString()} helper={`ကုန်သွားသောပစ္စည်း ${stockCounts.outOfStock} မျိုး`} icon={TriangleAlert} tone="amber" loading={dashboardLoading} />
          ) : (
            <StatCard label="မီးဖိုချောင်စာရင်း" value={restaurantMetrics.activeKitchenTickets.toLocaleString()} helper={`ဝန်ဆောင်ရန်အဆင်သင့် ${restaurantMetrics.readyTickets} ခု`} icon={Coffee} tone="amber" loading={dashboardLoading} />
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr_0.9fr]">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{showStock ? "ကုန်လက်ကျန်ခွဲခြမ်းမှု" : "အော်ဒါခွဲခြမ်းမှု"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">လက်ရှိလုပ်ငန်းအခြေအနေ</p>
                </div>
                {updatedAt && <span className="text-[10px] text-muted-foreground">နောက်ဆုံးရယူချိန် {formatTime(updatedAt.toISOString())}</span>}
              </div>
              {showStock ? (
                products.length === 0 && !businessLoading ? (
                  <EmptyState icon={Package} title="ကုန်ပစ္စည်းအချက်အလက် မရှိသေးပါ" />
                ) : (
                  <div className="mt-3 grid items-center gap-3 sm:grid-cols-[190px_1fr] xl:grid-cols-1 2xl:grid-cols-[190px_1fr]">
                    <div className="relative h-[190px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stockData} dataKey="value" nameKey="name" innerRadius={53} outerRadius={78} paddingAngle={3}>
                            {stockData.map((item, index) => <Cell key={item.name} fill={STOCK_COLORS[index]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                        <div><strong className="block text-2xl">{products.length}</strong><span className="text-[10px] text-muted-foreground">ကုန်ပစ္စည်း</span></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {stockData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                          <span className="flex items-center gap-2 text-xs font-medium"><span className="size-2.5 rounded-full" style={{ backgroundColor: STOCK_COLORS[index] }} />{item.name}</span>
                          <strong className="text-sm">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {([
                    ["အသစ်", restaurantMetrics.newTickets, "bg-sky-500/10 text-sky-600"],
                    ["ချက်ပြုတ်နေသည်", restaurantMetrics.cookingTickets, "bg-amber-500/10 text-amber-600"],
                    ["အဆင်သင့်", restaurantMetrics.readyTickets, "bg-emerald-500/10 text-emerald-600"],
                    ["ဖွင့်ထားသောအော်ဒါ", restaurantMetrics.openOrders, "bg-violet-500/10 text-violet-600"],
                  ] as Array<[string, number, string]>).map(([label, value, style]) => (
                    <div key={String(label)} className={`rounded-xl p-4 ${style}`}><strong className="block text-2xl">{value}</strong><span className="text-xs font-medium">{label}</span></div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border/60 p-5">
                <div><h3 className="font-semibold">လတ်တလောလုပ်ဆောင်မှုများ</h3><p className="mt-1 text-xs text-muted-foreground">အရောင်းနှင့် ကုန်လက်ကျန်ပြောင်းလဲမှုများ</p></div>
                <Button asChild variant="ghost" size="sm"><Link href={businessType === "RESTAURANT" ? restaurantRoutes.orders : supermarketRoutes.receipts}>အားလုံးကြည့်ရန်</Link></Button>
              </div>
              <div className="divide-y divide-border/60">
                {recentSales.slice(0, 3).map((sale) => (
                  <Link key={sale.id} href={sale.href} className="flex items-center gap-3 p-4 transition hover:bg-muted/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><Receipt className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{sale.number}</strong><span className="text-xs text-muted-foreground">ငွေရှင်းပြီး · {formatMoney(sale.amount)}</span></span>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(sale.createdAt)}</span>
                  </Link>
                ))}
                {showStock && lowStockProducts.slice(0, Math.max(0, 4 - recentSales.length)).map((product) => (
                  <Link key={product.id} href={supermarketRoutes.products} className="flex items-center gap-3 p-4 transition hover:bg-muted/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600"><TriangleAlert className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{productName(product)}</strong><span className="text-xs text-muted-foreground">ကုန်လက်ကျန်နည်း သတိပေးချက်</span></span>
                    <span className="text-xs font-semibold text-amber-600">{productQuantity(product)} ခုကျန်</span>
                  </Link>
                ))}
                {recentSales.length === 0 && lowStockProducts.length === 0 && <EmptyState icon={CheckCircle2} title="လတ်တလောလုပ်ဆောင်မှု မရှိသေးပါ" />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold">အမြန်လုပ်ဆောင်ရန်</h3>
              <p className="mt-1 text-xs text-muted-foreground">အသုံးများသော စီမံခန့်ခွဲမှုလင့်ခ်များ</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button key={`${action.label}-${action.href}`} asChild variant="outline" className="h-20 flex-col gap-2 rounded-xl text-xs">
                      <Link href={action.href}><Icon className="size-5 text-blue-800 dark:text-sky-300" />{action.label}</Link>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border/60 p-5">
                <div><h3 className="font-semibold">လတ်တလောအရောင်းများ</h3><p className="mt-1 text-xs text-muted-foreground">နောက်ဆုံးငွေရှင်းထားသော ဘောင်ချာနှင့်အော်ဒါများ</p></div>
                <Button asChild variant="outline" size="sm" className="rounded-lg"><Link href={businessType === "RESTAURANT" ? restaurantRoutes.orders : supermarketRoutes.receipts}>အားလုံးကြည့်ရန်</Link></Button>
              </div>
              {recentSales.length === 0 ? (
                <EmptyState icon={Receipt} title="ငွေရှင်းပြီးသောအရောင်း မရှိသေးပါ" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px]">
                    <thead><tr className="border-b border-border/60 bg-muted/25 text-left"><th className="px-5 py-3 text-xs font-medium text-muted-foreground">ဘောင်ချာ / အော်ဒါ</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">ဝန်ထမ်း</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">ရက်စွဲ</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">ပမာဏ</th><th className="px-5 py-3 text-xs font-medium text-muted-foreground">အခြေအနေ</th></tr></thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id} className="border-b border-border/40 last:border-0 hover:bg-muted/25">
                          <td className="px-5 py-3 text-sm font-semibold"><Link href={sale.href}>{sale.number}</Link></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{sale.staff}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</td>
                          <td className="px-4 py-3 text-sm font-semibold">{formatMoney(sale.amount)}</td>
                          <td className="px-5 py-3"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{statusLabel(sale.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold">ယနေ့ငွေပေးချေမှုအကျဉ်း</h3>
              <p className="mt-1 text-xs text-muted-foreground">ငွေပေးချေနည်းအလိုက် ရရှိငွေစုစုပေါင်း</p>
              <div className="mt-4 space-y-3">
                {([
                  ["ငွေသား", paymentSummary.CASH, Banknote, "bg-emerald-500/10 text-emerald-600"],
                  ["ကတ်", paymentSummary.CARD, Receipt, "bg-sky-500/10 text-sky-600"],
                  ["ဒစ်ဂျစ်တယ်ပိုက်ဆံအိတ်", paymentSummary.WALLET, ShoppingCart, "bg-violet-500/10 text-violet-600"],
                ] as Array<[string, number, ElementType, string]>).map(([label, value, PaymentIcon, style]) => {
                  return (
                    <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <span className={`grid size-10 place-items-center rounded-xl ${style}`}><PaymentIcon className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{label}</span><strong className="block truncate text-sm">{formatMoney(Number(value))}</strong></span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {(businessType === "RESTAURANT" || businessType === "BOTH") && (
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-orange-500/10 text-orange-600"><ChefHat className="size-5" /></span>
                  <div><h3 className="font-semibold">စားသောက်ဆိုင် လက်ရှိလုပ်ငန်းအခြေအနေ</h3><p className="mt-1 text-xs text-muted-foreground">မီးဖိုချောင်စာရင်းကို ၁၀ စက္ကန့်တိုင်း ပြန်လည်ရယူသည်</p></div>
                </div>
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">တိုက်ရိုက် · {restaurantUpdatedAt ? formatTime(restaurantUpdatedAt.toISOString()) : "--:--"}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadRestaurantData(true)} disabled={restaurantRefreshing}><RefreshCcw className={`size-4 ${restaurantRefreshing ? "animate-spin" : ""}`} />ပြန်လည်ရယူရန်</Button></div>
              </div>
              {restaurantLoading ? (
                <div className="grid min-h-56 place-items-center"><Loader2 className="size-7 animate-spin text-orange-500" /></div>
              ) : activeRestaurantTickets.length === 0 ? (
                <EmptyState icon={PackageCheck} title="လက်ရှိမီးဖိုချောင်စာရင်း မရှိပါ" />
              ) : (
                <div className="divide-y divide-border/60">
                  {activeRestaurantTickets.map((ticket) => {
                    const status = statusOf(ticket.status);
                    const wait = elapsedMinutes(ticket.createdAt);
                    const count = (ticket.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
                    return (
                      <Link key={ticket.id} href={restaurantRoutes.kitchen} className="flex items-center gap-3 p-4 transition hover:bg-muted/30">
                        <span className={`grid size-10 place-items-center rounded-xl ${status === "READY" ? "bg-emerald-500/10 text-emerald-600" : status === "COOKING" ? "bg-orange-500/10 text-orange-600" : "bg-sky-500/10 text-sky-600"}`}><Clock3 className="size-4" /></span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{ticket.ticketNo || `KT-${ticket.id}`} · {statusLabel(status)}</strong><span className="text-xs text-muted-foreground">{ticket.orderType === "DINE_IN" ? `စားပွဲ ${ticket.tableNo || "-"}` : ticket.orderType === "TAKEAWAY" ? "ပါဆယ်" : ticket.orderType === "DELIVERY" ? "ပို့ဆောင်ရန်" : "အော်ဒါ"} · ပစ္စည်း {count} ခု</span></span>
                        <span className={`text-xs font-semibold ${wait >= 15 ? "text-red-500" : "text-muted-foreground"}`}>{wait} မိနစ်</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
