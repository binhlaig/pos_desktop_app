
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import {
    Bell,
    Check,
    ChevronDown,
    LogOut,
    Menu,
    Palette,
    RotateCcw,
    Search,
    Settings,
    User,
    X,
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

type BrandColors = {
    name: string;
    primary: string;
    accent: string;
};

const BRAND_COLOR_STORAGE_KEY = "binhlaig_brand_colors";
const LEGACY_COLOR_STORAGE_KEY = "pos-dashboard-color";

const BRAND_PRESETS: BrandColors[] = [
    { name: "Binhlaig", primary: "#0B1F3A", accent: "#D4A017" },
    { name: "Ocean", primary: "#075985", accent: "#38BDF8" },
    { name: "Emerald", primary: "#064E3B", accent: "#34D399" },
    { name: "Violet", primary: "#4C1D95", accent: "#A78BFA" },
    { name: "Rose", primary: "#881337", accent: "#FB7185" },
    { name: "Amber", primary: "#78350F", accent: "#FBBF24" },
];
const DEFAULT_BRAND_COLORS = BRAND_PRESETS[0];

function isHexColor(value: unknown): value is string {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function getStoredBrandColors(): BrandColors {
    try {
        const stored = JSON.parse(
            window.localStorage.getItem(BRAND_COLOR_STORAGE_KEY) || "null",
        ) as Partial<BrandColors> | null;

        if (
            stored &&
            isHexColor(stored.primary) &&
            isHexColor(stored.accent)
        ) {
            return {
                name: stored.name || "Custom",
                primary: stored.primary.toUpperCase(),
                accent: stored.accent.toUpperCase(),
            };
        }
    } catch {
        // Invalid preferences fall back to a preset below.
    }

    const legacyColor = window.localStorage.getItem(LEGACY_COLOR_STORAGE_KEY);
    const legacyPreset = BRAND_PRESETS.find(
        (preset) => preset.name.toLowerCase() === legacyColor,
    );

    return legacyPreset || DEFAULT_BRAND_COLORS;
}

function applyBrandColors(colors: BrandColors) {
    const root = document.documentElement;
    const presetName = colors.name.toLowerCase();

    if (["blue", "violet", "emerald", "rose", "amber", "indigo"].includes(presetName)) {
        root.setAttribute("data-dashboard-color", presetName);
    } else {
        root.removeAttribute("data-dashboard-color");
    }

    root.style.setProperty("--brand-primary", colors.primary);
    root.style.setProperty("--brand-accent", colors.accent);
    root.style.setProperty("--dashboard-primary", colors.primary);
    root.style.setProperty("--dashboard-accent", colors.accent);
}

function saveBrandColors(colors: BrandColors) {
    window.localStorage.setItem(
        BRAND_COLOR_STORAGE_KEY,
        JSON.stringify(colors),
    );
    applyBrandColors(colors);
    window.dispatchEvent(
        new CustomEvent("brand-colors-changed", { detail: colors }),
    );
}

function DashboardColorPicker() {
    const [colors, setColors] = useState<BrandColors>(DEFAULT_BRAND_COLORS);
    const [open, setOpen] = useState(false);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const storedColors = getStoredBrandColors();
        setColors(storedColors);
        applyBrandColors(storedColors);
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    function updateColors(nextColors: BrandColors) {
        setColors(nextColors);
        saveBrandColors(nextColors);
    }

    function selectPreset(preset: BrandColors) {
        updateColors(preset);
    }

    function updateCustomColor(
        key: "primary" | "accent",
        value: string,
    ) {
        updateColors({
            ...colors,
            name: "Custom",
            [key]: value.toUpperCase(),
        });
    }

    function resetColors() {
        updateColors(DEFAULT_BRAND_COLORS);
        setOpen(false);
    }

    return (
        <div className="relative">
            <Button
                type="button"
                variant="outline"
                aria-label="Brand color ရွေးရန်"
                title="Brand color ရွေးရန်"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((previous) => !previous)}
                className="h-10 gap-2 rounded-xl border-[var(--brand-border)] bg-background px-3 hover:bg-[var(--brand-soft)]"
            >
                <Palette className="size-4" />
                <span className="hidden sm:inline">အရောင်</span>
                <span className="flex -space-x-1">
                    <span className="size-4 rounded-full border-2 border-background" style={{ backgroundColor: colors.primary }} />
                    <span className="size-4 rounded-full border-2 border-background" style={{ backgroundColor: colors.accent }} />
                </span>
            </Button>

            {open && (
                <>
                    <button
                        type="button"
                        aria-label="Close color menu"
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-[70] cursor-default"
                    />

                    <div
                        role="dialog"
                        aria-label="Brand color ရွေးရန်"
                        className="absolute right-0 top-[calc(100%+12px)] z-[80] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-4 shadow-xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                                        <Palette className="size-4" />
                                    </span>
                                    <p className="text-sm font-semibold">Brand color</p>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    Dashboard အတွက် main နှင့် accent အရောင်ရွေးပါ။
                                </p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} className="size-8 rounded-lg" aria-label="Close color picker">
                                <X className="size-4" />
                            </Button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {BRAND_PRESETS.map((preset) => {
                                const isSelected =
                                    preset.primary === colors.primary &&
                                    preset.accent === colors.accent;

                                return (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => selectPreset(preset)}
                                        className={cn(
                                            "flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition hover:bg-muted",
                                            isSelected
                                                ? "border-[var(--brand-primary)] bg-[var(--brand-soft)]"
                                                : "border-border",
                                        )}
                                    >
                                        <span className="flex shrink-0 -space-x-1">
                                            <span className="size-7 rounded-full border-2 border-popover" style={{ backgroundColor: preset.primary }} />
                                            <span className="size-7 rounded-full border-2 border-popover" style={{ backgroundColor: preset.accent }} />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{preset.name}</span>
                                        {isSelected && (
                                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)] text-white">
                                                <Check className="size-3" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 border-t border-border pt-4">
                            <p className="mb-3 text-xs font-semibold">Custom colors</p>
                            <div className="grid grid-cols-2 gap-3">
                                {([[
                                    "Main",
                                    "primary",
                                ], ["Accent", "accent"]] as const).map(([label, key]) => (
                                    <label key={key} className="text-xs font-medium">
                                        <span className="mb-1.5 block text-muted-foreground">{label}</span>
                                        <span className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-2">
                                            <input
                                                type="color"
                                                value={colors[key]}
                                                onChange={(event) => updateCustomColor(key, event.target.value)}
                                                className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                                                aria-label={`${label} color`}
                                            />
                                            <span className="min-w-0 truncate font-mono text-[10px] uppercase">{colors[key]}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)] p-3">
                            <span className="size-9 rounded-lg" style={{ backgroundColor: colors.primary }} />
                            <span className="size-9 rounded-lg" style={{ backgroundColor: colors.accent }} />
                            <div className="min-w-0">
                                <p className="truncate text-xs font-semibold">{colors.name}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{colors.primary} · {colors.accent}</p>
                            </div>
                        </div>

                        <Button type="button" variant="ghost" onClick={resetColors} className="mt-3 w-full justify-center gap-2 rounded-xl text-xs text-muted-foreground">
                            <RotateCcw className="size-3.5" />
                            Binhlaig main brand သို့ ပြန်ထားရန်
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

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

                {/* Whole dashboard color */}
                <DashboardColorPicker />

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
                bg-[var(--dashboard-primary)]
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
                      bg-muted
                      px-2 py-0.5
                      text-[10px]
                      font-semibold
                      text-[var(--dashboard-primary)]
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
                  bg-[var(--dashboard-primary)]
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
                                "hidden size-4 text-muted-foreground transition-transform md:block",
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





