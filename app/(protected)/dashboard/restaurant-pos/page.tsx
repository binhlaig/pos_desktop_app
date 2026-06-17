"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import {
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
  available?: boolean;
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
  note?: string;
  modifiers: string[];
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
            ${
              item.modifiers?.length
                ? `<div class="muted small">${escapeHtml(item.modifiers.join(", "))}</div>`
                : ""
            }
            ${
              item.kitchenNote
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
        <title>Receipt ${escapeHtml(receipt.paymentNo)}</title>
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

          <div class="line"><span>Receipt No</span><strong>${escapeHtml(receipt.paymentNo)}</strong></div>
          <div class="line"><span>Order No</span><strong>${escapeHtml(receipt.orderNo)}</strong></div>
          <div class="line"><span>Date</span><strong>${escapeHtml(formatReceiptDate(receipt.paidAt))}</strong></div>
          <div class="line"><span>Order Type</span><strong>${escapeHtml(receipt.orderType)}</strong></div>
          ${
            receipt.orderType === "DINE_IN"
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
  const id =
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
    available: quantity === null ? true : quantity > 0,
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
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [openOrderLoading, setOpenOrderLoading] = useState(false);
  const [openOrderError, setOpenOrderError] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartPage, setCartPage] = useState(1);
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
  const [kitchenSaving, setKitchenSaving] = useState(false);
  const [kitchenError, setKitchenError] = useState("");
  const [kitchenSuccessOpen, setKitchenSuccessOpen] = useState(false);
  const [kitchenSuccessMessage, setKitchenSuccessMessage] = useState("");
  const [cashReceived, setCashReceived] = useState("");

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
  const cashNumber = Number(cashReceived || 0);
  const change = Math.max(cashNumber - total, 0);

  const cartTotalPages = Math.max(
    1,
    Math.ceil(cart.length / CART_ITEMS_PER_PAGE),
  );
  const safeCartPage = Math.min(cartPage, cartTotalPages);
  const cartPageStart =
    cart.length === 0 ? 0 : (safeCartPage - 1) * CART_ITEMS_PER_PAGE + 1;
  const cartPageEnd = Math.min(safeCartPage * CART_ITEMS_PER_PAGE, cart.length);

  const paginatedCart = useMemo(() => {
    const start = (safeCartPage - 1) * CART_ITEMS_PER_PAGE;
    return cart.slice(start, start + CART_ITEMS_PER_PAGE);
  }, [cart, safeCartPage]);

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

      const staffUrl = `${API_BASE}/api/staff/by-staff-id/${encodeURIComponent(nextStaffId)}`;
      logRequestAuth(staffUrl, usableToken);

      const res = await fetch(staffUrl, {
        method: "GET",
        headers: authHeaders(usableToken),
        cache: "no-store",
      });

      const authOrFeatureError = await getAuthOrFeatureError(res);
      if (authOrFeatureError) throw new Error(authOrFeatureError);

      if (res.status === 404) {
        throw new Error(STAFF_NOT_FOUND_MESSAGE);
      }

      const data = await readResponsePayload(res);
      const backendMessage = responsePayloadText(data);

      if (res.status === 500 && /staff not found/i.test(backendMessage)) {
        throw new Error(STAFF_NOT_FOUND_MESSAGE);
      }

      if (!res.ok) {
        throw new Error(backendMessage || STAFF_NOT_FOUND_MESSAGE);
      }

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

        return nextTables[0]?.id ?? null;
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

  async function fetchMenuItems() {
    setMenuLoading(true);
    setMenuError("");

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
    } catch (err) {
      setMenuItems([]);
      setSelectedCategory("all");
      setMenuError(
        err instanceof Error ? err.message : "Menu products loading error",
      );
    } finally {
      setMenuLoading(false);
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

      setCart(
        items
          .map((item) => mapOpenOrderItemToCartItem(asRecord(item)))
          .filter((item) => item.menuItemId && item.name),
      );
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

  async function handleSelectTable(table: RestaurantTable) {
    setOpenOrderLoading(true);
    setOpenOrderError("");

    try {
      const usableToken = ensurePageAccessToken(sessionAccessToken);

      if (!usableToken) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      if (selectedTableId && cart.length > 0) {
        await saveOpenOrder();
      }

      setSelectedTableId(table.id);
      await loadOpenOrderByTable(table.id);
      await fetchTables();
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

    window.addEventListener(SHOP_SETTINGS_UPDATED_EVENT, fetchOrderRates);

    return () => {
      window.removeEventListener(SHOP_SETTINGS_UPDATED_EVENT, fetchOrderRates);
    };
  }, [sessionAccessToken, status]);

  useEffect(() => {
    if (!activeStaff) {
      staffInputRef.current?.focus();
    }
  }, [activeStaff]);

  useEffect(() => {
    setCartPage((currentPage) => {
      const maxPage = Math.max(1, Math.ceil(cart.length / CART_ITEMS_PER_PAGE));

      return Math.min(currentPage, maxPage);
    });
  }, [cart.length]);

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
    menuItems.find(
      (product) =>
        product.id === cartItem.menuItemId ||
        (!!cartItem.dbId && product.dbId === cartItem.dbId) ||
        (!!cartItem.barcode && product.barcode === cartItem.barcode) ||
        (!!cartItem.sku && product.sku === cartItem.sku),
    );

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
    if (!item.available || item.stock === 0) {
      const message = `${item.name} stock မရှိပါ။ Add to cart လုပ်မရပါ။`;

      setKitchenError(message);
      setPaymentError(message);
      return;
    }

    setCart((prev) => {
      const found = prev.find((cartItem) => cartItem.menuItemId === item.id);

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

        setKitchenError("");
        setPaymentError("");

        return prev.map((cartItem) =>
          cartItem.menuItemId === item.id
            ? { ...cartItem, qty: cartItem.qty + 1 }
            : cartItem,
        );
      }

      setKitchenError("");
      setPaymentError("");

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          menuItemId: item.id,
          dbId: item.dbId,
          barcode: item.barcode,
          sku: item.sku,
          name: item.name,
          price: item.price,
          stock: item.stock,
          qty: 1,
          modifiers: [],
          note: "",
        },
      ];
    });
  };

  const updateQty = (id: string, action: "plus" | "minus") => {
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
    setCart([]);
    setCartPage(1);
    setDiscount(0);
    setCashReceived("");
    setPaymentOpen(false);
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
      items: cart.map((item) => ({
        menuItemId: Number.isFinite(Number(item.menuItemId))
          ? Number(item.menuItemId)
          : null,
        itemName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        modifiers: item.modifiers,
        kitchenNote: item.note || "",
      })),
    };

    try {
      setKitchenSaving(true);
      setKitchenError("");

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

      setKitchenSuccessMessage(
        ticketNo
          ? `Kitchen order ပို့ပြီးပါပြီ။ Ticket No: ${ticketNo}`
          : "Kitchen order ပို့ပြီးပါပြီ။",
      );
      setKitchenSuccessOpen(true);

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

    if (cart.length === 0) return;

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

      setPaymentReceiptData({
        ...paymentOrder,
        paymentNo,
        orderNo,
        paidAt: new Date().toISOString(),
        cashierName: activeStaff.staffName,
        cashierStaffId: activeStaff.staffId,
      });
      setPaymentReceiptOpen(true);
      setPaymentOpen(false);
      setMenuItems((prev) =>
        prev.map((menuItem) => {
          const cartItem = cart.find(
            (item) =>
              (!!item.dbId && item.dbId === menuItem.dbId) ||
              item.menuItemId === menuItem.id ||
              (!!item.barcode && item.barcode === menuItem.barcode) ||
              (!!item.sku && item.sku === menuItem.sku),
          );

          if (!cartItem || menuItem.stock === null) return menuItem;

          const nextStock = Math.max(menuItem.stock - cartItem.qty, 0);

          return {
            ...menuItem,
            stock: nextStock,
            available: nextStock > 0,
          };
        }),
      );
      setCart([]);
      setCartPage(1);
      setDiscount(0);
      setCashReceived("");
      setPaymentMethod("CASH");
      setPaymentError("");
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
        className={`min-h-screen ${
          darkMode
            ? "bg-slate-950 text-slate-50"
            : "bg-[#f8f3ea] text-slate-950"
        }`}
      >
        <BusinessTypeGuard allow="RESTAURANT" />

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
                  <ChefHat size={30} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
                    Restaurant Cashier POS
                  </h1>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Staff ID ဖြင့်ဝင်ပြီးမှ POS ကိုအသုံးပြုနိုင်ပါသည်။
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
                    className={`mt-1 text-sm font-semibold ${
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
    <main
      className={`min-h-screen ${
        darkMode ? "bg-slate-950 text-slate-50" : "bg-[#f8f3ea] text-slate-950"
      }`}
    >
      <BusinessTypeGuard allow="RESTAURANT" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 lg:p-6">
        {/* Compact top toolbar - no large Restaurant Cashier POS card */}
        <div
          className={`sticky top-0 z-30 -mx-4 -mt-4 px-4 py-3 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:px-6 ${
            darkMode
              ? "bg-slate-950/88"
              : "bg-[#f8f3ea]/88"
          }`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ring-1 ${
                  darkMode
                    ? "bg-white/10 text-white ring-white/10"
                    : "bg-white text-slate-900 ring-orange-100"
                }`}
              >
                <IdCard size={17} className="text-orange-500" />
                <span className="max-w-[150px] truncate">
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
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ring-1 ${
                  darkMode
                    ? "bg-white/10 text-white ring-white/10"
                    : "bg-white text-slate-900 ring-orange-100"
                }`}
              >
                <Receipt size={17} className="text-orange-500" />
                <span>{cart.length} items</span>
                <span className="text-orange-500">{formatMoney(total)} Ks</span>
              </div>

              {orderType === "DINE_IN" && selectedTable && (
                <div
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ring-1 ${
                    darkMode
                      ? "bg-white/10 text-white ring-white/10"
                      : "bg-white text-slate-900 ring-orange-100"
                  }`}
                >
                  <Armchair size={17} className="text-orange-500" />
                  <span>Table {selectedTable.tableNo}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDarkMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition ${
                  darkMode
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                {darkMode ? "Day" : "Night"}
              </button>

              <button
                onClick={sendToKitchen}
                disabled={cart.length === 0 || kitchenSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {kitchenSaving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ChefHat size={17} />
                )}
                Kitchen
              </button>

              <button
                onClick={() => {
                  setPaymentError("");
                  setPaymentOpen(true);
                }}
                disabled={cart.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wallet size={17} />
                Payment
              </button>

              <button
                onClick={clearOrder}
                disabled={cart.length === 0}
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  darkMode
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-white text-slate-900 ring-1 ring-orange-100 hover:bg-orange-50"
                }`}
              >
                <Trash2 size={17} />
                Clear
              </button>
            </div>
          </div>
        </div>

        <section className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          {/* Left side */}
          <div className="flex min-h-0 flex-col gap-4">
            {/* Order type + tables */}
            <div
              className={`rounded-[2rem] border p-4 shadow-sm ${
                darkMode
                  ? "border-white/10 bg-white/5"
                  : "border-orange-100 bg-white/80"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      key: "DINE_IN" as OrderType,
                      label: "Dine In",
                      icon: <Utensils size={18} />,
                    },
                    {
                      key: "TAKEAWAY" as OrderType,
                      label: "Takeaway",
                      icon: <ShoppingBag size={18} />,
                    },
                    {
                      key: "DELIVERY" as OrderType,
                      label: "Delivery",
                      icon: <Package size={18} />,
                    },
                  ].map((type) => (
                    <button
                      key={type.key}
                      onClick={() => setOrderType(type.key)}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                        orderType === type.key
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                          : darkMode
                            ? "bg-white/10 text-slate-200 hover:bg-white/15"
                            : "bg-orange-50 text-slate-700 hover:bg-orange-100"
                      }`}
                    >
                      {type.icon}
                      {type.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600">
                  <Clock3 size={18} />
                  Open order · {new Date().toLocaleTimeString()}
                </div>
              </div>

              {orderType === "DINE_IN" && (
                <div className="mt-4">
                  {openOrderLoading && (
                    <div
                      className={`mb-3 flex items-center gap-2 rounded-2xl border p-3 text-sm font-black ${
                        darkMode
                          ? "border-white/10 bg-white/5 text-slate-200"
                          : "border-orange-100 bg-white text-slate-600"
                      }`}
                    >
                      <Loader2 size={16} className="animate-spin" />
                      Open order loading...
                    </div>
                  )}

                  {openOrderError && (
                    <div
                      className={`mb-3 rounded-2xl border p-3 text-sm font-black ${
                        darkMode
                          ? "border-red-400/30 bg-red-500/10 text-red-200"
                          : "border-red-100 bg-red-50 text-red-600"
                      }`}
                    >
                      {openOrderError}
                    </div>
                  )}

                  {tablesLoading ? (
                    <div
                      className={`rounded-2xl border p-4 text-sm font-black ${
                        darkMode
                          ? "border-white/10 bg-white/5 text-slate-200"
                          : "border-orange-100 bg-white text-slate-600"
                      }`}
                    >
                      Restaurant tables loading...
                    </div>
                  ) : tablesError ? (
                    <div
                      className={`rounded-2xl border p-4 text-sm font-black ${
                        darkMode
                          ? "border-red-400/30 bg-red-500/10 text-red-200"
                          : "border-red-100 bg-red-50 text-red-600"
                      }`}
                    >
                      {tablesError}
                    </div>
                  ) : tables.length === 0 ? (
                    <div
                      className={`rounded-2xl border border-dashed p-4 text-sm font-black ${
                        darkMode
                          ? "border-white/10 bg-white/5 text-slate-300"
                          : "border-orange-200 bg-orange-50/70 text-slate-600"
                      }`}
                    >
                      Table မရှိသေးပါ။ Restaurant Tables page မှာ table create
                      လုပ်ပါ။
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {tables.map((table) => {
                        const active = selectedTableId === table.id;

                        return (
                          <button
                            key={table.id}
                            onClick={() => handleSelectTable(table)}
                            disabled={openOrderLoading}
                            className={`rounded-2xl border p-3 text-left transition ${
                              active
                                ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                                : table.status === "BUSY"
                                  ? darkMode
                                    ? "border-red-400/30 bg-red-500/10 text-red-200"
                                    : "border-red-100 bg-red-50 text-red-700"
                                  : table.status === "RESERVED"
                                    ? darkMode
                                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                      : "border-amber-100 bg-amber-50 text-amber-700"
                                    : darkMode
                                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                                      : "border-slate-100 bg-white text-slate-700 hover:bg-orange-50"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="flex items-center justify-between">
                              <Armchair size={18} />
                              {active && <Check size={17} />}
                            </div>
                            <div className="mt-2 text-lg font-black">
                              {table.tableNo}
                            </div>
                            <div className="mt-1 text-xs font-bold opacity-75">
                              {table.seats || 0} seats ·{" "}
                              {table.status || "FREE"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Categories + search */}
            <div
              className={`rounded-[2rem] border p-4 shadow-sm ${
                darkMode
                  ? "border-white/10 bg-white/5"
                  : "border-orange-100 bg-white/80"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black transition ${
                        selectedCategory === category.id
                          ? "bg-slate-950 text-white shadow-lg shadow-slate-900/20"
                          : darkMode
                            ? "bg-white/10 text-slate-200 hover:bg-white/15"
                            : "bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-orange-50"
                      }`}
                    >
                      <span className="mr-2">{category.icon}</span>
                      {category.name}
                    </button>
                  ))}
                </div>

                <div
                  className={`flex min-w-full items-center gap-2 rounded-2xl px-4 py-3 lg:min-w-[320px] ${
                    darkMode ? "bg-slate-900" : "bg-slate-100"
                  }`}
                >
                  <Search size={18} className="text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search menu..."
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Menu grid */}
            {menuLoading ? (
              <div
                className={`rounded-[1.75rem] border p-6 text-sm font-black ${
                  darkMode
                    ? "border-white/10 bg-white/5 text-slate-200"
                    : "border-orange-100 bg-white/80 text-slate-600"
                }`}
              >
                Loading menu items...
              </div>
            ) : menuError ? (
              <div
                className={`rounded-[1.75rem] border p-6 text-sm font-black ${
                  darkMode
                    ? "border-red-400/30 bg-red-500/10 text-red-200"
                    : "border-red-100 bg-red-50 text-red-600"
                }`}
              >
                {menuError}
              </div>
            ) : menuItems.length === 0 ? (
              <div
                className={`rounded-[1.75rem] border border-dashed p-6 text-sm font-black ${
                  darkMode
                    ? "border-white/10 bg-white/5 text-slate-300"
                    : "border-orange-200 bg-orange-50/70 text-slate-600"
                }`}
              >
                No menu products found. Please add products first.
              </div>
            ) : filteredMenu.length === 0 ? (
              <div
                className={`rounded-[1.75rem] border border-dashed p-6 text-sm font-black ${
                  darkMode
                    ? "border-white/10 bg-white/5 text-slate-300"
                    : "border-orange-200 bg-orange-50/70 text-slate-600"
                }`}
              >
                No menu products match your search.
              </div>
            ) : (
              <div
                className={`rounded-[2rem] border p-4 shadow-sm ${
                  darkMode
                    ? "border-white/10 bg-white/5"
                    : "border-orange-100 bg-white/80"
                }`}
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-black">
                      <Utensils className="text-orange-500" size={20} />
                      Menu Items
                    </h2>
                    <p
                      className={`mt-1 text-sm font-semibold ${
                        darkMode ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      Showing {menuPageStart}-{menuPageEnd} of{" "}
                      {filteredMenu.length}
                      {search.trim() ? " search results" : " menu items"} · Page{" "}
                      {safeMenuPage} / {menuTotalPages}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setMenuPage((page) => Math.max(1, page - 1))
                      }
                      disabled={safeMenuPage === 1}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        darkMode
                          ? "bg-white/10 text-white hover:bg-white/15"
                          : "bg-white text-slate-900 shadow-sm ring-1 ring-orange-100 hover:bg-orange-50"
                      }`}
                    >
                      <ChevronLeft size={18} />
                      Prev
                    </button>

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm font-black ${
                        darkMode
                          ? "bg-slate-900 text-slate-200"
                          : "bg-orange-50 text-orange-700"
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
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        darkMode
                          ? "bg-white/10 text-white hover:bg-white/15"
                          : "bg-white text-slate-900 shadow-sm ring-1 ring-orange-100 hover:bg-orange-50"
                      }`}
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {menuTotalPages > 1 && (
                  <div className="mb-4 flex gap-1.5">
                    {Array.from({ length: menuTotalPages }).map((_, index) => {
                      const page = index + 1;
                      const active = page === safeMenuPage;

                      return (
                        <button
                          key={page}
                          onClick={() => setMenuPage(page)}
                          className={`h-2 flex-1 rounded-full transition ${
                            active
                              ? "bg-orange-500"
                              : darkMode
                                ? "bg-white/10 hover:bg-white/20"
                                : "bg-orange-200 hover:bg-orange-300"
                          }`}
                          aria-label={`Go to menu page ${page}`}
                        />
                      );
                    })}
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
                      <motion.button
                        key={item.id}
                        layout
                        whileTap={{ scale: 0.97 }}
                        onClick={() => addToCart(item)}
                        disabled={!item.available}
                        className={`group rounded-[1.75rem] border p-4 text-left shadow-sm transition ${
                          darkMode
                            ? "border-white/10 bg-slate-900/60 hover:bg-white/10"
                            : "border-orange-100 bg-white hover:border-orange-200 hover:shadow-md"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-orange-100 text-3xl shadow-inner">
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
                              className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                item.available
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-red-500/10 text-red-600"
                              }`}
                            >
                              {item.stock === null
                                ? item.available
                                  ? "Available"
                                  : "Sold out"
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
                            className={`mt-1 line-clamp-1 text-sm font-semibold ${
                              darkMode ? "text-slate-300" : "text-slate-500"
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
                            <p className="text-xl font-black text-orange-500">
                              {formatMoney(item.price)} Ks
                            </p>
                            <p
                              className={`mt-1 flex items-center gap-1 truncate text-xs font-bold ${
                                darkMode ? "text-slate-400" : "text-slate-400"
                              }`}
                            >
                              <Clock3 size={13} />
                              {item.categoryId}
                            </p>
                          </div>

                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-orange-500">
                            <Plus size={20} />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Cart side */}
          <aside
            className={`flex min-h-[720px] flex-col rounded-[2rem] border shadow-sm ${
              darkMode
                ? "border-white/10 bg-white/5"
                : "border-orange-100 bg-white/90"
            }`}
          >
            <div className="border-b border-slate-200/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <Receipt className="text-orange-500" />
                    Current Order
                  </h2>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {orderType === "DINE_IN"
                      ? selectedTable
                        ? `${selectedTable.tableNo} · ${
                            selectedTable.seats || 0
                          } seats`
                        : "No table selected"
                      : orderType === "TAKEAWAY"
                        ? "Takeaway order"
                        : "Delivery order"}
                  </p>
                </div>

                <button
                  onClick={clearOrder}
                  className="rounded-2xl bg-red-500/10 p-3 text-red-500 transition hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4">
              <AnimatePresence initial={false} mode="wait">
                {cart.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`grid h-full min-h-[360px] place-items-center rounded-[1.75rem] border border-dashed p-8 text-center ${
                      darkMode
                        ? "border-white/10 bg-white/5"
                        : "border-orange-200 bg-orange-50/60"
                    }`}
                  >
                    <div>
                      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                        <Coffee size={36} />
                      </div>
                      <h3 className="mt-4 text-lg font-black">
                        Menu item ရွေးပါ
                      </h3>
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          darkMode ? "text-slate-300" : "text-slate-500"
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
                    className="space-y-3"
                  >
                    <div
                      className={`rounded-[1.5rem] border px-4 py-3 ${
                        darkMode
                          ? "border-white/10 bg-slate-900/70"
                          : "border-orange-100 bg-orange-50/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">
                            Items {cartPageStart}-{cartPageEnd}
                          </p>
                          <p
                            className={`mt-0.5 text-xs font-bold ${
                              darkMode ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            Total {cart.length} items · Page {safeCartPage} /{" "}
                            {cartTotalPages}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setCartPage((page) => Math.max(1, page - 1))
                            }
                            disabled={safeCartPage === 1}
                            className={`grid h-9 w-9 place-items-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              darkMode
                                ? "bg-white/10 text-white hover:bg-white/15"
                                : "bg-white text-slate-900 shadow-sm ring-1 ring-orange-100 hover:bg-orange-100"
                            }`}
                          >
                            <ChevronLeft size={18} />
                          </button>

                          <button
                            onClick={() =>
                              setCartPage((page) =>
                                Math.min(cartTotalPages, page + 1),
                              )
                            }
                            disabled={safeCartPage === cartTotalPages}
                            className={`grid h-9 w-9 place-items-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              darkMode
                                ? "bg-white/10 text-white hover:bg-white/15"
                                : "bg-white text-slate-900 shadow-sm ring-1 ring-orange-100 hover:bg-orange-100"
                            }`}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>

                      {cartTotalPages > 1 && (
                        <div className="mt-3 flex gap-1.5">
                          {Array.from({ length: cartTotalPages }).map(
                            (_, index) => {
                              const page = index + 1;
                              const active = page === safeCartPage;

                              return (
                                <button
                                  key={page}
                                  onClick={() => setCartPage(page)}
                                  className={`h-2 flex-1 rounded-full transition ${
                                    active
                                      ? "bg-orange-500"
                                      : darkMode
                                        ? "bg-white/10 hover:bg-white/20"
                                        : "bg-orange-200 hover:bg-orange-300"
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
                        className={`rounded-[1.5rem] border p-3 shadow-sm ${
                          darkMode
                            ? "border-white/10 bg-slate-900/70"
                            : "border-slate-100 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
                                <Utensils size={17} />
                              </div>

                              <div className="min-w-0">
                                <h3 className="truncate font-black">
                                  {item.name}
                                </h3>
                                <p className="mt-0.5 text-xs font-bold text-orange-500">
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

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div
                            className={`inline-flex items-center gap-2 rounded-2xl p-1 shadow-sm ring-1 ${
                              darkMode
                                ? "bg-white/10 ring-white/10"
                                : "bg-white ring-slate-100"
                            }`}
                          >
                            <button
                              onClick={() => updateQty(item.id, "minus")}
                              className={`grid h-8 w-8 place-items-center rounded-xl ${
                                darkMode
                                  ? "bg-slate-800 text-white"
                                  : "bg-slate-100 text-slate-900"
                              }`}
                            >
                              <Minus size={16} />
                            </button>

                            <span
                              className={`w-9 text-center text-sm font-black ${
                                darkMode ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {item.qty}
                            </span>

                            <button
                              onClick={() => updateQty(item.id, "plus")}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-orange-500 text-white"
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

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {modifiers.map((modifier) => {
                            const active = item.modifiers.includes(modifier);

                            return (
                              <button
                                key={modifier}
                                onClick={() =>
                                  toggleModifier(item.id, modifier)
                                }
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${
                                  active
                                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                                    : darkMode
                                      ? "bg-white/10 text-slate-300 hover:bg-white/15"
                                      : "bg-white text-slate-500 ring-1 ring-slate-100 hover:bg-orange-50"
                                }`}
                              >
                                {modifier}
                              </button>
                            );
                          })}
                        </div>

                        <input
                          value={item.note || ""}
                          onChange={(e) => updateNote(item.id, e.target.value)}
                          placeholder="Kitchen note..."
                          className={`mt-3 w-full rounded-2xl px-3 py-2 text-sm font-semibold outline-none ring-1 ${
                            darkMode
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

            <div className="border-t border-slate-200/20 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span
                    className={darkMode ? "text-slate-300" : "text-slate-500"}
                  >
                    Subtotal
                  </span>
                  <span>{formatMoney(subtotal)} Ks</span>
                </div>

                <div className="flex items-center justify-between text-sm font-bold">
                  <button
                    onClick={() => setServiceChargeEnabled((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-xl px-2 py-1 ${
                      serviceChargeEnabled
                        ? "bg-orange-500/10 text-orange-500"
                        : darkMode
                          ? "bg-white/10 text-slate-300"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <MoreHorizontal size={14} />
                    Service {formatRatePercent(serviceChargeRatePercent)}%
                  </button>
                  <span>{formatMoney(serviceCharge)} Ks</span>
                </div>

                <div className="flex items-center justify-between text-sm font-bold">
                  <span
                    className={darkMode ? "text-slate-300" : "text-slate-500"}
                  >
                    Tax {formatRatePercent(taxRatePercent)}%
                  </span>
                  <span>{formatMoney(tax)} Ks</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label
                    className={`flex items-center gap-2 text-sm font-bold ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    <BadgePercent size={16} />
                    Discount
                  </label>
                  <input
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value || 0))}
                    type="number"
                    className={`w-32 rounded-2xl px-3 py-2 text-right text-sm font-black outline-none ${
                      darkMode
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                    placeholder="0"
                  />
                </div>

                <div
                  className={`mt-3 rounded-[1.5rem] p-4 ${
                    darkMode ? "bg-orange-500/15" : "bg-orange-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black">Total</span>
                    <span className="text-3xl font-black text-orange-500">
                      {formatMoney(total)} Ks
                    </span>
                  </div>
                </div>
              </div>

              {kitchenError && (
                <div
                  className={`mt-4 rounded-2xl border p-3 text-sm font-black ${
                    darkMode
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-red-100 bg-red-50 text-red-600"
                  }`}
                >
                  {kitchenError}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={sendToKitchen}
                  disabled={cart.length === 0 || kitchenSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {kitchenSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <ChefHat size={18} />
                  )}
                  {kitchenSaving ? "Sending..." : "Kitchen"}
                </button>

                <button
                  onClick={() => {
                    const stockError = validateCartStock();

                    if (stockError) {
                      setPaymentError(stockError);
                      setKitchenError(stockError);
                      return;
                    }

                    setPaymentError("");
                    setPaymentOpen(true);
                  }}
                  disabled={cart.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Payment
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {/* Payment Dialog */}
      <AnimatePresence>
        {paymentOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
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
              className={`w-full max-w-xl rounded-[2rem] border p-5 shadow-2xl ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-black">
                    <Wallet className="text-orange-500" />
                    Payment
                  </h2>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      darkMode ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Order total ကို confirm လုပ်ပြီး payment complete လုပ်ပါ။
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!paymentSaving) setPaymentOpen(false);
                  }}
                  disabled={paymentSaving}
                  className={`rounded-2xl p-3 ${
                    darkMode ? "bg-white/10" : "bg-slate-100"
                  }`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
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
                    className={`rounded-2xl px-4 py-4 text-sm font-black transition ${
                      paymentMethod === method.key
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                        : darkMode
                          ? "bg-white/10 text-slate-200"
                          : "bg-orange-50 text-slate-700"
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
                className={`mt-5 rounded-[1.5rem] p-4 ${
                  darkMode ? "bg-white/5" : "bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total Amount</span>
                  <span className="text-2xl font-black text-orange-500">
                    {formatMoney(total)} Ks
                  </span>
                </div>

                {paymentMethod === "CASH" && (
                  <>
                    <div className="mt-4">
                      <label className="text-sm font-black">
                        Cash Received
                      </label>
                      <input
                        value={cashReceived}
                        onChange={(e) => {
                          setCashReceived(e.target.value);
                          setPaymentError("");
                        }}
                        type="number"
                        placeholder="Enter cash amount"
                        disabled={paymentSaving}
                        className={`mt-2 w-full rounded-2xl px-4 py-4 text-xl font-black outline-none ${
                          darkMode
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-950 ring-1 ring-slate-100"
                        }`}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-500/10 p-4 text-emerald-600">
                      <span className="font-black">Change</span>
                      <span className="text-2xl font-black">
                        {formatMoney(change)} Ks
                      </span>
                    </div>
                  </>
                )}
              </div>

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
                  disabled={paymentSaving || cart.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                  {paymentSaving ? "Saving..." : "Complete Payment"}
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
                      Receipt No: {paymentReceiptData.paymentNo}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closePaymentReceiptDialog}
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
                      {shopReceiptInfo.shopName || "Restaurant"}
                    </h3>
                    {shopReceiptInfo.address && (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {shopReceiptInfo.address}
                      </p>
                    )}
                    {shopReceiptInfo.phone && (
                      <p
                        className={`text-xs font-semibold ${
                          darkMode ? "text-slate-400" : "text-slate-500"
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
                          <p className="text-sm font-black">{item.itemName}</p>
                          <p
                            className={`text-xs font-semibold ${
                              darkMode ? "text-slate-400" : "text-slate-500"
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
                      <span>{formatMoney(paymentReceiptData.subtotal)} Ks</span>
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
                        {formatRatePercent(paymentReceiptData.taxRatePercent)}%
                      </span>
                      <span>{formatMoney(paymentReceiptData.tax)} Ks</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>{formatMoney(paymentReceiptData.discount)} Ks</span>
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

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={closePaymentReceiptDialog}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      darkMode
                        ? "bg-white/10 hover:bg-white/15"
                        : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    Close
                  </button>

                  <button
                    onClick={printPaymentReceipt}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
                  >
                    <Printer size={18} />
                    Print Receipt
                  </button>
                </div>
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
              className={`w-full max-w-md rounded-[2rem] border p-6 text-center shadow-2xl ${
                darkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-orange-100 bg-white text-slate-950"
              }`}
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30">
                <ChefHat size={38} />
              </div>

              <h2 className="mt-5 text-2xl font-black">Kitchen Order Sent</h2>

              <p
                className={`mt-2 text-sm font-bold leading-6 ${
                  darkMode ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {kitchenSuccessMessage}
              </p>

              <div
                className={`mt-5 rounded-2xl p-4 text-left ${
                  darkMode ? "bg-white/5" : "bg-orange-50"
                }`}
              >
                <div className="flex items-center justify-between text-sm font-black">
                  <span>Order Type</span>
                  <span className="text-orange-500">{orderType}</span>
                </div>

                {orderType === "DINE_IN" && selectedTable && (
                  <div className="mt-2 flex items-center justify-between text-sm font-black">
                    <span>Table</span>
                    <span className="text-orange-500">
                      {selectedTable.tableNo}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-sm font-black">
                  <span>Items</span>
                  <span className="text-orange-500">{cart.length}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm font-black">
                  <span>Total</span>
                  <span className="text-orange-500">
                    {formatMoney(total)} Ks
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setKitchenSuccessOpen(false)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    darkMode
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
                  className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
                >
                  View Kitchen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
