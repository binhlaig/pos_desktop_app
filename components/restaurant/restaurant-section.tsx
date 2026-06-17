import Link from "next/link";
import {
  Armchair,
  ChefHat,
  ClipboardList,
  Plus,
  Store,
  Utensils,
} from "lucide-react";

import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { restaurantRoutes } from "@/lib/dashboard-routes";

type RestaurantSectionProps = {
  section: "menu" | "tables" | "kitchen" | "orders";
};

const config = {
  menu: {
    title: "Restaurant Menu",
    description: "Manage dishes, categories, availability, and prices.",
    icon: Store,
    action: "Add item",
    rows: ["Chicken Fried Rice", "Shan Noodle", "Lemon Tea", "Pork Curry"],
  },
  tables: {
    title: "Restaurant Tables",
    description: "Track dine-in tables, reservations, and active checks.",
    icon: Armchair,
    action: "Add table",
    rows: ["Table 01 - Free", "Table 02 - Busy", "Table 03 - Reserved"],
  },
  kitchen: {
    title: "Kitchen Display",
    description: "Follow preparation queues and order status by station.",
    icon: ChefHat,
    action: "Refresh queue",
    rows: ["ORD-1008 - Preparing", "ORD-1009 - New", "ORD-1010 - Ready"],
  },
  orders: {
    title: "Restaurant Orders",
    description: "Review dine-in, takeaway, delivery, and paid orders.",
    icon: ClipboardList,
    action: "New order",
    rows: ["ORD-1008 - Dine in", "ORD-1009 - Takeaway", "ORD-1010 - Delivery"],
  },
} as const;

export function RestaurantSection({ section }: RestaurantSectionProps) {
  const item = config[section];
  const Icon = item.icon;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6 lg:p-8">
      <BusinessTypeGuard allow="RESTAURANT" />

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
              <Icon className="h-4 w-4" />
              Restaurant
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-normal sm:text-3xl">
              {item.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-md">
              <Link href="/dashboard/restaurant-pos">
                <Utensils className="h-4 w-4" />
                Open POS
              </Link>
            </Button>
            <Button className="rounded-md bg-orange-500 text-white hover:bg-orange-600">
              <Plus className="h-4 w-4" />
              {item.action}
            </Button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2">
          {Object.entries(restaurantRoutes).map(([key, href]) => (
            <Button
              key={href}
              asChild
              variant={key === section ? "default" : "outline"}
              className="rounded-md"
            >
              <Link href={href}>{key[0].toUpperCase() + key.slice(1)}</Link>
            </Button>
          ))}
        </nav>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {item.rows.map((row) => (
            <Card key={row} className="rounded-md border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">{row}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                This route is ready for live restaurant data when the backend
                endpoints are available.
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
