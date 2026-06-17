import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

const stats = [
  {
    label: "Today Sales",
    value: "¥ 248,900",
    change: "+12.4%",
    icon: CircleDollarSign,
    tone: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    label: "Orders",
    value: "186",
    change: "+18",
    icon: ReceiptText,
    tone: "text-sky-600 bg-sky-50 border-sky-100",
  },
  {
    label: "Products",
    value: "1,284",
    change: "42 low",
    icon: Boxes,
    tone: "text-violet-600 bg-violet-50 border-violet-100",
  },
  {
    label: "Staff Online",
    value: "9",
    change: "3 counters",
    icon: Users,
    tone: "text-amber-600 bg-amber-50 border-amber-100",
  },
];

const recentOrders = [
  { id: "ORD-1024", cashier: "Aye Chan", total: "¥ 12,800", status: "Paid" },
  { id: "ORD-1023", cashier: "Min Thu", total: "¥ 8,420", status: "Paid" },
  { id: "ORD-1022", cashier: "Su Mon", total: "¥ 21,600", status: "Pending" },
  { id: "ORD-1021", cashier: "Aye Chan", total: "¥ 4,950", status: "Refunded" },
];

// const tasks = [
//   "Low stock products ကိုစစ်ရန်",

//   "Cash drawer closing report ပြန်ကြည့်ရန်",
//   "Staff shift schedule update လုပ်ရန်",
// ];
const tasks = [
  {
    label: "Check low stock products",
    href: "/admin/law_stock_products",
  },
  {
    label: "Review cash drawer closing report",
    href: "/admin",
  },
  {
    label: "Update staff shift schedule",
    href: "/admin",
  },
];



export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        username?: string;
        name?: string | null;
        role?: string;
        shopCode?: string | null;
      }
    | undefined;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="gap-1 rounded-md bg-slate-900 text-white hover:bg-slate-900">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Badge>
              <Badge variant="secondary" className="rounded-md">
                {user?.shopCode || "Main Shop"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome back, {user?.username || user?.name || "Admin"}. POS
              operations overview for today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-md border-slate-300">
              <Clock3 className="h-4 w-4" />
              Today
            </Button>
            <Button className="rounded-md bg-slate-900 text-white hover:bg-slate-800">
              <BarChart3 className="h-4 w-4" />
              View Report
            </Button>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="rounded-lg border-slate-200 bg-white shadow-none">
                <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                  <div>
                    <CardDescription>{item.label}</CardDescription>
                    <CardTitle className="mt-2 text-2xl font-bold">
                      {item.value}
                    </CardTitle>
                  </div>
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-md border ${item.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <ArrowUpRight className="h-4 w-4" />
                    {item.change}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-lg border-slate-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-sky-600" />
                Recent Orders
              </CardTitle>
              <CardDescription>Latest counter activity from POS.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-medium">{order.id}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.cashier}
                        </td>
                        <td className="px-4 py-3">{order.total}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="rounded-lg border-slate-200 bg-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Admin Tasks
                </CardTitle>
                <CardDescription>Items that need attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tasks.map((task) => (
                  <Link
                    key={task.label}
                    href={task.href}
                    className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <PackageCheck className="h-4 w-4 text-emerald-600" />
                    <span className="flex-1">{task.label}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 bg-slate-900 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5" />
                  Shop Status
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Role: {user?.role || "ADMIN"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-white/10 p-3">
                  <div className="text-slate-300">Open Counters</div>
                  <div className="mt-1 text-xl font-bold">3</div>
                </div>
                <div className="rounded-md bg-white/10 p-3">
                  <div className="text-slate-300">Alerts</div>
                  <div className="mt-1 text-xl font-bold">5</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
