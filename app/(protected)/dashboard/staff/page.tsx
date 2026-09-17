"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Sparkles,
  Users,
  UserCheck,
  Clock,
  Star,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Shield,
  Store,
  Calendar,
  Mail,
  MapPin,
  Activity,
  Key,
  Crown,
  Phone,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  ArrowDownAZ,
  ArrowUpZA,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight as PageChevronRight,
  Cake,
  IdCard,
  Wallet,
  FileText,
  Briefcase,
  X,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  LayoutGrid,
  List,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

const STORAGE_KEY = "staff-simple-mode-v4";
const PAGE_SIZE_OPTIONS = [6, 9, 12, 15, 24] as const;

type Role = "admin" | "manager" | "cashier" | "stock";
type Status = "active" | "on_leave" | "inactive";
type ViewMode = "grid" | "compact";
type SortMode =
  | "name_asc"
  | "name_desc"
  | "rating_desc"
  | "sales_desc"
  | "joined_desc";

type TaskStatus = "Pending" | "In Progress" | "Done";
type TaskPriority = "High" | "Medium" | "Low";

type StaffTask = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: TaskStatus;
  priority: TaskPriority;
};

type StaffMember = {
  id: string;
  rawId: number | string;
  dbId: number | string;
  name: string;
  role: Role;
  branch: string;
  phone: string;
  email: string;
  status: Status;
  joined: string;
  sales: number;
  orders: number;
  rating: number;
  shifts: number;
  trend: number;
  img: string;
  address?: string;
  nrc?: string;
  salary?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  note?: string;
  staffId?: number | string;
  dateOfBirth?: string;
  tasks?: StaffTask[];
};

const roleCfg: Record<
  Role,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    emoji: string;
  }
> = {
  admin: { label: "Admin", icon: Crown, color: "#2563eb", emoji: "👑" },
  manager: { label: "Manager", icon: Shield, color: "#7c3aed", emoji: "🛡️" },
  cashier: { label: "Cashier", icon: Key, color: "#0891b2", emoji: "🔑" },
  stock: { label: "Stock", icon: Store, color: "#059669", emoji: "📦" },
};

const statusCfg: Record<
  Status,
  {
    label: string;
    color: string;
    emoji: string;
  }
> = {
  active: { label: "Active", color: "#10b981", emoji: "🟢" },
  on_leave: { label: "On Leave", color: "#f59e0b", emoji: "🟡" },
  inactive: { label: "Inactive", color: "#94a3b8", emoji: "⚪" },
};

const ROLES = ["All", "Admin", "Manager", "Cashier", "Stock"];
const STATUSES = ["All", "Active", "On Leave", "Inactive"];

function getStaffPageToken(session: any) {
  if (session?.accessToken) return String(session.accessToken);

  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("super_admin_token") ||
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

function money(n: number) {
  return n > 0 ? `¥${Number(n).toLocaleString()}` : "—";
}

function shortMoney(n: number) {
  return n > 0 ? `¥${(Number(n) / 1000).toFixed(0)}k` : "—";
}

function normalizeRole(r: unknown): Role {
  const v = String(r || "cashier").toLowerCase();
  return (["admin", "manager", "cashier", "stock"] as Role[]).includes(
    v as Role,
  )
    ? (v as Role)
    : "cashier";
}

function normalizeStatus(s: unknown): Status {
  const v = String(s || "active")
    .toLowerCase()
    .replace(/\s+/g, "_");

  return (["active", "on_leave", "inactive"] as Status[]).includes(v as Status)
    ? (v as Status)
    : "active";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return value;
}

function makeMockTasks(name: string): StaffTask[] {
  const prefix = name.slice(0, 2).toUpperCase() || "ST";

  return [
    {
      id: `TSK-${prefix}-01`,
      title: "Check opening balance",
      description: "Verify cashier opening amount before shift starts.",
      dueDate: "09:00 AM",
      status: "Done",
      priority: "High",
    },
    {
      id: `TSK-${prefix}-02`,
      title: "Restock front shelf",
      description: "Refill fast-moving drinks and snack items.",
      dueDate: "11:30 AM",
      status: "In Progress",
      priority: "Medium",
    },
    {
      id: `TSK-${prefix}-03`,
      title: "Submit daily sales note",
      description: "Prepare closing summary for manager review.",
      dueDate: "05:00 PM",
      status: "Pending",
      priority: "High",
    },
  ];
}

function getTaskStats(tasks: StaffTask[] = []) {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "Pending").length,
    progress: tasks.filter((t) => t.status === "In Progress").length,
    done: tasks.filter((t) => t.status === "Done").length,
  };
}

function mapApiStaffToUi(staff: any): StaffMember {
  const name = staff.fullName || staff.full_name || staff.name || "Unknown";

  const imageUrl =
    staff.imageUrl || staff.image_url || staff.imagePath || staff.image_path;

  const img =
    imageUrl && String(imageUrl).startsWith("http")
      ? String(imageUrl)
      : imageUrl
        ? `${API_BASE_URL}${imageUrl}`
        : `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(
            name,
          )}&backgroundColor=b6e3f4`;

  const staffId = staff.staffId ?? staff.staff_id ?? "";
  const dbId = staff.id ?? staff.staffId ?? staff.staff_id ?? name;

  return {
    id: `ST-${String(staffId || dbId).padStart(3, "0")}`,
    rawId: dbId,
    dbId,
    name,
    role: normalizeRole(staff.role),
    branch: staff.branch || "Main Branch",
    phone: staff.phone || "—",
    email: staff.email || "—",
    status: normalizeStatus(staff.status),
    joined:
      staff.startDate ||
      staff.start_date ||
      staff.createdAt ||
      staff.created_at ||
      "—",
    sales: Number(staff.sales || 0),
    orders: Number(staff.orders || 0),
    rating: Number(staff.rating || 4.0),
    shifts: Number(staff.shifts || 0),
    trend: Number(staff.trend || 0),
    img,
    address: staff.address || "",
    nrc: staff.nrc || "",
    salary: staff.salary != null ? Number(staff.salary) : 0,
    emergencyContact: staff.emergencyContact || staff.emergency_contact || "",
    emergencyPhone: staff.emergencyPhone || staff.emergency_phone || "",
    note: staff.note || "",
    staffId,
    dateOfBirth: staff.dateOfBirth || staff.date_of_birth || "",
    tasks:
      Array.isArray(staff.tasks) && staff.tasks.length > 0
        ? staff.tasks
        : [],
  };
}

function sortStaff(items: StaffMember[], mode: SortMode) {
  const copy = [...items];

  switch (mode) {
    case "name_asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "rating_desc":
      return copy.sort((a, b) => b.rating - a.rating);
    case "sales_desc":
      return copy.sort((a, b) => b.sales - a.sales);
    case "joined_desc":
      return copy.sort((a, b) =>
        String(b.joined).localeCompare(String(a.joined)),
      );
    default:
      return copy;
  }
}

function buildPageNumbers(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 4) return [1, 2, 3, 4, 5, "...", total] as const;

  if (current >= total - 3) {
    return [
      1,
      "...",
      total - 4,
      total - 3,
      total - 2,
      total - 1,
      total,
    ] as const;
  }

  return [1, "...", current - 1, current, current + 1, "...", total] as const;
}

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;700;800;900&display=swap');

      * {
        font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "SF Pro Display",
          "Inter", "Segoe UI", "Noto Sans Myanmar", "Padauk", sans-serif;
      }

      .serif {
        font-family: 'DM Serif Display', Georgia, serif !important;
      }

      ::placeholder {
        color: rgba(122,85,32,0.75);
        opacity: 1;
      }
    `}</style>
  );
}

function glassCard(
  night: boolean,
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    background: night ? "rgba(41,55,80,0.92)" : "rgba(255,255,255,0.96)",
    border: `1px solid ${
      night ? "rgba(255,255,255,0.10)" : "rgba(226,232,240,1)"
    }`,
    boxShadow: night
      ? "0 14px 34px rgba(15,23,42,0.18)"
      : "0 8px 24px rgba(15,23,42,0.06)",
    backdropFilter: "blur(16px)",
    ...extra,
  };
}

function premiumInputStyle(night: boolean): React.CSSProperties {
  return {
    background: night ? "rgba(51,67,95,0.96)" : "rgba(248,250,252,1)",
    border: `1.5px solid ${
      night ? "rgba(255,255,255,0.10)" : "rgba(226,232,240,1)"
    }`,
    color: night ? "#f8fafc" : "#0f172a",
    boxShadow: "none",
  };
}

function sectionTitle(night: boolean) {
  return cn(
    "text-[10px] uppercase tracking-[0.24em] font-bold",
    night ? "text-blue-300" : "text-blue-600",
  );
}

function LanternMark({
  size = 48,
  glow = false,
}: {
  size?: number;
  glow?: boolean;
}) {
  const h = size * 1.5;
  const isNight = glow;

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 32 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="lanternCoreNight" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.95" />
          <stop offset="28%" stopColor="#fbbf24" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>

        <linearGradient
          id="lanternBodyDay"
          x1="6"
          y1="11"
          x2="26"
          y2="37"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fffaf1" />
          <stop offset="45%" stopColor="#f5e7cf" />
          <stop offset="100%" stopColor="#ecd5ae" />
        </linearGradient>

        <linearGradient
          id="lanternMetalDay"
          x1="8"
          y1="6"
          x2="24"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#c58a3c" />
          <stop offset="50%" stopColor="#a96b28" />
          <stop offset="100%" stopColor="#8a551d" />
        </linearGradient>
      </defs>

      <line
        x1="16"
        y1="0"
        x2="16"
        y2="6"
        stroke={isNight ? "#d6ae67" : "#9d6a2b"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="8"
        y="6"
        width="16"
        height="5"
        rx="2"
        fill={isNight ? "#b07840" : "url(#lanternMetalDay)"}
        stroke={isNight ? "#d4a060" : "#7b4a18"}
        strokeWidth="0.8"
      />
      <rect
        x="6"
        y="11"
        width="20"
        height="26"
        rx="3"
        fill={isNight ? "#0e0908" : "url(#lanternBodyDay)"}
        stroke={isNight ? "#9d6220" : "#a66b27"}
        strokeWidth="1"
      />

      {isNight && (
        <rect
          x="6"
          y="11"
          width="20"
          height="26"
          rx="3"
          fill="url(#lanternCoreNight)"
        />
      )}

      {[11, 16, 21].map((x) => (
        <line
          key={x}
          x1={x}
          y1="11"
          x2={x}
          y2="37"
          stroke={isNight ? "#6b3e10" : "#b47b34"}
          strokeWidth="1"
          opacity="0.95"
        />
      ))}

      {isNight && (
        <g>
          <motion.ellipse
            cx="16"
            cy="26"
            rx="4"
            ry="6"
            fill="#f59e0b"
            opacity="0.68"
            animate={{
              ry: [6, 7.1, 5.2, 6.7, 6],
              cx: [16, 15.5, 16.4, 15.8, 16],
            }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.ellipse
            cx="16"
            cy="27"
            rx="2.5"
            ry="4.2"
            fill="#fde68a"
            animate={{ ry: [4.2, 5, 3.6, 4.6, 4.2] }}
            transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>
      )}

      <rect
        x="8"
        y="37"
        width="16"
        height="5"
        rx="2"
        fill={isNight ? "#b07840" : "url(#lanternMetalDay)"}
        stroke={isNight ? "#d4a060" : "#7b4a18"}
        strokeWidth="0.8"
      />
      <line
        x1="16"
        y1="42"
        x2="16"
        y2="47"
        stroke={isNight ? "#d4804a" : "#8f5b24"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="47" r="1.5" fill={isNight ? "#d4804a" : "#8f5b24"} />
    </svg>
  );
}

function LanternToggle({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ y: -2, scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      className="relative flex flex-col items-center focus:outline-none"
      style={{ width: 58 }}
      aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
    >
      <AnimatePresence>
        {dark ? (
          <motion.div
            key="night-glow-big"
            initial={{ opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.35 }}
            transition={{ duration: 0.45 }}
            className="pointer-events-none absolute"
            style={{
              width: 76,
              height: 76,
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, rgba(251,191,36,0.52) 0%, rgba(245,158,11,0.18) 52%, transparent 76%)",
              filter: "blur(9px)",
            }}
          />
        ) : (
          <motion.div
            key="day-halo"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute"
            style={{
              width: 70,
              height: 70,
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, rgba(255,233,180,0.55) 0%, rgba(245,190,95,0.18) 55%, transparent 78%)",
              filter: "blur(10px)",
            }}
          />
        )}
      </AnimatePresence>

      <LanternMark size={34} glow={dark} />

      <span
        style={{
          marginTop: 5,
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: dark ? "#2563eb" : "#64748b",
        }}
      >
        {dark ? "NIGHT" : "DAY"}
      </span>
    </motion.button>
  );
}

function NightParticles() {
  const particles = React.useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        x: `${(i * 31 + 7) % 100}%`,
        y: `${(i * 47 + 13) % 100}%`,
        size: 1.5 + (i % 3) * 1,
        dur: 2.5 + (i % 4) * 0.7,
        delay: (i * 0.21) % 4,
        color: ["#e0e7ff", "#fef3c7", "#ddd6fe", "#ffffff", "#fde68a"][i % 5],
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
          }}
          animate={{ opacity: [0.08, 0.9, 0.08], scale: [0.7, 1.4, 0.7] }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function DayParticles() {
  const motes = React.useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        x: `${(i * 23 + 8) % 96}%`,
        y: `${(i * 41 + 11) % 90}%`,
        size: 60 + (i % 4) * 30,
        dur: 6 + (i % 3) * 2,
        delay: i * 0.5,
        color: [
          "rgba(37,99,235,0.06)",
          "rgba(245,158,11,0.05)",
          "rgba(251,191,36,0.04)",
          "rgba(210,160,60,0.06)",
        ][i % 4],
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {motes.map((m) => (
        <motion.div
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: m.x,
            top: m.y,
            width: m.size,
            height: m.size,
            background: m.color,
            filter: "blur(24px)",
          }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
          transition={{
            duration: m.dur,
            repeat: Infinity,
            delay: m.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function Avatar({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center font-bold text-white",
          className,
        )}
        style={{ background: "linear-gradient(135deg,#1d4ed8,#60a5fa)" }}
      >
        {initials || "ST"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-400/40",
          )}
        />
      ))}

      <span className="ml-1 text-[11px] font-bold text-amber-500">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function MiniBadge({
  text,
  night,
  color,
}: {
  text: string;
  night: boolean;
  color: string;
}) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
      style={{
        background: night ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        border: `1px solid ${color}55`,
        color,
      }}
    >
      {text}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  night,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  color: string;
  night: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-[22px] p-4"
      style={glassCard(night)}
    >
      <div
        className="absolute left-0 right-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: `${color}22`,
            border: `1px solid ${color}44`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>

        <span className={sectionTitle(night)}>{label}</span>
      </div>

      <div
        className={cn(
          "text-3xl font-bold leading-none",
          night ? "text-white" : "text-slate-950",
        )}
      >
        {Number(value || 0).toLocaleString()}
      </div>

      <div
        className="mt-2 text-[11px]"
        style={{ color: night ? "#94a3b8" : "#64748b" }}
      >
        {sub}
      </div>
    </motion.div>
  );
}

function PremiumPill({
  children,
  active,
  onClick,
  color,
  night,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color: string;
  night: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="rounded-full px-3.5 py-2 text-[11px] font-bold"
      style={{
        background: active
          ? color
          : night
            ? "rgba(51,67,95,0.96)"
            : "rgba(248,250,252,1)",
        color: active ? "#ffffff" : night ? "#e2e8f0" : "#475569",
        border: `1px solid ${
          active
            ? color
            : night
              ? "rgba(255,255,255,0.10)"
              : "rgba(226,232,240,1)"
        }`,
        boxShadow: active ? "0 8px 20px rgba(37,99,235,0.18)" : "none",
      }}
    >
      {children}
    </motion.button>
  );
}

function StaffCard({
  member,
  selected,
  onSelect,
  night,
}: {
  member: StaffMember;
  selected?: boolean;
  onSelect?: (m: StaffMember) => void;
  night: boolean;
}) {
  const role = roleCfg[member.role];
  const status = statusCfg[member.status];
  const taskStats = getTaskStats(member.tasks || []);

  return (
    <motion.article
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect?.(member)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(member);
        }
      }}
      tabIndex={0}
      aria-label={`Select ${member.name}`}
      className="w-full cursor-pointer overflow-hidden rounded-[24px] text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      style={{
        ...glassCard(night),
        border: `1px solid ${
          selected
            ? "rgba(59,130,246,0.65)"
            : night
              ? "rgba(255,255,255,0.10)"
              : "rgba(226,232,240,1)"
        }`,
      }}
    >
      <div className="relative p-5">
        <div
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--color-blue-600), transparent)",
          }}
        />

        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="h-14 w-14 overflow-hidden rounded-full p-[2px]"
                style={{
                  background: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)",
                }}
              >
                <Avatar
                  src={member.img}
                  name={member.name}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>

              <span
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2"
                style={{
                  background: status.color,
                  borderColor: night ? "#293750" : "white",
                }}
              />
            </div>

            <div>
              <div
                className={cn(
                  "text-lg font-bold leading-tight",
                  night ? "text-white" : "text-slate-950",
                )}
              >
                {member.name}
              </div>

              <div
                className="mt-1 text-[11px]"
                style={{ color: night ? "#94a3b8" : "#64748b" }}
              >
                {member.id} · {member.branch}
              </div>
            </div>
          </div>

          <MiniBadge text={status.label} night={night} color={status.color} />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MiniBadge
            text={`${role.emoji} ${role.label}`}
            night={night}
            color={role.color}
          />
          <MiniBadge
            text={`Staff ID ${member.staffId || "—"}`}
            night={night}
            color="#60a5fa"
          />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { l: "Sales", v: shortMoney(member.sales) },
            { l: "Orders", v: member.orders > 0 ? String(member.orders) : "—" },
            { l: "Shifts", v: String(member.shifts) },
          ].map((item) => (
            <div
              key={item.l}
              className="rounded-[16px] p-3 text-center"
              style={{
                background: night
                  ? "rgba(51,67,95,0.90)"
                  : "rgba(248,250,252,1)",
                border: `1px solid ${
                  night ? "rgba(255,255,255,0.08)" : "rgba(226,232,240,1)"
                }`,
              }}
            >
              <div
                className="text-[9px] uppercase tracking-[0.18em]"
                style={{ color: night ? "#94a3b8" : "#64748b" }}
              >
                {item.l}
              </div>

              <div
                className={cn(
                  "mt-1 text-[14px] font-bold",
                  night ? "text-white" : "text-slate-950",
                )}
              >
                {item.v}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <RatingStars rating={member.rating} />

          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-bold",
              member.trend > 0
                ? "text-emerald-500"
                : member.trend < 0
                  ? "text-rose-400"
                  : "text-gray-400",
            )}
          >
            {member.trend > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : member.trend < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}

            {member.trend !== 0
              ? `${member.trend > 0 ? "+" : ""}${member.trend}%`
              : "Stable"}
          </span>
        </div>

        <div
          className="rounded-[18px] p-3"
          style={{
            background: night ? "rgba(51,67,95,0.82)" : "rgba(248,250,252,1)",
            border: `1px solid ${
              night ? "rgba(255,255,255,0.08)" : "rgba(226,232,240,1)"
            }`,
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className={sectionTitle(night)}>Tasks</span>
            <span
              className="text-[11px]"
              style={{ color: night ? "#94a3b8" : "#64748b" }}
            >
              {taskStats.total} total
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniBadge
              text={`⏳ ${taskStats.pending}`}
              night={night}
              color="#f59e0b"
            />
            <MiniBadge
              text={`⚡ ${taskStats.progress}`}
              night={night}
              color="#60a5fa"
            />
            <MiniBadge
              text={`✅ ${taskStats.done}`}
              night={night}
              color="#10b981"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div
            className="text-[11px]"
            style={{ color: night ? "#94a3b8" : "#64748b" }}
          >
            {member.salary
              ? `¥${Number(member.salary).toLocaleString()}`
              : "No salary"}
          </div>

          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect?.(member); }} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold" style={premiumInputStyle(night)}>
            <Eye className="h-4 w-4" /> View Details
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function CompactCard({
  member,
  selected,
  onSelect,
  night,
}: {
  member: StaffMember;
  selected?: boolean;
  onSelect?: (m: StaffMember) => void;
  night: boolean;
}) {
  const role = roleCfg[member.role];
  const status = statusCfg[member.status];

  return (
    <motion.button
      whileHover={{ x: 3, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onSelect?.(member)}
      className="w-full rounded-[22px] p-4 text-left"
      style={{
        ...glassCard(night),
        border: `1px solid ${
          selected
            ? "rgba(59,130,246,0.65)"
            : night
              ? "rgba(255,255,255,0.10)"
              : "rgba(226,232,240,1)"
        }`,
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="rounded-full p-[2px]"
          style={{
            background: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)",
          }}
        >
          <Avatar
            src={member.img}
            name={member.name}
            className="h-14 w-14 rounded-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-base font-bold leading-tight",
                night ? "text-white" : "text-slate-950",
              )}
            >
              {member.name}
            </span>

            <MiniBadge text={role.label} night={night} color={role.color} />
            <MiniBadge text={status.label} night={night} color={status.color} />
          </div>

          <div
            className="mt-1 text-[11px]"
            style={{ color: night ? "#94a3b8" : "#64748b" }}
          >
            {member.id} · {member.branch} · Staff ID {member.staffId || "—"}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <MiniBadge
              text={`Sales ${shortMoney(member.sales)}`}
              night={night}
              color="#60a5fa"
            />
            <MiniBadge
              text={`${member.orders} orders`}
              night={night}
              color="#60a5fa"
            />
            <MiniBadge
              text={`${member.shifts} shifts`}
              night={night}
              color="#10b981"
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <RatingStars rating={member.rating} />

          <ChevronRight
            className="h-4 w-4"
            style={{ color: night ? "#cbd5e1" : "#475569" }}
          />
        </div>
      </div>
    </motion.button>
  );
}

function DetailPanel({
  member,
  onClose,
  night,
}: {
  member: StaffMember | null;
  onClose: () => void;
  night: boolean;
}) {
  const [tab, setTab] = React.useState<"profile" | "tasks">("profile");

  return (
    <div
      className="staff-detail-panel sticky top-5 h-fit overflow-hidden rounded-[26px]"
      style={glassCard(night)}
    >
      <div
        className="px-5 py-4"
        style={{
          borderBottom: `1px solid ${
            night ? "rgba(255,255,255,0.05)" : "rgba(226,232,240,0.7)"
          }`,
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className={sectionTitle(night)}>Staff Detail</div>

            <div
              className={cn(
                "mt-1 text-xl font-bold leading-tight",
                night ? "text-[#f8fafc]" : "text-[#0f172a]",
              )}
            >
              {member ? member.name : "Preview"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2"
            style={premiumInputStyle(night)}
          >
            <X
              className="h-4 w-4"
              style={{ color: night ? "#cbd5e1" : "#475569" }}
            />
          </button>
        </div>

        {member && (
          <div
            className="flex gap-1 rounded-full p-1"
            style={{
              background: night
                ? "rgba(255,255,255,0.02)"
                : "rgba(255,255,255,0.6)",
              border: `1px solid ${
                night ? "rgba(255,255,255,0.04)" : "rgba(226,232,240,0.7)"
              }`,
            }}
          >
            {(["profile", "tasks"] as const).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{
                  background:
                    tab === tb
                      ? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
                      : "transparent",
                  color: tab === tb ? "#ffffff" : night ? "#cbd5e1" : "#475569",
                }}
              >
                {tb}
              </button>
            ))}
          </div>
        )}
      </div>

      {!member ? (
        <div className="p-10 text-center">
          <div className="mb-4 flex justify-center">
            <LanternMark size={42} glow={night} />
          </div>

          <div
            className={cn(
              "text-xl font-bold",
              night ? "text-[#f8fafc]" : "text-[#0f172a]",
            )}
          >
            No staff selected
          </div>

          <div
            className="mt-2 text-[12px]"
            style={{ color: night ? "#94a3b8" : "#64748b" }}
          >
            Choose any staff card to preview details here.
          </div>
        </div>
      ) : tab === "profile" ? (
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div
              className="rounded-full p-[2px]"
              style={{
                background: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)",
              }}
            >
              <Avatar
                src={member.img}
                name={member.name}
                className="h-20 w-20 rounded-full object-cover"
              />
            </div>

            <div>
              <div
                className={cn(
                  "text-xl font-bold leading-tight",
                  night ? "text-[#f8fafc]" : "text-[#0f172a]",
                )}
              >
                {member.name}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <MiniBadge
                  text={roleCfg[member.role].label}
                  night={night}
                  color={roleCfg[member.role].color}
                />
                <MiniBadge
                  text={statusCfg[member.status].label}
                  night={night}
                  color={statusCfg[member.status].color}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                l: "Orders",
                v: member.orders || "—",
                icon: CheckCircle2,
                color: "#60a5fa",
              },
              {
                l: "Sales",
                v: money(member.sales),
                icon: Activity,
                color: "#2563eb",
              },
              { l: "Shifts", v: member.shifts, icon: Clock, color: "#10b981" },
              {
                l: "Rating",
                v: member.rating.toFixed(1) + " ★",
                icon: Star,
                color: "#f59e0b",
              },
            ].map((item) => (
              <div
                key={item.l}
                className="rounded-[18px] p-3"
                style={premiumInputStyle(night)}
              >
                <item.icon
                  className="mb-2 h-4 w-4"
                  style={{ color: item.color }}
                />
                <div
                  className="text-[9px] uppercase tracking-[0.18em]"
                  style={{ color: night ? "#6d5d4b" : "#64748b" }}
                >
                  {item.l}
                </div>

                <div
                  className={cn(
                    "mt-1 text-[16px] font-bold",
                    night ? "text-[#f8fafc]" : "text-[#0f172a]",
                  )}
                >
                  {item.v}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[18px] p-4" style={premiumInputStyle(night)}>
            <div className={sectionTitle(night)}>Staff Information</div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] md:grid-cols-2">
              {[
                {
                  icon: IdCard,
                  label: "Staff ID",
                  value: member.staffId || "—",
                },
                {
                  icon: Cake,
                  label: "Date of Birth",
                  value: formatDate(member.dateOfBirth),
                },
                { icon: Phone, label: "Phone", value: member.phone || "—" },
                { icon: Mail, label: "Email", value: member.email || "—" },
                { icon: FileText, label: "NRC", value: member.nrc || "—" },
                {
                  icon: Wallet,
                  label: "Salary",
                  value: member.salary
                    ? `¥${Number(member.salary).toLocaleString()}`
                    : "—",
                },
                {
                  icon: Calendar,
                  label: "Start Date",
                  value: formatDate(member.joined),
                },
                {
                  icon: Briefcase,
                  label: "Branch",
                  value: member.branch || "—",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="rounded-[14px] p-3"
                  style={{
                    background: night
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.6)",
                    border: `1px solid ${
                      night ? "rgba(255,255,255,0.04)" : "rgba(226,232,240,0.7)"
                    }`,
                  }}
                >
                  <div
                    className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: night ? "#94a3b8" : "#64748b" }}
                  >
                    <row.icon className="h-3 w-3" />
                    {row.label}
                  </div>

                  <div
                    className={cn(
                      "break-all font-medium",
                      night ? "text-[#f8fafc]" : "text-[#0f172a]",
                    )}
                  >
                    {row.value}
                  </div>
                </div>
              ))}

              <div
                className="rounded-[14px] p-3 md:col-span-2"
                style={{
                  background: night
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.6)",
                  border: `1px solid ${
                    night ? "rgba(255,255,255,0.04)" : "rgba(226,232,240,0.7)"
                  }`,
                }}
              >
                <div
                  className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: night ? "#94a3b8" : "#64748b" }}
                >
                  <MapPin className="h-3 w-3" />
                  Address
                </div>

                <div
                  className={cn(
                    "font-medium",
                    night ? "text-[#f8fafc]" : "text-[#0f172a]",
                  )}
                >
                  {member.address || "—"}
                </div>
              </div>

              <div
                className="rounded-[14px] p-3 md:col-span-2"
                style={{
                  background: night
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.6)",
                  border: `1px solid ${
                    night ? "rgba(255,255,255,0.04)" : "rgba(226,232,240,0.7)"
                  }`,
                }}
              >
                <div
                  className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: night ? "#94a3b8" : "#64748b" }}
                >
                  <FileText className="h-3 w-3" />
                  Note
                </div>

                <div
                  className={cn(
                    "whitespace-pre-wrap font-medium",
                    night ? "text-[#f8fafc]" : "text-[#0f172a]",
                  )}
                >
                  {member.note || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className={sectionTitle(night)}>Assigned Tasks</div>

          {(member.tasks || []).map((task) => {
            const statusColor =
              task.status === "Done"
                ? "#10b981"
                : task.status === "In Progress"
                  ? "#60a5fa"
                  : "#f59e0b";

            const priorityColor =
              task.priority === "High"
                ? "#ef4444"
                : task.priority === "Medium"
                  ? "#f59e0b"
                  : "#94a3b8";

            return (
              <div
                key={task.id}
                className="rounded-[18px] p-4"
                style={premiumInputStyle(night)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: priorityColor }}
                      />

                      <div
                        className={cn(
                          "text-[13px] font-bold",
                          night ? "text-[#f8fafc]" : "text-[#0f172a]",
                        )}
                      >
                        {task.title}
                      </div>
                    </div>

                    <div
                      className="mt-1 text-[11px]"
                      style={{ color: night ? "#64748b" : "#64748b" }}
                    >
                      {task.description || "No description"}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <MiniBadge text={task.id} night={night} color="#2563eb" />
                      <MiniBadge
                        text={task.priority}
                        night={night}
                        color={priorityColor}
                      />
                      <MiniBadge
                        text={`Due ${task.dueDate || "—"}`}
                        night={night}
                        color="#60a5fa"
                      />
                    </div>
                  </div>

                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold"
                    style={{
                      background: `${statusColor}22`,
                      color: statusColor,
                      border: `1px solid ${statusColor}55`,
                    }}
                  >
                    {task.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  night,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  night: boolean;
}) {
  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-[24px] p-4"
      style={glassCard(night)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="rounded-full px-4 py-2 text-[12px] font-bold"
            style={{
              background: night
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.7)",
              border: `1px solid ${
                night ? "rgba(255,255,255,0.05)" : "rgba(226,232,240,0.7)"
              }`,
              color: night ? "#cbd5e1" : "#475569",
            }}
          >
            Showing {totalItems === 0 ? 0 : startIndex}-{endIndex} of{" "}
            {totalItems}
          </div>

          <div
            className="flex items-center gap-2 rounded-full px-3 py-2"
            style={premiumInputStyle(night)}
          >
            <span
              className="text-[11px] font-bold"
              style={{ color: night ? "#cbd5e1" : "#475569" }}
            >
              Cards
            </span>

            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                className="rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background:
                    pageSize === size
                      ? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
                      : "transparent",
                  color:
                    pageSize === size
                      ? "#ffffff"
                      : night
                        ? "#cbd5e1"
                        : "#475569",
                  border: `1px solid ${
                    pageSize === size ? "rgba(59,130,246,0.65)" : "transparent"
                  }`,
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { icon: ChevronsLeft, page: 1, disabled: currentPage === 1 },
            {
              icon: ChevronLeft,
              page: currentPage - 1,
              disabled: currentPage === 1,
            },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              disabled={btn.disabled}
              onClick={() => onPageChange(btn.page)}
              className="h-10 w-10 rounded-[14px] disabled:opacity-40"
              style={premiumInputStyle(night)}
            >
              <btn.icon
                className="mx-auto h-4 w-4"
                style={{ color: night ? "#cbd5e1" : "#475569" }}
              />
            </button>
          ))}

          <div
            className="flex items-center gap-2 rounded-[18px] px-2 py-2"
            style={premiumInputStyle(night)}
          >
            {pages.map((page, idx) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-sm font-bold"
                  style={{ color: night ? "#94a3b8" : "#64748b" }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  className="h-10 min-w-[40px] rounded-[14px] px-3 text-[12px] font-bold"
                  style={{
                    background:
                      currentPage === page
                        ? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
                        : "transparent",
                    color:
                      currentPage === page
                        ? "#ffffff"
                        : night
                          ? "#cbd5e1"
                          : "#475569",
                    border: `1px solid ${
                      currentPage === page
                        ? "rgba(59,130,246,0.65)"
                        : "transparent"
                    }`,
                  }}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          {[
            {
              icon: PageChevronRight,
              page: currentPage + 1,
              disabled: currentPage === totalPages || totalPages === 0,
            },
            {
              icon: ChevronsRight,
              page: totalPages,
              disabled: currentPage === totalPages || totalPages === 0,
            },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              disabled={btn.disabled}
              onClick={() => onPageChange(btn.page)}
              className="h-10 w-10 rounded-[14px] disabled:opacity-40"
              style={premiumInputStyle(night)}
            >
              <btn.icon
                className="mx-auto h-4 w-4"
                style={{ color: night ? "#cbd5e1" : "#475569" }}
              />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function StaffPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { resolvedTheme } = useTheme();
  const night = resolvedTheme === "dark";

  const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
  const [q, setQ] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [viewMode, setViewMode] = React.useState<ViewMode>("compact");
  const [sortMode, setSortMode] = React.useState<SortMode>("name_asc");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [notification, setNotification] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(9);

  function showNotif(msg: string) {
    setNotification(msg);
    window.setTimeout(() => setNotification(null), 3000);
  }

  const fetchStaff = React.useCallback(
    async (refresh = false) => {
      try {
        const accessToken = getStaffPageToken(session);

        if (!accessToken) {
          setStaffList([]);

          if (sessionStatus !== "loading") {
            setError("Login token မရှိပါ။ အရင်ဆုံး login ပြန်ဝင်ပါ။");
          }

          return;
        }

        refresh ? setRefreshing(true) : setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/staff`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let message = `Failed (${res.status})`;

          try {
            const json = JSON.parse(text);

            if (json.error === "FEATURE_DISABLED") {
              message =
                "Staff feature is disabled for this shop plan. Super Admin မှာ Staff ကို ON လုပ်ပါ။";
            } else {
              message = json.message || json.error || message;
            }
          } catch {
            if (text) message = text;
          }

          throw new Error(message);
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data.map(mapApiStaffToUi) : [];

        setStaffList(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Staff API error");
        setStaffList([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, sessionStatus],
  );

  React.useEffect(() => {
    if (sessionStatus === "authenticated") {
      void fetchStaff();
    } else if (sessionStatus === "unauthenticated") {
      const fallbackToken = getStaffPageToken(session);

      if (fallbackToken) {
        void fetchStaff();
        return;
      }

      setStaffList([]);
      setLoading(false);
      setError("Please sign in again.");
    }
  }, [fetchStaff, session, sessionStatus]);

  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      if (parsed.viewMode) setViewMode(parsed.viewMode);
      if (parsed.sortMode) setSortMode(parsed.sortMode);
      if (typeof parsed.panelOpen === "boolean") setPanelOpen(parsed.panelOpen);
      if (parsed.pageSize) setPageSize(parsed.pageSize);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode,
        sortMode,
        panelOpen,
        pageSize,
      }),
    );
  }, [viewMode, sortMode, panelOpen, pageSize]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = staffList.filter((s) => {
      const matchQuery =
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        String(s.staffId || "")
          .toLowerCase()
          .includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.phone.toLowerCase().includes(query) ||
        s.branch.toLowerCase().includes(query) ||
        String(s.nrc || "")
          .toLowerCase()
          .includes(query);

      const matchRole =
        roleFilter === "All" || s.role === roleFilter.toLowerCase();

      const matchStatus =
        statusFilter === "All" ||
        s.status === statusFilter.toLowerCase().replace(" ", "_");

      return matchQuery && matchRole && matchStatus;
    });

    return sortStaff(base, sortMode);
  }, [staffList, q, roleFilter, statusFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  React.useEffect(() => {
    setCurrentPage(1);
  }, [q, roleFilter, statusFilter, sortMode, pageSize]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedStaff = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const selectedMember = selectedId
    ? (staffList.find((s) => s.id === selectedId) ?? null)
    : null;

  React.useEffect(() => {
    if (!selectedId && paginatedStaff.length > 0) {
      setSelectedId(paginatedStaff[0].id);
    }
  }, [selectedId, paginatedStaff]);

  const activeCount = staffList.filter((s) => s.status === "active").length;
  const onLeaveCount = staffList.filter((s) => s.status === "on_leave").length;
  const inactiveCount = staffList.filter((s) => s.status === "inactive").length;
  const totalTasks = staffList.reduce(
    (sum, s) => sum + getTaskStats(s.tasks || []).total,
    0,
  );

  const startIndex =
    filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const endIndex = Math.min(currentPage * pageSize, filtered.length);

  const selectMember = (member: StaffMember) => {
    setSelectedId(member.id);
    setPanelOpen(true);
  };
  return (
    <section className={cn("staff-simple mx-auto max-w-[1600px] px-3 py-4 md:px-4", night ? "text-slate-100" : "text-slate-950")}>
      <style jsx global>{`
        .staff-simple .staff-scroll { max-height: 58dvh; overflow: auto; overscroll-behavior: contain; }
        .staff-simple table { width: 100%; min-width: 680px; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
        .staff-simple th { position: sticky; top: 0; z-index: 1; background: var(--card); }
        .staff-simple th, .staff-simple td { padding: 12px 10px; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
        .staff-simple button:focus-visible, .staff-simple input:focus-visible, .staff-simple select:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
        .staff-profile-dialog .staff-detail-panel { position: static; border-radius: 0; box-shadow: none; }
        @media (min-width:768px) and (max-width:1279px) and (orientation:landscape) {
          .staff-simple table { min-width: 0; font-size: 12px; }
          .staff-simple th, .staff-simple td { padding: 10px 8px; }
          .staff-simple .staff-scroll { max-height: 55dvh; }
          .staff-simple .staff-card-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
        }
      `}</style>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-blue-500" /> Staff Management</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.location.assign("/dashboard")} className="h-11 rounded-xl px-3 text-xs font-bold" style={premiumInputStyle(night)}>Dashboard</button>
          <button type="button" onClick={() => void fetchStaff(true)} disabled={refreshing || loading} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold disabled:opacity-50" style={premiumInputStyle(night)}>{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</button>
          <button type="button" onClick={() => setViewMode(v => v === "grid" ? "compact" : "grid")} className="h-11 rounded-xl px-3 text-xs font-bold" style={premiumInputStyle(night)}>{viewMode === "grid" ? "Table View" : "Card View"}</button>
          <button type="button" onClick={() => window.location.assign("/dashboard/staff/add_staff")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Add Staff</button>
        </div>
      </header>
      {error && <div role="alert" className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[["Total Staff",staffList.length],["Active",activeCount],["On Leave",onLeaveCount],["Inactive",inactiveCount]].map(([label,value]) => <div key={String(label)} className="rounded-xl px-3 py-2" style={premiumInputStyle(night)}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{value}</p></div>)}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_135px_135px_145px]">
        <div className="relative col-span-2 md:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input aria-label="Search staff" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, staff ID, phone..." className="h-11 w-full rounded-xl pl-9 pr-3 text-sm" style={premiumInputStyle(night)} /></div>
        <select aria-label="Filter role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-11 min-w-0 rounded-xl px-3 text-xs" style={premiumInputStyle(night)}>{ROLES.map(role => <option key={role} value={role}>{role === "All" ? "All roles" : role}</option>)}</select>
        <select aria-label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-11 min-w-0 rounded-xl px-3 text-xs" style={premiumInputStyle(night)}>{STATUSES.map(status => <option key={status} value={status}>{status === "All" ? "All statuses" : status}</option>)}</select>
        <select aria-label="Sort staff" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="col-span-2 h-11 min-w-0 rounded-xl px-3 text-xs md:col-span-1" style={premiumInputStyle(night)}><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="rating_desc">Best Rating</option><option value="sales_desc">Top Sales</option><option value="joined_desc">Newest Joined</option></select>
      </div>
      <div className="overflow-hidden rounded-2xl" style={premiumInputStyle(night)}>
        <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold dark:border-white/10">{filtered.length} staff found</div>
        {loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin" /> Loading staff...</div> :
        !paginatedStaff.length ? <div className="py-16 text-center text-sm text-slate-500">No staff found. Try another search or filter.</div> :
        viewMode === "grid" ? <div className="staff-card-grid grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{paginatedStaff.map(member => <StaffCard key={member.id} member={member} selected={member.id === selectedId} onSelect={selectMember} night={night} />)}</div> :
        <div className="staff-scroll" role="region" aria-label="Staff list" tabIndex={0}>
          <table className="text-left text-sm">
            <colgroup><col style={{width:"29%"}} /><col style={{width:"14%"}} /><col style={{width:"12%"}} /><col style={{width:"25%"}} /><col style={{width:"12%"}} /><col style={{width:"8%"}} /></colgroup>
            <thead className="text-[10px] uppercase text-slate-500"><tr>{["Staff","Role / Branch","Status","Contact","Joined","Details"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
            <tbody>{paginatedStaff.map(member => <tr key={member.id} className={cn("hover:bg-blue-500/5", selectedId === member.id && "bg-blue-500/5")}>
              <td><button type="button" onClick={() => selectMember(member)} className="flex w-full items-center gap-2 text-left"><Avatar src={member.img} name={member.name} className="h-9 w-9 shrink-0 rounded-full object-cover" /><span className="min-w-0"><span className="block font-bold">{member.name}</span><span className="mt-0.5 block text-[11px] text-slate-500">Staff ID {member.staffId || member.id}</span></span></button></td>
              <td><span className="font-semibold">{roleCfg[member.role].label}</span><span className="mt-1 block text-[11px] text-slate-500">{member.branch}</span></td>
              <td><span className="inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold" style={{color:statusCfg[member.status].color,background:statusCfg[member.status].color+"18"}}>{statusCfg[member.status].label}</span></td>
              <td><span className="block">{member.phone}</span><span className="mt-1 block text-[11px] text-slate-500">{member.email}</span></td>
              <td className="text-xs">{formatDate(member.joined)}</td>
              <td><button type="button" onClick={() => selectMember(member)} aria-label={`View ${member.name} details`} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 dark:border-white/10"><Eye className="h-4 w-4" /></button></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <PaginationBar currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={filtered.length} startIndex={startIndex} endIndex={endIndex} onPageChange={page => setCurrentPage(Math.max(1,Math.min(totalPages,page)))} onPageSizeChange={size => {setPageSize(size);setCurrentPage(1);}} night={night} />
      </div>
      <Dialog open={panelOpen && !!selectedMember} onOpenChange={setPanelOpen}>
        <DialogContent className="staff-profile-dialog flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[900px] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[900px]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{selectedMember?.name || "Staff"} details</DialogTitle>
          <div className="min-h-0 overflow-y-auto overscroll-contain"><DetailPanel member={selectedMember} onClose={() => setPanelOpen(false)} night={night} /></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
