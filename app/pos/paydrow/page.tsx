"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Minus,
  Download,
  Upload,
  Trash2,
  Lock,
  Unlock,
  JapaneseYen,
  ShieldCheck,
  Receipt,
  Banknote,
  Home,
} from "lucide-react";
import Link from "next/link";

/* ====== Types & Keys ====== */
type StaffRole = "staff" | "supervise";

type Denom = {
  label: string;
  value: number; // JPY face value
  kind: "bill" | "coin";
};

type DrawerState = {
  counts: Record<number, number>; // face value -> qty
  notes?: string;
  // running transactions for audit
  tx: Array<{
    id: string;
    t: number;
    type: "cash_in" | "cash_out" | "safe_drop" | "adjust";
    amount: number;
    memo?: string;
  }>;
};

const CASH_KEY = "pos_cash_drawer_v1";

/* Japan denominations (incl. ¥2000 note for rare cases) */
const DENOMS: Denom[] = [
  { label: "¥10,000", value: 10000, kind: "bill" },
  { label: "¥5,000", value: 5000, kind: "bill" },
  { label: "¥2,000", value: 2000, kind: "bill" },
  { label: "¥1,000", value: 1000, kind: "bill" },
  { label: "¥500", value: 500, kind: "coin" },
  { label: "¥100", value: 100, kind: "coin" },
  { label: "¥50", value: 50, kind: "coin" },
  { label: "¥10", value: 10, kind: "coin" },
  { label: "¥5", value: 5, kind: "coin" },
  { label: "¥1", value: 1, kind: "coin" },
];

const jpy = (n: number) =>
  n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

/* ====== Helpers ====== */
const loadDrawer = (): DrawerState => {
  try {
    const raw = localStorage.getItem(CASH_KEY);
    if (!raw) {
      return { counts: {}, notes: "", tx: [] };
    }
    const parsed = JSON.parse(raw) as DrawerState;
    return {
      counts: parsed.counts || {},
      notes: parsed.notes || "",
      tx: parsed.tx || [],
    };
  } catch {
    return { counts: {}, notes: "", tx: [] };
  }
};
const saveDrawer = (s: DrawerState) =>
  localStorage.setItem(CASH_KEY, JSON.stringify(s));
const uid = () => Math.random().toString(36).slice(2, 10);

const Glow = ({
  children,
  className = "",
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) => (
  <motion.div
    whileHover={hover ? { y: -2, scale: 1.01 } : {}}
    transition={{ type: "spring", stiffness: 260, damping: 20 }}
    className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.04]
        shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_10px_24px_-12px_rgba(59,130,246,0.25)]
        ${
          hover
            ? "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_-16px_rgba(59,130,246,0.35)]"
            : ""
        }
        ${className}`}
  >
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-2xl transition-opacity duration-300 hover:opacity-60"
      style={{
        background:
          "radial-gradient(120px 80px at 20% 0%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(120px 80px at 80% 100%, rgba(99,102,241,0.22), transparent 60%)",
      }}
    />
    <div className="relative z-10">{children}</div>
  </motion.div>
);

const BeamBackground = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
    <div
      className="absolute -top-24 left-0 h-[40vh] w-[50vw] rounded-full blur-3xl opacity-50"
      style={{
        background:
          "radial-gradient(600px 300px at 20% 0%, rgba(56,189,248,0.22), transparent 60%)",
      }}
    />
    <div
      className="absolute bottom-[-10vh] right-0 h-[45vh] w-[55vw] rounded-full blur-3xl opacity-50"
      style={{
        background:
          "radial-gradient(600px 300px at 80% 100%, rgba(99,102,241,0.20), transparent 60%)",
      }}
    />
    <div className="absolute inset-x-0 top-0 h-px">
      <motion.div
        className="h-px w-1/3 mx-auto bg-gradient-to-r from-transparent via-white/50 to-transparent"
        animate={{ y: ["0%", "1200%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
    <div className="[mask-image:radial-gradient(500px_300px_at_center,black,transparent)] absolute inset-0 opacity-[0.08]">
      <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:36px_36px]" />
    </div>
  </div>
);

/* ====== Page ====== */
export default function RegisterCashPage() {
  const [role, setRole] = useState<StaffRole>("staff");
  const isSupervisor = role === "supervise";
  const [drawer, setDrawer] = useState<DrawerState>({
    counts: {},
    notes: "",
    tx: [],
  });

  /* load role + state */
  useEffect(() => {
    const r = (localStorage.getItem("pos_staff_role") as StaffRole) || "staff";
    setRole(r);
    setDrawer(loadDrawer());
  }, []);

  /* totals */
  const total = useMemo(() => {
    return DENOMS.reduce(
      (sum, d) => sum + (drawer.counts[d.value] || 0) * d.value,
      0
    );
  }, [drawer.counts]);

  const billTotal = useMemo(
    () =>
      DENOMS.filter((d) => d.kind === "bill").reduce(
        (s, d) => s + (drawer.counts[d.value] || 0) * d.value,
        0
      ),
    [drawer.counts]
  );
  const coinTotal = useMemo(
    () =>
      DENOMS.filter((d) => d.kind === "coin").reduce(
        (s, d) => s + (drawer.counts[d.value] || 0) * d.value,
        0
      ),
    [drawer.counts]
  );

  /* actions */
  const setQty = (den: number, qty: number) => {
    setDrawer((prev) => {
      const next = {
        ...prev,
        counts: { ...prev.counts, [den]: Math.max(0, Math.min(9999, qty)) },
      };
      saveDrawer(next);
      return next;
    });
  };

  const nudge = (den: number, delta: number) => {
    const current = drawer.counts[den] || 0;
    setQty(den, current + delta);
  };

  const txAdd = (
    type: DrawerState["tx"][number]["type"],
    amount: number,
    memo?: string
  ) => {
    const sign =
      type === "cash_in"
        ? +1
        : type === "cash_out" || type === "safe_drop"
        ? -1
        : 0;
    const ok = sign === 0 ? true : sign > 0 || total + sign * amount >= 0;
    if (!ok) {
      toast.error("Not enough cash in drawer");
      return;
    }
    setDrawer((prev) => {
      const nextTx = {
        id: uid(),
        t: Date.now(),
        type,
        amount: Math.abs(amount),
        memo,
      };
      const nextTotal = total + sign * amount;
      // naive distribute into ¥1000 as placeholder for adjust log only (we keep counts unchanged for tx log)
      const next = { ...prev, tx: [nextTx, ...prev.tx] };
      saveDrawer(next);
      toast.success(
        `${
          type === "cash_in"
            ? "Cash In"
            : type === "cash_out"
            ? "Cash Out"
            : type === "safe_drop"
            ? "Safe Drop"
            : "Adjust"
        }: ${jpy(amount)}`
      );
      return next;
    });
  };

  const exportJSON = () => {
    if (!isSupervisor) return toast.error("Supervisor only");
    const blob = new Blob([JSON.stringify(drawer, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drawer_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file?: File) => {
    try {
      if (!file) return;
      if (!isSupervisor) return toast.error("Supervisor only");
      const text = await file.text();
      const parsed = JSON.parse(text) as DrawerState;
      setDrawer(parsed);
      saveDrawer(parsed);
      toast.success("Imported drawer snapshot");
    } catch {
      toast.error("Invalid file");
    }
  };

  const resetAll = () => {
    if (!isSupervisor) return toast.error("Supervisor only");
    const fresh: DrawerState = { counts: {}, notes: "", tx: [] };
    setDrawer(fresh);
    saveDrawer(fresh);
    toast.success("Drawer reset");
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <BeamBackground />

      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1 rounded-full border border-white/10 bg-white/10"
          >
            <Home className="h-3.5 w-3.5" />

            <Link href="/dashboard/register" className="underline">
              Back to Home
            </Link>
          </Badge>
          <div className="ml-auto">
            <Badge
              className="gap-1 rounded-full border border-white/10 bg-white/5"
              variant="outline"
            >
              {isSupervisor ? (
                <Unlock className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {isSupervisor ? "Supervisor" : "Staff"}
            </Badge>
          </div>
        </div>

        {/* Top totals */}
        <Glow className="p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat
              title="Total in Drawer"
              value={jpy(total)}
              icon={<JapaneseYen className="h-4 w-4" />}
            />
            <Stat
              title="Banknotes"
              value={jpy(billTotal)}
              icon={<Banknote className="h-4 w-4" />}
            />
            <Stat title="Coins" value={jpy(coinTotal)} icon={<CoinsIcon />} />
          </div>
        </Glow>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Denomination Counter */}
          {/* <Glow className="p-4 lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Count by Denomination</CardTitle>
                                <CardDescription className="text-xs">Tap + / − to adjust quantity</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {DENOMS.map(d => {
                                    const qty = drawer.counts[d.value] || 0;
                                    return (
                                        <Glow key={d.value} className="p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium">{d.label} <span className="text-xs text-slate-400">× {qty}</span></div>
                                                    <div className="text-xs text-slate-400">{d.kind === "bill" ? "Bill" : "Coin"}</div>
                                                </div>
                                                <div className="text-sm font-semibold">{jpy(qty * d.value)}</div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                <div className="inline-flex items-center gap-1">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(d.value, -10)}><Minus className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(d.value, -1)}><Minus className="h-4 w-4" /></Button>
                                                    <Input
                                                        className="h-8 w-16 text-center"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={qty}
                                                        onChange={e => setQty(d.value, Math.max(0, Number(e.target.value) || 0))}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(d.value, +1)}><Plus className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(d.value, +10)}><Plus className="h-4 w-4" /></Button>
                                                </div>
                                                <Button variant="outline" className="rounded-full"
                                                    onClick={() => {
                                                        // Quick fill: set to reach round figures
                                                        const want = prompt(`Set quantity for ${d.label}`, String(qty));
                                                        if (want == null) return;
                                                        setQty(d.value, Math.max(0, Number(want) || 0));
                                                    }}>
                                                    Set
                                                </Button>
                                            </div>
                                        </Glow>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Glow> */}

          <Glow className="p-4 lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Count by Denomination
                </CardTitle>
                <CardDescription className="text-xs">
                  Tap + / − to adjust quantity
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {DENOMS.map((d) => {
                  const qty = drawer.counts[d.value] || 0;
                  return (
                    <Glow key={d.value} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {d.label}{" "}
                            <span className="text-xs text-slate-400">
                              × {qty}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {d.kind === "bill" ? "Bill" : "Coin"}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          {jpy(qty * d.value)}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-1">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4"
                            onClick={() => nudge(d.value, -10)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => nudge(d.value, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            className="h-8 w-16 text-center"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={qty}
                            onChange={(e) =>
                              setQty(
                                d.value,
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4"
                            onClick={() => nudge(d.value, +1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => nudge(d.value, +10)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            // Quick fill: set to reach round figures
                            const want = prompt(
                              `Set quantity for ${d.label}`,
                              String(qty)
                            );
                            if (want == null) return;
                            setQty(d.value, Math.max(0, Number(want) || 0));
                          }}
                        >
                          Set
                        </Button>
                      </div>
                    </Glow>
                  );
                })}
              </div>
            </CardContent>
          </Glow>

          {/* Actions / Notes */}
          <div className="space-y-4">
            <Glow className="p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quick Actions</CardTitle>
                <CardDescription className="text-xs">
                  Record movement without changing counts (audit log)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <AmountAction
                  label="Cash In"
                  onConfirm={(amt, memo) => txAdd("cash_in", amt, memo)}
                />
                <AmountAction
                  label="Cash Out"
                  onConfirm={(amt, memo) => txAdd("cash_out", amt, memo)}
                />
                <AmountAction
                  label="Safe Drop"
                  disabled={!isSupervisor}
                  onConfirm={(amt, memo) => txAdd("safe_drop", amt, memo)}
                />
              </CardContent>
            </Glow>

            <Glow className="p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes</CardTitle>
                <CardDescription className="text-xs">
                  Shift hand-over, discrepancy remarks, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={drawer.notes || ""}
                  onChange={(e) => {
                    const next = { ...drawer, notes: e.target.value };
                    setDrawer(next);
                    saveDrawer(next);
                  }}
                  placeholder="e.g. Started shift with ¥30,000 float. Safe drop at 16:00."
                />
              </CardContent>
            </Glow>

            <Glow className="p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Admin</CardTitle>
                <CardDescription className="text-xs">
                  Export / Import drawer snapshot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Export</div>
                      <div className="text-xs text-slate-400">
                        Download JSON (counts, notes, log)
                      </div>
                    </div>
                  </div>
                  <Button
                    className="rounded-full"
                    variant="secondary"
                    onClick={exportJSON}
                    disabled={!isSupervisor}
                  >
                    Export
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Import</div>
                      <div className="text-xs text-slate-400">
                        Load JSON snapshot
                      </div>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <span className="sr-only">Import</span>
                    <Input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      disabled={!isSupervisor}
                      onChange={(e) => importJSON(e.target.files?.[0])}
                    />
                    <Button
                      asChild
                      variant="outline"
                      disabled={!isSupervisor}
                      className="rounded-full"
                    >
                      <span>Choose File</span>
                    </Button>
                  </label>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <div>
                      <div className="font-medium">Reset Drawer</div>
                      <div className="text-xs text-slate-400">
                        Clear counts, notes, and audit log
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={resetAll}
                    className="rounded-full"
                    disabled={!isSupervisor}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Glow>
          </div>
        </div>

        {/* Audit Log */}
        <Glow className="p-4 mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit Log</CardTitle>
            <CardDescription className="text-xs">
              Time-stamped movements (manual)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drawer.tx.length === 0 ? (
              <div className="text-sm text-slate-400">No transactions yet.</div>
            ) : (
              <div className="divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
                {drawer.tx.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-white/5"
                  >
                    <div className="text-xs md:text-sm">
                      {new Date(item.t).toLocaleString()}
                    </div>
                    <div className="text-xs md:text-sm">
                      <Badge variant="outline" className="rounded-full">
                        {item.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs md:text-sm md:col-span-2">
                      {item.memo || "-"}
                    </div>
                    <div className="text-xs md:text-sm text-right font-semibold">
                      {jpy(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Glow>

        <p className="mt-3 text-[11px] text-slate-400">
          * ဒီစာမျက်နှာက denomination count ကို Drawer Snapshot အနေနဲ့
          သိမ်းထားပြီး၊ Quick Actions တွေက audit log မှာသာ မှတ်တမ်းတင်ထားပါတယ်
          (count ကို မပြောင်းပါ)။
        </p>
      </div>
    </div>
  );
}

/* ====== Small components ====== */
function Stat({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-slate-300">{title}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
      <div className="opacity-80">{icon}</div>
    </div>
  );
}

function AmountAction({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: (amount: number, memo?: string) => void;
  disabled?: boolean;
}) {
  const [amt, setAmt] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  return (
    <div
      className={`rounded-xl border p-3 ${
        disabled ? "opacity-60" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="mb-2 font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          className="h-9 w-40"
          placeholder="Amount (JPY)"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
        />
        <Input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="h-9"
          placeholder="Memo (optional)"
          disabled={disabled}
        />
        <Button
          className="rounded-full"
          disabled={disabled}
          onClick={() => {
            const n = Math.max(0, Number(amt) || 0);
            if (n <= 0) return toast.error("Enter amount");
            onConfirm(n, memo || undefined);
            setAmt("");
            setMemo("");
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function CoinsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="opacity-80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="currentColor" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" stroke="currentColor" />
    </svg>
  );
}
