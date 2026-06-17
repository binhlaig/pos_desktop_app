"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertTriangle,
  Barcode,
  CreditCard,
  Download,
  Loader2,
  Minus,
  Moon,
  Package,
  Percent,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Trash2,
  Users,
  X,
  Zap,
  ArrowRight,
  Store,
  Eye,
  Flame,
  GlassWater,
  Apple,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { code128SvgDataUri } from "@/lib/code128";

type Product = {
  id: string;
  dbId?: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  price: number;
  category: string;
  productType?: string | null;
  taxable?: boolean;
  stock?: number;
  imagePath?: string | null;
};

type CartLine = {
  id: string;
  dbId?: string;
  sku?: string | null;
  barcode?: string | null;
  imagePath?: string | null;
  name: string;
  qty: number;
  price: number;
  taxable: boolean;
  discount: number;
};

type StaffRole = "staff" | "supervise";
type PaymentMethod = "cash" | "card";
type CurrencyPosition = "BEFORE" | "AFTER";

type SaveReceiptPayload = {
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  paymentMethod: PaymentMethod;
  subtotal: number;
  taxAmount: number;
  discountPercent: number;
  grandTotal: number;
  cashGiven: number;
  changeAmount: number;
  items: {
    productId?: string;
    barcode?: string | null;
    sku?: string | null;
    productName: string;
    qty: number;
    price: number;
    discountPercent: number;
    taxable: boolean;
    lineTotal: number;
  }[];
};

type SaveReceiptResponse = {
  id?: number;
  receiptNo?: string;
  status?: string;
  grandTotal?: number;
  createdAt?: string;
  message?: string;
};

type StaffSessionResponse = {
  staff?: {
    id?: string;
    name?: string;
    role?: StaffRole;
  };
  message?: string;
};

type ProductsResponse = {
  products?: Product[];
  message?: string;
};

type ReceiptAdSetting = {
  id?: number | null;
  title?: string | null;
  message?: string | null;
  active?: boolean;
};

type ReceiptPrintSetting = {
  shopName: string;
  address: string;
  phone: string;
  secondPhone: string;
  footerMessage: string;
  taxRatePercent: number;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimalDigits: number;
  currencyPosition: CurrencyPosition;
  ads: ReceiptAdSetting[];
};

type QuickItemGroup = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  categories: string[];
  keywords: string[];
};

const QUICK_ITEM_GROUPS: QuickItemGroup[] = [
  {
    id: "fried",
    label: "အကြော်",
    description: "Fried / ready food",
    emoji: "🍤",
    categories: ["FRIED", "FRY", "READY_FOOD", "HOT_FOOD"],
    keywords: ["အကြော်", "ကြော်", "fried", "fry", "tempura"],
  },
  {
    id: "drink",
    label: "အရည် / ဖျော်ရည်",
    description: "Juice / drinks / liquid items",
    emoji: "🥤",
    categories: ["JUICE", "FRESH_JUICE", "DRINK", "DRINKS", "BEVERAGE", "BEVERAGES", "LIQUID"],
    keywords: [
      "အရည်",
      "ဖျော်ရည်",
      "juice",
      "drink",
      "smoothie",
      "latel",
      "tea",
      "coffee",
      "milk",
      "water",
    ],
  },
  {
    id: "fruit",
    label: "သစ်သီး",
    description: "Fresh fruits",
    emoji: "🍎",
    categories: ["FRUIT", "FRUITS", "FRESH_FRUIT", "FRUIT_PACK"],
    keywords: [
      "သစ်သီး",
      "fruit",
      "fruits",
      "apple",
      "banana",
      "orange",
      "pineapple",
      "kivi",
      "kiwi",
      "strawberry",
      "စတော်ပဲရီ",
      "ငှက်ပျော",
      "နာနတ်",
    ],
  },
];

const normalizeQuickText = (value: unknown) =>
  clean(value).replace(/[\s_-]+/g, "_").toUpperCase();

function productMatchesQuickGroup(product: Product, group: QuickItemGroup) {
  const category = normalizeQuickText(product.category);
  const productType = normalizeQuickText(product.productType);
  const name = clean(product.name).toLowerCase();

  return (
    group.categories.some((item) => normalizeQuickText(item) === category) ||
    group.categories.some((item) => normalizeQuickText(item) === productType) ||
    group.keywords.some((keyword) =>
      name.includes(String(keyword).trim().toLowerCase())
    )
  );
}

function ManualGroupIcon({ groupId }: { groupId: string }) {
  if (groupId === "fried") return <Flame className="h-5 w-5" />;
  if (groupId === "drink") return <GlassWater className="h-5 w-5" />;
  if (groupId === "fruit") return <Apple className="h-5 w-5" />;

  return <ShoppingBag className="h-5 w-5" />;
}

const DEFAULT_TAX_RATE_PERCENT = 10;
const PAGE_SIZE = 5;
const MANUAL_DIALOG_PAGE_SIZE = 8;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const DEFAULT_RECEIPT_SETTING: ReceiptPrintSetting = {
  shopName: "Clear Blue Light POS",
  address: "",
  phone: "",
  secondPhone: "",
  footerMessage: "Thank you for shopping",
  taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
  currencyCode: "MMK",
  currencySymbol: "Ks",
  currencyDecimalDigits: 0,
  currencyPosition: "BEFORE",
  ads: [],
};

const TAX_RATE_STORAGE_KEY = "receipt_tax_rate_percent";
const SHOP_PRINT_INFO_STORAGE_KEY = "receipt_shop_print_info";
const SHOP_SETTINGS_UPDATED_EVENT = "receipt-shop-settings-updated";

const round = (n: number) => Math.round(n);

const EMPTY_RECEIPT_PLACEHOLDERS = [
  "Shop address မထည့်ရသေးပါ",
  "Phone No မထည့်ရသေးပါ",
];

const clean = (value: unknown) => {
  const text = String(value ?? "").trim();

  if (!text) return "";
  if (EMPTY_RECEIPT_PLACEHOLDERS.includes(text)) return "";
  if (text.includes("မထည့်ရသေးပါ")) return "";

  return text;
};

const readPercent = (...values: unknown[]) => {
  for (const value of values) {
    const n = Number(value);

    if (!Number.isFinite(n)) continue;

    const percent = n > 0 && n <= 1 ? n * 100 : n;
    return Math.min(100, Math.max(0, Math.round(percent)));
  }

  return DEFAULT_TAX_RATE_PERCENT;
};

const getStoredTaxRatePercent = () => {
  if (typeof window === "undefined") return null;

  const n = Number(localStorage.getItem(TAX_RATE_STORAGE_KEY));

  return Number.isFinite(n) ? n : null;
};

const unwrapPayload = (data: any) =>
  data?.data && typeof data.data === "object"
    ? data.data
    : data?.setting && typeof data.setting === "object"
    ? data.setting
    : data?.shopSetting && typeof data.shopSetting === "object"
    ? data.shopSetting
    : data?.shop_setting && typeof data.shop_setting === "object"
    ? data.shop_setting
    : data?.receiptSetting && typeof data.receiptSetting === "object"
    ? data.receiptSetting
    : data?.receipt_setting && typeof data.receipt_setting === "object"
    ? data.receipt_setting
    : data;

const unwrapShopPayload = (data: any) => {
  const payload = unwrapPayload(data);
  const shop =
    payload?.currentShop && typeof payload.currentShop === "object"
      ? payload.currentShop
      : payload?.current_shop && typeof payload.current_shop === "object"
      ? payload.current_shop
      : payload?.current && typeof payload.current === "object"
      ? payload.current
      : payload?.shop && typeof payload.shop === "object"
      ? payload.shop
      : payload;

  return shop || {};
};

function formatMoney(amount: number, setting: ReceiptPrintSetting) {
  const value = Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: setting.currencyDecimalDigits,
    maximumFractionDigits: setting.currencyDecimalDigits,
  });

  if (setting.currencyPosition === "AFTER") {
    return `${value} ${setting.currencySymbol}`;
  }

  return `${setting.currencySymbol} ${value}`;
}

function productEmoji(name: string, category?: string) {
  const lower = name.toLowerCase();

  if (lower.includes("banana")) return "🍌";
  if (lower.includes("apple")) return "🍎";
  if (lower.includes("orange")) return "🍊";
  if (lower.includes("chicken")) return "🍗";
  if (lower.includes("potato")) return "🍟";
  if (lower.includes("milk")) return "🥛";
  if (lower.includes("egg")) return "🥚";
  if (lower.includes("tea")) return "🍵";
  if (lower.includes("pc")) return "🖥️";
  if (lower.includes("laptop")) return "💻";
  if (lower.includes("camera")) return "📷";

  const cat = String(category || "").toUpperCase();

  if (cat === "FRUITS") return "🍇";
  if (cat === "FRIED") return "🍤";
  if (cat === "DAIRY") return "🥛";
  if (cat === "DRINK") return "🥤";
  if (cat === "FOOD") return "🍱";

  return "🛒";
}

function buildImageUrl(path?: string | null) {
  if (!path) return null;

  const raw = String(path).trim();
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("uploads/")) return `${API_BASE}/${raw}`;

  return `${API_BASE}/uploads/products/${raw}`;
}

function readMoneyValue(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function readStockValue(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function normalizeProductFromApi(item: any): Product {
  const dbId = clean(
    item?.dbId ?? item?.id ?? item?.productId ?? item?.product_id
  );
  const barcode = clean(item?.barcode);
  const sku = clean(item?.sku);

  const name = clean(
    item?.name ?? item?.productName ?? item?.product_name ?? item?.title
  );

  /**
   * DB old table မှာ price / stock columns က 0 ဖြစ်ပြီး
   * product_price / product_quantity_amount ထဲမှာမှ တန်ဖိုးမှန်ရှိနိုင်လို့
   * product_* fields ကို အရင်ဖတ်ပါတယ်။
   */
  const price = readMoneyValue(
    item?.productPrice,
    item?.product_price,
    item?.price
  );

  const stock = readStockValue(
    item?.productQuantityAmount,
    item?.product_quantity_amount,
    item?.quantity,
    item?.stock
  );

  const category =
    clean(
      item?.category ??
        item?.productCategory ??
        item?.product_category ??
        item?.posCategory ??
        item?.pos_category
    ) || "OTHER";

  const productType =
    clean(
      item?.productType ??
        item?.product_type ??
        item?.businessType ??
        item?.business_type
    ) || "OTHER";

  const imagePath =
    item?.imagePath ??
    item?.image_path ??
    item?.product_image ??
    item?.productImage ??
    null;

  const scanId = barcode || sku || dbId || name;

  return {
    id: scanId,
    dbId,
    sku: sku || null,
    barcode: barcode || null,
    name,
    price,
    category,
    productType: productType || null,
    stock,
    imagePath,
    taxable: item?.taxable == null ? true : Boolean(item.taxable),
  };
}

function normalizeProductsResponse(data: any): Product[] {
  const rawProducts = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
    ? data.products
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.content)
    ? data.content
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return rawProducts
    .map(normalizeProductFromApi)
    .filter((p: Product) => !!clean(p.name));
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

function ProductVisual({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const imageUrl = buildImageUrl(product.imagePath);
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={product.name}
        className={`h-full w-full object-cover ${className}`}
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`grid h-full w-full place-items-center bg-muted text-3xl ${className}`}
    >
      {productEmoji(product.name, product.category)}
    </div>
  );
}

function CartLineVisual({
  line,
  className = "",
}: {
  line: CartLine;
  className?: string;
}) {
  const imageUrl = buildImageUrl(line.imagePath);
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={line.name}
        className={`h-full w-full object-cover ${className}`}
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`grid h-full w-full place-items-center text-3xl ${className}`}
    >
      {productEmoji(line.name)}
    </div>
  );
}

export default function RegisterPOSPage() {
  const router = useRouter();
  const latestReceiptLoadRef = useRef<() => Promise<void>>(async () => {});

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(true);

  const [receiptSetting, setReceiptSetting] =
    useState<ReceiptPrintSetting>(DEFAULT_RECEIPT_SETTING);

  const [staffId, setStaffId] = useState("");
  const [staffIdDraft, setStaffIdDraft] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("staff");

  const [staffLoginLoading, setStaffLoginLoading] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickItemGroup, setQuickItemGroup] = useState(QUICK_ITEM_GROUPS[0]?.id || "fried");

  const [taxRatePercent, setTaxRatePercent] = useState(DEFAULT_TAX_RATE_PERCENT);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [page, setPage] = useState(1);
  const lastAutoScanRef = useRef("");

  const canEditDiscount = staffRole === "supervise";
  const isLoggedIn = !!staffId.trim();
  const staffRequiredMessage = "Please enter Staff ID first.";

  const subtotal = useMemo(
    () => cart.reduce((a, l) => a + l.qty * l.price * (1 - l.discount), 0),
    [cart]
  );

  const tax = useMemo(
    () =>
      cart.reduce(
        (a, l) =>
          a +
          (l.taxable
            ? l.qty * l.price * (1 - l.discount) * (taxRatePercent / 100)
            : 0),
        0
      ),
    [cart, taxRatePercent]
  );

  const total = subtotal + tax;
  const grandTotal = Math.max(0, total * (1 - globalDiscount / 100));
  const money = (amount: number) => formatMoney(amount, receiptSetting);

  const pageCount = Math.max(1, Math.ceil(cart.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageSlice = cart.slice(start, start + PAGE_SIZE);

  const nameHints = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return catalog
      .filter((p) => {
        const name = p.name.toLowerCase();
        const barcode = clean(p.barcode).toLowerCase();
        const sku = clean(p.sku).toLowerCase();
        const id = clean(p.id).toLowerCase();
        const dbId = clean(p.dbId).toLowerCase();

        return (
          name.includes(q) ||
          barcode.includes(q) ||
          sku.includes(q) ||
          id.includes(q) ||
          dbId.includes(q)
        );
      })
      .slice(0, 6);
  }, [query, catalog]);

  const manualActionProducts = useMemo(() => {
    return catalog.filter((product) => {
      const hasName = !!clean(product.name);
      const matchesAnyManualGroup = QUICK_ITEM_GROUPS.some((group) =>
        productMatchesQuickGroup(product, group)
      );

      /**
       * ဒီ area က barcode scan မသုံးချင်တဲ့ item group များအတွက်ပါ။
       * DB barcode value ရှိနေသော်လည်း category/name group match ဖြစ်ရင် dialog ထဲပြမယ်။
       * price/stock 0 ဖြစ်နေလို့ button မပေါ်တော့တဲ့ bug မဖြစ်အောင် filter မတင်းထားပါ။
       */
      return hasName && matchesAnyManualGroup;
    });
  }, [catalog]);

  const activeQuickGroup = useMemo<QuickItemGroup>(() => {
    return (
      QUICK_ITEM_GROUPS.find((group) => group.id === quickItemGroup) ||
      QUICK_ITEM_GROUPS[0]
    );
  }, [quickItemGroup]);

  const quickGroups = useMemo(() => {
    return QUICK_ITEM_GROUPS.map((group) => ({
      ...group,
      count: manualActionProducts.filter((product) =>
        productMatchesQuickGroup(product, group)
      ).length,
    }));
  }, [manualActionProducts]);

  const quickViewProducts = useMemo(() => {
    return manualActionProducts.filter((product) =>
      productMatchesQuickGroup(product, activeQuickGroup)
    );
  }, [manualActionProducts, activeQuickGroup]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!QUICK_ITEM_GROUPS.some((group) => group.id === quickItemGroup)) {
      setQuickItemGroup(QUICK_ITEM_GROUPS[0]?.id || "fried");
    }
  }, [quickItemGroup]);

  useEffect(() => {
    const stored = localStorage.getItem("pos-theme");
    const sys = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const init = stored ? stored === "dark" : !!sys;

    setDark(init);
    document.documentElement.classList.toggle("dark", init);
  }, []);

  useEffect(() => {
    const savedCart = localStorage.getItem("cbl_pos_cart_v2");

    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {
        setCart([]);
      }
    }

    setStaffIdDraft(localStorage.getItem("pos_staff_id") || "");
    setTaxRatePercent(readPercent(getStoredTaxRatePercent()));
    setHasHydrated(true);
    void loadReceiptSetting();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TAX_RATE_STORAGE_KEY) {
        setTaxRatePercent(readPercent(event.newValue));
      }

      if (
        event.key === TAX_RATE_STORAGE_KEY ||
        event.key === SHOP_PRINT_INFO_STORAGE_KEY
      ) {
        void latestReceiptLoadRef.current();
      }
    };
    const onShopSettingsUpdated = () => {
      void latestReceiptLoadRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void latestReceiptLoadRef.current();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SHOP_SETTINGS_UPDATED_EVENT, onShopSettingsUpdated);
    window.addEventListener("focus", onShopSettingsUpdated);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SHOP_SETTINGS_UPDATED_EVENT, onShopSettingsUpdated);
      window.removeEventListener("focus", onShopSettingsUpdated);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("cbl_pos_cart_v2", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!hasHydrated) return;
    localStorage.setItem("pos_staff_id", staffId.trim());
  }, [hasHydrated, staffId]);

  useEffect(() => {
    if (!hasHydrated) return;
    localStorage.setItem("pos_staff_role", staffRole);
  }, [hasHydrated, staffRole]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        focusScanner();
        return;
      }

      if (isTyping) return;

      if (e.key.toLowerCase() === "p") openPayment();
      if (e.key === "Delete" && cart.length) clearCart();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, staffId, staffRole]);

  useEffect(() => {
    const raw = query.trim();

    if (!raw) {
      lastAutoScanRef.current = "";
      return;
    }

    if (!isLoggedIn || productsLoading || scanLoading) return;

    const normalizedRaw = raw.toLowerCase();

    const exactLocalMatch = catalog.some((p) => {
      const barcode = clean(p.barcode).toLowerCase();
      const sku = clean(p.sku).toLowerCase();
      const id = clean(p.id).toLowerCase();
      const dbId = clean(p.dbId).toLowerCase();

      return (
        barcode === normalizedRaw ||
        sku === normalizedRaw ||
        id === normalizedRaw ||
        dbId === normalizedRaw
      );
    });

    const shouldLookupBarcode = /^\d{6,}$/.test(raw);

    if (!exactLocalMatch && !shouldLookupBarcode) return;

    const timer = window.setTimeout(() => {
      if (lastAutoScanRef.current === raw) return;

      lastAutoScanRef.current = raw;
      void handleScanOrSearch();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, catalog, isLoggedIn, productsLoading, scanLoading]);

  function toggleTheme() {
    const next = !dark;

    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pos-theme", next ? "dark" : "light");
  }

  function requireStaff() {
    if (isLoggedIn) return true;

    toast.error(staffRequiredMessage);
    return false;
  }

  function focusScanner() {
    (document.getElementById("scan-input") as HTMLInputElement | null)?.focus();
  }

  async function loadReceiptSetting() {
    try {
      const [receiptRes, shopRes] = await Promise.all([
        fetch("/api/receipt-settings/my-shop", {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...authHeaders(),
          },
          cache: "no-store",
        }),
        fetch("/api/shop/settings", {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...authHeaders(),
          },
          cache: "no-store",
        }).catch(() => null),
      ]);

      const receiptData = await receiptRes.json().catch(() => null);
      const shopData =
        shopRes && shopRes.ok ? await shopRes.json().catch(() => null) : null;
      const receiptPayload = unwrapPayload(receiptData);
      const receiptShop = unwrapShopPayload(receiptData);
      const shopPayload = unwrapShopPayload(shopData);

      if (shopRes && !shopRes.ok) {
        console.warn("Shop currency setting load failed:", shopRes.status);
      }

      if (!receiptRes.ok) {
        console.error("Receipt setting load failed:", receiptRes.status, receiptData);

        toast.error(
          receiptData?.message ||
            `Receipt setting မဖတ်နိုင်ပါ။ Status: ${receiptRes.status}`
        );

        setReceiptSetting(DEFAULT_RECEIPT_SETTING);
        setTaxRatePercent(readPercent(getStoredTaxRatePercent()));
        return;
      }

      const taxPercent = readPercent(
        shopPayload?.taxRatePercent,
        shopPayload?.tax_rate_percent,
        shopPayload?.taxPercent,
        shopPayload?.tax_percent,
        shopPayload?.taxRate,
        shopPayload?.tax_rate,
        receiptPayload?.taxRatePercent,
        receiptPayload?.tax_rate_percent,
        receiptPayload?.taxPercent,
        receiptPayload?.tax_percent,
        receiptPayload?.taxRate,
        receiptPayload?.tax_rate,
        getStoredTaxRatePercent()
      );

      const nextSetting: ReceiptPrintSetting = {
        shopName:
          clean(shopPayload?.shopName) ||
          clean(shopPayload?.shop_name) ||
          clean(shopPayload?.name) ||
          clean(receiptPayload?.shopName) ||
          clean(receiptPayload?.shop_name) ||
          clean(receiptPayload?.name) ||
          clean(receiptShop?.shopName) ||
          clean(receiptShop?.shop_name) ||
          clean(receiptShop?.name) ||
          DEFAULT_RECEIPT_SETTING.shopName,

        address:
          clean(shopPayload?.address) ||
          clean(shopPayload?.shopAddress) ||
          clean(shopPayload?.shop_address) ||
          clean(receiptPayload?.address) ||
          clean(receiptPayload?.shopAddress) ||
          clean(receiptPayload?.shop_address) ||
          clean(receiptShop?.address) ||
          clean(receiptShop?.shopAddress) ||
          clean(receiptShop?.shop_address),

        phone:
          clean(shopPayload?.phone) ||
          clean(shopPayload?.shopPhone) ||
          clean(shopPayload?.shop_phone) ||
          clean(receiptPayload?.phone) ||
          clean(receiptPayload?.shopPhone) ||
          clean(receiptPayload?.shop_phone) ||
          clean(receiptShop?.phone) ||
          clean(receiptShop?.shopPhone) ||
          clean(receiptShop?.shop_phone),

        secondPhone:
          clean(shopPayload?.secondPhone) ||
          clean(shopPayload?.second_phone) ||
          clean(shopPayload?.shopSecondPhone) ||
          clean(shopPayload?.shop_second_phone) ||
          clean(receiptPayload?.secondPhone) ||
          clean(receiptPayload?.second_phone) ||
          clean(receiptPayload?.shopSecondPhone) ||
          clean(receiptPayload?.shop_second_phone) ||
          clean(receiptShop?.secondPhone) ||
          clean(receiptShop?.second_phone),

        footerMessage:
          clean(receiptPayload?.footerMessage) ||
          clean(receiptPayload?.footer_message) ||
          DEFAULT_RECEIPT_SETTING.footerMessage,

        taxRatePercent: taxPercent,

        currencyCode:
          clean(shopPayload?.currencyCode) ||
          clean(shopPayload?.currency_code) ||
          DEFAULT_RECEIPT_SETTING.currencyCode,

        currencySymbol:
          clean(shopPayload?.currencySymbol) ||
          clean(shopPayload?.currency_symbol) ||
          DEFAULT_RECEIPT_SETTING.currencySymbol,

        currencyDecimalDigits: Number.isFinite(
          Number(shopPayload?.currencyDecimalDigits ?? shopPayload?.currency_decimal_digits)
        )
          ? Number(shopPayload?.currencyDecimalDigits ?? shopPayload?.currency_decimal_digits)
          : DEFAULT_RECEIPT_SETTING.currencyDecimalDigits,

        currencyPosition:
          String(
            shopPayload?.currencyPosition ??
              shopPayload?.currency_position ??
              DEFAULT_RECEIPT_SETTING.currencyPosition
          ).toUpperCase() === "AFTER"
            ? "AFTER"
            : "BEFORE",

        ads: Array.isArray(receiptPayload?.ads)
          ? receiptPayload.ads
              .filter((ad: any) => ad?.active !== false && clean(ad?.message))
              .map((ad: any) => ({
                id: ad?.id ?? null,
                title: clean(ad?.title),
                message: clean(ad?.message),
                active: ad?.active !== false,
              }))
          : [],
      };

      setReceiptSetting(nextSetting);
      setTaxRatePercent(nextSetting.taxRatePercent);
      localStorage.setItem(TAX_RATE_STORAGE_KEY, String(nextSetting.taxRatePercent));
      localStorage.setItem(
        SHOP_PRINT_INFO_STORAGE_KEY,
        JSON.stringify({
          shopName: nextSetting.shopName,
          address: nextSetting.address,
          phone: nextSetting.phone,
          secondPhone: nextSetting.secondPhone,
        })
      );
    } catch (error) {
      console.error("Receipt setting error:", error);
      toast.error("Receipt setting API ခေါ်မရပါ။ Backend URL / token ကိုစစ်ပါ။");
      setReceiptSetting(DEFAULT_RECEIPT_SETTING);
      setTaxRatePercent(readPercent(getStoredTaxRatePercent()));
    }
  }

  latestReceiptLoadRef.current = loadReceiptSetting;

  async function loadOwnerProducts() {
    setProductsLoading(true);

    const endpoints = [
      "/api/pos/products",
      "/backend/api/products",
      `${API_BASE}/api/products`,
      `${API_BASE}/backend/api/products`,
    ];

    try {
      let lastError = "";
      let loadedProducts: Product[] = [];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...authHeaders(),
            },
            cache: "no-store",
          });

          const data: ProductsResponse | any = await res.json().catch(() => null);

          if (!res.ok) {
            lastError = data?.message || `Products load failed: ${res.status}`;
            continue;
          }

          const normalized = normalizeProductsResponse(data);

          if (normalized.length > 0) {
            loadedProducts = normalized;
            break;
          }

          lastError = "Products response is empty.";
        } catch (error) {
          lastError =
            error instanceof Error ? error.message : "Products API error.";
        }
      }

      setCatalog(loadedProducts);

      if (loadedProducts.length === 0) {
        toast.error(lastError || "Products မရောက်သေးပါ။ API path/token စစ်ပါ။");
        return;
      }

      toast.success(`${loadedProducts.length} products loaded`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Products load failed.";

      setCatalog([]);
      toast.error(message);
    } finally {
      setProductsLoading(false);
    }
  }

  async function lookupProductByBarcode(barcode: string): Promise<Product | null> {
    const target = barcode.trim();
    if (!target) return null;

    try {
      const res = await fetch(
        `/api/pos/products/barcode/${encodeURIComponent(target)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...authHeaders(),
          },
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.product) {
        return null;
      }

      return normalizeProductFromApi(data.product);
    } catch {
      return null;
    }
  }

  async function startStaffSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextStaffId = staffIdDraft.trim();

    if (!nextStaffId) {
      toast.error(staffRequiredMessage);
      return;
    }

    try {
      setStaffLoginLoading(true);
      setStaffLoginError("");

      const res = await fetch("/api/pos/staff-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: nextStaffId }),
      });

      const data: StaffSessionResponse | null = await res.json().catch(() => null);

      if (!res.ok || !data?.staff?.id) {
        throw new Error(
          data?.message || "Staff ID ကို ဒီ owner ရဲ့ shop ထဲမှာမတွေ့ပါ။"
        );
      }

      setStaffId(data.staff.id);
      setStaffIdDraft(data.staff.id);
      setStaffName(data.staff.name || "");
      setStaffRole(data.staff.role === "supervise" ? "supervise" : "staff");

      await loadOwnerProducts();
      await loadReceiptSetting();

      setTimeout(() => focusScanner(), 150);
      toast.success("Staff session started");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Staff validation failed.";

      setStaffLoginError(message);
      setStaffId("");
      setStaffName("");
      setStaffRole("staff");
      toast.error(message);
    } finally {
      setStaffLoginLoading(false);
    }
  }

  function addToCart(p: Product, qty = 1) {
    if (!requireStaff()) return false;

    const availableStock = Number(p.stock ?? 0);

    if (availableStock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return false;
    }

    let added = false;

    setCart((prev) => {
      const lineId = p.barcode || p.sku || p.id;

      const found = prev.find(
        (l) =>
          l.id === lineId ||
          (!!p.barcode && l.barcode === p.barcode) ||
          (!!p.sku && l.sku === p.sku) ||
          (!!p.dbId && l.dbId === p.dbId)
      );

      if (found) {
        const nextQty = found.qty + qty;

        if (nextQty > availableStock) {
          toast.error(
            `${p.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}`
          );
          return prev;
        }

        added = true;

        return prev.map((l) =>
          l.id === found.id ? { ...l, qty: Math.min(999, nextQty) } : l
        );
      }

      if (qty > availableStock) {
        toast.error(
          `${p.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}`
        );
        return prev;
      }

      added = true;

      return [
        ...prev,
        {
          id: lineId,
          dbId: p.dbId,
          sku: p.sku ?? null,
          barcode: p.barcode ?? null,
          imagePath: p.imagePath ?? null,
          name: p.name,
          qty,
          price: p.price,
          taxable: !!p.taxable,
          discount: 0,
        },
      ];
    });

    if (added) {
      toast.success(`${p.name} added`);
      setPage((old) => Math.max(old, Math.ceil((cart.length + 1) / PAGE_SIZE)));
      return true;
    }

    return false;
  }

  async function handleScanOrSearch() {
    if (!requireStaff()) return;

    const raw = query.trim();
    if (!raw) return;

    setScanLoading(true);

    try {
      const normalizedRaw = raw.toLowerCase();

      const byBarcodeOrSku = catalog.find((p) => {
        const barcode = clean(p.barcode).toLowerCase();
        const sku = clean(p.sku).toLowerCase();
        const id = clean(p.id).toLowerCase();
        const dbId = clean(p.dbId).toLowerCase();

        return (
          barcode === normalizedRaw ||
          sku === normalizedRaw ||
          id === normalizedRaw ||
          dbId === normalizedRaw
        );
      });

      if (byBarcodeOrSku) {
        if (addToCart(byBarcodeOrSku)) {
          setQuery("");
          focusScanner();
        }
        return;
      }

      const productFromServer = await lookupProductByBarcode(raw);

      if (productFromServer) {
        setCatalog((prev) => {
          const exists = prev.some(
            (p) =>
              p.id === productFromServer.id ||
              p.barcode === productFromServer.barcode ||
              p.sku === productFromServer.sku ||
              p.dbId === productFromServer.dbId
          );

          return exists ? prev : [productFromServer, ...prev];
        });

        if (addToCart(productFromServer)) {
          setQuery("");
          focusScanner();
        }

        return;
      }

      const byName = catalog.find((p) => p.name.toLowerCase() === normalizedRaw);

      if (byName) {
        if (addToCart(byName)) {
          setQuery("");
          focusScanner();
        }
        return;
      }

      if (nameHints[0]) {
        if (addToCart(nameHints[0])) {
          setQuery("");
          focusScanner();
        }
        return;
      }

      toast.error(`Barcode not found: ${raw}`);
    } finally {
      setScanLoading(false);
    }
  }

  function addQuickItem(product: Product) {
    if (addToCart(product)) {
      setTimeout(() => focusScanner(), 80);
    }
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      removeLine(id);
      return;
    }

    const line = cart.find((l) => l.id === id);
    if (!line) return;

    const product = catalog.find(
      (p) =>
        p.id === line.id ||
        (!!line.dbId && p.dbId === line.dbId) ||
        (!!line.barcode && p.barcode === line.barcode) ||
        (!!line.sku && p.sku === line.sku)
    );

    const availableStock = Number(product?.stock ?? 0);

    if (availableStock <= 0) {
      toast.error(`${line.name} is out of stock`);
      return;
    }

    if (qty > availableStock) {
      toast.error(
        `${line.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}`
      );
      return;
    }

    setCart((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qty: Math.min(999, qty) } : l))
    );
  }

  function updateDisc(id: string, discountPercent: number) {
    const next = Math.max(0, Math.min(50, discountPercent)) / 100;

    setCart((prev) =>
      prev.map((l) => (l.id === id ? { ...l, discount: next } : l))
    );
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  function openPayment() {
    if (!requireStaff()) return;

    if (cart.length === 0) {
      toast.error("No cart item");
      return;
    }

    setPaymentOpen(true);
  }

  async function completePayment(
    paymentMethod: PaymentMethod = "cash",
    cashGivenAmount = 0
  ) {
    if (!requireStaff()) return;

    if (cart.length === 0) {
      toast.error("No cart item");
      return;
    }

    const invalidItem = cart.find((line) => !line.dbId && !/^\d+$/.test(line.id));

    if (invalidItem) {
      toast.error(
        `${invalidItem.name} has no valid productId. DB ထဲက product ကိုသာ checkout လုပ်ပါ။`
      );
      return;
    }

    for (const line of cart) {
      const product = catalog.find(
        (p) =>
          p.id === line.id ||
          (!!line.dbId && p.dbId === line.dbId) ||
          (!!line.barcode && p.barcode === line.barcode) ||
          (!!line.sku && p.sku === line.sku)
      );

      const availableStock = Number(product?.stock ?? 0);

      if (availableStock < line.qty) {
        toast.error(
          `${line.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}, Cart qty: ${line.qty}`
        );
        return;
      }
    }

    const changeAmount =
      paymentMethod === "cash" ? Math.max(0, cashGivenAmount - grandTotal) : 0;

    const payload: SaveReceiptPayload = {
      staffId,
      staffName,
      staffRole,
      paymentMethod,
      subtotal: round(subtotal),
      taxAmount: round(tax),
      discountPercent: globalDiscount,
      grandTotal: round(grandTotal),
      cashGiven: paymentMethod === "cash" ? round(cashGivenAmount) : 0,
      changeAmount: round(changeAmount),
      items: cart.map((line) => ({
        productId: String(line.dbId || line.id),
        barcode: line.barcode || null,
        sku: line.sku || "",
        productName: line.name,
        qty: Number(line.qty || 1),
        price: round(line.price),
        discountPercent: Math.round(line.discount * 100),
        taxable: line.taxable,
        lineTotal: round(line.qty * line.price * (1 - line.discount)),
      })),
    };

    try {
      setReceiptSaving(true);

      const res = await fetch("/api/pos/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data: SaveReceiptResponse | null = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Receipt save failed.");
      }

      toast.success(`Payment complete ✅ Receipt: ${data?.receiptNo || "saved"}`);

      setPaymentOpen(false);
      setCart([]);
      setGlobalDiscount(0);
      setPage(1);

      await loadOwnerProducts();
      await loadReceiptSetting();

      focusScanner();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Receipt save failed.";

      toast.error(message);
    } finally {
      setReceiptSaving(false);
    }
  }

  function exportCSV() {
    if (!requireStaff()) return;

    const NL = String.fromCharCode(10);

    const head = [
      "Barcode",
      "SKU",
      "DB_ID",
      "Name",
      "Qty",
      "Price",
      "Discount",
      "Taxable",
      "LineTotal",
    ].join(",");

    const rows = cart.map((l) =>
      [
        l.barcode || l.id,
        l.sku || "",
        l.dbId || "",
        l.name,
        l.qty,
        l.price,
        `${Math.round(l.discount * 100)}%`,
        l.taxable ? "Yes" : "No",
        round(l.qty * l.price * (1 - l.discount)),
      ].join(",")
    );

    const totals = [
      ["Currency", `${receiptSetting.currencyCode} ${receiptSetting.currencySymbol}`].join(","),
      ["Subtotal", round(subtotal)].join(","),
      ["Tax", round(tax)].join(","),
      ["Total", round(total)].join(","),
      ["Global Discount", `${globalDiscount}%`].join(","),
      ["Grand Total", round(grandTotal)].join(","),
    ].join(NL);

    const csvText = head + NL + rows.join(NL) + NL + NL + totals;

    const blob = new Blob([csvText], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "pos_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function printReceipt() {
    if (!requireStaff()) return;

    if (cart.length === 0) {
      toast.error("No cart item to print");
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const receiptMoney = (amount: number) => formatMoney(amount, receiptSetting);
    const now = new Date();

    const receiptNo = `R-${now.getFullYear()}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours()
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

    const receiptBarcodeSrc = code128SvgDataUri(receiptNo);

    const shopName = receiptSetting.shopName || "Clear Blue Light POS";
    const shopAddress = receiptSetting.address || "";
    const shopPhone = receiptSetting.phone || "";
    const shopSecondPhone = receiptSetting.secondPhone || "";
    const footerMessage =
      receiptSetting.footerMessage || "Thank you for shopping";

    const phoneLine =
      shopPhone || shopSecondPhone
        ? `${shopPhone}${shopPhone && shopSecondPhone ? " / " : ""}${shopSecondPhone}`
        : "";

    const activeReceiptAds = receiptSetting.ads.filter(
      (ad) => ad.active !== false && clean(ad.message)
    );

    const adsHtml = activeReceiptAds.length
      ? `
        <div class="divider"></div>
        <div class="ads">
          ${activeReceiptAds
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

    const rows = cart
      .map((line) => {
        const lineTotal = line.qty * line.price * (1 - line.discount);

        const discountText =
          line.discount > 0
            ? ` (${Math.round(line.discount * 100)}% off)`
            : "";

        return `
          <tr>
            <td class="item">
              <div class="name">${escapeHtml(line.name)}</div>
              <div class="meta">${escapeHtml(line.barcode || line.sku || line.id)}${discountText}</div>
            </td>
            <td class="qty">${line.qty}</td>
            <td class="price">${escapeHtml(receiptMoney(line.price))}</td>
            <td class="total">${escapeHtml(receiptMoney(lineTotal))}</td>
          </tr>
        `;
      })
      .join("");

    const receiptHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${receiptNo}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f3f4f6;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
            }
            .page {
              width: 80mm;
              min-height: 100vh;
              margin: 0 auto;
              background: #ffffff;
              padding: 14px 12px;
            }
            .center { text-align: center; }
            .shop-name {
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 0.3px;
            }
            .sub {
              margin-top: 3px;
              font-size: 11px;
              color: #6b7280;
              line-height: 1.45;
              word-break: break-word;
            }
            .divider {
              border-top: 1px dashed #9ca3af;
              margin: 12px 0;
            }
            .info-row, .total-row {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              font-size: 11px;
              line-height: 1.55;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              padding: 6px 0;
              border-bottom: 1px dashed #9ca3af;
              font-size: 10px;
              color: #374151;
              text-align: right;
            }
            th:first-child { text-align: left; }
            td {
              padding: 7px 0;
              border-bottom: 1px dashed #e5e7eb;
              vertical-align: top;
              font-size: 11px;
            }
            .item { width: 42%; }
            .name {
              font-weight: 800;
              line-height: 1.35;
            }
            .meta {
              margin-top: 2px;
              color: #6b7280;
              font-size: 9px;
              line-height: 1.35;
            }
            .qty, .price, .total {
              text-align: right;
              white-space: nowrap;
            }
            .total-row {
              align-items: center;
              margin: 5px 0;
            }
            .grand {
              margin-top: 8px;
              padding: 9px 0 2px;
              border-top: 2px solid #111827;
              font-size: 15px;
              font-weight: 900;
            }
            .grand .value {
              font-size: 20px;
              letter-spacing: -0.5px;
            }
            .ads {
              display: grid;
              gap: 6px;
            }
            .ad-box {
              border: 1px dashed #f59e0b;
              background: #fffbeb;
              padding: 7px 6px;
              text-align: center;
              border-radius: 8px;
            }
            .ad-title {
              font-size: 10px;
              font-weight: 900;
              color: #92400e;
              text-transform: uppercase;
            }
            .ad-message {
              margin-top: 2px;
              font-size: 10px;
              line-height: 1.45;
              color: #92400e;
            }
            .footer {
              margin-top: 14px;
              text-align: center;
              font-size: 11px;
              line-height: 1.5;
            }
            .receipt-barcode {
              display: block;
              width: 100%;
              height: 42px;
              margin: 0 auto 6px;
              object-fit: fill;
            }
            .barcode {
              margin-top: 10px;
              font-family: "Courier New", monospace;
              letter-spacing: 1.5px;
              font-size: 12px;
            }
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { background: #fff; }
              .page { width: 80mm; margin: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="center">
              <div class="shop-name">${escapeHtml(shopName)}</div>

              ${
                shopAddress
                  ? `<div class="sub">${escapeHtml(shopAddress).replaceAll(
                      "\n",
                      "<br/>"
                    )}</div>`
                  : ""
              }

              ${
                phoneLine
                  ? `<div class="sub">Phone: ${escapeHtml(phoneLine)}</div>`
                  : ""
              }

              <div class="sub">Official Receipt</div>
            </div>

            <div class="divider"></div>

            <div class="info-row"><span>Receipt</span><b>${receiptNo}</b></div>
            <div class="info-row"><span>Date</span><b>${escapeHtml(
              now.toLocaleString("ja-JP")
            )}</b></div>
            <div class="info-row"><span>Staff</span><b>${escapeHtml(
              staffId || "-"
            )}</b></div>
            <div class="info-row"><span>Currency</span><b>${escapeHtml(
              `${receiptSetting.currencyCode} ${receiptSetting.currencySymbol}`
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

            <div class="total-row"><span>Subtotal</span><b>${escapeHtml(
              receiptMoney(subtotal)
            )}</b></div>
            <div class="total-row"><span>Tax (${taxRatePercent}%)</span><b>${escapeHtml(
              receiptMoney(tax)
            )}</b></div>
            <div class="total-row"><span>Discount</span><b>${globalDiscount}%</b></div>
            <div class="total-row grand"><span>Grand Total</span><span class="value">${escapeHtml(
              receiptMoney(grandTotal)
            )}</span></div>

            ${adsHtml}

            <div class="divider"></div>

            <div class="footer">
              Items: ${cart.reduce((a, l) => a + l.qty, 0)}<br/>
              ${escapeHtml(footerMessage)}<br/>
              Please keep this receipt.<br/>
              <img class="receipt-barcode" src="${receiptBarcodeSrc}" alt="${escapeHtml(
                receiptNo
              )}" />
              <div class="barcode">${receiptNo}</div>
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

    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      toast.error("Popup blocked. Please allow popup for print.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  }

  function clearCart() {
    if (!requireStaff()) return;
    setCart([]);
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-background text-foreground">
      <SoftBackground />

      <div className="relative z-10 flex min-h-0 w-full flex-col">
        <header className="shrink-0 border-b border-white/10 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-3 md:px-5">
            <div className="flex min-w-0 items-center gap-4">
              <motion.div
                initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-black/10 bg-sky-500/10 shadow-[0_0_35px_-16px_rgba(56,189,248,0.85)] dark:border-white/10"
              >
                <ShoppingBag className="h-6 w-6 text-sky-400" />
              </motion.div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  Clear Blue Light — <span className="text-sky-400">POS</span>
                </h1>
                <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                  Products table barcode scan · Cart checkout ·{" "}
                  {receiptSetting.currencyCode} {receiptSetting.currencySymbol}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <div className="hidden items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300 sm:flex">
                  <Users className="h-4 w-4" />
                  <span>{staffName || staffId}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    {staffRole === "supervise" ? "Supervisor" : "Staff"}
                  </span>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setActionsOpen(true)}
                className="hidden h-11 rounded-xl md:inline-flex xl:hidden"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                POS Actions
              </Button>

              <Button
                variant="outline"
                onClick={loadReceiptSetting}
                className="hidden h-11 rounded-xl xl:inline-flex"
              >
                <Store className="mr-2 h-4 w-4" />
                Reload Receipt Info
              </Button>

              <Button
                variant="outline"
                onClick={toggleTheme}
                className="h-11 rounded-full"
              >
                {dark ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {!hasHydrated ? (
          <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-88px)] max-w-[1680px] place-items-center px-4 py-10 md:px-6">
            <div className="h-12 w-12 animate-pulse rounded-2xl border border-sky-300/25 bg-sky-500/15 shadow-[0_0_34px_-14px_rgba(56,189,248,1)]" />
          </main>
        ) : !isLoggedIn ? (
          <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] max-w-[1680px] items-center justify-center px-4 py-10 md:px-6">
            <GlassCard className="w-full max-w-xl">
              <form onSubmit={startStaffSession}>
                <CardHeader className="relative z-10 space-y-4 pb-5 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-sky-300/25 bg-sky-500/15 shadow-[0_0_38px_-14px_rgba(56,189,248,1)]">
                    <ShieldCheck className="h-8 w-8 text-sky-400" />
                  </div>

                  <div>
                    <CardTitle className="text-3xl font-black tracking-tight">
                      Staff ID လိုအပ်ပါတယ်
                    </CardTitle>
                    <CardDescription className="mt-3 text-base leading-7">
                      Login ဝင်ထားတဲ့ owner ရဲ့ shop ထဲမှာရှိတဲ့ active staff ID
                      ဖြစ်မှ POS ကိုအသုံးပြုနိုင်ပါမယ်။
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="staff-gate-id" className="text-sm font-semibold">
                      Staff ID
                    </Label>

                    <div className="relative">
                      <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-400" />
                      <Input
                        id="staff-gate-id"
                        autoFocus
                        value={staffIdDraft}
                        onChange={(e) => setStaffIdDraft(e.target.value)}
                        placeholder="e.g. ST001"
                        className="h-14 rounded-2xl border-sky-400/40 bg-background/70 pl-12 text-lg shadow-[0_0_32px_-18px_rgba(56,189,248,0.95)]"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
                    Staff ID ကို Spring Boot API နဲ့စစ်ပြီး owner ရဲ့ shop staff
                    ဖြစ်မှ session စတင်ပါမယ်။
                  </div>

                  {staffLoginError && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-600 dark:text-red-300">
                      {staffLoginError}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="relative z-10 pt-2">
                  <Button
                    type="submit"
                    disabled={staffLoginLoading}
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 text-base font-bold text-white shadow-[0_0_35px_-12px_rgba(34,211,238,1)] hover:from-blue-400 hover:to-cyan-300"
                  >
                    {staffLoginLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Staff စစ်ဆေးနေသည်
                      </>
                    ) : (
                      "POS စတင်မည်"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </GlassCard>
          </main>
        ) : (
          <>
            <section className="mx-auto grid min-h-0 w-full max-w-[1680px] flex-1 grid-cols-1 gap-3 overflow-hidden px-3 py-3 md:px-4 xl:grid-cols-[1.85fr_0.95fr]">
              <GlassCard className="flex min-h-0 flex-col">
                <CardHeader className="relative z-10 shrink-0 pb-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/10 shadow-[0_0_35px_-16px_rgba(56,189,248,0.9)]">
                          <ShoppingCart className="h-6 w-6 text-sky-400" />
                        </div>

                        <div>
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-2xl font-bold tracking-tight">
                              Cart
                            </CardTitle>
                            <Badge className="rounded-full bg-blue-500 px-3 py-1 text-white">
                              {cart.length}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              items
                            </span>
                          </div>

                          <CardDescription className="mt-1">
                            {productsLoading
                              ? "Loading owner products..."
                              : `${catalog.length} products ready · ${manualActionProducts.length} action products.`}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {quickGroups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => {
                              if (!requireStaff()) return;
                              setQuickItemGroup(group.id);
                              setQuickViewOpen(true);
                            }}
                            disabled={productsLoading}
                            className="group relative h-12 overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-blue-500/10 px-3 text-left shadow-[0_0_34px_-20px_rgba(16,185,129,0.95)] transition hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl transition group-hover:bg-sky-400/25" />

                            <span className="relative flex items-center gap-2.5">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/20 bg-background/70 text-emerald-500 shadow-inner backdrop-blur dark:text-emerald-300">
                                <ManualGroupIcon groupId={group.id} />
                              </span>

                              <span className="min-w-0">
                                <span className="block whitespace-nowrap text-sm font-black text-emerald-700 dark:text-emerald-200">
                                  {group.label}
                                </span>
                                <span className="block text-[10px] font-semibold text-muted-foreground">
                                  {group.description}
                                </span>
                              </span>

                              <Badge className="ml-1 rounded-full bg-emerald-500 px-2 py-0.5 text-white">
                                {group.count}
                              </Badge>
                            </span>
                          </button>
                        ))}

                        <Button
                          variant="outline"
                          onClick={loadOwnerProducts}
                          disabled={productsLoading}
                          className="h-11 rounded-xl"
                        >
                          {productsLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Package className="mr-2 h-4 w-4" />
                          )}
                          Reload Products
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute left-5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl border border-sky-400/20 bg-sky-500/10">
                        {scanLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                        ) : (
                          <Barcode className="h-5 w-5 text-sky-400" />
                        )}
                      </div>

                      <Input
                        id="scan-input"
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleScanOrSearch();
                          }
                        }}
                        placeholder={
                          productsLoading
                            ? "Loading products..."
                            : "Scan products.barcode, SKU, DB ID or type name..."
                        }
                        disabled={productsLoading || scanLoading}
                        className="h-12 rounded-xl border-sky-400/40 bg-background/60 pl-20 pr-14 text-base shadow-[0_0_35px_-18px_rgba(56,189,248,0.95)] placeholder:text-muted-foreground focus-visible:ring-sky-400/30"
                      />

                      {query && (
                        <button
                          onClick={() => setQuery("")}
                          className="absolute right-5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}

                      {!!nameHints.length && (
                        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl">
                          {nameHints.map((product) => (
                            <button
                              key={`${product.id}-${product.dbId}`}
                              onClick={() => {
                                addToCart(product);
                                setQuery("");
                                focusScanner();
                              }}
                              className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/50"
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                                  <ProductVisual product={product} />
                                </span>

                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">
                                    {product.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Barcode {product.barcode || product.id}
                                    {product.sku ? ` · SKU ${product.sku}` : ""}
                                    {` · Stock ${product.stock ?? 0}`}
                                  </span>
                                </span>
                              </span>

                              <span className="font-semibold tabular-nums text-sky-400">
                                {money(product.price)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background/35">
                    {cart.length === 0 ? (
                      <EmptyState />
                    ) : (
                      <>
                        <div className="hidden shrink-0 grid-cols-[1.5fr_138px_125px_120px_130px_44px] border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground xl:grid">
                          <div>Item</div>
                          <div className="text-center">Qty</div>
                          <div className="text-right">Price</div>
                          <div className="text-center">Discount</div>
                          <div className="text-right">Total</div>
                          <div />
                        </div>

                        <div className="grid min-h-0 flex-1 grid-rows-[repeat(5,minmax(0,1fr))] overflow-hidden">
                          {pageSlice.map((line, index) => (
                            <motion.div
                              key={line.id}
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: index * 0.025 }}
                              className="group grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0 border-b border-border px-3 py-0.5 transition last:border-0 hover:bg-muted/30 md:px-4 xl:grid-cols-[1.5fr_138px_125px_120px_130px_44px] xl:gap-2 xl:px-4 xl:py-3"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border bg-muted/50 md:h-8 md:w-8 xl:h-10 xl:w-10 xl:rounded-xl">
                                  <CartLineVisual line={line} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[11px] font-bold leading-4 tracking-tight md:text-xs xl:text-sm xl:font-semibold">
                                    {line.name}
                                  </div>

                                  <div className="truncate text-[9px] leading-3 text-muted-foreground md:text-[10px] xl:text-xs">
                                    {line.barcode ? `Barcode ${line.barcode}` : "No barcode"}
                                    {line.sku ? ` · SKU ${line.sku}` : ""}
                                  </div>

                                  <div className="mt-0.5 text-[10px] font-semibold leading-3 tabular-nums text-muted-foreground md:text-[11px] xl:hidden">
                                    Price {money(line.price)}
                                  </div>
                                </div>
                              </div>

                              <div className="row-span-2 flex items-center justify-end md:justify-center xl:row-span-1">
                                <div className="flex items-center gap-1">
                                  <IconButton
                                    onClick={() => updateQty(line.id, line.qty - 1)}
                                    icon={<Minus className="h-3.5 w-3.5" />}
                                  />

                                  <span className="w-6 text-center text-sm font-black tabular-nums md:w-7">
                                    {line.qty}
                                  </span>

                                  <IconButton
                                    onClick={() => updateQty(line.id, line.qty + 1)}
                                    icon={<Plus className="h-3.5 w-3.5" />}
                                  />
                                </div>
                              </div>

                              <div className="hidden min-w-0 tabular-nums xl:col-start-auto xl:block xl:text-right xl:text-sm xl:font-semibold xl:text-foreground">
                                {money(line.price)}
                              </div>

                              <div className="flex items-center justify-start md:col-start-1 xl:col-start-auto xl:justify-center">
                                {canEditDiscount ? (
                                  <select
                                    value={Math.round(line.discount * 100)}
                                    onChange={(e) => updateDisc(line.id, Number(e.target.value))}
                                    className="h-5 rounded border border-input bg-background px-1.5 text-[10px] font-semibold outline-none md:h-6 xl:h-10 xl:rounded-xl xl:px-3 xl:text-sm"
                                  >
                                    {[0, 5, 10, 15, 20, 30, 50].map((v) => (
                                      <option key={v} value={v}>
                                        {v}%
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] md:text-[11px] xl:px-3 xl:py-1 xl:text-xs">
                                    {Math.round(line.discount * 100)}%
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center justify-end text-xs font-black leading-4 tabular-nums text-sky-500 md:text-[13px] xl:col-start-auto xl:block xl:text-right xl:text-base xl:font-bold xl:text-foreground">
                                <span>{money(line.qty * line.price * (1 - line.discount))}</span>
                              </div>

                              <div className="hidden justify-end xl:flex">
                                <button
                                  onClick={() => removeLine(line.id)}
                                  className="grid h-10 w-10 place-items-center rounded-xl text-red-500 transition hover:bg-red-500/10 xl:h-9 xl:w-9"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="mt-1.5 flex shrink-0 items-center justify-center gap-3 px-2 py-1">
                      <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-9 min-w-20 rounded-lg"
                      >
                        Prev
                      </Button>

                      <span className="min-w-32 text-center text-xs font-bold tabular-nums text-muted-foreground">
                        {start + 1}-{Math.min(start + PAGE_SIZE, cart.length)} /{" "}
                        {cart.length}
                      </span>

                      <Button
                        variant="outline"
                        disabled={page >= pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        className="h-9 min-w-20 rounded-lg border-sky-300/30 text-sky-500 hover:bg-sky-500/10"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="relative z-10 mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={clearCart}
                      variant="outline"
                      className="h-12 gap-2 rounded-xl border-red-400/40 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Void
                    </Button>

                    <Button
                      onClick={exportCSV}
                      variant="outline"
                      className="h-12 gap-2 rounded-xl"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>

                    <Button
                      onClick={printReceipt}
                      variant="outline"
                      className="h-12 gap-2 rounded-xl border-sky-400/35 text-sky-500 hover:bg-sky-500/10"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                  </div>

                  <Button
                    onClick={openPayment}
                    className="h-12 min-w-[220px] gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-base font-bold text-white shadow-[0_0_35px_-12px_rgba(34,211,238,1)] hover:from-blue-400 hover:to-cyan-300"
                  >
                    <CreditCard className="h-5 w-5" />
                    Pay
                  </Button>
                </CardFooter>
              </GlassCard>

              <aside className="hidden min-h-0 flex-col gap-3 overflow-hidden xl:flex">
                <GlassCard className="shrink-0">
                  <CardHeader className="relative z-10 pb-2">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <Receipt className="h-5 w-5 text-emerald-500" />
                      Checkout Summary
                    </CardTitle>
                    <CardDescription>
                      Adjust global discount or export receipt.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="relative z-10 space-y-3">
                    <MobileStaffControls
                      staffId={staffId}
                      staffName={staffName}
                      staffRole={staffRole}
                    />

                    <Row label="Subtotal" valueLabel={money(subtotal)} />
                    <Row label={`Tax (${taxRatePercent}%)`} valueLabel={money(tax)} />

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Percent className="h-4 w-4 text-sky-400" />
                          <span>Global Discount</span>
                          {!canEditDiscount && (
                            <Badge variant="secondary">Supervisor only</Badge>
                          )}
                        </div>

                        <span className="font-bold text-emerald-500">
                          {globalDiscount}%
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!canEditDiscount}
                          onClick={() =>
                            setGlobalDiscount((v) => Math.max(0, v - 1))
                          }
                          className="h-9 w-9 rounded-lg"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <Slider
                          min={0}
                          max={50}
                          step={1}
                          value={[globalDiscount]}
                          disabled={!canEditDiscount}
                          onValueChange={([v]) => setGlobalDiscount(v)}
                          className="flex-1"
                        />

                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!canEditDiscount}
                          onClick={() =>
                            setGlobalDiscount((v) => Math.min(50, v + 1))
                          }
                          className="h-9 w-9 rounded-lg"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-xl font-bold">Grand Total</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Including tax and discount
                        </div>
                      </div>

                      <div className="text-right text-3xl font-black tabular-nums text-sky-400 drop-shadow-[0_0_14px_rgba(56,189,248,0.45)]">
                        {money(grandTotal)}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="relative z-10 grid grid-cols-2 gap-3 pt-0">
                    <Button
                      onClick={exportCSV}
                      variant="outline"
                      className="h-12 gap-2 rounded-xl"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>

                    <Button
                      onClick={printReceipt}
                      variant="outline"
                      className="h-12 gap-2 rounded-xl border-sky-400/35 text-sky-500 hover:bg-sky-500/10"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>

                    <Button
                      onClick={openPayment}
                      className="col-span-2 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 font-bold text-white"
                    >
                      Pay
                    </Button>
                  </CardFooter>
                </GlassCard>

                <GlassCard className="min-h-0 shrink-0">
                  <CardHeader className="relative z-10 pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-3 text-lg">
                          <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-300/25 bg-sky-500/15 shadow-[0_0_26px_-12px_rgba(56,189,248,0.95)]">
                            <Zap className="h-5 w-5 text-sky-400" />
                          </span>
                          POS Actions
                        </CardTitle>
                      </div>

                      <Badge className="rounded-full bg-sky-500/15 px-3 py-1 text-sky-500">
                        Ready
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10">
                    <button
                      onClick={() => setActionsOpen(true)}
                      className="group relative w-full overflow-hidden rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-500/15 via-cyan-500/10 to-blue-500/10 p-3 text-left shadow-[0_0_42px_-24px_rgba(56,189,248,1)] transition hover:border-sky-300/45"
                    >
                      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl transition group-hover:bg-sky-400/30" />

                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-background/60 backdrop-blur-xl">
                            <Settings2 className="h-5 w-5 text-sky-400" />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-black">
                              Open Action Center
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              More POS tools
                            </div>
                          </div>
                        </div>

                        <ArrowRight className="h-5 w-5 text-sky-400 transition group-hover:translate-x-1" />
                      </div>
                    </button>
                  </CardContent>
                </GlassCard>
              </aside>
            </section>

            <BarcodeLessProductDialog
              open={quickViewOpen}
              setOpen={setQuickViewOpen}
              products={quickViewProducts}
              activeGroup={activeQuickGroup}
              addItem={addQuickItem}
              money={money}
            />

            <POSActionsDialog
              open={actionsOpen}
              setOpen={setActionsOpen}
              focusScanner={focusScanner}
              openPayment={openPayment}
              clearCart={clearCart}
              cartItemCount={cart.length}
              routerPush={(path) => router.push(path)}
            />

            <PaymentDialog
              open={paymentOpen}
              setOpen={setPaymentOpen}
              cart={cart}
              subtotal={subtotal}
              tax={tax}
              taxRatePercent={taxRatePercent}
              grandTotal={grandTotal}
              exportCSV={exportCSV}
              printReceipt={printReceipt}
              saving={receiptSaving}
              onComplete={completePayment}
              money={money}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SoftBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl" />
    </>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`relative overflow-hidden border-border/70 bg-card/75 shadow-[0_18px_80px_-40px_rgba(56,189,248,0.7)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-sky-500/8" />
      {children}
    </Card>
  );
}

function IconButton({
  onClick,
  icon,
}: {
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-md border border-border bg-background/80 text-foreground shadow-sm transition hover:bg-muted md:h-7 md:w-7 xl:h-9 xl:w-9 xl:rounded-xl"
    >
      {icon}
    </button>
  );
}

function Row({
  label,
  valueLabel,
}: {
  label: string;
  valueLabel: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{valueLabel}</span>
    </div>
  );
}

function MobileStaffControls({
  staffId,
  staffName,
  staffRole,
}: {
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:hidden">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Staff Name</Label>
        <Input value={staffName || staffId} readOnly />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Role</Label>
        <div className="flex h-10 w-full items-center rounded-xl border border-input bg-background px-3 text-sm font-semibold capitalize">
          {staffRole === "supervise" ? "Supervisor" : "Staff"}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-[360px] place-items-center p-10 text-center">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-border bg-muted/50">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="mt-5 text-xl font-bold">No items yet</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Scan products table barcode, type SKU, or type product name.
        </p>
      </div>
    </div>
  );
}

function BarcodeLessProductDialog({
  open,
  setOpen,
  products,
  activeGroup,
  addItem,
  money,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  products: Product[];
  activeGroup: QuickItemGroup;
  addItem: (product: Product) => void;
  money: (amount: number) => string;
}) {
  const [dialogPage, setDialogPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(products.length / MANUAL_DIALOG_PAGE_SIZE));
  const pageStart = (dialogPage - 1) * MANUAL_DIALOG_PAGE_SIZE;
  const pageProducts = products.slice(pageStart, pageStart + MANUAL_DIALOG_PAGE_SIZE);

  useEffect(() => {
    if (open) setDialogPage(1);
  }, [open, activeGroup.id]);

  useEffect(() => {
    setDialogPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden border-border bg-card p-0 text-card-foreground sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border bg-background/80 px-5 py-4 pr-14">
          <div className="flex min-w-0 flex-col gap-2">
            <DialogTitle className="flex min-w-0 items-center gap-3 text-xl font-black tracking-tight">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/35 bg-emerald-500/15 text-emerald-500">
                <Eye className="h-5 w-5" />
              </span>
              <span className="shrink-0">{activeGroup.emoji}</span>
              <span className="truncate">{activeGroup.label}</span>
            </DialogTitle>

            <div>
              <Badge className="rounded-full bg-emerald-500 px-3 py-1 text-white">
                {products.length} item(s)
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
          {products.length === 0 ? (
            <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-border bg-background/45 p-8 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted text-3xl">
                  🛒
                </div>
                <h3 className="mt-4 text-xl font-black">No product found</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  ဒီ action button နဲ့ကိုက်တဲ့ product မရှိသေးပါ။ Add Product မှာ category/name ကို သက်ဆိုင်ရာ type နဲ့သိမ်းထားပါ။
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pageProducts.map((product) => {
                const stock = Number(product.stock ?? 0);
                const outOfStock = stock <= 0;

                return (
                  <motion.div
                    key={`${product.id}-${product.dbId}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group overflow-hidden rounded-2xl border bg-background/60 transition hover:bg-muted/30 ${
                      outOfStock
                        ? "border-red-300/30 opacity-70"
                        : "border-border hover:border-emerald-300/50"
                    }`}
                  >
                    <div className="relative h-24 overflow-hidden bg-muted">
                      <ProductVisual product={product} />
                      <Badge className="absolute left-3 top-3 rounded-full bg-background/85 text-foreground backdrop-blur">
                        {product.category || "General"}
                      </Badge>
                      <Badge
                        className={`absolute right-3 top-3 rounded-full ${
                          outOfStock
                            ? "bg-red-500 text-white"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        Stock {stock}
                      </Badge>
                    </div>

                    <div className="space-y-2 p-3">
                      <div className="min-h-[44px]">
                        <h4 className="line-clamp-2 text-base font-black leading-6">
                          {product.name}
                        </h4>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {product.barcode ? `Barcode ${product.barcode}` : "No barcode"}
                          {product.sku ? ` · SKU ${product.sku}` : ""}
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            Price
                          </div>
                          <div className="text-lg font-black tabular-nums text-emerald-500">
                            {money(product.price)}
                          </div>
                        </div>

                        <Button
                          onClick={() => addItem(product)}
                          disabled={outOfStock}
                          className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-400 px-3 font-black text-white shadow-[0_0_24px_-12px_rgba(16,185,129,0.9)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background/45 px-5 py-3">
          <div className="mr-auto text-sm font-semibold text-muted-foreground">
            {products.length > 0
              ? `Showing ${pageStart + 1}-${Math.min(pageStart + MANUAL_DIALOG_PAGE_SIZE, products.length)} of ${products.length}`
              : "Showing 0 item"}
          </div>

          {products.length > MANUAL_DIALOG_PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={dialogPage <= 1}
                onClick={() => setDialogPage((page) => Math.max(1, page - 1))}
                className="h-10 rounded-xl"
              >
                Prev
              </Button>

              <span className="min-w-20 text-center text-sm font-black tabular-nums text-muted-foreground">
                {dialogPage} / {pageCount}
              </span>

              <Button
                variant="outline"
                disabled={dialogPage >= pageCount}
                onClick={() => setDialogPage((page) => Math.min(pageCount, page + 1))}
                className="h-10 rounded-xl border-emerald-400/35 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-300"
              >
                Next
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function POSActionsDialog({
  open,
  setOpen,
  focusScanner,
  openPayment,
  clearCart,
  cartItemCount,
  routerPush,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  focusScanner: () => void;
  openPayment: () => void;
  clearCart: () => void;
  cartItemCount: number;
  routerPush: (path: string) => void;
}) {
  const actions: {
    label: string;
    desc: string;
    badge: string;
    icon: React.ReactElement<{ className?: string }>;
    onClick: () => void;
  }[] = [
    {
      label: "Scan Product",
      desc: "Barcode scanner input ကို focus ပြန်လုပ်မယ်",
      badge: "Ctrl + F",
      icon: <Barcode />,
      onClick: focusScanner,
    },
    {
      label: "Start Payment",
      desc: "Cash / Card payment dialog ကိုဖွင့်မယ်",
      badge: "P",
      icon: <CreditCard />,
      onClick: openPayment,
    },
    {
      label: "Refund Receipt",
      desc: "Receipt No နဲ့ရှာပြီး item return / refund လုပ်မယ်",
      badge: "Return",
      icon: <RotateCcw />,
      onClick: () => routerPush("/refund"),
    },
    {
      label: "Receipt Shop Info",
      desc: "Receipt မှာထွက်မယ့် ဆိုင်လိပ်စာ၊ ဖုန်းနံပါတ်၊ currency ကိုပြင်မယ်",
      badge: "Settings",
      icon: <Store />,
      onClick: () => routerPush("/settings/shop"),
    },
    {
      label: "Clear Cart",
      desc: `${cartItemCount} item(s) ကို cart ထဲကဖျက်မယ်`,
      badge: "Void",
      icon: <Trash2 />,
      onClick: clearCart,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-border bg-card text-card-foreground sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-sky-400" />
            POS Action Center
          </DialogTitle>
          <DialogDescription>
            POS မှာ အသုံးများတဲ့ action တွေကို ဒီနေရာကနေ အမြန်သုံးနိုင်ပါတယ်။
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className="rounded-2xl border border-border bg-background/50 p-4 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-400">
                    {React.cloneElement(action.icon, {
                      className: "h-5 w-5",
                    })}
                  </div>

                  <div className="min-w-0">
                    <div className="font-black">{action.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {action.desc}
                    </div>
                  </div>
                </div>

                <Badge variant="secondary">{action.badge}</Badge>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  setOpen,
  cart,
  subtotal,
  tax,
  taxRatePercent,
  grandTotal,
  exportCSV,
  printReceipt,
  saving,
  onComplete,
  money,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  cart: CartLine[];
  subtotal: number;
  tax: number;
  taxRatePercent: number;
  grandTotal: number;
  exportCSV: () => void;
  printReceipt: () => void;
  saving: boolean;
  onComplete: (method: PaymentMethod, cashGivenAmount: number) => void;
  money: (amount: number) => string;
}) {
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [cashGiven, setCashGiven] = useState("");

  const cashNum = Number(cashGiven || 0);
  const cashEnough = payMethod === "card" || cashNum >= grandTotal;
  const change = payMethod === "cash" ? Math.max(0, cashNum - grandTotal) : 0;
  const cashShort = payMethod === "cash" ? Math.max(0, grandTotal - cashNum) : 0;

  useEffect(() => {
    if (open) {
      setPayMethod("cash");
      setCashGiven("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90dvh] flex-col border-border bg-card text-card-foreground sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sky-400" />
            Payment
          </DialogTitle>
          <DialogDescription>
            Cash / Card payment ကိုရွေးပြီး receipt save လုပ်ပါ။
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[1fr_0.85fr]">
          <div className="min-h-0 rounded-3xl border border-border bg-background/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3 font-bold">
              <span className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-sky-400" />
                Receipt Preview
              </span>
              <Badge variant="secondary" className="rounded-full">
                {cart.length} items
              </Badge>
            </div>

            <div className="max-h-[440px] overflow-auto pr-1">
              {cart.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border py-2.5 first:pt-0 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      <CartLineVisual line={line} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-semibold">{line.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {line.qty} × {money(line.price)} · {line.barcode || line.sku || "No barcode"}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-bold tabular-nums">
                    {money(line.qty * line.price * (1 - line.discount))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-3xl border border-border bg-background/40 p-4">
              <div className="space-y-2">
                <Row label="Subtotal" valueLabel={money(subtotal)} />
                <Row label={`Tax (${taxRatePercent}%)`} valueLabel={money(tax)} />
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className="text-3xl font-black text-sky-400">
                    {money(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/40 p-4">
              <Label>Payment Method</Label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={payMethod === "cash" ? "default" : "outline"}
                  onClick={() => setPayMethod("cash")}
                  className="h-12 rounded-xl"
                >
                  Cash
                </Button>

                <Button
                  type="button"
                  variant={payMethod === "card" ? "default" : "outline"}
                  onClick={() => setPayMethod("card")}
                  className="h-12 rounded-xl"
                >
                  Card
                </Button>
              </div>

              {payMethod === "cash" && (
                <div className="mt-4 space-y-2">
                  <Label>Cash Given</Label>
                  <Input
                    type="number"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    placeholder="Enter cash amount"
                    className="h-12 rounded-xl text-lg"
                  />

                  <div
                    className={`rounded-3xl border p-4 ${
                      cashEnough
                        ? "border-emerald-400/40 bg-emerald-500/15"
                        : "border-red-400/40 bg-red-500/15"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                          cashEnough
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {cashEnough ? (
                          <Receipt className="h-5 w-5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-black uppercase tracking-[0.14em] ${
                            cashEnough ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {cashEnough ? "Change to return" : "Cash not enough"}
                        </div>

                        <div
                          className={`mt-1 text-4xl font-black tabular-nums ${
                            cashEnough ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
                          {money(cashEnough ? change : cashShort)}
                        </div>

                        <div className="mt-2 text-sm font-semibold text-muted-foreground">
                          {cashEnough
                            ? "ငွေပြန်အမ်းရန် amount ကို customer ကိုမမေ့ဘဲပေးပါ။"
                            : "Payment complete မလုပ်ခင် cash amount ထပ်ထည့်ပါ။"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background/45 px-6 py-4">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>

          <Button variant="outline" onClick={printReceipt}>
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>

          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button
            onClick={() => onComplete(payMethod, cashNum)}
            disabled={saving || (payMethod === "cash" && !cashEnough)}
            className="bg-gradient-to-r from-blue-500 to-cyan-400 font-bold text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Receipt...
              </>
            ) : (
              "Complete Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
