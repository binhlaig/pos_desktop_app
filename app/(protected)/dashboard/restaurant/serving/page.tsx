
"use client"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChefHat,
  Coffee,
  IdCard,
  Loader2,
  Moon,
  PackageCheck,
  RefreshCw,
  Search,
  Sun,
  Table2,
  Truck,
  UserCheck,
  Utensils,
  X,
} from "lucide-react";
import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { fetchStaffById } from "@/lib/staff-validation";

type ServingStatus = "READY" | "DONE";

type ActiveServingStaff = {
  staffId: string;
  staffName: string;
  role: string;
};

type ServingTicketItem = {
  id: number;
  itemName: string;
  quantity: number;
  status: string;
  modifiers?: string[] | string | null;
  kitchenNote?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  runnerStaffId?: string | null;
  runnerStaffName?: string | null;
};

type ServingTicket = {
  id: number;
  ticketNo: string;
  status?: string | null;
  orderNo?: string | null;
  orderType?: string | null;
  tableId?: number | null;
  tableNo?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  readyAt?: string | null;
  items?: ServingTicketItem[];
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
        : styles.getPropertyValue("--dashboard-primary").trim() || "#2563eb";
    const accent =
      stored && isHexColor(stored.accent)
        ? stored.accent
        : styles.getPropertyValue("--dashboard-accent").trim() || "#60a5fa";

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
    root.style.setProperty("--brand-primary", "#2563eb");
    root.style.setProperty("--brand-accent", "#60a5fa");
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

/*
  Reuses the existing Kitchen backend contract:
  GET   /api/restaurant/kitchen/tickets
  PATCH /api/restaurant/kitchen/items/{itemId}/status
  PATCH /api/restaurant/kitchen/tickets/{ticketId}/status
  body: { status: "DONE" }
*/

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function unwrapList(value: unknown): ServingTicket[] {
  if (Array.isArray(value)) return value as ServingTicket[];

  const record = asRecord(value);
  const list = record.tickets || record.data || record.content || record.items;
  return Array.isArray(list) ? (list as ServingTicket[]) : [];
}

function normalizeStatus(value?: string | null): ServingStatus | "OTHER" {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "READY") return "READY";
  if (normalized === "DONE") return "DONE";
  return "OTHER";
}

function parseModifiers(value: ServingTicketItem["modifiers"]) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall back to comma-separated backend values.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getApiErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = asRecord(await response.json().catch(() => null));
    return pickString(data, ["message", "error"]) || fallback;
  }

  return (await response.text().catch(() => "")) || fallback;
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function elapsedMinutes(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
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

export default function RestaurantServingPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [activeStaff, setActiveStaff] = useState<ActiveServingStaff | null>(null);
  const [staffIdDraft, setStaffIdDraft] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const staffInputRef = useRef<HTMLInputElement | null>(null);

  const [tickets, setTickets] = useState<ServingTicket[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ServingStatus>("READY");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const statusCounts = useMemo(() => {
    const counts: Record<ServingStatus, number> = {
      READY: 0,
      DONE: 0,
    };

    tickets.forEach((ticket) => {
      (ticket.items || []).forEach((item) => {
        const status = normalizeStatus(item.status);
        if (status === "READY") counts.READY += 1;
        if (
          status === "DONE" &&
          isToday(item.servedAt || ticket.createdAt) &&
          (!item.runnerStaffId || item.runnerStaffId === activeStaff?.staffId)
        ) {
          counts.DONE += 1;
        }
      });
    });

    return counts;
  }, [tickets, activeStaff]);

  const visibleTickets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tickets
      .map((ticket) => {
        const items = (ticket.items || []).filter((item) => {
          const status = normalizeStatus(item.status);
          const matchesStatus =
            selectedStatus === "READY"
              ? status === "READY"
              : status === "DONE" &&
                isToday(item.servedAt || ticket.createdAt) &&
                (!item.runnerStaffId || item.runnerStaffId === activeStaff?.staffId);

          const matchesSearch =
            !keyword ||
            item.itemName.toLowerCase().includes(keyword) ||
            ticket.ticketNo?.toLowerCase().includes(keyword) ||
            ticket.orderNo?.toLowerCase().includes(keyword) ||
            ticket.tableNo?.toLowerCase().includes(keyword);

          return matchesStatus && matchesSearch;
        });

        return { ...ticket, items };
      })
      .filter((ticket) => (ticket.items || []).length > 0)
      .sort((a, b) => {
        const aTime = new Date(a.readyAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.readyAt || b.createdAt || 0).getTime();
        return aTime - bTime;
      });
  }, [tickets, selectedStatus, search, activeStaff]);

  async function verifyStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const staffId = staffIdDraft.trim();

    if (!staffId) {
      setStaffError("Staff ID ထည့်ပါ။");
      staffInputRef.current?.focus();
      return;
    }

    try {
      setStaffLoading(true);
      setStaffError("");
      const token = getAccessToken();
      if (!token) throw new Error("Login token မရှိပါ။ Login ပြန်ဝင်ပါ။");

      const response = await fetchStaffById(staffId, token);
      const root = asRecord(response);
      const data = asRecord(root.data || root.staff || response);
      const resolvedStaffId =
        pickString(data, ["staffId", "staff_id", "id"]) || staffId;
      const staffName =
        pickString(data, ["staffName", "fullName", "name", "username"]) ||
        resolvedStaffId;
      const role = pickString(data, ["role", "staffRole", "staff_role"]) || "RUNNER";
      const allowedRoles = ["RUNNER", "WAITER", "SERVER", "MANAGER", "ADMIN", "CASHIER"];

      if (!allowedRoles.includes(role.toUpperCase())) {
        throw new Error(`${role} role ဖြင့် Serving page အသုံးပြုခွင့်မရှိပါ။`);
      }

      setActiveStaff({ staffId: resolvedStaffId, staffName, role: role.toUpperCase() });
    } catch (caughtError) {
      setActiveStaff(null);
      setStaffError(
        caughtError instanceof Error
          ? caughtError.message
          : "ဒီ Staff ID ကို မတွေ့ပါ။",
      );
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchTickets(options?: { silent?: boolean }) {
    if (!activeStaff) return;

    options?.silent ? setRefreshing(true) : setLoading(true);

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Login token မရှိပါ။ Login ပြန်ဝင်ပါ။");

      const response = await fetch(
        `${API_BASE}/api/restaurant/kitchen/tickets`,
        { method: "GET", headers: authHeaders(), cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Serving orders များကိုယူမရပါ။"),
        );
      }

      setTickets(unwrapList(await response.json().catch(() => [])));
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Serving orders loading error",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function updateItemStatus(
    ticketId: number,
    item: ServingTicketItem,
    nextStatus: "DONE",
  ) {
    if (!activeStaff) return;

    try {
      setUpdatingItemId(item.id);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE}/api/restaurant/kitchen/items/${item.id}/status`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Serving status update မလုပ်နိုင်ပါ။"),
        );
      }

      const responseBody = asRecord(await response.json().catch(() => null));
      const returnedItem = asRecord(responseBody.item || responseBody.data || responseBody);
      const updatedItem: ServingTicketItem = {
        ...item,
        ...(Object.keys(returnedItem).length > 0
          ? (returnedItem as ServingTicketItem)
          : {}),
        status: nextStatus,
        runnerStaffId: activeStaff.staffId,
        runnerStaffName: activeStaff.staffName,
        servedAt: new Date().toISOString(),
      };

      const fullTicket = tickets.find((ticket) => ticket.id === ticketId);
      const updatedItems = (fullTicket?.items || []).map((currentItem) =>
        currentItem.id === item.id ? updatedItem : currentItem,
      );
      const allItemsDone =
        updatedItems.length > 0 &&
        updatedItems.every((currentItem) => {
          const status = String(currentItem.status || "").toUpperCase();
          return status === "DONE" || status === "CANCELLED";
        });

      if (allItemsDone) {
        const ticketResponse = await fetch(
          `${API_BASE}/api/restaurant/kitchen/tickets/${ticketId}/status`,
          {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ status: "DONE" }),
          },
        );

        if (!ticketResponse.ok) {
          throw new Error(
            await getApiErrorMessage(
              ticketResponse,
              "Item ပြီးသွားပေမယ့် Ticket ကို DONE ပြောင်းမရပါ။",
            ),
          );
        }
      }

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                status: allItemsDone ? "DONE" : ticket.status,
                items: ticket.items?.map((currentItem) =>
                  currentItem.id === item.id ? updatedItem : currentItem,
                ),
              }
            : ticket,
        ),
      );

      setSuccessMessage(
        `${item.itemName} ကို Customer ဆီပို့ပြီး DONE လုပ်ထားပါပြီ။`,
      );
      window.setTimeout(() => setSuccessMessage(""), 2400);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Serving status update error";
      await fetchTickets({ silent: true });
      setError(message);
    } finally {
      setUpdatingItemId(null);
    }
  }

  useEffect(() => {
    if (!activeStaff) {
      staffInputRef.current?.focus();
      return;
    }

    void fetchTickets();
    const interval = window.setInterval(() => {
      void fetchTickets({ silent: true });
    }, 5000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchTickets({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // activeStaff identity is the intended subscription boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStaff?.staffId]);

  if (!activeStaff) {
    return (
      <main className={`min-h-screen p-4 sm:p-6 ${darkMode ? "bg-slate-950 text-white" : "bg-[linear-gradient(145deg,var(--brand-soft),var(--background)_45%,color-mix(in_srgb,var(--brand-accent)_8%,var(--background)))] text-slate-950"}`}>
        <BusinessTypeGuard allow="RESTAURANT" />
        <div className="mx-auto max-w-xl pt-8 sm:pt-16">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ${darkMode ? "bg-white/10" : "bg-white ring-1 ring-[var(--brand-border)]"}`}
            >
              <ArrowLeft size={17} /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((current) => !current)}
              className={`grid h-10 w-10 place-items-center rounded-2xl ${darkMode ? "bg-white/10" : "bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white"}`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={verifyStaff}
            className={`rounded-[2rem] border p-5 shadow-xl sm:p-7 ${darkMode ? "border-white/10 bg-white/5" : "border-[var(--brand-border)] bg-white"}`}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-accent)]">
                <Truck size={29} />
              </div>
              <div>
                <h1 className="text-2xl font-black">Serving Staff</h1>
                <p className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Ready ဖြစ်နေသောဟင်းပွဲများကို Customer table ဆီပို့ရန် Staff ID ဖြင့်ဝင်ပါ။
                </p>
              </div>
            </div>

            <label className="mt-6 block text-sm font-black">Staff ID</label>
            <div className={`mt-2 flex items-center gap-2 rounded-2xl px-4 py-3 ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-slate-50 ring-[var(--brand-border)]"}`}>
              <IdCard size={19} className="text-[var(--brand-accent)]" />
              <input
                ref={staffInputRef}
                value={staffIdDraft}
                onChange={(event) => {
                  setStaffIdDraft(event.target.value);
                  setStaffError("");
                }}
                placeholder="Enter or scan Staff ID"
                className="min-w-0 flex-1 bg-transparent text-lg font-black outline-none placeholder:text-slate-400"
                disabled={staffLoading}
              />
            </div>

            {staffError && (
              <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm font-black text-red-500">
                {staffError}
              </div>
            )}

            <button
              type="submit"
              disabled={staffLoading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] px-4 py-4 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_24%,transparent)] transition hover:brightness-95 disabled:opacity-50"
            >
              {staffLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Open Serving Board
            </button>
          </motion.form>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen p-2 pb-8 sm:p-4 lg:p-6 ${darkMode ? "bg-slate-950 text-white" : "bg-[linear-gradient(145deg,var(--brand-soft),var(--background)_45%,color-mix(in_srgb,var(--brand-accent)_8%,var(--background)))] text-slate-950"}`}>
      <BusinessTypeGuard allow="RESTAURANT" />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className={`sticky top-2 z-30 rounded-[1.5rem] border p-3 shadow-lg backdrop-blur-xl sm:p-4 ${darkMode ? "border-white/10 bg-slate-950/95" : "border-white bg-white/95"}`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)] text-[var(--brand-primary)]"}`}
              >
                <ArrowLeft size={16} /> <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/restaurant/kitchen")}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)] text-[var(--brand-primary)]"}`}
              >
                <ChefHat size={16} /> Kitchen
              </button>
              <div className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] px-3 py-2 text-xs font-black text-white">
                <UserCheck size={16} />
                <span className="max-w-[130px] truncate">{activeStaff.staffName}</span>
                <span className="opacity-75">{activeStaff.staffId}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchTickets({ silent: true })}
                disabled={refreshing}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50 ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)] text-[var(--brand-primary)]"}`}
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                className={`grid h-9 w-9 place-items-center rounded-xl ${darkMode ? "bg-white/10" : "bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white"}`}
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => setActiveStaff(null)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-500"
                aria-label="Lock serving board"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)]"}`}>
              <Search size={17} className={darkMode ? "text-slate-400" : "text-[var(--brand-accent)]"} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search table, ticket or menu item..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              />
              {search && <button type="button" onClick={() => setSearch("")}><X size={15} /></button>}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {([
                ["READY", "Ready", PackageCheck],
                ["DONE", "Done", CheckCircle2],
              ] as const).map(([status, label, Icon]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black transition ${
                    selectedStatus === status
                      ? status === "READY"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-950 text-white"
                      : darkMode
                        ? "bg-white/10 text-slate-200"
                        : "bg-white text-slate-700 ring-1 ring-slate-100"
                  }`}
                >
                  <Icon size={15} /> {label}
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">{statusCounts[status]}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-xl"
            >
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <section className={`grid min-h-[420px] place-items-center rounded-[2rem] border ${darkMode ? "border-white/10 bg-white/5" : "border-white bg-white"}`}>
            <div className="text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-emerald-500" />
              <p className="mt-3 text-sm font-black">Serving orders loading...</p>
            </div>
          </section>
        ) : visibleTickets.length === 0 ? (
          <section className={`grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed p-8 text-center ${darkMode ? "border-white/10 bg-white/5" : "border-emerald-200 bg-emerald-50/60"}`}>
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                {selectedStatus === "READY" ? <PackageCheck size={36} /> : <CheckCircle2 size={36} />}
              </div>
              <h2 className="mt-4 text-xl font-black">{selectedStatus === "READY" ? "Ready item မရှိသေးပါ" : "ဒီနေ့ DONE item မရှိသေးပါ"}</h2>
              <p className={`mt-2 text-sm font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Kitchen က READY ပြောင်းလိုက်တာနဲ့ ဒီ screen မှာ ပေါ်လာပါမယ်။
              </p>
            </div>
          </section>
        ) : (
          <section className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {visibleTickets.map((ticket) => {
                const readySince = ticket.readyAt || ticket.items?.[0]?.readyAt || ticket.createdAt;
                const waitingMinutes = elapsedMinutes(readySince);

                return (
                  <motion.article
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className={`overflow-hidden rounded-[1.75rem] border shadow-sm ${
                      selectedStatus === "READY"
                        ? darkMode ? "border-emerald-400/25 bg-emerald-500/10" : "border-emerald-100 bg-emerald-50/60"
                        : darkMode ? "border-white/10 bg-white/5" : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className={`border-b p-4 ${darkMode ? "border-white/10 bg-slate-900/70" : "border-slate-100 bg-white/90"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] px-3 py-1 text-xs font-black text-white">
                              {ticket.ticketNo || `KT-${ticket.id}`}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${waitingMinutes >= 10 ? "bg-red-500 text-white" : "bg-emerald-500/15 text-emerald-600"}`}>
                              {waitingMinutes} min wait
                            </span>
                          </div>
                          <h2 className="mt-3 flex items-center gap-2 text-2xl font-black">
                            {ticket.orderType === "DINE_IN" ? <Table2 size={24} className="text-[var(--brand-accent)]" /> : ticket.orderType === "TAKEAWAY" ? <Coffee size={24} className="text-[var(--brand-accent)]" /> : <Utensils size={24} className="text-[var(--brand-accent)]" />}
                            {ticket.orderType === "DINE_IN" ? `Table ${ticket.tableNo || "-"}` : ticket.orderType || "Order"}
                          </h2>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400">Ready at</p>
                          <p className="mt-1 text-sm font-black text-emerald-500">{formatTime(readySince)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 p-3">
                      {(ticket.items || []).map((item) => {
                        const modifiers = parseModifiers(item.modifiers);
                        const isUpdating = updatingItemId === item.id;

                        return (
                          <div key={item.id} className={`rounded-2xl border p-3 ${darkMode ? "border-white/10 bg-slate-900/75" : "border-slate-100 bg-white"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-sm font-black text-[var(--brand-accent)]">×{item.quantity || 1}</span>
                                  <h3 className="line-clamp-2 font-black">{item.itemName}</h3>
                                </div>
                                {modifiers.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {modifiers.map((modifier) => <span key={modifier} className={`rounded-full px-2 py-1 text-[10px] font-black ${darkMode ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{modifier}</span>)}
                                  </div>
                                )}
                                {item.kitchenNote && <p className="mt-2 rounded-xl bg-amber-500/10 px-2.5 py-2 text-xs font-bold text-amber-600">Note: {item.kitchenNote}</p>}
                                {item.runnerStaffName && <p className="mt-2 text-[11px] font-bold text-slate-400">Runner: {item.runnerStaffName}</p>}
                              </div>
                            </div>

                            {selectedStatus === "READY" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateItemStatus(ticket.id, item, "DONE")
                                }
                                disabled={isUpdating}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                              >
                                {isUpdating ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                                {isUpdating ? "Updating..." : "Customer ဆီပို့ပြီး · DONE"}
                              </button>
                            )}
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
