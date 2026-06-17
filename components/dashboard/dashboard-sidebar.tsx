"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession } from "next-auth/react";

import {
  BusinessType,
  filterSidebarItemsByFeatures,
  getAllowedSidebarItemsByBusinessType,
} from "@/lib/business-type";
import { resolveCurrentBusinessType } from "@/components/dashboard/business-type-client";
import { cn } from "@/lib/utils";

export function DashboardSidebar() {
  const pathname = usePathname();
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [features, setFeatures] = useState<Record<string, unknown> | null>(
    null,
  );
  const navItems = filterSidebarItemsByFeatures(
    getAllowedSidebarItemsByBusinessType(businessType),
    features,
  );

  useEffect(() => {
    let active = true;

    resolveCurrentBusinessType().then((type) => {
      if (active) setBusinessType(type);
    });

    getSession()
      .then((session) => {
        if (!active) return;

        const sessionRecord =
          session && typeof session === "object"
            ? (session as unknown as Record<string, unknown>)
            : {};
        const userRecord =
          sessionRecord.user && typeof sessionRecord.user === "object"
            ? (sessionRecord.user as Record<string, unknown>)
            : {};
        const nextFeatures =
          userRecord.features && typeof userRecord.features === "object"
            ? (userRecord.features as Record<string, unknown>)
            : sessionRecord.features && typeof sessionRecord.features === "object"
              ? (sessionRecord.features as Record<string, unknown>)
              : null;

        setFeatures(nextFeatures);
      })
      .catch(() => {
        if (active) setFeatures(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-background px-3 py-4 lg:block">
      <div className="mb-5 px-2">
        <div className="text-sm font-black uppercase tracking-normal text-muted-foreground">
          POS Dashboard
        </div>
        <div className="mt-1 text-lg font-black text-foreground">
          {businessType || "Dashboard"}
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/dashboard/register" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition",
                active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
