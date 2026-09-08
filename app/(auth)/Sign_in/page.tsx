
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Home,
  Loader2,
  Lock,
  Moon,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Sunrise,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveCurrentBusinessType } from "@/components/dashboard/business-type-client";
import { clearStoredAuthData } from "@/lib/auth-storage";
import {
  getHomePathByBusinessType,
  pickBusinessType,
  storeBusinessType,
} from "@/lib/business-type";

/* =========================
   Config
========================= */

const ACCESS_TOKEN_KEY = "pos_access_token";
const OWNER_PROFILE_KEY = "pos_shop_owner_profile";
const OWNER_THEME_KEY = "pos_owner_login_theme";

/* =========================
   Types
========================= */

type ThemeMode = "night" | "day" | "light";

/* =========================
   Theme
========================= */

function getTheme(theme: ThemeMode) {
  if (theme === "light") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_38%,#eef2ff_76%,#fff7ed_100%)] text-slate-950",
      card:
        "border-slate-200/80 bg-gradient-to-b from-white/90 to-white/60 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]",
      cardHover:
        "hover:shadow-[0_0_0_1px_rgba(14,165,233,0.10),0_18px_42px_-18px_rgba(14,165,233,0.45)]",
      glow:
        "radial-gradient(120px 80px at 20% 0%, rgba(56,189,248,0.20), transparent 60%), radial-gradient(120px 80px at 80% 100%, rgba(99,102,241,0.16), transparent 60%)",
      badge:
        "border-slate-200/80 bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl",
      title: "text-slate-950",
      body: "text-slate-600",
      muted: "text-slate-500",
      smallCard: "border-slate-200/80 bg-white/60",
      smallIcon: "bg-sky-100 text-sky-600",
      inputWrap:
        "border-slate-200 bg-white/75 focus-within:border-sky-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100",
      inputText: "text-slate-950 placeholder:text-slate-400",
      inputIcon: "text-slate-400",
      mutedBox: "border-slate-200 bg-slate-50/80",
      topLine: "via-sky-500/45",
      grid:
        "bg-[linear-gradient(to_right,rgba(15,23,42,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.10)_1px,transparent_1px)] opacity-[0.11]",
      button:
        "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-[0_15px_35px_-18px_rgba(2,132,199,0.9)] hover:from-sky-500 hover:to-indigo-500",
      checkOn: "border-sky-500 bg-sky-500",
      checkOff: "border-slate-300 bg-white",
    };
  }

  if (theme === "day") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,#ecfeff_34%,#f0f9ff_68%,#fff7ed_100%)] text-slate-950",
      card:
        "border-white/80 bg-gradient-to-b from-white/85 to-amber-50/55 shadow-[0_28px_85px_-42px_rgba(245,158,11,0.50)]",
      cardHover:
        "hover:shadow-[0_0_0_1px_rgba(245,158,11,0.10),0_18px_42px_-18px_rgba(245,158,11,0.50)]",
      glow:
        "radial-gradient(120px 80px at 20% 0%, rgba(251,191,36,0.30), transparent 60%), radial-gradient(120px 80px at 80% 100%, rgba(14,165,233,0.20), transparent 60%)",
      badge:
        "border-white/80 bg-white/60 text-slate-700 shadow-sm backdrop-blur-xl",
      title: "text-slate-950",
      body: "text-slate-600",
      muted: "text-slate-500",
      smallCard: "border-white/80 bg-white/55",
      smallIcon: "bg-amber-100 text-amber-600",
      inputWrap:
        "border-amber-100 bg-white/70 focus-within:border-amber-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-100",
      inputText: "text-slate-950 placeholder:text-slate-400",
      inputIcon: "text-amber-500",
      mutedBox: "border-amber-100 bg-amber-50/65",
      topLine: "via-amber-500/45",
      grid:
        "bg-[linear-gradient(to_right,rgba(120,53,15,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,53,15,0.10)_1px,transparent_1px)] opacity-[0.11]",
      button:
        "bg-gradient-to-r from-amber-500 via-orange-500 to-sky-500 text-white shadow-[0_15px_35px_-18px_rgba(245,158,11,0.9)] hover:from-amber-400 hover:via-orange-400 hover:to-sky-400",
      checkOn: "border-amber-500 bg-amber-500",
      checkOff: "border-amber-200 bg-white",
    };
  }

  return {
    page:
      "bg-[radial-gradient(circle_at_top_left,#0f172a_0%,#020617_42%,#111827_72%,#020617_100%)] text-white",
    card:
      "border-white/10 bg-gradient-to-b from-white/10 to-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_10px_24px_-12px_rgba(59,130,246,0.25)]",
    cardHover:
      "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_-16px_rgba(59,130,246,0.35)]",
    glow:
      "radial-gradient(120px 80px at 20% 0%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(120px 80px at 80% 100%, rgba(99,102,241,0.22), transparent 60%)",
    badge: "border-white/10 bg-white/5 text-slate-300",
    title: "text-white",
    body: "text-slate-300",
    muted: "text-slate-400",
    smallCard: "border-white/10 bg-white/5",
    smallIcon: "bg-white/10 text-sky-300",
    inputWrap:
      "border-white/10 bg-white/5 focus-within:border-sky-400/50 focus-within:bg-white/10",
    inputText: "text-white placeholder:text-slate-500",
    inputIcon: "text-slate-400",
    mutedBox: "border-white/10 bg-white/5",
    topLine: "via-white/50",
    grid:
      "bg-[linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] opacity-[0.08]",
    button:
      "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-[0_15px_35px_-18px_rgba(56,189,248,0.9)] hover:from-sky-400 hover:to-indigo-400",
    checkOn: "border-sky-400 bg-sky-400",
    checkOff: "border-white/20 bg-transparent",
  };
}

/* =========================
   Glow Card
========================= */

const Glow = ({
  children,
  className = "",
  hover = true,
  theme,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  theme: ThemeMode;
}) => {
  const t = getTheme(theme);

  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.01 } : {}}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl ${t.card} ${
        hover ? t.cardHover : ""
      } ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-2xl transition-opacity duration-300 hover:opacity-60"
        style={{ background: t.glow }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/* =========================
   Background
========================= */

const BeamBackground = ({ theme }: { theme: ThemeMode }) => {
  const t = getTheme(theme);

  const isNight = theme === "night";
  const isDay = theme === "day";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-24 left-0 h-[40vh] w-[50vw] rounded-full blur-3xl opacity-60"
        style={{
          background: isNight
            ? "radial-gradient(600px 300px at 20% 0%, rgba(56,189,248,0.22), transparent 60%)"
            : isDay
            ? "radial-gradient(600px 300px at 20% 0%, rgba(251,191,36,0.34), transparent 60%)"
            : "radial-gradient(600px 300px at 20% 0%, rgba(56,189,248,0.30), transparent 60%)",
        }}
      />

      <div
        className="absolute bottom-[-10vh] right-0 h-[45vh] w-[55vw] rounded-full blur-3xl opacity-60"
        style={{
          background: isNight
            ? "radial-gradient(600px 300px at 80% 100%, rgba(99,102,241,0.20), transparent 60%)"
            : isDay
            ? "radial-gradient(600px 300px at 80% 100%, rgba(14,165,233,0.24), transparent 60%)"
            : "radial-gradient(600px 300px at 80% 100%, rgba(99,102,241,0.24), transparent 60%)",
        }}
      />

      <div className="absolute inset-x-0 top-0 h-px">
        <motion.div
          className={`mx-auto h-px w-1/3 bg-gradient-to-r from-transparent ${t.topLine} to-transparent`}
          animate={{ y: ["0%", "1200%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="[mask-image:radial-gradient(500px_300px_at_center,black,transparent)] absolute inset-0">
        <div className={`h-full w-full bg-[size:36px_36px] ${t.grid}`} />
      </div>

      {isNight && (
        <>
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white"
              style={{
                left: `${8 + ((i * 37) % 86)}%`,
                top: `${8 + ((i * 19) % 62)}%`,
              }}
              animate={{
                opacity: [0.12, 0.9, 0.2],
                scale: [0.75, 1.25, 0.75],
              }}
              transition={{
                duration: 2.2 + (i % 4) * 0.35,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}

      {isDay && (
        <motion.div
          className="absolute right-[10%] top-[10%] h-24 w-24 rounded-full bg-amber-300/55 blur-2xl"
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.55, 0.85, 0.55],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
};

/* =========================
   Page
========================= */

export default function ShopOwnerLoginPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<ThemeMode>("night");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopCode, setShopCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);

  const t = getTheme(theme);

  const canSubmit = useMemo(() => {
    return (
      username.trim().length > 0 &&
      password.trim().length > 0 &&
      shopCode.trim().length > 0 &&
      !loading
    );
  }, [username, password, shopCode, loading]);

  useEffect(() => {
    const savedTheme = localStorage.getItem(OWNER_THEME_KEY) as ThemeMode | null;

    if (savedTheme === "night" || savedTheme === "day" || savedTheme === "light") {
      setTheme(savedTheme);
    }

    let active = true;

    getSession().then(async (session) => {
      const sessionRecord =
        session && typeof session === "object"
          ? (session as unknown as Record<string, unknown>)
          : {};
      const hasSessionToken = typeof sessionRecord.accessToken === "string";
      const hasSessionError = Boolean(sessionRecord.error);

      if (active && session && hasSessionToken && !hasSessionError) {
        const businessType =
          pickBusinessType(session) || (await resolveCurrentBusinessType());
        if (!active) return;
        if (businessType) storeBusinessType(businessType);

        router.replace(getHomePathByBusinessType(businessType));
        return;
      }

      if (active) clearStoredAuthData();
    });

    return () => {
      active = false;
    };
  }, [router]);

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    localStorage.setItem(OWNER_THEME_KEY, nextTheme);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!username.trim() || !password.trim() || !shopCode.trim()) {
      toast.error("Username, Password နှင့် Shop Code ဖြည့်ပါ။");
      return;
    }

    try {
      setLoading(true);

      const result = await signIn("credentials", {
        redirect: false,
        username: username.trim(),
        password,
        shopCode: shopCode.trim().toUpperCase(),
      });

      if (result?.error) {
        throw new Error(
          "Login ဝင်မရပါ။ Username, Password သို့မဟုတ် Shop Code ကိုစစ်ပါ။"
        );
      }

      if (!result?.ok) {
        throw new Error("Login error ဖြစ်နေပါတယ်။ Backend API ကိုစစ်ပါ။");
      }

      const session = await getSession();
      const sessionRecord =
        session && typeof session === "object"
          ? (session as unknown as Record<string, unknown>)
          : {};
      const token =
        typeof sessionRecord.accessToken === "string"
          ? sessionRecord.accessToken
          : "";

      if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      }

      if (remember) {
        localStorage.setItem("pos_owner_remember", "true");
        localStorage.setItem(
          OWNER_PROFILE_KEY,
          JSON.stringify({
            username: username.trim(),
            shopCode: shopCode.trim().toUpperCase(),
          })
        );
      } else {
        localStorage.removeItem("pos_owner_remember");
        localStorage.removeItem(OWNER_PROFILE_KEY);
      }

      toast.success("Login အောင်မြင်ပါသည်။");
      const businessType = await resolveCurrentBusinessType();
      router.replace(getHomePathByBusinessType(businessType));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login error ဖြစ်နေပါတယ်။";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`min-h-[100dvh] overflow-hidden ${t.page}`}>
      <BeamBackground theme={theme} />

      <div className="mx-auto flex min-h-[100dvh] max-w-6xl items-center px-4 py-6 md:px-6">
        <div className="w-full">
          {/* Top Bar */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={`gap-1 rounded-full border px-3 py-1.5 ${t.badge}`}
            >
              <Home className="h-3.5 w-3.5" />
              <Link href="/dashboard" className="underline underline-offset-4">
                Back to Home
              </Link>
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <ThemeButton
                active={theme === "night"}
                label="Night"
                icon={<Moon className="h-3.5 w-3.5" />}
                onClick={() => changeTheme("night")}
                theme={theme}
              />

              <ThemeButton
                active={theme === "day"}
                label="Day"
                icon={<Sunrise className="h-3.5 w-3.5" />}
                onClick={() => changeTheme("day")}
                theme={theme}
              />

              <ThemeButton
                active={theme === "light"}
                label="Light"
                icon={<Sun className="h-3.5 w-3.5" />}
                onClick={() => changeTheme("light")}
                theme={theme}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_430px]">
            {/* Left Animated Intro Card */}
            <motion.section
              initial={{ opacity: 0, x: -42, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{
                duration: 0.75,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="hidden lg:block"
            >
              <Glow className="relative p-6" hover={false} theme={theme}>
                <motion.div
                  aria-hidden
                  className="absolute right-8 top-8 h-20 w-20 rounded-full bg-sky-400/10 blur-xl"
                  animate={{
                    y: [0, -12, 0],
                    scale: [1, 1.12, 1],
                    opacity: [0.45, 0.85, 0.45],
                  }}
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <motion.div
                  aria-hidden
                  className="absolute bottom-10 left-10 h-24 w-24 rounded-full bg-indigo-400/10 blur-xl"
                  animate={{
                    y: [0, 14, 0],
                    scale: [1, 1.18, 1],
                    opacity: [0.35, 0.75, 0.35],
                  }}
                  transition={{
                    duration: 5.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <motion.div
                  aria-hidden
                  className={`absolute right-10 bottom-12 hidden h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_0_32px_-12px_rgba(56,189,248,0.85)] md:flex ${
                    theme === "night"
                      ? "border-white/10 bg-white/5 text-sky-300"
                      : "border-slate-200 bg-white/60 text-sky-600"
                  }`}
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 3, 0],
                  }}
                  transition={{
                    duration: 4.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Store className="h-7 w-7" />
                </motion.div>

                <div className="relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.45 }}
                    className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${t.badge}`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    POS Register System
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.55 }}
                    className={`max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-5xl ${t.title}`}
                  >
                    <motion.span
                      animate={{
                        textShadow: [
                          "0 0 0px rgba(56,189,248,0)",
                          "0 0 22px rgba(56,189,248,0.28)",
                          "0 0 0px rgba(56,189,248,0)",
                        ],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      Shop Owner Login
                    </motion.span>

                    <span className="mt-2 block bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                      Register Control Panel
                    </span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32, duration: 0.55 }}
                    className={`mt-5 max-w-xl text-sm leading-7 ${t.body}`}
                  >
                    ဆိုင်ပိုင်ရှင် Login ဝင်ပြီး register, cash drawer, product,
                    sales, staff data တွေကို shop_id / shop_code အလိုက်
                    သီးသန့်စီမံနိုင်ရန် တည်ဆောက်ထားသော page ဖြစ်ပါတယ်။
                  </motion.p>

                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: {
                        transition: {
                          staggerChildren: 0.13,
                          delayChildren: 0.45,
                        },
                      },
                    }}
                    className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3"
                  >
                    <AnimatedMiniStat
                      icon={<Receipt className="h-4 w-4" />}
                      title="Register"
                      text="Sales counter"
                      theme={theme}
                    />
                    <AnimatedMiniStat
                      icon={<WalletCards className="h-4 w-4" />}
                      title="Cash Drawer"
                      text="Cash control"
                      theme={theme}
                    />
                    <AnimatedMiniStat
                      icon={<Building2 className="h-4 w-4" />}
                      title="Shop Scope"
                      text="Owner data only"
                      theme={theme}
                    />
                  </motion.div>
                </div>
              </Glow>
            </motion.section>

            {/* Right Login Card */}
            <motion.section
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45 }}
            >
              <Glow className="p-4" hover={false} theme={theme}>
                <CardHeader className="pb-4 text-center">
                  <motion.div
                    initial={{ scale: 0.9, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 180, damping: 12 }}
                    className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-[0_0_35px_-10px_rgba(56,189,248,0.8)] ${
                      theme === "night"
                        ? "border-white/10 bg-white/10"
                        : theme === "day"
                        ? "border-amber-100 bg-amber-50"
                        : "border-sky-100 bg-sky-50"
                    }`}
                  >
                    <Store
                      className={`h-8 w-8 ${
                        theme === "day" ? "text-amber-500" : "text-sky-500"
                      }`}
                    />
                  </motion.div>

                  <CardTitle className={`text-2xl font-black ${t.title}`}>
                    Owner Login
                  </CardTitle>

                  <CardDescription className={t.muted}>
                    POS Register ထဲဝင်ရန် account ဖြင့် login ဝင်ပါ။
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label className={`text-xs font-semibold ${t.body}`}>
                        Username
                      </Label>

                      <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${t.inputWrap}`}
                      >
                        <UserRound className={`h-4 w-4 ${t.inputIcon}`} />

                        <Input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="ဥပမာ - test22"
                          autoComplete="username"
                          className={`h-8 border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0 ${t.inputText}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className={`text-xs font-semibold ${t.body}`}>
                        Shop Code
                      </Label>

                      <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${t.inputWrap}`}
                      >
                        <Building2 className={`h-4 w-4 ${t.inputIcon}`} />

                        <Input
                          value={shopCode}
                          onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                          placeholder="ဥပမာ - SHOP001"
                          autoComplete="organization"
                          className={`h-8 border-0 bg-transparent px-0 text-sm font-medium uppercase focus-visible:ring-0 ${t.inputText}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className={`text-xs font-semibold ${t.body}`}>
                        Password
                      </Label>

                      <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${t.inputWrap}`}
                      >
                        <Lock className={`h-4 w-4 ${t.inputIcon}`} />

                        <Input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type={showPassword ? "text" : "password"}
                          placeholder="Password ထည့်ပါ"
                          autoComplete="current-password"
                          className={`h-8 border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0 ${t.inputText}`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className={`rounded-lg p-1.5 transition ${
                            theme === "night"
                              ? "text-slate-400 hover:bg-white/10 hover:text-white"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${t.mutedBox}`}
                    >
                      <button
                        type="button"
                        onClick={() => setRemember((v) => !v)}
                        className={`flex items-center gap-2 text-xs font-medium ${t.body}`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            remember ? t.checkOn : t.checkOff
                          }`}
                        >
                          {remember && <Check className="h-3 w-3 text-white" />}
                        </span>
                        Remember me
                      </button>

                      <span className={`text-xs ${t.muted}`}>
                        Secure owner login
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className={`group h-11 w-full rounded-full text-sm font-bold transition disabled:opacity-50 ${t.button}`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Login ဝင်နေသည်...
                        </>
                      ) : (
                        <>
                          Login ဝင်မည်
                          <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className={`mt-5 rounded-xl border p-3 ${t.mutedBox}`}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          theme === "night"
                            ? "bg-sky-400/10 text-sky-300"
                            : "bg-sky-100 text-sky-600"
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </div>

                      <div>
                        <div className={`text-sm font-semibold ${t.title}`}>
                          JWT Authorization
                        </div>

                        <p className={`mt-1 text-xs leading-5 ${t.muted}`}>
                          Login အောင်မြင်ပြီးရင် token ကို localStorage ထဲသိမ်းပြီး
                          Register API တွေကို Bearer token နဲ့ခေါ်နိုင်ပါတယ်။
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className={`mt-5 text-center text-[11px] ${t.muted}`}>
                    POS Register · Shop Owner Panel
                  </p>
                </CardContent>
              </Glow>
            </motion.section>
          </div>
        </div>
      </div>
    </main>
  );
}

/* =========================
   Theme Button
========================= */

function ThemeButton({
  active,
  label,
  icon,
  onClick,
  theme,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  theme: ThemeMode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-sky-400 bg-sky-500 text-white shadow-[0_12px_30px_-18px_rgba(14,165,233,0.9)]"
          : theme === "night"
          ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          : "border-slate-200 bg-white/60 text-slate-700 hover:bg-white"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* =========================
   Animated Mini Stat
========================= */

function AnimatedMiniStat({
  icon,
  title,
  text,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  theme: ThemeMode;
}) {
  const t = getTheme(theme);

  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: 22,
          scale: 0.94,
        },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
        },
      }}
      whileHover={{
        y: -6,
        scale: 1.035,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      className={`group relative overflow-hidden rounded-xl border p-3 ${t.smallCard}`}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            theme === "night"
              ? "radial-gradient(140px 80px at 20% 0%, rgba(56,189,248,0.18), transparent 60%)"
              : "radial-gradient(140px 80px at 20% 0%, rgba(14,165,233,0.16), transparent 60%)",
        }}
      />

      <div className="relative z-10">
        <motion.div
          animate={{
            y: [0, -3, 0],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${t.smallIcon}`}
        >
          {icon}
        </motion.div>

        <div className={`text-sm font-bold ${t.title}`}>{title}</div>
        <div className={`mt-1 text-xs ${t.muted}`}>{text}</div>
      </div>
    </motion.div>
  );
}
