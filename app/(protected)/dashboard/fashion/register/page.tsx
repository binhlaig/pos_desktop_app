
"use client"
// UPDATED: Staff-friendly payment dialog with amount due, received cash,
// remaining balance, and change calculation.

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { fetchStaffById } from "@/lib/staff-validation";
import {
  ArrowLeft,
  BadgePercent,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GripVertical,
  IdCard,
  Loader2,
  Minus,
  Moon,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sun,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

type PaymentMethod = "CASH" | "CARD" | "WALLET";

type FashionProduct = {
  id: string;
  dbId?: string;
  barcode?: string;
  sku?: string;
  name: string;
  category: string;
  brand?: string;
  price: number;
  stock: number | null;
  image?: string;
  available?: boolean;

  // Fashion variant fields
  variantId?: string;
  variantBarcode?: string;
  color?: string;
  size?: string;
  season?: string;
  gender?: string;
};

type CartItem = FashionProduct & {
  cartId: string;
  qty: number;
  discountPercent?: number;
};

type FashionCartDraft = {
  version: 1;
  savedAt: number;
  staffId: string;
  discount: number;
  taxPercent: number;
  items: CartItem[];
};

type ActiveStaff = {
  staffId: string;
  staffName: string;
};

type BackendProduct = Record<string, unknown>;

type ShopReceiptInfo = {
  shopName: string;
  address: string;
  phone: string;
};

type PaymentReceiptData = {
  receiptNo: string;
  paidAt: string;
  cashierName: string;
  cashierStaffId: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cashReceived: number;
  changeAmount: number;
  items: CartItem[];
  shopInfo: ShopReceiptInfo;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const TOKEN_KEYS = [
  "pos_access_token",
  "pos_shop_owner_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
] as const;

const MISSING_TOKEN_MESSAGE = "Login token မရှိပါ။ အရင်ဆုံး login ပြန်ဝင်ပါ။";
const PRODUCTS_PER_PAGE = 8;
const CART_ITEMS_PER_PAGE = 4;
const DEFAULT_TAX_PERCENT = 0;
const CART_DROP_ID = "fashion-cart-drop-zone";
const MOBILE_CART_DROP_ID = "fashion-mobile-cart-drop-zone";
const CART_WIDTH_STORAGE_KEY = "fashion_pos_cart_width";
const DEFAULT_CART_WIDTH = 430;
const MIN_CART_WIDTH = 340;
const MAX_CART_WIDTH = 680;
const CART_DRAFT_VERSION = 1;
const CART_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
const CART_DRAFT_KEY_PREFIX = "fashion_pos_cart_draft_v1";

function getShopDraftScope(token?: string | null) {
  try {
    const rawToken = token?.replace(/^Bearer\s+/i, "").trim();
    const payloadPart = rawToken?.split(".")[1];
    if (!payloadPart) return "current-shop";

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;

    return String(
      payload.shopId || payload.shop_id || payload.shopCode || payload.shop_code || "current-shop",
    );
  } catch {
    return "current-shop";
  }
}

function getFashionCartDraftKey(staffId: string) {
  return `${CART_DRAFT_KEY_PREFIX}:${getShopDraftScope(getAccessToken())}:${staffId}`;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);

function getAccessToken() {
  if (typeof window === "undefined") return null;

  const storedOwnerToken = getStoredOwnerToken()?.trim();
  if (storedOwnerToken) return storedOwnerToken;

  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key)?.trim();
    if (token) return token;
  }

  return null;
}

function formatAuthorization(token: string) {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function authHeaders() {
  const token = getAccessToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: formatAuthorization(token) } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function getNestedRecord(
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  for (const key of keys) {
    const nested = asRecord(record[key]);
    if (Object.keys(nested).length > 0) return nested;
  }

  return {};
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").replace(/ks|mmk/gi, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function pickOptionalNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    const parsed =
      typeof value === "number"
        ? value
        : Number(String(value).replace(/,/g, ""));

    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function buildImageUrl(path?: string) {
  if (!path) return undefined;

  const raw = path.trim();
  if (!raw) return undefined;

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/uploads/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("uploads/")) return `${API_BASE}/${raw}`;

  return `${API_BASE}/uploads/products/${raw}`;
}

function extractProducts(data: unknown): BackendProduct[] {
  if (Array.isArray(data)) return data as BackendProduct[];

  const root = asRecord(data);
  const list =
    root.products ||
    root.data ||
    root.content ||
    root.items ||
    root.result ||
    root.results;

  return Array.isArray(list) ? (list as BackendProduct[]) : [];
}

async function getApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    const record = asRecord(data);
    const message = pickString(record, ["message", "error"]);

    return message || fallback;
  }

  const text = await res.text().catch(() => "");
  return text || fallback;
}

function mapProductToFashionProduct(product: BackendProduct): FashionProduct {
  const dbId = pickString(product, [
    "id",
    "dbId",
    "db_id",
    "productId",
    "product_id",
  ]);

  const barcode = pickString(product, [
    "barcode",
    "barCode",
    "productBarcode",
    "product_barcode",
  ]);

  const sku = pickString(product, ["sku"]);

  const variantId = pickString(product, [
    "variantId",
    "variant_id",
    "productVariantId",
    "product_variant_id",
  ]);

  const variantBarcode = pickString(product, [
    "variantBarcode",
    "variant_barcode",
  ]);

  const id =
    variantId ||
    dbId ||
    barcode ||
    sku ||
    pickString(product, ["productCode", "code"]);

  const name =
    pickString(product, ["productName", "name", "product_name", "title"]) ||
    "Unnamed product";

  const category =
    pickString(product, ["category", "productCategory", "product_category"]) ||
    "OTHER";

  const price = pickNumber(product, [
    "salePrice",
    "sale_price",
    "productPrice",
    "product_price",
    "price",
    "unitPrice",
    "unit_price",
    "amount",
  ]);

  const stock = pickOptionalNumber(product, [
    "stock",
    "stockQty",
    "stock_qty",
    "productQuantityAmount",
    "product_quantity_amount",
    "quantity",
  ]);

  const image = buildImageUrl(
    pickString(product, [
      "imageUrl",
      "imagePath",
      "image_url",
      "image_path",
      "productImage",
      "product_image",
    ]),
  );

  return {
    id: String(id || crypto.randomUUID()),
    dbId,
    barcode,
    sku,
    name,
    category,
    brand: pickString(product, ["brand", "brandName", "brand_name"]),
    price,
    stock,
    image,
    available: stock === null ? true : stock > 0,

    variantId,
    variantBarcode,
    color: pickString(product, ["color", "colour"]),
    size: pickString(product, ["size"]),
    season: pickString(product, ["season"]),
    gender: pickString(product, ["gender"]),
  };
}

function createCartId() {
  return (
    globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random())
  );
}

function DraggableProductCard({
  productId,
  disabled,
  onClick,
  className,
  children,
}: {
  productId: string;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className: string;
  children: React.ReactNode;
}) {
  const { ref, isDragging } = useDraggable({
    id: `fashion-product:${productId}`,
    disabled,
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} touch-none select-none cursor-grab active:cursor-grabbing ${
        isDragging ? "scale-[0.98] opacity-35" : ""
      }`}
    >
      {children}
    </button>
  );
}

function CartDropSurface({
  dragging,
  darkMode,
  addedFeedbackVisible,
  children,
}: {
  dragging: boolean;
  darkMode: boolean;
  addedFeedbackVisible: boolean;
  children: React.ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({ id: CART_DROP_ID });

  return (
    <div
      ref={ref}
      data-fashion-cart-target="true"
      className={`relative flex min-h-[520px] flex-col overflow-hidden rounded-[1.5rem] border shadow-sm transition sm:rounded-[2rem] lg:landscape:h-full ${
        isDropTarget
          ? darkMode
            ? "border-emerald-400 bg-emerald-500/10 ring-4 ring-emerald-400/25"
            : "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-300/35"
          : dragging
            ? darkMode
              ? "border-orange-400 bg-orange-500/10 ring-4 ring-orange-400/20"
              : "border-orange-400 bg-orange-50 ring-4 ring-orange-300/30"
          : darkMode
            ? "border-white/10 bg-white/5"
            : "border-orange-100 bg-white/92"
      }`}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 rounded-2xl bg-orange-500 px-4 py-2 text-center text-xs font-black text-white shadow-lg">
          {isDropTarget ? "Release to add item" : "Drop here to add item"}
        </div>
      )}
      <AnimatePresence>
        {addedFeedbackVisible && !dragging && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-500/30"
          >
            <Check size={16} /> Added to Cart
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

function MobileCartBar({
  darkMode,
  dragging,
  itemCount,
  total,
  onViewCart,
  onPayment,
  addedFeedbackVisible,
}: {
  darkMode: boolean;
  dragging: boolean;
  itemCount: number;
  total: number;
  onViewCart: () => void;
  onPayment: () => void;
  addedFeedbackVisible: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id: MOBILE_CART_DROP_ID });
  const hasItems = itemCount > 0;

  return (
    <div
      ref={ref}
      data-fashion-cart-target="true"
      className={`fixed inset-x-2 bottom-2 z-50 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl transition-colors lg:landscape:hidden ${
        isDropTarget
          ? "border-emerald-400 bg-emerald-500 text-white ring-4 ring-emerald-400/25"
          : dragging
            ? "border-orange-400 bg-orange-500 text-white ring-4 ring-orange-400/20"
            : addedFeedbackVisible
              ? "border-emerald-400 bg-emerald-500 text-white ring-4 ring-emerald-400/25"
            : darkMode
              ? "border-white/10 bg-slate-900/95 text-white"
              : "border-orange-100 bg-white/95 text-slate-950"
      }`}
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {dragging ? (
        <div className="flex min-h-14 items-center justify-center gap-2 px-3 text-sm font-black">
          <ShoppingBag size={20} />
          {isDropTarget ? "Release to add item" : "Drag product here"}
        </div>
      ) : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button
            type="button"
            onClick={onViewCart}
            disabled={!hasItems}
            className="relative grid h-12 w-12 place-items-center rounded-xl bg-orange-500 text-white disabled:opacity-50"
            aria-label="Open cart"
          >
            <ShoppingBag size={21} />
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-slate-950 px-1 text-[10px] font-black text-white ring-2 ring-white">
              {itemCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onViewCart}
            disabled={!hasItems}
            className="min-w-0 text-left disabled:opacity-60"
          >
            <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
              {hasItems ? "Cart Total" : "Cart is empty"}
            </p>
            <p className="truncate text-lg font-black tabular-nums text-orange-500">
              {formatMoney(total)} Ks
            </p>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onViewCart}
              disabled={!hasItems}
              className={`rounded-xl px-3 py-3 text-xs font-black disabled:opacity-40 ${
                darkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              View
            </button>
            <button
              type="button"
              onClick={onPayment}
              disabled={!hasItems}
              className="rounded-xl bg-orange-500 px-3 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 disabled:opacity-40 sm:px-4"
            >
              Pay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getFashionSubtitle(item: FashionProduct | CartItem) {
  const parts = [
    item.brand,
    item.color ? `Color: ${item.color}` : "",
    item.size ? `Size: ${item.size}` : "",
    item.variantBarcode || item.barcode
      ? `Barcode: ${item.variantBarcode || item.barcode}`
      : "",
  ].filter(Boolean);

  return parts.join(" · ") || item.category;
}

function buildReceiptHtml(receipt: PaymentReceiptData) {
  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="item-name">${item.name}</div>
            <div class="muted small">${getFashionSubtitle(item)}</div>
          </td>
          <td class="center">${item.qty}</td>
          <td class="right">${formatMoney(item.price)}</td>
          <td class="right">${formatMoney(item.price * item.qty)}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${receipt.receiptNo}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 16px;
            color: #111827;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          .receipt {
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .muted { color: #6b7280; }
          .small { font-size: 10px; line-height: 1.35; }
          .shop-title {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            text-align: center;
          }
          .shop-info {
            margin-top: 4px;
            text-align: center;
            font-size: 11px;
            line-height: 1.45;
            color: #4b5563;
          }
          .divider {
            margin: 10px 0;
            border-top: 1px dashed #9ca3af;
          }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin: 5px 0;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 11px;
          }
          th {
            padding: 6px 2px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
          }
          td {
            padding: 7px 2px;
            border-bottom: 1px dashed #e5e7eb;
            vertical-align: top;
          }
          .item-name { font-weight: 800; line-height: 1.35; }
          .totals {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #9ca3af;
          }
          .grand {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #111827;
            font-size: 15px;
            font-weight: 900;
          }
          .footer {
            margin-top: 16px;
            text-align: center;
            font-size: 11px;
            line-height: 1.45;
            color: #6b7280;
          }
          @page { size: 80mm auto; margin: 0; }
          @media print {
            body { padding: 0; }
            .receipt { width: 80mm; max-width: 80mm; padding: 8px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1 class="shop-title">${receipt.shopInfo.shopName || "Fashion Store"}</h1>
          <div class="shop-info">
            ${receipt.shopInfo.address ? `<div>${receipt.shopInfo.address}</div>` : ""}
            ${receipt.shopInfo.phone ? `<div>Phone: ${receipt.shopInfo.phone}</div>` : ""}
          </div>

          <div class="divider"></div>

          <div class="line"><span>Receipt No</span><strong>${receipt.receiptNo}</strong></div>
          <div class="line"><span>Date</span><strong>${new Date(receipt.paidAt).toLocaleString()}</strong></div>
          <div class="line"><span>Cashier</span><strong>${receipt.cashierName}</strong></div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center">Qty</th>
                <th class="right">Price</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="totals">
            <div class="line"><span>Subtotal</span><strong>${formatMoney(receipt.subtotal)} Ks</strong></div>
            <div class="line"><span>Tax</span><strong>${formatMoney(receipt.tax)} Ks</strong></div>
            <div class="line"><span>Discount</span><strong>${formatMoney(receipt.discount)} Ks</strong></div>
            <div class="line grand"><span>Total</span><strong>${formatMoney(receipt.total)} Ks</strong></div>
            <div class="line"><span>Payment</span><strong>${receipt.paymentMethod}</strong></div>
            ${
              receipt.paymentMethod === "CASH"
                ? `
                  <div class="line"><span>Cash Received</span><strong>${formatMoney(receipt.cashReceived)} Ks</strong></div>
                  <div class="line"><span>Change</span><strong>${formatMoney(receipt.changeAmount)} Ks</strong></div>
                `
                : ""
            }
          </div>

          <div class="footer">
            <div>Thank you for shopping.</div>
            <div>Powered by POS System</div>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
          window.onafterprint = function () {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
}

export default function FashionRegisterPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);
  const [staffIdDraft, setStaffIdDraft] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const staffInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<FashionProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [productPage, setProductPage] = useState(1);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartPage, setCartPage] = useState(1);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [lastAddedProductKey, setLastAddedProductKey] = useState("");
  const [addedFeedbackVisible, setAddedFeedbackVisible] = useState(false);
  const [flyingProduct, setFlyingProduct] = useState<{
    token: number;
    product: FashionProduct;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const addedFeedbackTimerRef = useRef<number | null>(null);
  const [draggingProductId, setDraggingProductId] = useState("");
  const [cartWidth, setCartWidth] = useState(DEFAULT_CART_WIDTH);
  const [isResizingCart, setIsResizingCart] = useState(false);
  const cartResizeStartRef = useRef({ pointerX: 0, width: DEFAULT_CART_WIDTH });
  const suppressProductClickRef = useRef(false);

  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(DEFAULT_TAX_PERCENT);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [restoredDraftKey, setRestoredDraftKey] = useState("");
  const [draftRestoreMessage, setDraftRestoreMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const cashInputRef = useRef<HTMLInputElement | null>(null);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(
    null,
  );

  const [shopInfo] = useState<ShopReceiptInfo>({
    shopName: "Fashion Store",
    address: "",
    phone: "",
  });

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category)));
    return ["all", ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchCategory =
        selectedCategory === "all" || product.category === selectedCategory;

      const matchSearch =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.brand?.toLowerCase().includes(keyword) ||
        product.color?.toLowerCase().includes(keyword) ||
        product.size?.toLowerCase().includes(keyword) ||
        product.barcode?.toLowerCase().includes(keyword) ||
        product.variantBarcode?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword);

      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, search]);

  const productTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );

  const safeProductPage = Math.min(productPage, productTotalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safeProductPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, safeProductPage]);

  const draggingProduct = useMemo(
    () => products.find((product) => product.id === draggingProductId) || null,
    [products, draggingProductId],
  );

  const cartTotalPages = Math.max(
    1,
    Math.ceil(cart.length / CART_ITEMS_PER_PAGE),
  );

  const safeCartPage = Math.min(cartPage, cartTotalPages);

  const paginatedCart = useMemo(() => {
    const start = (safeCartPage - 1) * CART_ITEMS_PER_PAGE;
    return cart.slice(start, start + CART_ITEMS_PER_PAGE);
  }, [cart, safeCartPage]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );

  const tax = Math.round((subtotal - discount) * (taxPercent / 100));
  const total = Math.max(subtotal + tax - discount, 0);
  const cashNumber = Number(cashReceived || 0);
  const change = Math.max(cashNumber - total, 0);
  const remainingAmount = Math.max(total - cashNumber, 0);
  const cashIsEnough = paymentMethod !== "CASH" || cashNumber >= total;

  const quickCashAmounts = useMemo(() => {
    if (total <= 0) return [];

    return Array.from(
      new Set([
        total,
        Math.ceil(total / 1000) * 1000,
        Math.ceil(total / 5000) * 5000,
        Math.ceil(total / 10000) * 10000,
      ]),
    )
      .filter((amount) => amount >= total)
      .slice(0, 4);
  }, [total]);

  async function verifyStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextStaffId = staffIdDraft.trim();

    if (!nextStaffId) {
      setStaffError("Staff ID ထည့်ပါ။");
      staffInputRef.current?.focus();
      return;
    }

    try {
      setStaffLoading(true);
      setStaffError("");

      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const data = asRecord(
        await fetchStaffById(nextStaffId, getAccessToken() || ""),
      );

      if (Object.keys(data).length === 0) {
        throw new Error("ဒီ Staff ID ကို မတွေ့ပါ။");
      }

      const staff = Object.keys(asRecord(data.staff)).length
        ? asRecord(data.staff)
        : Object.keys(asRecord(data.data)).length
          ? asRecord(data.data)
          : data;

      const staffId =
        pickString(staff, [
          "staffId",
          "staff_id",
          "staffCode",
          "staff_code",
          "id",
          "username",
        ]) || nextStaffId;

      const staffName =
        pickString(staff, ["staffName", "name", "fullName", "username"]) ||
        staffId;

      setActiveStaff({ staffId, staffName });
      setStaffIdDraft(staffId);
    } catch (err) {
      setActiveStaff(null);
      setStaffError(
        err instanceof Error ? err.message : "ဒီ Staff ID ကို မတွေ့ပါ။",
      );
      window.setTimeout(() => staffInputRef.current?.focus(), 50);
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      setProductsLoading(true);
      setProductsError("");

      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(`${API_BASE}/api/products`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Fashion products များကိုယူမရပါ"),
        );
      }

      const data = await res.json().catch(() => null);
      const nextProducts = extractProducts(data)
        .map(mapProductToFashionProduct)
        .filter((item) => item.id && item.name);

      setProducts(nextProducts);
    } catch (err) {
      setProducts([]);
      setProductsError(
        err instanceof Error ? err.message : "Fashion products loading error",
      );
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!activeStaff) {
      staffInputRef.current?.focus();
    }
  }, [activeStaff]);

  useEffect(() => {
    if (!activeStaff) {
      setRestoredDraftKey("");
      return;
    }

    const draftKey = getFashionCartDraftKey(activeStaff.staffId);
    const storedDraft = localStorage.getItem(draftKey);

    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft) as Partial<FashionCartDraft>;
        const isFresh =
          draft.version === CART_DRAFT_VERSION &&
          typeof draft.savedAt === "number" &&
          Date.now() - draft.savedAt <= CART_DRAFT_TTL_MS;
        const validItems = Array.isArray(draft.items)
          ? draft.items.filter(
              (item): item is CartItem =>
                Boolean(
                  item &&
                    typeof item.id === "string" &&
                    typeof item.cartId === "string" &&
                    typeof item.name === "string" &&
                    Number.isFinite(item.price) &&
                    Number.isFinite(item.qty) &&
                    item.qty > 0,
                ),
            )
          : [];

        if (isFresh && validItems.length > 0) {
          setCart(validItems);
          setCartPage(1);
          setDiscount(Math.max(0, Number(draft.discount || 0)));
          setTaxPercent(Math.max(0, Number(draft.taxPercent || 0)));
          setDraftRestoreMessage(
            `Previous cart restored · ${validItems.reduce((sum, item) => sum + item.qty, 0)} items`,
          );
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    }

    setRestoredDraftKey(draftKey);
  }, [activeStaff]);

  useEffect(() => {
    if (!draftRestoreMessage) return;

    const timer = window.setTimeout(() => setDraftRestoreMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [draftRestoreMessage]);

  useEffect(() => {
    if (!activeStaff) return;

    const draftKey = getFashionCartDraftKey(activeStaff.staffId);
    if (restoredDraftKey !== draftKey) return;

    if (cart.length === 0) {
      localStorage.removeItem(draftKey);
      return;
    }

    const draft: FashionCartDraft = {
      version: CART_DRAFT_VERSION,
      savedAt: Date.now(),
      staffId: activeStaff.staffId,
      discount,
      taxPercent,
      items: cart,
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [activeStaff, cart, discount, taxPercent, restoredDraftKey]);

  useEffect(() => {
    setProductPage(1);
  }, [selectedCategory, search]);

  useEffect(() => {
    setCartPage((current) => Math.min(current, cartTotalPages));
  }, [cart.length, cartTotalPages]);

  useEffect(() => {
    if (!lastAddedProductKey) return;

    const timer = window.setTimeout(() => {
      setLastAddedProductKey("");
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [lastAddedProductKey]);

  useEffect(() => {
    return () => {
      if (addedFeedbackTimerRef.current !== null) {
        window.clearTimeout(addedFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const savedWidth = Number(localStorage.getItem(CART_WIDTH_STORAGE_KEY));

    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setCartWidth(
        Math.min(MAX_CART_WIDTH, Math.max(MIN_CART_WIDTH, savedWidth)),
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_WIDTH_STORAGE_KEY, String(cartWidth));
  }, [cartWidth]);

  useEffect(() => {
    if (!isResizingCart) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = cartResizeStartRef.current.pointerX - event.clientX;
      const viewportMax = Math.max(
        MIN_CART_WIDTH,
        Math.min(MAX_CART_WIDTH, window.innerWidth * 0.55),
      );

      setCartWidth(
        Math.min(
          viewportMax,
          Math.max(MIN_CART_WIDTH, cartResizeStartRef.current.width + delta),
        ),
      );
    };

    const finishResize = () => setIsResizingCart(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
    };
  }, [isResizingCart]);

  useEffect(() => {
    if (!paymentOpen || paymentMethod !== "CASH") return;

    const timer = window.setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [paymentOpen, paymentMethod]);

  function validateStock(product: FashionProduct, nextQty: number) {
    if (product.stock !== null && nextQty > product.stock) {
      return `${product.name} stock မလုံလောက်ပါ။ Available: ${product.stock}, Cart: ${nextQty}`;
    }

    return "";
  }

  function addToCart(product: FashionProduct) {
    if (!product.available || product.stock === 0) {
      setPaymentError(`${product.name} stock မရှိပါ။`);
      return false;
    }

    const productKey = product.variantId || product.id;
    const currentItem = cart.find(
      (item) => (item.variantId || item.id) === productKey,
    );
    const stockError = validateStock(product, (currentItem?.qty || 0) + 1);

    if (stockError) {
      setPaymentError(stockError);
      return false;
    }

    const newCartId = createCartId();

    setPaymentError("");
    setLastAddedProductKey(productKey);
    setCartPage(1);

    setCart((prev) => {
      const foundIndex = prev.findIndex(
        (item) => (item.variantId || item.id) === productKey,
      );
      const found = foundIndex >= 0 ? prev[foundIndex] : null;

      if (found) {
        const nextQty = found.qty + 1;
        const latestStockError = validateStock(product, nextQty);

        if (latestStockError) {
          setPaymentError(latestStockError);
          return prev;
        }

        const updatedItem = { ...found, qty: nextQty };

        return [
          updatedItem,
          ...prev.filter((item) => item.cartId !== found.cartId),
        ];
      }

      return [
        {
          ...product,
          cartId: newCartId,
          qty: 1,
        },
        ...prev,
      ];
    });
    return true;
  }

  function showCartAddedFeedback() {
    setAddedFeedbackVisible(true);

    if (addedFeedbackTimerRef.current !== null) {
      window.clearTimeout(addedFeedbackTimerRef.current);
    }

    addedFeedbackTimerRef.current = window.setTimeout(() => {
      setAddedFeedbackVisible(false);
      addedFeedbackTimerRef.current = null;
    }, 900);
  }

  function findCartAnimationTarget() {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-fashion-cart-target]"),
    );
    const visibleTarget = targets.find((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const rect = visibleTarget?.getBoundingClientRect();

    return rect
      ? {
          x: rect.left + rect.width / 2,
          y: rect.top + Math.min(90, rect.height / 2),
        }
      : { x: window.innerWidth - 44, y: window.innerHeight - 44 };
  }

  function animateProductToCart(
    product: FashionProduct,
    sourceElement: HTMLButtonElement,
  ) {
    const sourceRect = sourceElement.getBoundingClientRect();

    setFlyingProduct({
      token: Date.now() + Math.random(),
      product,
      from: {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
      },
      to: findCartAnimationTarget(),
    });
  }

  function getDndItemId(value: unknown) {
    const record = asRecord(value);
    const id = record.id;

    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  }

  function getDndOperation(event: unknown) {
    const eventRecord = asRecord(event);
    const operation = asRecord(eventRecord.operation);

    return {
      canceled: eventRecord.canceled === true,
      sourceId:
        getDndItemId(operation.source) || getDndItemId(eventRecord.active),
      targetId:
        getDndItemId(operation.target) || getDndItemId(eventRecord.over),
    };
  }

  function handleProductDragStart(event: unknown) {
    const { sourceId } = getDndOperation(event);

    if (sourceId.startsWith("fashion-product:")) {
      suppressProductClickRef.current = true;
      setDraggingProductId(sourceId.replace("fashion-product:", ""));
    }
  }

  function handleProductDragEnd(event: unknown) {
    const { canceled, sourceId, targetId } = getDndOperation(event);
    setDraggingProductId("");

    window.setTimeout(() => {
      suppressProductClickRef.current = false;
    }, 120);

    if (
      canceled ||
      (targetId !== CART_DROP_ID && targetId !== MOBILE_CART_DROP_ID)
    ) {
      return;
    }

    const productId = sourceId.replace("fashion-product:", "");
    const product = products.find((item) => item.id === productId);

    if (product && addToCart(product)) showCartAddedFeedback();
  }

  function handleProductClick(
    product: FashionProduct,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    if (suppressProductClickRef.current) return;

    if (addToCart(product)) {
      animateProductToCart(product, event.currentTarget);
      showCartAddedFeedback();
    }
  }

  function beginCartResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    cartResizeStartRef.current = {
      pointerX: event.clientX,
      width: cartWidth,
    };
    setIsResizingCart(true);
  }

  function isLastAddedItem(item: CartItem) {
    return Boolean(
      lastAddedProductKey &&
        (item.variantId || item.id) === lastAddedProductKey,
    );
  }

  function updateQty(cartId: string, action: "plus" | "minus") {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId !== cartId) return item;

          const nextQty = action === "plus" ? item.qty + 1 : item.qty - 1;
          const stockError = validateStock(item, nextQty);

          if (action === "plus" && stockError) {
            setPaymentError(stockError);
            return item;
          }

          setPaymentError("");
          return { ...item, qty: nextQty };
        })
        .filter((item) => item.qty > 0),
    );
  }

  function removeItem(cartId: string) {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  }

  function clearCart() {
    setCart([]);
    setCartPage(1);
    setLastAddedProductKey("");
    setDiscount(0);
    setCashReceived("");
    setPaymentOpen(false);
    setPaymentError("");
  }

  function handleGoToDashboard() {
    if (cart.length === 0) {
      router.push("/dashboard");
      return;
    }

    setExitConfirmOpen(true);
  }

  function continueToPaymentFromExit() {
    setExitConfirmOpen(false);
    setPaymentError("");
    setPaymentOpen(true);
  }

  function discardCartAndExit() {
    if (activeStaff) {
      localStorage.removeItem(getFashionCartDraftKey(activeStaff.staffId));
    }
    clearCart();
    router.push("/dashboard");
  }

  async function completePayment() {
    if (!activeStaff) {
      setPaymentOpen(false);
      setStaffError("Staff ID ထည့်ပါ။");
      return;
    }

    if (cart.length === 0) return;

    if (paymentMethod === "CASH" && cashNumber < total) {
      setPaymentError("Cash received မလုံလောက်သေးပါ");
      return;
    }

    const missingProductId = cart.find(
      (item) => !String(item.dbId || "").trim(),
    );

    if (missingProductId) {
      setPaymentError(
        `${missingProductId.name} မှာ Product DB ID မပါပါ။ Product API response မှာ id ပါ/မပါ စစ်ပါ။`,
      );
      return;
    }

    const payload = {
      staffId: activeStaff.staffId,
      staffName: activeStaff.staffName,
      paymentMethod,
      subtotal,
      taxAmount: tax,
      discountPercent: 0,
      discountAmount: discount,
      grandTotal: total,
      cashGiven: paymentMethod === "CASH" ? cashNumber : 0,
      changeAmount: paymentMethod === "CASH" ? change : 0,
      businessType: "FASHION",
      items: cart.map((item) => {
        const productId = String(item.dbId || "").trim();

        return {
          productId,
          product_id: productId,
          variantId: item.variantId || "",
          variant_id: item.variantId || "",
          productName: item.name,
          product_name: item.name,
          qty: item.qty,
          price: item.price,
          barcode: item.variantBarcode || item.barcode || "",
          sku: item.sku || "",
          color: item.color || "",
          size: item.size || "",
          brand: item.brand || "",
          lineTotal: item.price * item.qty,
          line_total: item.price * item.qty,
        };
      }),
    };

    try {
      setPaymentSaving(true);
      setPaymentError("");

      if (!getAccessToken()) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const res = await fetch(`${API_BASE}/api/pos/receipts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const responseText = await res.text().catch(() => "");
      let data: unknown = null;

      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = responseText;
        }
      }

      const rootRecord = asRecord(data);
      const nestedRecord = getNestedRecord(rootRecord, [
        "data",
        "receipt",
        "result",
      ]);
      const receiptRecord =
        Object.keys(nestedRecord).length > 0 ? nestedRecord : rootRecord;

      if (res.status === 401 || res.status === 403) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      if (!res.ok) {
        throw new Error(
          pickString(receiptRecord, ["message", "error", "detail"]) ||
            pickString(rootRecord, ["message", "error", "detail"]) ||
            (typeof data === "string" ? data : "") ||
            "Payment နှင့် receipt သိမ်းမရပါ။ ထပ်မနှိပ်ခင် server ကိုစစ်ပါ။",
        );
      }

      const receiptNo =
        pickString(receiptRecord, [
          "receiptNo",
          "receipt_no",
          "receiptNumber",
          "paymentNo",
        ]) ||
        pickString(rootRecord, [
          "receiptNo",
          "receipt_no",
          "receiptNumber",
          "paymentNo",
        ]);

      if (!receiptNo) {
        throw new Error(
          "Payment API က success ပြန်ပေမဲ့ receipt number မပါပါ။ Receipt History မှာစစ်ပြီးမှ ထပ်မံ payment လုပ်ပါ။",
        );
      }

      const persistedAt =
        pickString(receiptRecord, ["createdAt", "created_at", "paidAt"]) ||
        pickString(rootRecord, ["createdAt", "created_at", "paidAt"]);

      setReceiptData({
        receiptNo,
        paidAt: persistedAt || new Date().toISOString(),
        cashierName: activeStaff.staffName,
        cashierStaffId: activeStaff.staffId,
        paymentMethod,
        subtotal,
        discount,
        tax,
        total,
        cashReceived: paymentMethod === "CASH" ? cashNumber : 0,
        changeAmount: paymentMethod === "CASH" ? change : 0,
        items: cart,
        shopInfo,
      });

      setReceiptOpen(true);
      setPaymentOpen(false);

      setProducts((prev) =>
        prev.map((product) => {
          const sold = cart.find(
            (item) =>
              item.variantId === product.variantId ||
              item.id === product.id ||
              (!!item.barcode && item.barcode === product.barcode),
          );

          if (!sold || product.stock === null) return product;

          const nextStock = Math.max(product.stock - sold.qty, 0);

          return {
            ...product,
            stock: nextStock,
            available: nextStock > 0,
          };
        }),
      );

      clearCart();
      setPaymentMethod("CASH");
      await fetchProducts();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Payment save failed.",
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  function printReceipt() {
    if (!receiptData) return;

    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      setPaymentError(
        "Print window ကိုဖွင့်မရပါ။ Browser popup ကို allow လုပ်ပါ။",
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(receiptData));
    printWindow.document.close();
  }

  if (!activeStaff) {
    return (
      <main
        className={`min-h-screen ${
          darkMode
            ? "bg-slate-950 text-slate-50"
            : "bg-[#f8f3ea] text-slate-950"
        }`}
      >
        <BusinessTypeGuard allow="FASHION" />

        <div className="mx-auto flex min-h-screen max-w-5xl flex-col p-4 lg:p-6">
          <section
            className={`rounded-[2rem] border p-4 shadow-sm ${
              darkMode
                ? "border-white/10 bg-white/5"
                : "border-orange-100 bg-white/80"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
                  <ShoppingBag size={26} />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">
                    Fashion POS
                  </h1>
                  <p
                    className={`mt-0.5 text-xs font-semibold sm:text-sm ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Staff ID ဖြင့်ဝင်ပြီး အထည်ဆိုင် POS ကိုအသုံးပြုပါ။
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDarkMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  darkMode
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                {darkMode ? "Day Mode" : "Night Mode"}
              </button>
            </div>
          </section>

          <section className="grid flex-1 place-items-center py-8">
            <motion.form
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={verifyStaff}
              className={`w-full max-w-xl rounded-[2rem] border p-6 shadow-sm ${
                darkMode
                  ? "border-white/10 bg-white/5"
                  : "border-orange-100 bg-white/90"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <IdCard size={30} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Staff ID လိုအပ်ပါတယ်</h2>
                  <p
                    className={`mt-0.5 text-xs font-semibold sm:text-sm ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Staff ID ကို scan လုပ်ပါ သို့မဟုတ် ရိုက်ထည့်ပါ။
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">Staff ID</label>
                <div
                  className={`mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 ${
                    darkMode
                      ? "bg-slate-900 ring-1 ring-white/10"
                      : "bg-slate-50 ring-1 ring-orange-100"
                  }`}
                >
                  <Search size={18} className="text-slate-400" />
                  <input
                    ref={staffInputRef}
                    value={staffIdDraft}
                    onChange={(event) => {
                      setStaffIdDraft(event.target.value);
                      setStaffError("");
                    }}
                    placeholder="Enter or scan Staff ID"
                    className="w-full bg-transparent text-lg font-black outline-none placeholder:text-slate-400"
                    disabled={staffLoading}
                  />
                </div>
              </div>

              {staffError && (
                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm font-black ${
                    darkMode
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-red-100 bg-red-50 text-red-600"
                  }`}
                >
                  {staffError}
                </div>
              )}

              <button
                type="submit"
                disabled={staffLoading}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {staffLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Check size={18} />
                )}
                Unlock POS
              </button>
            </motion.form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <DragDropProvider
      onDragStart={handleProductDragStart}
      onDragEnd={handleProductDragEnd}
    >
      <main
        className={`min-h-screen ${
          darkMode
            ? "bg-slate-950 text-slate-50"
            : "bg-[#f8f3ea] text-slate-950"
        } ${isResizingCart ? "cursor-col-resize" : ""}`}
      >
        <BusinessTypeGuard allow="FASHION" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 p-2 pb-24 sm:p-3 sm:pb-24 lg:landscape:gap-4 lg:landscape:p-5">
        <header
          className={`sticky top-0 z-30 -mx-2 -mt-2 border-b px-2 py-2.5 backdrop-blur-xl sm:-mx-3 sm:-mt-3 sm:px-3 lg:-mx-5 lg:-mt-5 lg:px-5 ${
            darkMode
              ? "border-white/10 bg-slate-950/92"
              : "border-orange-100 bg-[#f8f3ea]/92"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ring-1 transition sm:px-3 sm:py-1.5 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white ring-white/10 hover:bg-white/15"
                      : "bg-white text-slate-900 ring-orange-100 hover:bg-orange-50"
                  }`}
                  aria-label="Go to dashboard"
                >
                  <ArrowLeft size={17} className="text-orange-500" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>

                <div
                  className={`inline-flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ring-1 sm:px-3 sm:py-1.5 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white ring-white/10"
                      : "bg-white text-slate-900 ring-orange-100"
                  }`}
                >
                  <IdCard size={17} className="text-orange-500" />
                  <span className="min-w-0 max-w-[120px] truncate sm:max-w-[170px]">
                    {activeStaff.staffName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      darkMode
                        ? "bg-slate-900 text-slate-300"
                        : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {activeStaff.staffId}
                  </span>
                </div>

                <div
                  className={`inline-flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ring-1 sm:px-3 sm:py-1.5 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white ring-white/10"
                      : "bg-white text-slate-900 ring-orange-100"
                  }`}
                >
                  <Package size={17} className="text-orange-500" />
                  <span>{filteredProducts.length} products</span>
                </div>

                <div
                  className={`inline-flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ring-1 sm:px-3 sm:py-1.5 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white ring-white/10"
                      : "bg-white text-slate-900 ring-orange-100"
                  }`}
                >
                  <Receipt size={17} className="text-orange-500" />
                  <span>{cart.length} items</span>
                  <span className="text-orange-500">
                    {formatMoney(total)} Ks
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  onClick={() => {
                    setPaymentError("");
                    setPaymentOpen(true);
                  }}
                  disabled={cart.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-2.5 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Wallet size={17} />
                  Payment
                </button>

                <button
                  onClick={() => setCartDialogOpen(true)}
                  disabled={cart.length === 0}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-white text-slate-900 ring-1 ring-orange-100 hover:bg-orange-50"
                  }`}
                >
                  <Receipt size={17} />
                  View Cart
                </button>

                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-white text-slate-900 ring-1 ring-orange-100 hover:bg-orange-50"
                  }`}
                >
                  <Trash2 size={17} />
                  Clear
                </button>

                <button
                  onClick={() => setDarkMode((v) => !v)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2.5 text-xs font-black transition sm:gap-2 sm:px-4 sm:text-sm ${
                    darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                  {darkMode ? "Day" : "Night"}
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_190px] lg:grid-cols-[1fr_230px_auto] lg:items-center">
              <div
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${
                  darkMode
                    ? "bg-slate-900 ring-1 ring-white/10"
                    : "bg-white ring-1 ring-orange-100"
                }`}
              >
                <Search size={18} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product, barcode, color, size..."
                  className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 sm:text-sm"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className={`rounded-2xl px-3 py-2.5 text-xs font-black outline-none sm:px-4 sm:py-3 sm:text-sm ${
                  darkMode
                    ? "bg-slate-900 text-white ring-1 ring-white/10"
                    : "bg-white text-slate-900 ring-1 ring-orange-100"
                }`}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All Categories" : category}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                <button
                  onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  disabled={safeProductPage <= 1}
                  className={`grid h-11 w-11 place-items-center rounded-2xl disabled:opacity-40 ${
                    darkMode ? "bg-white/10" : "bg-white ring-1 ring-orange-100"
                  }`}
                >
                  <ChevronLeft size={18} />
                </button>
                <span
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    darkMode ? "bg-white/10" : "bg-white ring-1 ring-orange-100"
                  }`}
                >
                  {safeProductPage}/{productTotalPages}
                </span>
                <button
                  onClick={() =>
                    setProductPage((p) => Math.min(productTotalPages, p + 1))
                  }
                  disabled={safeProductPage >= productTotalPages}
                  className={`grid h-11 w-11 place-items-center rounded-2xl disabled:opacity-40 ${
                    darkMode ? "bg-white/10" : "bg-white ring-1 ring-orange-100"
                  }`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <section
          className="grid flex-1 gap-3 lg:landscape:grid-cols-[minmax(0,1fr)_380px] xl:landscape:grid-cols-[minmax(0,1fr)_var(--cart-width)]"
          style={
            { "--cart-width": `${cartWidth}px` } as React.CSSProperties
          }
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">
                  Products
                </h1>
                <p
                  className={`mt-0.5 text-xs font-semibold sm:text-sm ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Product ကိုနှိပ်ပြီး Add နိုင်သလို card ကို Cart ထဲ drag & drop
                  လုပ်နိုင်ပါတယ်။ Size / Color / Barcode ဖြင့်ရှာနိုင်ပါတယ်။
                </p>
              </div>

              <span className="w-fit rounded-2xl bg-orange-500/10 px-3 py-1.5 text-xs font-black text-orange-600 sm:px-4 sm:py-2 sm:text-sm">
                Showing {paginatedProducts.length} of {filteredProducts.length}
              </span>
            </div>

            {productsLoading ? (
              <div className="grid min-h-[520px] place-items-center">
                <Loader2 className="animate-spin text-orange-500" size={34} />
              </div>
            ) : productsError ? (
              <div
                className={`rounded-2xl border p-4 text-sm font-black ${
                  darkMode
                    ? "border-red-400/30 bg-red-500/10 text-red-200"
                    : "border-red-100 bg-red-50 text-red-600"
                }`}
              >
                {productsError}
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div
                className={`grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed p-8 text-center text-sm font-black ${
                  darkMode
                    ? "border-white/10 bg-white/5 text-slate-300"
                    : "border-orange-200 bg-orange-50/70 text-slate-600"
                }`}
              >
                Product မရှိသေးပါ။
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                {paginatedProducts.map((product) => (
                  <DraggableProductCard
                    key={product.id}
                    productId={product.id}
                    disabled={!product.available || product.stock === 0}
                    onClick={(event) => handleProductClick(product, event)}
                    className={`group flex h-full min-h-[110px] w-full overflow-hidden rounded-[1.25rem] border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[128px] sm:rounded-[1.45rem] ${
                      (product.variantId || product.id) === lastAddedProductKey
                        ? darkMode
                          ? "border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/30"
                          : "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/40"
                        : darkMode
                        ? "border-white/10 bg-slate-900 hover:bg-slate-800"
                        : "border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50"
                    }`}
                  >
                    <div
                      className={`relative m-1.5 grid h-[96px] w-[78px] shrink-0 place-items-center overflow-hidden rounded-[1rem] px-1.5 py-1.5 ring-1 sm:m-2 sm:h-[112px] sm:w-[104px] sm:rounded-[1.1rem] sm:px-2 sm:py-2 ${
                        darkMode
                          ? "bg-white/5 ring-white/10"
                          : "bg-gradient-to-br from-orange-50 via-amber-50 to-white ring-orange-100"
                      }`}
                    >
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full max-h-[82px] w-full object-contain drop-shadow-sm transition duration-300 group-hover:scale-105 sm:max-h-[96px]"
                        />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/10 text-orange-400 sm:h-16 sm:w-16">
                          <ShoppingBag size={26} />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between p-2 pl-1 sm:p-3 sm:pl-1.5">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-xs font-black leading-snug sm:text-sm">
                              {product.name}
                            </div>
                            <div
                              className={`mt-1 line-clamp-1 text-[11px] font-bold ${
                                darkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {getFashionSubtitle(product)}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                              product.stock === 0
                                ? "bg-red-500/10 text-red-500"
                                : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            {product.stock === null
                              ? "Stock -"
                              : `Stock ${product.stock}`}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
                          <span className="max-w-[140px] truncate rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-600">
                            {product.category}
                          </span>
                          {product.size && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                darkMode
                                  ? "bg-white/10 text-slate-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {product.size}
                            </span>
                          )}
                          {product.color && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                darkMode
                                  ? "bg-white/10 text-slate-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {product.color}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
                        <span className="text-sm font-black text-orange-500 sm:text-lg">
                          {formatMoney(product.price)} Ks
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm sm:rounded-2xl sm:px-3 sm:text-[11px] ${
                            (product.variantId || product.id) === lastAddedProductKey
                              ? "bg-emerald-500 shadow-emerald-500/20"
                              : "bg-orange-500 shadow-orange-500/20"
                          }`}
                        >
                          {(product.variantId || product.id) === lastAddedProductKey ? (
                            <><Check size={13} /> Added</>
                          ) : (
                            "Add"
                          )}
                        </span>
                      </div>
                    </div>
                  </DraggableProductCard>
                ))}
              </div>
            )}
          </div>

          <div className="relative hidden min-w-0 lg:landscape:sticky lg:landscape:top-[118px] lg:landscape:block lg:landscape:h-[calc(100vh-132px)]">
            <button
              type="button"
              onPointerDown={beginCartResize}
              onDoubleClick={() => setCartWidth(DEFAULT_CART_WIDTH)}
              className={`absolute -left-2 top-1/2 z-40 hidden h-24 w-4 -translate-y-1/2 cursor-col-resize items-center justify-center rounded-full border shadow-lg xl:landscape:flex ${
                isResizingCart
                  ? "border-orange-400 bg-orange-500 text-white"
                  : darkMode
                    ? "border-white/10 bg-slate-800 text-slate-300 hover:bg-orange-500 hover:text-white"
                    : "border-orange-100 bg-white text-orange-500 hover:bg-orange-500 hover:text-white"
              }`}
              aria-label="Resize cart width"
              title="Drag to resize cart · Double-click to reset"
            >
              <GripVertical size={14} />
            </button>

            <CartDropSurface
              dragging={Boolean(draggingProductId)}
              darkMode={darkMode}
              addedFeedbackVisible={addedFeedbackVisible}
            >
            <div
              className={`flex items-center justify-between gap-2 border-b p-2.5 sm:gap-3 sm:p-3 ${
                darkMode ? "border-white/10" : "border-orange-100"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25 sm:h-10 sm:w-10">
                    <Receipt size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black leading-tight">Cart</h2>
                    <p
                      className={`text-xs font-bold ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {cart.length} items · Drag left edge to resize
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`hidden items-center gap-1 rounded-xl p-1 xl:landscape:flex ${
                  darkMode ? "bg-white/10" : "bg-orange-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCartWidth((width) =>
                      Math.max(MIN_CART_WIDTH, width - 40),
                    )
                  }
                  disabled={cartWidth <= MIN_CART_WIDTH}
                  className={`grid h-7 w-7 place-items-center rounded-lg disabled:opacity-30 ${
                    darkMode ? "hover:bg-white/10" : "hover:bg-white"
                  }`}
                  aria-label="Make cart narrower"
                  title="Narrower cart"
                >
                  <Minus size={13} />
                </button>
                <GripVertical size={13} className="text-orange-500" />
                <button
                  type="button"
                  onClick={() =>
                    setCartWidth((width) =>
                      Math.min(MAX_CART_WIDTH, width + 40),
                    )
                  }
                  disabled={cartWidth >= MAX_CART_WIDTH}
                  className={`grid h-7 w-7 place-items-center rounded-lg disabled:opacity-30 ${
                    darkMode ? "hover:bg-white/10" : "hover:bg-white"
                  }`}
                  aria-label="Make cart wider"
                  title="Wider cart"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Total
                </div>
                <div className="text-lg font-black text-orange-500 sm:text-xl">
                  {formatMoney(total)} Ks
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-2.5 sm:p-3">
              {paginatedCart.length === 0 ? (
                <div
                  className={`grid h-full min-h-[280px] place-items-center rounded-[1.5rem] border border-dashed px-4 text-center sm:min-h-[360px] sm:px-5 ${
                    darkMode
                      ? "border-white/10 bg-white/5 text-slate-400"
                      : "border-orange-200 bg-orange-50/60 text-slate-500"
                  }`}
                >
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
                      <ShoppingBag size={28} />
                    </div>
                    <p className="mt-3 text-sm font-black">
                      Product ကိုရွေးပြီး cart ထဲထည့်ပါ။
                    </p>
                    <p className="mt-1 text-xs font-bold opacity-75">
                      နောက်ဆုံးရွေးထားတဲ့ item ကို Cart အပေါ်ဆုံးမှာ
                      အလိုအလျောက်ပြပေးပါမယ်။
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-1.5 sm:gap-2">
                  {paginatedCart.map((item) => (
                    <div
                      key={item.cartId}
                      className={`group rounded-[1rem] border p-1.5 transition hover:-translate-y-0.5 sm:rounded-[1.15rem] sm:p-2 ${
                        isLastAddedItem(item)
                          ? darkMode
                            ? "border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/30"
                            : "border-orange-400 bg-orange-50 ring-2 ring-orange-300/40"
                          : darkMode
                            ? "border-white/10 bg-slate-900/90 hover:bg-slate-900"
                            : "border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${
                            darkMode ? "bg-white/10" : "bg-orange-50"
                          }`}
                        >
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ShoppingBag
                              size={19}
                              className="text-orange-400"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="line-clamp-1 text-sm font-black leading-tight">
                                  {item.name}
                                </h3>
                                {isLastAddedItem(item) && (
                                  <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                    Latest
                                  </span>
                                )}
                              </div>
                              <p
                                className={`mt-0.5 line-clamp-1 text-[11px] font-bold ${
                                  darkMode ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                {getFashionSubtitle(item)}
                              </p>
                            </div>

                            <button
                              onClick={() => removeItem(item.cartId)}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-1.5 sm:gap-2">
                            <div className="inline-flex items-center gap-1 rounded-2xl bg-orange-500/10 p-1 text-orange-600">
                              <button
                                onClick={() => updateQty(item.cartId, "minus")}
                                className={`grid h-6 w-6 place-items-center rounded-lg ${
                                  darkMode
                                    ? "bg-slate-950 text-orange-400"
                                    : "bg-white text-orange-600"
                                }`}
                                aria-label="Decrease quantity"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="min-w-6 text-center text-xs font-black">
                                {item.qty}
                              </span>
                              <button
                                onClick={() => updateQty(item.cartId, "plus")}
                                className={`grid h-6 w-6 place-items-center rounded-lg ${
                                  darkMode
                                    ? "bg-slate-950 text-orange-400"
                                    : "bg-white text-orange-600"
                                }`}
                                aria-label="Increase quantity"
                              >
                                <Plus size={13} />
                              </button>
                            </div>

                            <div className="text-right leading-tight">
                              <div className="text-[11px] font-bold text-slate-400">
                                {formatMoney(item.price)} × {item.qty}
                              </div>
                              <div className="text-sm font-black text-orange-500">
                                {formatMoney(item.price * item.qty)} Ks
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`border-t p-2 sm:p-2.5 ${
                darkMode ? "border-white/10" : "border-orange-100"
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  onClick={() => setCartPage((p) => Math.max(1, p - 1))}
                  disabled={safeCartPage <= 1}
                  className={`grid h-8 w-8 place-items-center rounded-xl disabled:opacity-40 ${
                    darkMode ? "bg-white/10" : "bg-orange-50"
                  }`}
                >
                  <ChevronLeft size={17} />
                </button>

                <span
                  className={`rounded-xl px-3 py-1.5 text-xs font-black ${
                    darkMode ? "bg-white/10" : "bg-orange-50 text-slate-700"
                  }`}
                >
                  {safeCartPage}/{cartTotalPages}
                </span>

                <button
                  onClick={() =>
                    setCartPage((p) => Math.min(cartTotalPages, p + 1))
                  }
                  disabled={safeCartPage >= cartTotalPages}
                  className={`grid h-8 w-8 place-items-center rounded-xl disabled:opacity-40 ${
                    darkMode ? "bg-white/10" : "bg-orange-50"
                  }`}
                >
                  <ChevronRight size={17} />
                </button>
              </div>

              <div
                className={`rounded-[1.25rem] border p-2.5 ${
                  darkMode
                    ? "border-white/10 bg-slate-900"
                    : "border-orange-100 bg-orange-50/60"
                }`}
              >
                <div className="grid grid-cols-2 gap-1.5 text-xs font-black">
                  <div
                    className={`rounded-xl p-2 ${
                      darkMode ? "bg-white/5" : "bg-white"
                    }`}
                  >
                    <div className="text-slate-400">Subtotal</div>
                    <div className="mt-0.5 text-sm">
                      {formatMoney(subtotal)} Ks
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-2 ${
                      darkMode ? "bg-white/5" : "bg-white"
                    }`}
                  >
                    <div className="text-slate-400">Total</div>
                    <div className="mt-0.5 text-sm text-orange-500">
                      {formatMoney(total)} Ks
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <label
                    className={`rounded-xl px-3 py-1.5 ${
                      darkMode ? "bg-white/5" : "bg-white"
                    }`}
                  >
                    <span className="text-[11px] font-black text-slate-400">
                      Discount
                    </span>
                    <input
                      value={discount}
                      onChange={(event) =>
                        setDiscount(
                          Math.max(0, Number(event.target.value || 0)),
                        )
                      }
                      type="number"
                      className="mt-0.5 w-full bg-transparent text-right text-sm font-black outline-none"
                    />
                  </label>

                  <label
                    className={`rounded-xl px-3 py-1.5 ${
                      darkMode ? "bg-white/5" : "bg-white"
                    }`}
                  >
                    <span className="text-[11px] font-black text-slate-400">
                      Tax %
                    </span>
                    <input
                      value={taxPercent}
                      onChange={(event) =>
                        setTaxPercent(
                          Math.max(0, Number(event.target.value || 0)),
                        )
                      }
                      type="number"
                      className="mt-0.5 w-full bg-transparent text-right text-sm font-black outline-none"
                    />
                  </label>
                </div>

                {paymentError && (
                  <div
                    className={`mt-2 rounded-2xl border p-2.5 text-xs font-black ${
                      darkMode
                        ? "border-red-400/30 bg-red-500/10 text-red-200"
                        : "border-red-100 bg-red-50 text-red-600"
                    }`}
                  >
                    {paymentError}
                  </div>
                )}

                <button
                  onClick={() => setPaymentOpen(true)}
                  disabled={cart.length === 0}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wallet size={18} />
                  Payment
                </button>
              </div>
            </div>
            </CartDropSurface>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {draftRestoreMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="fixed left-1/2 top-4 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-xl shadow-emerald-500/25"
          >
            <Check size={17} /> {draftRestoreMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Exit Confirmation */}
      <AnimatePresence>
        {exitConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExitConfirmOpen(false)}
            className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-3 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(event) => event.stopPropagation()}
              className={`w-full max-w-md rounded-[2rem] border p-5 shadow-2xl sm:p-6 ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
                  <ArrowLeft size={22} />
                </div>
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(false)}
                  className={`grid h-10 w-10 place-items-center rounded-xl ${
                    darkMode ? "bg-white/10" : "bg-slate-100"
                  }`}
                  aria-label="Stay in POS"
                >
                  <X size={18} />
                </button>
              </div>

              <h2 className="mt-4 text-xl font-black">Dashboard ကို သွားမလား?</h2>
              <p className={`mt-2 text-sm font-semibold leading-6 ${darkMode ? "text-slate-300" : "text-slate-500"}`}>
                Cart ထဲမှာ {cart.reduce((sum, item) => sum + item.qty, 0)} items · {formatMoney(total)} Ks ရှိနေပါတယ်။
                Payment မပြီးသေးဘဲထွက်လျှင် လက်ရှိ cart ပျောက်သွားနိုင်ပါတယ်။
              </p>

              <div className={`mt-4 rounded-2xl p-3 ${darkMode ? "bg-white/5" : "bg-orange-50"}`}>
                <div className="flex items-center justify-between text-sm font-black">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)} Ks</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-black">
                  <span>Total</span>
                  <span className="text-orange-500">{formatMoney(total)} Ks</span>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(false)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Stay in POS
                </button>

                <button
                  type="button"
                  onClick={continueToPaymentFromExit}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20"
                >
                  <Wallet size={17} />
                  Continue to Payment
                </button>

                <button
                  type="button"
                  onClick={discardCartAndExit}
                  className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-500 transition hover:bg-red-500 hover:text-white sm:col-span-2"
                >
                  Discard & Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartDialogOpen && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 42, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 42, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 330, damping: 32 }}
              onClick={(event) => event.stopPropagation()}
              className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border shadow-2xl sm:max-w-2xl sm:rounded-[2rem] ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div
                className={`flex items-center justify-between gap-3 border-b p-4 ${
                  darkMode ? "border-white/10" : "border-orange-100"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                    <Receipt size={22} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black leading-tight">View Cart</h2>
                    <p
                      className={`text-xs font-bold ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      နောက်ဆုံးရွေးထားတဲ့ item ကို အပေါ်ဆုံးမှာပြပြီး pagination ဖြင့်ကြည့်နိုင်ပါတယ်
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setCartDialogOpen(false)}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${
                    darkMode
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {paginatedCart.length === 0 ? (
                  <div
                    className={`grid min-h-[300px] place-items-center rounded-[1.5rem] border border-dashed px-5 text-center ${
                      darkMode
                        ? "border-white/10 bg-white/5 text-slate-400"
                        : "border-orange-200 bg-orange-50/60 text-slate-500"
                    }`}
                  >
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
                        <ShoppingBag size={28} />
                      </div>
                      <p className="mt-3 text-sm font-black">
                        Product ကိုရွေးပြီး cart ထဲထည့်ပါ။
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {paginatedCart.map((item) => (
                      <div
                        key={item.cartId}
                        className={`rounded-[1.15rem] border p-2 transition ${
                          isLastAddedItem(item)
                            ? darkMode
                              ? "border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/30"
                              : "border-orange-400 bg-orange-50 ring-2 ring-orange-300/40"
                            : darkMode
                              ? "border-white/10 bg-slate-900"
                              : "border-orange-100 bg-orange-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl ${
                              darkMode ? "bg-white/10" : "bg-white"
                            }`}
                          >
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <ShoppingBag size={20} className="text-orange-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h3 className="line-clamp-1 text-sm font-black leading-tight">
                                    {item.name}
                                  </h3>
                                  {isLastAddedItem(item) && (
                                    <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={`mt-0.5 line-clamp-1 text-[11px] font-bold ${
                                    darkMode ? "text-slate-400" : "text-slate-500"
                                  }`}
                                >
                                  {getFashionSubtitle(item)}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItem(item.cartId)}
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-1 rounded-2xl bg-orange-500/10 p-1 text-orange-600">
                                <button
                                  onClick={() => updateQty(item.cartId, "minus")}
                                  className={`grid h-7 w-7 place-items-center rounded-lg ${
                                    darkMode
                                      ? "bg-slate-950 text-orange-400"
                                      : "bg-white text-orange-600"
                                  }`}
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="min-w-6 text-center text-xs font-black">
                                  {item.qty}
                                </span>
                                <button
                                  onClick={() => updateQty(item.cartId, "plus")}
                                  className={`grid h-7 w-7 place-items-center rounded-lg ${
                                    darkMode
                                      ? "bg-slate-950 text-orange-400"
                                      : "bg-white text-orange-600"
                                  }`}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>

                              <div className="text-right leading-tight">
                                <div className="text-[11px] font-bold text-slate-400">
                                  {formatMoney(item.price)} × {item.qty}
                                </div>
                                <div className="text-sm font-black text-orange-500">
                                  {formatMoney(item.price * item.qty)} Ks
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`border-t p-3 sm:p-4 ${
                  darkMode ? "border-white/10" : "border-orange-100"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCartPage((p) => Math.max(1, p - 1))}
                    disabled={safeCartPage <= 1}
                    className={`grid h-10 w-10 place-items-center rounded-2xl disabled:opacity-40 ${
                      darkMode ? "bg-white/10" : "bg-orange-50"
                    }`}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="text-center">
                    <div className="text-xs font-black text-slate-400">Page</div>
                    <div className="text-sm font-black">
                      {safeCartPage}/{cartTotalPages}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setCartPage((p) => Math.min(cartTotalPages, p + 1))
                    }
                    disabled={safeCartPage >= cartTotalPages}
                    className={`grid h-10 w-10 place-items-center rounded-2xl disabled:opacity-40 ${
                      darkMode ? "bg-white/10" : "bg-orange-50"
                    }`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div
                  className={`rounded-[1.5rem] border p-3 ${
                    darkMode
                      ? "border-white/10 bg-slate-900"
                      : "border-orange-100 bg-orange-50/70"
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2 text-xs font-black">
                    <div
                      className={`rounded-2xl p-3 ${
                        darkMode ? "bg-white/5" : "bg-white"
                      }`}
                    >
                      <div className="text-slate-400">Subtotal</div>
                      <div className="mt-1 text-sm">{formatMoney(subtotal)} Ks</div>
                    </div>
                    <div
                      className={`rounded-2xl p-3 ${
                        darkMode ? "bg-white/5" : "bg-white"
                      }`}
                    >
                      <div className="text-slate-400">Total</div>
                      <div className="mt-1 text-sm text-orange-500">
                        {formatMoney(total)} Ks
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCartDialogOpen(false);
                      setPaymentError("");
                      setPaymentOpen(true);
                    }}
                    disabled={cart.length === 0}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wallet size={18} />
                    Payment
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentOpen && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!paymentSaving) setPaymentOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(event) => event.stopPropagation()}
              className={`my-auto w-full max-w-lg rounded-[2rem] border p-4 shadow-2xl sm:p-6 ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black sm:text-2xl">Payment</h2>
                  <p
                    className={`mt-0.5 text-xs font-bold sm:text-sm ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {cart.reduce((sum, item) => sum + item.qty, 0)} items · Staff: {activeStaff.staffName}
                  </p>
                </div>

                <button
                  onClick={() => setPaymentOpen(false)}
                  disabled={paymentSaving}
                  className={`grid h-10 w-10 place-items-center rounded-2xl ${
                    darkMode ? "bg-white/10" : "bg-slate-100"
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                className={`mt-4 overflow-hidden rounded-3xl border ${
                  darkMode
                    ? "border-orange-400/20 bg-gradient-to-br from-orange-500/20 to-amber-400/5"
                    : "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50"
                }`}
              >
                <div className="px-5 py-5 text-center sm:py-6">
                  <p
                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                      darkMode ? "text-orange-300" : "text-orange-600"
                    }`}
                  >
                    ကျသင့်ငွေ
                  </p>
                  <p className="mt-1 text-4xl font-black tabular-nums text-orange-500 sm:text-5xl">
                    {formatMoney(total)}
                    <span className="ml-2 text-lg sm:text-xl">Ks</span>
                  </p>
                </div>

                <div
                  className={`grid grid-cols-3 border-t px-4 py-3 text-center text-xs font-bold ${
                    darkMode
                      ? "border-white/10 bg-black/10 text-slate-300"
                      : "border-orange-100 bg-white/60 text-slate-600"
                  }`}
                >
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Subtotal</p>
                    <p className="mt-1 tabular-nums">{formatMoney(subtotal)} Ks</p>
                  </div>
                  <div className={`border-x ${darkMode ? "border-white/10" : "border-orange-100"}`}>
                    <p className="text-[10px] uppercase text-slate-400">Discount</p>
                    <p className="mt-1 tabular-nums">-{formatMoney(discount)} Ks</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Tax</p>
                    <p className="mt-1 tabular-nums">{formatMoney(tax)} Ks</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  {
                    key: "CASH" as PaymentMethod,
                    label: "Cash",
                    icon: BanknoteIcon,
                  },
                  {
                    key: "CARD" as PaymentMethod,
                    label: "Card",
                    icon: CreditCard,
                  },
                  {
                    key: "WALLET" as PaymentMethod,
                    label: "Wallet",
                    icon: Wallet,
                  },
                ].map((method) => {
                  const Icon = method.icon;

                  return (
                    <button
                      key={method.key}
                      onClick={() => {
                        setPaymentMethod(method.key);
                        setPaymentError("");
                      }}
                      disabled={paymentSaving}
                      className={`rounded-2xl p-3 text-sm font-black transition ${
                        paymentMethod === method.key
                          ? "bg-orange-500 text-white"
                          : darkMode
                            ? "bg-white/10 text-slate-200"
                            : "bg-orange-50 text-slate-700"
                      }`}
                    >
                      <Icon className="mx-auto mb-1" size={18} />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {paymentMethod === "CASH" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="fashion-cash-received" className="text-sm font-black">
                      လက်ခံရရှိငွေ
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCashReceived(String(total));
                        setPaymentError("");
                      }}
                      disabled={paymentSaving}
                      className="text-xs font-black text-orange-500 hover:text-orange-600 disabled:opacity-50"
                    >
                      Exact amount
                    </button>
                  </div>
                  <input
                    ref={cashInputRef}
                    id="fashion-cash-received"
                    value={cashReceived}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCashReceived(value === "" ? "" : String(Math.max(0, Number(value))));
                      setPaymentError("");
                    }}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    disabled={paymentSaving}
                    className={`mt-2 w-full rounded-2xl px-4 py-4 text-center text-3xl font-black tabular-nums outline-none transition focus:ring-2 focus:ring-orange-500 ${
                      darkMode
                        ? "bg-slate-900 text-white ring-1 ring-white/10"
                        : "bg-white text-slate-950 ring-1 ring-slate-200"
                    }`}
                  />

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {quickCashAmounts.map((amount) => (
                      <button
                        type="button"
                        key={amount}
                        onClick={() => {
                          setCashReceived(String(amount));
                          setPaymentError("");
                        }}
                        disabled={paymentSaving}
                        className={`rounded-xl px-2 py-2.5 text-xs font-black tabular-nums transition disabled:opacity-50 ${
                          cashNumber === amount
                            ? "bg-orange-500 text-white"
                            : darkMode
                              ? "bg-white/10 text-slate-200 hover:bg-white/15"
                              : "bg-slate-100 text-slate-700 hover:bg-orange-50"
                        }`}
                      >
                        {formatMoney(amount)} Ks
                      </button>
                    ))}
                  </div>

                  <div
                    className={`mt-3 overflow-hidden rounded-2xl border transition-colors duration-200 ${
                      cashIsEnough
                        ? darkMode
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                          : "border-emerald-100 bg-emerald-50 text-emerald-600"
                        : darkMode
                          ? "border-red-400/20 bg-red-500/10 text-red-300"
                          : "border-red-100 bg-red-50 text-red-600"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between px-4 py-3 text-sm font-black ${
                        darkMode ? "border-white/10" : "border-black/5"
                      } border-b`}
                    >
                      <span>ပေးထားငွေ</span>
                      <span className="text-lg tabular-nums">
                        {formatMoney(cashNumber)} Ks
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-4">
                      <span className="font-black">Change</span>
                      <span className="text-2xl font-black tabular-nums">
                        {formatMoney(cashIsEnough ? change : remainingAmount)} Ks
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {paymentError && (
                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm font-black ${
                    darkMode
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-red-100 bg-red-50 text-red-600"
                  }`}
                >
                  {paymentError}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentOpen(false)}
                  disabled={paymentSaving}
                  className={`rounded-2xl px-4 py-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                    darkMode
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Cancel
                </button>

                <button
                  onClick={completePayment}
                  disabled={paymentSaving || cart.length === 0 || !cashIsEnough}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                  {paymentSaving
                    ? "Saving..."
                    : paymentMethod === "CASH" && !cashIsEnough
                      ? `${formatMoney(remainingAmount)} Ks လိုသေးသည်`
                      : `${formatMoney(total)} Ks Pay`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {receiptOpen && receiptData && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setReceiptOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(event) => event.stopPropagation()}
              className={`w-full max-w-md overflow-hidden rounded-[2rem] border shadow-2xl ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                    <Receipt size={24} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black">Payment Complete</h2>
                    <p
                      className={`text-xs font-bold ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Receipt No: {receiptData.receiptNo}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setReceiptOpen(false)}
                  className={`grid h-10 w-10 place-items-center rounded-2xl transition ${
                    darkMode
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5">
                <div
                  className={`rounded-[1.5rem] border p-4 ${
                    darkMode
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-lg font-black">
                      {receiptData.shopInfo.shopName}
                    </h3>
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {new Date(receiptData.paidAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="my-4 border-t border-dashed border-slate-300" />

                  <div className="space-y-2">
                    {receiptData.items.map((item) => (
                      <div
                        key={item.cartId}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <div>
                          <div className="font-black">{item.name}</div>
                          <div className="text-xs font-bold text-slate-400">
                            {getFashionSubtitle(item)} · x{item.qty}
                          </div>
                        </div>
                        <div className="font-black">
                          {formatMoney(item.price * item.qty)} Ks
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="my-4 border-t border-dashed border-slate-300" />

                  <div className="space-y-2 text-sm font-black">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal</span>
                      <span>{formatMoney(receiptData.subtotal)} Ks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Discount</span>
                      <span>{formatMoney(receiptData.discount)} Ks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax</span>
                      <span>{formatMoney(receiptData.tax)} Ks</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>Total</span>
                      <span className="text-orange-500">
                        {formatMoney(receiptData.total)} Ks
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReceiptOpen(false)}
                    className={`rounded-2xl px-4 py-4 text-sm font-black ${
                      darkMode
                        ? "bg-white/10 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Close
                  </button>

                  <button
                    onClick={printReceipt}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25"
                  >
                    <Printer size={18} />
                    Print
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>

      <MobileCartBar
        darkMode={darkMode}
        dragging={Boolean(draggingProductId)}
        itemCount={cart.reduce((sum, item) => sum + item.qty, 0)}
        total={total}
        onViewCart={() => setCartDialogOpen(true)}
        onPayment={() => {
          setPaymentError("");
          setPaymentOpen(true);
        }}
        addedFeedbackVisible={addedFeedbackVisible}
      />

      <AnimatePresence>
        {flyingProduct && (
          <motion.div
            key={flyingProduct.token}
            initial={{
              left: flyingProduct.from.x,
              top: flyingProduct.from.y,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              left: [
                flyingProduct.from.x,
                (flyingProduct.from.x + flyingProduct.to.x) / 2,
                flyingProduct.to.x,
              ],
              top: [
                flyingProduct.from.y,
                Math.min(flyingProduct.from.y, flyingProduct.to.y) - 75,
                flyingProduct.to.y,
              ],
              scale: [1, 0.78, 0.2],
              rotate: [0, -7, 5],
              opacity: [1, 1, 0.25],
            }}
            transition={{ duration: 0.72, times: [0, 0.55, 1], ease: "easeInOut" }}
            onAnimationComplete={() => setFlyingProduct(null)}
            className={`pointer-events-none fixed z-[100] flex w-40 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border p-2 shadow-2xl ${
              darkMode
                ? "border-orange-400 bg-slate-900 text-white"
                : "border-orange-200 bg-white text-slate-950"
            }`}
          >
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl ${
                darkMode ? "bg-white/10" : "bg-orange-50"
              }`}
            >
              {flyingProduct.product.image ? (
                <img
                  src={flyingProduct.product.image}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <ShoppingBag size={22} className="text-orange-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black">
                {flyingProduct.product.name}
              </p>
              <p className="text-xs font-black text-emerald-500">+1 Added</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DragOverlay>
        {draggingProduct && (
          <div
            className={`flex w-[280px] items-center gap-3 rounded-2xl border p-3 shadow-2xl ${
              darkMode
                ? "border-orange-400 bg-slate-900 text-white"
                : "border-orange-200 bg-white text-slate-950"
            }`}
          >
            <div
              className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl ${
                darkMode ? "bg-white/10" : "bg-orange-50"
              }`}
            >
              {draggingProduct.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draggingProduct.image}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <ShoppingBag size={24} className="text-orange-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {draggingProduct.name}
              </p>
              <p className="mt-1 text-lg font-black text-orange-500">
                {formatMoney(draggingProduct.price)} Ks
              </p>
            </div>
            <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black text-white">
              Dragging
            </span>
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

function BanknoteIcon(props: React.ComponentProps<typeof BadgePercent>) {
  return <BadgePercent {...props} />;
}
