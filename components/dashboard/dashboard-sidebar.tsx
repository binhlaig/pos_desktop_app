"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

import {
  type BusinessType,
  filterSidebarItemsByFeatures,
  getAllowedSidebarItemsByBusinessType,
} from "@/lib/business-type";
import { resolveCurrentBusinessType } from "@/components/dashboard/business-type-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarUser = {
  name: string;
  role: string;
  email: string;
};

const SIDEBAR_COLLAPSED_KEY = "binhlaig_dashboard_sidebar_collapsed";

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatBusinessType(type: BusinessType | null) {
  if (!type) return "Loading workspace";

  return String(type)
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function initials(name: string) {
  const result = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return result || "AD";
}

export function DashboardSidebar() {
  const pathname = usePathname();

  const [businessType, setBusinessType] =
    useState<BusinessType | null>(null);
  const [features, setFeatures] = useState<
    Record<string, unknown> | null
  >(null);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SidebarUser>({
    name: "Administrator",
    role: "Admin",
    email: "",
  });

  const navItems = useMemo(
    () =>
      filterSidebarItemsByFeatures(
        getAllowedSidebarItemsByBusinessType(businessType),
        features,
      ),
    [businessType, features],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    let active = true;

    resolveCurrentBusinessType()
      .then((type) => {
        if (active) setBusinessType(type);
      })
      .catch(() => {
        if (active) setBusinessType(null);
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
            : sessionRecord.features &&
                typeof sessionRecord.features === "object"
              ? (sessionRecord.features as Record<string, unknown>)
              : null;

        setFeatures(nextFeatures);
        setUser({
          name:
            textValue(userRecord.name) ||
            textValue(userRecord.username) ||
            textValue(sessionRecord.name) ||
            "Administrator",
          role:
            textValue(userRecord.role) ||
            textValue(sessionRecord.role) ||
            "Admin",
          email:
            textValue(userRecord.email) || textValue(sessionRecord.email),
        });
      })
      .catch(() => {
        if (active) setFeatures(null);
      });

    return () => {
      active = false;
    };
  }, []);

  function changeCollapsed(nextValue: boolean) {
    setCollapsed(nextValue);
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      String(nextValue),
    );
  }

  return (
    <aside
      className={cn(
        `
          sticky top-0 hidden h-screen shrink-0 overflow-hidden
          border-r border-white/10 text-white
          transition-[width] duration-300 ease-out
          lg:flex lg:flex-col
        `,
        collapsed ? "w-[78px]" : "w-[250px] xl:w-[268px]",
      )}
      style={{
        background: `linear-gradient(
          180deg,
          var(--brand-primary) 0%,
          color-mix(in srgb, var(--brand-primary) 88%, black) 52%,
          color-mix(in srgb, var(--brand-primary) 68%, black) 100%
        )`,
        boxShadow:
          "8px 0 30px color-mix(in srgb, var(--brand-primary) 16%, transparent)",
      }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-[78px] shrink-0 items-center border-b border-white/10",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "group flex min-w-0 items-center",
            collapsed ? "justify-center" : "gap-3",
          )}
          title={collapsed ? "Binhlaig POS" : undefined}
        >
          <span
            className="
              grid size-10 shrink-0 place-items-center rounded-xl
              bg-[var(--brand-accent)] text-sm font-black text-slate-950
              ring-1 ring-white/30 transition-transform
              group-hover:scale-[1.03]
            "
            style={{
              boxShadow:
                "0 8px 24px color-mix(in srgb, var(--brand-accent) 30%, transparent)",
            }}
          >
            B
          </span>

          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-wide text-white">
                Binhlaig POS
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-white/70">
                {formatBusinessType(businessType)}
              </span>
            </span>
          )}
        </Link>

        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => changeCollapsed(true)}
            className="size-8 shrink-0 rounded-lg text-white/70 hover:bg-white/10 hover:text-[var(--brand-accent)]"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>

      {/* Open collapsed sidebar */}
      {collapsed && (
        <div className="flex shrink-0 justify-center border-b border-white/10 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => changeCollapsed(false)}
            className="size-9 rounded-xl text-white/70 hover:bg-white/10 hover:text-[var(--brand-accent)]"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div
        className={cn(
          "sidebar-scrollbar flex-1 overflow-y-auto py-5",
          collapsed ? "px-2.5" : "px-3.5",
        )}
      >
        {!collapsed && (
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Management
          </p>
        )}

        <nav className="space-y-1.5" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/dashboard/register" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  `
                    group relative h-11 overflow-hidden rounded-xl
                    border border-transparent font-medium
                    transition-all duration-200
                  `,
                  collapsed
                    ? "w-full justify-center px-0"
                    : "w-full justify-start gap-3 px-3",
                  isActive
                    ? `
                      border-white/40 bg-[var(--brand-accent)] text-slate-950
                      shadow-md hover:bg-[var(--brand-accent)]
                      hover:text-slate-950
                    `
                    : `
                      text-white/80 hover:border-white/10
                      hover:bg-white/10 hover:text-white
                    `,
                )}
              >
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      `
                        grid size-7 shrink-0 place-items-center rounded-lg
                        transition-colors duration-200
                      `,
                      isActive
                        ? "bg-black/10 text-slate-950"
                        : "text-white/70 group-hover:bg-white/5 group-hover:text-[var(--brand-accent)]",
                    )}
                  >
                    <Icon className="size-[18px]"  />
                  </span>

                  {!collapsed && (
                    <span className="flex-1 truncate text-left text-[13px]">
                      {item.label}
                    </span>
                  )}

                  {!collapsed && isActive && (
                    <span className="size-1.5 shrink-0 rounded-full bg-slate-950" />
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Account */}
      <div
        className={cn(
          "shrink-0 border-t border-white/10",
          collapsed ? "p-2.5" : "p-3.5",
        )}
      >
        {collapsed ? (
          <div className="space-y-2">
            <div
              className="grid size-11 w-full place-items-center rounded-xl bg-[var(--brand-accent)] text-xs font-black text-slate-950"
              title={`${user.name} · ${user.role}`}
            >
              {initials(user.name)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void signOut({ callbackUrl: "/Sign_in" })}
              className="size-11 w-full rounded-xl text-white/70 hover:bg-red-500/15 hover:text-red-200"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-2.5 shadow-inner shadow-black/5">
            <div className="flex items-center gap-3 px-1 py-1">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-accent)] text-xs font-black text-slate-950">
                {initials(user.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">
                  {user.name}
                </span>
                <span className="mt-0.5 block truncate text-[10px] capitalize text-white/60">
                  {user.role.toLowerCase()}
                  {user.email ? ` · ${user.email}` : ""}
                </span>
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => void signOut({ callbackUrl: "/Sign_in" })}
              className="mt-2 h-9 w-full justify-start gap-2 rounded-xl px-3 text-xs font-medium text-white/70 hover:bg-red-500/15 hover:text-red-100"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
