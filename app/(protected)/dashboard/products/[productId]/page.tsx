"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Loader2, MapPin, Package, ReceiptText, RefreshCcw,
  Search, ShoppingCart, User, Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProductDetail = {
  id: number; name: string; sku: string; barcode: string; category: string;
  price: number; quantity: number; imagePath: string; availableForSale: boolean;
};

type ProductSale = {
  itemId: number; receiptId: number; receiptNo: string; soldAt: string;
  quantity: number; unitPrice: number; discountPercent: number; lineTotal: number;
  paymentMethod: string; staffId: string; staffName: string;
  shopName: string; shopCode: string; shopAddress: string;
};

type BrandColors = { primary: string; accent: string };
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const BRAND_COLOR_STORAGE_KEY = "binhlaig_brand_colors";

function getAccessToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") || localStorage.getItem("jwt") || ""
  ).trim();
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function unwrapList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const list = record.content || record.data || record.receipts || record.items;
  return Array.isArray(list) ? list : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const result = String(value ?? "").trim();
    if (result) return result;
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const result = Number(value);
    if (Number.isFinite(result)) return result;
  }
  return 0;
}

function firstBoolean(defaultValue: boolean, ...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "active", "available", "in_stock"].includes(normalized)) return true;
      if (["false", "0", "no", "inactive", "unavailable", "out_of_stock"].includes(normalized)) return false;
    }
  }
  return defaultValue;
}

function normalizeProduct(value: unknown, productId: number): ProductDetail {
  const item = asRecord(value);
  return {
    id: firstNumber(item.id, productId),
    name: firstText(item.productName, item.product_name, item.name) || `Product #${productId}`,
    sku: firstText(item.sku, item.productCode, item.product_code),
    barcode: firstText(item.barcode),
    category: firstText(item.category, item.productType, item.product_type) || "Uncategorized",
    price: firstNumber(item.productPrice, item.product_price, item.price),
    quantity: firstNumber(item.productQuantityAmount, item.product_quantity_amount, item.quantity, item.stock),
    imagePath: firstText(item.imagePath, item.image_path, item.imageUrl, item.image_url),
    availableForSale: firstBoolean(
      true,
      item.availableForSale,
      item.available_for_sale,
      item.saleEnabled,
      item.sale_enabled,
      item.active
    ),
  };
}

function normalizeProductSales(value: unknown, productId: number): ProductSale[] {
  const result: ProductSale[] = [];
  unwrapList(value).forEach((rawReceipt) => {
    const receipt = asRecord(rawReceipt);
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    items.forEach((rawItem, index) => {
      const item = asRecord(rawItem);
      if (firstText(item.productId, item.product_id) !== String(productId)) return;
      result.push({
        itemId: firstNumber(item.id, index + 1),
        receiptId: firstNumber(receipt.id),
        receiptNo: firstText(receipt.receiptNo, receipt.receipt_no) || "-",
        soldAt: firstText(receipt.createdAt, receipt.created_at),
        quantity: firstNumber(item.qty, item.quantity),
        unitPrice: firstNumber(item.price, item.unitPrice, item.unit_price),
        discountPercent: firstNumber(item.discountPercent, item.discount_percent),
        lineTotal: firstNumber(item.lineTotal, item.line_total),
        paymentMethod: firstText(receipt.paymentMethod, receipt.payment_method) || "-",
        staffId: firstText(receipt.staffId, receipt.staff_id),
        staffName: firstText(receipt.staffName, receipt.staff_name),
        shopName: firstText(receipt.shopName, receipt.shop_name),
        shopCode: firstText(receipt.shopCode, receipt.shop_code),
        shopAddress: firstText(receipt.shopAddress, receipt.shop_address),
      });
    });
  });
  return result.sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
}

function currency(value: number) {
  return Math.round(Number(value || 0)).toLocaleString("ja-JP", { style: "currency", currency: "JPY" });
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function resolveImage(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function applyBrandColors() {
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  let primary = styles.getPropertyValue("--dashboard-primary").trim() || "#2563eb";
  let accent = styles.getPropertyValue("--dashboard-accent").trim() || "#60a5fa";
  try {
    const stored = JSON.parse(localStorage.getItem(BRAND_COLOR_STORAGE_KEY) || "null") as Partial<BrandColors> | null;
    if (stored && /^#[0-9a-f]{6}$/i.test(stored.primary || "")) primary = stored.primary!;
    if (stored && /^#[0-9a-f]{6}$/i.test(stored.accent || "")) accent = stored.accent!;
  } catch {}
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-accent", accent);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--brand-soft", "color-mix(in srgb, var(--brand-primary) 10%, transparent)");
  root.style.setProperty("--brand-border", "color-mix(in srgb, var(--brand-primary) 28%, transparent)");
}

export default function ProductSalesHistoryPage() {
  const router = useRouter();
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => applyBrandColors();
    const onStorage = (event: StorageEvent) => event.key === BRAND_COLOR_STORAGE_KEY && sync();
    sync();
    window.addEventListener("brand-colors-changed", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("brand-colors-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function loadHistory() {
    if (!Number.isFinite(productId) || productId <= 0) {
      setError("Product ID မမှန်ပါ။"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      if (!getAccessToken()) throw new Error("Login session မရှိပါ။ Login ပြန်ဝင်ပါ။");
      const [productResponse, receiptResponse] = await Promise.all([
        fetch(`${API_BASE}/api/products/${productId}`, { headers: { Accept: "application/json", ...authHeaders() }, cache: "no-store" }),
        fetch("/api/pos/receipts", { headers: { Accept: "application/json", ...authHeaders() }, cache: "no-store" }),
      ]);
      if (!productResponse.ok) throw new Error(`Product load failed (${productResponse.status}).`);
      if (!receiptResponse.ok) throw new Error(`Sales history load failed (${receiptResponse.status}).`);
      setProduct(normalizeProduct(await productResponse.json(), productId));
      setSales(normalizeProductSales(await receiptResponse.json(), productId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sales history load failed.");
      setProduct(null); setSales([]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function toggleProductAvailability() {
    if (!product || updatingAvailability) return;

    const nextAvailable = !product.availableForSale;
    setUpdatingAvailability(true);
    setError("");

    try {
      if (!getAccessToken()) throw new Error("Login session မရှိပါ။ Login ပြန်ဝင်ပါ။");

      const response = await fetch(
        `${API_BASE}/api/products/${product.id}/availability`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ availableForSale: nextAvailable }),
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Product availability update failed (${response.status}).`);
      }

      setProduct((current) =>
        current ? { ...current, availableForSale: nextAvailable } : current
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Product availability update failed."
      );
    } finally {
      setUpdatingAvailability(false);
    }
  }

  const filteredSales = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return sales.filter((sale) => {
      const soldDate = sale.soldAt ? new Date(sale.soldAt) : null;
      const fromOk = !dateFrom || (!!soldDate && soldDate >= new Date(`${dateFrom}T00:00:00`));
      const toOk = !dateTo || (!!soldDate && soldDate <= new Date(`${dateTo}T23:59:59.999`));
      const queryOk = !keyword || [sale.receiptNo, sale.staffName, sale.staffId, sale.shopName, sale.shopCode]
        .some((value) => value.toLowerCase().includes(keyword));
      return fromOk && toOk && queryOk;
    });
  }, [sales, query, dateFrom, dateTo]);

  useEffect(() => setCurrentPage(1), [query, dateFrom, dateTo, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleSales = filteredSales.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalSoldValue = filteredSales.reduce((sum, sale) => sum + sale.lineTotal, 0);
  const lastSale = sales[0]?.soldAt || "";
  const startPage = Math.max(1, Math.min(totalPages - 4, safePage - 2));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => startPage + index);

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,var(--brand-soft),var(--background)_45%,color-mix(in_srgb,var(--brand-accent)_8%,var(--background)))] p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-[2rem] border border-[var(--brand-border)] bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-accent)]">
                {product?.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImage(product.imagePath)} alt={product.name} className="h-full w-full object-cover" />
                ) : <Package size={27} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-accent)]">Product Sales History</p>
                <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">{product?.name || `Product #${productId}`}</h1>
                <p className="mt-1 text-sm text-muted-foreground">ID: {productId} · SKU: {product?.sku || "-"} · Barcode: {product?.barcode || "-"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard/products")} className="rounded-xl border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]"><ArrowLeft className="mr-2 h-4 w-4" />Products</Button>
              {product && (
                <Button
                  type="button"
                  onClick={toggleProductAvailability}
                  disabled={updatingAvailability}
                  className={`rounded-xl font-black text-white ${
                    product.availableForSale
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[var(--brand-primary)] hover:brightness-95"
                  }`}
                >
                  {updatingAvailability ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : product.availableForSale ? (
                    <Ban className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {product.availableForSale ? "Mark Out of Stock" : "Make Available"}
                </Button>
              )}
              <Button onClick={loadHistory} disabled={loading || updatingAvailability} className="rounded-xl bg-[var(--brand-primary)] text-white hover:brightness-95">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}Refresh</Button>
            </div>
          </div>
          {product && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Badge
                className={
                  product.availableForSale
                    ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100"
                    : "rounded-full bg-red-100 px-3 py-1 text-red-700 hover:bg-red-100"
                }
              >
                {product.availableForSale ? (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Ban className="mr-1 h-3.5 w-3.5" />
                )}
                {product.availableForSale ? "Available for sale" : "Out of Stock · Sale disabled"}
              </Badge>
              <span className="text-sm font-semibold text-muted-foreground">
                Physical stock: {product.quantity} items
              </span>
            </div>
          )}
        </header>

        {error && <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600"><AlertTriangle size={19} />{error}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={<ShoppingCart size={22} />} label="Sold Quantity" value={`${totalQuantity} items`} />
          <SummaryCard icon={<Wallet size={22} />} label="Sold Value" value={currency(totalSoldValue)} />
          <SummaryCard icon={<Clock3 size={22} />} label="Last Sold" value={lastSale ? formatDateTime(lastSale) : "No sales"} compact />
        </section>

        <Card className="overflow-hidden rounded-[2rem] border-[var(--brand-border)] bg-card/95 shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-[var(--brand-accent)]" />Sale Transactions</CardTitle><p className="mt-1 text-sm text-muted-foreground">Receipt items matching Product ID {productId}</p></div>
              <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_150px_150px]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-accent)]" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Receipt, staff or shop..." className="rounded-xl pl-9" /></div>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl" aria-label="To date" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-[var(--brand-accent)]" /></div> :
             visibleSales.length === 0 ? <EmptyState /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] border-collapse text-left">
                  <thead className="bg-[var(--brand-soft)] text-xs font-black uppercase tracking-wide text-muted-foreground"><tr>
                    <th className="px-5 py-4">Receipt</th><th className="px-4 py-4">Sold Date &amp; Time</th><th className="px-4 py-4">Sold Location</th><th className="px-4 py-4">Cashier</th><th className="px-4 py-4">Payment</th><th className="px-4 py-4 text-right">Qty</th><th className="px-4 py-4 text-right">Unit Price</th><th className="px-4 py-4 text-right">Discount</th><th className="px-5 py-4 text-right">Sold Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">{visibleSales.map((sale) => (
                    <tr key={`${sale.receiptId}-${sale.itemId}`} className="hover:bg-[var(--brand-soft)]">
                      <td className="px-5 py-4"><b>{sale.receiptNo}</b><div className="text-xs text-muted-foreground">ID: {sale.receiptId}</div></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-[var(--brand-accent)]" />{formatDateTime(sale.soldAt)}</div></td>
                      <td className="px-4 py-4"><div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-accent)]" /><div><b>{sale.shopName || sale.shopCode || "-"}</b><div className="max-w-[240px] text-xs text-muted-foreground">{sale.shopAddress || sale.shopCode || "No address"}</div></div></div></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-2"><User className="h-4 w-4 text-[var(--brand-accent)]" /><div><b>{sale.staffName || "-"}</b><div className="text-xs text-muted-foreground">{sale.staffId || "No staff ID"}</div></div></div></td>
                      <td className="px-4 py-4"><Badge variant="secondary" className="rounded-full uppercase">{sale.paymentMethod}</Badge></td>
                      <td className="px-4 py-4 text-right font-black">{sale.quantity}</td><td className="px-4 py-4 text-right font-bold">{currency(sale.unitPrice)}</td><td className="px-4 py-4 text-right font-bold text-amber-600">{sale.discountPercent}%</td><td className="px-5 py-4 text-right font-black text-[var(--brand-primary)]">{currency(sale.lineTotal)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <Pagination currentPage={safePage} totalPages={totalPages} pageNumbers={pageNumbers} pageSize={pageSize} total={filteredSales.length} onPage={setCurrentPage} onPageSize={setPageSize} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, compact = false }: { icon: React.ReactNode; label: string; value: string; compact?: boolean }) {
  return <Card className="rounded-[2rem] border-[var(--brand-border)] bg-card/95"><CardContent className="flex items-center gap-4 p-5"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-accent)]">{icon}</div><div className="min-w-0"><div className="text-xs font-bold text-muted-foreground">{label}</div><div className={`mt-1 font-black text-[var(--brand-primary)] ${compact ? "text-base" : "text-2xl"}`}>{value}</div></div></CardContent></Card>;
}

function EmptyState() {
  return <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[var(--brand-soft)] text-[var(--brand-accent)]"><ReceiptText size={35} /></div><h3 className="mt-4 text-xl font-black">Sales record မရှိသေးပါ</h3><p className="mt-2 text-sm text-muted-foreground">ဒီ Product ID ပါသော receipt item မတွေ့ပါ။</p></div></div>;
}

function Pagination({ currentPage, totalPages, pageNumbers, pageSize, total, onPage, onPageSize }: { currentPage: number; totalPages: number; pageNumbers: number[]; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  return <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-muted-foreground">Total {total}<select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1"><option value={10}>10 / page</option><option value={20}>20 / page</option><option value={50}>50 / page</option></select></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)} className="rounded-xl"><ChevronLeft className="mr-1 h-4 w-4" />Prev</Button>{pageNumbers.map((page) => <Button key={page} size="sm" variant={page === currentPage ? "default" : "outline"} onClick={() => onPage(page)} className="h-9 min-w-9 rounded-xl px-3">{page}</Button>)}<Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => onPage(currentPage + 1)} className="rounded-xl">Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>;
}
