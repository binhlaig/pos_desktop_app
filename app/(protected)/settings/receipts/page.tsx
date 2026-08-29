"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
  Package,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  User,
  Wallet,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { code128SvgDataUri } from "@/lib/code128";

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

type ReceiptRow = {
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
  shopPhone?: string | null;
  shopSecondPhone?: string | null;

  createdByUserId?: number | null;
  createdByUsername?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;

  status?: string | null;
  createdAt: string;

  items: ReceiptItem[];
};

type ShopPrintAd = {
  id?: number | null;
  title?: string | null;
  message?: string | null;
  active?: boolean;
};

type ShopPrintInfo = {
  shopName: string;
  address: string;
  phone: string;
  secondPhone: string;
  footerMessage: string;
  ads: ShopPrintAd[];
};

const SHOP_PRINT_INFO_STORAGE_KEY = "receipt_shop_print_info";

const DEFAULT_SHOP_PRINT_INFO: ShopPrintInfo = {
  shopName: "Clear Blue Light POS",
  address: "",
  phone: "",
  secondPhone: "",
  footerMessage: "Thank you for shopping with us!",
  ads: [],
};

const EMPTY_RECEIPT_PLACEHOLDERS = [
  "Shop address မထည့်ရသေးပါ",
  "Phone No မထည့်ရသေးပါ",
];

const jpy = (n: number) =>
  Math.round(Number(n || 0)).toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
  });

function clean(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) return "";
  if (EMPTY_RECEIPT_PLACEHOLDERS.includes(text)) return "";
  if (text.includes("မထည့်ရသေးပါ")) return "";

  return text;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = clean(value);

    if (text) return text;
  }

  return "";
}

function getAccessToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  ).trim();
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();

  return token
    ? {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      }
    : {};
}

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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeShopPrintInfo(data: unknown): ShopPrintInfo {
  const root = isRecord(data) ? data : {};
  const payload =
    isRecord(root.data)
      ? root.data
      : isRecord(root.setting)
      ? root.setting
      : isRecord(root.receiptSetting)
      ? root.receiptSetting
      : isRecord(root.receipt_setting)
      ? root.receipt_setting
      : root;

  const shop = isRecord(payload.shop) ? payload.shop : {};

  return {
    shopName:
      firstText(
        payload?.shopName,
        payload?.shop_name,
        payload?.name,
        shop.shopName,
        shop.shop_name,
        shop.name
      ) || DEFAULT_SHOP_PRINT_INFO.shopName,

    address: firstText(
      payload?.address,
      payload?.shopAddress,
      payload?.shop_address,
      shop.address,
      shop.shopAddress,
      shop.shop_address
    ),

    phone: firstText(
      payload?.phone,
      payload?.shopPhone,
      payload?.shop_phone,
      shop.phone,
      shop.shopPhone,
      shop.shop_phone
    ),

    secondPhone: firstText(
      payload?.secondPhone,
      payload?.second_phone,
      payload?.shopSecondPhone,
      payload?.shop_second_phone,
      shop.secondPhone,
      shop.second_phone
    ),

    footerMessage:
      firstText(payload?.footerMessage, payload?.footer_message) ||
      DEFAULT_SHOP_PRINT_INFO.footerMessage,

    ads: Array.isArray(payload?.ads)
      ? payload.ads
          .filter(isRecord)
          .filter((ad) => ad.active !== false && clean(ad.message))
          .map((ad) => ({
            id: Number(ad.id) || null,
            title: clean(ad.title),
            message: clean(ad.message),
            active: ad.active !== false,
          }))
      : [],
  };
}

function getStoredShopPrintInfo() {
  if (typeof window === "undefined") return DEFAULT_SHOP_PRINT_INFO;

  try {
    return normalizeShopPrintInfo(
      JSON.parse(localStorage.getItem(SHOP_PRINT_INFO_STORAGE_KEY) || "{}")
    );
  } catch {
    return DEFAULT_SHOP_PRINT_INFO;
  }
}

function extractReceiptRows(data: unknown): unknown[] {
  const root = isRecord(data) ? data : {};
  const rootData = isRecord(root.data) ? root.data : {};
  const rootReceipts = isRecord(root.receipts) ? root.receipts : {};

  const candidates = [
    data,
    root.content,
    root.receipts,
    root.data,
    rootData.content,
    rootData.receipts,
    rootReceipts.content,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function apiErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string") return clean(data) || fallback;
  if (!isRecord(data)) return fallback;

  const details = Array.isArray(data.details)
    ? data.details.join(", ")
    : data.details;

  return firstText(data.message, data.error, details, fallback);
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("json")
    ? response.json().catch(() => null)
    : response.text().catch(() => "");
}

function normalizeReceipts(data: unknown): ReceiptRow[] {
  const rows = extractReceiptRows(data);

  return rows.filter(isRecord).map((r) => {
    const shop = isRecord(r.shop) ? r.shop : {};
    const receiptSetting =
      isRecord(r.receiptSetting)
        ? r.receiptSetting
        : isRecord(r.receipt_setting)
        ? r.receipt_setting
        : {};

    return {
      id: Number(r.id),
      receiptNo: String(r.receiptNo || r.receipt_no || ""),

      staffId: firstText(r.staffId, r.staff_id),
      staffName: firstText(r.staffName, r.staff_name),
      staffRole: firstText(r.staffRole, r.staff_role),

      paymentMethod: firstText(r.paymentMethod, r.payment_method) || "cash",
      subtotal: Number(r.subtotal || 0),
      taxAmount: Number(r.taxAmount ?? r.tax_amount ?? 0),
      discountPercent: Number(r.discountPercent ?? r.discount_percent ?? 0),
      grandTotal: Number(r.grandTotal ?? r.grand_total ?? 0),
      cashGiven: Number(r.cashGiven ?? r.cash_given ?? 0),
      changeAmount: Number(r.changeAmount ?? r.change_amount ?? 0),

      shopId: Number(r.shopId ?? r.shop_id ?? shop.id) || null,
      shopCode: firstText(r.shopCode, r.shop_code, shop.code, shop.shopCode),
      shopName: firstText(
        r.shopName,
        r.shop_name,
        shop.name,
        shop.shopName,
        receiptSetting.shopName,
        receiptSetting.shop_name
      ),
      shopAddress: firstText(
        r.shopAddress,
        r.shop_address,
        r.address,
        shop.address,
        shop.shopAddress,
        receiptSetting.address,
        receiptSetting.shopAddress,
        receiptSetting.shop_address
      ),
      shopPhone: firstText(
        r.shopPhone,
        r.shop_phone,
        r.phone,
        shop.phone,
        shop.shopPhone,
        receiptSetting.phone,
        receiptSetting.shopPhone,
        receiptSetting.shop_phone
      ),
      shopSecondPhone: firstText(
        r.shopSecondPhone,
        r.shop_second_phone,
        r.secondPhone,
        r.second_phone,
        shop.secondPhone,
        shop.second_phone,
        receiptSetting.secondPhone,
        receiptSetting.second_phone
      ),

      createdByUserId:
        Number(r.createdByUserId ?? r.created_by_user_id) || null,
      createdByUsername: firstText(
        r.createdByUsername,
        r.created_by_username
      ),
      createdByName: firstText(r.createdByName, r.created_by_name),
      createdByRole: firstText(r.createdByRole, r.created_by_role),

      status: firstText(r.status) || "COMPLETED",
      createdAt: firstText(r.createdAt, r.created_at),

      items: Array.isArray(r.items)
        ? r.items.filter(isRecord).map((item) => ({
            id: Number(item.id),
            productId: firstText(item.productId, item.product_id),
            barcode: firstText(item.barcode),
            sku: firstText(item.sku),
            productName: firstText(item.productName, item.product_name),
            qty: Number(item.qty ?? item.quantity ?? 0),
            price: Number(item.price || 0),
            discountPercent: Number(
              item.discountPercent ?? item.discount_percent ?? 0
            ),
            taxable: Boolean(item.taxable),
            lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
          }))
        : [],
    };
  });
}

export default function ReceiptsPage() {
  const router = useRouter();

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shopPrintInfo, setShopPrintInfo] = useState<ShopPrintInfo>(
    DEFAULT_SHOP_PRINT_INFO
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredReceipts = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return receipts;

    return receipts.filter((r) => {
      return (
        r.receiptNo.toLowerCase().includes(q) ||
        String(r.staffId || "").toLowerCase().includes(q) ||
        String(r.staffName || "").toLowerCase().includes(q) ||
        String(r.paymentMethod || "").toLowerCase().includes(q) ||
        String(r.shopName || "").toLowerCase().includes(q) ||
        String(r.createdByUsername || "").toLowerCase().includes(q) ||
        r.items.some((item) =>
          String(item.productName || "").toLowerCase().includes(q)
        )
      );
    });
  }, [receipts, query]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));

  const paginatedReceipts = useMemo(() => {
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;

    return filteredReceipts.slice(start, end);
  }, [filteredReceipts, currentPage, pageSize, totalPages]);

  const pageStart =
    filteredReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const pageEnd = Math.min(currentPage * pageSize, filteredReceipts.length);

  const stats = useMemo(() => {
    const totalSales = filteredReceipts.reduce((sum, r) => sum + r.grandTotal, 0);
    const totalReceipts = filteredReceipts.length;
    const totalItems = filteredReceipts.reduce(
      (sum, r) => sum + r.items.reduce((a, item) => a + item.qty, 0),
      0
    );

    return { totalSales, totalReceipts, totalItems };
  }, [filteredReceipts]);

  useEffect(() => {
    void loadReceipts();
    void loadShopPrintInfo();
    // These loaders intentionally run once when this page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedId(null);
  }, [query, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      setExpandedId(null);
    }
  }, [currentPage, totalPages]);

  async function loadReceipts() {
    try {
      setLoading(true);
      setError("");

      const token = getAccessToken();
      if (!token) {
        throw new Error("Login session not found. Please login again.");
      }

      const res = await fetch("/api/pos/receipts", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeaders(),
        },
        cache: "no-store",
      });

      const data = await readResponseBody(res);

      if (!res.ok) {
        throw new Error(
          apiErrorMessage(data, `Receipts load failed (${res.status}).`)
        );
      }

      setReceipts(normalizeReceipts(data));
      setCurrentPage(1);
      setExpandedId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Receipts load failed.";

      setError(message);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchShopPrintInfo() {
    const urls = ["/api/receipt-settings/my-shop"];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...authHeaders(),
          },
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          continue;
        }

        const normalized = normalizeShopPrintInfo(data);

        localStorage.setItem(
          SHOP_PRINT_INFO_STORAGE_KEY,
          JSON.stringify(normalized)
        );

        return normalized;
      } catch {}
    }

    return getStoredShopPrintInfo();
  }

  async function loadShopPrintInfo() {
    const info = await fetchShopPrintInfo();
    setShopPrintInfo(info);
  }

  function exportReceiptsCSV() {
    const NL = String.fromCharCode(10);

    const head = [
      "ReceiptNo",
      "Date",
      "Staff",
      "Payment",
      "Subtotal",
      "Tax",
      "Discount",
      "GrandTotal",
      "CashGiven",
      "Change",
      "Shop",
      "CreatedBy",
    ].join(",");

    const rows = filteredReceipts.map((r) =>
      [
        r.receiptNo,
        formatDate(r.createdAt),
        r.staffName || r.staffId || "",
        r.paymentMethod,
        Math.round(r.subtotal),
        Math.round(r.taxAmount),
        `${r.discountPercent}%`,
        Math.round(r.grandTotal),
        Math.round(r.cashGiven),
        Math.round(r.changeAmount),
        r.shopName || r.shopCode || "",
        r.createdByUsername || "",
      ].join(",")
    );

    const blob = new Blob([head + NL + rows.join(NL)], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "receipts.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  async function printReceipt(receipt: ReceiptRow) {
    const win = window.open("", "_blank", "width=420,height=720");

    if (!win) {
      alert("Popup blocked. Please allow popup for print.");
      return;
    }

    win.document.open();
    win.document.write(
      "<!doctype html><html><head><title>Loading receipt...</title></head><body>Loading receipt...</body></html>"
    );
    win.document.close();

    const latestShopPrintInfo = await fetchShopPrintInfo();
    setShopPrintInfo(latestShopPrintInfo);

    const receiptBarcodeSrc = code128SvgDataUri(receipt.receiptNo);

    // ✅ API shop info ကို အရင်သုံးမယ်။ API မရမှ receipt row/default ကို fallback သုံးမယ်။
    const printShopName =
      firstText(latestShopPrintInfo.shopName, receipt.shopName) ||
      DEFAULT_SHOP_PRINT_INFO.shopName;

    const printShopAddress = firstText(
      latestShopPrintInfo.address,
      receipt.shopAddress
    );

    const printShopPhone = firstText(
      latestShopPrintInfo.phone,
      receipt.shopPhone
    );

    const printShopSecondPhone = firstText(
      latestShopPrintInfo.secondPhone,
      receipt.shopSecondPhone
    );

    const phoneLine =
      printShopPhone || printShopSecondPhone
        ? `${printShopPhone}${
            printShopPhone && printShopSecondPhone ? " / " : ""
          }${printShopSecondPhone}`
        : "";

    const footerMessage =
      latestShopPrintInfo.footerMessage ||
      DEFAULT_SHOP_PRINT_INFO.footerMessage;

    const activeAds = latestShopPrintInfo.ads.filter(
      (ad) => ad.active !== false && clean(ad.message)
    );

    const adsHtml = activeAds.length
      ? `
        <div class="divider"></div>
        <div class="ads">
          ${activeAds
            .map(
              (ad) => `
                <div class="ad-box">
                  ${
                    clean(ad.title)
                      ? `<div class="ad-title">${escapeHtml(ad.title)}</div>`
                      : ""
                  }
                  <div class="ad-message">${escapeHtml(ad.message)}</div>
                </div>
              `
            )
            .join("")}
        </div>
      `
      : "";

    const rows = receipt.items
      .map(
        (item) => `
          <tr>
            <td>
              <div class="name">${escapeHtml(item.productName)}</div>
              <div class="meta">${escapeHtml(
                item.barcode || item.productId || ""
              )}</div>
            </td>
            <td class="right">${item.qty}</td>
            <td class="right">${jpy(item.price)}</td>
            <td class="right">${jpy(item.lineTotal)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(receipt.receiptNo)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #fff;
            }
            .page {
              width: 80mm;
              padding: 14px 12px;
            }
            .center { text-align: center; }
            .shop { font-size: 18px; font-weight: 900; line-height: 1.25; }
            .small {
              font-size: 11px;
              color: #6b7280;
              line-height: 1.5;
              word-break: break-word;
            }
            .divider { border-top: 1px dashed #9ca3af; margin: 12px 0; }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              font-size: 11px;
              line-height: 1.6;
            }
            table { width: 100%; border-collapse: collapse; }
            th {
              font-size: 10px;
              text-align: right;
              padding: 6px 0;
              border-bottom: 1px dashed #9ca3af;
            }
            th:first-child { text-align: left; }
            td {
              font-size: 11px;
              padding: 7px 0;
              border-bottom: 1px dashed #e5e7eb;
              vertical-align: top;
            }
            .right { text-align: right; white-space: nowrap; }
            .name { font-weight: 800; line-height: 1.35; }
            .meta { margin-top: 2px; font-size: 9px; color: #6b7280; }
            .grand {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 2px solid #111827;
              font-size: 15px;
              font-weight: 900;
            }
            .grand .value { font-size: 20px; }
            .ads {
              display: grid;
              gap: 6px;
            }
            .ad-box {
              border: 1px dashed #f59e0b;
              background: #fffbeb;
              color: #92400e;
              border-radius: 8px;
              padding: 7px 6px;
              text-align: center;
              font-size: 10px;
              line-height: 1.45;
            }
            .ad-title {
              margin-bottom: 2px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .ad-message {
              font-size: 10px;
              line-height: 1.45;
            }
            .receipt-barcode {
              display: block;
              width: 100%;
              height: 42px;
              margin: 0 auto 6px;
              object-fit: fill;
            }
            .barcode {
              font-family: "Courier New", monospace;
              letter-spacing: 1.5px;
              font-size: 11px;
            }
            @media print {
              @page { size: 80mm auto; margin: 0; }
              .page { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="center">
              <div class="shop">${escapeHtml(printShopName)}</div>

              ${
                printShopAddress
                  ? `<div class="small">${escapeHtml(
                      printShopAddress
                    ).replaceAll("\n", "<br/>")}</div>`
                  : `<div class="small">Address: -</div>`
              }

              ${
                phoneLine
                  ? `<div class="small">Phone: ${escapeHtml(phoneLine)}</div>`
                  : `<div class="small">Phone: -</div>`
              }

              <div class="small">Receipt Reprint</div>
            </div>

            <div class="divider"></div>

            <div class="row"><span>Receipt</span><b>${escapeHtml(
              receipt.receiptNo
            )}</b></div>
            <div class="row"><span>Date</span><b>${escapeHtml(
              formatDate(receipt.createdAt)
            )}</b></div>
            <div class="row"><span>Staff</span><b>${escapeHtml(
              receipt.staffName || receipt.staffId || "-"
            )}</b></div>
            <div class="row"><span>Payment</span><b>${escapeHtml(
              receipt.paymentMethod
            )}</b></div>

            <div class="divider"></div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="divider"></div>

            <div class="row"><span>Subtotal</span><b>${jpy(
              receipt.subtotal
            )}</b></div>
            <div class="row"><span>Tax</span><b>${jpy(
              receipt.taxAmount
            )}</b></div>
            <div class="row"><span>Discount</span><b>${
              receipt.discountPercent
            }%</b></div>
            <div class="row grand"><span>Grand Total</span><span class="value">${jpy(
              receipt.grandTotal
            )}</span></div>

            ${adsHtml}

            <div class="divider"></div>

            <div class="center small">
              Created by: ${escapeHtml(receipt.createdByUsername || "-")}<br/>
              ${escapeHtml(footerMessage)}<br/>
              <img class="receipt-barcode" src="${receiptBarcodeSrc}" alt="${escapeHtml(
                receipt.receiptNo
              )}" />
              <div class="barcode">${escapeHtml(receipt.receiptNo)}</div>
            </div>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-140px] top-20 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[-120px] top-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-96 w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1500px] px-4 py-8 md:px-6">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-500">
              <Receipt className="h-4 w-4" />
              Receipts
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              My POS Receipts
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Login ဝင်ထားတဲ့ user က save လုပ်ထားသော receipt များကို DB မှ
              ပြထားပါတယ်။
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="h-11 rounded-xl border-sky-300/25 bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back Home
            </Button>

            <Button
              variant="outline"
              onClick={loadReceipts}
              disabled={loading}
              className="h-11 rounded-xl"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Reload
            </Button>

            <Button
              variant="outline"
              onClick={exportReceiptsCSV}
              disabled={!filteredReceipts.length}
              className="h-11 rounded-xl"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-muted-foreground">
          <b className="text-sky-500">Print Shop Info:</b>{" "}
          {shopPrintInfo.shopName}
          {shopPrintInfo.address ? ` · ${shopPrintInfo.address}` : ""}
          {shopPrintInfo.phone ? ` · Phone: ${shopPrintInfo.phone}` : ""}
          {shopPrintInfo.secondPhone ? ` / ${shopPrintInfo.secondPhone}` : ""}
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            icon={<Receipt className="h-5 w-5" />}
            label="Total Receipts"
            value={String(stats.totalReceipts)}
            tone="sky"
          />

          <StatCard
            icon={<Wallet className="h-5 w-5" />}
            label="Total Sales"
            value={jpy(stats.totalSales)}
            tone="emerald"
          />

          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Items Sold"
            value={String(stats.totalItems)}
            tone="violet"
          />
        </div>

        <Card className="overflow-hidden rounded-[28px] border border-black/10 bg-card/90 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl dark:border-white/10">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-sky-500" />
                  Receipt History
                </CardTitle>
                <CardDescription>
                  Receipt No, staff, payment, product name တို့နဲ့ search
                  လုပ်နိုင်ပါတယ်။
                </CardDescription>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <div className="relative w-full lg:w-[360px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search receipts..."
                    className="h-11 rounded-xl bg-background/70 pl-10"
                  />
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-11 rounded-xl border border-border bg-background/70 px-3 text-sm font-semibold outline-none"
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="grid min-h-[360px] place-items-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-sky-500" />
                  <div className="mt-3 text-sm text-muted-foreground">
                    Loading receipts...
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="grid min-h-[360px] place-items-center p-6">
                <div className="max-w-md rounded-3xl border border-red-300/25 bg-red-500/10 p-6 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
                  <h3 className="mt-3 font-black text-red-500">
                    Receipts load failed
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  <Button className="mt-4 rounded-xl" onClick={loadReceipts}>
                    Try again
                  </Button>
                </div>
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="grid min-h-[360px] place-items-center p-6 text-center">
                <div>
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-border bg-muted/50">
                    <Receipt className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="mt-5 text-xl font-black">No receipts found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Payment complete လုပ်ပြီး DB ထဲသိမ်းထားတဲ့ receipts
                    မရှိသေးပါ။
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {paginatedReceipts.map((receipt, index) => (
                    <ReceiptCard
                      key={receipt.id}
                      receipt={receipt}
                      index={index}
                      expanded={expandedId === receipt.id}
                      onToggle={() =>
                        setExpandedId((old) =>
                          old === receipt.id ? null : receipt.id
                        )
                      }
                      onPrint={() => {
                        void printReceipt(receipt);
                      }}
                    />
                  ))}
                </div>

                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  totalItems={filteredReceipts.length}
                  onPrev={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setExpandedId(null);
                  }}
                  onNext={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    setExpandedId(null);
                  }}
                  onPage={(page) => {
                    setCurrentPage(page);
                    setExpandedId(null);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPrev,
  onNext,
  onPage,
}: {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
}) {
  const pages = useMemo(() => {
    const result: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i += 1) {
      result.push(i);
    }

    return result;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col gap-4 border-t border-border bg-muted/20 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
      <div className="text-sm text-muted-foreground">
        Showing{" "}
        <b className="text-foreground">
          {pageStart}-{pageEnd}
        </b>{" "}
        of <b className="text-foreground">{totalItems}</b> receipts
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="rounded-xl"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>

        {pages[0] > 1 && (
          <>
            <Button
              variant={currentPage === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => onPage(1)}
              className="h-9 min-w-9 rounded-xl px-3"
            >
              1
            </Button>
            {pages[0] > 2 && (
              <span className="px-1 text-sm text-muted-foreground">...</span>
            )}
          </>
        )}

        {pages.map((page) => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPage(page)}
            className="h-9 min-w-9 rounded-xl px-3"
          >
            {page}
          </Button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-sm text-muted-foreground">...</span>
            )}
            <Button
              variant={currentPage === totalPages ? "default" : "outline"}
              size="sm"
              onClick={() => onPage(totalPages)}
              className="h-9 min-w-9 rounded-xl px-3"
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="rounded-xl"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "sky" | "emerald" | "violet";
}) {
  const styles = {
    sky: "border-sky-300/25 bg-sky-500/10 text-sky-500",
    emerald: "border-emerald-300/25 bg-emerald-500/10 text-emerald-500",
    violet: "border-violet-300/25 bg-violet-500/10 text-violet-500",
  }[tone];

  return (
    <Card className="rounded-3xl border border-black/10 bg-card/90 dark:border-white/10">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl border ${styles}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptCard({
  receipt,
  index,
  expanded,
  onToggle,
  onPrint,
}: {
  receipt: ReceiptRow;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onPrint: () => void;
}) {
  const itemCount = receipt.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      className="bg-background/20 p-4 transition hover:bg-muted/25 md:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-300/25 bg-sky-500/10">
              <Receipt className="h-5 w-5 text-sky-500" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-black">
                  {receipt.receiptNo}
                </h3>

                <Badge className="rounded-full bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                  {receipt.status || "COMPLETED"}
                </Badge>

                <Badge variant="secondary" className="rounded-full capitalize">
                  {receipt.paymentMethod}
                </Badge>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(receipt.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {receipt.staffName || receipt.staffId || "-"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  {receipt.shopName || receipt.shopCode || "-"}
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
          <div className="text-left lg:text-right">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Grand Total
            </div>
            <div className="text-2xl font-black text-sky-500">
              {jpy(receipt.grandTotal)}
            </div>
            <div className="text-xs text-muted-foreground">
              {itemCount} items
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrint}
              className="rounded-xl"
            >
              <Printer className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={onToggle}
              className="rounded-xl"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-3xl border border-border bg-card/70 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="hidden grid-cols-[1.4fr_80px_120px_120px] border-b border-border bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground md:grid">
                    <div>Product</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                  </div>

                  <div className="divide-y divide-border">
                    {receipt.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_80px_120px_120px] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold">
                            {item.productName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Barcode {item.barcode || item.productId || "-"}
                            {item.discountPercent > 0
                              ? ` · ${item.discountPercent}% off`
                              : ""}
                          </div>
                        </div>

                        <div className="flex justify-between text-sm md:block md:text-right">
                          <span className="text-muted-foreground md:hidden">
                            Qty
                          </span>
                          <b>{item.qty}</b>
                        </div>

                        <div className="flex justify-between text-sm md:block md:text-right">
                          <span className="text-muted-foreground md:hidden">
                            Price
                          </span>
                          <b>{jpy(item.price)}</b>
                        </div>

                        <div className="flex justify-between text-sm md:block md:text-right">
                          <span className="text-muted-foreground md:hidden">
                            Total
                          </span>
                          <b>{jpy(item.lineTotal)}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <div className="mb-3 font-black">Receipt Summary</div>

                  <SummaryRow label="Subtotal" value={jpy(receipt.subtotal)} />
                  <SummaryRow label="Tax" value={jpy(receipt.taxAmount)} />
                  <SummaryRow
                    label="Discount"
                    value={`${receipt.discountPercent}%`}
                  />
                  <Separator className="my-3" />
                  <SummaryRow
                    label="Cash Given"
                    value={jpy(receipt.cashGiven)}
                  />
                  <SummaryRow label="Change" value={jpy(receipt.changeAmount)} />
                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black">Grand Total</span>
                    <span className="text-2xl font-black text-sky-500">
                      {jpy(receipt.grandTotal)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3 text-xs leading-5 text-muted-foreground">
                    <b className="text-sky-500">Created by:</b>{" "}
                    {receipt.createdByUsername || "-"}
                    <br />
                    <b className="text-sky-500">Role:</b>{" "}
                    {receipt.createdByRole || "-"}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
