"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChefHat,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Flame,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Search,
  Table2,
  Timer,
  Utensils,
  XCircle,
} from "lucide-react";

import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";

type KitchenStatus =
  | "ALL"
  | "NEW"
  | "COOKING"
  | "READY"
  | "DONE"
  | "CANCELLED";

type KitchenTicketItem = {
  id: number;
  menuItemId?: number | null;
  productId?: number | null;
  itemName: string;
  quantity: number;
  unitPrice?: number | null;
  modifiers?: string[] | string | null;
  kitchenNote?: string | null;
  status: KitchenStatus | string;
};

type KitchenTicket = {
  id: number;
  ticketNo: string;
  orderType?: string | null;
  tableId?: number | null;
  tableNo?: string | null;
  status: KitchenStatus | string;
  priority?: string | null;
  note?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  shopId?: number | null;
  shopCode?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: KitchenTicketItem[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const TOKEN_KEYS = [
  "pos_access_token",
  "pos_shop_owner_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
] as const;
const MISSING_TOKEN_MESSAGE = "Login token မရှိပါ။ အရင်ဆုံး login ပြန်ဝင်ပါ။";
const INVALID_TOKEN_MESSAGE = "Login token မမှန်ပါ။ ပြန် login ဝင်ပါ။";
const FEATURE_DISABLED_MESSAGE =
  "ဒီဆိုင် plan မှာ Restaurant feature မဖွင့်ထားပါ။ Super Admin > Shop Feature Control မှာ Restaurant Feature Gate ကို ON လုပ်ပါ။";
const BRAND_COLOR_STORAGE_KEY = "binhlaig_brand_colors";

function applyStoredBrandColors() {
  if (typeof window === "undefined") return;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(BRAND_COLOR_STORAGE_KEY) || "null",
    ) as { primary?: unknown; accent?: unknown } | null;
    const isHexColor = (value: unknown): value is string =>
      typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    const primary =
      stored && isHexColor(stored.primary)
        ? stored.primary
        : styles.getPropertyValue("--dashboard-primary").trim() || "#f97316";
    const accent =
      stored && isHexColor(stored.accent)
        ? stored.accent
        : styles.getPropertyValue("--dashboard-accent").trim() || "#fb923c";

    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-accent", accent);
    root.style.setProperty("--dashboard-primary", primary);
    root.style.setProperty("--dashboard-accent", accent);
    root.style.setProperty(
      "--brand-soft",
      "color-mix(in srgb, var(--brand-primary) 10%, transparent)",
    );
    root.style.setProperty(
      "--brand-border",
      "color-mix(in srgb, var(--brand-primary) 28%, transparent)",
    );
  } catch {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", "#f97316");
    root.style.setProperty("--brand-accent", "#fb923c");
    root.style.setProperty(
      "--brand-soft",
      "color-mix(in srgb, var(--brand-primary) 10%, transparent)",
    );
    root.style.setProperty(
      "--brand-border",
      "color-mix(in srgb, var(--brand-primary) 28%, transparent)",
    );
  }
}

const activeStatuses: KitchenStatus[] = ["ALL", "NEW", "COOKING", "READY"];
const completedStatuses: KitchenStatus[] = ["DONE", "CANCELLED"];
const activeOnlyStatuses: KitchenStatus[] = ["NEW", "COOKING", "READY"];
const COMPLETED_PAGE_SIZE = 10;

const statusMeta: Record<
  KitchenStatus,
  {
    label: string;
    icon: React.ElementType;
    pill: string;
    card: string;
  }
> = {
  ALL: {
    label: "All Active",
    icon: ChefHat,
    pill: "bg-slate-100 text-slate-700 ring-slate-200",
    card: "border-slate-100 bg-white",
  },
  NEW: {
    label: "New",
    icon: Clock3,
    pill: "bg-blue-50 text-blue-700 ring-blue-100",
    card: "border-blue-100 bg-blue-50/40",
  },
  COOKING: {
    label: "Cooking",
    icon: Flame,
    pill: "bg-orange-50 text-orange-700 ring-orange-100",
    card: "border-orange-100 bg-orange-50/50",
  },
  READY: {
    label: "Ready",
    icon: PackageCheck,
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    card: "border-emerald-100 bg-emerald-50/50",
  },
  DONE: {
    label: "Done",
    icon: CheckCircle2,
    pill: "bg-slate-100 text-slate-700 ring-slate-200",
    card: "border-slate-100 bg-white",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    pill: "bg-red-50 text-red-700 ring-red-100",
    card: "border-red-100 bg-red-50/40",
  },
};

function getAccessToken() {
  if (typeof window === "undefined") return null;

  const ownerToken = getStoredOwnerToken()?.trim();
  if (ownerToken) return ownerToken;

  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key)?.trim();
    if (token) return token;
  }

  return null;
}

function formatAuthorization(token: string) {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function authHeaders() {
  const token = getAccessToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: formatAuthorization(token) } : {}),
  };
}

async function getApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;

      if (typeof record.message === "string") return record.message;
      if (typeof record.error === "string") return record.error;
    }
  }

  const text = await res.text().catch(() => "");
  return text || fallback;
}

async function getAuthOrFeatureError(res: Response) {
  if (res.status === 401) return INVALID_TOKEN_MESSAGE;
  if (res.status !== 403) return "";

  const data = await res
    .clone()
    .json()
    .catch(() => null);
  const text =
    data && typeof data === "object"
      ? JSON.stringify(data)
      : await res
          .clone()
          .text()
          .catch(() => "");

  if (/FEATURE_DISABLED|feature|allowRestaurant|allowKitchen|plan|subscription|disabled|not enabled|not allowed/i.test(text)) {
    return FEATURE_DISABLED_MESSAGE;
  }

  return INVALID_TOKEN_MESSAGE;
}

function normalizeStatus(value?: string | null): KitchenStatus {
  const upper = String(value || "NEW").toUpperCase();

  if (
    upper === "NEW" ||
    upper === "COOKING" ||
    upper === "READY" ||
    upper === "DONE" ||
    upper === "CANCELLED"
  ) {
    return upper;
  }

  return "NEW";
}

function parseModifiers(value: KitchenTicketItem["modifiers"]) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      // comma-separated fallback
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function isTodayLocalDate(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function countItems(ticket: KitchenTicket) {
  return (ticket.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
}

function summarizeItems(ticket: KitchenTicket) {
  const items = ticket.items || [];

  if (items.length === 0) return "-";

  return items
    .slice(0, 3)
    .map((item) => `${item.quantity || 1}x ${item.itemName}`)
    .join(", ")
    .concat(items.length > 3 ? ` +${items.length - 3} more` : "");
}

function isActiveKitchenStatus(status: KitchenStatus) {
  return activeOnlyStatuses.includes(status);
}

function isCompletedStatus(status: KitchenStatus) {
  return status === "DONE" || status === "CANCELLED";
}

function deriveTicketStatus(items: KitchenTicketItem[]): "NEW" | "COOKING" | "READY" {
  if (items.length === 0) return "NEW";

  const unfinishedStatuses = items
    .map((item) => normalizeStatus(item.status))
    .filter((status) => status !== "DONE" && status !== "CANCELLED");

  if (
    unfinishedStatuses.length > 0 &&
    unfinishedStatuses.every((status) => status === "READY")
  ) {
    return "READY";
  }

  if (
    items.some((item) => {
      const status = normalizeStatus(item.status);
      return status === "COOKING" || status === "READY" || status === "DONE";
    })
  ) {
    return "COOKING";
  }

  return "NEW";
}

export default function RestaurantKitchenPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<KitchenStatus>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [completedPage, setCompletedPage] = useState(1);
  const [undoReadyItem, setUndoReadyItem] = useState<{
    ticketId: number;
    ticketNo: string;
    itemId: number;
    itemName: string;
  } | null>(null);

  useEffect(() => {
    const syncBrandColors = () => applyStoredBrandColors();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === BRAND_COLOR_STORAGE_KEY) syncBrandColors();
    };

    syncBrandColors();
    window.addEventListener("brand-colors-changed", syncBrandColors);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("brand-colors-changed", syncBrandColors);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);
  const readyUndoTimerRef = useRef<number | null>(null);

  const filterButtons = [...activeStatuses, ...completedStatuses];

  const filteredTickets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const status = normalizeStatus(ticket.status);

      const matchStatus =
        selectedStatus === "ALL"
          ? isActiveKitchenStatus(status)
          : selectedStatus === status;

      // DONE tab မှာ today date orders ပဲပြရန်။
      // အရင်နေ့က DONE orders တွေကို table ထဲ မပြတော့ပါ။
      const matchTodayDone =
        selectedStatus === "DONE" ? isTodayLocalDate(ticket.createdAt) : true;

      const matchSearch =
        !keyword ||
        ticket.ticketNo?.toLowerCase().includes(keyword) ||
        ticket.tableNo?.toLowerCase().includes(keyword) ||
        ticket.staffName?.toLowerCase().includes(keyword) ||
        ticket.items?.some((item) =>
          item.itemName?.toLowerCase().includes(keyword)
        );

      return matchStatus && matchTodayDone && matchSearch;
    });
  }, [tickets, selectedStatus, search]);

  const completedTableTickets = useMemo(() => {
    return filteredTickets.filter((ticket) =>
      isCompletedStatus(normalizeStatus(ticket.status))
    );
  }, [filteredTickets]);

  const completedTotalPages = Math.max(
    1,
    Math.ceil(completedTableTickets.length / COMPLETED_PAGE_SIZE)
  );

  const paginatedCompletedTickets = useMemo(() => {
    const safePage = Math.min(completedPage, completedTotalPages);
    const start = (safePage - 1) * COMPLETED_PAGE_SIZE;

    return completedTableTickets.slice(start, start + COMPLETED_PAGE_SIZE);
  }, [completedPage, completedTableTickets, completedTotalPages]);

  const statusCounts = useMemo(() => {
    const counts: Record<KitchenStatus, number> = {
      ALL: 0,
      NEW: 0,
      COOKING: 0,
      READY: 0,
      DONE: 0,
      CANCELLED: 0,
    };

    tickets.forEach((ticket) => {
      const status = normalizeStatus(ticket.status);

      // DONE count ကိုလည်း today count ပဲပြပါမယ်။
      if (status === "DONE") {
        if (isTodayLocalDate(ticket.createdAt)) {
          counts.DONE += 1;
        }
        return;
      }

      counts[status] += 1;

      if (isActiveKitchenStatus(status)) {
        counts.ALL += 1;
      }
    });

    return counts;
  }, [tickets]);

  async function fetchTickets() {
    setLoading(true);
    setError("");

    try {
      const token = getAccessToken();

      if (!token) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(`${API_BASE}/api/restaurant/kitchen/tickets`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Kitchen tickets များကိုယူမရပါ။")
        );
      }

      const data = await res.json().catch(() => []);
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setTickets([]);
      setError(
        err instanceof Error ? err.message : "Kitchen tickets loading error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateItemStatus(
    ticket: KitchenTicket,
    item: KitchenTicketItem,
    nextStatus: "COOKING" | "READY"
  ) {
    setUpdatingId(`item-${item.id}`);
    setError("");

    try {
      const itemResponse = await fetch(
        `${API_BASE}/api/restaurant/kitchen/items/${item.id}/status`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      const itemAuthOrFeatureError = await getAuthOrFeatureError(itemResponse);
      if (itemAuthOrFeatureError) throw new Error(itemAuthOrFeatureError);

      if (!itemResponse.ok) {
        throw new Error(
          await getApiErrorMessage(
            itemResponse,
            `${item.itemName} status update မလုပ်နိုင်ပါ။`
          )
        );
      }

      const returnedItemBody = await itemResponse.json().catch(() => null);
      const returnedItem =
        returnedItemBody && typeof returnedItemBody === "object"
          ? (returnedItemBody as KitchenTicketItem)
          : null;
      const nextItems = (ticket.items || []).map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, ...(returnedItem || {}), status: nextStatus }
          : currentItem
      );
      const nextTicketStatus = deriveTicketStatus(nextItems);

      let returnedTicket: KitchenTicket | null = null;
      if (normalizeStatus(ticket.status) !== nextTicketStatus) {
        const ticketResponse = await fetch(
          `${API_BASE}/api/restaurant/kitchen/tickets/${ticket.id}/status`,
          {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ status: nextTicketStatus }),
          }
        );

        const ticketAuthOrFeatureError =
          await getAuthOrFeatureError(ticketResponse);
        if (ticketAuthOrFeatureError) throw new Error(ticketAuthOrFeatureError);

        if (!ticketResponse.ok) {
          throw new Error(
            await getApiErrorMessage(
              ticketResponse,
              "Ticket status update မလုပ်နိုင်ပါ။"
            )
          );
        }

        const returnedTicketBody = await ticketResponse.json().catch(() => null);
        returnedTicket =
          returnedTicketBody && typeof returnedTicketBody === "object"
            ? (returnedTicketBody as KitchenTicket)
            : null;
      }

      setTickets((current) =>
        current.map((currentTicket) =>
          currentTicket.id === ticket.id
            ? {
                ...currentTicket,
                ...(returnedTicket || {}),
                status: nextTicketStatus,
                items: nextItems,
              }
            : currentTicket
        )
      );

      if (nextStatus === "READY") {
        if (readyUndoTimerRef.current !== null) {
          window.clearTimeout(readyUndoTimerRef.current);
        }

        setUndoReadyItem({
          ticketId: ticket.id,
          ticketNo: ticket.ticketNo || `KT-${ticket.id}`,
          itemId: item.id,
          itemName: item.itemName,
        });
        readyUndoTimerRef.current = window.setTimeout(() => {
          setUndoReadyItem(null);
          readyUndoTimerRef.current = null;
        }, 8000);
      } else if (undoReadyItem?.itemId === item.id) {
        setUndoReadyItem(null);
        if (readyUndoTimerRef.current !== null) {
          window.clearTimeout(readyUndoTimerRef.current);
          readyUndoTimerRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Item update error");
      await fetchTickets();
    } finally {
      setUpdatingId(null);
    }
  }

  function undoReadyItemStatus() {
    if (!undoReadyItem) return;

    const ticket = tickets.find(
      (candidate) => candidate.id === undoReadyItem.ticketId
    );
    const item = ticket?.items?.find(
      (candidate) => candidate.id === undoReadyItem.itemId
    );

    if (ticket && item) {
      void updateItemStatus(ticket, item, "COOKING");
    }
  }

  function handleStatusFilter(status: KitchenStatus) {
    setSelectedStatus(status);
    setCompletedPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setCompletedPage(1);
  }

  useEffect(() => {
    fetchTickets();

    const interval = window.setInterval(() => {
      fetchTickets();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (readyUndoTimerRef.current !== null) {
        window.clearTimeout(readyUndoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (completedPage > completedTotalPages) {
      setCompletedPage(completedTotalPages);
    }
  }, [completedPage, completedTotalPages]);

  const selectedMeta = statusMeta[selectedStatus];
  const showCompletedTable =
    selectedStatus === "DONE" || selectedStatus === "CANCELLED";

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,var(--brand-soft),var(--background)_42%,color-mix(in_srgb,var(--brand-accent)_8%,var(--background)))] p-4 text-slate-950 sm:p-6 lg:p-8">
      <BusinessTypeGuard allow="RESTAURANT" />

      <AnimatePresence>
        {undoReadyItem && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-950 p-3 text-white shadow-2xl"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500">
              <PackageCheck size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {undoReadyItem.itemName} · READY
              </p>
              <p className="text-xs font-semibold text-slate-300">
                {undoReadyItem.ticketNo} မှ Serving ဆီပို့ထားပါတယ်။
              </p>
            </div>
            <button
              type="button"
              onClick={undoReadyItemStatus}
              disabled={updatingId === `item-${undoReadyItem.itemId}`}
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-[var(--brand-soft)] disabled:opacity-50"
            >
              {updatingId === `item-${undoReadyItem.itemId}`
                ? "ပြန်ယူနေသည်..."
                : "UNDO · ပြန်ယူမယ်"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {/* Top toolbar */}
        <section className="sticky top-4 z-20 rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <ChefHat className="text-[var(--brand-accent)]" size={28} />
                Restaurant Kitchen
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Active orders ကိုအဓိကကြည့်ရန်။ DONE / CANCELLED ကို filter
                နှိပ်မှသာ table ဖြင့်ပြပါမယ်။
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
                <Search size={18} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search ticket, table, staff, item..."
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400 sm:w-[320px]"
                />
              </div>

              <button
                onClick={fetchTickets}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_24%,transparent)] transition hover:brightness-95 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {filterButtons.map((status) => {
              const meta = statusMeta[status];
              const Icon = meta.icon;
              const active = selectedStatus === status;
              const completed = isCompletedStatus(status);

              return (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    active
                      ? completed
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                        : "bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_22%,transparent)]"
                      : completed
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      : "bg-[var(--brand-soft)] text-slate-700 hover:brightness-95"
                  }`}
                >
                  <Icon size={17} />
                  {meta.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {statusCounts[status]}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Ticket title row */}
        <section className="flex flex-col gap-1 px-1">
          <h2 className="text-xl font-black text-slate-950">
            {selectedMeta.label} Tickets
          </h2>
          <p className="text-sm font-semibold text-slate-500">
            {selectedStatus === "ALL"
              ? "ALL မှာ NEW, COOKING, READY tickets ပဲပြပါမယ်။"
              : selectedStatus === "DONE"
              ? "ဒီနေ့ပြီးထားသော orders များကိုသာ table + pagination ဖြင့်ပြထားပါတယ်။"
              : selectedStatus === "CANCELLED"
              ? "Cancel လုပ်ထားသော orders များကို table + pagination ဖြင့်ပြထားပါတယ်။"
              : `${selectedMeta.label} status orders များ။`}
          </p>
        </section>

        {loading ? (
          <section className="grid min-h-[420px] place-items-center rounded-[2rem] border border-white/80 bg-white/85 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-black text-slate-500">
              <Loader2 className="animate-spin text-[var(--brand-accent)]" size={24} />
              Loading kitchen tickets...
            </div>
          </section>
        ) : filteredTickets.length === 0 ? (
          <section className="grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed border-[var(--brand-border)] bg-[var(--brand-soft)] p-8 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white">
                <ChefHat size={36} />
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-900">
                Ticket မရှိသေးပါ
              </h3>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                {selectedStatus === "ALL"
                  ? "Active kitchen ticket မရှိသေးပါ။ Restaurant POS မှ Kitchen ကို order ပို့လိုက်ရင် ဒီမှာပေါ်လာပါမယ်။"
                  : `${selectedMeta.label} ticket မရှိသေးပါ။`}
              </p>
            </div>
          </section>
        ) : showCompletedTable ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-950">
                  {selectedMeta.label} Orders Table
                  {selectedStatus === "DONE" && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                      Today only
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Total {completedTableTickets.length} orders · Page{" "}
                  {Math.min(completedPage, completedTotalPages)} of{" "}
                  {completedTotalPages}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCompletedPage((page) => Math.max(1, page - 1))
                  }
                  disabled={completedPage <= 1}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={17} />
                  Prev
                </button>

                <button
                  onClick={() =>
                    setCompletedPage((page) =>
                      Math.min(completedTotalPages, page + 1)
                    )
                  }
                  disabled={completedPage >= completedTotalPages}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Table / Type</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedCompletedTickets.map((ticket) => {
                    const status = normalizeStatus(ticket.status);
                    const meta = statusMeta[status];

                    return (
                      <tr key={ticket.id} className="bg-white hover:bg-slate-50">
                        <td className="px-4 py-4 align-top">
                          <div className="font-black text-slate-950">
                            {ticket.ticketNo || `KT-${ticket.id}`}
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-400">
                            ID: {ticket.id}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="inline-flex items-center gap-2 font-black text-slate-800">
                            {ticket.orderType === "DINE_IN" ? (
                              <Table2 size={17} className="text-[var(--brand-accent)]" />
                            ) : ticket.orderType === "TAKEAWAY" ? (
                              <Coffee size={17} className="text-[var(--brand-accent)]" />
                            ) : (
                              <Utensils size={17} className="text-[var(--brand-accent)]" />
                            )}
                            {ticket.orderType === "DINE_IN"
                              ? ticket.tableNo || "No table"
                              : ticket.orderType || "Order"}
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-400">
                            {ticket.orderType || "-"}
                          </div>
                        </td>

                        <td className="max-w-[320px] px-4 py-4 align-top">
                          <div className="text-sm font-bold text-slate-700">
                            {summarizeItems(ticket)}
                          </div>
                          <div className="mt-1 text-xs font-black text-[var(--brand-accent)]">
                            {countItems(ticket)} items
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-bold text-slate-700">
                            {ticket.staffName || "-"}
                          </div>
                          {ticket.staffId && (
                            <div className="mt-1 text-xs font-bold text-slate-400">
                              {ticket.staffId}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            {ticket.priority || "NORMAL"}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.pill}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-slate-600">
                          {formatDateTime(ticket.createdAt)}
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-slate-600">
                          {formatDateTime(ticket.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-bold text-slate-500">
                Showing{" "}
                {completedTableTickets.length === 0
                  ? 0
                  : (Math.min(completedPage, completedTotalPages) - 1) *
                      COMPLETED_PAGE_SIZE +
                    1}
                {" - "}
                {Math.min(
                  Math.min(completedPage, completedTotalPages) *
                    COMPLETED_PAGE_SIZE,
                  completedTableTickets.length
                )}{" "}
                of {completedTableTickets.length}
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: completedTotalPages }, (_, index) => {
                  const page = index + 1;
                  const active = page === completedPage;

                  return (
                    <button
                      key={page}
                      onClick={() => setCompletedPage(page)}
                      className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${
                        active
                          ? "bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {filteredTickets.map((ticket) => {
                const status = normalizeStatus(ticket.status);
                const meta = statusMeta[status];
                const StatusIcon = meta.icon;

                return (
                  <motion.article
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    className={`overflow-hidden rounded-[2rem] border shadow-sm ${meta.card}`}
                  >
                    <div className="border-b border-slate-200/60 bg-white/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] px-3 py-1 text-xs font-black text-white">
                              {ticket.ticketNo || `KT-${ticket.id}`}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.pill}`}
                            >
                              <StatusIcon size={13} />
                              {status}
                            </span>
                          </div>

                          <h3 className="mt-3 flex items-center gap-2 text-xl font-black text-slate-950">
                            {ticket.orderType === "DINE_IN" ? (
                              <Table2 size={22} className="text-[var(--brand-accent)]" />
                            ) : ticket.orderType === "TAKEAWAY" ? (
                              <Coffee size={22} className="text-[var(--brand-accent)]" />
                            ) : (
                              <Utensils size={22} className="text-[var(--brand-accent)]" />
                            )}

                            {ticket.orderType === "DINE_IN"
                              ? ticket.tableNo || "No table"
                              : ticket.orderType || "Order"}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Timer size={14} />
                              {formatTime(ticket.createdAt)}
                            </span>
                            <span>{countItems(ticket)} items</span>
                            {ticket.staffName && (
                              <span>By {ticket.staffName}</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm ring-1 ring-slate-100">
                          <div className="text-xs font-black text-slate-400">
                            Priority
                          </div>
                          <div className="text-sm font-black text-slate-800">
                            {ticket.priority || "NORMAL"}
                          </div>
                        </div>
                      </div>

                      {ticket.note && (
                        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                          {ticket.note}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      {(ticket.items || []).map((item) => {
                        const itemStatus = normalizeStatus(item.status);
                        const itemMeta = statusMeta[itemStatus];
                        const itemModifiers = parseModifiers(item.modifiers);

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-soft)] text-sm font-black text-[var(--brand-accent)]">
                                    x{item.quantity || 1}
                                  </span>

                                  <h4 className="font-black text-slate-950">
                                    {item.itemName}
                                  </h4>
                                </div>

                                {itemModifiers.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {itemModifiers.map((modifier) => (
                                      <span
                                        key={modifier}
                                        className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600"
                                      >
                                        {modifier}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.kitchenNote && (
                                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                                    Note: {item.kitchenNote}
                                  </div>
                                )}
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${itemMeta.pill}`}
                              >
                                {itemStatus}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {(["COOKING", "READY"] as const).map(
                                (nextStatus) => {
                                  const isUpdating =
                                    updatingId === `item-${item.id}`;
                                  const isCurrent = itemStatus === nextStatus;
                                  const canUpdate =
                                    (nextStatus === "COOKING" &&
                                      (itemStatus === "NEW" ||
                                        itemStatus === "READY")) ||
                                    (nextStatus === "READY" &&
                                      itemStatus === "COOKING");

                                  return (
                                    <button
                                      key={nextStatus}
                                      type="button"
                                      onClick={() =>
                                        void updateItemStatus(
                                          ticket,
                                          item,
                                          nextStatus
                                        )
                                      }
                                      disabled={updatingId !== null || !canUpdate}
                                      className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                                        isCurrent
                                          ? nextStatus === "READY"
                                            ? "bg-emerald-500 text-white"
                                            : "bg-orange-500 text-white"
                                          : canUpdate
                                            ? nextStatus === "READY"
                                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                              : "bg-orange-500 text-white hover:bg-orange-600"
                                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {isUpdating && canUpdate ? (
                                        <Loader2
                                          size={15}
                                          className="mx-auto animate-spin"
                                        />
                                      ) : (
                                        <span className="inline-flex items-center justify-center gap-1.5">
                                          {nextStatus === "COOKING" ? (
                                            <Flame size={14} />
                                          ) : (
                                            <PackageCheck size={14} />
                                          )}
                                          {nextStatus === "COOKING" &&
                                          itemStatus === "READY"
                                            ? "BACK TO COOKING"
                                            : nextStatus}
                                        </span>
                                      )}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </section>
        )}
      </div>
    </main>
  );
}
