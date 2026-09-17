"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Loader2,
  Package,
  RefreshCcw,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Product = {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  discount: number;
  imagePath: string;
};

type Receipt = {
  grandTotal: number;
  createdAt: string;
};

type BrandColors = {
  primary: string;
  accent: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const BRAND_COLOR_STORAGE_KEY = "binhlaig_brand_colors";
const PAGE_SIZES = [10, 20, 50] as const;

function getAccessToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    ""
  ).trim();
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const list = record.content || record.data || record.products || record.receipts || record.items;
  return Array.isArray(list) ? list : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function normalizeProducts(value: unknown): Product[] {
  return unwrapList(value).map((raw, index) => {
    const item = asRecord(raw);
    return {
      id: firstNumber(item.id, index + 1),
      sku: firstText(item.sku, item.productCode, item.product_code),
      barcode: firstText(item.barcode),
      name: firstText(item.productName, item.product_name, item.name) || "Unnamed product",
      category: firstText(item.category, item.productType, item.product_type) || "Uncategorized",
      price: firstNumber(item.productPrice, item.product_price, item.price),
      quantity: firstNumber(
        item.productQuantityAmount,
        item.product_quantity_amount,
        item.quantity,
        item.stock,
      ),
      discount: firstNumber(item.productDiscount, item.product_discount, item.discount),
      imagePath: firstText(item.imagePath, item.image_path, item.imageUrl, item.image_url),
    };
  });
}

function normalizeReceipts(value: unknown): Receipt[] {
  return unwrapList(value).map((raw) => {
    const item = asRecord(raw);
    return {
      grandTotal: firstNumber(item.grandTotal, item.grand_total, item.total),
      createdAt: firstText(item.createdAt, item.created_at),
    };
  });
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function currency(value: number) {
  return Math.round(Number(value || 0)).toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
  });
}

function resolveImage(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function readAndApplyBrandColors(): BrandColors {
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  let primary = styles.getPropertyValue("--dashboard-primary").trim() || "#2563eb";
  let accent = styles.getPropertyValue("--dashboard-accent").trim() || "#60a5fa";

  try {
    const stored = JSON.parse(localStorage.getItem(BRAND_COLOR_STORAGE_KEY) || "null") as
      | Partial<BrandColors>
      | null;
    if (stored && /^#[0-9a-f]{6}$/i.test(stored.primary || "")) primary = stored.primary!;
    if (stored && /^#[0-9a-f]{6}$/i.test(stored.accent || "")) accent = stored.accent!;
  } catch {
    // Keep the global defaults when saved data is invalid.
  }

  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-accent", accent);
  root.style.setProperty("--dashboard-primary", primary);
  root.style.setProperty("--dashboard-accent", accent);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--brand-soft", "color-mix(in srgb, var(--brand-primary) 10%, transparent)");
  root.style.setProperty("--brand-border", "color-mix(in srgb, var(--brand-primary) 28%, transparent)");
  return { primary, accent };
}

export default function ProductDashboardPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState<BrandColors>({
    primary: "#2563eb",
    accent: "#60a5fa",
  });

  useEffect(() => {
    const sync = () => setBrand(readAndApplyBrandColors());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRAND_COLOR_STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener("brand-colors-changed", sync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("brand-colors-changed", sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Login session မရှိပါ။ Login ပြန်ဝင်ပါ။");

      const [productResult, receiptResult] = await Promise.allSettled([
        fetch(`${API_BASE}/api/products`, {
          headers: { Accept: "application/json", ...authHeaders() },
          cache: "no-store",
        }),
        fetch("/api/pos/receipts", {
          headers: { Accept: "application/json", ...authHeaders() },
          cache: "no-store",
        }),
      ]);

      if (productResult.status !== "fulfilled" || !productResult.value.ok) {
        const status = productResult.status === "fulfilled" ? productResult.value.status : "network";
        throw new Error(`Products load failed (${status}).`);
      }

      setProducts(normalizeProducts(await productResult.value.json()));

      if (receiptResult.status === "fulfilled" && receiptResult.value.ok) {
        setReceipts(normalizeReceipts(await receiptResult.value.json()));
      } else {
        setReceipts([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Product dashboard load failed.");
      setProducts([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // Initial dashboard load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(products.map((product) => product.category))).sort()],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "ALL" || product.category === category;
      const matchesQuery =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword) ||
        product.barcode.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, category, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const inventoryValue = products.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0,
  );
  const todaySales = receipts
    .filter((receipt) => isToday(receipt.createdAt))
    .reduce((sum, receipt) => sum + receipt.grandTotal, 0);
  const totalSoldValue = receipts.reduce(
    (sum, receipt) => sum + receipt.grandTotal,
    0,
  );
  const lowStockCount = products.filter((product) => product.quantity > 0 && product.quantity <= 5).length;

  const valueOverviewData = [
    { name: "Remaining Product Value", value: inventoryValue },
    { name: "Total Sold Value", value: totalSoldValue },
  ].filter((item) => item.value > 0);
  const valueOverviewColors = [brand.primary, brand.accent];

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [safePage, totalPages]);

  return (
    <main className="products-dashboard min-h-screen bg-[linear-gradient(145deg,var(--brand-soft),var(--background)_45%,color-mix(in_srgb,var(--brand-accent)_8%,var(--background)))] p-4 text-foreground sm:p-6 lg:p-8">
      <style jsx global>{`
        @media (min-width: 768px) and (max-width: 1279px) and (orientation: landscape) {
          .products-dashboard { padding: 16px; }
          .products-dashboard .products-table-scroll {
            max-height: 42dvh;
            overflow: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
          }
          .products-dashboard .products-table {
            min-width: 0;
            table-layout: fixed;
            font-size: 12px;
          }
          .products-dashboard .products-table col:nth-child(1) { width: 24%; }
          .products-dashboard .products-table col:nth-child(2) { width: 17%; }
          .products-dashboard .products-table col:nth-child(3) { width: 11%; }
          .products-dashboard .products-table col:nth-child(4) { width: 10%; }
          .products-dashboard .products-table col:nth-child(5) { width: 6%; }
          .products-dashboard .products-table col:nth-child(6) { width: 13%; }
          .products-dashboard .products-table col:nth-child(7) { width: 9%; }
          .products-dashboard .products-table col:nth-child(8) { width: 10%; }
          .products-dashboard .products-table th,
          .products-dashboard .products-table td {
            padding: 10px 8px;
            overflow-wrap: anywhere;
          }
          .products-dashboard .products-table th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: var(--card);
            font-size: 10px;
            letter-spacing: 0;
          }
          .products-dashboard .product-identity { gap: 8px; }
          .products-dashboard .product-thumbnail { width: 36px; height: 36px; }
          .products-dashboard .product-name { white-space: normal; }
          .products-dashboard .product-code { font-size: 11px; }
          .products-dashboard .product-category { white-space: normal; font-size: 10px; padding: 2px 6px; }
          .products-dashboard .product-stock-status {
            white-space: nowrap;
            overflow-wrap: normal;
            font-size: 9px;
            line-height: 14px;
            padding: 3px 6px;
          }
          .products-dashboard .product-view { height: 44px; padding: 0 8px; font-size: 11px; }
        }
      `}</style>
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-[var(--brand-border)] bg-card/95 p-5 shadow-sm backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-accent))] text-white shadow-lg">
              <Boxes size={25} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Product Dashboard</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Stock value၊ ယနေ့ရောင်းအားနှင့် product data များ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button onClick={loadDashboard} disabled={loading} className="rounded-xl">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
            <AlertTriangle size={19} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(260px,1.3fr)] xl:grid-cols-[1fr_1fr_1.35fr]">
          <MetricCard
            icon={<CircleDollarSign size={25} />}
            title="Total Product Value"
            value={currency(inventoryValue)}
            description={`${products.length} products · current stock value`}
          />
          <MetricCard
            icon={<TrendingUp size={25} />}
            title="Today Sales"
            value={currency(todaySales)}
            description={`${receipts.filter((receipt) => isToday(receipt.createdAt)).length} receipts today`}
          />

          <Card className="min-w-0 rounded-[2rem] border-[var(--brand-border)] bg-card/95 shadow-sm">
            <CardHeader className="pb-2 md:px-4 md:pt-4 xl:px-6 xl:pt-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-sm lg:text-base xl:text-lg">
                <ShoppingBag className="h-5 w-5 shrink-0 text-[var(--brand-accent)] md:h-4 md:w-4 xl:h-5 xl:w-5" />
                Remaining &amp; Sold Value
              </CardTitle>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Combined value: {currency(inventoryValue + totalSoldValue)}
              </p>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[210px] md:px-2 md:pb-3 xl:h-[250px] xl:px-6 xl:pb-6">
              {valueOverviewData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={valueOverviewData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {valueOverviewData.map((entry, index) => (
                        <Cell key={entry.name} fill={valueOverviewColors[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currency(Number(value))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-sm font-semibold text-muted-foreground">
                  Chart ပြရန် product data မရှိသေးပါ။
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="overflow-hidden rounded-[2rem] border-[var(--brand-border)] bg-card/95 shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[var(--brand-accent)]" />
                  Product Data
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filteredProducts.length} products · {lowStockCount} low stock
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-accent)]" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search product, SKU, barcode..."
                    className="rounded-xl bg-background/80 pl-9"
                  />
                </div>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item === "ALL" ? "All categories" : item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="grid min-h-[380px] place-items-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-[var(--brand-accent)]" />
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading products...</p>
                </div>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="grid min-h-[380px] place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[var(--brand-soft)] text-[var(--brand-accent)]">
                    <Package size={36} />
                  </div>
                  <h3 className="mt-4 text-xl font-black">Product မတွေ့ပါ</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Search သို့မဟုတ် category filter ကို ပြောင်းကြည့်ပါ။</p>
                </div>
              </div>
            ) : (
              <div className="products-table-scroll overflow-x-auto" role="region" aria-label="Products table" tabIndex={0}>
                <table className="products-table w-full min-w-[1180px] border-collapse text-left">
                  <colgroup>
                    <col /><col /><col /><col />
                    <col /><col /><col /><col />
                  </colgroup>
                  <thead className="bg-[var(--brand-soft)] text-xs font-black uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Product</th>
                      <th className="px-4 py-4">SKU / Barcode</th>
                      <th className="px-4 py-4">Category</th>
                      <th className="px-4 py-4 text-right">Price</th>
                      <th className="px-4 py-4 text-right">Stock</th>
                      <th className="px-4 py-4 text-right">Total Value</th>
                      <th className="px-5 py-4 text-center">Status</th>
                      <th className="px-5 py-4 text-center">Sales List</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedProducts.map((product) => {
                      const stockStatus =
                        product.quantity <= 0 ? "OUT" : product.quantity <= 5 ? "LOW" : "IN STOCK";
                      return (
                        <tr key={product.id} className="transition hover:bg-[var(--brand-soft)]">
                          <td className="px-5 py-4">
                            <div className="product-identity flex items-center gap-3">
                              <div className="product-thumbnail grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]">
                                {product.imagePath ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={resolveImage(product.imagePath)} alt={product.name} className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-5 w-5 text-[var(--brand-accent)]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="product-name max-w-[260px] truncate font-black" title={product.name}>{product.name}</div>
                                {product.discount > 0 && (
                                  <div className="mt-1 text-xs font-bold text-amber-600">{product.discount}% discount</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="product-code px-4 py-4 text-sm">
                            <div className="font-bold">{product.sku || "-"}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{product.barcode || "No barcode"}</div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="secondary" className="product-category rounded-full">{product.category}</Badge>
                          </td>
                          <td className="px-4 py-4 text-right font-bold tabular-nums">{currency(product.price)}</td>
                          <td className="px-4 py-4 text-right font-black tabular-nums">{product.quantity}</td>
                          <td className="px-4 py-4 text-right font-black tabular-nums text-[var(--brand-primary)]">
                            {currency(product.price * product.quantity)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <StockBadge status={stockStatus} />
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/products/${product.id}`)}
                              className="product-view rounded-xl border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)] hover:brightness-95"
                            >
                              <Eye className="mr-1.5 h-4 w-4 text-[var(--brand-accent)]" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Showing {filteredProducts.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filteredProducts.length)} of {filteredProducts.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-border bg-background px-2 py-1 font-semibold outline-none"
                >
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>
                {pageNumbers.map((page) => (
                  <Button
                    key={page}
                    variant={page === safePage ? "default" : "outline"}
                    size="sm"
                    className="h-9 min-w-9 rounded-xl px-3"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="relative min-w-0 overflow-hidden rounded-[2rem] border-[var(--brand-border)] bg-card/95 shadow-sm">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--brand-soft)]" />
      <CardContent className="relative flex min-h-[210px] flex-col justify-between p-6 md:min-h-[190px] md:p-4 xl:min-h-[210px] xl:p-6">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-accent)] md:h-10 md:w-10 xl:h-12 xl:w-12">
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-muted-foreground md:text-xs xl:text-sm">{title}</div>
          <div className="mt-2 break-words text-3xl font-black tracking-tight text-[var(--brand-primary)] sm:text-4xl md:text-2xl lg:text-3xl xl:text-4xl">{value}</div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground md:text-[11px] xl:text-xs">{description}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StockBadge({ status }: { status: "OUT" | "LOW" | "IN STOCK" }) {
  const style = {
    OUT: "bg-red-50 text-red-600 ring-red-100",
    LOW: "bg-amber-50 text-amber-700 ring-amber-100",
    "IN STOCK": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  }[status];

  return <span className={`product-stock-status inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ring-1 ${style}`}>{status}</span>;
}
