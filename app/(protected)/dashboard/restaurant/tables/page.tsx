"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Armchair,
  Building2,
  Check,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

type TableStatus = "FREE" | "BUSY" | "RESERVED" | "CLEANING";

type RestaurantTable = {
  id: number;
  tableNo: string;
  tableName?: string | null;
  seats?: number | null;
  status?: TableStatus | string | null;
  floorName?: string | null;
  note?: string | null;
  shopId?: number;
  shopCode?: string;
};

type TableForm = {
  tableNo: string;
  tableName: string;
  seats: string;
  status: TableStatus;
  floorName: string;
  note: string;
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
const FEATURE_DISABLED_MESSAGE =
  "ဒီဆိုင် plan မှာ Restaurant feature မဖွင့်ထားပါ။ Super Admin > Shop Feature Control မှာ Restaurant Feature Gate ကို ON လုပ်ပါ။";

const emptyForm: TableForm = {
  tableNo: "",
  tableName: "",
  seats: "2",
  status: "FREE",
  floorName: "",
  note: "",
};

function getAccessToken() {
  if (typeof window === "undefined") return null;

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
    const record =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
        ? record.error
        : "";

    return message || fallback;
  }

  const text = await res.text().catch(() => "");
  return text || fallback;
}

async function getAuthOrFeatureError(res: Response) {
  if (res.status === 401) return MISSING_TOKEN_MESSAGE;
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

  if (/FEATURE_DISABLED|feature|allowRestaurant|allowTableOrder|plan|subscription|disabled|not enabled|not allowed/i.test(text)) {
    return FEATURE_DISABLED_MESSAGE;
  }

  return "Login token မမှန်ပါ။ ပြန် login ဝင်ပါ။";
}

function statusStyle(status?: string | null) {
  switch (status) {
    case "FREE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "BUSY":
      return "bg-red-50 text-red-700 ring-red-100";
    case "RESERVED":
      return "bg-amber-50 text-amber-700 ring-amber-100";
    case "CLEANING":
      return "bg-sky-50 text-sky-700 ring-sky-100";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-100";
  }
}

export default function RestaurantTablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(
    null
  );
  const [form, setForm] = useState<TableForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredTables = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return tables;

    return tables.filter((table) => {
      return (
        table.tableNo?.toLowerCase().includes(keyword) ||
        table.tableName?.toLowerCase().includes(keyword) ||
        table.floorName?.toLowerCase().includes(keyword) ||
        table.status?.toLowerCase().includes(keyword)
      );
    });
  }, [tables, search]);

  async function fetchTables() {
    setLoading(true);
    setError("");

    try {
      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(`${API_BASE}/api/restaurant/tables`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Restaurant tables များကိုယူမရပါ")
        );
      }

      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Restaurant tables loading error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTables();
  }, []);

  function openCreateDialog() {
    setEditingTable(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(table: RestaurantTable) {
    setEditingTable(table);
    setForm({
      tableNo: table.tableNo || "",
      tableName: table.tableName || "",
      seats: String(table.seats || 2),
      status: (table.status as TableStatus) || "FREE",
      floorName: table.floorName || "",
      note: table.note || "",
    });
    setError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setEditingTable(null);
    setForm(emptyForm);
  }

  function validateForm() {
    if (!form.tableNo.trim()) {
      return "Table No လိုအပ်ပါတယ်။ ဥပမာ T-01";
    }

    const seatsNumber = Number(form.seats);

    if (!Number.isFinite(seatsNumber) || seatsNumber <= 0) {
      return "Seats အရေအတွက် မှန်ကန်ရပါမယ်။";
    }

    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      tableNo: form.tableNo.trim(),
      tableName: form.tableName.trim() || null,
      seats: Number(form.seats),
      status: form.status,
      floorName: form.floorName.trim() || null,
      note: form.note.trim() || null,
    };

    try {
      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const url = editingTable
        ? `${API_BASE}/api/restaurant/tables/${editingTable.id}`
        : `${API_BASE}/api/restaurant/tables`;

      const res = await fetch(url, {
        method: editingTable ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Table save မလုပ်နိုင်ပါ"));
      }

      await fetchTables();
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Table save error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(table: RestaurantTable, status: TableStatus) {
    setError("");

    try {
      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(
        `${API_BASE}/api/restaurant/tables/${table.id}/status`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status }),
        }
      );

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Table status update မလုပ်နိုင်ပါ")
        );
      }

      const updated = await res.json();

      setTables((prev) =>
        prev.map((item) => (item.id === table.id ? updated : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update error");
    }
  }

  async function deleteTable(table: RestaurantTable) {
    const ok = window.confirm(`${table.tableNo} ကို ဖျက်မလား?`);
    if (!ok) return;

    setError("");

    try {
      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(`${API_BASE}/api/restaurant/tables/${table.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Table delete မလုပ်နိုင်ပါ"));
      }

      setTables((prev) => prev.filter((item) => item.id !== table.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                  <Armchair size={26} />
                </div>

                <div>
                  <h1 className="text-2xl font-black text-slate-950 lg:text-3xl">
                    Restaurant Tables
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Table များ create / edit / status change လုပ်ရန်
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={fetchTables}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                <RefreshCcw size={18} />
                Refresh
              </button>

              <button
                onClick={openCreateDialog}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
              >
                <Plus size={18} />
                Create Table
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["FREE", "BUSY", "RESERVED", "CLEANING"] as TableStatus[]).map(
                (status) => {
                  const count = tables.filter(
                    (table) => table.status === status
                  ).length;

                  return (
                    <div
                      key={status}
                      className={`rounded-2xl px-4 py-3 text-sm font-black ring-1 ${statusStyle(
                        status
                      )}`}
                    >
                      <div>{status}</div>
                      <div className="mt-1 text-2xl">{count}</div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="flex w-full items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 lg:w-[360px]">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table no, floor, status..."
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {error}
            </div>
          )}
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="grid min-h-[360px] place-items-center rounded-[2rem] border border-slate-100 bg-white">
              <div className="flex items-center gap-3 text-sm font-black text-slate-500">
                <Loader2 className="animate-spin text-orange-500" size={22} />
                Loading restaurant tables...
              </div>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center rounded-[2rem] border border-dashed border-orange-200 bg-orange-50/60 p-8 text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-orange-500 text-white">
                  <Armchair size={36} />
                </div>
                <h2 className="mt-4 text-xl font-black text-slate-950">
                  Table မရှိသေးပါ
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Restaurant အတွက် table အသစ် create လုပ်ပါ။
                </p>
                <button
                  onClick={openCreateDialog}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25"
                >
                  <Plus size={18} />
                  Create First Table
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredTables.map((table) => (
                <motion.div
                  key={table.id}
                  layout
                  className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-orange-500">
                        <Armchair size={28} />
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-slate-950">
                          {table.tableNo}
                        </h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {table.tableName || "No table name"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusStyle(
                        table.status
                      )}`}
                    >
                      {table.status || "FREE"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                        <Users size={15} />
                        Seats
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-900">
                        {table.seats || 0}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                        <Building2 size={15} />
                        Floor
                      </div>
                      <div className="mt-1 truncate text-lg font-black text-slate-900">
                        {table.floorName || "-"}
                      </div>
                    </div>
                  </div>

                  {table.note && (
                    <p className="mt-3 line-clamp-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
                      {table.note}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(["FREE", "BUSY", "RESERVED", "CLEANING"] as TableStatus[]).map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(table, status)}
                          className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${
                            table.status === status
                              ? "bg-orange-500 text-white ring-orange-500"
                              : "bg-white text-slate-500 ring-slate-100 hover:bg-orange-50 hover:text-orange-600"
                          }`}
                        >
                          {status}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openEditDialog(table)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>

                    <button
                      onClick={() => deleteTable(table)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDialog}
          >
            <motion.form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    {editingTable ? "Edit Table" : "Create Table"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Restaurant table information ဖြည့်ပါ။
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-600">
                    Table No *
                  </span>
                  <input
                    value={form.tableNo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tableNo: e.target.value,
                      }))
                    }
                    placeholder="T-01"
                    className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-600">
                    Table Name
                  </span>
                  <input
                    value={form.tableName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tableName: e.target.value,
                      }))
                    }
                    placeholder="Window Side"
                    className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-600">
                    Seats *
                  </span>
                  <input
                    value={form.seats}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        seats: e.target.value,
                      }))
                    }
                    type="number"
                    min={1}
                    placeholder="2"
                    className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-600">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as TableStatus,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="FREE">FREE</option>
                    <option value="BUSY">BUSY</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="CLEANING">CLEANING</option>
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-black text-slate-600">
                    Floor Name
                  </span>
                  <input
                    value={form.floorName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        floorName: e.target.value,
                      }))
                    }
                    placeholder="Ground Floor / VIP Room"
                    className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-black text-slate-600">
                    Note
                  </span>
                  <textarea
                    value={form.note}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    placeholder="Special note..."
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="rounded-2xl bg-slate-100 px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                  {editingTable ? "Update Table" : "Create Table"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
