"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Barcode, Check, ChevronLeft, ChevronRight, CircleHelp, Layers3, Loader2, Minus, Package, Plus, Printer, RefreshCw, Search, Settings2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import JsBarcode from "jsbarcode";

type Product = { id: string; name: string; barcode: string; sku: string; price: number; imagePath: string | null };
type LabelSize = "40x25" | "50x30" | "60x40";
const SIZES: Record<LabelSize, { width: number; height: number; columns: number }> = {
  "40x25": { width: 40, height: 25, columns: 4 },
  "50x30": { width: 50, height: 30, columns: 3 },
  "60x40": { width: 60, height: 40, columns: 3 },
};
const DESKTOP_PAGE_SIZE = 7;
const TABLET_PAGE_SIZE = 5;
const MAX_LABELS = 300;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function productsFrom(payload: unknown): Product[] {
  const root = payload as Record<string, unknown> | null;
  const nested = root?.data as Record<string, unknown> | undefined;
  const rows = Array.isArray(payload) ? payload : [root?.products, root?.data, root?.content, root?.items, nested?.products, nested?.content].find(Array.isArray);
  if (!Array.isArray(rows)) return [];
  return rows.map((raw: Record<string, unknown>) => ({
    id: text(raw.dbId ?? raw.id ?? raw.productId ?? raw.product_id ?? raw.barcode),
    name: text(raw.name ?? raw.productName ?? raw.product_name ?? raw.title),
    barcode: text(raw.barcode),
    sku: text(raw.sku),
    price: Number(raw.productPrice ?? raw.product_price ?? raw.price) || 0,
    imagePath: text(raw.imagePath ?? raw.image_path ?? raw.product_image ?? raw.productImage) || null,
  })).filter((product) => product.name && product.barcode);
}
function productImageUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/uploads/")) return `${API_BASE}${path}`;
  if (path.startsWith("uploads/")) return `${API_BASE}/${path}`;
  return `${API_BASE}/uploads/products/${path}`;
}
function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const url = productImageUrl(product.imagePath);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return <div className="flex size-full items-center justify-center bg-gradient-to-br from-[var(--brand-primary)]/10 to-amber-400/15 text-[var(--brand-primary)]"><Package className="size-6" /></div>;
  return <img src={url} alt={product.name} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />;
}
function authHeaders(): Record<string, string> {
  const token = ["pos_shop_owner_token", "pos_access_token", "access_token", "token"]
    .map((key) => localStorage.getItem(key)?.trim()).find(Boolean);
  return token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {};
}
const barcodeCache = new Map<string, string>();
function barcodeImage(value: string) {
  if (typeof document === "undefined" || !value.trim()) return "";
  const cached = barcodeCache.get(value);
  if (cached) return cached;
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // Match the product page whose printed CODE128 barcode scans successfully.
    JsBarcode(svg, value.trim(), { format: "CODE128", displayValue: true, fontSize: 14, height: 70, margin: 8 });
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
    barcodeCache.set(value, source);
    return source;
  } catch { return ""; }
}

export default function POSBarcodePrintPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DESKTOP_PAGE_SIZE);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [size, setSize] = useState<LabelSize>("60x40");
  const [showPrice, setShowPrice] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setError("");
    let lastError = "Products မရနိုင်ပါ။ API နှင့် login token ကိုစစ်ပါ။";
    let succeeded = false;
    for (const endpoint of ["/api/pos/products", "/backend/api/products", `${API_BASE}/api/products`, `${API_BASE}/backend/api/products`]) {
      try {
        const response = await fetch(endpoint, { headers: { Accept: "application/json", ...authHeaders() }, cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) { lastError = text(payload?.message) || `HTTP ${response.status}`; continue; }
        const normalized = productsFrom(payload);
        if (normalized.length) { setProducts(normalized); succeeded = true; break; }
        // A successful empty response may be an empty proxy; try the other POS endpoints.
        lastError = "Barcode ပါသော product မရှိသေးပါ။";
      } catch (reason) { lastError = reason instanceof Error ? reason.message : lastError; }
    }
    if (!succeeded) { setProducts([]); setError(lastError); }
    setLoading(false);
  }
  useEffect(() => { void loadProducts(); }, []);
  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 1000px) and (max-width: 1279px) and (orientation: landscape)");
    const update = () => setPageSize(tablet.matches ? TABLET_PAGE_SIZE : DESKTOP_PAGE_SIZE);
    update();
    tablet.addEventListener("change", update);
    return () => tablet.removeEventListener("change", update);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((p) => !needle || `${p.name} ${p.barcode} ${p.sku}`.toLowerCase().includes(needle));
  }, [products, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const chosen = useMemo(() => products.filter((p) => (quantities[p.id] || 0) > 0), [products, quantities]);
  const total = chosen.reduce((sum, p) => sum + (quantities[p.id] || 0), 0);
  const labels = useMemo(() => chosen.flatMap((p) => Array.from({ length: quantities[p.id] || 0 }, () => p)), [chosen, quantities]);
  const formatPrice = (price: number) => `${new Intl.NumberFormat("en-US").format(price)} Ks`;

  function setQuantity(id: string, value: number) {
    const next = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : 0;
    setQuantities((current) => ({ ...current, [id]: next }));
  }
  function printLabels() {
    if (!total) return toast.error("Print ထုတ်ရန် product ရွေးပါ။");
    if (total > MAX_LABELS) return toast.error(`တစ်ကြိမ်လျှင် ${MAX_LABELS} labels ထက်မပိုရပါ။`);
    if (chosen.some((p) => !barcodeImage(p.barcode))) return toast.error("Code 128 မထုတ်နိုင်သော barcode ရှိနေပါသည်။ Product barcode ကို စစ်ပါ။");
    setPreviewOpen(false);
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          #barcode-print-sheet, #barcode-print-sheet * { visibility: visible !important; }
          #barcode-print-sheet { display: block !important; position: absolute !important; inset: 0 auto auto 0 !important; width: 194mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          #barcode-print-grid { display: grid !important; grid-template-columns: repeat(var(--label-columns), var(--label-width)) !important; column-gap: 2mm !important; row-gap: 2mm !important; }
          .barcode-label { width: var(--label-width) !important; height: var(--label-height) !important; break-inside: avoid !important; page-break-inside: avoid !important; border: 0.2mm solid #e5e7eb !important; border-radius: 0 !important; box-sizing: border-box !important; padding: 2mm !important; overflow: hidden !important; color: black !important; background: white !important; }
          .barcode-label img { display: block !important; width: 100% !important; height: var(--barcode-height) !important; object-fit: contain !important; background: white !important; }
          .barcode-bars { width: 100% !important; padding: 0 2mm !important; background: white !important; box-sizing: border-box !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1480px] space-y-5 px-4 py-5 print:hidden sm:px-6 lg:px-8 lg:py-7">
        <header className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] px-5 py-6 shadow-sm sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full bg-[var(--brand-primary)] opacity-[0.07] blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-white shadow-md"><Barcode className="size-6" /></div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]"><Sparkles className="size-3.5" /> POS TOOLS / LABEL STUDIO</div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Barcode Print</h1>
                <p className="mt-1.5 max-w-xl text-sm text-[var(--muted-foreground)]">Product တွေရွေး၊ label အရေအတွက် သတ်မှတ်ပြီး A4 စာရွက်ပေါ် print ထုတ်ပါ။</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadProducts()} disabled={loading} className="rounded-xl"><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />Product ပြန်ယူမည်</Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"><p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Package className="size-4 text-[var(--brand-primary)]" /> Barcode products</p><p className="mt-2 text-2xl font-bold tabular-nums">{products.length}</p></div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"><p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Check className="size-4 text-emerald-600" /> Selected products</p><p className="mt-2 text-2xl font-bold tabular-nums">{chosen.length}</p></div>
          <div className="col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:col-span-1"><p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Layers3 className="size-4 text-amber-600" /> Total labels</p><p className="mt-2 text-2xl font-bold tabular-nums">{total}</p></div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
          <Card className="overflow-hidden rounded-2xl border-[var(--border)] shadow-sm">
            <CardHeader className="border-b border-[var(--border)] bg-[var(--muted)]/30 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-lg">Product catalog</CardTitle><p className="mt-1 text-xs text-[var(--muted-foreground)]">Barcode ပါသည့် product များကိုသာ ပြထားသည်။</p></div><div className="rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">{filtered.length} items</div></div>
              <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Product အမည်၊ SKU၊ barcode ရှာရန်" aria-label="Search products" className="h-11 rounded-xl bg-[var(--card)] pl-10" />{query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted-foreground)]"><X className="size-4" /></button>}</div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-[var(--muted-foreground)]"><Loader2 className="size-6 animate-spin text-[var(--brand-primary)]" />Products ယူနေသည်…</div> :
                error ? <div role="alert" className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm"><CircleHelp className="size-7 text-amber-600" /><p className="text-red-600">{error}</p><Button type="button" variant="outline" onClick={() => void loadProducts()}>ပြန်စမ်းမည်</Button></div> :
                !filtered.length ? <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center"><Barcode className="size-8 text-[var(--muted-foreground)]" /><p className="font-medium">Product မတွေ့ပါ</p><p className="text-sm text-[var(--muted-foreground)]">အခြားနာမည်၊ SKU သို့မဟုတ် barcode ဖြင့်ရှာပါ။</p></div> :
                <div className="grid gap-2">{visible.map((p, index) => {
                  const qty = quantities[p.id] || 0;
                  return <div key={p.id} className={`flex min-h-[78px] items-center justify-between gap-3 rounded-xl border p-2.5 transition-colors sm:px-3 ${qty ? "border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/[0.07] shadow-sm" : index % 2 ? "border-amber-500/15 bg-amber-500/[0.035] hover:bg-amber-500/[0.08]" : "border-sky-500/15 bg-sky-500/[0.035] hover:bg-sky-500/[0.08]"}`}>
                    <div className="flex min-w-0 items-center gap-3"><div className="size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm"><ProductImage product={p} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="mt-1 truncate font-mono text-[11px] text-[var(--muted-foreground)]">{p.barcode}{p.sku && ` · ${p.sku}`}</p>{qty > 0 && <span className="mt-1 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Selected</span>}</div></div>
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"><button type="button" aria-label={`Remove one label for ${p.name}`} onClick={() => setQuantity(p.id, qty - 1)} disabled={!qty} className="flex size-8 items-center justify-center rounded-lg hover:bg-[var(--muted)] disabled:opacity-30"><Minus className="size-4" /></button><Input type="number" min={0} max={100} step={1} inputMode="numeric" aria-label={`${p.name} label count`} className="h-8 w-12 border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none" value={qty} onChange={(e) => setQuantity(p.id, Number(e.target.value))} /><button type="button" aria-label={`Add one label for ${p.name}`} onClick={() => setQuantity(p.id, qty + 1)} disabled={qty >= 100} className="flex size-8 items-center justify-center rounded-lg hover:bg-[var(--muted)] disabled:opacity-30"><Plus className="size-4" /></button></div>
                  </div>;
                })}</div>}
              {pages > 1 && <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4"><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg"><ChevronLeft className="mr-1 size-4" />Back</Button><span className="text-xs font-medium text-[var(--muted-foreground)]">{filtered.length ? (Math.min(page, pages) - 1) * pageSize + 1 : 0}–{Math.min(Math.min(page, pages) * pageSize, filtered.length)} / {filtered.length} · Page {Math.min(page, pages)} / {pages}</span><Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg">Next<ChevronRight className="ml-1 size-4" /></Button></div>}
            </CardContent>
          </Card>

          <div className="space-y-5 lg:sticky lg:top-5">
            <Card className="overflow-hidden rounded-2xl border-[var(--border)] shadow-sm"><CardHeader className="border-b border-[var(--border)] p-5"><div className="flex items-center gap-2"><div className="rounded-lg bg-[var(--brand-primary)]/10 p-2 text-[var(--brand-primary)]"><Settings2 className="size-4" /></div><CardTitle className="text-lg">Print settings</CardTitle></div></CardHeader>
              <CardContent className="space-y-5 p-5">
                <div><label htmlFor="label-size" className="mb-2 block text-sm font-semibold">Label size</label><select id="label-size" value={size} onChange={(e) => setSize(e.target.value as LabelSize)} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option value="40x25">40 × 25 mm · 4 columns</option><option value="50x30">50 × 30 mm · 3 columns</option><option value="60x40">60 × 40 mm · 3 columns</option></select><p className="mt-1.5 text-xs text-[var(--muted-foreground)]">A4 portrait paper • Code 128</p></div>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm"><span>Label ပေါ် ဈေးနှုန်းပြမည်</span><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="size-4 accent-[var(--brand-primary)]" /></label>
                <div className="rounded-xl bg-[var(--muted)]/50 p-4 text-sm"><div className="flex justify-between text-[var(--muted-foreground)]"><span>ရွေးထားသော product</span><span className="font-semibold text-[var(--foreground)]">{chosen.length}</span></div><div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3 font-semibold"><span>Print ထုတ်မည့် labels</span><span className="text-xl text-[var(--brand-primary)]">{total}</span></div></div>
                {total > MAX_LABELS && <p role="alert" className="text-xs text-red-600">တစ်ကြိမ်လျှင် {MAX_LABELS} labels ထက်မပိုရပါ။</p>}
                <Button type="button" variant="default" className="h-12 w-full rounded-xl text-sm font-semibold" disabled={!total || total > MAX_LABELS} onClick={() => setPreviewOpen(true)}><Barcode className="mr-2 size-4" />Preview & Print</Button>
                <Button type="button" variant="outline" className="h-10 w-full rounded-xl" disabled={!total} onClick={() => setQuantities({})}>Selection ရှင်းမည်</Button>
              </CardContent></Card>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-xs leading-6 text-[var(--muted-foreground)]"><p className="mb-1 font-semibold text-[var(--foreground)]">Print မထုတ်ခင် စစ်ရန်</p>Scan လွယ်ရန် 60 × 40 mm ရွေးပါ။ A4, Scale 100%, header/footer ပိတ်ပြီး ပထမစာရွက်ကို စမ်းသပ် print ထုတ်ပါ။ Browser print margin သည် CSS 8 mm ဖြစ်သည်။</div>
          </div>
        </div>

      </div>

      <Drawer open={previewOpen} onOpenChange={setPreviewOpen}>
        <DrawerContent side="right" showCloseButton className="flex h-full max-h-screen w-full flex-col sm:max-w-[520px] print:hidden">
          <DrawerHeader className="shrink-0 border-b border-[var(--border)] px-5 py-5 text-left sm:px-6">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"><Barcode className="size-5" /></div>
            <DrawerTitle className="text-xl">Label preview</DrawerTitle>
            <DrawerDescription>{total} labels · {chosen.length} products · {size} mm · A4</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-xs text-[var(--muted-foreground)]">ပထမ {Math.min(total, 24)} labels ကို preview ပြထားသည်။ Print ထုတ်လျှင် ရွေးထားသော {total} labels အားလုံး ပါဝင်မည်။</div>
            <div className="grid grid-cols-2 gap-3">
              {labels.slice(0, 24).map((p, index) => <div key={`${p.id}-${index}`} className="flex h-36 min-w-0 flex-col items-center justify-between overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3 text-center text-xs text-black shadow-sm"><strong className="w-full truncate">{p.name}</strong><div className="w-full bg-white px-2"><img src={barcodeImage(p.barcode)} alt="" className="h-16 w-full object-contain" /></div><span className="w-full truncate font-mono text-[10px]">{p.barcode}</span>{showPrice && <span>{formatPrice(p.price)}</span>}</div>)}
            </div>
            <p className="mt-5 text-xs leading-5 text-[var(--muted-foreground)]">Scanner အတွက် 60 × 40 mm ကို အကြံပြုပါသည်။ A4, Scale 100%, headers/footers off ဖြင့် စမ်းသပ် print တစ်ရွက် အရင်ထုတ်ပါ။ Barcode ၏ ဘေးနှစ်ဖက် white space ကို မဖြတ်ပါနှင့်။</p>
          </DrawerBody>
          <DrawerFooter className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between text-sm"><span className="text-[var(--muted-foreground)]">Total labels</span><strong className="text-lg text-[var(--brand-primary)]">{total}</strong></div>
            <Button type="button" variant="default" className="h-12 w-full rounded-xl font-semibold" disabled={!total || total > MAX_LABELS} onClick={printLabels}><Printer className="mr-2 size-4" />Print {total} labels</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div id="barcode-print-sheet" className="hidden" aria-hidden="true" style={{ "--label-width": `${SIZES[size].width}mm`, "--label-height": `${SIZES[size].height}mm`, "--label-columns": SIZES[size].columns, "--barcode-height": size === "40x25" ? "11mm" : size === "50x30" ? "15mm" : "22mm" } as CSSProperties}>
        <div id="barcode-print-grid">{labels.map((p, index) => <div key={`${p.id}-${index}`} className="barcode-label flex flex-col items-center justify-between text-center" style={{ fontSize: "7pt" }}><div className="w-full truncate font-semibold">{p.name}</div><div className="barcode-bars"><img src={barcodeImage(p.barcode)} alt="" /></div>{showPrice && <div>{formatPrice(p.price)}</div>}</div>)}</div>
      </div>
    </main>
  );
}
