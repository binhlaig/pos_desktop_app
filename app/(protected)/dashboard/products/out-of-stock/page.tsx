"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/components/currency-provider";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
type Product = { id: number; name: string; sku: string; barcode: string; category: string; price: number; quantity: number | null; imagePath: string; availableForSale: boolean };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
function text(...values: unknown[]) { return values.map(v => String(v ?? "").trim()).find(Boolean) || ""; }
function number(...values: unknown[]) {
  for (const value of values) {
    if (value == null || String(value).trim() === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function availability(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (["false", "0", "no", "inactive", "unavailable", "out_of_stock"].includes(v)) return false;
      if (["true", "1", "yes", "active", "available", "in_stock"].includes(v)) return true;
    }
  }
  return true;
}
function isOut(p: Product) { return !p.availableForSale || (p.quantity !== null && p.quantity <= 0); }
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const r = record(value);
  for (const key of ["content", "data", "products", "items"]) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
    if (r[key] && typeof r[key] === "object") { const nested = list(r[key]); if (nested.length) return nested; }
  }
  throw new Error("Products API response ပုံစံ မမှန်ပါ။");
}
function normalize(value: unknown): Product[] {
  return list(value).map(raw => {
    const p = record(raw);
    const id = number(p.id);
    if (id === null) throw new Error("Product ID မပါဝင်ပါ။");
    return { id, name: text(p.productName, p.product_name, p.name) || "Unnamed product", sku: text(p.sku, p.productCode, p.product_code), barcode: text(p.barcode), category: text(p.category, p.productType, p.product_type) || "Uncategorized", price: number(p.productPrice, p.product_price, p.price) ?? 0,
      // API current stock already includes checkout deductions. Never subtract sold again.
      quantity: number(p.productQuantityAmount, p.product_quantity_amount, p.quantity, p.stock), imagePath: text(p.imagePath, p.image_path, p.imageUrl, p.image_url), availableForSale: availability(p.availableForSale, p.available_for_sale, p.saleEnabled, p.sale_enabled, p.active) };
  });
}
function imageUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return `https:${path}`;
  return `${API_BASE}/${path.replace(/^\//, "")}`;
}

export default function OutOfStockPage() {
  const { formatMoney } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError("");
    try {
      const token = ["pos_shop_owner_token", "pos_access_token", "access_token", "accessToken", "token", "jwt"].map(key => localStorage.getItem(key)?.trim()).find(Boolean);
      if (!token) throw new Error("Login session မရှိပါ။ Login ပြန်ဝင်ပါ။");
      const headers = { Accept: "application/json", Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
      // Fetch every page if the endpoint returns Spring pagination.
      const all: Product[] = [];
      let apiPage = 0;
      let totalPages = 1;
      do {
        const response = await fetch(`${API_BASE}/api/products?availability=all&page=${apiPage}&size=100`, { headers, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Session သက်တမ်းကုန်ပါပြီ။ Login ပြန်ဝင်ပါ။" : `Products load failed (${response.status}).`);
        const body: unknown = await response.json();
        all.push(...normalize(body));
        const envelope = record(body);
        const metadata = Array.isArray(envelope.content) ? envelope : record(envelope.data);
        totalPages = number(metadata.totalPages) ?? 1;
        apiPage++;
      } while (apiPage < totalPages);
      if (!controller.signal.aborted) setProducts(Array.from(new Map(all.map(p => [p.id, p])).values()));
    } catch (reason) {
      if (!controller.signal.aborted) { setProducts([]); setError(reason instanceof Error ? reason.message : "Products load failed."); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { request.current?.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  const out = useMemo(() => products.filter(isOut), [products]);
  const categories = useMemo(() => Array.from(new Set(out.map(p => p.category))).sort(), [out]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return out.filter(p => (category === "ALL" || p.category === category) && (!keyword || [p.name, p.sku, p.barcode, p.category].some(v => v.toLowerCase().includes(keyword))));
  }, [out, query, category]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const unknownCount = products.filter(p => p.quantity === null).length;
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5">
          <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Inventory • Binhlaig POS</p><h1 className="mt-2 text-2xl font-black">Out of Stock Products</h1><p className="mt-1 text-sm text-muted-foreground">ကိုယ်တိုင် Out of Stock သတ်မှတ်ထားသော / Stock ကုန်နေသော products</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/pos" className="rounded-xl border border-border px-4 py-3 text-sm font-bold">POS</Link><Link href="/dashboard/products" className="rounded-xl border border-border px-4 py-3 text-sm font-bold">Products</Link><button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-[var(--dashboard-primary,#2563eb)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button></div>
        </header>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {!loading && !error && unknownCount > 0 && <p className="text-sm text-amber-600">Product {unknownCount} ခုတွင် stock data မပါပါ။ Sale disabled ဖြစ်ပါက စာရင်းတွင် ပြထားပါသည်။</p>}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[['Out of Stock', out.length], ['Categories', categories.length], ['Search Results', filtered.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black text-red-600">{loading || error ? "—" : value}</p></div>)}
        </section>
        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <input aria-label="Search products" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Product name / SKU / Barcode ရှာရန်" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3" />
            <select aria-label="Category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="rounded-xl border border-border bg-background px-3 py-3"><option value="ALL">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-border bg-background px-3 py-3">{[10,20,50].map(n => <option key={n} value={n}>{n} / page</option>)}</select>
          </div>
          {loading ? <p role="status" className="p-12 text-center text-muted-foreground">Products loading…</p> : error ? <p className="p-12 text-center text-muted-foreground">Refresh နှိပ်ပြီး ပြန်စမ်းပါ။</p> : filtered.length === 0 ? <p className="p-12 text-center font-semibold">{out.length === 0 ? "Out of Stock product မရှိပါ။" : "ရှာဖွေမှုနှင့် ကိုက်ညီသော product မရှိပါ။"}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-muted/40"><tr>{['Product','SKU / Barcode','Category','Price','Remaining','Status',''].map((h,i) => <th key={i} className="px-4 py-4 font-bold">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map(p => <tr key={p.id} className="hover:bg-muted/20"><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xl">{p.imagePath ? <img src={imageUrl(p.imagePath)} alt={p.name} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} /> : "📦"}</div><span className="max-w-[240px] break-words font-bold">{p.name}</span></div></td><td className="px-4 py-4"><p className="font-semibold">{p.sku || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{p.barcode || "No barcode"}</p></td><td className="px-4 py-4">{p.category}</td><td className="whitespace-nowrap px-4 py-4 font-semibold">{formatMoney(p.price)}</td><td className="px-4 py-4 font-black text-red-600">{p.quantity ?? "—"}</td><td className="px-4 py-4"><span className="whitespace-nowrap rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{!p.availableForSale ? "Sale disabled" : "Stock depleted"}</span></td><td className="px-4 py-4"><Link href={`/dashboard/products/${p.id}`} className="whitespace-nowrap rounded-lg border border-border px-3 py-2 font-semibold">View / Make Available</Link></td></tr>)}</tbody></table></div>}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-sm"><span>{loading || error ? "—" : `${filtered.length} products · Page ${safePage} / ${pages}`}</span><div className="flex gap-2"><button type="button" disabled={loading || !!error || safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-xl border border-border px-4 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={loading || !!error || safePage >= pages} onClick={() => setPage(safePage + 1)} className="rounded-xl border border-border px-4 py-2 disabled:opacity-40">Next</button></div></footer>
        </section>
      </div>
    </main>
  );
}