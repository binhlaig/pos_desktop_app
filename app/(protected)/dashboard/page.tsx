// "use client";

// import { useEffect, useMemo, useState } from "react";
// import Link from "next/link";
// import {
//   ArrowRight,
//   BarChart3,
//   ChefHat,
//   ClipboardList,
//   Coffee,
//   LayoutDashboard,
//   Package,
//   Receipt,
//   ShoppingCart,
//   Sparkles,
//   Store,
//   Table2,
//   Utensils,
// } from "lucide-react";

// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   RESTAURANT_POS_PATH,
//   SUPERMARKET_POS_PATH,
//   restaurantRoutes,
//   supermarketRoutes,
// } from "@/lib/business-type";

// type BusinessType = "SUPERMARKET" | "RESTAURANT" | "BOTH";

// type QuickLinkType = "SUPERMARKET" | "RESTAURANT";

// type QuickLink = {
//   label: string;
//   description: string;
//   href: string;
//   icon: React.ElementType;
//   badge: string;
//   color: string;
//   type: QuickLinkType;
// };

// const allQuickLinks: QuickLink[] = [
//   {
//     label: "Supermarket POS",
//     description: "Barcode scan, cart, payment",
//     href: SUPERMARKET_POS_PATH,
//     icon: ShoppingCart,
//     badge: "Cashier",
//     color: "from-emerald-500 to-teal-500",
//     type: "SUPERMARKET",
//   },
//   {
//     label: "Products",
//     description: "Manage supermarket products",
//     href: supermarketRoutes.products,
//     icon: Package,
//     badge: "Supermarket",
//     color: "from-blue-500 to-cyan-500",
//     type: "SUPERMARKET",
//   },
//   {
//     label: "Receipts",
//     description: "Sales receipt history",
//     href: supermarketRoutes.receipts,
//     icon: Receipt,
//     badge: "Sales",
//     color: "from-violet-500 to-purple-500",
//     type: "SUPERMARKET",
//   },
//   {
//     label: "Restaurant POS",
//     description: "Dine-in, takeaway, table order",
//     href: RESTAURANT_POS_PATH,
//     icon: ChefHat,
//     badge: "Cashier",
//     color: "from-orange-500 to-rose-500",
//     type: "RESTAURANT",
//   },
//   {
//     label: "Restaurant Menu",
//     description: "Food and drink menu setup",
//     href: restaurantRoutes.menu,
//     icon: Utensils,
//     badge: "Restaurant",
//     color: "from-amber-500 to-orange-500",
//     type: "RESTAURANT",
//   },
//   {
//     label: "Tables",
//     description: "Create and manage tables",
//     href: restaurantRoutes.tables,
//     icon: Table2,
//     badge: "Restaurant",
//     color: "from-pink-500 to-rose-500",
//     type: "RESTAURANT",
//   },
//   {
//     label: "Kitchen",
//     description: "Kitchen tickets and cooking status",
//     href: restaurantRoutes.kitchen,
//     icon: Coffee,
//     badge: "Kitchen",
//     color: "from-slate-700 to-slate-900",
//     type: "RESTAURANT",
//   },
//   {
//     label: "Orders",
//     description: "Restaurant order management",
//     href: restaurantRoutes.orders,
//     icon: ClipboardList,
//     badge: "Orders",
//     color: "from-indigo-500 to-blue-500",
//     type: "RESTAURANT",
//   },
// ];

// function normalizeBusinessType(value?: string | null): BusinessType {
//   const upper = value?.toUpperCase();

//   if (upper === "RESTAURANT") return "RESTAURANT";
//   if (upper === "BOTH") return "BOTH";

//   return "SUPERMARKET";
// }

// function getBusinessTypeFromStorage(): BusinessType {
//   if (typeof window === "undefined") return "SUPERMARKET";

//   // သင့် frontend မှာ key မတူနိုင်လို့ ၂ မျိုးလုံးစစ်ထားပါတယ်
//   const value =
//     localStorage.getItem("business_type") ||
//     localStorage.getItem("businessType") ||
//     localStorage.getItem("pos_business_type");

//   return normalizeBusinessType(value);
// }

// export default function DashboardPage() {
//   const [businessType, setBusinessType] =
//     useState<BusinessType>("SUPERMARKET");

//   useEffect(() => {
//     setBusinessType(getBusinessTypeFromStorage());
//   }, []);

//   const quickLinks = useMemo(() => {
//     if (businessType === "BOTH") {
//       return allQuickLinks;
//     }

//     return allQuickLinks.filter((item) => item.type === businessType);
//   }, [businessType]);

//   const statCards = useMemo(() => {
//     if (businessType === "RESTAURANT") {
//       return [
//         {
//           label: "Today Sales",
//           value: "0 Ks",
//           icon: BarChart3,
//         },
//         {
//           label: "Open Orders",
//           value: "0",
//           icon: ClipboardList,
//         },
//         {
//           label: "Active Tables",
//           value: "0",
//           icon: Table2,
//         },
//         {
//           label: "Kitchen Tickets",
//           value: "0",
//           icon: Coffee,
//         },
//       ];
//     }

//     if (businessType === "BOTH") {
//       return [
//         {
//           label: "Today Sales",
//           value: "0 Ks",
//           icon: BarChart3,
//         },
//         {
//           label: "Open Orders",
//           value: "0",
//           icon: ClipboardList,
//         },
//         {
//           label: "Active Tables",
//           value: "0",
//           icon: Table2,
//         },
//         {
//           label: "Products",
//           value: "0",
//           icon: Package,
//         },
//       ];
//     }

//     return [
//       {
//         label: "Today Sales",
//         value: "0 Ks",
//         icon: BarChart3,
//       },
//       {
//         label: "Products",
//         value: "0",
//         icon: Package,
//       },
//       {
//         label: "Receipts",
//         value: "0",
//         icon: Receipt,
//       },
//       {
//         label: "Cashier",
//         value: "POS",
//         icon: ShoppingCart,
//       },
//     ];
//   }, [businessType]);

//   const title =
//     businessType === "RESTAURANT"
//       ? "Restaurant Dashboard"
//       : businessType === "BOTH"
//       ? "POS Dashboard"
//       : "Supermarket Dashboard";

//   const description =
//     businessType === "RESTAURANT"
//       ? "စားသောက်ဆိုင် POS, table, menu, kitchen, order များကို စီမံရန်"
//       : businessType === "BOTH"
//       ? "Supermarket POS နဲ့ Restaurant POS နှစ်မျိုးလုံး စီမံရန်"
//       : "Supermarket POS, product, receipt များကို စီမံရန်";

//   return (
//     <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0,#f8fafc_35%,#eef2ff_100%)] p-4 text-slate-950 sm:p-6 lg:p-8">
//       <div className="mx-auto flex max-w-7xl flex-col gap-6">
//         <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl lg:p-8">
//           <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-300/30 blur-3xl" />
//           <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" />

//           <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
//             <div>
//               <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-orange-600 ring-1 ring-orange-100">
//                 <Sparkles size={16} />
//                 {businessType}
//               </div>

//               <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
//                 {title}
//               </h1>

//               <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
//                 {description}
//               </p>
//             </div>

//             <div className="grid grid-cols-1 gap-3 sm:min-w-[260px]">
//               {businessType === "SUPERMARKET" && (
//                 <Button
//                   asChild
//                   className="h-14 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
//                 >
//                   <Link href={SUPERMARKET_POS_PATH}>
//                     <ShoppingCart size={18} />
//                     Open Supermarket POS
//                   </Link>
//                 </Button>
//               )}

//               {businessType === "RESTAURANT" && (
//                 <Button
//                   asChild
//                   className="h-14 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
//                 >
//                   <Link href={RESTAURANT_POS_PATH}>
//                     <ChefHat size={18} />
//                     Open Restaurant POS
//                   </Link>
//                 </Button>
//               )}

//               {businessType === "BOTH" && (
//                 <div className="grid grid-cols-2 gap-3">
//                   <Button
//                     asChild
//                     className="h-14 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
//                   >
//                     <Link href={SUPERMARKET_POS_PATH}>
//                       <ShoppingCart size={18} />
//                       Supermarket
//                     </Link>
//                   </Button>

//                   <Button
//                     asChild
//                     className="h-14 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
//                   >
//                     <Link href={RESTAURANT_POS_PATH}>
//                       <ChefHat size={18} />
//                       Restaurant
//                     </Link>
//                   </Button>
//                 </div>
//               )}
//             </div>
//           </div>
//         </section>

//         <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
//           {statCards.map((item) => {
//             const Icon = item.icon;

//             return (
//               <Card
//                 key={item.label}
//                 className="rounded-[1.75rem] border-white/70 bg-white/85 shadow-sm backdrop-blur-xl"
//               >
//                 <CardContent className="flex items-center gap-4 p-5">
//                   <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
//                     <Icon size={22} />
//                   </div>

//                   <div>
//                     <p className="text-sm font-bold text-slate-500">
//                       {item.label}
//                     </p>
//                     <p className="mt-1 text-2xl font-black text-slate-950">
//                       {item.value}
//                     </p>
//                   </div>
//                 </CardContent>
//               </Card>
//             );
//           })}
//         </section>

//         <section>
//           <div className="mb-4 flex items-center justify-between gap-3">
//             <div>
//               <div className="flex items-center gap-2">
//                 <LayoutDashboard className="text-orange-500" size={22} />
//                 <h2 className="text-xl font-black text-slate-950">
//                   Quick Access
//                 </h2>
//               </div>
//               <p className="mt-1 text-sm font-semibold text-slate-500">
//                 {businessType === "SUPERMARKET"
//                   ? "Supermarket နဲ့သက်ဆိုင်သော route များသာ ပြထားပါတယ်။"
//                   : businessType === "RESTAURANT"
//                   ? "Restaurant နဲ့သက်ဆိုင်သော route များသာ ပြထားပါတယ်။"
//                   : "Supermarket + Restaurant route များအားလုံး ပြထားပါတယ်။"}
//               </p>
//             </div>
//           </div>

//           <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
//             {quickLinks.map((item) => {
//               const Icon = item.icon;

//               return (
//                 <Link key={item.href} href={item.href} className="group">
//                   <Card className="h-full overflow-hidden rounded-[1.75rem] border-white/70 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200">
//                     <CardContent className="p-0">
//                       <div className={`h-2 bg-gradient-to-r ${item.color}`} />

//                       <div className="p-5">
//                         <div className="flex items-start justify-between gap-3">
//                           <div
//                             className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${item.color} text-white shadow-lg`}
//                           >
//                             <Icon size={26} />
//                           </div>

//                           <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
//                             {item.badge}
//                           </span>
//                         </div>

//                         <h3 className="mt-5 text-lg font-black text-slate-950">
//                           {item.label}
//                         </h3>

//                         <p className="mt-2 min-h-[40px] text-sm font-semibold leading-5 text-slate-500">
//                           {item.description}
//                         </p>

//                         <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
//                           Open
//                           <ArrowRight
//                             size={18}
//                             className="transition group-hover:translate-x-1"
//                           />
//                         </div>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 </Link>
//               );
//             })}
//           </div>
//         </section>

//         {businessType === "SUPERMARKET" && (
//           <section>
//             <Card className="overflow-hidden rounded-[2rem] border-emerald-100 bg-white shadow-sm">
//               <CardContent className="p-6">
//                 <div className="flex items-center gap-4">
//                   <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
//                     <Store size={28} />
//                   </div>

//                   <div>
//                     <h3 className="text-xl font-black text-slate-950">
//                       Supermarket Workspace
//                     </h3>
//                     <p className="mt-1 text-sm font-semibold text-slate-500">
//                       Barcode, product, receipt, cashier sale
//                     </p>
//                   </div>
//                 </div>

//                 <div className="mt-5 grid gap-2 sm:grid-cols-3">
//                   <Button
//                     asChild
//                     className="rounded-2xl bg-emerald-500 font-black hover:bg-emerald-600"
//                   >
//                     <Link href={SUPERMARKET_POS_PATH}>POS</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={supermarketRoutes.products}>Products</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={supermarketRoutes.receipts}>Receipts</Link>
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>
//           </section>
//         )}

//         {businessType === "RESTAURANT" && (
//           <section>
//             <Card className="overflow-hidden rounded-[2rem] border-orange-100 bg-white shadow-sm">
//               <CardContent className="p-6">
//                 <div className="flex items-center gap-4">
//                   <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
//                     <ChefHat size={28} />
//                   </div>

//                   <div>
//                     <h3 className="text-xl font-black text-slate-950">
//                       Restaurant Workspace
//                     </h3>
//                     <p className="mt-1 text-sm font-semibold text-slate-500">
//                       Table, menu, kitchen ticket, restaurant order
//                     </p>
//                   </div>
//                 </div>

//                 <div className="mt-5 grid gap-2 sm:grid-cols-3">
//                   <Button
//                     asChild
//                     className="rounded-2xl bg-orange-500 font-black hover:bg-orange-600"
//                   >
//                     <Link href={RESTAURANT_POS_PATH}>POS</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={restaurantRoutes.tables}>Tables</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={restaurantRoutes.kitchen}>Kitchen</Link>
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>
//           </section>
//         )}

//         {businessType === "BOTH" && (
//           <section className="grid gap-4 lg:grid-cols-2">
//             <Card className="overflow-hidden rounded-[2rem] border-emerald-100 bg-white shadow-sm">
//               <CardContent className="p-6">
//                 <div className="flex items-center gap-4">
//                   <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
//                     <Store size={28} />
//                   </div>

//                   <div>
//                     <h3 className="text-xl font-black text-slate-950">
//                       Supermarket Workspace
//                     </h3>
//                     <p className="mt-1 text-sm font-semibold text-slate-500">
//                       Barcode, product, receipt, cashier sale
//                     </p>
//                   </div>
//                 </div>

//                 <div className="mt-5 grid gap-2 sm:grid-cols-3">
//                   <Button
//                     asChild
//                     className="rounded-2xl bg-emerald-500 font-black hover:bg-emerald-600"
//                   >
//                     <Link href={SUPERMARKET_POS_PATH}>POS</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={supermarketRoutes.products}>Products</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={supermarketRoutes.receipts}>Receipts</Link>
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="overflow-hidden rounded-[2rem] border-orange-100 bg-white shadow-sm">
//               <CardContent className="p-6">
//                 <div className="flex items-center gap-4">
//                   <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
//                     <ChefHat size={28} />
//                   </div>

//                   <div>
//                     <h3 className="text-xl font-black text-slate-950">
//                       Restaurant Workspace
//                     </h3>
//                     <p className="mt-1 text-sm font-semibold text-slate-500">
//                       Table, menu, kitchen ticket, restaurant order
//                     </p>
//                   </div>
//                 </div>

//                 <div className="mt-5 grid gap-2 sm:grid-cols-3">
//                   <Button
//                     asChild
//                     className="rounded-2xl bg-orange-500 font-black hover:bg-orange-600"
//                   >
//                     <Link href={RESTAURANT_POS_PATH}>POS</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={restaurantRoutes.tables}>Tables</Link>
//                   </Button>
//                   <Button
//                     asChild
//                     variant="outline"
//                     className="rounded-2xl font-black"
//                   >
//                     <Link href={restaurantRoutes.kitchen}>Kitchen</Link>
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>
//           </section>
//         )}
//       </div>
//     </main>
//   );
// }
























"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  RESTAURANT_POS_PATH,
  SUPERMARKET_POS_PATH,
  restaurantRoutes,
  supermarketRoutes,
} from "@/lib/business-type";

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
        href: supermarketRoutes.receipts,
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

function getStatCards(businessType: BusinessType): StatCard[] {
  if (businessType === "RESTAURANT") {
    return [
      {
        label: "Today Sales",
        value: "0 Ks",
        icon: BarChart3,
        color: "bg-orange-500",
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
      {
        label: "Kitchen Tickets",
        value: "0",
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
    setBusinessType(getBusinessTypeFromStorage());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    return getStatCards(businessType);
  }, [businessType]);

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
            ]}
          />
        )}
      </div>
    </main>
  );
}
