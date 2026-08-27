



"use client"

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  CreditCard,
  Eye,
  Loader2,
  PackageCheck,
  Printer,
  RefreshCcw,
  Search,
  ShoppingBag,
  Store,
  Table2,
  Trash2,
  Utensils,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { getStoredOwnerToken } from "@/lib/auth-storage";

type OrderStatus =
  | "ALL"
  | "OPEN"
  | "NEW"
  | "COOKING"
  | "READY"
  | "DONE"
  | "PAID"
  | "CANCELLED";

type OrderType = "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod = "CASH" | "CARD" | "WALLET" | string;

type OrderItem = {
  id?: number | string;
  productId?: number | string | null;
  menuItemId?: number | string | null;
  itemName: string;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
  modifiers?: string[] | string | null;
  kitchenNote?: string | null;
  status?: string | null;
};

type RestaurantOrder = {
  id: number | string;
  orderNo?: string | null;
  ticketNo?: string | null;
  paymentNo?: string | null;
  orderType?: string | null;
  tableId?: number | null;
  tableNo?: string | null;
  status?: string | null;
  priority?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  cashierName?: string | null;
  paymentMethod?: PaymentMethod | null;
  subtotal?: number | null;
  serviceCharge?: number | null;
  tax?: number | null;
  discount?: number | null;
  total?: number | null;
  cashReceived?: number | null;
  changeAmount?: number | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  paidAt?: string | null;
  items?: OrderItem[];
};

type RestaurantPayment = {
  id: number | string;
  orderId: number | string | null;
  orderNo?: string | null;
  paymentNo: string | null;
  paymentMethod: string | null;
  amount: number;
  cashReceived: number;
  changeAmount: number;
  status: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
};

type KitchenTicket = {
  orderId: number | string | null;
  orderNo: string | null;
  ticketNo: string | null;
  status: string | null;
  priority: string | null;
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
const INVALID_TOKEN_MESSAGE = "Login token မမှန်ပါ။ ပြန် login ဝင်ပါ။";
const FEATURE_DISABLED_MESSAGE =
  "ဒီဆိုင် plan မှာ Restaurant feature မဖွင့်ထားပါ။ Super Admin > Shop Feature Control မှာ Restaurant Feature Gate ကို ON လုပ်ပါ။";

const PAGE_SIZE = 10;

const statusOptions: OrderStatus[] = [
  "ALL",
  "OPEN",
  "NEW",
  "COOKING",
  "READY",
  "DONE",
  "PAID",
  "CANCELLED",
];

const orderTypeOptions: OrderType[] = [
  "ALL",
  "DINE_IN",
  "TAKEAWAY",
  "DELIVERY",
];

const statusStyle: Record<
  OrderStatus,
  {
    label: string;
    pill: string;
    icon: React.ElementType;
  }
> = {
  ALL: {
    label: "All Orders",
    pill: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Store,
  },
  OPEN: {
    label: "Open",
    pill: "bg-blue-50 text-blue-700 ring-blue-100",
    icon: Clock3,
  },
  NEW: {
    label: "New",
    pill: "bg-sky-50 text-sky-700 ring-sky-100",
    icon: ChefHat,
  },
  COOKING: {
    label: "Cooking",
    pill: "bg-orange-50 text-orange-700 ring-orange-100",
    icon: Utensils,
  },
  READY: {
    label: "Ready",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    icon: PackageCheck,
  },
  DONE: {
    label: "Done",
    pill: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: CheckCircle2,
  },
  PAID: {
    label: "Paid",
    pill: "bg-green-50 text-green-700 ring-green-100",
    icon: Banknote,
  },
  CANCELLED: {
    label: "Cancelled",
    pill: "bg-red-50 text-red-700 ring-red-100",
    icon: XCircle,
  },
};

function getAccessToken() {
  if (typeof window === "undefined") return null;

  const ownerToken = getStoredOwnerToken()?.trim();
  if (ownerToken) return ownerToken;

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

async function getApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;

      if (typeof record.message === "string") return record.message;
      if (typeof record.error === "string") return record.error;
    }
  }

  const text = await res.text().catch(() => "");
  return text || fallback;
}

async function getAuthOrFeatureError(res: Response) {
  if (res.status === 401) return INVALID_TOKEN_MESSAGE;
  if (res.status !== 403) return "";

  const data = await res
    .clone()
    .json()
    .catch(() => null);
  const text =
    data && typeof data === "object"
      ? JSON.stringify(data)
      : await res
          .clone()
          .text()
          .catch(() => "");

  if (/FEATURE_DISABLED|feature|allowRestaurant|allowKitchen|allowTableOrder|plan|subscription|disabled|not enabled|not allowed/i.test(text)) {
    return FEATURE_DISABLED_MESSAGE;
  }

  return INVALID_TOKEN_MESSAGE;
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

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(
        value.replace(/,/g, "").replace(/\b(?:ks|mmk)\b/gi, "").trim(),
      );

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function normalizeStatus(value?: string | null): OrderStatus {
  const upper = String(value || "OPEN").toUpperCase();

  if (
    upper === "OPEN" ||
    upper === "NEW" ||
    upper === "COOKING" ||
    upper === "READY" ||
    upper === "DONE" ||
    upper === "PAID" ||
    upper === "CANCELLED"
  ) {
    return upper;
  }

  return "OPEN";
}

function normalizeOrderType(value?: string | null): Exclude<OrderType, "ALL"> {
  const upper = String(value || "DINE_IN").toUpperCase();

  if (upper === "TAKEAWAY" || upper === "DELIVERY") return upper;

  return "DINE_IN";
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDate(value: string | null | undefined, yyyyMmDd: string) {
  if (!yyyyMmDd) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return formatDateInput(date) === yyyyMmDd;
}

function parseModifiers(value: OrderItem["modifiers"]) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      // fallback below
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeOrderModifiers(value: unknown): OrderItem["modifiers"] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value;

  return null;
}

function unwrapOrdersPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  const root = asRecord(data);
  const directLists = [
    root.orders,
    root.payments,
    root.tickets,
    root.content,
    root.items,
    root.results,
  ];

  for (const list of directLists) {
    if (Array.isArray(list)) return list;
  }

  for (const key of ["data", "result"]) {
    const nested = root[key];
    if (Array.isArray(nested)) return nested;

    const nestedRecord = asRecord(nested);
    for (const list of [
      nestedRecord.orders,
      nestedRecord.payments,
      nestedRecord.tickets,
      nestedRecord.content,
      nestedRecord.items,
      nestedRecord.results,
    ]) {
      if (Array.isArray(list)) return list;
    }
  }

  return [];
}

function mapOrderItem(raw: unknown): OrderItem {
  const item = asRecord(raw);

  const quantity = pickNumber(item, ["quantity", "qty", "count"]) || 1;
  const unitPrice = pickNumber(item, [
    "unitPrice",
    "unit_price",
    "price",
    "productPrice",
    "product_price",
  ]);
  const totalPrice =
    pickNumber(item, ["totalPrice", "total_price", "lineTotal", "line_total"]) ||
    unitPrice * quantity;

  return {
    id: pickString(item, ["id", "itemId", "item_id"]) || crypto.randomUUID(),
    productId: pickString(item, ["productId", "product_id"]),
    menuItemId: pickString(item, ["menuItemId", "menu_item_id"]),
    itemName:
      pickString(item, [
        "itemName",
        "item_name",
        "productName",
        "product_name",
        "name",
        "title",
      ]) || "Unnamed item",
    quantity,
    unitPrice,
    totalPrice,
    modifiers: normalizeOrderModifiers(item.modifiers ?? item.modifier),
    kitchenNote:
      pickString(item, ["kitchenNote", "kitchen_note", "note", "remark"]) ||
      null,
    status: pickString(item, ["status"]) || null,
  };
}

function mapOrder(raw: unknown): RestaurantOrder {
  const outerRecord = asRecord(raw);
  const nestedOrder = asRecord(outerRecord.order);
  const nestedPayment = asRecord(outerRecord.payment);
  const record = {
    ...nestedOrder,
    ...outerRecord,
  };

  const itemsSource = [record.items, record.orderItems, record.order_items].find(
    Array.isArray,
  ) || [];

  const items = itemsSource.map(mapOrderItem);

  const subtotal =
    pickNumber(record, ["subtotal", "subTotal", "sub_total"]) ||
    items.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0,
    );

  const serviceCharge = pickNumber(record, [
    "serviceCharge",
    "service_charge",
  ]);
  const tax = pickNumber(record, ["tax", "taxAmount", "tax_amount"]);
  const discount = pickNumber(record, ["discount", "discountAmount"]);
  const total =
    pickNumber(record, ["total", "grandTotal", "grand_total", "amount"]) ||
    Math.max(subtotal + serviceCharge + tax - discount, 0);

  return {
    id: pickString(record, ["id", "orderId", "order_id"]) || crypto.randomUUID(),
    orderNo:
      pickString(record, ["orderNo", "order_no"]) ||
      pickString(record, ["ticketNo", "ticket_no"]) ||
      pickString(record, ["paymentNo", "payment_no"]),
    ticketNo: pickString(record, ["ticketNo", "ticket_no"]) || null,
    paymentNo:
      pickString(record, ["paymentNo", "payment_no"]) ||
      pickString(nestedPayment, ["paymentNo", "payment_no"]) ||
      null,
    orderType:
      pickString(record, ["orderType", "order_type", "type"]) || "DINE_IN",
    tableId: pickNumber(record, ["tableId", "table_id"]) || null,
    tableNo: pickString(record, ["tableNo", "table_no", "tableName"]) || null,
    status: pickString(record, ["status"]) || "OPEN",
    priority: pickString(record, ["priority"]) || "NORMAL",
    staffId: pickString(record, ["staffId", "staff_id"]) || null,
    staffName:
      pickString(record, ["staffName", "staff_name", "cashierName"]) || null,
    cashierName:
      pickString(record, ["cashierName", "cashier_name", "staffName"]) || null,
    paymentMethod:
      pickString(record, ["paymentMethod", "payment_method"]) ||
      pickString(nestedPayment, ["paymentMethod", "payment_method", "method"]) ||
      null,
    subtotal,
    serviceCharge,
    tax,
    discount,
    total,
    cashReceived:
      pickNumber(record, ["cashReceived", "cash_received"]) ||
      pickNumber(nestedPayment, ["cashReceived", "cash_received"]),
    changeAmount:
      pickNumber(record, ["changeAmount", "change_amount"]) ||
      pickNumber(nestedPayment, ["changeAmount", "change_amount"]),
    note: pickString(record, ["note", "remark"]) || null,
    createdAt:
      pickString(record, ["createdAt", "created_at", "orderedAt"]) || null,
    updatedAt: pickString(record, ["updatedAt", "updated_at"]) || null,
    paidAt:
      pickString(record, ["paidAt", "paid_at"]) ||
      pickString(nestedPayment, ["paidAt", "paid_at", "createdAt", "created_at"]) ||
      null,
    items,
  };
}

function mapPayment(raw: unknown): RestaurantPayment {
  const outer = asRecord(raw);
  const record = { ...asRecord(outer.payment), ...outer };

  return {
    id: pickString(record, ["id", "paymentId", "payment_id"]) || crypto.randomUUID(),
    orderId: pickString(record, ["orderId", "order_id"]) || null,
    orderNo: pickString(record, ["orderNo", "order_no"]) || null,
    paymentNo: pickString(record, ["paymentNo", "payment_no"]) || null,
    paymentMethod:
      pickString(record, ["paymentMethod", "payment_method", "method"]) || null,
    amount: pickNumber(record, ["amount", "total"]),
    cashReceived: pickNumber(record, ["cashReceived", "cash_received"]),
    changeAmount: pickNumber(record, ["changeAmount", "change_amount"]),
    status: pickString(record, ["status", "paymentStatus", "payment_status"]) || null,
    paidAt:
      pickString(record, ["paidAt", "paid_at", "createdAt", "created_at"]) || null,
    createdAt: pickString(record, ["createdAt", "created_at"]) || null,
  };
}

function mapKitchenTicket(raw: unknown): KitchenTicket {
  const outer = asRecord(raw);
  const record = { ...asRecord(outer.ticket), ...outer };

  return {
    orderId: pickString(record, ["orderId", "order_id"]) || null,
    orderNo: pickString(record, ["orderNo", "order_no"]) || null,
    ticketNo: pickString(record, ["ticketNo", "ticket_no"]) || null,
    status: pickString(record, ["status", "kitchenStatus", "kitchen_status"]) || null,
    priority: pickString(record, ["priority"]) || null,
  };
}

function enrichOrders(
  orders: RestaurantOrder[],
  payments: RestaurantPayment[],
  tickets: KitchenTicket[],
) {
  const paymentByOrderId = new Map<string, RestaurantPayment>();
  const paymentByOrderNo = new Map<string, RestaurantPayment>();
  const ticketByOrderId = new Map<string, KitchenTicket>();
  const ticketByOrderNo = new Map<string, KitchenTicket>();

  payments.forEach((payment) => {
    if (payment.orderId != null) paymentByOrderId.set(String(payment.orderId), payment);
    if (payment.orderNo) paymentByOrderNo.set(payment.orderNo, payment);
  });
  tickets.forEach((ticket) => {
    if (ticket.orderId != null) ticketByOrderId.set(String(ticket.orderId), ticket);
    if (ticket.orderNo) ticketByOrderNo.set(ticket.orderNo, ticket);
  });

  return orders.map((order) => {
    const payment =
      paymentByOrderId.get(String(order.id)) ||
      (order.orderNo ? paymentByOrderNo.get(order.orderNo) : undefined);
    const ticket =
      ticketByOrderId.get(String(order.id)) ||
      (order.orderNo ? ticketByOrderNo.get(order.orderNo) : undefined);

    return {
      ...order,
      ticketNo: ticket?.ticketNo ?? order.ticketNo ?? null,
      priority: ticket?.priority ?? order.priority ?? null,
      paymentNo: payment?.paymentNo ?? order.paymentNo ?? null,
      paymentMethod: payment?.paymentMethod ?? order.paymentMethod ?? null,
      cashReceived: payment?.cashReceived ?? order.cashReceived ?? 0,
      changeAmount: payment?.changeAmount ?? order.changeAmount ?? 0,
      paidAt: payment?.paidAt ?? order.paidAt ?? null,
      status:
        String(payment?.status || "").toUpperCase() === "PAID"
          ? "PAID"
          : order.status,
    };
  });
}

function getPaymentLabel(order: RestaurantOrder) {
  if (order.paymentMethod) return order.paymentMethod.toUpperCase();
  if (String(order.status).toUpperCase() === "PAID" || order.paymentNo) return "PAID";
  return "UNPAID";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildOrderReceiptHtml(order: RestaurantOrder) {
  const orderLabel = order.orderNo || order.paymentNo || order.ticketNo || `ORD-${order.id}`;
  const itemRows = (order.items || [])
    .map((item) => {
      const lineTotal =
        Number(item.totalPrice || 0) ||
        Number(item.unitPrice || 0) * Number(item.quantity || 1);
      const itemModifiers = parseModifiers(item.modifiers);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.itemName)}</strong>
            ${itemModifiers.length ? `<small>${escapeHtml(itemModifiers.join(", "))}</small>` : ""}
            ${item.kitchenNote ? `<small>Note: ${escapeHtml(item.kitchenNote)}</small>` : ""}
          </td>
          <td class="center">${escapeHtml(item.quantity || 1)}</td>
          <td class="right">${formatMoney(item.unitPrice)}</td>
          <td class="right">${formatMoney(lineTotal)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(orderLabel)}</title>
      <style>
        * { box-sizing: border-box; }
        body { width: 80mm; margin: 0 auto; padding: 5mm; color: #111827; font-family: Arial, sans-serif; font-size: 11px; }
        h1 { margin: 0; text-align: center; font-size: 18px; }
        .subtitle { margin: 4px 0 12px; text-align: center; color: #6b7280; }
        .line { display: flex; justify-content: space-between; gap: 12px; margin: 5px 0; }
        .divider { margin: 10px 0; border-top: 1px dashed #9ca3af; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 2px; vertical-align: top; border-bottom: 1px dashed #e5e7eb; }
        th { text-align: left; font-size: 10px; }
        small { display: block; margin-top: 2px; color: #6b7280; }
        .center { text-align: center; }
        .right { text-align: right; }
        .total { margin-top: 6px; padding-top: 8px; border-top: 1px solid #111827; font-size: 14px; font-weight: 800; }
        @page { size: 80mm auto; margin: 0; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <h1>Restaurant Receipt</h1>
      <div class="subtitle">Re-print</div>
      <div class="line"><span>Order</span><strong>${escapeHtml(orderLabel)}</strong></div>
      <div class="line"><span>Payment No</span><strong>${escapeHtml(order.paymentNo || "-")}</strong></div>
      <div class="line"><span>Date</span><strong>${escapeHtml(formatDateTime(order.paidAt || order.createdAt || order.updatedAt))}</strong></div>
      <div class="line"><span>Type</span><strong>${escapeHtml(normalizeOrderType(order.orderType))}</strong></div>
      ${normalizeOrderType(order.orderType) === "DINE_IN" ? `<div class="line"><span>Table</span><strong>${escapeHtml(order.tableNo || "-")}</strong></div>` : ""}
      <div class="line"><span>Staff</span><strong>${escapeHtml(order.staffName || order.cashierName || "-")}</strong></div>
      <div class="line"><span>Staff ID</span><strong>${escapeHtml(order.staffId || "-")}</strong></div>
      <div class="divider"></div>
      <table>
        <thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr></thead>
        <tbody>${itemRows || `<tr><td colspan="4" class="center">No order items</td></tr>`}</tbody>
      </table>
      <div class="line"><span>Subtotal</span><strong>${formatMoney(order.subtotal)} Ks</strong></div>
      <div class="line"><span>Service</span><strong>${formatMoney(order.serviceCharge)} Ks</strong></div>
      <div class="line"><span>Tax</span><strong>${formatMoney(order.tax)} Ks</strong></div>
      <div class="line"><span>Discount</span><strong>${formatMoney(order.discount)} Ks</strong></div>
      <div class="line total"><span>Total</span><span>${formatMoney(order.total)} Ks</span></div>
      <div class="line"><span>Payment</span><strong>${escapeHtml(getPaymentLabel(order))}</strong></div>
      <div class="line"><span>Cash Received</span><strong>${formatMoney(order.cashReceived)} Ks</strong></div>
      <div class="line"><span>Change</span><strong>${formatMoney(order.changeAmount)} Ks</strong></div>
      <div class="line"><span>Paid At</span><strong>${escapeHtml(formatDateTime(order.paidAt))}</strong></div>
    </body>
  </html>`;
}

function reprintOrder(order: RestaurantOrder) {
  const printWindow = window.open("", "_blank", "width=420,height=760");

  if (!printWindow) {
    window.alert("Print window ကို browser က block လုပ်ထားပါတယ်။ Pop-up ကို Allow လုပ်ပါ။");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildOrderReceiptHtml(order));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function OrderTypeIcon({
  orderType,
  size,
  className,
}: {
  orderType?: string | null;
  size: number;
  className?: string;
}) {
  const type = normalizeOrderType(orderType);

  if (type === "DINE_IN") return <Table2 size={size} className={className} />;
  if (type === "TAKEAWAY") return <Coffee size={size} className={className} />;
  return <ShoppingBag size={size} className={className} />;
}

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("ALL");
  const [selectedType, setSelectedType] = useState<OrderType>("ALL");
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateInput(new Date()),
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] =
    useState<RestaurantOrder | null>(null);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return orders.filter((order) => {
      const status = normalizeStatus(order.status);
      const type = normalizeOrderType(order.orderType);
      const dateValue = order.paidAt || order.createdAt || order.updatedAt;

      const matchStatus =
        selectedStatus === "ALL" ? true : selectedStatus === status;

      const matchType = selectedType === "ALL" ? true : selectedType === type;

      const matchDate = isSameDate(dateValue, selectedDate);

      const matchSearch =
        !keyword ||
        order.orderNo?.toLowerCase().includes(keyword) ||
        order.ticketNo?.toLowerCase().includes(keyword) ||
        order.paymentNo?.toLowerCase().includes(keyword) ||
        order.tableNo?.toLowerCase().includes(keyword) ||
        order.staffName?.toLowerCase().includes(keyword) ||
        order.cashierName?.toLowerCase().includes(keyword) ||
        order.items?.some((item) =>
          item.itemName.toLowerCase().includes(keyword),
        );

      return matchStatus && matchType && matchDate && matchSearch;
    });
  }, [orders, selectedStatus, selectedType, selectedDate, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page, totalPages]);

  const summary = useMemo(() => {
    const result = {
      totalOrders: filteredOrders.length,
      paidOrders: 0,
      activeOrders: 0,
      cancelledOrders: 0,
      revenue: 0,
    };

    filteredOrders.forEach((order) => {
      const status = normalizeStatus(order.status);

      if (status === "PAID" || status === "DONE") {
        result.paidOrders += 1;
        result.revenue += Number(order.total || 0);
      }

      if (
        status === "OPEN" ||
        status === "NEW" ||
        status === "COOKING" ||
        status === "READY"
      ) {
        result.activeOrders += 1;
      }

      if (status === "CANCELLED") {
        result.cancelledOrders += 1;
      }
    });

    return result;
  }, [filteredOrders]);

  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      ALL: 0,
      OPEN: 0,
      NEW: 0,
      COOKING: 0,
      READY: 0,
      DONE: 0,
      PAID: 0,
      CANCELLED: 0,
    };

    orders.forEach((order) => {
      const dateValue = order.paidAt || order.createdAt || order.updatedAt;

      if (!isSameDate(dateValue, selectedDate)) return;

      const status = normalizeStatus(order.status);
      counts[status] += 1;
      counts.ALL += 1;
    });

    return counts;
  }, [orders, selectedDate]);

  /* Legacy cross-endpoint loader retained in source history only.
  async function fetchOrders() {
    setLoading(true);
    setError("");

    try {
      const token = getAccessToken();

      if (!token) {
        throw new Error(MISSING_TOKEN_MESSAGE);
      }

      const urls = [
        `${API_BASE}/api/restaurant/kitchen/tickets`,
        `${API_BASE}/api/restaurant/orders`,
        `${API_BASE}/api/restaurant/payments`,
      ];

      const loadedPayloads: unknown[] = [];
      let lastError = "";

      for (const url of urls) {
        const res = await fetch(url, {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }).catch(() => null);

        if (!res) {
          lastError = "Server ချိတ်ဆက်မရပါ။";
          continue;
        }

        const authOrFeatureError = await getAuthOrFeatureError(res);
        if (authOrFeatureError) {
          if (res.status === 401) throw new Error(authOrFeatureError);
          lastError = authOrFeatureError;
          continue;
        }

        if (res.ok) {
          loadedPayloads.push(await res.json().catch(() => []));
          continue;
        }

        lastError = await getApiErrorMessage(
          res,
          "Restaurant orders များကိုယူမရပါ။",
        );
      }

      if (loadedPayloads.length === 0) {
        throw new Error(lastError || "Restaurant orders များကိုယူမရပါ။");
      }

      const mappedOrders = mergeRestaurantOrders(
        loadedPayloads.flatMap(unwrapOrdersPayload).map(mapOrder),
      )
        .sort((a, b) => {
          const aTime = new Date(
            a.paidAt || a.createdAt || a.updatedAt || 0,
          ).getTime();
          const bTime = new Date(
            b.paidAt || b.createdAt || b.updatedAt || 0,
          ).getTime();

          return bTime - aTime;
        });

      setOrders(mappedOrders);
      setPage(1);
    } catch (err) {
      setOrders([]);
      setError(
        err instanceof Error ? err.message : "Restaurant orders loading error",
      );
    } finally {
      setLoading(false);
    }
  }

  */
  async function fetchCanonicalOrders() {
    setLoading(true);
    setError("");

    try {
      if (!getAccessToken()) throw new Error(MISSING_TOKEN_MESSAGE);

      async function loadEndpoint(url: string) {
        const res = await fetch(url, {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }).catch(() => null);

        if (!res) throw new Error("Server is unavailable.");

        const authOrFeatureError = await getAuthOrFeatureError(res);
        if (authOrFeatureError) throw new Error(authOrFeatureError);
        if (!res.ok) {
          throw new Error(
            await getApiErrorMessage(res, "Restaurant data could not be loaded."),
          );
        }

        return res.json().catch(() => []);
      }

      // Orders are authoritative: failure here prevents rendering partial records.
      const orderPayload = await loadEndpoint(
        `${API_BASE}/api/restaurant/orders`,
      );
      const [paymentResult, ticketResult] = await Promise.allSettled([
        loadEndpoint(`${API_BASE}/api/restaurant/payments`),
        loadEndpoint(`${API_BASE}/api/restaurant/kitchen/tickets`),
      ]);

      const authoritativeOrders = Array.from(
        new Map(
          unwrapOrdersPayload(orderPayload)
            .map(mapOrder)
            .map((order) => [String(order.id), order] as const),
        ).values(),
      );
      const payments =
        paymentResult.status === "fulfilled"
          ? unwrapOrdersPayload(paymentResult.value).map(mapPayment)
          : [];
      const tickets =
        ticketResult.status === "fulfilled"
          ? unwrapOrdersPayload(ticketResult.value).map(mapKitchenTicket)
          : [];
      const warnings: string[] = [];

      if (paymentResult.status === "rejected") {
        warnings.push("Payment information is temporarily unavailable.");
      }
      if (ticketResult.status === "rejected") {
        warnings.push("Kitchen ticket information is temporarily unavailable.");
      }

      const mappedOrders = enrichOrders(authoritativeOrders, payments, tickets).sort(
        (a, b) =>
          new Date(b.paidAt || b.createdAt || b.updatedAt || 0).getTime() -
          new Date(a.paidAt || a.createdAt || a.updatedAt || 0).getTime(),
      );

      setOrders(mappedOrders);
      setError(warnings.join(" "));
      setPage(1);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Restaurant orders loading error");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSelectedStatus("ALL");
    setSelectedType("ALL");
    setSelectedDate(formatDateInput(new Date()));
    setSearch("");
    setPage(1);
  }

  useEffect(() => {
    fetchCanonicalOrders();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, selectedType, selectedDate, search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <main className="min-h-screen bg-[#f8f3ea] p-4 text-slate-950 sm:p-6 lg:p-8">
      <BusinessTypeGuard allow="RESTAURANT" />

      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-[2rem] border border-orange-100 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600 ring-1 ring-orange-100">
                <ChefHat size={14} />
                Restaurant Dashboard
              </div>

              <h1 className="mt-3 flex items-center gap-3 text-2xl font-black tracking-tight sm:text-3xl">
                <Store className="text-orange-500" size={32} />
                Restaurant Orders
              </h1>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Dine-in, takeaway, delivery orders များကို status / date /
                search ဖြင့် စစ်ကြည့်နိုင်တဲ့ page ဖြစ်ပါတယ်။
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                <Trash2 size={17} />
                Reset
              </button>

              <button
                onClick={fetchCanonicalOrders}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Orders"
            value={summary.totalOrders}
            subtitle="Filtered orders"
            icon={CalendarDays}
            tone="orange"
          />

          <SummaryCard
            title="Active"
            value={summary.activeOrders}
            subtitle="Open / cooking"
            icon={Clock3}
            tone="blue"
          />

          <SummaryCard
            title="Completed"
            value={summary.paidOrders}
            subtitle="Done / paid"
            icon={CheckCircle2}
            tone="green"
          />

          <SummaryCard
            title="Revenue"
            value={`${formatMoney(summary.revenue)} Ks`}
            subtitle="From done / paid"
            icon={Banknote}
            tone="slate"
          />
        </section>

        <section className="rounded-[2rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order no, ticket no, table, staff, item..."
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400"
              />
            </div>

            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as OrderType)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black outline-none"
            >
              {orderTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All Types" : type}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black outline-none"
            />

            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-sm font-black text-orange-600 ring-1 ring-orange-100">
              {filteredOrders.length} orders
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((status) => {
              const meta = statusStyle[status];
              const Icon = meta.icon;
              const active = selectedStatus === status;

              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    active
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "bg-orange-50 text-slate-700 hover:bg-orange-100"
                  }`}
                >
                  <Icon size={17} />
                  {meta.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {statusCounts[status]}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
        </section>

        {loading ? (
          <section className="grid min-h-[420px] place-items-center rounded-[2rem] border border-white/80 bg-white/85 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-black text-slate-500">
              <Loader2 className="animate-spin text-orange-500" size={24} />
              Loading restaurant orders...
            </div>
          </section>
        ) : filteredOrders.length === 0 ? (
          <section className="grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed border-orange-200 bg-orange-50/70 p-8 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-orange-500 text-white">
                <Store size={36} />
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-900">
                Order မရှိသေးပါ
              </h3>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                Filter ကိုပြောင်းကြည့်ပါ သို့မဟုတ် Restaurant POS မှ order
                အသစ်တင်ပါ။
              </p>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Orders Table
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Showing page {Math.min(page, totalPages)} of {totalPages}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={17} />
                  Prev
                </button>

                <button
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Table / Type</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order) => {
                    const status = normalizeStatus(order.status);
                    const meta = statusStyle[status];
                    return (
                      <tr key={`order-${order.id}`} className="bg-white hover:bg-slate-50">
                        <td className="px-4 py-4 align-top">
                          <div className="font-black text-slate-950">
                            {order.orderNo || order.ticketNo || `ORD-${order.id}`}
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-400">
                            ID: {order.id}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="inline-flex items-center gap-2 font-black text-slate-800">
                            <OrderTypeIcon
                              orderType={order.orderType}
                              size={17}
                              className="text-orange-500"
                            />
                            {normalizeOrderType(order.orderType) === "DINE_IN"
                              ? order.tableNo || "No table"
                              : normalizeOrderType(order.orderType)}
                          </div>

                          <div className="mt-1 text-xs font-bold text-slate-400">
                            {normalizeOrderType(order.orderType)}
                          </div>
                        </td>

                      
                        {/* <td className="max-w-[300px] px-4 py-4 align-top">
                          {order.items?.length ? (
                            <div className="space-y-1.5">
                              {order.items.slice(0, 3).map((item, index) => (
                                <div
                                  key={`${item.id || index}`}
                                  className="flex items-start justify-between gap-3 text-sm"
                                >
                                  <span className="font-bold text-slate-700">
                                    {item.quantity || 1}x {item.itemName}
                                  </span>
                                  <span className="shrink-0 font-black text-slate-500">
                                    {formatMoney(
                                      item.totalPrice ||
                                        Number(item.unitPrice || 0) *
                                          Number(item.quantity || 1),
                                    )}{" "}
                                    Ks
                                  </span>
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <div className="text-xs font-black text-slate-400">
                                  +{order.items.length - 3} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm font-bold text-slate-400">
                              No order items
                            </div>
                          )}

                          <div className="mt-1 text-xs font-black text-orange-500">
                            {order.items?.reduce(
                              (sum, item) => sum + Number(item.quantity || 0),
                              0,
                            ) || 0}{" "}
                            items
                          </div>
                        </td> */}

                        <td className="px-4 py-4 align-top">
                          <div className="font-bold text-slate-700">
                            {order.staffName || order.cashierName || "-"}
                          </div>

                          {order.staffId && (
                            <div className="mt-1 text-xs font-bold text-slate-400">
                              {order.staffId}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <PaymentBadge order={order} />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-black text-slate-950">
                            {formatMoney(order.total)} Ks
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.pill}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-slate-600">
                          {formatDateTime(
                            order.paidAt || order.createdAt || order.updatedAt,
                          )}
                        </td>

                        <td className="px-4 py-4 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                            >
                              <Eye size={16} />
                              View
                            </button>
                            <button
                              onClick={() => reprintOrder(order)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-600"
                            >
                              <Printer size={16} />
                              Re-print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-bold text-slate-500">
                Showing{" "}
                {filteredOrders.length === 0
                  ? 0
                  : (Math.min(page, totalPages) - 1) * PAGE_SIZE + 1}
                {" - "}
                {Math.min(
                  Math.min(page, totalPages) * PAGE_SIZE,
                  filteredOrders.length,
                )}{" "}
                of {filteredOrders.length}
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  const active = pageNumber === page;

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setPage(pageNumber)}
                      className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${
                        active
                          ? "bg-orange-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailDialog
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  tone: "orange" | "blue" | "green" | "slate";
}) {
  const toneClass = {
    orange: "bg-orange-500 text-white shadow-orange-500/25",
    blue: "bg-blue-500 text-white shadow-blue-500/25",
    green: "bg-emerald-500 text-white shadow-emerald-500/25",
    slate: "bg-slate-950 text-white shadow-slate-900/20",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{value}</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>
        </div>

        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl shadow-lg ${toneClass}`}
        >
          <Icon size={23} />
        </div>
      </div>
    </motion.div>
  );
}

function PaymentBadge({ order }: { order: RestaurantOrder }) {
  const normalized = getPaymentLabel(order);

  const Icon =
    normalized === "CASH"
      ? Banknote
      : normalized === "CARD"
        ? CreditCard
        : normalized === "WALLET"
          ? Wallet
          : Clock3;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
      <Icon size={13} />
      {normalized}
    </span>
  );
}

function OrderDetailDialog({
  order,
  onClose,
}: {
  order: RestaurantOrder;
  onClose: () => void;
}) {
  const status = normalizeStatus(order.status);
  const meta = statusStyle[status];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              {order.orderNo || order.ticketNo || `ORD-${order.id}`}
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatDateTime(order.paidAt || order.createdAt || order.updatedAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => reprintOrder(order)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-600"
            >
              <Printer size={17} />
              Re-print
            </button>
            <button
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
              <p className="text-xs font-black uppercase text-orange-600">
                Type
              </p>
              <div className="mt-2 flex items-center gap-2 font-black text-slate-900">
                <OrderTypeIcon
                  orderType={order.orderType}
                  size={18}
                  className="text-orange-500"
                />
                {normalizeOrderType(order.orderType)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-xs font-black uppercase text-slate-500">
                Table
              </p>
              <p className="mt-2 font-black text-slate-900">
                {order.tableNo || "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-xs font-black uppercase text-slate-500">
                Status
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.pill}`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-slate-100">
            <div className="border-b border-slate-100 p-4">
              <h3 className="font-black text-slate-950">Order Items</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {(order.items || []).length === 0 && (
                <div className="p-6 text-center text-sm font-bold text-slate-400">
                  ဒီ order အတွက် items data မရှိပါ။
                </div>
              )}

              {(order.items || []).map((item, index) => {
                const modifiers = parseModifiers(item.modifiers);

                return (
                  <div
                    key={`${item.id || index}`}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-50 text-sm font-black text-orange-600">
                          x{item.quantity || 1}
                        </span>

                        <p className="font-black text-slate-950">
                          {item.itemName}
                        </p>
                      </div>

                      {modifiers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {modifiers.map((modifier) => (
                            <span
                              key={modifier}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600"
                            >
                              {modifier}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.kitchenNote && (
                        <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                          Note: {item.kitchenNote}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-500">
                        {formatMoney(item.unitPrice)} Ks
                      </p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatMoney(item.totalPrice)} Ks
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-slate-100">
              <h3 className="font-black text-slate-950">Staff / Note</h3>

              <div className="mt-3 space-y-2 text-sm font-bold">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Staff</span>
                  <span>{order.staffName || order.cashierName || "-"}</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Staff ID</span>
                  <span>{order.staffId || "-"}</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Payment</span>
                  <PaymentBadge order={order} />
                </div>
              </div>

              {order.note && (
                <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold text-slate-600">
                  {order.note}
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-4 text-white">
              <h3 className="font-black">Payment Summary</h3>

              <div className="mt-4 space-y-3 text-sm font-bold">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-300">Subtotal</span>
                  <span>{formatMoney(order.subtotal)} Ks</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-300">Service</span>
                  <span>{formatMoney(order.serviceCharge)} Ks</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-300">Tax</span>
                  <span>{formatMoney(order.tax)} Ks</span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-300">Discount</span>
                  <span>{formatMoney(order.discount)} Ks</span>
                </div>

                <div className="flex justify-between gap-3 border-t border-white/15 pt-3 text-lg font-black">
                  <span>Total</span>
                  <span>{formatMoney(order.total)} Ks</span>
                </div>

                {String(order.paymentMethod || "").toUpperCase() === "CASH" && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-300">Cash Received</span>
                      <span>{formatMoney(order.cashReceived)} Ks</span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-300">Change</span>
                      <span>{formatMoney(order.changeAmount)} Ks</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
