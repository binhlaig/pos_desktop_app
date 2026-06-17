"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Barcode,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReceiptItem = {
  id: number;
  productId?: string | null;
  barcode?: string | null;
  sku?: string | null;
  productName: string;
  qty: number;
  price: number;
  discountPercent: number;
  taxable: boolean;
  lineTotal: number;
};

type ReceiptDetail = {
  id: number;
  receiptNo: string;
  staffId?: string | null;
  staffName?: string | null;
  staffRole?: string | null;
  paymentMethod: "cash" | "card" | string;
  subtotal: number;
  taxAmount: number;
  discountPercent: number;
  grandTotal: number;
  cashGiven: number;
  changeAmount: number;
  shopId?: number | null;
  shopCode?: string | null;
  shopName?: string | null;
  shopAddress?: string | null;
  createdByUserId?: number | null;
  createdByUsername?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  status?: string | null;
  createdAt: string;
  items: ReceiptItem[];
};

type RefundLine = {
  receiptItemId: number;
  productName: string;
  barcode?: string | null;
  purchasedQty: number;
  refundQty: number;
  price: number;
  discountPercent: number;
  lineRefundAmount: number;
};

type RefundMethod = "cash" | "card" | "store_credit";

type RefundPayload = {
  receiptId: number;
  receiptNo: string;
  refundMethod: RefundMethod;
  reason: string;
  note: string;
  refundAmount: number;
  items: {
    receiptItemId: number;
    refundQty: number;
    refundAmount: number;
  }[];
};

type RefundResponse = {
  id?: number;
  refundNo?: string;
  status?: string;
  refundAmount?: number;
  message?: string;
};

const jpy = (n: number) =>
  Math.round(Number(n || 0)).toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
  });

const round = (n: number) => Math.round(Number(n || 0));

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeReceipt(data: any): ReceiptDetail | null {
  const r = data?.receipt || data?.data || data;
  if (!r || !r.id) return null;

  return {
    id: Number(r.id),
    receiptNo: String(r.receiptNo || r.receipt_no || ""),
    staffId: r.staffId || r.staff_id || "",
    staffName: r.staffName || r.staff_name || "",
    staffRole: r.staffRole || r.staff_role || "",
    paymentMethod: r.paymentMethod || r.payment_method || "cash",
    subtotal: Number(r.subtotal || 0),
    taxAmount: Number(r.taxAmount ?? r.tax_amount ?? 0),
    discountPercent: Number(r.discountPercent ?? r.discount_percent ?? 0),
    grandTotal: Number(r.grandTotal ?? r.grand_total ?? 0),
    cashGiven: Number(r.cashGiven ?? r.cash_given ?? 0),
    changeAmount: Number(r.changeAmount ?? r.change_amount ?? 0),
    shopId: r.shopId ?? r.shop_id ?? null,
    shopCode: r.shopCode ?? r.shop_code ?? "",
    shopName: r.shopName ?? r.shop_name ?? "",
    shopAddress: r.shopAddress ?? r.shop_address ?? "",
    createdByUserId: r.createdByUserId ?? r.created_by_user_id ?? null,
    createdByUsername: r.createdByUsername ?? r.created_by_username ?? "",
    createdByName: r.createdByName ?? r.created_by_name ?? "",
    createdByRole: r.createdByRole ?? r.created_by_role ?? "",
    status: r.status || "COMPLETED",
    createdAt: r.createdAt || r.created_at || "",
    items: Array.isArray(r.items)
      ? r.items.map((item: any) => ({
          id: Number(item.id),
          productId: item.productId ?? item.product_id ?? "",
          barcode: item.barcode ?? "",
          sku: item.sku ?? "",
          productName: item.productName ?? item.product_name ?? "",
          qty: Number(item.qty || 0),
          price: Number(item.price || 0),
          discountPercent: Number(item.discountPercent ?? item.discount_percent ?? 0),
          taxable: Boolean(item.taxable),
          lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
        }))
      : [],
  };
}

export default function POSRefundPage() {
  const router = useRouter();

  const [receiptNo, setReceiptNo] = useState("");
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [refundLines, setRefundLines] = useState<Record<number, RefundLine>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [reason, setReason] = useState("Customer ordered wrong item");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastRefund, setLastRefund] = useState<RefundResponse | null>(null);

  const selectedLines = useMemo(() => Object.values(refundLines).filter((l) => l.refundQty > 0), [refundLines]);
  const refundAmount = useMemo(() => selectedLines.reduce((sum, l) => sum + l.lineRefundAmount, 0), [selectedLines]);
  const selectedQty = useMemo(() => selectedLines.reduce((sum, l) => sum + l.refundQty, 0), [selectedLines]);

  async function searchReceipt() {
    const target = receiptNo.trim();
    if (!target) {
      setError("Receipt No ထည့်ပါ။");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setReceipt(null);
      setRefundLines({});

      const res = await fetch(`/api/pos/receipts/${encodeURIComponent(target)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Receipt not found.");
      }

      const normalized = normalizeReceipt(data);
      if (!normalized) throw new Error("Receipt not found.");

      setReceipt(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receipt search failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(item: ReceiptItem) {
    setRefundLines((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }

      return {
        ...prev,
        [item.id]: buildRefundLine(item, 1),
      };
    });
  }

  function buildRefundLine(item: ReceiptItem, qty: number): RefundLine {
    const safeQty = Math.max(0, Math.min(item.qty, qty));
    const unitAfterDiscount = item.price * (1 - Number(item.discountPercent || 0) / 100);

    return {
      receiptItemId: item.id,
      productName: item.productName,
      barcode: item.barcode,
      purchasedQty: item.qty,
      refundQty: safeQty,
      price: item.price,
      discountPercent: item.discountPercent,
      lineRefundAmount: round(unitAfterDiscount * safeQty),
    };
  }

  function updateRefundQty(item: ReceiptItem, qty: number) {
    setRefundLines((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }

      return {
        ...prev,
        [item.id]: buildRefundLine(item, qty),
      };
    });
  }

  function selectAllItems() {
    if (!receipt) return;

    const next: Record<number, RefundLine> = {};
    receipt.items.forEach((item) => {
      next[item.id] = buildRefundLine(item, item.qty);
    });

    setRefundLines(next);
  }

  function clearSelection() {
    setRefundLines({});
  }

  async function submitRefund() {
    if (!receipt) return;

    if (selectedLines.length === 0) {
      setError("Refund လုပ်မယ့် item ရွေးပါ။");
      return;
    }

    if (!reason.trim()) {
      setError("Refund reason ထည့်ပါ။");
      return;
    }

    const payload: RefundPayload = {
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      refundMethod,
      reason: reason.trim(),
      note: note.trim(),
      refundAmount: round(refundAmount),
      items: selectedLines.map((line) => ({
        receiptItemId: line.receiptItemId,
        refundQty: line.refundQty,
        refundAmount: round(line.lineRefundAmount),
      })),
    };

    try {
      setSaving(true);
      setError("");

      const res = await fetch("/api/pos/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: RefundResponse | null = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Refund save failed.");
      }

      setLastRefund(data || null);
      setSuccessOpen(true);
      setRefundLines({});
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-160px] top-24 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute right-[-120px] top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-96 w-[760px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1500px] px-4 py-8 md:px-6">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-500">
              <RotateCcw className="h-4 w-4" />
              Refund / Cancel
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Receipt Refund Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Customer က order မှားလို့ receipt ယူလာတဲ့အခါ receipt no နဲ့ရှာပြီး item အလိုက် refund / cancel လုပ်နိုင်ပါတယ်။
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:max-w-md lg:items-end">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/register")}
              className="w-full rounded-2xl border-sky-300/25 bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-300 sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back Home
            </Button>

            <div className="rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
              <b>Production rule:</b> Original receipt ကိုမဖျက်ပါနဲ့။ Refund record သီးသန့်သိမ်းပြီး report မှာ negative sale အဖြစ်တွက်ပါ။
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border border-black/10 bg-card/90 backdrop-blur-xl dark:border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-300/25 bg-sky-500/10">
                    <Search className="h-5 w-5 text-sky-500" />
                  </span>
                  Search Receipt
                </CardTitle>
                <CardDescription>
                  Receipt No ကို scan/type လုပ်ပြီး DB မှာရှိတဲ့ receipt ကိုရှာပါ။
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Barcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-500" />
                    <Input
                      autoFocus
                      value={receiptNo}
                      onChange={(e) => setReceiptNo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchReceipt();
                        }
                      }}
                      placeholder="e.g. R-20260515123000123"
                      className="h-14 rounded-2xl bg-background/70 pl-12 text-base font-bold"
                    />
                  </div>

                  <Button
                    onClick={searchReceipt}
                    disabled={loading}
                    className="h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-7 font-bold text-white"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Search
                  </Button>
                </div>

                {error && (
                  <div className="mt-4 flex gap-3 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {!receipt ? (
              <Card className="rounded-[28px] border border-dashed border-border bg-card/60">
                <CardContent className="grid min-h-[420px] place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-border bg-muted/50">
                      <Receipt className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="mt-5 text-xl font-black">No receipt selected</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Customer receipt no ကိုရှာပြီး refund လုပ်မယ့် item တွေကိုရွေးပါ။
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ReceiptPanel
                receipt={receipt}
                refundLines={refundLines}
                toggleItem={toggleItem}
                updateRefundQty={updateRefundQty}
                selectAllItems={selectAllItems}
                clearSelection={clearSelection}
              />
            )}
          </div>

          <aside className="space-y-6">
            <Card className="sticky top-6 rounded-[28px] border border-black/10 bg-card/90 backdrop-blur-xl dark:border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/25 bg-rose-500/10">
                    <ArrowLeftRight className="h-5 w-5 text-rose-500" />
                  </span>
                  Refund Summary
                </CardTitle>
                <CardDescription>
                  Refund amount နဲ့ reason ကိုစစ်ပြီး DB ထဲသိမ်းပါ။
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background/45 p-1">
                  <MethodButton
                    active={refundMethod === "cash"}
                    icon={<Wallet className="h-4 w-4" />}
                    label="Cash"
                    onClick={() => setRefundMethod("cash")}
                  />
                  <MethodButton
                    active={refundMethod === "card"}
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Card"
                    onClick={() => setRefundMethod("card")}
                  />
                  <MethodButton
                    active={refundMethod === "store_credit"}
                    icon={<Store className="h-4 w-4" />}
                    label="Credit"
                    onClick={() => setRefundMethod("store_credit")}
                  />
                </div>

                <div className="grid gap-3">
                  <SummaryCard
                    label="Selected Items"
                    value={`${selectedLines.length} lines / ${selectedQty} qty`}
                    tone="sky"
                  />
                  <SummaryCard
                    label="Refund Amount"
                    value={jpy(refundAmount)}
                    tone="rose"
                    large
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Reason</Label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm font-semibold outline-none"
                  >
                    <option>Customer ordered wrong item</option>
                    <option>Wrong barcode scanned</option>
                    <option>Product damaged</option>
                    <option>Customer changed mind</option>
                    <option>Duplicate payment</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note..."
                    className="min-h-[110px] rounded-2xl bg-background/70"
                  />
                </div>

                <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-4 text-xs leading-6 text-muted-foreground">
                  <b className="text-sky-500">Note:</b> Refund ပြီးရင် original receipt status ကို REFUNDED/PARTIALLY_REFUNDED ပြောင်းပြီး refund history ထဲ သိမ်းနိုင်ပါတယ်။
                </div>
              </CardContent>

              <CardFooter className="grid gap-3">
                <Button
                  onClick={submitRefund}
                  disabled={!receipt || selectedLines.length === 0 || saving}
                  className="h-12 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 font-black text-white shadow-[0_0_35px_-16px_rgba(244,63,94,1)]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Refund...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Complete Refund
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  disabled={!receipt || selectedLines.length === 0}
                  onClick={clearSelection}
                  className="h-11 rounded-2xl"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Selection
                </Button>
              </CardFooter>
            </Card>
          </aside>
        </div>
      </main>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="rounded-3xl border-border bg-card">
          <DialogHeader>
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl border border-emerald-300/25 bg-emerald-500/10">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <DialogTitle className="text-center text-2xl font-black">
              Refund Saved
            </DialogTitle>
            <DialogDescription className="text-center">
              Refund record ကို DB ထဲသိမ်းပြီးပါပြီ။
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border bg-background/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refund No</span>
              <b>{lastRefund?.refundNo || "-"}</b>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <b className="text-rose-500">{jpy(Number(lastRefund?.refundAmount || refundAmount))}</b>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full rounded-2xl" onClick={() => setSuccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptPanel({
  receipt,
  refundLines,
  toggleItem,
  updateRefundQty,
  selectAllItems,
  clearSelection,
}: {
  receipt: ReceiptDetail;
  refundLines: Record<number, RefundLine>;
  toggleItem: (item: ReceiptItem) => void;
  updateRefundQty: (item: ReceiptItem, qty: number) => void;
  selectAllItems: () => void;
  clearSelection: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="overflow-hidden rounded-[28px] border border-black/10 bg-card/90 backdrop-blur-xl dark:border-white/10">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-300/25 bg-sky-500/10">
                <Receipt className="h-5 w-5 text-sky-500" />
              </span>
              {receipt.receiptNo}
              <Badge className="rounded-full bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                {receipt.status || "COMPLETED"}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span>{formatDate(receipt.createdAt)}</span>
              <span>{receipt.shopName || receipt.shopCode || "-"}</span>
              <span>{receipt.paymentMethod}</span>
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAllItems} className="rounded-xl">
              Select All
            </Button>
            <Button variant="outline" onClick={clearSelection} className="rounded-xl">
              Clear
            </Button>
            <Button variant="outline" onClick={() => setExpanded((v) => !v)} className="rounded-xl">
              <ChevronDown className={`mr-2 h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
              Items
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InfoBox icon={<User className="h-4 w-4" />} label="Staff" value={receipt.staffName || receipt.staffId || "-"} />
          <InfoBox icon={<Wallet className="h-4 w-4" />} label="Payment" value={receipt.paymentMethod} />
          <InfoBox icon={<Package className="h-4 w-4" />} label="Items" value={String(receipt.items.reduce((a, i) => a + i.qty, 0))} />
          <InfoBox icon={<Receipt className="h-4 w-4" />} label="Total" value={jpy(receipt.grandTotal)} />
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CardContent className="p-0">
              <div className="hidden grid-cols-[70px_1.4fr_100px_120px_150px_120px] border-b border-border bg-muted/35 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
                <div>Pick</div>
                <div>Product</div>
                <div className="text-right">Bought</div>
                <div className="text-right">Price</div>
                <div className="text-center">Refund Qty</div>
                <div className="text-right">Refund</div>
              </div>

              <div className="divide-y divide-border">
                {receipt.items.map((item) => {
                  const selected = refundLines[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`grid gap-4 px-5 py-4 transition lg:grid-cols-[70px_1.4fr_100px_120px_150px_120px] lg:items-center ${
                        selected ? "bg-rose-500/5" : "hover:bg-muted/25"
                      }`}
                    >
                      <div>
                        <button
                          onClick={() => toggleItem(item)}
                          className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${
                            selected
                              ? "border-rose-300/35 bg-rose-500/15 text-rose-500"
                              : "border-border bg-background/60 text-muted-foreground hover:border-rose-300/35 hover:text-rose-500"
                          }`}
                        >
                          {selected ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="font-black">{item.productName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Barcode {item.barcode || item.productId || "-"}
                          {item.discountPercent > 0 ? ` · ${item.discountPercent}% off` : ""}
                        </div>
                      </div>

                      <div className="flex justify-between lg:block lg:text-right">
                        <span className="text-sm text-muted-foreground lg:hidden">Bought</span>
                        <b>{item.qty}</b>
                      </div>

                      <div className="flex justify-between lg:block lg:text-right">
                        <span className="text-sm text-muted-foreground lg:hidden">Price</span>
                        <b>{jpy(item.price)}</b>
                      </div>

                      <div className="flex items-center justify-between gap-3 lg:justify-center">
                        <span className="text-sm text-muted-foreground lg:hidden">Refund Qty</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={!selected}
                            onClick={() => updateRefundQty(item, (selected?.refundQty || 0) - 1)}
                            className="h-9 w-9 rounded-xl"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            disabled={!selected}
                            type="number"
                            min={0}
                            max={item.qty}
                            value={selected?.refundQty || 0}
                            onChange={(e) => updateRefundQty(item, Number(e.target.value))}
                            className="h-9 w-16 rounded-xl text-center font-black"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={!selected || selected.refundQty >= item.qty}
                            onClick={() => updateRefundQty(item, (selected?.refundQty || 0) + 1)}
                            className="h-9 w-9 rounded-xl"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-between text-lg font-black text-rose-500 lg:block lg:text-right">
                        <span className="text-sm font-normal text-muted-foreground lg:hidden">Refund</span>
                        {jpy(selected?.lineRefundAmount || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MethodButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${
        active ? "bg-rose-500 text-white shadow-lg" : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryCard({ label, value, tone, large = false }: { label: string; value: string; tone: "sky" | "rose"; large?: boolean }) {
  const cls = tone === "rose" ? "border-rose-300/25 bg-rose-500/10 text-rose-500" : "border-sky-300/25 bg-sky-500/10 text-sky-500";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-black tabular-nums ${large ? "text-3xl" : "text-xl"}`}>{value}</div>
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/45 p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate font-black">{value}</div>
    </div>
  );
}
