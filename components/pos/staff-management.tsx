"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Plus,
  Download,
  Upload,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  LogIn,
  UserCog,
  Sun,
  Moon,
  Monitor,
  Minus,
} from "lucide-react";

/* ================= Theme Toggle (no deps) ================= */
// Saves to localStorage("theme"), supports system preference, SSR-safe.
function useTheme() {
  type Theme = "light" | "dark" | "system";
  const [theme, setTheme] = useState<Theme>("system");

  // read initial theme only on client
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme | null) || "system";
    setTheme(saved);
  }, []);

  // apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && systemDark);
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, setTheme } = useTheme();
  return (
    <div className={"flex items-center gap-1 " + (className || "")}>
      <Button
        type="button"
        size="icon"
        variant={theme === "light" ? "default" : "outline"}
        aria-label="Use light theme"
        onClick={() => setTheme("light")}
        className="rounded-xl"
        title="Light"
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={theme === "system" ? "default" : "outline"}
        aria-label="Use system theme"
        onClick={() => setTheme("system")}
        className="rounded-xl"
        title="System"
      >
        <Monitor className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={theme === "dark" ? "default" : "outline"}
        aria-label="Use dark theme"
        onClick={() => setTheme("dark")}
        className="rounded-xl"
        title="Dark"
      >
        <Moon className="h-4 w-4" />
      </Button>
    </div>
  );
};

/* ================= Types ================= */
type StaffRole = "staff" | "supervise";
type Staff = {
  id: string; // Staff ID (login id)
  name: string;
  role: StaffRole; // staff | supervise
  active: boolean;
  pin?: string; // numeric string (masked on UI)
  notes?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// Product type for CategoryGrid
export type Product = {
  id: string;
  name: string;
  category?: string;
  price: number;
  imageUrl?: string;
};
const jpy = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);

/* ================= Utils ================= */
const nowISO = () => new Date().toISOString();
const maskPin = (p?: string) => (p && p.length ? "•".repeat(p.length) : "—");
const genPin = (len = 4) =>
  Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
const parseCsv = (text: string): Partial<Staff>[] => {
  // CSV header: id,name,role,active,pin,notes
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((ln) => {
    const cols = ln.split(",").map((c) => c.trim());
    const get = (k: string) => {
      const i = head.indexOf(k);
      return i >= 0 ? cols[i] : undefined;
    };
    const role = (get("role") || "staff") as StaffRole;
    const activeStr = (get("active") || "").toLowerCase();
    return {
      id: get("id"),
      name: get("name"),
      role: role === "supervise" ? "supervise" : "staff",
      active:
        activeStr === "true" || activeStr === "yes" || activeStr === "1",
      pin: get("pin"),
      notes: get("notes"),
    };
  });
};

/* ================= Mock DB (replace with API) ================= */
let MOCK_STAFF: Staff[] = [
  {
    id: "ST001",
    name: "Aung Ko",
    role: "supervise",
    active: true,
    pin: "1234",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: "ST005",
    name: "May Thazin",
    role: "staff",
    active: true,
    pin: "5432",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    notes: "Part-time weekend",
  },
  {
    id: "ST009",
    name: "Ko Zaw",
    role: "staff",
    active: false,
    pin: "0000",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
];

async function apiList(params: {
  q?: string;
  role?: "" | StaffRole;
  active?: "" | "active" | "inactive";
}) {
  await new Promise((r) => setTimeout(r, 80));
  let rows = [...MOCK_STAFF].sort((a, b) => a.id.localeCompare(b.id));
  const { q, role, active } = params;
  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter(
      (s) => s.id.toLowerCase().includes(qq) || s.name.toLowerCase().includes(qq)
    );
  }
  if (role) rows = rows.filter((s) => s.role === role);
  if (active === "active") rows = rows.filter((s) => s.active);
  if (active === "inactive") rows = rows.filter((s) => !s.active);
  return rows;
}
async function apiCreate(s: Staff) {
  await new Promise((r) => setTimeout(r, 60));
  MOCK_STAFF = [s, ...MOCK_STAFF];
  return s;
}
async function apiUpdate(s: Staff) {
  await new Promise((r) => setTimeout(r, 60));
  MOCK_STAFF = MOCK_STAFF.map((x) => (x.id === s.id ? s : x));
  return s;
}
async function apiDelete(id: string) {
  await new Promise((r) => setTimeout(r, 60));
  MOCK_STAFF = MOCK_STAFF.filter((x) => x.id !== id);
}

/* ================= Decorative helpers (Aceternity-style neon) ================= */
const NeonBackdrop = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft radial glow (dark only via utility) */}
      <div className="absolute -top-40 left-1/2 h-[520px] w-[960px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,theme(colors.cyan.500/.35),transparent_70%)] blur-2xl hidden dark:block" />

      {/* Grid mask */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]" />
      </div>

      {/* Moving scan beams (dark only) */}
      <motion.div
        aria-hidden
        initial={{ x: "-20%", y: -80, opacity: 0.4 }}
        animate={{ x: "120%", y: 20 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute top-10 h-32 w-[40%] -skew-y-6 rounded-2xl bg-cyan-400/20 blur-2xl hidden dark:block"
      />
      <motion.div
        aria-hidden
        initial={{ x: "100%", y: 340, opacity: 0.35 }}
        animate={{ x: "-30%", y: 260 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-24 h-20 w-[36%] -skew-y-6 rounded-2xl bg-blue-500/20 blur-2xl hidden dark:block"
      />
      {/* subtle animated noise shimmer */}
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-10 mix-blend-overlay [background:radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15),transparent_60%)] hidden dark:block"
        animate={{ opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

const NeonRing: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={
      "pointer-events-none absolute -inset-[1px] rounded-2xl " +
      "bg-[conic-gradient(from_180deg_at_50%_50%,rgba(59,130,246,0.6),rgba(34,211,238,0.6),rgba(59,130,246,0.6))] " +
      "opacity-60 blur-[2px] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] p-[1px] hidden dark:block " +
      (className || "")
    }
  />
);

/* ================= Page ================= */
export default function StaffManagementPage() {
  const router = useRouter();

  // Guard (only supervise can edit)
  const [role, setRole] = useState<StaffRole>("staff");
  const canEdit = role === "supervise";
  useEffect(() => {
    const r = (localStorage.getItem("pos_staff_role") as StaffRole) || "staff";
    setRole(r);
    if (r !== "supervise") toast.message("Read-only: Supervisor required for editing.");
  }, []);

  // Filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | StaffRole>("");
  const [activeFilter, setActiveFilter] = useState<"" | "active" | "inactive">("");

  // Data
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiList({ q, role: roleFilter, active: activeFilter });
      setRows(data);
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []); // initial

  // Create/Edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  function openNew() {
    const s: Staff = {
      id: "",
      name: "",
      role: "staff",
      active: true,
      pin: genPin(),
      notes: "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    setEditing(s);
    setOpen(true);
  }
  function openEdit(s: Staff) {
    setEditing(JSON.parse(JSON.stringify(s)));
    setOpen(true);
  }
  async function save() {
    if (!editing) return;
    if (!canEdit) {
      toast.error("Supervisor only");
      return;
    }
    if (!editing.id.trim() || !editing.name.trim()) {
      toast.error("ID & Name required");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(editing.id)) {
      toast.error("ID must be alphanumeric/underscore/dash");
      return;
    }
    if (!editing.pin || !/^\d{4,6}$/.test(editing.pin)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }

    const exists = MOCK_STAFF.some((x) => x.id === editing.id);
    const payload: Staff = { ...editing, updatedAt: nowISO() };
    if (!exists) {
      await apiCreate(payload);
      toast.success(`Created ${payload.name}`);
    } else {
      await apiUpdate(payload);
      toast.success(`Updated ${payload.name}`);
    }
    setOpen(false);
    refresh();
  }
  async function remove(s: Staff) {
    if (!canEdit) {
      toast.error("Supervisor only");
      return;
    }
    await apiDelete(s.id);
    toast.success("Deleted");
    refresh();
  }
  async function toggleActive(s: Staff) {
    if (!canEdit) return;
    await apiUpdate({ ...s, active: !s.active, updatedAt: nowISO() });
    refresh();
  }
  async function resetPin(s: Staff) {
    if (!canEdit) return;
    const np = genPin();
    await apiUpdate({ ...s, pin: np, updatedAt: nowISO() });
    toast.success(`New PIN for ${s.name}: ${np}`);
    refresh();
  }
  async function setRoleQuick(s: Staff, newRole: StaffRole) {
    if (!canEdit) return;
    await apiUpdate({ ...s, role: newRole, updatedAt: nowISO() });
    toast.success(`Role changed to ${newRole}`);
    refresh();
  }

  // Impersonate (dev/test): set localStorage to this staff
  function impersonate(s: Staff) {
    localStorage.setItem("pos_staff_id", s.id);
    localStorage.setItem("pos_staff_role", s.role);
    toast.success(`Switched to ${s.name} (${s.role})`);
  }

  // CSV Import/Export
  const fileRef = useRef<HTMLInputElement>(null);
  function exportCSV() {
    if (!rows.length) {
      toast.message("Nothing to export");
      return;
    }
    const head = "id,name,role,active,pin,notes,createdAt,updatedAt";
    const lines = rows
      .map((s) =>
        [
          s.id,
          `"${s.name.replace(/"/g, '""')}"`,
          s.role,
          s.active ? "true" : "false",
          s.pin || "",
          `"${(s.notes || "").replace(/"/g, '""')}"`,
          s.createdAt,
          s.updatedAt,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([head + "\n" + lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const list = parseCsv(text);
    if (!list.length) {
      toast.error("No rows parsed");
      return;
    }
    if (!canEdit) {
      toast.error("Supervisor only");
      return;
    }
    let added = 0,
      updated = 0;
    for (const r of list) {
      if (!r.id || !r.name) continue;
      const existing = MOCK_STAFF.find((x) => x.id === r.id);
      const payload: Staff = {
        id: r.id!,
        name: r.name!,
        role: (r.role as StaffRole) || "staff",
        active: r.active ?? true,
        pin: r.pin && /^\d{4,6}$/.test(r.pin) ? r.pin : genPin(),
        notes: r.notes || "",
        createdAt: existing?.createdAt || nowISO(),
        updatedAt: nowISO(),
      };
      if (existing) {
        await apiUpdate(payload);
        updated++;
      } else {
        await apiCreate(payload);
        added++;
      }
    }
    toast.success(`Imported: ${added} added, ${updated} updated`);
    refresh();
    (e.target as HTMLInputElement).value = "";
  }

  return (
    <div className="relative min-h-[100dvh] bg-white text-slate-900 selection:bg-cyan-600/20 selection:text-cyan-900 dark:bg-[#0B0F1A] dark:text-foreground">
      {/* Dark neon aesthetics */}
      <NeonBackdrop />

      <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-8">
        {/* Header / breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/register")}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-cyan-100 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
            >
              <ArrowLeft className="mr-1 h-5 w-5" /> Back
            </Button>

            <Badge
              variant="secondary"
              className="gap-1 border border-cyan-600/30 bg-cyan-600/10 text-cyan-700 shadow-[0_0_20px_rgba(6,182,212,0.15)] dark:text-cyan-200"
            >
              <UserCog className="h-4 w-4" /> Staff Management
            </Badge>
          </div>

          <ThemeToggle />
        </div>

        {/* Neon card wrapper */}
        <div className="relative rounded-2xl p-[1px] ring-1 ring-cyan-600/15 shadow-[0_0_0_1px_rgba(59,130,246,0.10)] dark:ring-cyan-500/20 dark:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_0_40px_rgba(34,211,238,0.2)_inset]">
          <NeonRing />
          <Card className="relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(13,18,33,0.9),rgba(9,13,24,0.9))]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-cyan-100">Staff</CardTitle>
              <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                Create users, manage roles & PINs. {canEdit ? "Supervisor mode." : "Read-only."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="relative md:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-cyan-300/50" />
                  <Input
                    placeholder="Search by ID / Name"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-11 rounded-lg border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 dark:border-cyan-500/20 dark:bg-white/5 dark:text-cyan-50 dark:placeholder:text-cyan-200/40 dark:focus-visible:ring-cyan-400"
                  />
                </div>
                <select
                  className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-slate-900 focus:outline-none dark:border-cyan-500/20 dark:bg-white/5 dark:text-cyan-50"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                >
                  <option value="">All roles</option>
                  <option value="staff">Staff</option>
                  <option value="supervise">Supervisor</option>
                </select>
                <select
                  className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-slate-900 focus:outline-none dark:border-cyan-500/20 dark:bg-white/5 dark:text-cyan-50"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as any)}
                >
                  <option value="">Active: All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={refresh}
                    disabled={loading}
                    className="h-11 px-4 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] dark:hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                  >
                    Search
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={exportCSV}
                    className="h-11 gap-2 border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                  >
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onImportFile}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="h-11 gap-2 border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-cyan-500/30 dark:text-cyan-100 dark:hover:bg-cyan-500/10"
                    disabled={!canEdit}
                    title={canEdit ? "" : "Supervisor only"}
                  >
                    <Upload className="h-4 w-4" /> Import CSV
                  </Button>
                  <Button
                    onClick={openNew}
                    className="h-11 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_8px_30px_rgb(32_186_255_/0.25)] hover:from-cyan-400 hover:to-blue-500"
                    disabled={!canEdit}
                    title={canEdit ? "" : "Supervisor only"}
                  >
                    <Plus className="h-4 w-4" /> New Staff
                  </Button>
                </div>
              </div>

              <Separator className="bg-slate-200 dark:bg-white/10" />

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur dark:bg-black/30">
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">ID</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">Role</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">Active</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">PIN</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-cyan-200">Notes</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <motion.tr
                        key={s.id}
                        className="group hover:bg-slate-50 dark:hover:bg-cyan-500/5"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <TableCell className="font-mono text-sm text-slate-700 dark:text-cyan-200/90">
                          {s.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900 dark:text-cyan-50 text-base">{s.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Created: {new Date(s.createdAt).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={s.role === "supervise" ? "default" : "secondary"}
                              className={
                                "capitalize border border-slate-300 bg-slate-100 text-slate-800 dark:border-cyan-500/30 dark:bg-white/5 dark:text-slate-200 " +
                                (s.role === "supervise" ? "dark:bg-cyan-500/15 dark:text-cyan-100" : "")
                              }
                            >
                              {s.role}
                            </Badge>
                            {canEdit && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRoleQuick(s, "staff")}
                                  disabled={s.role === "staff"}
                                  className="border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-cyan-500/30 dark:text-cyan-100 dark:hover:bg-cyan-500/10"
                                >
                                  Set Staff
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => setRoleQuick(s, "supervise")}
                                  disabled={s.role === "supervise"}
                                  className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-600/80 dark:text-white dark:hover:bg-cyan-500"
                                >
                                  Set Supervisor
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge
                              variant={s.active ? "default" : "secondary"}
                              className={
                                s.active
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30"
                                  : "border border-slate-300 bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300"
                              }
                            >
                              {s.active ? "Active" : "Inactive"}
                            </Badge>
                            <Switch
                              checked={s.active}
                              onCheckedChange={() => toggleActive(s)}
                              disabled={!canEdit}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-slate-900 dark:text-cyan-50 text-sm">
                          {maskPin(s.pin)}
                        </TableCell>
                        <TableCell
                          className="max-w-[260px] truncate text-slate-700 dark:text-slate-200"
                          title={s.notes || ""}
                        >
                          {s.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-cyan-500/30 dark:text-cyan-100 dark:hover:bg-cyan-500/10"
                              onClick={() => openEdit(s)}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1 border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                              onClick={() => resetPin(s)}
                              disabled={!canEdit}
                            >
                              <RefreshCw className="h-4 w-4" /> Reset PIN
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 hover:shadow-[0_0_18px_rgba(239,68,68,0.35)]"
                              onClick={() => remove(s)}
                              disabled={!canEdit}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1 bg-slate-900 text-white hover:bg-slate-800 dark:bg-gradient-to-r dark:from-cyan-600 dark:to-blue-700 dark:hover:from-cyan-500 dark:hover:to-blue-600"
                              onClick={() => impersonate(s)}
                              title="Set as current user"
                            >
                              <LogIn className="h-4 w-4" /> Switch
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          No staff found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl border border-slate-200 bg-white/95 dark:border-cyan-500/20 dark:bg-[#0b0f1a]/95">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-cyan-100 text-lg">
              {editing && MOCK_STAFF.find((x) => x.id === editing.id)
                ? "Edit Staff"
                : "New Staff"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-sm">Staff ID</Label>
                  <Input
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                    disabled={!!MOCK_STAFF.find((x) => x.id === editing.id)}
                    placeholder="e.g. ST010"
                    className="border-slate-300 bg-white text-slate-900 dark:border-cyan-500/30 dark:bg-white/5 dark:text-cyan-50"
                  />
                </div>
                <div>
                  <Label className="text-sm">Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="border-slate-300 bg-white text-slate-900 dark:border-cyan-500/30 dark:bg-white/5 dark:text-cyan-50"
                  />
                </div>
                <div>
                  <Label className="text-sm">Role</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-slate-900 dark:border-cyan-500/30 dark:bg-white/5 dark:text-cyan-50"
                    value={editing.role}
                    onChange={(e) =>
                      setEditing({ ...editing, role: e.target.value as StaffRole })
                    }
                  >
                    <option value="staff">Staff</option>
                    <option value="supervise">Supervisor</option>
                  </select>
                </div>
                <div className="flex items-center justify-between rounded-md border border-slate-200 p-2 dark:border-cyan-500/30">
                  <div>
                    <Label className="text-sm">Active</Label>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Allow login & operations
                    </div>
                  </div>
                  <Switch
                    checked={editing.active}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-sm">PIN (4–6 digits)</Label>
                  <Input
                    value={editing.pin || ""}
                    maxLength={6}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        pin: e.target.value.replace(/\D+/g, "").slice(0, 6),
                      })
                    }
                    className="border-slate-300 bg-white text-slate-900 dark:border-cyan-500/30 dark:bg-white/5 dark:text-cyan-50"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                    onClick={() => setEditing({ ...editing!, pin: genPin() })}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate PIN
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Optional notes…"
                  className="border-slate-300 bg-white text-slate-900 dark:border-cyan-500/30 dark:bg-white/5 dark:text-cyan-50"
                />
              </div>

              <Separator className="bg-slate-200 dark:bg-white/10" />

              <div className="text-xs text-slate-500 dark:text-slate-400">
                <div>Created: {new Date(editing.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(editing.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-cyan-500/30 dark:text-cyan-100 dark:hover:bg-cyan-500/10"
            >
              Close
            </Button>
            <Button
              onClick={save}
              disabled={!canEdit}
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-600 dark:text-white dark:hover:bg-cyan-500"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Category Grid (polished, light/dark) ---------------- */
import { Plus as PlusIcon } from "lucide-react"; // alias to avoid name clash

export function CategoryGrid({
  items,
  onPick,
}: {
  items: Product[];
  onPick: (p: Product) => void;
}) {
  const [qtyById, setQtyById] = useState<Record<string, number>>({});

  const getQty = (id: string) => qtyById[id] ?? 1;
  const setQty = (id: string, v: number) =>
    setQtyById((s) => ({ ...s, [id]: Math.max(1, Math.min(99, v)) }));

  const addMultiple = (p: Product, n: number) => {
    for (let i = 0; i < n; i++) onPick(p);
  };

  const catEmoji = (cat?: string) =>
    cat === "Fruits" ? "🍌" : cat === "Fried" ? "🍤" : cat === "Dairy" ? "🥛" : "🛒";

  if (!items?.length) {
    return (
      <div className="grid place-items-center rounded-xl border border-slate-200 bg-white/60 p-10 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
        No items in this category.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => {
        const q = getQty(p.id);

        return (
          <motion.div
            key={p.id}
            role="button"
            tabIndex={0}
            aria-label={`Add ${p.name}`}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => addMultiple(p, q)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.code === "Space") {
                e.preventDefault();
                addMultiple(p, q);
              }
              if (e.key === "+" || e.key === "=") setQty(p.id, q + 1);
              if (e.key === "-" || e.key === "_") setQty(p.id, q - 1);
            }}
            className={[
              "group relative overflow-hidden rounded-2xl transition-all duration-300 outline-none",
              "border border-slate-200 bg-white/80 shadow-[0_6px_28px_-20px_rgba(2,6,23,0.35)]",
              "backdrop-blur supports-[backdrop-filter]:bg-white/60",
              "dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.06] dark:to-white/[0.03]",
              "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_-18px_rgba(59,130,246,0.35)]",
              "focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              "dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-transparent",
              "p-3",
            ].join(" ")}
          >
            {/* Glow (dark only) */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-1 hidden rounded-3xl opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60 dark:block"
              style={{
                background:
                  "radial-gradient(120px 80px at 20% 0%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(120px 80px at 80% 100%, rgba(99,102,241,0.22), transparent 60%)",
              }}
            />

            {/* Header */}
            <div className="relative z-10 mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg dark:bg-white/10">
                  <span className="leading-none">{catEmoji(p.category)}</span>
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {p.category || "General"} • SKU {p.id}
                  </div>
                </div>
              </div>

              <div className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold tabular-nums text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-cyan-100">
                {jpy(p.price)}
              </div>
            </div>

            {/* Divider */}
            <div className="relative z-10 my-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

            {/* Controls */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="inline-flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQty(p.id, q - 1);
                  }}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  value={q}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setQty(p.id, Number(e.target.value) || 1)}
                  className="h-8 w-12 text-center text-sm"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Quantity"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQty(p.id, q + 1);
                  }}
                  aria-label="Increase quantity"
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>

              <Button
                size="sm"
                className={[
                  "relative overflow-hidden rounded-full px-4",
                  "bg-slate-900 text-white hover:bg-slate-800",
                  "dark:bg-gradient-to-r dark:from-cyan-600 dark:to-blue-700",
                  "dark:hover:from-cyan-500 dark:hover:to-blue-600",
                ].join(" ")}
                onClick={(e) => {
                  e.stopPropagation();
                  addMultiple(p, q);
                }}
              >
                <span className="relative z-10">Add {q > 1 ? `×${q}` : ""}</span>
                <span className="pointer-events-none absolute inset-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

//------သူိ-----
// "use client";

// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";

// import {
//   Card, CardContent, CardDescription, CardHeader, CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";
// import {
//   Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
// } from "@/components/ui/table";
// import {
//   Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
// } from "@/components/ui/dialog";
// import { Switch } from "@/components/ui/switch";
// import {
//   ArrowLeft, Plus, Download, Upload, Pencil, Trash2, ShieldCheck, UserRound, RefreshCw, Search, LogIn, UserCog,
// } from "lucide-react";

// /* ================= Types ================= */
// type StaffRole = "staff" | "supervise";
// type Staff = {
//   id: string;           // Staff ID (login id)
//   name: string;
//   role: StaffRole;      // staff | supervise
//   active: boolean;
//   pin?: string;         // numeric string (masked on UI)
//   notes?: string;
//   createdAt: string;    // ISO
//   updatedAt: string;    // ISO
// };

// /* ================= Utils ================= */
// const nowISO = () => new Date().toISOString();
// const maskPin = (p?: string) => (p && p.length ? "•".repeat(p.length) : "—");
// const genPin = (len=4) => Array.from({length: len}, ()=> Math.floor(Math.random()*10)).join("");
// const parseCsv = (text: string): Partial<Staff>[] => {
//   // CSV header: id,name,role,active,pin,notes
//   const lines = text.trim().split(/\r?\n/);
//   if (!lines.length) return [];
//   const head = lines[0].split(",").map(h => h.trim().toLowerCase());
//   return lines.slice(1).map(ln => {
//     const cols = ln.split(",").map(c => c.trim());
//     const get = (k: string) => {
//       const i = head.indexOf(k); return i>=0 ? cols[i] : undefined;
//     };
//     const role = (get("role") || "staff") as StaffRole;
//     const activeStr = (get("active") || "").toLowerCase();
//     return {
//       id: get("id"),
//       name: get("name"),
//       role: role === "supervise" ? "supervise" : "staff",
//       active: activeStr === "true" || activeStr === "yes" || activeStr === "1",
//       pin: get("pin"),
//       notes: get("notes"),
//     };
//   });
// };

// /* ================= Mock DB (replace with API) ================= */
// let MOCK_STAFF: Staff[] = [
//   { id: "ST001", name: "Aung Ko", role: "supervise", active: true, pin: "1234", createdAt: nowISO(), updatedAt: nowISO() },
//   { id: "ST005", name: "May Thazin", role: "staff", active: true, pin: "5432", createdAt: nowISO(), updatedAt: nowISO(), notes: "Part-time weekend" },
//   { id: "ST009", name: "Ko Zaw", role: "staff", active: false, pin: "0000", createdAt: nowISO(), updatedAt: nowISO() },
// ];

// async function apiList(params: { q?: string; role?: "" | StaffRole; active?: "" | "active" | "inactive"; }) {
//   await new Promise(r => setTimeout(r, 80));
//   let rows = [...MOCK_STAFF].sort((a,b)=> a.id.localeCompare(b.id));
//   const { q, role, active } = params;
//   if (q) {
//     const qq = q.toLowerCase();
//     rows = rows.filter(s => s.id.toLowerCase().includes(qq) || s.name.toLowerCase().includes(qq));
//   }
//   if (role) rows = rows.filter(s => s.role === role);
//   if (active === "active") rows = rows.filter(s => s.active);
//   if (active === "inactive") rows = rows.filter(s => !s.active);
//   return rows;
// }
// async function apiCreate(s: Staff) {
//   await new Promise(r => setTimeout(r, 60));
//   MOCK_STAFF = [s, ...MOCK_STAFF];
//   return s;
// }
// async function apiUpdate(s: Staff) {
//   await new Promise(r => setTimeout(r, 60));
//   MOCK_STAFF = MOCK_STAFF.map(x => x.id === s.id ? s : x);
//   return s;
// }
// async function apiDelete(id: string) {
//   await new Promise(r => setTimeout(r, 60));
//   MOCK_STAFF = MOCK_STAFF.filter(x => x.id !== id);
// }

// /* ================= Page ================= */
// export default function StaffManagementPage() {
//   const router = useRouter();

//   // Guard (only supervise can edit)
//   const [role, setRole] = useState<StaffRole>("staff");
//   const canEdit = role === "supervise";
//   useEffect(() => {
//     const r = (localStorage.getItem("pos_staff_role") as StaffRole) || "staff";
//     setRole(r);
//     if (r !== "supervise") toast.message("Read-only: Supervisor required for editing.");
//   }, []);

//   // Filters
//   const [q, setQ] = useState("");
//   const [roleFilter, setRoleFilter] = useState<"" | StaffRole>("");
//   const [activeFilter, setActiveFilter] = useState<"" | "active" | "inactive">("");

//   // Data
//   const [rows, setRows] = useState<Staff[]>([]);
//   const [loading, setLoading] = useState(false);

//   async function refresh() {
//     setLoading(true);
//     try {
//       const data = await apiList({ q, role: roleFilter, active: activeFilter });
//       setRows(data);
//     } catch {
//       toast.error("Failed to load staff");
//     } finally { setLoading(false); }
//   }
//   useEffect(()=>{ refresh(); }, []); // initial

//   // Create/Edit dialog
//   const [open, setOpen] = useState(false);
//   const [editing, setEditing] = useState<Staff | null>(null);

//   function openNew() {
//     const s: Staff = {
//       id: "",
//       name: "",
//       role: "staff",
//       active: true,
//       pin: genPin(),
//       notes: "",
//       createdAt: nowISO(),
//       updatedAt: nowISO(),
//     };
//     setEditing(s); setOpen(true);
//   }
//   function openEdit(s: Staff) {
//     setEditing(JSON.parse(JSON.stringify(s)));
//     setOpen(true);
//   }
//   async function save() {
//     if (!editing) return;
//     if (!canEdit) { toast.error("Supervisor only"); return; }
//     if (!editing.id.trim() || !editing.name.trim()) { toast.error("ID & Name required"); return; }
//     if (!/^[A-Za-z0-9_-]+$/.test(editing.id)) { toast.error("ID must be alphanumeric/underscore/dash"); return; }
//     if (!editing.pin || !/^\d{4,6}$/.test(editing.pin)) { toast.error("PIN must be 4-6 digits"); return; }

//     const exists = MOCK_STAFF.some(x => x.id === editing.id);
//     const payload: Staff = { ...editing, updatedAt: nowISO() };
//     if (!exists) {
//       await apiCreate(payload);
//       toast.success(`Created ${payload.name}`);
//     } else {
//       await apiUpdate(payload);
//       toast.success(`Updated ${payload.name}`);
//     }
//     setOpen(false);
//     refresh();
//   }
//   async function remove(s: Staff) {
//     if (!canEdit) { toast.error("Supervisor only"); return; }
//     await apiDelete(s.id);
//     toast.success("Deleted");
//     refresh();
//   }
//   async function toggleActive(s: Staff) {
//     if (!canEdit) return;
//     await apiUpdate({ ...s, active: !s.active, updatedAt: nowISO() });
//     refresh();
//   }
//   async function resetPin(s: Staff) {
//     if (!canEdit) return;
//     const np = genPin();
//     await apiUpdate({ ...s, pin: np, updatedAt: nowISO() });
//     toast.success(`New PIN for ${s.name}: ${np}`);
//     refresh();
//   }
//   async function setRoleQuick(s: Staff, newRole: StaffRole) {
//     if (!canEdit) return;
//     await apiUpdate({ ...s, role: newRole, updatedAt: nowISO() });
//     toast.success(`Role changed to ${newRole}`);
//     refresh();
//   }

//   // Impersonate (dev/test): set localStorage to this staff
//   function impersonate(s: Staff) {
//     localStorage.setItem("pos_staff_id", s.id);
//     localStorage.setItem("pos_staff_role", s.role);
//     toast.success(`Switched to ${s.name} (${s.role})`);
//   }

//   // CSV Import/Export
//   const fileRef = useRef<HTMLInputElement>(null);
//   function exportCSV() {
//     if (!rows.length) { toast.message("Nothing to export"); return; }
//     const head = "id,name,role,active,pin,notes,createdAt,updatedAt";
//     const lines = rows.map(s =>
//       [s.id, `"${s.name.replace(/"/g,'""')}"`, s.role, s.active ? "true" : "false", s.pin || "", `"${(s.notes||"").replace(/"/g,'""')}"`, s.createdAt, s.updatedAt].join(",")
//     ).join("\n");
//     const blob = new Blob([head+"\n"+lines], { type: "text/plain" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a"); a.href=url; a.download="staff.csv";
//     document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
//   }
//   async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
//     const f = e.target.files?.[0]; if (!f) return;
//     const text = await f.text();
//     const list = parseCsv(text);
//     if (!list.length) { toast.error("No rows parsed"); return; }
//     if (!canEdit) { toast.error("Supervisor only"); return; }
//     let added=0, updated=0;
//     for (const r of list) {
//       if (!r.id || !r.name) continue;
//       const existing = MOCK_STAFF.find(x => x.id === r.id);
//       const payload: Staff = {
//         id: r.id!,
//         name: r.name!,
//         role: (r.role as StaffRole) || "staff",
//         active: r.active ?? true,
//         pin: r.pin && /^\d{4,6}$/.test(r.pin) ? r.pin : genPin(),
//         notes: r.notes || "",
//         createdAt: existing?.createdAt || nowISO(),
//         updatedAt: nowISO(),
//       };
//       if (existing) { await apiUpdate(payload); updated++; }
//       else { await apiCreate(payload); added++; }
//     }
//     toast.success(`Imported: ${added} added, ${updated} updated`);
//     refresh();
//     (e.target as HTMLInputElement).value = "";
//   }

//   return (
//     <div className="min-h-[100dvh] bg-background text-foreground">
//       <div className="mx-auto max-w-7xl px-4 md:px-6 py-6">
//         <div className="flex items-center gap-2 mb-4">
//           <Button variant="ghost" size="sm" onClick={()=>router.push("/pos")}>
//             <ArrowLeft className="h-4 w-4 mr-1"/> Back
//           </Button>
//           <Badge variant="secondary" className="gap-1"><UserCog className="h-3 w-3"/> Staff Management</Badge>
//         </div>

//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base">Staff</CardTitle>
//             <CardDescription className="text-xs">
//               Create users, manage roles & PINs. {canEdit ? "Supervisor mode." : "Read-only."}
//             </CardDescription>
//           </CardHeader>
//           <CardContent className="space-y-3">
//             {/* Filters */}
//             <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
//               <div className="relative md:col-span-2">
//                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
//                 <Input placeholder="Search by ID / Name" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 h-10"/>
//               </div>
//               <select className="h-10 rounded-md border bg-background px-2" value={roleFilter} onChange={e=>setRoleFilter(e.target.value as any)}>
//                 <option value="">All roles</option>
//                 <option value="staff">Staff</option>
//                 <option value="supervise">Supervisor</option>
//               </select>
//               <select className="h-10 rounded-md border bg-background px-2" value={activeFilter} onChange={e=>setActiveFilter(e.target.value as any)}>
//                 <option value="">Active: All</option>
//                 <option value="active">Active</option>
//                 <option value="inactive">Inactive</option>
//               </select>
//               <div className="flex items-center gap-2 md:col-span-2">
//                 <Button onClick={refresh} disabled={loading}>Search</Button>
//                 <Button variant="secondary" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4"/> Export</Button>
//                 <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImportFile}/>
//                 <Button variant="outline" onClick={()=>fileRef.current?.click()} className="gap-2" disabled={!canEdit} title={canEdit ? "" : "Supervisor only"}>
//                   <Upload className="h-4 w-4"/> Import CSV
//                 </Button>
//                 <Button onClick={openNew} className="gap-2" disabled={!canEdit} title={canEdit ? "" : "Supervisor only"}>
//                   <Plus className="h-4 w-4"/> New Staff
//                 </Button>
//               </div>
//             </div>

//             <Separator/>

//             {/* Table */}
//             <div className="rounded-xl border border-white/10 overflow-hidden">
//               <Table>
//                 <TableHeader className="bg-background/80 backdrop-blur sticky top-0 z-10">
//                   <TableRow>
//                     <TableHead>ID</TableHead>
//                     <TableHead>Name</TableHead>
//                     <TableHead>Role</TableHead>
//                     <TableHead className="text-center">Active</TableHead>
//                     <TableHead className="text-center">PIN</TableHead>
//                     <TableHead>Notes</TableHead>
//                     <TableHead className="w-0"/>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {rows.map(s => (
//                     <TableRow key={s.id} className="hover:bg-white/[0.03]">
//                       <TableCell className="font-mono text-xs">{s.id}</TableCell>
//                       <TableCell>
//                         <div className="font-medium">{s.name}</div>
//                         <div className="text-xs text-slate-400">Created: {new Date(s.createdAt).toLocaleString()}</div>
//                       </TableCell>
//                       <TableCell>
//                         <div className="flex items-center gap-2">
//                           <Badge variant={s.role==="supervise" ? "default" : "secondary"} className="capitalize">{s.role}</Badge>
//                           {canEdit && (
//                             <>
//                               <Button size="sm" variant="outline" onClick={()=>setRoleQuick(s,"staff")} disabled={s.role==="staff"}>Set Staff</Button>
//                               <Button size="sm" onClick={()=>setRoleQuick(s,"supervise")} disabled={s.role==="supervise"}>Set Supervisor</Button>
//                             </>
//                           )}
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-center">
//                         <div className="flex items-center justify-center gap-2">
//                           <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Active" : "Inactive"}</Badge>
//                           <Switch checked={s.active} onCheckedChange={()=>toggleActive(s)} disabled={!canEdit}/>
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-center">{maskPin(s.pin)}</TableCell>
//                       <TableCell className="truncate max-w-[260px]" title={s.notes || ""}>{s.notes || "—"}</TableCell>
//                       <TableCell className="text-right">
//                         <div className="flex justify-end gap-2">
//                           <Button size="sm" variant="outline" className="gap-1" onClick={()=>openEdit(s)}><Pencil className="h-4 w-4"/> Edit</Button>
//                           <Button size="sm" variant="secondary" className="gap-1" onClick={()=>resetPin(s)} disabled={!canEdit}><RefreshCw className="h-4 w-4"/> Reset PIN</Button>
//                           <Button size="sm" variant="destructive" className="gap-1" onClick={()=>remove(s)} disabled={!canEdit}><Trash2 className="h-4 w-4"/> Delete</Button>
//                           <Button size="sm" className="gap-1" onClick={()=>impersonate(s)} title="Set as current user">
//                             <LogIn className="h-4 w-4"/> Switch
//                           </Button>
//                         </div>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                   {!rows.length && (
//                     <TableRow>
//                       <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-8">
//                         No staff found.
//                       </TableCell>
//                     </TableRow>
//                   )}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Create / Edit Dialog */}
//       <Dialog open={open} onOpenChange={setOpen}>
//         <DialogContent className="sm:max-w-2xl">
//           <DialogHeader>
//             <DialogTitle>{editing && MOCK_STAFF.find(x=>x.id===editing.id) ? "Edit Staff" : "New Staff"}</DialogTitle>
//           </DialogHeader>

//           {editing && (
//             <div className="space-y-4">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//                 <div>
//                   <Label>Staff ID</Label>
//                   <Input value={editing.id} onChange={e=>setEditing({...editing, id: e.target.value})}
//                          disabled={!!MOCK_STAFF.find(x=>x.id===editing.id)} placeholder="e.g. ST010"/>
//                 </div>
//                 <div>
//                   <Label>Name</Label>
//                   <Input value={editing.name} onChange={e=>setEditing({...editing, name: e.target.value})}/>
//                 </div>
//                 <div>
//                   <Label>Role</Label>
//                   <select className="h-10 rounded-md border bg-background px-2 w-full"
//                           value={editing.role} onChange={e=>setEditing({...editing, role: e.target.value as StaffRole})}>
//                     <option value="staff">Staff</option>
//                     <option value="supervise">Supervisor</option>
//                   </select>
//                 </div>
//                 <div className="flex items-center justify-between border rounded-md p-2">
//                   <div>
//                     <Label className="text-sm">Active</Label>
//                     <div className="text-xs text-slate-400">Allow login & operations</div>
//                   </div>
//                   <Switch checked={editing.active} onCheckedChange={(v)=>setEditing({...editing, active: v})}/>
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//                 <div>
//                   <Label>PIN (4–6 digits)</Label>
//                   <Input value={editing.pin || ""} maxLength={6}
//                          onChange={e=>setEditing({...editing, pin: e.target.value.replace(/\D+/g,"").slice(0,6)})}/>
//                 </div>
//                 <div className="flex items-end">
//                   <Button type="button" variant="secondary" className="w-full" onClick={()=>setEditing({...editing!, pin: genPin()})}>
//                     <RefreshCw className="h-4 w-4 mr-2"/> Generate PIN
//                   </Button>
//                 </div>
//               </div>

//               <div>
//                 <Label>Notes</Label>
//                 <Textarea value={editing.notes || ""} onChange={e=>setEditing({...editing, notes: e.target.value})} placeholder="Optional notes…"/>
//               </div>

//               <Separator/>

//               <div className="text-xs text-slate-400">
//                 <div>Created: {new Date(editing.createdAt).toLocaleString()}</div>
//                 <div>Updated: {new Date(editing.updatedAt).toLocaleString()}</div>
//               </div>
//             </div>
//           )}

//           <DialogFooter>
//             <Button variant="outline" onClick={()=>setOpen(false)}>Close</Button>
//             <Button onClick={save} disabled={!canEdit}>Save</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }
