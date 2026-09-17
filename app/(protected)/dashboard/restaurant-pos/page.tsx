"use client";
// UPDATED: Fashion-POS-style payment assistance and latest cart item priority.

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { fetchStaffById } from "@/lib/staff-validation";
import { readAvailableForSale, unavailableToastMessage } from "@/lib/product-availability";
import {
  ArrowLeft,
  Armchair,
  BadgePercent,
  Banknote,
  ChefHat,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  CreditCard,
  GripVertical,
  IdCard,
  Loader2,
  Minus,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sun,
  Trash2,
  Utensils,
  Wallet,
  X,
} from "lucide-react";

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod = "CASH" | "CARD" | "WALLET";

type MenuCategory = {
  id: string;
  name: string;
  icon: string;
};

type MenuItem = {
  id: string;
  dbId?: string;
  barcode?: string;
  sku?: string;
  name: string;
  nameMm?: string;
  categoryId: string;
  price: number;
  stock: number | null;
  image?: string;
  popular?: boolean;
  availableForSale: boolean;
  prepTime?: string;
};

type BackendProduct = Record<string, unknown>;

type CartItem = {
  id: string;
  menuItemId: string;
  dbId?: string;
  barcode?: string;
  sku?: string;
  name: string;
  price: number;
  stock: number | null;
  qty: number;
  kitchenSentQty: number;
  note?: string;
  modifiers: string[];
};

type RestaurantCartDraft = {
  version: 1;
  savedAt: number;
  staffId: string;
  orderType: OrderType;
  selectedTableId: number | null;
  discount: number;
  serviceChargeEnabled: boolean;
  serviceChargeRatePercent: number;
  taxRatePercent: number;
  items: CartItem[];
  kitchenTicketIds?: string[];
  takeawayNumber?: string;
};

type RestaurantTable = {
  id: number;
  tableNo: string;
  tableName?: string | null;
  seats?: number | null;
  status?: "FREE" | "BUSY" | "RESERVED" | "CLEANING" | string | null;
  floorName?: string | null;
  note?: string | null;
  shopId?: number;
  shopCode?: string;
};

type ActiveStaff = {
  staffId: string;
  staffName: string;
};

type KitchenOrderPayload = {
  orderType: OrderType;
  tableId?: number;
  tableNo?: string;
  staffId: string;
  staffName: string;
  priority: "NORMAL" | "HIGH" | "LOW";
  note: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
  items: {
    menuItemId: number | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    modifiers: string[];
    kitchenNote: string;
  }[];
};

type PaymentOrderPayload = Omit<KitchenOrderPayload, "items" | "priority"> & {
  note: string;
  serviceChargeRate: number;
  serviceChargeRatePercent: number;
  taxRate: number;
  taxRatePercent: number;
  paymentMethod: PaymentMethod;
  cashReceived: number;
  changeAmount: number;
  items: {
    productId: string;
    product_id: string;
    dbId: string;
    db_id: string;
    id: string;
    menuItemId: string;
    productName: string;
    product_name: string;
    qty: number;
    price: number;
    barcode: string;
    sku: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiers: string[];
    kitchenNote: string;
  }[];
};

type PaymentReceiptData = PaymentOrderPayload & {
  orderNo: string;
  paymentNo: string;
  receiptNo: string;
  paidAt: string;
  cashierName: string;
  cashierStaffId: string;
};

type ShopReceiptInfo = {
  shopName: string;
  address: string;
  phone: string;
};

const defaultCategory: MenuCategory = {
  id: "all",
  name: "All Menu",
  icon: "🍽️",
};

const modifiers = [
  "No spicy",
  "Less spicy",
  "Extra spicy",
  "No onion",
  "Extra egg",
  "Less oil",
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);

const formatRatePercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

const formatReceiptDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function buildPaymentReceiptHtml(
  receipt: PaymentReceiptData,
  shopInfo: ShopReceiptInfo,
) {
  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.itemName)}</div>
            ${item.modifiers?.length
          ? `<div class="muted small">${escapeHtml(item.modifiers.join(", "))}</div>`
          : ""
        }
            ${item.kitchenNote
          ? `<div class="muted small">Note: ${escapeHtml(item.kitchenNote)}</div>`
          : ""
        }
          </td>
          <td class="center">${escapeHtml(item.quantity)}</td>
          <td class="right">${formatMoney(item.unitPrice)}</td>
          <td class="right">${formatMoney(item.totalPrice)}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${escapeHtml(receipt.receiptNo)}</title>
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
          .line strong { text-align: right; }
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
          <h1 class="shop-title">${escapeHtml(shopInfo.shopName || "Restaurant")}</h1>
          <div class="shop-info">
            ${shopInfo.address ? `<div>${escapeHtml(shopInfo.address)}</div>` : ""}
            ${shopInfo.phone ? `<div>Phone: ${escapeHtml(shopInfo.phone)}</div>` : ""}
          </div>

          <div class="divider"></div>

          <div class="line"><span>Receipt No</span><strong>${escapeHtml(receipt.receiptNo)}</strong></div>
          <div class="line"><span>Payment No</span><strong>${escapeHtml(receipt.paymentNo)}</strong></div>
          <div class="line"><span>Order No</span><strong>${escapeHtml(receipt.orderNo)}</strong></div>
          <div class="line"><span>Date</span><strong>${escapeHtml(formatReceiptDate(receipt.paidAt))}</strong></div>
          <div class="line"><span>Order Type</span><strong>${escapeHtml(receipt.orderType)}</strong></div>
          ${receipt.orderType === "DINE_IN"
      ? `<div class="line"><span>Table</span><strong>${escapeHtml(receipt.tableNo || "-")}</strong></div>`
      : ""
    }
          <div class="line"><span>Cashier</span><strong>${escapeHtml(receipt.cashierName)}</strong></div>

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
            <div class="line"><span>Service ${formatRatePercent(receipt.serviceChargeRatePercent)}%</span><strong>${formatMoney(receipt.serviceCharge)} Ks</strong></div>
            <div class="line"><span>Tax ${formatRatePercent(receipt.taxRatePercent)}%</span><strong>${formatMoney(receipt.tax)} Ks</strong></div>
            <div class="line"><span>Discount</span><strong>${formatMoney(receipt.discount)} Ks</strong></div>
            <div class="line grand"><span>Total</span><strong>${formatMoney(receipt.total)} Ks</strong></div>
            <div class="line"><span>Payment</span><strong>${escapeHtml(receipt.paymentMethod)}</strong></div>
            ${receipt.paymentMethod === "CASH"
      ? `
                  <div class="line"><span>Cash Received</span><strong>${formatMoney(receipt.cashReceived)} Ks</strong></div>
                  <div class="line"><span>Change</span><strong>${formatMoney(receipt.changeAmount)} Ks</strong></div>
                `
      : ""
    }
          </div>

          <div class="footer">
            <div>Thank you for your order.</div>
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const DEFAULT_SERVICE_CHARGE_RATE_PERCENT = 5;
const DEFAULT_TAX_RATE_PERCENT = 3;
const SHOP_SETTINGS_UPDATED_EVENT = "receipt-shop-settings-updated";
const TOKEN_KEYS = [
  "pos_access_token",
  "pos_shop_owner_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
] as const;
const MISSING_TOKEN_MESSAGE = "Login token မရှိပါ။ အရင်ဆုံး login ပြန်ဝင်ပါ။";
const STAFF_NOT_FOUND_MESSAGE = "ဒီ Staff ID ကို မတွေ့ပါ။";
const FEATURE_DISABLED_MESSAGE =
  "ဒီဆိုင် plan မှာ Restaurant feature မဖွင့်ထားပါ။ Super Admin > Shop Feature Control မှာ Restaurant Feature Gate ကို ON လုပ်ပါ။";
const CART_ITEMS_PER_PAGE = 3;
const MENU_ITEMS_PER_PAGE = 8;
const CART_DROP_ID = "restaurant-cart-drop-zone";
const MOBILE_CART_DROP_ID = "restaurant-mobile-cart-drop-zone";
const CART_WIDTH_STORAGE_KEY = "restaurant_pos_cart_width";
const DEFAULT_CART_WIDTH = 430;
const MIN_CART_WIDTH = 340;
const MAX_CART_WIDTH = 680;
const CART_DRAFT_VERSION = 1;
const CART_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
const CART_DRAFT_KEY_PREFIX = "restaurant_pos_cart_draft_v1";
const BRAND_COLOR_STORAGE_KEY = "binhlaig_brand_colors";
const NO_PENDING_KITCHEN_ITEMS_MESSAGE =
  "Kitchen ကိုပို့ရန် အသစ်ထပ်မှာထားသော item မရှိပါ။";

function applyStoredBrandColors() {
  if (typeof window === "undefined") return;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(BRAND_COLOR_STORAGE_KEY) || "null",
    ) as { primary?: unknown; accent?: unknown } | null;
    const isHexColor = (value: unknown): value is string =>
      typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

    if (stored && isHexColor(stored.primary) && isHexColor(stored.accent)) {
      const root = document.documentElement;
      root.style.setProperty("--brand-primary", stored.primary);
      root.style.setProperty("--brand-accent", stored.accent);
      root.style.setProperty("--dashboard-primary", stored.primary);
      root.style.setProperty("--dashboard-accent", stored.accent);
    }
  } catch {
    // Invalid saved colors leave the global default palette unchanged.
  }
}

function getShopDraftScope(token?: string | null) {
  try {
    const rawToken = token?.replace(/^Bearer\s+/i, "").trim();
    const payloadPart = rawToken?.split(".")[1];
    if (!payloadPart) return "current-shop";

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as Record<
      string,
      unknown
    >;

    return String(
      payload.shopId ||
      payload.shop_id ||
      payload.shopCode ||
      payload.shop_code ||
      "current-shop",
    );
  } catch {
    return "current-shop";
  }
}

function getRestaurantCartDraftKey(staffId: string, token?: string | null) {
  return `${CART_DRAFT_KEY_PREFIX}:${getShopDraftScope(token)}:${staffId}`;
}

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

function getSessionAccessToken(session: unknown) {
  const sessionRecord = asRecord(session);
  const userRecord = asRecord(sessionRecord.user);
  const sessionToken = sessionRecord.accessToken;
  const userToken = userRecord.accessToken;

  if (typeof sessionToken === "string" && sessionToken.trim()) {
    return sessionToken.trim();
  }

  if (typeof userToken === "string" && userToken.trim()) {
    return userToken.trim();
  }

  return "";
}

function syncAccessTokenToLocalStorage(accessToken: string) {
  if (typeof window === "undefined") return;

  const cleanToken = accessToken.trim();
  if (!cleanToken) return;

  localStorage.setItem("pos_access_token", cleanToken);
  localStorage.setItem("pos_shop_owner_token", cleanToken);
}

function ensurePageAccessToken(sessionAccessToken?: string | null) {
  const cleanSessionToken = sessionAccessToken?.trim();
  const localStorageToken = getAccessToken();

  if (cleanSessionToken) {
    syncAccessTokenToLocalStorage(cleanSessionToken);
    return cleanSessionToken;
  }

  return localStorageToken;
}

function formatAuthorization(token: string) {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: formatAuthorization(token),
  };
}

function logRequestAuth(url: string, token: string) {
  console.debug("[Restaurant POS request]", {
    url,
    hasAuthorization: Boolean(token.trim()),
  });
}

async function readResponsePayload(res: Response) {
  const jsonPayload = await res
    .clone()
    .json()
    .catch(() => undefined);

  if (jsonPayload !== undefined) return jsonPayload;

  const text = await res
    .clone()
    .text()
    .catch(() => "");

  return text ? { message: text } : null;
}

function responsePayloadText(payload: unknown) {
  if (typeof payload === "string") return payload;

  const record = asRecord(payload);
  return pickString(record, ["message", "error", "detail", "title", "code"]);
}

function isFeatureDisabledPayload(payload: unknown) {
  const text = `${responsePayloadText(payload)} ${JSON.stringify(payload)}`;

  return /FEATURE_DISABLED|feature|allowRestaurant|allowKitchen|allowTableOrder|plan|subscription|disabled|not enabled|not allowed/i.test(
    text,
  );
}

async function getAuthOrFeatureError(res: Response) {
  if (res.status === 401) return MISSING_TOKEN_MESSAGE;
  if (res.status !== 403) return null;

  const payload = await readResponsePayload(res);
  const backendMessage = responsePayloadText(payload);

  if (isFeatureDisabledPayload(payload)) {
    return backendMessage && backendMessage !== "FEATURE_DISABLED"
      ? backendMessage
      : FEATURE_DISABLED_MESSAGE;
  }

  return MISSING_TOKEN_MESSAGE;
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

function parseMoneyValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/,/g, "")
    .replace(/\b(?:ks|mmk)\b/gi, "")
    .trim();

  if (!normalized) return null;

  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseRatePercent(value: unknown) {
  const parsed =
    typeof value === "string"
      ? parseMoneyValue(value.replace(/%/g, ""))
      : parseMoneyValue(value);

  if (parsed === null) return null;

  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;

  return Math.min(100, Math.max(0, percent));
}

function pickRatePercent(
  record: Record<string, unknown>,
  keys: string[],
  fallback: number,
) {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    const ratePercent = parseRatePercent(value);

    if (ratePercent !== null) return ratePercent;
  }

  return fallback;
}

function pickRatePercentFromRecords(
  records: Record<string, unknown>[],
  keys: string[],
  fallback: number,
) {
  for (const record of records) {
    const ratePercent = pickRatePercent(record, keys, Number.NaN);

    if (Number.isFinite(ratePercent)) return ratePercent;
  }

  return fallback;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const numberValue = parseMoneyValue(record[key]);

    if (numberValue !== null) return numberValue;
  }

  return 0;
}

function pickOptionalNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    const numberValue =
      typeof value === "number" ? value : Number(String(value).trim());

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
}

function getCategoryIcon(categoryId: string) {
  const category = categoryId.trim().toLowerCase();

  if (category.includes("rice")) return "🍚";
  if (category.includes("noodle")) return "🍜";
  if (category.includes("curry")) return "🍛";
  if (category.includes("drink") || category.includes("beverage")) return "🥤";
  if (category.includes("dessert") || category.includes("cake")) return "🍰";
  if (category.includes("coffee") || category.includes("tea")) return "☕";

  return "🍽️";
}

function formatCategoryName(categoryId: string) {
  return categoryId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
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
  if (!data || typeof data !== "object") return [];

  const payload = data as BackendProduct;
  const list =
    payload.products ||
    payload.data ||
    payload.content ||
    payload.items ||
    payload.result ||
    payload.results;

  return Array.isArray(list) ? (list as BackendProduct[]) : [];
}

function unwrapSettingsPayload(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  const nestedKeys = [
    "data",
    "setting",
    "settings",
    "shopSetting",
    "shop_setting",
    "receiptSetting",
    "receipt_setting",
  ];

  for (const key of nestedKeys) {
    const nested = asRecord(root[key]);

    if (Object.keys(nested).length) return nested;
  }

  return root;
}

function unwrapOpenOrderPayload(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  const nestedKeys = [
    "order",
    "openOrder",
    "open_order",
    "restaurantOrder",
    "restaurant_order",
    "data",
    "result",
  ];

  for (const key of nestedKeys) {
    const nested = asRecord(root[key]);

    if (Object.keys(nested).length) return nested;
  }

  return root;
}

function parseModifiers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((modifier) => String(modifier ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parsed
        .map((modifier) => String(modifier ?? "").trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated text below.
  }

  return trimmed
    .split(",")
    .map((modifier) => modifier.trim())
    .filter(Boolean);
}

function createCartItemId() {
  return (
    globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random())
  );
}

function menuItemIdentity(item: MenuItem) {
  if (item.dbId?.trim()) return `db:${item.dbId.trim()}`;
  if (item.barcode?.trim()) return `barcode:${item.barcode.trim()}`;
  if (item.sku?.trim()) return `sku:${item.sku.trim()}`;

  return `fallback:${item.name.trim().toLowerCase()}|${item.price}`;
}

function cartItemIdentity(item: CartItem) {
  if (item.dbId?.trim()) return `db:${item.dbId.trim()}`;
  if (item.barcode?.trim()) return `barcode:${item.barcode.trim()}`;
  if (item.sku?.trim()) return `sku:${item.sku.trim()}`;

  return `fallback:${item.name.trim().toLowerCase()}|${item.price}`;
}

function isSameMenuItem(cartItem: CartItem, menuItem: MenuItem) {
  return cartItemIdentity(cartItem) === menuItemIdentity(menuItem);
}

function mapOpenOrderItemToCartItem(item: Record<string, unknown>): CartItem {
  const menuItemId =
    pickString(item, [
      "menuItemId",
      "menu_item_id",
      "productId",
      "product_id",
      "productCode",
      "product_code",
      "id",
    ]) || createCartItemId();
  const dbId = pickString(item, ["dbId", "db_id", "productId", "product_id"]);
  const barcode = pickString(item, ["barcode", "barCode", "productBarcode"]);
  const sku = pickString(item, ["sku"]);
  const name =
    pickString(item, [
      "itemName",
      "item_name",
      "productName",
      "product_name",
      "name",
      "title",
    ]) || "Unnamed item";
  const price = pickNumber(item, [
    "unitPrice",
    "unit_price",
    "price",
    "productPrice",
    "product_price",
    "amount",
  ]);
  const stock = pickOptionalNumber(item, [
    "stock",
    "productQuantityAmount",
    "product_quantity_amount",
    "quantityAvailable",
    "quantity_available",
  ]);
  const qty = Math.max(
    1,
    pickNumber(item, ["quantity", "qty", "count", "productQuantity"]),
  );
  const savedKitchenSentQty = pickOptionalNumber(item, [
    "kitchenSentQty",
    "kitchen_sent_qty",
    "sentToKitchenQty",
    "sent_to_kitchen_qty",
  ]);
  const note = pickString(item, [
    "kitchenNote",
    "kitchen_note",
    "note",
    "remark",
  ]);

  return {
    id:
      pickString(item, ["cartItemId", "cart_item_id", "lineId", "line_id"]) ||
      createCartItemId(),
    menuItemId,
    dbId,
    barcode,
    sku,
    name,
    price,
    stock,
    qty,
    // Existing OPEN-order items were already sent on an earlier ticket unless
    // the backend explicitly returns a sent quantity. This prevents them from
    // being included again when the cashier adds a second round.
    kitchenSentQty: Math.max(0, savedKitchenSentQty ?? qty),
    note,
    modifiers: parseModifiers(item.modifiers ?? item.modifier),
  };
}

function mapProductToMenuItem(product: BackendProduct): MenuItem {
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
  const rawId =
    dbId || barcode || sku || pickString(product, ["productCode", "code"]);
  const name =
    pickString(product, ["productName", "name", "product_name", "title"]) ||
    "Unnamed product";
  const categoryId =
    pickString(product, ["category", "productCategory", "product_category"]) ||
    "OTHER";
  const price = pickNumber(product, [
    "productPrice",
    "product_price",
    "price",
    "product_price_amount",
    "productPriceAmount",
    "salePrice",
    "sale_price",
    "sellingPrice",
    "selling_price",
    "unitPrice",
    "unit_price",
    "amount",
  ]);
  const id =
    rawId ||
    `menu:${name.trim().toLowerCase()}|${categoryId.trim().toLowerCase()}|${price}`;
  const quantity = pickOptionalNumber(product, [
    "productQuantityAmount",
    "product_quantity_amount",
    "quantity",
    "stock",
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
    id: String(id),
    dbId,
    barcode,
    sku,
    name,
    categoryId,
    price,
    stock: quantity,
    image,
    availableForSale: readAvailableForSale(product),
  };
}

function normalizeStaffResponse(
  data: unknown,
  fallbackStaffId: string,
): ActiveStaff | null {
  const root = asRecord(data);
  const staff = Object.keys(asRecord(root.staff)).length
    ? asRecord(root.staff)
    : Object.keys(asRecord(root.data)).length
      ? asRecord(root.data)
      : root;
  const staffId =
    pickString(staff, [
      "staffId",
      "staff_id",
      "staffCode",
      "staff_code",
      "id",
      "username",
    ]) || fallbackStaffId;
  const staffName =
    pickString(staff, ["staffName", "name", "fullName", "username"]) || staffId;

  if (!staffId) return null;

  return { staffId, staffName };
}

async function getApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    const record =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : "";

    return message || fallback;
  }

  const text = await res.text().catch(() => "");
  return text || fallback;
}

function formatStockError(
  itemName: string,
  available: number,
  requested: number,
) {
  return `${itemName} stock မလုံလောက်ပါ။ Available stock: ${available}, Cart qty: ${requested}`;
}

function formatPaymentErrorMessage(message: string) {
  const normalized = message.trim();

  if (!normalized) return "Payment save failed.";

  if (/stock|quantity|inventory|out of stock|insufficient/i.test(normalized)) {
    return `Stock မလုံလောက်ပါ။ ${normalized}`;
  }

  return normalized;
}

function DraggableMenuCard({
  menuItemId,
  disabled,
  onClick,
  className,
  children,
}: {
  menuItemId: string;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className: string;
  children: React.ReactNode;
}) {
  const { ref, isDragging } = useDraggable({
    id: `restaurant-menu:${menuItemId}`,
    disabled,
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-disabled={disabled}
      className={`${className} touch-none select-none cursor-grab active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {children}
    </button>
  );
}

function RestaurantCartDropSurface({
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
      data-restaurant-cart-target="true"
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border shadow-sm transition ${isDropTarget
          ? darkMode
            ? "border-emerald-400 bg-emerald-500/10 ring-4 ring-emerald-400/25"
            : "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-300/35"
          : dragging
            ? darkMode
              ? "border-[var(--brand-primary)] bg-[var(--brand-soft)] ring-4 ring-[var(--brand-border)]"
              : "border-[var(--brand-primary)] bg-[var(--brand-soft)] ring-4 ring-[var(--brand-border)]"
            : darkMode
              ? "border-white/10 bg-slate-950/95"
              : "border-[var(--brand-border)] bg-white/95"
        }`}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 rounded-2xl bg-[var(--brand-primary)] px-4 py-2 text-center text-xs font-black text-white shadow-lg">
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

function RestaurantMobileCartBar({
  darkMode,
  dragging,
  itemCount,
  total,
  onViewCart,
  onKitchen,
  onPayment,
  kitchenSaving,
  canSendToKitchen,
  canPayOrder,
  kitchenDisabledMessage,
  addedFeedbackVisible,
}: {
  darkMode: boolean;
  dragging: boolean;
  itemCount: number;
  total: number;
  onViewCart: () => void;
  onKitchen: () => void;
  onPayment: () => void;
  kitchenSaving: boolean;
  canSendToKitchen: boolean;
  canPayOrder: boolean;
  kitchenDisabledMessage: string;
  addedFeedbackVisible: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id: MOBILE_CART_DROP_ID });

  return (
    <div
      ref={ref}
      data-restaurant-cart-target="true"
      className={`fixed inset-x-2 bottom-2 z-50 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl transition-colors lg:landscape:hidden ${isDropTarget
          ? "border-emerald-400 bg-emerald-500 text-white ring-4 ring-emerald-400/25"
          : dragging
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white ring-4 ring-[var(--brand-border)]"
            : addedFeedbackVisible
              ? "border-emerald-400 bg-emerald-500 text-white ring-4 ring-emerald-400/25"
              : darkMode
                ? "border-white/10 bg-slate-900/95 text-white"
                : "border-[var(--brand-border)] bg-white/95 text-slate-950"
        }`}
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {dragging ? (
        <div className="flex min-h-14 items-center justify-center gap-2 px-3 text-sm font-black">
          <ShoppingBag size={20} />
          {isDropTarget ? "Release to add item" : "Drag menu item here"}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2">
          <button
            type="button"
            onClick={onViewCart}
            className="min-w-0 rounded-xl px-2 py-1 text-left"
          >
            <span className="block truncate text-xs font-black text-[var(--brand-primary)]">
              {itemCount} items · {formatMoney(total)} Ks
            </span>
            <span className="block text-[11px] font-bold opacity-70">
              View cart
            </span>
          </button>
          {canSendToKitchen && <button
            type="button"
            onClick={onKitchen}
            disabled={!canSendToKitchen || kitchenSaving}
            className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-40"
            aria-label={
              canSendToKitchen
                ? "Send to kitchen"
                : kitchenDisabledMessage || "Cart ထဲတွင် item မရှိပါ။"
            }
            title={
              canSendToKitchen
                ? "Kitchen ကိုပို့ရန်"
                : kitchenDisabledMessage || "Cart ထဲတွင် item မရှိပါ။"
            }
          >
            {kitchenSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ChefHat size={18} />
            )}
          </button>}
          <button
            type="button"
            onClick={onViewCart}
            className="rounded-xl bg-[var(--brand-soft)] px-3 py-3 text-xs font-black text-[var(--brand-primary)]"
          >
            Cart
          </button>
          <button
            type="button"
            onClick={onPayment}
            disabled={!canPayOrder}
            className="rounded-xl bg-[var(--brand-primary)] px-3 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            Pay
          </button>
        </div>
      )}
    </div>
  );
}

export default function RestaurantCashierPOSPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionAccessToken = getSessionAccessToken(session);
  const [darkMode, setDarkMode] = useState(false);
  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);
  const [staffIdDraft, setStaffIdDraft] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const staffInputRef = useRef<HTMLInputElement | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [orderTypeChosen, setOrderTypeChosen] = useState(false);
  const [pendingMenuItem, setPendingMenuItem] = useState<MenuItem | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState("ALL");
  const [tableStatusSavingId, setTableStatusSavingId] = useState<number | null>(null);
  const tableStatusLockRef = useRef(false);
  const [tableStatusError, setTableStatusError] = useState("");
  const [pendingReservedTableId, setPendingReservedTableId] = useState<number | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [exitError, setExitError] = useState("");
  const [restoredDraftKey, setRestoredDraftKey] = useState("");
  const [draftRestoreMessage, setDraftRestoreMessage] = useState("");
  const [openOrderLoading, setOpenOrderLoading] = useState(false);
  const [openOrderError, setOpenOrderError] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [headerControlsOpen, setHeaderControlsOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartPage, setCartPage] = useState(1);
  const [lastAddedMenuItemId, setLastAddedMenuItemId] = useState("");
  const [addedFeedbackVisible, setAddedFeedbackVisible] = useState(false);
  const [flyingItem, setFlyingItem] = useState<{
    token: number;
    item: MenuItem;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const addedFeedbackTimerRef = useRef<number | null>(null);
  const [draggingMenuItemId, setDraggingMenuItemId] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartWidth, setCartWidth] = useState(DEFAULT_CART_WIDTH);
  const [isResizingCart, setIsResizingCart] = useState(false);
  const cartResizeStartRef = useRef({ pointerX: 0, width: DEFAULT_CART_WIDTH });
  const suppressMenuClickRef = useRef(false);
  const [menuPage, setMenuPage] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(true);
  const [serviceChargeRatePercent, setServiceChargeRatePercent] = useState(
    DEFAULT_SERVICE_CHARGE_RATE_PERCENT,
  );
  const [taxRatePercent, setTaxRatePercent] = useState(
    DEFAULT_TAX_RATE_PERCENT,
  );
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
  const [paymentReceiptData, setPaymentReceiptData] =
    useState<PaymentReceiptData | null>(null);
  const [shopReceiptInfo, setShopReceiptInfo] = useState<ShopReceiptInfo>({
    shopName: "Restaurant",
    address: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [kitchenTicketIds, setKitchenTicketIds] = useState<string[]>([]);
  // Switching tables must not lose the ticket IDs needed to verify DONE.
  // Keep sent quantities too: unsent additions must still block payment.
  const tableKitchenOrdersRef = useRef(new Map<number, {
    ticketIds: string[];
    items: CartItem[];
  }>());

  useEffect(() => {
    tableKitchenOrdersRef.current.clear();
  }, [sessionAccessToken, activeStaff?.staffId]);
  const [takeawayNumber, setTakeawayNumber] = useState("");
  const [takeawaySearchOpen, setTakeawaySearchOpen] = useState(false);
  const [takeawayQuery, setTakeawayQuery] = useState("");
  const [takeawaySearchError, setTakeawaySearchError] = useState("");
  const [takeawaySearchLoading, setTakeawaySearchLoading] = useState(false);
  const [allTicketsDone, setAllTicketsDone] = useState(false);
  const [kitchenStatusError, setKitchenStatusError] = useState("");
  const [kitchenSaving, setKitchenSaving] = useState(false);
  const [kitchenError, setKitchenError] = useState("");
  const [kitchenSuccessOpen, setKitchenSuccessOpen] = useState(false);
  const [kitchenSuccessMessage, setKitchenSuccessMessage] = useState("");
  const [kitchenSuccessItemCount, setKitchenSuccessItemCount] = useState(0);
  const [cashReceived, setCashReceived] = useState("");
  const cashInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncBrandColors = () => applyStoredBrandColors();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === BRAND_COLOR_STORAGE_KEY) syncBrandColors();
    };

    syncBrandColors();
    window.addEventListener("brand-colors-changed", syncBrandColors);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("brand-colors-changed", syncBrandColors);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((apiSession) => {
        const apiToken = getSessionAccessToken(apiSession);

        if (apiToken) syncAccessTokenToLocalStorage(apiToken);
      })
      .catch((error) => {
        console.warn("[Restaurant POS /api/auth/session] failed", error);
      });
  }, [session, status]);

  const categories = useMemo<MenuCategory[]>(() => {
    const seen = new Set<string>();
    const apiCategories = menuItems
      .map((item) => item.categoryId || "OTHER")
      .filter((categoryId) => {
        const key = categoryId.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((categoryId) => ({
        id: categoryId,
        name: formatCategoryName(categoryId),
        icon: getCategoryIcon(categoryId),
      }));

    return [defaultCategory, ...apiCategories];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === "all" || item.categoryId === selectedCategory;

      const keyword = search.trim().toLowerCase();

      const matchSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.nameMm?.toLowerCase().includes(keyword) ||
        item.barcode?.toLowerCase().includes(keyword) ||
        item.sku?.toLowerCase().includes(keyword);

      return matchCategory && matchSearch;
    });
  }, [menuItems, selectedCategory, search]);

  const menuTotalPages = Math.max(
    1,
    Math.ceil(filteredMenu.length / MENU_ITEMS_PER_PAGE),
  );
  const safeMenuPage = Math.min(menuPage, menuTotalPages);
  const menuPageStart =
    filteredMenu.length === 0
      ? 0
      : (safeMenuPage - 1) * MENU_ITEMS_PER_PAGE + 1;
  const menuPageEnd = Math.min(
    safeMenuPage * MENU_ITEMS_PER_PAGE,
    filteredMenu.length,
  );

  const paginatedMenu = useMemo(() => {
    const start = (safeMenuPage - 1) * MENU_ITEMS_PER_PAGE;

    return filteredMenu.slice(start, start + MENU_ITEMS_PER_PAGE);
  }, [filteredMenu, safeMenuPage]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [tables, selectedTableId],
  );

  const filteredTables = useMemo(() => {
    const keyword = tableSearch.trim().toLowerCase();

    return tables.filter((table) => {
      const status = (table.status || "FREE").toUpperCase();
      const matchesStatus =
        tableStatusFilter === "ALL" || status === tableStatusFilter;
      const matchesSearch =
        !keyword ||
        table.tableNo.toLowerCase().includes(keyword) ||
        table.tableName?.toLowerCase().includes(keyword) ||
        table.floorName?.toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [tables, tableSearch, tableStatusFilter]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );

  const serviceCharge = serviceChargeEnabled
    ? Math.round(subtotal * (serviceChargeRatePercent / 100))
    : 0;
  const tax = Math.round(
    (subtotal + serviceCharge - discount) * (taxRatePercent / 100),
  );
  const total = Math.max(subtotal + serviceCharge + tax - discount, 0);
  const draggingMenuItem = menuItems.find(
    (item) => item.id === draggingMenuItemId,
  );
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

  const cartLineCount = cart.length;
  const cartTotalQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );
  const cartTotalPages = Math.max(
    1,
    Math.ceil(cartLineCount / CART_ITEMS_PER_PAGE),
  );
  const safeCartPage = Math.min(cartPage, cartTotalPages);
  const cartPageStart =
    cartLineCount === 0 ? 0 : (safeCartPage - 1) * CART_ITEMS_PER_PAGE + 1;
  const cartPageEnd = Math.min(
    safeCartPage * CART_ITEMS_PER_PAGE,
    cartLineCount,
  );
  const canGoToPreviousCartPage = safeCartPage > 1;
  const canGoToNextCartPage = cartPageEnd < cartLineCount;

  const paginatedCart = useMemo(() => {
    const start = (safeCartPage - 1) * CART_ITEMS_PER_PAGE;
    return cart.slice(start, start + CART_ITEMS_PER_PAGE);
  }, [cart, safeCartPage]);

  const goToCartPage = (nextPage: number) => {
    const normalizedPage = Math.min(
      Math.max(Math.trunc(nextPage), 1),
      cartTotalPages,
    );
    setCartPage(normalizedPage);
  };

  const pendingKitchenItemCount = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Math.max(item.qty - item.kitchenSentQty, 0),
        0,
      ),
    [cart],
  );
  const hasPendingKitchenItems = pendingKitchenItemCount > 0;
  const showKitchenAction = hasPendingKitchenItems && cart.length > 0;
  const canPayOrder = !openOrderLoading && cart.length > 0 &&
    (orderType !== "DINE_IN" ||
      (Boolean(selectedTable) && !hasPendingKitchenItems &&
        kitchenTicketIds.length > 0 && allTicketsDone && !kitchenStatusError &&
        cart.every((item) => item.kitchenSentQty >= item.qty)));
  const kitchenDisabledMessage =
    cart.length > 0 && !hasPendingKitchenItems
      ? NO_PENDING_KITCHEN_ITEMS_MESSAGE
      : "";

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

      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const data = await fetchStaffById(nextStaffId, usableToken);

      const staff = normalizeStaffResponse(data, nextStaffId);

      if (!staff) {
        throw new Error(STAFF_NOT_FOUND_MESSAGE);
      }

      setActiveStaff(staff);
      setStaffIdDraft(staff.staffId);
    } catch (err) {
      setActiveStaff(null);
      setStaffError(
        err instanceof Error ? err.message : STAFF_NOT_FOUND_MESSAGE,
      );
      window.setTimeout(() => staffInputRef.current?.focus(), 50);
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchTables() {
    setTablesLoading(true);
    setTablesError("");

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const tablesUrl = `${API_BASE}/api/restaurant/tables`;
      logRequestAuth(tablesUrl, usableToken);

      const res = await fetch(tablesUrl, {
        method: "GET",
        headers: authHeaders(usableToken),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Restaurant tables များကိုယူမရပါ"),
        );
      }

      const data = await res.json();
      const nextTables: RestaurantTable[] = Array.isArray(data) ? data : [];

      setTables(nextTables);
      setSelectedTableId((currentId) => {
        if (currentId && nextTables.some((table) => table.id === currentId)) {
          return currentId;
        }

        return null;
      });
    } catch (err) {
      setTables([]);
      setSelectedTableId(null);
      setTablesError(
        err instanceof Error ? err.message : "Restaurant tables loading error",
      );
    } finally {
      setTablesLoading(false);
    }
  }

  async function persistTableStatus(tableId: number, status: "RESERVED" | "CLEANING" | "FREE") {
    const usableToken = ensurePageAccessToken(sessionAccessToken);
    if (!usableToken) throw new Error(MISSING_TOKEN_MESSAGE);
    const res = await fetch(`${API_BASE}/api/restaurant/tables/${tableId}/status`, {
      method: "PATCH",
      headers: authHeaders(usableToken),
      body: JSON.stringify({ status }),
    });
    const authError = await getAuthOrFeatureError(res);
    if (authError) throw new Error(authError);
    if (!res.ok) throw new Error(await getApiErrorMessage(res, "Table status update မလုပ်နိုင်ပါ"));
    setTables((previous) => previous.map((table) =>
      table.id === tableId ? { ...table, status } : table));
  }

  async function advanceTableStatus(table: RestaurantTable) {
    if (tableStatusLockRef.current || paymentSaving || openOrderLoading) return;
    const status = (table.status || "FREE").toUpperCase();
    const nextStatus = pendingReservedTableId === table.id ? "RESERVED" :
      status === "RESERVED" ? "CLEANING" : status === "CLEANING" ? "FREE" : null;
    if (!nextStatus) return;
    tableStatusLockRef.current = true;
    setTableStatusSavingId(table.id);
    setTableStatusError("");
    try {
      await persistTableStatus(table.id, nextStatus);
      if (pendingReservedTableId === table.id) setPendingReservedTableId(null);
    } catch (error) {
      setTableStatusError(error instanceof Error ? error.message : "Table status update error");
    } finally {
      tableStatusLockRef.current = false;
      setTableStatusSavingId(null);
    }
  }

  async function fetchMenuItems(options: { silent?: boolean } = {}) {
    if (!options.silent) setMenuLoading(true);
    if (!options.silent) setMenuError("");

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const productsUrl = `${API_BASE}/api/products`;
      logRequestAuth(productsUrl, usableToken);

      const res = await fetch(productsUrl, {
        method: "GET",
        headers: authHeaders(usableToken),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Menu products များကိုယူမရပါ"),
        );
      }

      const data = await res.json().catch(() => null);
      const nextMenuItems = extractProducts(data)
        .map(mapProductToMenuItem)
        .filter((item) => item.id && item.name);

      setMenuItems(nextMenuItems);
      setSelectedCategory((currentCategory) => {
        if (
          currentCategory === "all" ||
          nextMenuItems.some((item) => item.categoryId === currentCategory)
        ) {
          return currentCategory;
        }

        return "all";
      });
      return nextMenuItems;
    } catch (err) {
      if (!options.silent) setMenuItems([]);
      if (!options.silent) setSelectedCategory("all");
      if (!options.silent) setMenuError(
        err instanceof Error ? err.message : "Menu products loading error",
      );
      return [];
    } finally {
      if (!options.silent) setMenuLoading(false);
    }
  }

  async function fetchOrderRates() {
    const fallback = {
      serviceChargeRatePercent: DEFAULT_SERVICE_CHARGE_RATE_PERCENT,
      taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
    };

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        setServiceChargeRatePercent(fallback.serviceChargeRatePercent);
        setTaxRatePercent(fallback.taxRatePercent);
        return;
      }

      const headers = {
        Accept: "application/json",
        ...authHeaders(usableToken),
      };
      logRequestAuth("/api/shop/settings", usableToken);
      logRequestAuth("/api/receipt-settings/my-shop", usableToken);
      const [shopRes, receiptRes] = await Promise.all([
        fetch("/api/shop/settings", {
          method: "GET",
          headers,
          cache: "no-store",
        }).catch(() => null),
        fetch("/api/receipt-settings/my-shop", {
          method: "GET",
          headers,
          cache: "no-store",
        }).catch(() => null),
      ]);

      const shopData =
        shopRes && shopRes.ok ? await shopRes.json().catch(() => null) : null;
      const receiptData =
        receiptRes && receiptRes.ok
          ? await receiptRes.json().catch(() => null)
          : null;
      const shopSettings = unwrapSettingsPayload(shopData);
      const receiptSettings = unwrapSettingsPayload(receiptData);
      const settingsRecords = [
        shopSettings,
        asRecord(shopSettings.shop),
        receiptSettings,
        asRecord(receiptSettings.shop),
      ];

      setShopReceiptInfo({
        shopName:
          pickString(shopSettings, ["shopName", "shop_name", "name"]) ||
          pickString(asRecord(shopSettings.shop), [
            "shopName",
            "shop_name",
            "name",
          ]) ||
          "Restaurant",
        address:
          pickString(shopSettings, [
            "address",
            "shopAddress",
            "shop_address",
          ]) ||
          pickString(asRecord(shopSettings.shop), [
            "address",
            "shopAddress",
            "shop_address",
          ]),
        phone:
          pickString(shopSettings, [
            "phone",
            "phoneNo",
            "phone_no",
            "mobile",
          ]) ||
          pickString(asRecord(shopSettings.shop), [
            "phone",
            "phoneNo",
            "phone_no",
            "mobile",
          ]),
      });

      setServiceChargeRatePercent(
        pickRatePercentFromRecords(
          settingsRecords,
          [
            "serviceChargeRatePercent",
            "service_charge_rate_percent",
            "serviceChargePercent",
            "service_charge_percent",
            "servicePercent",
            "service_percent",
            "serviceChargeRate",
            "service_charge_rate",
            "serviceRate",
            "service_rate",
          ],
          fallback.serviceChargeRatePercent,
        ),
      );
      setTaxRatePercent(
        pickRatePercentFromRecords(
          settingsRecords,
          [
            "taxRatePercent",
            "tax_rate_percent",
            "taxPercent",
            "tax_percent",
            "taxRate",
            "tax_rate",
          ],
          fallback.taxRatePercent,
        ),
      );
    } catch (err) {
      console.warn("Restaurant POS settings rates load failed:", err);
      setServiceChargeRatePercent(fallback.serviceChargeRatePercent);
      setTaxRatePercent(fallback.taxRatePercent);
    }
  }

  async function loadOpenOrderByTable(tableId: number) {
    setOpenOrderLoading(true);
    setOpenOrderError("");

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const openOrderUrl = `${API_BASE}/api/restaurant/orders/open/table/${encodeURIComponent(
        String(tableId),
      )}`;
      logRequestAuth(openOrderUrl, usableToken);

      const res = await fetch(openOrderUrl, {
        method: "GET",
        headers: authHeaders(usableToken),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (res.status === 404 || res.status === 204) {
        tableKitchenOrdersRef.current.delete(tableId);
        setKitchenTicketIds([]);
        setAllTicketsDone(false);
        setCart([]);
        setDiscount(0);
        return;
      }

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Open order ကိုယူမရပါ"));
      }

      const data = await res.json().catch(() => null);
      const openOrder = unwrapOpenOrderPayload(data);
      const items = Array.isArray(openOrder.items)
        ? openOrder.items
        : Array.isArray(openOrder.orderItems)
          ? openOrder.orderItems
          : Array.isArray(openOrder.order_items)
            ? openOrder.order_items
            : [];

      const restoredItems = items
        .map((item) => mapOpenOrderItemToCartItem(asRecord(item)))
        .filter((item) => item.menuItemId && item.name);
      const cachedOrder = tableKitchenOrdersRef.current.get(tableId);
      setKitchenTicketIds(cachedOrder?.ticketIds ?? []);
      setAllTicketsDone(false);
      setKitchenStatusError("");
      setCart(restoredItems.map((item) => {
        const previousItem = cachedOrder?.items.find((previous) =>
          previous.menuItemId === item.menuItemId &&
          previous.price === item.price &&
          (previous.note || "") === (item.note || "") &&
          JSON.stringify(previous.modifiers) === JSON.stringify(item.modifiers));
        return previousItem
          ? { ...item, kitchenSentQty: Math.min(item.qty, previousItem.kitchenSentQty) }
          : item;
      }));

      setDiscount(
        pickNumber(openOrder, [
          "discount",
          "discountAmount",
          "discount_amount",
        ]),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Open order loading error";

      setOpenOrderError(message);
      setCart([]);
      setDiscount(0);
    } finally {
      setOpenOrderLoading(false);
    }
  }

  async function saveOpenOrder() {
    if (orderType !== "DINE_IN") return;
    if (cart.length === 0) return;
    if (!activeStaff) {
      throw new Error("Staff ID ထည့်ပါ။");
    }
    if (!selectedTable) {
      throw new Error("Dine In order အတွက် table ရွေးပါ။");
    }

    const usableToken = ensurePageAccessToken(sessionAccessToken);

    if (!usableToken) {
      throw new Error(MISSING_TOKEN_MESSAGE);
    }

    const payload = {
      orderType: orderType || "DINE_IN",
      tableId: selectedTable.id,
      tableNo: selectedTable.tableNo,
      staffId: activeStaff.staffId,
      staffName: activeStaff.staffName,
      subtotal,
      serviceCharge,
      tax,
      discount,
      total,
      status: "OPEN",
      note: "",
      items: cart.map((item) => ({
        productId: item.menuItemId,
        itemName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        totalPrice: item.price * item.qty,
        modifiers: item.modifiers,
        kitchenNote: item.note || "",
      })),
    };

    const saveOpenOrderUrl = `${API_BASE}/api/restaurant/orders/open`;
    logRequestAuth(saveOpenOrderUrl, usableToken);

    const res = await fetch(saveOpenOrderUrl, {
      method: "POST",
      headers: authHeaders(usableToken),
      body: JSON.stringify(payload),
    });

    const authOrFeatureError = await getAuthOrFeatureError(res);
    if (authOrFeatureError) throw new Error(authOrFeatureError);

    if (!res.ok) {
      throw new Error(
        await getApiErrorMessage(res, "Open order မသိမ်းနိုင်ပါ"),
      );
    }
  }

  function handleGoToDashboard() {
    if (cart.length === 0) {
      if (activeStaff) {
        localStorage.removeItem(
          getRestaurantCartDraftKey(activeStaff.staffId, sessionAccessToken),
        );
      }
      router.push("/dashboard");
      return;
    }

    setExitError("");
    setExitConfirmOpen(true);
  }

  async function saveOrderAndExit() {
    try {
      setExitSaving(true);
      setExitError("");
      await saveOpenOrder();
      if (activeStaff) {
        localStorage.removeItem(
          getRestaurantCartDraftKey(activeStaff.staffId, sessionAccessToken),
        );
      }
      setExitConfirmOpen(false);
      router.push("/dashboard");
    } catch (error) {
      setExitError(
        error instanceof Error ? error.message : "Order ကို save မလုပ်နိုင်ပါ။",
      );
    } finally {
      setExitSaving(false);
    }
  }

  function discardOrderAndExit() {
    if (activeStaff) {
      localStorage.removeItem(
        getRestaurantCartDraftKey(activeStaff.staffId, sessionAccessToken),
      );
    }
    clearOrder();
    router.push("/dashboard");
  }

  async function handleSelectTable(table: RestaurantTable) {
    if (["RESERVED", "CLEANING"].includes((table.status || "FREE").toUpperCase()) ||
        pendingReservedTableId === table.id || tableStatusLockRef.current || paymentSaving) return;
    if (openOrderLoading) return;
    if (selectedTableId === table.id) {
      setTableDialogOpen(false);
      return;
    }
    setOpenOrderLoading(true);
    setOpenOrderError("");

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      if (selectedTableId && cart.length > 0) {
        await saveOpenOrder();
        tableKitchenOrdersRef.current.set(selectedTableId, {
          ticketIds: [...kitchenTicketIds],
          items: cart.map((item) => ({ ...item, modifiers: [...item.modifiers] })),
        });
      }

      setKitchenTicketIds([]);
      setAllTicketsDone(false);
      setKitchenStatusError("");
      setSelectedTableId(table.id);
      await loadOpenOrderByTable(table.id);
      await fetchTables();
      setTableDialogOpen(false);
    } catch (err) {
      setOpenOrderError(
        err instanceof Error ? err.message : "Table order switching error",
      );
      setOpenOrderLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;

    const usableToken = ensurePageAccessToken(sessionAccessToken);

    if (!usableToken) {
      setTables([]);
      setSelectedTableId(null);
      setMenuItems([]);
      setTablesError(MISSING_TOKEN_MESSAGE);
      setMenuError(MISSING_TOKEN_MESSAGE);
      setTablesLoading(false);
      setMenuLoading(false);
      setOpenOrderLoading(false);
      setOpenOrderError("");
      setServiceChargeRatePercent(DEFAULT_SERVICE_CHARGE_RATE_PERCENT);
      setTaxRatePercent(DEFAULT_TAX_RATE_PERCENT);
      return;
    }

    void fetchTables();
    void fetchMenuItems();
    void fetchOrderRates();

    const refreshAvailability = () => void fetchMenuItems({ silent: true });
    const availabilityInterval = window.setInterval(refreshAvailability, 30_000);
    window.addEventListener("focus", refreshAvailability);

    window.addEventListener(SHOP_SETTINGS_UPDATED_EVENT, fetchOrderRates);

    return () => {
      window.removeEventListener(SHOP_SETTINGS_UPDATED_EVENT, fetchOrderRates);
      window.clearInterval(availabilityInterval);
      window.removeEventListener("focus", refreshAvailability);
    };
  }, [sessionAccessToken, status]);

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

    const draftKey = getRestaurantCartDraftKey(
      activeStaff.staffId,
      sessionAccessToken,
    );
    const storedDraft = localStorage.getItem(draftKey);

    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft) as Partial<RestaurantCartDraft>;
        const isFresh =
          draft.version === CART_DRAFT_VERSION &&
          typeof draft.savedAt === "number" &&
          Date.now() - draft.savedAt <= CART_DRAFT_TTL_MS;
        const validItems = Array.isArray(draft.items)
          ? draft.items.filter((item): item is CartItem =>
            Boolean(
              item &&
              typeof item.id === "string" &&
              typeof item.menuItemId === "string" &&
              typeof item.name === "string" &&
              Number.isFinite(item.price) &&
              Number.isFinite(item.qty) &&
              item.qty > 0 &&
              Array.isArray(item.modifiers),
            ),
          )
          : [];

        if (isFresh && validItems.length > 0) {
          const restoredOrderType =
            draft.orderType === "DINE_IN" ||
              draft.orderType === "TAKEAWAY" ||
              draft.orderType === "DELIVERY"
              ? draft.orderType
              : "DINE_IN";

          setOrderType(restoredOrderType);
          setOrderTypeChosen(true);
          setSelectedTableId(
            typeof draft.selectedTableId === "number"
              ? draft.selectedTableId
              : null,
          );
          setCart(validItems);
          setTakeawayNumber(typeof draft.takeawayNumber === "string" ? draft.takeawayNumber : "");
          setKitchenTicketIds(Array.isArray(draft.kitchenTicketIds)
            ? draft.kitchenTicketIds.filter((id): id is string => typeof id === "string" && id.length > 0)
            : []);
          setAllTicketsDone(false);
          setCartPage(1);
          setDiscount(Math.max(0, Number(draft.discount || 0)));
          setServiceChargeEnabled(draft.serviceChargeEnabled !== false);
          if (
            typeof draft.serviceChargeRatePercent === "number" &&
            Number.isFinite(draft.serviceChargeRatePercent)
          ) {
            setServiceChargeRatePercent(
              Math.max(0, Number(draft.serviceChargeRatePercent)),
            );
          }
          if (
            typeof draft.taxRatePercent === "number" &&
            Number.isFinite(draft.taxRatePercent)
          ) {
            setTaxRatePercent(Math.max(0, Number(draft.taxRatePercent)));
          }
          setDraftRestoreMessage(
            `Previous order restored · ${validItems.reduce((sum, item) => sum + item.qty, 0)} items`,
          );
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    }

    setRestoredDraftKey(draftKey);
  }, [activeStaff, sessionAccessToken]);

  useEffect(() => {
    if (activeStaff && restoredDraftKey && !orderTypeChosen && cart.length === 0) {
      setOrderTypeOpen(true);
    }
  }, [activeStaff, restoredDraftKey, orderTypeChosen, cart.length]);

  useEffect(() => {
    if (!draftRestoreMessage) return;

    const timer = window.setTimeout(() => setDraftRestoreMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [draftRestoreMessage]);

  useEffect(() => {
    if (!activeStaff) return;

    const draftKey = getRestaurantCartDraftKey(
      activeStaff.staffId,
      sessionAccessToken,
    );
    if (restoredDraftKey !== draftKey) return;

    if (cart.length === 0) {
      localStorage.removeItem(draftKey);
      return;
    }

    const draft: RestaurantCartDraft = {
      version: CART_DRAFT_VERSION,
      savedAt: Date.now(),
      staffId: activeStaff.staffId,
      orderType,
      selectedTableId,
      discount,
      serviceChargeEnabled,
      serviceChargeRatePercent,
      taxRatePercent,
      items: cart,
      kitchenTicketIds,
      takeawayNumber,
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    activeStaff,
    cart,
    discount,
    kitchenTicketIds,
    takeawayNumber,
    orderType,
    restoredDraftKey,
    selectedTableId,
    serviceChargeEnabled,
    serviceChargeRatePercent,
    sessionAccessToken,
    taxRatePercent,
  ]);

  useEffect(() => {
    if (
      activeStaff &&
      restoredDraftKey &&
      orderType === "DINE_IN" &&
      !selectedTableId &&
      (Boolean(pendingMenuItem) || cart.length > 0)
    ) {
      setTableDialogOpen(true);
    }
  }, [activeStaff, orderType, restoredDraftKey, selectedTableId, pendingMenuItem, cart.length]);

  useEffect(() => {
    setCartPage((currentPage) => {
      const maxPage = Math.max(
        1,
        Math.ceil(cartLineCount / CART_ITEMS_PER_PAGE),
      );

      return Math.min(currentPage, maxPage);
    });
  }, [cartLineCount]);

  useEffect(() => {
    if (!lastAddedMenuItemId) return;

    const timer = window.setTimeout(() => {
      setLastAddedMenuItemId("");
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [lastAddedMenuItemId]);

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

  useEffect(() => {
    setMenuPage(1);
  }, [selectedCategory, search]);

  useEffect(() => {
    setMenuPage((currentPage) => {
      const maxPage = Math.max(
        1,
        Math.ceil(filteredMenu.length / MENU_ITEMS_PER_PAGE),
      );

      return Math.min(currentPage, maxPage);
    });
  }, [filteredMenu.length]);

  const findCatalogItemForCartItem = (cartItem: CartItem) =>
    menuItems.find((product) => isSameMenuItem(cartItem, product));

  const getCurrentStockForCartItem = (cartItem: CartItem) => {
    const product = findCatalogItemForCartItem(cartItem);

    return product?.stock ?? cartItem.stock;
  };

  const validateCartStock = () => {
    for (const cartItem of cart) {
      const stock = getCurrentStockForCartItem(cartItem);

      if (stock !== null && cartItem.qty > stock) {
        return formatStockError(cartItem.name, stock, cartItem.qty);
      }
    }

    return "";
  };

  const addToCart = (item: MenuItem) => {
    if (!orderTypeChosen) {
      setPendingMenuItem(item);
      setOrderTypeOpen(true);
      return false;
    }
    if (orderType === "DINE_IN" && !selectedTableId) {
      setPendingMenuItem(item);
      setTableDialogOpen(true);
      return false;
    }
    if (!item.availableForSale) {
      const message = unavailableToastMessage(item.name);
      setKitchenError(message);
      setPaymentError(message);
      toast.error(message);
      return false;
    }

    if (item.stock === 0) {
      const message = `${item.name} stock မရှိပါ။ Add to cart လုပ်မရပါ။`;

      setKitchenError(message);
      setPaymentError(message);
      return false;
    }

    const currentItem = cart.find((cartItem) => isSameMenuItem(cartItem, item));

    if (
      currentItem &&
      item.stock !== null &&
      currentItem.qty + 1 > item.stock
    ) {
      const message = formatStockError(
        item.name,
        item.stock,
        currentItem.qty + 1,
      );

      setKitchenError(message);
      setPaymentError(message);
      return false;
    }

    const newCartItemId = crypto.randomUUID();

    setKitchenError("");
    setPaymentError("");
    setAllTicketsDone(false);
    setLastAddedMenuItemId(menuItemIdentity(item));
    setCartPage(1);

    setCart((prev) => {
      const found = prev.find((cartItem) => isSameMenuItem(cartItem, item));

      if (found) {
        if (item.stock !== null && found.qty + 1 > item.stock) {
          const message = formatStockError(
            item.name,
            item.stock,
            found.qty + 1,
          );

          setKitchenError(message);
          setPaymentError(message);
          return prev;
        }

        const updatedItem = { ...found, qty: found.qty + 1 };

        return [
          updatedItem,
          ...prev.filter((cartItem) => cartItem.id !== found.id),
        ];
      }

      return [
        {
          id: newCartItemId,
          menuItemId: item.id,
          dbId: item.dbId,
          barcode: item.barcode,
          sku: item.sku,
          name: item.name,
          price: item.price,
          stock: item.stock,
          qty: 1,
          kitchenSentQty: 0,
          modifiers: [],
          note: "",
        },
        ...prev,
      ];
    });
    return true;
  };

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
      document.querySelectorAll<HTMLElement>("[data-restaurant-cart-target]"),
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

  function animateItemToCart(item: MenuItem, sourceElement: HTMLButtonElement) {
    const sourceRect = sourceElement.getBoundingClientRect();

    setFlyingItem({
      token: Date.now() + Math.random(),
      item,
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

  useEffect(() => {
    if (!pendingMenuItem || !orderTypeChosen || openOrderLoading ||
        (orderType === "DINE_IN" && !selectedTableId)) return;
    const item = pendingMenuItem;
    setPendingMenuItem(null);
    addToCart(item);
  // addToCart reads the current cart after table restoration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMenuItem, orderTypeChosen, orderType, selectedTableId, openOrderLoading]);

  function handleMenuDragStart(event: unknown) {
    const { sourceId } = getDndOperation(event);

    if (sourceId.startsWith("restaurant-menu:")) {
      suppressMenuClickRef.current = true;
      setDraggingMenuItemId(sourceId.replace("restaurant-menu:", ""));
    }
  }

  function handleMenuDragEnd(event: unknown) {
    const { canceled, sourceId, targetId } = getDndOperation(event);
    setDraggingMenuItemId("");

    window.setTimeout(() => {
      suppressMenuClickRef.current = false;
    }, 120);

    if (
      canceled ||
      (targetId !== CART_DROP_ID && targetId !== MOBILE_CART_DROP_ID)
    ) {
      return;
    }

    const menuItemId = sourceId.replace("restaurant-menu:", "");
    const menuItem = menuItems.find((item) => item.id === menuItemId);

    if (menuItem && addToCart(menuItem)) showCartAddedFeedback();
  }

  function handleMenuClick(
    item: MenuItem,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    if (suppressMenuClickRef.current) return;

    if (addToCart(item)) {
      animateItemToCart(item, event.currentTarget);
      showCartAddedFeedback();
    }
  }

  function handleBarcodeSearchEnter() {
    const code = search.trim().toLowerCase();
    if (!code) return;
    const item = menuItems.find((product) =>
      [product.barcode, product.sku].some(
        (value) => value?.trim().toLowerCase() === code,
      ),
    );
    if (!item) {
      setSearchDialogOpen(false);
      return;
    }
    if (addToCart(item)) {
      setSearch("");
      setSearchDialogOpen(false);
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

  function openPaymentDialog() {
    if (!canPayOrder) return;
    const stockError = validateCartStock();

    if (stockError) {
      setPaymentError(stockError);
      setKitchenError(stockError);
      return;
    }

    setPaymentError("");
    setPaymentOpen(true);
    setMobileCartOpen(false);
  }

  const isLastAddedItem = (item: CartItem) =>
    Boolean(
      lastAddedMenuItemId && cartItemIdentity(item) === lastAddedMenuItemId,
    );

  const updateQty = (id: string, action: "plus" | "minus") => {
    setAllTicketsDone(false);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;

          const nextQty = action === "plus" ? item.qty + 1 : item.qty - 1;
          const stock = getCurrentStockForCartItem(item);

          if (action === "plus" && stock !== null && nextQty > stock) {
            const message = formatStockError(item.name, stock, nextQty);

            setKitchenError(message);
            setPaymentError(message);
            return item;
          }

          setKitchenError("");
          setPaymentError("");

          return {
            ...item,
            stock,
            qty: nextQty,
          };
        })
        .filter((item) => item.qty > 0),
    );
  };

  const removeItem = (id: string) => {
    setAllTicketsDone(false);
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleModifier = (cartItemId: string, modifier: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;

        const exists = item.modifiers.includes(modifier);

        return {
          ...item,
          modifiers: exists
            ? item.modifiers.filter((m) => m !== modifier)
            : [...item.modifiers, modifier],
        };
      }),
    );
  };

  const updateNote = (cartItemId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, note } : item)),
    );
  };

  const clearOrder = () => {
    setTakeawayNumber("");
    setKitchenTicketIds([]);
    setAllTicketsDone(false);
    setKitchenStatusError("");
    setCart([]);
    setCartPage(1);
    setLastAddedMenuItemId("");
    setDiscount(0);
    setCashReceived("");
    setPaymentOpen(false);
    setClearConfirmOpen(false);
  };

  const requestClearOrder = () => {
    if (cart.length === 0) return;
    setClearConfirmOpen(true);
  };

  const confirmClearOrder = () => {
    clearOrder();
  };

  const sendToKitchen = async () => {
    if (!activeStaff) {
      setStaffError("Staff ID ထည့်ပါ။");
      return;
    }

    if (cart.length === 0) return;

    if (orderType === "DINE_IN" && !selectedTable) {
      setKitchenError("Dine In order အတွက် table ရွေးပါ။");
      return;
    }

    const usableToken = ensurePageAccessToken(sessionAccessToken);

    if (!usableToken) {
      setKitchenError(MISSING_TOKEN_MESSAGE);
      return;
    }

    const pendingKitchenItems = cart
      .map((item) => ({
        ...item,
        pendingQty: Math.max(item.qty - item.kitchenSentQty, 0),
      }))
      .filter((item) => item.pendingQty > 0);

    if (pendingKitchenItems.length === 0) {
      setKitchenError(NO_PENDING_KITCHEN_ITEMS_MESSAGE);
      return;
    }

    const kitchenOrder: KitchenOrderPayload = {
      orderType: orderType || "DINE_IN",
      ...(orderType === "DINE_IN" && selectedTable
        ? {
          tableId: selectedTable.id,
          tableNo: selectedTable.tableNo,
        }
        : {}),
      staffId: activeStaff.staffId,
      staffName: activeStaff.staffName,
      priority: "NORMAL",
      note: "",
      subtotal,
      serviceCharge,
      tax,
      discount,
      total,
      // Only the quantity added after the previous successful kitchen ticket
      // belongs to this ticket. The complete cart is still kept for payment.
      items: pendingKitchenItems.map((item) => ({
        menuItemId: Number.isFinite(Number(item.menuItemId))
          ? Number(item.menuItemId)
          : null,
        itemName: item.name,
        quantity: item.pendingQty,
        unitPrice: item.price,
        modifiers: item.modifiers,
        kitchenNote: item.note || "",
      })),
    };

    try {
      setKitchenSaving(true);
      setKitchenError("");

      // A dine-in kitchen ticket must always belong to a persisted OPEN order.
      // Keeping the cart only in React state causes it to disappear when the
      // cashier opens the Kitchen page or reloads this page. The OPEN order is
      // also what lets the backend mark the selected table as BUSY and restore
      // the unpaid items when the table is selected again.
      if (orderType === "DINE_IN") {
        await saveOpenOrder();
      }

      const kitchenUrl = `${API_BASE}/api/restaurant/kitchen/tickets`;
      logRequestAuth(kitchenUrl, usableToken);

      const res = await fetch(kitchenUrl, {
        method: "POST",
        headers: authHeaders(usableToken),
        body: JSON.stringify(kitchenOrder),
      });

      const data = await res.json().catch(() => null);

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          (data && typeof data === "object"
            ? pickString(data as Record<string, unknown>, ["message", "error"])
            : "") || "Kitchen order ပို့မရပါ။",
        );
      }

      const ticketRecord = Object.keys(asRecord(asRecord(data).ticket)).length
        ? asRecord(asRecord(data).ticket)
        : Object.keys(asRecord(asRecord(data).data)).length
          ? asRecord(asRecord(data).data)
          : asRecord(data);

      const ticketNo = pickString(ticketRecord, [
        "ticketNo",
        "ticket_no",
        "orderNo",
        "order_no",
      ]);

      const pickupNumber = pickString(ticketRecord, ["pickupNumber", "pickup_number"]) || ticketNo;
      const ticketId = pickString(ticketRecord, ["id", "ticketId", "ticket_id"]) || ticketNo;
      if (orderType === "DINE_IN" || orderType === "TAKEAWAY") {
        if (orderType === "TAKEAWAY") {
          if (pickupNumber) setTakeawayNumber((previous) => previous || pickupNumber);
          else setKitchenStatusError("Takeout ticket number ကို server က မပေးပါ။");
        }
        if (ticketId) setKitchenTicketIds((previous) => [...new Set([...previous, ticketId])]);
        else {
          setKitchenTicketIds((previous) => [...previous, `UNTRACKED-${crypto.randomUUID()}`]);
          setKitchenStatusError("Kitchen ticket ID မရပါ။ Payment အတွက် server ticket status လိုအပ်ပါသည်။");
        }
        setAllTicketsDone(false);
      }

      setKitchenSuccessMessage(
        ticketNo
          ? `Kitchen order ပို့ပြီးပါပြီ။ ${orderType === "TAKEAWAY" ? "Takeout No" : "Ticket No"}: ${orderType === "TAKEAWAY" ? pickupNumber : ticketNo}`
          : "Kitchen order ပို့ပြီးပါပြီ။",
      );
      setKitchenSuccessItemCount(
        pendingKitchenItems.reduce((sum, item) => sum + item.pendingQty, 0),
      );
      setKitchenSuccessOpen(true);

      // Mark the current quantities as sent only after the ticket API succeeds.
      // Further additions to the same item will therefore send only the delta.
      setCart((currentCart) =>
        currentCart.map((item) => ({
          ...item,
          kitchenSentQty: item.qty,
        })),
      );

      await fetchTables();
    } catch (err) {
      setKitchenError(
        err instanceof Error ? err.message : "Kitchen order save failed.",
      );
    } finally {
      setKitchenSaving(false);
    }
  };

  const completePayment = async () => {
    if (!activeStaff) {
      setPaymentOpen(false);
      setStaffError("Staff ID ထည့်ပါ။");
      return;
    }

    if (!canPayOrder) return;

    const latestMenuItems = await fetchMenuItems({ silent: true });
    const unavailableItem = cart.find((item) => {
      const latest = latestMenuItems.find((product) => isSameMenuItem(item, product));
      return !latest || !latest.availableForSale;
    });

    if (unavailableItem) {
      const message = unavailableToastMessage(unavailableItem.name);
      setPaymentError(message);
      setKitchenError(message);
      toast.error(message);
      return;
    }

    const stockError = validateCartStock();

    if (stockError) {
      setPaymentError(stockError);
      setKitchenError(stockError);
      return;
    }

    const missingDbIdItem = cart.find(
      (item) => !String(item.dbId || "").trim(),
    );

    if (missingDbIdItem) {
      setPaymentError(
        `${missingDbIdItem.name} မှာ Product DB ID မပါပါ။ Product API response မှာ id ပါ/မပါ စစ်ပါ။`,
      );
      return;
    }

    if (paymentMethod === "CASH" && cashNumber < total) {
      setPaymentError("Cash received မလုံလောက်သေးပါ");
      return;
    }

    const paymentOrder: PaymentOrderPayload = {
      orderType: orderType || "DINE_IN",
      ...(orderType === "DINE_IN" && selectedTable
        ? {
          tableId: selectedTable.id,
          tableNo: selectedTable.tableNo,
        }
        : {}),
      staffId: activeStaff.staffId,
      staffName: activeStaff.staffName,
      subtotal,
      serviceCharge,
      tax,
      discount,
      total,
      note: "",
      serviceChargeRate: serviceChargeRatePercent / 100,
      serviceChargeRatePercent,
      taxRate: taxRatePercent / 100,
      taxRatePercent,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" ? cashNumber : 0,
      changeAmount: paymentMethod === "CASH" ? change : 0,
      items: cart.map((item) => {
        const productDbId = String(item.dbId || "").trim();

        return {
          productId: productDbId,
          product_id: productDbId,
          dbId: productDbId,
          db_id: productDbId,

          id: item.menuItemId,
          menuItemId: item.menuItemId,

          productName: item.name,
          product_name: item.name,
          qty: item.qty,
          price: item.price,
          barcode: item.barcode || "",
          sku: item.sku || "",
          itemName: item.name,
          quantity: item.qty,
          unitPrice: item.price,
          totalPrice: item.price * item.qty,
          modifiers: item.modifiers,
          kitchenNote: item.note || "",
        };
      }),
    };

    try {
      setPaymentSaving(true);
      setPaymentError("");

      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const paymentUrl = `${API_BASE}/api/restaurant/payments`;
      logRequestAuth(paymentUrl, usableToken);

      const res = await fetch(paymentUrl, {
        method: "POST",
        headers: authHeaders(usableToken),
        body: JSON.stringify(paymentOrder),
      });

      const data = await res.json().catch(() => null);

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (!res.ok) {
        throw new Error(
          (data && typeof data === "object"
            ? pickString(data as Record<string, unknown>, ["message", "error"])
            : "") || "Payment save failed.",
        );
      }

      const paymentRecord = Object.keys(asRecord(asRecord(data).payment)).length
        ? asRecord(asRecord(data).payment)
        : Object.keys(asRecord(asRecord(data).data)).length
          ? asRecord(asRecord(data).data)
          : asRecord(data);
      const paymentNo =
        pickString(paymentRecord, [
          "paymentNo",
          "payment_no",
          "receiptNo",
          "receipt_no",
        ]) || `PAY-${Date.now()}`;
      const orderNo =
        pickString(paymentRecord, ["orderNo", "order_no"]) ||
        pickString(paymentRecord, ["paymentNo", "payment_no"]) ||
        `ORD-${Date.now()}`;

      // Restaurant payment and the shared POS receipt are separate records.
      // Save the receipt only after the restaurant payment has succeeded.
      // A receipt failure must not submit the payment a second time.
      const receiptPayload = {
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
        businessType: "RESTAURANT",
        items: cart.map((item) => {
          const productId = String(item.dbId || "").trim();

          return {
            productId,
            product_id: productId,
            productName: item.name,
            product_name: item.name,
            qty: item.qty,
            quantity: item.qty,
            price: item.price,
            barcode: item.barcode || "",
            sku: item.sku || "",
            lineTotal: item.price * item.qty,
            line_total: item.price * item.qty,
          };
        }),
      };

      let receiptNo = paymentNo;
      let receiptSaveWarning = "";

      try {
        const receiptUrl = `${API_BASE}/api/pos/receipts`;
        logRequestAuth(receiptUrl, usableToken);

        const receiptResponse = await fetch(receiptUrl, {
          method: "POST",
          headers: authHeaders(usableToken),
          body: JSON.stringify(receiptPayload),
        });
        const receiptBody = await receiptResponse.json().catch(() => null);
        const receiptRecord = Object.keys(asRecord(asRecord(receiptBody).data))
          .length
          ? asRecord(asRecord(receiptBody).data)
          : asRecord(receiptBody);

        if (!receiptResponse.ok) {
          throw new Error(
            pickString(receiptRecord, ["message", "error", "details"]) ||
            `Receipt save failed (${receiptResponse.status}).`,
          );
        }

        receiptNo =
          pickString(receiptRecord, ["receiptNo", "receipt_no", "paymentNo"]) ||
          paymentNo;
      } catch (receiptError) {
        receiptSaveWarning = `Payment ${paymentNo} သိမ်းပြီးပါပြီ၊ Receipt ကို database ထဲမသိမ်းနိုင်ပါ။ Payment ကို ထပ်မနှိပ်ပါနှင့်။ ${receiptError instanceof Error
            ? receiptError.message
            : "Receipt save error"
          }`;
      }

      // Payment is already committed. A table update failure must never retry payment.
      if (orderType === "DINE_IN" && selectedTableId) {
        setPendingReservedTableId(selectedTableId);
        try {
          await persistTableStatus(selectedTableId, "RESERVED");
          setPendingReservedTableId(null);
        } catch (tableError) {
          const warning = `Payment သိမ်းပြီးပါပြီ။ Table ကို RESERVED ပြောင်းမရပါ။ Select Table မှ Retry RESERVED နှိပ်ပါ။ ${tableError instanceof Error ? tableError.message : "Table status error"}`;
          setTableStatusError(warning);
          receiptSaveWarning = [receiptSaveWarning, warning].filter(Boolean).join(" ");
        }
        setSelectedTableId(null);
      }

      setPaymentReceiptData({
        ...paymentOrder,
        paymentNo,
        receiptNo,
        orderNo,
        paidAt: new Date().toISOString(),
        cashierName: activeStaff.staffName,
        cashierStaffId: activeStaff.staffId,
      });
      setPaymentReceiptOpen(true);
      setPaymentOpen(false);
      if (orderType === "DINE_IN" && selectedTableId) {
        tableKitchenOrdersRef.current.delete(selectedTableId);
      }
      setMenuItems((prev) =>
        prev.map((menuItem) => {
          const cartItem = cart.find((item) => isSameMenuItem(item, menuItem));

          if (!cartItem || menuItem.stock === null) return menuItem;

          const nextStock = Math.max(menuItem.stock - cartItem.qty, 0);

          return {
            ...menuItem,
            stock: nextStock,
          };
        }),
      );
      setCart([]);
      setTakeawayNumber("");
      setKitchenTicketIds([]);
      setAllTicketsDone(false);
      setKitchenStatusError("");
      setCartPage(1);
      setLastAddedMenuItemId("");
      setDiscount(0);
      setCashReceived("");
      setPaymentMethod("CASH");
      setPaymentError(receiptSaveWarning);
      setKitchenError("");
      setServiceChargeEnabled(true);
      await fetchMenuItems();
      await fetchTables();
      router.refresh();
    } catch (err) {
      setPaymentError(
        formatPaymentErrorMessage(
          err instanceof Error ? err.message : "Payment save failed.",
        ),
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  // A ticket is payable only after the kitchen API confirms every ticket
  // created for this order as DONE. A missing ticket or failed request is locked.
  useEffect(() => {
    if ((orderType !== "DINE_IN" && orderType !== "TAKEAWAY") ||
        (orderType === "DINE_IN" && !selectedTableId) ||
        openOrderLoading || kitchenTicketIds.length === 0 || cart.length === 0) return;
    let cancelled = false;
    async function checkTickets() {
      try {
        const usableToken = ensurePageAccessToken(sessionAccessToken);
        if (!usableToken) throw new Error(MISSING_TOKEN_MESSAGE);
        const res = await fetch(`${API_BASE}/api/restaurant/kitchen/tickets`, {
          headers: authHeaders(usableToken), cache: "no-store",
        });
        if (!res.ok) throw new Error(await getApiErrorMessage(res, "Kitchen status ကိုယူမရပါ"));
        const payload = await res.json();
        const record = asRecord(payload);
        const list = Array.isArray(payload) ? payload :
          Array.isArray(record.tickets) ? record.tickets :
          Array.isArray(record.content) ? record.content :
          Array.isArray(record.data) ? record.data :
          Array.isArray(asRecord(record.data).content) ? asRecord(record.data).content as unknown[] : null;
        if (!list) throw new Error("Kitchen ticket list format မမှန်ပါ။");
        const tickets = list.map((value: unknown) => asRecord(value));
        const allDone = kitchenTicketIds.every((ticketId) => {
          const ticket = tickets.find((entry) =>
            ["id", "ticketId", "ticket_id", "ticketNo", "ticket_no"].some((key) =>
              pickString(entry, [key]) === ticketId));
          const status = ticket ? pickString(ticket, ["status"]).toUpperCase() : "";
          return Boolean(ticket) &&
            (orderType === "TAKEAWAY" || Number(pickString(ticket!, ["tableId", "table_id"])) === selectedTableId) &&
            (orderType === "TAKEAWAY" ? status === "READY" || status === "DONE" : status === "DONE");
        });
        if (!cancelled) { setAllTicketsDone(Boolean(allDone)); setKitchenStatusError(""); }
      } catch (error) {
        if (!cancelled) {
          setAllTicketsDone(false);
          setKitchenStatusError(error instanceof Error ? error.message : "Kitchen status error");
        }
      }
    }
    void checkTickets();
    const timer = window.setInterval(() => { void checkTickets(); }, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [orderType, selectedTableId, kitchenTicketIds, cart, sessionAccessToken, openOrderLoading]);

  async function findReadyTakeaway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = takeawayQuery.trim().toUpperCase();
    if (!number) return;
    if (cart.length > 0) {
      setTakeawaySearchError("Current Order ကို အရင်ရှင်းပြီးမှ အခြား Takeout order ဖွင့်ပါ။");
      return;
    }
    setTakeawaySearchLoading(true);
    setTakeawaySearchError("");
    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);
      if (!usableToken) throw new Error(MISSING_TOKEN_MESSAGE);
      const res = await fetch(`${API_BASE}/api/restaurant/kitchen/tickets`, {
        headers: authHeaders(usableToken), cache: "no-store",
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "Takeout orders ရှာမရပါ"));
      const payload = await res.json();
      const root = asRecord(payload);
      const list = Array.isArray(payload) ? payload :
        Array.isArray(root.tickets) ? root.tickets :
        Array.isArray(root.content) ? root.content :
        Array.isArray(root.data) ? root.data : null;
      if (!list) throw new Error("Kitchen ticket list format မမှန်ပါ။");
      const ticket = list.map((entry: unknown) => asRecord(entry)).find((entry: Record<string, unknown>) =>
        ["pickupNumber", "pickup_number", "ticketNo", "ticket_no"].some((key) =>
          pickString(entry, [key]).toUpperCase() === number) &&
        pickString(entry, ["orderType", "order_type"]).toUpperCase() === "TAKEAWAY");
      if (!ticket) throw new Error("ဒီ Takeout နံပါတ်ကို မတွေ့ပါ။");
      const ticketStatus = pickString(ticket, ["status"]).toUpperCase();
      if (ticketStatus !== "READY" && ticketStatus !== "DONE")
        throw new Error("ဒီ Takeout order က Kitchen READY မဖြစ်သေးပါ။");
      const orderId = pickString(ticket, ["orderId", "order_id"]);
      let order = ticket;
      if (orderId) {
        const orderResponse = await fetch(`${API_BASE}/api/restaurant/orders/${encodeURIComponent(orderId)}`, {
          headers: authHeaders(usableToken), cache: "no-store",
        });
        if (!orderResponse.ok) throw new Error(await getApiErrorMessage(orderResponse, "Takeout order ကိုယူမရပါ"));
        order = unwrapOpenOrderPayload(await orderResponse.json());
      }
      const items = Array.isArray(order.items) ? order.items :
        Array.isArray(order.orderItems) ? order.orderItems :
        Array.isArray(order.order_items) ? order.order_items : [];
      if (items.length === 0) throw new Error("ဒီနံပါတ်အတွက် order items မရပါ။ Backend မှ order items ကို ပြန်ပေးရန် လိုပါသည်။");
      const restored = items.map((entry: unknown) => mapOpenOrderItemToCartItem(asRecord(entry)));
      if (restored.some((item: CartItem) => !item.dbId))
        throw new Error("Order items မှာ product ID မပါပါ။ Payment အတွက် backend မှ ID ပြန်ပေးရန် လိုပါသည်။");
      setOrderType("TAKEAWAY");
      setOrderTypeChosen(true);
      setSelectedTableId(null);
      setTakeawayNumber(number);
      setKitchenTicketIds([pickString(ticket, ["id", "ticketId", "ticket_id"]) || number]);
      setAllTicketsDone(true);
      setKitchenStatusError("");
      setDiscount(pickNumber(order, ["discount", "discountAmount", "discount_amount"]));
      setCart(restored);
      setTakeawaySearchOpen(false);
    } catch (error) {
      setTakeawaySearchError(error instanceof Error ? error.message : "Takeout order ရှာမရပါ");
    } finally { setTakeawaySearchLoading(false); }
  }

  const closePaymentReceiptDialog = () => {
    setPaymentReceiptOpen(false);
    setPaymentReceiptData(null);
    setPaymentError("");
  };

  const printPaymentReceipt = () => {
    if (!paymentReceiptData) return;

    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      setPaymentError(
        "Print window ကိုဖွင့်မရပါ။ Browser popup ကို allow လုပ်ပါ။",
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPaymentReceiptHtml(paymentReceiptData, shopReceiptInfo),
    );
    printWindow.document.close();
  };

  if (!activeStaff) {
    return (
      <main
        className={`min-h-screen ${darkMode
            ? "bg-slate-950 text-slate-50"
            : "bg-[linear-gradient(135deg,var(--brand-soft),var(--background),color-mix(in_srgb,var(--brand-accent)_14%,var(--background)))] text-slate-950"
          }`}
      >
        <BusinessTypeGuard allow="RESTAURANT" />

        <div className="mx-auto flex min-h-screen max-w-5xl flex-col p-4 lg:p-6">
          <section
            className={`rounded-[2rem] border p-4 shadow-sm ${darkMode
                ? "border-white/10 bg-white/5"
                : "border-[var(--brand-border)] bg-white/80"
              }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)]">
                  <ChefHat size={30} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
                    Restaurant Cashier POS
                  </h1>
                  <p
                    className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                      }`}
                  >
                    Staff ID ဖြင့်ဝင်ပြီးမှ POS ကိုအသုံးပြုနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDarkMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${darkMode
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
              className={`w-full max-w-xl rounded-[2rem] border p-6 shadow-sm ${darkMode
                  ? "border-white/10 bg-white/5"
                  : "border-[var(--brand-border)] bg-white/90"
                }`}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-accent)]">
                  <IdCard size={30} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Staff ID လိုအပ်ပါတယ်</h2>
                  <p
                    className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                      }`}
                  >
                    Staff ID ကို scan လုပ်ပါ သို့မဟုတ် ရိုက်ထည့်ပါ။
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">Staff ID</label>
                <div
                  className={`mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 ${darkMode
                      ? "bg-slate-900 ring-1 ring-white/10"
                      : "bg-slate-50 ring-1 ring-[var(--brand-border)]"
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
                  className={`mt-4 rounded-2xl border p-4 text-sm font-black ${darkMode
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
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-4 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
      onDragStart={handleMenuDragStart}
      onDragEnd={handleMenuDragEnd}
    >
      <main
        className={`min-h-screen ${darkMode
            ? "bg-slate-950 text-slate-50"
            : "bg-[linear-gradient(135deg,var(--brand-soft),var(--background),color-mix(in_srgb,var(--brand-accent)_14%,var(--background)))] text-slate-950"
          } ${isResizingCart ? "cursor-col-resize" : ""}`}
      >
        <BusinessTypeGuard allow="RESTAURANT" />

        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 p-2 pb-24 sm:p-3 sm:pb-24 lg:landscape:gap-4 lg:landscape:p-5">
          {/* Compact header: detailed controls live in one dialog. */}
          <div
            className={`sticky top-0 z-30 -mx-2 -mt-2 px-2 py-2 backdrop-blur-xl sm:-mx-3 sm:-mt-3 sm:px-3 lg:landscape:-mx-5 lg:landscape:-mt-5 lg:landscape:px-5 ${darkMode ? "bg-slate-950/88" : "bg-[linear-gradient(135deg,var(--brand-soft),var(--background),color-mix(in_srgb,var(--brand-accent)_14%,var(--background)))]"
              }`}
          >
            <div
              className={`flex h-14 items-center justify-between gap-2 rounded-2xl border px-2.5 shadow-sm ${darkMode
                  ? "border-white/10 bg-white/5"
                  : "border-[var(--brand-border)] bg-white/90"
                }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-[var(--brand-soft)] text-slate-900 hover:bg-[var(--brand-soft)]"
                    }`}
                  aria-label="Go to dashboard"
                >
                  <ArrowLeft size={17} className="text-[var(--brand-accent)]" />
                </button>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">Restaurant POS</p>
                  <p
                    className={`truncate text-[10px] font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {orderType === "DINE_IN" && selectedTable
                      ? `Dine In · Table ${selectedTable.tableNo}`
                      : orderType === "DINE_IN"
                        ? "Dine In · No table"
                        : orderType === "TAKEAWAY"
                          ? "Takeaway"
                          : "Delivery"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div
                  className={`hidden items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-black sm:inline-flex ${darkMode
                      ? "bg-white/10 text-white"
                      : "bg-[var(--brand-soft)] text-slate-900"
                    }`}
                >
                  <Receipt size={15} className="text-[var(--brand-accent)]" />
                  <span>{cartTotalQuantity} items</span>
                  <span className="text-[var(--brand-primary)]">
                    {formatMoney(total)} Ks
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setHeaderControlsOpen(true)}
                  className={`relative inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${darkMode
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  aria-haspopup="dialog"
                  aria-label="Open POS controls"
                >
                  <MoreHorizontal size={18} />
                  <span className="hidden sm:inline">Controls</span>
                  {cartTotalQuantity > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] text-white">
                      {cartTotalQuantity}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <section
            className="grid flex-1 gap-4 lg:landscape:grid-cols-[minmax(0,1fr)_380px] xl:landscape:grid-cols-[minmax(0,1fr)_var(--restaurant-cart-width)]"
            style={
              {
                "--restaurant-cart-width": `${cartWidth}px`,
              } as React.CSSProperties
            }
          >
            {/* Left side */}
            <div className="flex min-h-0 flex-col gap-4">
              {/* iPad toolbar: actions stay compact; search/table open as dialogs */}
              <div className="relative mb-1 shrink-0">
               

                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category.id)}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black transition ${selectedCategory === category.id
                          ? "bg-slate-950 text-white shadow-md"
                          : darkMode
                            ? "bg-white/10 text-slate-200 hover:bg-white/15"
                            : "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-[var(--brand-soft)]"
                        }`}
                    >
                      <span className="mr-1.5">{category.icon}</span>
                      {category.name}
                    </button>
                  ))}
                </div>

                {(openOrderError ||
                  (orderType === "DINE_IN" && !selectedTable)) && (
                    <div
                      className={`mt-2 rounded-xl px-3 py-2 text-xs font-black ${openOrderError
                          ? "bg-red-500/10 text-red-500"
                          : "bg-amber-500/10 text-amber-600"
                        }`}
                    >
                      {openOrderError ||
                        "Menu ရွေးနိုင်ပါတယ်။ Kitchen မပို့မီ table ရွေးပေးပါ။"}
                    </div>
                  )}
              </div>

              {/* Menu grid */}
              {menuLoading ? (
                <div
                  className={`rounded-[1.75rem] border p-6 text-sm font-black ${darkMode
                      ? "border-white/10 bg-white/5 text-slate-200"
                      : "border-[var(--brand-border)] bg-white/80 text-slate-600"
                    }`}
                >
                  Loading menu items...
                </div>
              ) : menuError ? (
                <div
                  className={`rounded-[1.75rem] border p-6 text-sm font-black ${darkMode
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-red-100 bg-red-50 text-red-600"
                    }`}
                >
                  {menuError}
                </div>
              ) : menuItems.length === 0 ? (
                <div
                  className={`rounded-[1.75rem] border border-dashed p-6 text-sm font-black ${darkMode
                      ? "border-white/10 bg-white/5 text-slate-300"
                      : "border-[var(--brand-border)] bg-[var(--brand-soft)] text-slate-600"
                    }`}
                >
                  No menu products found. Please add products first.
                </div>
              ) : filteredMenu.length === 0 ? (
                <div
                  className={`rounded-[1.75rem] border border-dashed p-6 text-sm font-black ${darkMode
                      ? "border-white/10 bg-white/5 text-slate-300"
                      : "border-[var(--brand-border)] bg-[var(--brand-soft)] text-slate-600"
                    }`}
                >
                  No menu products match your search.
                </div>
              ) : (
                <div
                  className={`rounded-[2rem] border p-4 shadow-sm ${darkMode
                      ? "border-white/10 bg-white/5"
                      : "border-[var(--brand-border)] bg-white/80"
                    }`}
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-black">
                        <Utensils className="text-[var(--brand-accent)]" size={20} />
                        Menu Items
                      </h2>
                      <p
                        className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                          }`}
                      >
                        Showing {menuPageStart}-{menuPageEnd} of{" "}
                        {filteredMenu.length}
                        {search.trim() ? " search results" : " menu items"} ·
                        Page {safeMenuPage} / {menuTotalPages}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setMenuPage((page) => Math.max(1, page - 1))
                        }
                        disabled={safeMenuPage === 1}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode
                            ? "bg-white/10 text-white hover:bg-white/15"
                            : "bg-white text-slate-900 shadow-sm ring-1 ring-[var(--brand-border)] hover:bg-[var(--brand-soft)]"
                          }`}
                      >
                        <ChevronLeft size={18} />
                        Prev
                      </button>

                      <div
                        className={`rounded-2xl px-4 py-3 text-sm font-black ${darkMode
                            ? "bg-slate-900 text-slate-200"
                            : "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                          }`}
                      >
                        {safeMenuPage}/{menuTotalPages}
                      </div>

                      <button
                        onClick={() =>
                          setMenuPage((page) =>
                            Math.min(menuTotalPages, page + 1),
                          )
                        }
                        disabled={safeMenuPage === menuTotalPages}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode
                            ? "bg-white/10 text-white hover:bg-white/15"
                            : "bg-white text-slate-900 shadow-sm ring-1 ring-[var(--brand-border)] hover:bg-[var(--brand-soft)]"
                          }`}
                      >
                        Next
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {menuTotalPages > 1 && (
                    <div className="mb-4 flex gap-1.5">
                      {Array.from({ length: menuTotalPages }).map(
                        (_, index) => {
                          const page = index + 1;
                          const active = page === safeMenuPage;

                          return (
                            <button
                              key={page}
                              onClick={() => setMenuPage(page)}
                              className={`h-2 flex-1 rounded-full transition ${active
                                  ? "bg-[var(--brand-primary)]"
                                  : darkMode
                                    ? "bg-white/10 hover:bg-white/20"
                                    : "bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
                                }`}
                              aria-label={`Go to menu page ${page}`}
                            />
                          );
                        },
                      )}
                    </div>
                  )}

                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={`menu-page-${safeMenuPage}-${selectedCategory}-${search}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                    >
                      {paginatedMenu.map((item) => (
                        <DraggableMenuCard
                          key={item.id}
                          menuItemId={item.id}
                          onClick={(event) => handleMenuClick(item, event)}
                          disabled={!item.availableForSale || item.stock === 0}
                          className={`group rounded-[1.75rem] border p-4 text-left shadow-sm transition ${lastAddedMenuItemId === item.id
                              ? darkMode
                                ? "border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/30"
                                : "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/40"
                              : darkMode
                                ? "border-white/10 bg-slate-900/60 hover:bg-white/10"
                                : "border-[var(--brand-border)] bg-white hover:border-[var(--brand-border)] hover:shadow-md"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-[var(--brand-soft)] text-3xl shadow-inner">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                categories.find(
                                  (cat) => cat.id === item.categoryId,
                                )?.icon || "🍽️"
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              {item.popular && (
                                <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white">
                                  Popular
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.availableForSale && item.stock !== 0
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-red-500/10 text-red-600"
                                  }`}
                              >
                                {!item.availableForSale
                                  ? "Out of Stock"
                                  : item.stock === null
                                    ? "Available"
                                  : item.stock > 0
                                    ? `Stock ${item.stock}`
                                    : "Sold out"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 min-h-[56px]">
                            <h3 className="line-clamp-2 text-base font-black">
                              {item.name}
                            </h3>
                            <p
                              className={`mt-1 line-clamp-1 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                                }`}
                            >
                              {item.nameMm ||
                                item.barcode ||
                                item.sku ||
                                "Ready to add"}
                            </p>
                          </div>

                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xl font-black text-[var(--brand-primary)]">
                                {formatMoney(item.price)} Ks
                              </p>
                              <p
                                className={`mt-1 flex items-center gap-1 truncate text-xs font-bold ${darkMode ? "text-slate-400" : "text-slate-400"
                                  }`}
                              >
                                <Clock3 size={13} />
                                {item.categoryId}
                              </p>
                            </div>

                            <div
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white transition ${lastAddedMenuItemId === item.id
                                  ? "bg-emerald-500"
                                  : "bg-slate-950 group-hover:bg-[var(--brand-primary)]"
                                }`}
                            >
                              {lastAddedMenuItemId === item.id ? (
                                <Check size={20} />
                              ) : (
                                <Plus size={20} />
                              )}
                            </div>
                          </div>
                        </DraggableMenuCard>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Cart side */}
            {mobileCartOpen && (
              <button
                type="button"
                aria-label="Close cart"
                onClick={() => setMobileCartOpen(false)}
                className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:landscape:hidden"
              />
            )}
            <aside
              className={`${mobileCartOpen
                  ? "fixed inset-x-2 bottom-24 top-16 z-50 block"
                  : "hidden"
                } min-h-0 lg:landscape:fixed lg:landscape:bottom-3 lg:landscape:right-3 lg:landscape:top-[76px] lg:landscape:z-40 lg:landscape:block lg:landscape:w-[380px] xl:landscape:w-[var(--restaurant-cart-width)]`}
            >
              <button
                type="button"
                onPointerDown={beginCartResize}
                onDoubleClick={() => setCartWidth(DEFAULT_CART_WIDTH)}
                className={`absolute -left-2 top-1/2 z-40 hidden h-24 w-4 -translate-y-1/2 cursor-col-resize items-center justify-center rounded-full border shadow-lg xl:landscape:flex ${isResizingCart
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                    : darkMode
                      ? "border-white/10 bg-slate-800 text-slate-300 hover:bg-[var(--brand-primary)] hover:text-white"
                      : "border-[var(--brand-border)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white"
                  }`}
                aria-label="Resize cart width"
                title="Drag to resize cart · Double-click to reset"
              >
                <GripVertical size={14} />
              </button>
              <RestaurantCartDropSurface
                dragging={Boolean(draggingMenuItemId)}
                darkMode={darkMode}
                addedFeedbackVisible={addedFeedbackVisible}
              >
                <div className="shrink-0 border-b border-slate-200/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-black">
                        <Receipt size={19} className="text-[var(--brand-accent)]" />
                        Current Order
                      </h2>
                      <p
                        className={`mt-0.5 text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                          }`}
                      >
                        {orderType === "DINE_IN"
                          ? selectedTable
                            ? `${selectedTable.tableNo} · ${selectedTable.seats || 0
                            } seats`
                            : "No table selected"
                          : orderType === "TAKEAWAY"
                            ? "Takeaway order"
                            : "Delivery order"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`hidden items-center gap-1 rounded-xl p-1 xl:landscape:flex ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)]"
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
                          className="grid h-7 w-7 place-items-center rounded-lg disabled:opacity-30"
                          aria-label="Make cart narrower"
                        >
                          <Minus size={13} />
                        </button>
                        <GripVertical size={13} className="text-[var(--brand-accent)]" />
                        <button
                          type="button"
                          onClick={() =>
                            setCartWidth((width) =>
                              Math.min(MAX_CART_WIDTH, width + 40),
                            )
                          }
                          disabled={cartWidth >= MAX_CART_WIDTH}
                          className="grid h-7 w-7 place-items-center rounded-lg disabled:opacity-30"
                          aria-label="Make cart wider"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileCartOpen(false)}
                        className="rounded-xl bg-slate-500/10 p-2.5 transition lg:landscape:hidden"
                        aria-label="Close cart"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={requestClearOrder}
                        disabled={cart.length === 0}
                        className="rounded-xl bg-red-500/10 p-2.5 text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Cart ရှင်းရန်"
                        title="Cart ရှင်းရန်"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2.5">
                  <AnimatePresence initial={false} mode="wait">
                    {cart.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`grid min-h-[110px] place-items-center rounded-[1.75rem] border border-dashed p-4 text-center ${darkMode
                            ? "border-white/10 bg-white/5"
                            : "border-[var(--brand-border)] bg-[var(--brand-soft)]"
                          }`}
                      >
                        <div>
                          <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-primary)] text-white">
                            <Coffee size={20} />
                          </div>
                          <h3 className="mt-2 text-sm font-black">
                            Menu item ရွေးပါ
                          </h3>
                          <p
                            className={`mt-2 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                              }`}
                          >
                            စားသောက်ဆိုင် order အတွက် ဘယ်ဘက်က menu ကိုနှိပ်ပါ။
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`cart-page-${safeCartPage}`}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-2"
                      >
                        <div
                          className={`rounded-2xl border px-3 py-2 ${darkMode
                              ? "border-white/10 bg-slate-900/70"
                              : "border-[var(--brand-border)] bg-[var(--brand-soft)]"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black">
                                Menu {cartPageStart}-{cartPageEnd} /{" "}
                                {cartLineCount} မျိုး
                              </p>
                              <p
                                className={`mt-0.5 max-w-[230px] truncate text-[10px] font-bold ${darkMode ? "text-slate-400" : "text-slate-500"
                                  }`}
                              >
                                အသစ်ဆုံးကိုအရင်ပြ · စုစုပေါင်း Qty{" "}
                                {cartTotalQuantity} ခု · စာမျက်နှာ{" "}
                                {safeCartPage}/{cartTotalPages}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => goToCartPage(safeCartPage - 1)}
                                disabled={!canGoToPreviousCartPage}
                                title={
                                  canGoToPreviousCartPage
                                    ? "Previous cart page"
                                    : "ပထမစာမျက်နှာဖြစ်သည်"
                                }
                                className={`grid h-8 w-8 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode
                                    ? "bg-white/10 text-white hover:bg-white/15"
                                    : "bg-white text-slate-900 shadow-sm ring-1 ring-[var(--brand-border)] hover:bg-[var(--brand-soft)]"
                                  }`}
                              >
                                <ChevronLeft size={18} />
                              </button>

                              <button
                                type="button"
                                onClick={() => goToCartPage(safeCartPage + 1)}
                                disabled={!canGoToNextCartPage}
                                title={
                                  canGoToNextCartPage
                                    ? "Next cart page"
                                    : `Next စာမျက်နှာအတွက် Menu ${CART_ITEMS_PER_PAGE + 1} မျိုးနှင့်အထက် လိုအပ်သည်`
                                }
                                className={`grid h-8 w-8 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode
                                    ? "bg-white/10 text-white hover:bg-white/15"
                                    : "bg-white text-slate-900 shadow-sm ring-1 ring-[var(--brand-border)] hover:bg-[var(--brand-soft)]"
                                  }`}
                              >
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          </div>

                          {cartTotalPages > 1 && (
                            <div className="mt-2 flex gap-1.5">
                              {Array.from({ length: cartTotalPages }).map(
                                (_, index) => {
                                  const page = index + 1;
                                  const active = page === safeCartPage;

                                  return (
                                    <button
                                      key={page}
                                      type="button"
                                      onClick={() => goToCartPage(page)}
                                      className={`h-2 flex-1 rounded-full transition ${active
                                          ? "bg-[var(--brand-primary)]"
                                          : darkMode
                                            ? "bg-white/10 hover:bg-white/20"
                                            : "bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
                                        }`}
                                      aria-label={`Go to cart page ${page}`}
                                    />
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>

                        {paginatedCart.map((item, index) => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ delay: index * 0.03 }}
                            className={`rounded-2xl border p-2.5 shadow-sm transition-colors ${isLastAddedItem(item)
                                ? darkMode
                                  ? "border-[var(--brand-primary)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand-border)]"
                                  : "border-[var(--brand-primary)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand-border)]"
                                : darkMode
                                  ? "border-white/10 bg-slate-900/70"
                                  : "border-slate-100 bg-slate-50"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-accent)]">
                                    <Utensils size={17} />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h3 className="truncate font-black">
                                        {item.name}
                                      </h3>
                                      {isLastAddedItem(item) && (
                                        <span className="shrink-0 rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                          Latest
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-xs font-bold text-[var(--brand-primary)]">
                                      {formatMoney(item.price)} Ks each
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => removeItem(item.id)}
                                className="rounded-xl bg-red-500/10 p-2 text-red-500 transition hover:bg-red-500 hover:text-white"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div
                                className={`inline-flex items-center gap-2 rounded-2xl p-1 shadow-sm ring-1 ${darkMode
                                    ? "bg-white/10 ring-white/10"
                                    : "bg-white ring-slate-100"
                                  }`}
                              >
                                <button
                                  onClick={() => updateQty(item.id, "minus")}
                                  className={`grid h-8 w-8 place-items-center rounded-xl ${darkMode
                                      ? "bg-slate-800 text-white"
                                      : "bg-slate-100 text-slate-900"
                                    }`}
                                >
                                  <Minus size={16} />
                                </button>

                                <span
                                  className={`w-9 text-center text-sm font-black ${darkMode ? "text-white" : "text-slate-900"
                                    }`}
                                >
                                  {item.qty}
                                </span>

                                <button
                                  onClick={() => updateQty(item.id, "plus")}
                                  className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-primary)] text-white"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>

                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-400">
                                  Line total
                                </p>
                                <p className="text-base font-black">
                                  {formatMoney(item.price * item.qty)} Ks
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                              {modifiers.map((modifier) => {
                                const active =
                                  item.modifiers.includes(modifier);

                                return (
                                  <button
                                    key={modifier}
                                    onClick={() =>
                                      toggleModifier(item.id, modifier)
                                    }
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black transition ${active
                                        ? "bg-[var(--brand-primary)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
                                        : darkMode
                                          ? "bg-white/10 text-slate-300 hover:bg-white/15"
                                          : "bg-white text-slate-500 ring-1 ring-slate-100 hover:bg-[var(--brand-soft)]"
                                      }`}
                                  >
                                    {modifier}
                                  </button>
                                );
                              })}
                            </div>

                            <input
                              value={item.note || ""}
                              onChange={(e) =>
                                updateNote(item.id, e.target.value)
                              }
                              placeholder="Kitchen note..."
                              className={`mt-2 w-full rounded-xl px-3 py-1.5 text-xs font-semibold outline-none ring-1 ${darkMode
                                  ? "bg-white/10 text-white ring-white/10 placeholder:text-slate-400"
                                  : "bg-white text-slate-900 ring-slate-100 placeholder:text-slate-400"
                                }`}
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="shrink-0 border-t border-slate-200/20 px-3 pb-3 pt-2.5">
                  <details className="group/order-totals">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-xs font-black [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight size={16} className="transition-transform group-open/order-totals:rotate-90" />
                        Totals / Discount / Tax
                      </span>
                      <span className="whitespace-nowrap text-base text-[var(--brand-primary)]">{formatMoney(total)} Ks</span>
                    </summary>
                    <div className="pt-2">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-bold">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }
                      >
                        Subtotal
                      </span>
                      <span className="truncate">
                        {formatMoney(subtotal)} Ks
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }
                      >
                        Tax {formatRatePercent(taxRatePercent)}%
                      </span>
                      <span className="truncate">{formatMoney(tax)} Ks</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setServiceChargeEnabled((v) => !v)}
                        className={`inline-flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-0.5 ${serviceChargeEnabled
                            ? "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                            : darkMode
                              ? "bg-white/10 text-slate-300"
                              : "bg-slate-100 text-slate-500"
                          }`}
                      >
                        <MoreHorizontal size={12} />
                        <span className="truncate">
                          Service {formatRatePercent(serviceChargeRatePercent)}%
                        </span>
                      </button>
                      <span className="truncate">
                        {formatMoney(serviceCharge)} Ks
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label
                        className={`inline-flex min-w-0 items-center gap-1 ${darkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                      >
                        <BadgePercent size={13} />
                        <span className="truncate">Discount</span>
                      </label>
                      <input
                        value={discount || ""}
                        onChange={(e) =>
                          setDiscount(Number(e.target.value || 0))
                        }
                        type="number"
                        className={`h-7 w-20 rounded-lg px-2 text-right text-xs font-black outline-none ${darkMode
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-900"
                          }`}
                        placeholder="0"
                      />
                    </div>

                    <div
                      className={`col-span-2 mt-0.5 flex items-center justify-between rounded-xl px-3 py-2 ${darkMode ? "bg-[var(--brand-soft)]" : "bg-[var(--brand-soft)]"
                        }`}
                    >
                      <span className="text-xs font-black">Total</span>
                      <span className="text-xl font-black text-[var(--brand-primary)]">
                        {formatMoney(total)} Ks
                      </span>
                    </div>
                  </div>

                    </div>
                  </details>

                  {(kitchenError || kitchenStatusError || (showKitchenAction && kitchenDisabledMessage)) && (
                    <div
                      title={kitchenError || kitchenStatusError || kitchenDisabledMessage}
                      className={`mt-2 flex min-h-8 items-center rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${kitchenError
                          ? darkMode
                            ? "border-red-400/30 bg-red-500/10 text-red-200"
                            : "border-red-100 bg-red-50 text-red-600"
                          : darkMode
                            ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                    >
                      <span
                        className={kitchenError || kitchenStatusError ? "line-clamp-2" : "truncate"}
                      >
                        {kitchenError || kitchenStatusError || kitchenDisabledMessage}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {showKitchenAction && <button
                      onClick={sendToKitchen}
                      disabled={!hasPendingKitchenItems || kitchenSaving}
                      title={
                        hasPendingKitchenItems
                          ? "Kitchen ကိုပို့ရန်"
                          : kitchenDisabledMessage || "Cart ထဲတွင် item မရှိပါ။"
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {kitchenSaving ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <ChefHat size={18} />
                      )}
                      {kitchenSaving ? "Sending..." : "Kitchen"}
                    </button>}

                    <button
                      onClick={openPaymentDialog}
                      disabled={!canPayOrder}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-3 text-xs font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Payment
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </RestaurantCartDropSurface>
            </aside>
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
              onClick={() => {
                if (!exitSaving) setExitConfirmOpen(false);
              }}
              className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-3 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                onClick={(event) => event.stopPropagation()}
                className={`w-full max-w-md rounded-[2rem] border p-5 shadow-2xl sm:p-6 ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-white text-slate-950"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
                    <ArrowLeft size={22} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setExitConfirmOpen(false)}
                    disabled={exitSaving}
                    className={`grid h-10 w-10 place-items-center rounded-xl disabled:opacity-40 ${darkMode ? "bg-white/10" : "bg-slate-100"
                      }`}
                    aria-label="Stay in POS"
                  >
                    <X size={18} />
                  </button>
                </div>

                <h2 className="mt-4 text-xl font-black">
                  Dashboard ကို သွားမလား?
                </h2>
                <p
                  className={`mt-2 text-sm font-semibold leading-6 ${darkMode ? "text-slate-300" : "text-slate-500"}`}
                >
                  Cart ထဲမှာ {cart.reduce((sum, item) => sum + item.qty, 0)}{" "}
                  items · {formatMoney(total)} Ks ရှိနေပါတယ်။ မသိမ်းဘဲထွက်လျှင်
                  လက်ရှိပြင်ဆင်ထားတဲ့ order ပျောက်သွားနိုင်ပါတယ်။
                </p>

                <div
                  className={`mt-4 rounded-2xl p-3 text-sm font-black ${darkMode ? "bg-white/5" : "bg-[var(--brand-soft)]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>Order</span>
                    <span className="text-[var(--brand-primary)]">
                      {orderType === "DINE_IN"
                        ? selectedTable
                          ? `Dine In · Table ${selectedTable.tableNo}`
                          : "Dine In · No table"
                        : orderType === "TAKEAWAY"
                          ? "Takeaway"
                          : "Delivery"}
                    </span>
                  </div>
                </div>

                {exitError && (
                  <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm font-black text-red-500">
                    {exitError}
                  </div>
                )}

                {orderType !== "DINE_IN" && (
                  <p className="mt-3 text-xs font-bold text-amber-600">
                    Takeaway/Delivery cart ကို open order အဖြစ်
                    မသိမ်းနိုင်သေးပါ။ Stay သို့မဟုတ် Discard ကိုရွေးပါ။
                  </p>
                )}

                {orderType === "DINE_IN" && !selectedTable && (
                  <p className="mt-3 text-xs font-bold text-amber-600">
                    Save & Exit လုပ်ရန် table အရင်ရွေးရပါမယ်။
                  </p>
                )}

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setExitConfirmOpen(false)}
                    disabled={exitSaving}
                    className={`rounded-2xl px-4 py-3 text-sm font-black disabled:opacity-40 ${darkMode
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                  >
                    Stay in POS
                  </button>

                  {orderType === "TAKEAWAY" && takeawayNumber && (
                    <div className="mt-3 rounded-xl bg-amber-100 p-4 text-center text-slate-950">
                      <div className="text-2xl font-black">Takeout #{takeawayNumber}</div>
                      <button type="button" className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white"
                        onClick={() => {
                          const printable = window.open("", "_blank", "width=360,height=450");
                          if (!printable) return;
                          printable.document.write(`<html><head><title>Takeout Number</title></head><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>TAKEOUT</h2><strong style="font-size:48px">${escapeHtml(takeawayNumber)}</strong><p>Please keep this number for pickup.</p></body></html>`);
                          printable.document.close();
                          printable.focus();
                          printable.print();
                        }}>Print Number</button>
                    </div>
                  )}
                  {orderType === "DINE_IN" && selectedTable && (
                    <button
                      type="button"
                      onClick={saveOrderAndExit}
                      disabled={exitSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {exitSaving ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Check size={17} />
                      )}
                      {exitSaving ? "Saving..." : "Save & Exit"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={discardOrderAndExit}
                    disabled={exitSaving}
                    className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-40 sm:col-span-2"
                  >
                    Discard & Exit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clear Cart Confirmation */}
        <AnimatePresence>
          {clearConfirmOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClearConfirmOpen(false)}
              className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/65 p-3 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                onClick={(event) => event.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="clear-cart-dialog-title"
                aria-describedby="clear-cart-dialog-description"
                className={`w-full max-w-md rounded-[2rem] border p-5 shadow-2xl sm:p-6 ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-red-100 bg-white text-slate-950"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-500">
                    <Trash2 size={23} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(false)}
                    className={`grid h-10 w-10 place-items-center rounded-xl ${darkMode ? "bg-white/10" : "bg-slate-100"
                      }`}
                    aria-label="Dialog ပိတ်ရန်"
                  >
                    <X size={18} />
                  </button>
                </div>

                <h2
                  id="clear-cart-dialog-title"
                  className="mt-4 text-xl font-black"
                >
                  Cart ကို ရှင်းမှာ သေချာပါသလား?
                </h2>
                <p
                  id="clear-cart-dialog-description"
                  className={`mt-2 text-sm font-semibold leading-6 ${darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                >
                  Cart ထဲရှိ item အားလုံး၊ discount နှင့် လက်ရှိပြင်ဆင်ထားသော
                  အချက်အလက်များကို ဖျက်ပါမယ်။ ဒီလုပ်ဆောင်ချက်ကို ပြန်ယူ၍မရပါ။
                </p>

                <div
                  className={`mt-4 rounded-2xl p-4 ${darkMode ? "bg-white/5" : "bg-red-50"
                    }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm font-black">
                    <span>ဖျက်မည့် item အရေအတွက်</span>
                    <span className="text-red-500">
                      {cart.reduce((sum, item) => sum + item.qty, 0)} ခု
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm font-black">
                    <span>စုစုပေါင်းတန်ဖိုး</span>
                    <span className="text-red-500">
                      {formatMoney(total)} Ks
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(false)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${darkMode
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                  >
                    မဖျက်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={confirmClearOrder}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
                  >
                    <Trash2 size={17} />
                    Cart ရှင်းရန်
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Header Controls Dialog */}
        <AnimatePresence>
          {headerControlsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHeaderControlsOpen(false)}
              className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pos-controls-dialog-title"
                className={`w-full max-w-lg overflow-hidden rounded-[2rem] border shadow-2xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-[color-mix(in_srgb,var(--brand-accent)_6%,white)] text-slate-950"
                  }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200/20 p-4">
                  <div>
                    <h2
                      id="pos-controls-dialog-title"
                      className="text-xl font-black"
                    >
                      POS Controls
                    </h2>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Menu နှင့် Cart ကို ဒီနေရာမှ ထိန်းချုပ်နိုင်ပါတယ်။
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHeaderControlsOpen(false)}
                    className={`grid h-10 w-10 place-items-center rounded-xl ${darkMode ? "bg-white/10" : "bg-slate-100"}`}
                    aria-label="Close POS controls"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="max-h-[78vh] space-y-5 overflow-y-auto p-4">
                  <section>
                    <p
                      className={`mb-2 text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Menu & Display
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDarkMode((value) => !value)}
                        className={`inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)]"}`}
                      >
                        {darkMode ? (
                          <Sun size={18} className="text-[var(--brand-accent)]" />
                        ) : (
                          <Moon size={18} className="text-[var(--brand-accent)]" />
                        )}
                        {darkMode ? "Day Mode" : "Night Mode"}
                      </button>
                      <button
                        type="button"
                        onClick={handleGoToDashboard}
                        className={`inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)]"}`}
                      >
                        <ArrowLeft size={18} className="text-[var(--brand-accent)]" />{" "}
                        Dashboard
                      </button>
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p
                        className={`text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Menu Items Control
                      </p>
                      <span className="text-[11px] font-black text-[var(--brand-primary)]">
                        {filteredMenu.length} items
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          key: "DINE_IN" as OrderType,
                          label: "Dine In",
                          icon: <Utensils size={17} />,
                        },
                        {
                          key: "TAKEAWAY" as OrderType,
                          label: "Takeaway",
                          icon: <ShoppingBag size={17} />,
                        },
                        {
                          key: "DELIVERY" as OrderType,
                          label: "Delivery",
                          icon: <Package size={17} />,
                        },
                      ].map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => {
                            if (cart.length > 0 && type.key !== orderType) return;
                            setOrderType(type.key);
                            setOrderTypeChosen(true);
                            if (type.key !== "DINE_IN") setSelectedTableId(null);
                          }}
                          className={`inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-black transition ${orderType === type.key
                              ? "bg-[var(--brand-primary)] text-white shadow-md shadow-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
                              : darkMode
                                ? "bg-white/10 text-slate-200"
                                : "bg-[var(--brand-soft)] text-slate-700"
                            }`}
                        >
                          {type.icon}
                          <span className="truncate">{type.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setHeaderControlsOpen(false); setTakeawaySearchOpen(true); }}
                        className={`col-span-2 inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
                        <Search size={18} /> Find Ready Takeout by Number
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          setSearchDialogOpen(true);
                        }}
                        className={`inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black ${darkMode ? "bg-white/10" : "bg-slate-100"}`}
                      >
                        <Search size={18} className="text-[var(--brand-accent)]" />
                        <span className="min-w-0 truncate">
                          {search ? `Search: ${search}` : "Search Menu"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          setTableDialogOpen(true);
                        }}
                        disabled={orderType !== "DINE_IN"}
                        className={`inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "bg-white/10" : "bg-slate-100"}`}
                      >
                        <Armchair size={18} className="text-[var(--brand-accent)]" />
                        <span className="min-w-0 truncate">
                          {selectedTable
                            ? `Table ${selectedTable.tableNo}`
                            : "Select Table"}
                        </span>
                      </button>
                    </div>

                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedCategory(category.id)}
                          className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black transition ${selectedCategory === category.id
                              ? "bg-slate-950 text-white ring-1 ring-white/15"
                              : darkMode
                                ? "bg-white/10 text-slate-200"
                                : "bg-[var(--brand-soft)] text-slate-700"
                            }`}
                        >
                          <span className="mr-1.5">{category.icon}</span>
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p
                        className={`text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Cart Controls
                      </p>
                      <span className="text-xs font-black text-[var(--brand-primary)]">
                        {cartLineCount} types · {cartTotalQuantity} qty ·{" "}
                        {formatMoney(total)} Ks
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          setMobileCartOpen(true);
                        }}
                        disabled={cart.length === 0}
                        className={`inline-flex items-center gap-2 rounded-2xl p-3 text-sm font-black disabled:opacity-40 ${darkMode ? "bg-white/10" : "bg-slate-100"}`}
                      >
                        <Receipt size={18} /> View Cart
                      </button>
                      {showKitchenAction && <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          void sendToKitchen();
                        }}
                        disabled={!hasPendingKitchenItems || kitchenSaving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 p-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        {kitchenSaving ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <ChefHat size={18} />
                        )}{" "}
                        Kitchen
                      </button>}
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          openPaymentDialog();
                        }}
                        disabled={!canPayOrder}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-primary)] p-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        <Wallet size={18} /> Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderControlsOpen(false);
                          requestClearOrder();
                        }}
                        disabled={cart.length === 0}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500/10 p-3 text-sm font-black text-red-500 disabled:opacity-40"
                      >
                        <Trash2 size={18} /> Clear Cart
                      </button>
                    </div>
                  </section>

                  <section>
                    <p
                      className={`mb-2 text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Staff Information
                    </p>
                    <div
                      className={`flex items-center gap-3 rounded-2xl p-3 ${darkMode ? "bg-white/10" : "bg-[var(--brand-soft)]"}`}
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-primary)] text-white">
                        <IdCard size={21} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {activeStaff.staffName}
                        </p>
                        <p
                          className={`mt-0.5 text-xs font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Staff ID: {activeStaff.staffId}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu Search Dialog */}
        <AnimatePresence>
          {searchDialogOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchDialogOpen(false)}
              className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-search-dialog-title"
                className={`w-full max-w-xl overflow-hidden rounded-[2rem] border shadow-2xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-[color-mix(in_srgb,var(--brand-accent)_6%,white)] text-slate-950"
                  }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/20 p-4 sm:p-5">
                  <div>
                    <h2
                      id="menu-search-dialog-title"
                      className="flex items-center gap-2 text-xl font-black"
                    >
                      <Search className="text-[var(--brand-accent)]" /> Search Menu
                    </h2>
                    <p
                      className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      အစားအသောက်အမည်၊ barcode သို့မဟုတ် SKU ဖြင့်ရှာပါ။
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchDialogOpen(false)}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${darkMode ? "bg-white/10" : "bg-slate-100"
                      }`}
                    aria-label="Close menu search"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="p-4 sm:p-5">
                  <div
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-2 ring-[var(--brand-border)] ${darkMode ? "bg-white/10" : "bg-white"
                      }`}
                  >
                    <Search size={20} className="shrink-0 text-[var(--brand-accent)]" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleBarcodeSearchEnter();
                      }}
                      placeholder="Search food, drink or barcode..."
                      className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-slate-400"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-slate-500/10 text-slate-500"
                        aria-label="Clear menu search"
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategory(category.id)}
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition ${selectedCategory === category.id
                            ? "bg-[var(--brand-primary)] text-white"
                            : darkMode
                              ? "bg-white/10 text-slate-200"
                              : "bg-[var(--brand-soft)] text-slate-700"
                          }`}
                      >
                        <span className="mr-1.5">{category.icon}</span>
                        {category.name}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSelectedCategory("all");
                      }}
                      className={`rounded-2xl px-4 py-3 text-sm font-black ${darkMode
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-700"
                        }`}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchDialogOpen(false)}
                      className="rounded-2xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
                    >
                      Show {filteredMenu.length} items
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {takeawaySearchOpen && (
            <motion.div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/70 p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <form onSubmit={findReadyTakeaway} role="dialog" aria-modal="true" aria-label="Find ready takeout"
                className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-950 shadow-2xl">
                <h2 className="text-xl font-black">Find Ready Takeout</h2>
                <p className="mt-1 text-sm">Kitchen ticket နံပါတ်ရိုက်ပြီး order ကိုရှာပါ။</p>
                <input autoFocus value={takeawayQuery} onChange={(event) => setTakeawayQuery(event.target.value)}
                  placeholder="Ticket number" className="mt-4 w-full rounded-xl border p-3 text-lg font-bold" />
                {takeawaySearchError && <p role="alert" className="mt-2 text-sm font-bold text-red-600">{takeawaySearchError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setTakeawaySearchOpen(false)} className="rounded-xl bg-slate-100 px-4 py-3 font-bold">Close</button>
                  <button type="submit" disabled={takeawaySearchLoading} className="rounded-xl bg-[var(--brand-primary)] px-4 py-3 font-bold text-white disabled:opacity-50">
                    {takeawaySearchLoading ? "Searching..." : "Find Order"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Choose order type before entering a new order. */}
        <AnimatePresence>
          {orderTypeOpen && activeStaff && (
            <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div role="dialog" aria-modal="true" aria-label="Choose order type" className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-950 shadow-2xl">
                <h2 className="mb-4 text-xl font-black">Choose Order Type</h2>
                <div className="grid gap-3">
                  {([ ["DINE_IN", "Dine In"], ["TAKEAWAY", "Takeout"], ["DELIVERY", "Delivery"] ] as const).map(([value, label]) => (
                    <button key={value} type="button" className="rounded-2xl bg-[var(--brand-soft)] p-4 text-left font-black hover:bg-[var(--brand-primary)] hover:text-white" onClick={() => {
                      setOrderType(value);
                      setOrderTypeChosen(true);
                      setOrderTypeOpen(false);
                      if (value === "DINE_IN") {
                        setSelectedTableId(null);
                        if (pendingMenuItem) setTableDialogOpen(true);
                      } else {
                        setSelectedTableId(null);

                      }
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Picker Dialog */}
        <AnimatePresence>
          {tableDialogOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!openOrderLoading) setTableDialogOpen(false);
              }}
              className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                onClick={(event) => event.stopPropagation()}
                className={`flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border shadow-2xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-[color-mix(in_srgb,var(--brand-accent)_6%,white)] text-slate-950"
                  }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/20 p-4 sm:p-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black">
                      <Armchair className="text-[var(--brand-accent)]" /> Select Table
                    </h2>
                    <p
                      className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Table ကိုရွေးပြီးလျှင် Menu Items screen ကို
                      ချက်ချင်းပြန်သွားပါမယ်။
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTableDialogOpen(false)}
                    disabled={openOrderLoading}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-40 ${darkMode ? "bg-white/10" : "bg-slate-100"
                      }`}
                    aria-label="Close table picker"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="border-b border-slate-200/20 p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 ${darkMode ? "bg-white/10" : "bg-slate-100"}`}
                    >
                      <Search size={17} className="text-slate-400" />
                      <input
                        value={tableSearch}
                        onChange={(event) => setTableSearch(event.target.value)}
                        placeholder="Search table number, name or floor..."
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                      />
                      {tableSearch && (
                        <button
                          type="button"
                          onClick={() => setTableSearch("")}
                          className="text-slate-400"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto">
                      {["ALL", "FREE", "BUSY", "RESERVED", "CLEANING"].map((statusKey) => (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => setTableStatusFilter(statusKey)}
                          className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black transition ${tableStatusFilter === statusKey
                              ? "bg-[var(--brand-primary)] text-white"
                              : darkMode
                                ? "bg-white/10 text-slate-200"
                                : "bg-white text-slate-700 ring-1 ring-slate-100"
                            }`}
                        >
                          {statusKey === "ALL" ? "All Tables" : statusKey}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                  {tableStatusError && (
                    <div role="alert" className="mb-3 rounded-2xl bg-red-500/10 p-4 text-sm font-bold text-red-500">
                      {tableStatusError}
                    </div>
                  )}
                  {openOrderLoading || tablesLoading ? (
                    <div className="grid min-h-[280px] place-items-center text-center">
                      <div>
                        <Loader2
                          className="mx-auto animate-spin text-[var(--brand-primary)]"
                          size={30}
                        />
                        <p className="mt-3 text-sm font-black">
                          {openOrderLoading
                            ? "Open order loading..."
                            : "Restaurant tables loading..."}
                        </p>
                      </div>
                    </div>
                  ) : tablesError ? (
                    <div className="rounded-2xl bg-red-500/10 p-4 text-sm font-black text-red-500">
                      {tablesError}
                    </div>
                  ) : tables.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-soft)] p-6 text-center text-sm font-black text-slate-600">
                      Table မရှိသေးပါ။ Restaurant Tables page မှာ table create
                      လုပ်ပါ။
                    </div>
                  ) : filteredTables.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--brand-border)] p-6 text-center text-sm font-black text-slate-500">
                      ဒီ search/filter နဲ့ကိုက်ညီတဲ့ table မရှိပါ။
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                      {filteredTables.map((table) => {
                        const active = selectedTableId === table.id;
                        const statusKey = (
                          table.status || "FREE"
                        ).toUpperCase();

                        const turnover = statusKey === "RESERVED" || statusKey === "CLEANING" || pendingReservedTableId === table.id;
                        return (
                          <div
                            key={table.id}
                            className={`rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active
                                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                                : statusKey === "BUSY"
                                  ? darkMode
                                    ? "border-red-400/30 bg-red-500/10 text-red-200"
                                    : "border-red-100 bg-red-50 text-red-700"
                                  : statusKey === "RESERVED" || statusKey === "CLEANING"
                                    ? darkMode
                                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                      : "border-amber-100 bg-amber-50 text-amber-700"
                                    : darkMode
                                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                                      : "border-slate-100 bg-white text-slate-700 hover:border-[var(--brand-border)]"
                              }`}
                          >
                            <button
                              type="button"
                              disabled={turnover || tableStatusSavingId !== null || paymentSaving}
                              onClick={() => void handleSelectTable(table)}
                              className="w-full text-left disabled:cursor-not-allowed"
                            >
                            <div className="flex items-center justify-between gap-2">
                              <Armchair size={19} />
                              <span
                                className={`rounded-full px-2 py-1 text-[9px] font-black ${active
                                    ? "bg-white/20"
                                    : darkMode
                                      ? "bg-white/10"
                                      : "bg-slate-950/5"
                                  }`}
                              >
                                {turnover ? statusKey : active ? "SELECTED" : statusKey}
                              </span>
                            </div>
                            <div className="mt-3 text-lg font-black">
                              {table.tableNo}
                            </div>
                            <div className="mt-1 truncate text-xs font-bold opacity-75">
                              {table.tableName ||
                                table.floorName ||
                                "Main floor"}
                            </div>
                            <div className="mt-1 text-xs font-bold opacity-75">
                              {table.seats || 0} seats
                            </div>
                            </button>
                            {turnover && (
                              <button
                                type="button"
                                onClick={() => void advanceTableStatus(table)}
                                disabled={tableStatusSavingId !== null || paymentSaving || openOrderLoading}
                                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-3 py-2.5 text-xs font-black text-white disabled:opacity-50"
                              >
                                {tableStatusSavingId === table.id && <Loader2 size={16} className="animate-spin" />}
                                {pendingReservedTableId === table.id ? "Retry RESERVED" : statusKey === "RESERVED" ? "RESERVED → CLEANING" : "CLEANING → FREE"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment Dialog */}
        <AnimatePresence>
          {paymentOpen && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4"
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
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Payment"
                className={`my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border p-4 shadow-2xl sm:p-5 lg:landscape:max-w-4xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-white text-slate-950"
                  }`}
              >
                <div className="flex shrink-0 items-start justify-between pb-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-2xl font-black">
                      <Wallet className="text-[var(--brand-accent)]" />
                      Payment
                    </h2>
                    <p
                      className={`mt-1 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"
                        }`}
                    >
                      {cart.reduce((sum, item) => sum + item.qty, 0)} items ·
                      Staff: {activeStaff.staffName}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (!paymentSaving) setPaymentOpen(false);
                    }}
                    disabled={paymentSaving}
                    className={`rounded-2xl p-3 ${darkMode ? "bg-white/10" : "bg-slate-100"
                      }`}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="lg:landscape:grid lg:landscape:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:landscape:items-start lg:landscape:gap-5">
                <div
                  className={`mt-4 overflow-hidden rounded-3xl border lg:landscape:mt-0 ${darkMode
                      ? "border-[var(--brand-border)] bg-gradient-to-br from-[var(--brand-soft)] to-transparent"
                      : "border-[var(--brand-border)] bg-gradient-to-br from-[var(--brand-soft)] to-[var(--brand-soft)]"
                    }`}
                >
                  <div className="px-5 py-5 text-center sm:py-6">
                    <p
                      className={`text-xs font-black uppercase tracking-[0.18em] ${darkMode ? "text-[var(--brand-accent)]" : "text-[var(--brand-primary)]"
                        }`}
                    >
                      ကျသင့်ငွေ
                    </p>
                    <p className="mt-1 text-4xl font-black tabular-nums text-[var(--brand-primary)] sm:text-5xl">
                      {formatMoney(total)}
                      <span className="ml-2 text-lg sm:text-xl">Ks</span>
                    </p>
                  </div>

                  <div
                    className={`grid grid-cols-4 border-t px-2 py-3 text-center text-[10px] font-bold sm:px-4 sm:text-xs ${darkMode
                        ? "border-white/10 bg-black/10 text-slate-300"
                        : "border-[var(--brand-border)] bg-white/60 text-slate-600"
                      }`}
                  >
                    <div>
                      <p className="uppercase text-slate-400">Subtotal</p>
                      <p className="mt-1 tabular-nums">
                        {formatMoney(subtotal)}
                      </p>
                    </div>
                    <div
                      className={`border-l ${darkMode ? "border-white/10" : "border-[var(--brand-border)]"}`}
                    >
                      <p className="uppercase text-slate-400">Service</p>
                      <p className="mt-1 tabular-nums">
                        {formatMoney(serviceCharge)}
                      </p>
                    </div>
                    <div
                      className={`border-l ${darkMode ? "border-white/10" : "border-[var(--brand-border)]"}`}
                    >
                      <p className="uppercase text-slate-400">Tax</p>
                      <p className="mt-1 tabular-nums">{formatMoney(tax)}</p>
                    </div>
                    <div
                      className={`border-l ${darkMode ? "border-white/10" : "border-[var(--brand-border)]"}`}
                    >
                      <p className="uppercase text-slate-400">Discount</p>
                      <p className="mt-1 tabular-nums">
                        -{formatMoney(discount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                <div className="mt-4 grid grid-cols-3 gap-2 lg:landscape:mt-0">
                  {[
                    {
                      key: "CASH" as PaymentMethod,
                      label: "Cash",
                      icon: <Banknote size={18} />,
                    },
                    {
                      key: "CARD" as PaymentMethod,
                      label: "Card",
                      icon: <CreditCard size={18} />,
                    },
                    {
                      key: "WALLET" as PaymentMethod,
                      label: "Wallet",
                      icon: <Wallet size={18} />,
                    },
                  ].map((method) => (
                    <button
                      key={method.key}
                      onClick={() => {
                        setPaymentMethod(method.key);
                        setPaymentError("");
                      }}
                      disabled={paymentSaving}
                      className={`rounded-2xl px-4 py-4 text-sm font-black transition ${paymentMethod === method.key
                          ? "bg-[var(--brand-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                          : darkMode
                            ? "bg-white/10 text-slate-200"
                            : "bg-[var(--brand-soft)] text-slate-700"
                        }`}
                    >
                      <span className="mx-auto mb-2 flex justify-center">
                        {method.icon}
                      </span>
                      {method.label}
                    </button>
                  ))}
                </div>

                <div
                  className={`mt-4 rounded-[1.5rem] p-4 ${darkMode ? "bg-white/5" : "bg-slate-50"
                    }`}
                >
                  {paymentMethod === "CASH" && (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="restaurant-cash-received"
                            className="text-sm font-black"
                          >
                            လက်ခံရရှိငွေ
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setCashReceived(String(total));
                              setPaymentError("");
                            }}
                            disabled={paymentSaving}
                            className="text-xs font-black text-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:opacity-50"
                          >
                            Exact amount
                          </button>
                        </div>
                        <input
                          ref={cashInputRef}
                          id="restaurant-cash-received"
                          value={cashReceived}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCashReceived(
                              value === ""
                                ? ""
                                : String(Math.max(0, Number(value))),
                            );
                            setPaymentError("");
                          }}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="0"
                          disabled={paymentSaving}
                          className={`mt-2 w-full rounded-2xl px-4 py-4 text-center text-3xl font-black tabular-nums outline-none transition focus:ring-2 focus:ring-[var(--brand-primary)] ${darkMode
                              ? "bg-slate-900 text-white ring-1 ring-white/10"
                              : "bg-white text-slate-950 ring-1 ring-slate-200"
                            }`}
                        />
                      </div>

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
                            className={`rounded-xl px-2 py-2.5 text-xs font-black tabular-nums transition disabled:opacity-50 ${cashNumber === amount
                                ? "bg-[var(--brand-primary)] text-white"
                                : darkMode
                                  ? "bg-white/10 text-slate-200 hover:bg-white/15"
                                  : "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-[var(--brand-soft)]"
                              }`}
                          >
                            {formatMoney(amount)} Ks
                          </button>
                        ))}
                      </div>

                      <div
                        className={`mt-3 overflow-hidden rounded-2xl border transition-colors duration-200 ${cashIsEnough
                            ? darkMode
                              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                              : "border-emerald-100 bg-emerald-50 text-emerald-600"
                            : darkMode
                              ? "border-red-400/20 bg-red-500/10 text-red-300"
                              : "border-red-100 bg-red-50 text-red-600"
                          }`}
                      >
                        <div
                          className={`flex items-center justify-between border-b px-4 py-3 text-sm font-black ${darkMode ? "border-white/10" : "border-black/5"
                            }`}
                        >
                          <span>ပေးထားငွေ</span>
                          <span className="text-lg tabular-nums">
                            {formatMoney(cashNumber)} Ks
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-4">
                          <span className="font-black">Change</span>
                          <span className="text-2xl font-black tabular-nums">
                            {formatMoney(
                              cashIsEnough ? change : remainingAmount,
                            )}{" "}
                            Ks
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {paymentMethod !== "CASH" && (
                    <div className="flex items-center justify-between text-sm font-black">
                      <span>Pay Amount</span>
                      <span className="text-2xl text-[var(--brand-primary)]">
                        {formatMoney(total)} Ks
                      </span>
                    </div>
                  )}
                </div>

                </div>
                </div>

                {paymentError && (
                  <div
                    className={`mt-4 rounded-2xl border p-4 text-sm font-black ${darkMode
                        ? "border-red-400/30 bg-red-500/10 text-red-200"
                        : "border-red-100 bg-red-50 text-red-600"
                      }`}
                  >
                    {paymentError}
                  </div>
                )}

                </div>
                <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200/20 pt-3">
                  <button
                    onClick={() => setPaymentOpen(false)}
                    disabled={paymentSaving}
                    className={`rounded-2xl px-4 py-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${darkMode
                        ? "bg-white/10 text-white"
                        : "bg-slate-100 text-slate-700"
                      }`}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={completePayment}
                    disabled={
                      paymentSaving || cart.length === 0 || !cashIsEnough
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-4 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
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

        {/* Payment Receipt Dialog */}
        <AnimatePresence>
          {paymentReceiptOpen && paymentReceiptData && (
            <motion.div
              className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePaymentReceiptDialog}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Payment complete"
                className={`flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border shadow-2xl lg:landscape:max-w-2xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-white text-slate-950"
                  }`}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                      <Receipt size={24} />
                    </div>

                    <div>
                      <h2 className="text-xl font-black">Payment Complete</h2>
                      <p
                        className={`text-xs font-bold ${darkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                      >
                        Receipt No: {paymentReceiptData.receiptNo}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={closePaymentReceiptDialog}
                    className={`grid h-10 w-10 place-items-center rounded-2xl transition ${darkMode
                        ? "bg-white/10 hover:bg-white/15"
                        : "bg-slate-100 hover:bg-slate-200"
                      }`}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                  <div
                    className={`rounded-[1.5rem] border p-4 ${darkMode
                        ? "border-white/10 bg-white/5"
                        : "border-slate-200 bg-slate-50"
                      }`}
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-black">
                        {shopReceiptInfo.shopName || "Restaurant"}
                      </h3>
                      {shopReceiptInfo.address && (
                        <p
                          className={`mt-1 text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"
                            }`}
                        >
                          {shopReceiptInfo.address}
                        </p>
                      )}
                      {shopReceiptInfo.phone && (
                        <p
                          className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"
                            }`}
                        >
                          Phone: {shopReceiptInfo.phone}
                        </p>
                      )}
                    </div>

                    <div className="my-4 border-t border-dashed border-slate-300" />

                    <div className="space-y-2 text-sm font-bold">
                      <div className="flex justify-between gap-4">
                        <span
                          className={
                            darkMode ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Order No
                        </span>
                        <span>{paymentReceiptData.orderNo}</span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span
                          className={
                            darkMode ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Date
                        </span>
                        <span>
                          {formatReceiptDate(paymentReceiptData.paidAt)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span
                          className={
                            darkMode ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Cashier
                        </span>
                        <span>{paymentReceiptData.cashierName}</span>
                      </div>

                      {paymentReceiptData.orderType === "DINE_IN" && (
                        <div className="flex justify-between gap-4">
                          <span
                            className={
                              darkMode ? "text-slate-400" : "text-slate-500"
                            }
                          >
                            Table
                          </span>
                          <span>{paymentReceiptData.tableNo || "-"}</span>
                        </div>
                      )}
                    </div>

                    <div className="my-4 border-t border-dashed border-slate-300" />

                    <div className="max-h-56 space-y-3 overflow-auto pr-1">
                      {paymentReceiptData.items.map((item, index) => (
                        <div
                          key={`${item.productId}-${index}`}
                          className="flex justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-black">
                              {item.itemName}
                            </p>
                            <p
                              className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"
                                }`}
                            >
                              {item.quantity} × {formatMoney(item.unitPrice)} Ks
                            </p>
                          </div>
                          <strong className="text-sm">
                            {formatMoney(item.totalPrice)} Ks
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="my-4 border-t border-dashed border-slate-300" />

                    <div className="space-y-2 text-sm font-bold">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>
                          {formatMoney(paymentReceiptData.subtotal)} Ks
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>
                          Service{" "}
                          {formatRatePercent(
                            paymentReceiptData.serviceChargeRatePercent,
                          )}
                          %
                        </span>
                        <span>
                          {formatMoney(paymentReceiptData.serviceCharge)} Ks
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>
                          Tax{" "}
                          {formatRatePercent(paymentReceiptData.taxRatePercent)}
                          %
                        </span>
                        <span>{formatMoney(paymentReceiptData.tax)} Ks</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Discount</span>
                        <span>
                          {formatMoney(paymentReceiptData.discount)} Ks
                        </span>
                      </div>

                      <div className="flex justify-between border-t border-slate-300 pt-3 text-lg font-black">
                        <span>Total</span>
                        <span>{formatMoney(paymentReceiptData.total)} Ks</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Payment</span>
                        <span>{paymentReceiptData.paymentMethod}</span>
                      </div>

                      {paymentReceiptData.paymentMethod === "CASH" && (
                        <>
                          <div className="flex justify-between">
                            <span>Cash Received</span>
                            <span>
                              {formatMoney(paymentReceiptData.cashReceived)} Ks
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Change</span>
                            <span>
                              {formatMoney(paymentReceiptData.changeAmount)} Ks
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {paymentError && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">
                      {paymentError}
                    </div>
                  )}

                </div>
                  <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-slate-200/20 p-4">
                    <button
                      onClick={closePaymentReceiptDialog}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${darkMode
                          ? "bg-white/10 hover:bg-white/15"
                          : "bg-slate-100 hover:bg-slate-200"
                        }`}
                    >
                      Close
                    </button>

                    <button
                      onClick={printPaymentReceipt}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] transition hover:brightness-110"
                    >
                      <Printer size={18} />
                      Print Receipt
                    </button>
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kitchen Success Dialog */}
        <AnimatePresence>
          {kitchenSuccessOpen && (
            <motion.div
              className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setKitchenSuccessOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md rounded-[2rem] border p-6 text-center shadow-2xl ${darkMode
                    ? "border-white/10 bg-slate-950 text-white"
                    : "border-[var(--brand-border)] bg-white text-slate-950"
                  }`}
              >
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--brand-primary)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)]">
                  <ChefHat size={38} />
                </div>

                <h2 className="mt-5 text-2xl font-black">Kitchen Order Sent</h2>

                <p
                  className={`mt-2 text-sm font-bold leading-6 ${darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                >
                  {kitchenSuccessMessage}
                </p>

                <div
                  className={`mt-5 rounded-2xl p-4 text-left ${darkMode ? "bg-white/5" : "bg-[var(--brand-soft)]"
                    }`}
                >
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Order Type</span>
                    <span className="text-[var(--brand-primary)]">{orderType}</span>
                  </div>

                  {orderType === "DINE_IN" && selectedTable && (
                    <div className="mt-2 flex items-center justify-between text-sm font-black">
                      <span>Table</span>
                      <span className="text-[var(--brand-primary)]">
                        {selectedTable.tableNo}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between text-sm font-black">
                    <span>Items</span>
                    <span className="text-[var(--brand-primary)]">
                      {kitchenSuccessItemCount}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm font-black">
                    <span>Total</span>
                    <span className="text-[var(--brand-primary)]">
                      {formatMoney(total)} Ks
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setKitchenSuccessOpen(false)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black ${darkMode
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                  >
                    Close
                  </button>

                  <button
                    onClick={() => {
                      setKitchenSuccessOpen(false);
                      window.location.href = "/dashboard/restaurant/kitchen";
                    }}
                    className="rounded-2xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] hover:brightness-110"
                  >
                    View Kitchen
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <RestaurantMobileCartBar
        darkMode={darkMode}
        dragging={Boolean(draggingMenuItemId)}
        itemCount={cart.reduce((sum, item) => sum + item.qty, 0)}
        total={total}
        onViewCart={() => setMobileCartOpen(true)}
        onKitchen={sendToKitchen}
        onPayment={openPaymentDialog}
        kitchenSaving={kitchenSaving}
        canSendToKitchen={showKitchenAction}
        canPayOrder={canPayOrder}
        kitchenDisabledMessage={kitchenDisabledMessage}
        addedFeedbackVisible={addedFeedbackVisible}
      />

      <AnimatePresence>
        {flyingItem && (
          <motion.div
            key={flyingItem.token}
            initial={{
              left: flyingItem.from.x,
              top: flyingItem.from.y,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              left: [
                flyingItem.from.x,
                (flyingItem.from.x + flyingItem.to.x) / 2,
                flyingItem.to.x,
              ],
              top: [
                flyingItem.from.y,
                Math.min(flyingItem.from.y, flyingItem.to.y) - 75,
                flyingItem.to.y,
              ],
              scale: [1, 0.78, 0.2],
              rotate: [0, -7, 5],
              opacity: [1, 1, 0.25],
            }}
            transition={{
              duration: 0.72,
              times: [0, 0.55, 1],
              ease: "easeInOut",
            }}
            onAnimationComplete={() => setFlyingItem(null)}
            className={`pointer-events-none fixed z-[100] flex w-40 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border p-2 shadow-2xl ${darkMode
                ? "border-[var(--brand-primary)] bg-slate-900 text-white"
                : "border-[var(--brand-border)] bg-white text-slate-950"
              }`}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand-soft)] text-xl">
              {flyingItem.item.image ? (
                <img
                  src={flyingItem.item.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                categories.find(
                  (category) => category.id === flyingItem.item.categoryId,
                )?.icon || "🍽️"
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black">
                {flyingItem.item.name}
              </p>
              <p className="text-xs font-black text-emerald-500">+1 Added</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DragOverlay>
        {draggingMenuItem && (
          <div
            className={`flex w-[280px] items-center gap-3 rounded-2xl border p-3 shadow-2xl ${darkMode
                ? "border-[var(--brand-primary)] bg-slate-900 text-white"
                : "border-[var(--brand-border)] bg-white text-slate-950"
              }`}
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand-soft)] text-2xl">
              {draggingMenuItem.image ? (
                <img
                  src={draggingMenuItem.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                categories.find((cat) => cat.id === draggingMenuItem.categoryId)
                  ?.icon || "🍽️"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {draggingMenuItem.name}
              </p>
              <p className="mt-1 text-lg font-black text-[var(--brand-primary)]">
                {formatMoney(draggingMenuItem.price)} Ks
              </p>
            </div>
            <span className="rounded-full bg-[var(--brand-primary)] px-2.5 py-1 text-[10px] font-black text-white">
              Dragging
            </span>
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}





