
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import {
    Bell,
    ChevronDown,
    LogOut,
    Menu,
    Search,
    Settings,
    User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
    onMenuClick?: () => void;
};

type SessionUser = {
    name?: string;
    username?: string;
    role?: string;
    shopName?: string;
    shopCode?: string;
    image?: string;
};

function getPageTitle(pathname: string) {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.includes("/pos")) return "Point of Sale";
    if (pathname.includes("/products")) return "Products";
    if (pathname.includes("/inventory")) return "Inventory";
    if (pathname.includes("/receipts")) return "Receipts";
    if (pathname.includes("/analytics")) return "Analytics";
    if (pathname.includes("/staff")) return "Staff";
    if (pathname.includes("/settings")) return "Settings";
    if (pathname.includes("/tasks")) return "Tasks";

    return "POS Dashboard";
}

export function DashboardHeader({
    onMenuClick,
}: DashboardHeaderProps) {
    const pathname = usePathname();

    const [user, setUser] = useState<SessionUser | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);

    const pageTitle = getPageTitle(pathname);

    useEffect(() => {
        let active = true;

        getSession()
            .then((session) => {
                if (!active || !session) return;

                const sessionRecord = session as unknown as Record<string, unknown>;

                const userRecord =
                    sessionRecord.user &&
                        typeof sessionRecord.user === "object"
                        ? (sessionRecord.user as Record<string, unknown>)
                        : {};

                if (!active) return;

                setUser({
                    name:
                        typeof userRecord.name === "string"
                            ? userRecord.name
                            : undefined,

                    username:
                        typeof userRecord.username === "string"
                            ? userRecord.username
                            : undefined,

                    role:
                        typeof userRecord.role === "string"
                            ? userRecord.role
                            : typeof sessionRecord.role === "string"
                                ? sessionRecord.role
                                : undefined,

                    shopName:
                        typeof userRecord.shopName === "string"
                            ? userRecord.shopName
                            : typeof sessionRecord.shopName === "string"
                                ? sessionRecord.shopName
                                : undefined,

                    shopCode:
                        typeof userRecord.shopCode === "string"
                            ? userRecord.shopCode
                            : typeof sessionRecord.shopCode === "string"
                                ? sessionRecord.shopCode
                                : undefined,

                    image:
                        typeof userRecord.image === "string"
                            ? userRecord.image
                            : undefined,
                });
            })
            .catch(() => {
                if (active) {
                    setUser(null);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const displayName =
        user?.name ||
        user?.username ||
        "POS User";

    const initials = displayName
        .split(" ")
        .map((item) => item.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <header
            className="
        sticky top-0 z-40
        flex h-[72px] w-full
        items-center justify-between
        border-b border-border/60
        bg-background/95
        px-4
        backdrop-blur
        md:px-5
        lg:px-6
      "
        >
            {/* Left */}
            <div className="flex min-w-0 items-center gap-3">
                {/* Mobile menu */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="shrink-0 rounded-xl lg:hidden"
                >
                    <Menu className="size-5" />
                </Button>

                {/* Page title */}
                <div className="min-w-0">
                    <h1 className="truncate text-base font-bold text-foreground md:text-lg">
                        {pageTitle}
                    </h1>

                    <div className="hidden items-center gap-2 sm:flex">
                        {user?.shopName && (
                            <span className="truncate text-xs text-muted-foreground">
                                {user.shopName}
                            </span>
                        )}

                        {user?.shopCode && (
                            <>
                                <span className="text-border">•</span>

                                <span className="text-xs text-muted-foreground">
                                    {user.shopCode}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Center Search */}
            <div className="mx-6 hidden w-full max-w-md lg:block">
                <div className="relative">
                    <Search
                        className="
              absolute left-3 top-1/2
              size-4
              -translate-y-1/2
              text-muted-foreground
            "
                    />

                    <Input
                        type="search"
                        placeholder="Search products, receipts, staff..."
                        className="
              h-10
              rounded-xl
              border-border/60
              bg-muted/40
              pl-9
              pr-12
              shadow-none
              transition
              focus-visible:bg-background
            "
                    />

                    <div
                        className="
              absolute right-2 top-1/2
              hidden h-6
              -translate-y-1/2
              items-center
              rounded-md
              border border-border
              bg-background
              px-2
              text-[10px]
              font-medium
              text-muted-foreground
              xl:flex
            "
                    >
                        Ctrl K
                    </div>
                </div>
            </div>

            {/* Right */}
            <div className="flex shrink-0 items-center gap-1.5">
                {/* Search mobile */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl lg:hidden"
                >
                    <Search className="size-5" />
                </Button>

                {/* Notifications */}
                <div className="relative">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setNotificationOpen((prev) => !prev);
                            setProfileOpen(false);
                        }}
                        className="relative rounded-xl"
                    >
                        <Bell className="size-5" />

                        <span
                            className="
                absolute right-2 top-2
                size-2
                rounded-full
                bg-primary
                ring-2 ring-background
              "
                        />
                    </Button>

                    {notificationOpen && (
                        <div
                            className="
                absolute right-0 top-[52px]
                w-[320px]
                overflow-hidden
                rounded-2xl
                border border-border
                bg-popover
                shadow-xl
              "
                        >
                            <div className="border-b border-border/60 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">
                                        Notifications
                                    </p>

                                    <span
                                        className="
                      rounded-full
                      bg-primary/10
                      px-2 py-0.5
                      text-[10px]
                      font-semibold
                      text-primary
                    "
                                    >
                                        3 New
                                    </span>
                                </div>
                            </div>

                            <div className="p-2">
                                <button
                                    type="button"
                                    className="
                    w-full rounded-xl
                    px-3 py-3
                    text-left
                    transition
                    hover:bg-muted
                  "
                                >
                                    <p className="text-sm font-medium">
                                        Low stock alert
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Some products are running low.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    className="
                    w-full rounded-xl
                    px-3 py-3
                    text-left
                    transition
                    hover:bg-muted
                  "
                                >
                                    <p className="text-sm font-medium">
                                        New receipt created
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        A new POS transaction was completed.
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="mx-1 hidden h-7 w-px bg-border md:block" />

                {/* Profile */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setProfileOpen((prev) => !prev);
                            setNotificationOpen(false);
                        }}
                        className="
              flex items-center gap-2
              rounded-xl
              p-1.5
              text-left
              transition
              hover:bg-muted
            "
                    >
                        {/* Avatar */}
                        {user?.image ? (
                            <img
                                src={user.image}
                                alt={displayName}
                                className="
                  size-9
                  rounded-xl
                  object-cover
                  ring-1 ring-border
                "
                            />
                        ) : (
                            <div
                                className="
                  flex size-9
                  items-center justify-center
                  rounded-xl
                  bg-primary
                  text-xs
                  font-bold
                  text-primary-foreground
                "
                            >
                                {initials || "U"}
                            </div>
                        )}

                        <div className="hidden min-w-0 md:block">
                            <p
                                className="
                  max-w-[120px]
                  truncate
                  text-xs
                  font-semibold
                  text-foreground
                "
                            >
                                {displayName}
                            </p>

                            <p
                                className="
                  max-w-[120px]
                  truncate
                  text-[10px]
                  uppercase
                  tracking-wide
                  text-muted-foreground
                "
                            >
                                {user?.role || "User"}
                            </p>
                        </div>

                        <ChevronDown
                            className={cn(
                                `
                  hidden size - 4
text - muted - foreground
transition - transform
md: block
    `,
                                profileOpen && "rotate-180",
                            )}
                        />
                    </button>

                    {profileOpen && (
                        <div
                            className="
                absolute right-0 top-[54px]
                w-[230px]
                overflow-hidden
                rounded-2xl
                border border-border
                bg-popover
                p-1.5
                shadow-xl
              "
                        >
                            <div className="border-b border-border/60 px-3 py-3">
                                <p className="truncate text-sm font-semibold">
                                    {displayName}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {user?.shopName || "Binhlaig POS"}
                                </p>
                            </div>

                            <div className="py-1">
                                <button
                                    type="button"
                                    className="
                    flex w-full
                    items-center gap-3
                    rounded-lg
                    px-3 py-2
                    text-sm
                    text-muted-foreground
                    transition
                    hover:bg-muted
                    hover:text-foreground
                  "
                                >
                                    <User className="size-4" />
                                    Profile
                                </button>

                                <button
                                    type="button"
                                    className="
                    flex w-full
                    items-center gap-3
                    rounded-lg
                    px-3 py-2
                    text-sm
                    text-muted-foreground
                    transition
                    hover:bg-muted
                    hover:text-foreground
                  "
                                >
                                    <Settings className="size-4" />
                                    Settings
                                </button>
                            </div>

                            <div className="border-t border-border/60 pt-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        signOut({
                                            callbackUrl: "/Sign_in",
                                        })
                                    }
                                    className="
                    flex w-full
                    items-center gap-3
                    rounded-lg
                    px-3 py-2
                    text-sm
                    text-destructive
                    transition
                    hover:bg-destructive/10
                  "
                                >
                                    <LogOut className="size-4" />
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
