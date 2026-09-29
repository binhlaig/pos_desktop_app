"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useZxing } from "react-zxing";
import { fetchStaffById } from "@/lib/staff-validation";

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
  Paperclip,
  Camera,
  Keyboard,
  ScanLine,
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
import {
  readAvailableForSale,
  unavailableToastMessage,
} from "@/lib/product-availability";

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
  availableForSale: boolean;
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
type ScanSource = "manual" | "hardware" | "camera";

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
const CART_PAGE_SIZE = 5;
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
    availableForSale: readAvailableForSale(item),
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

function normalizeValidatedStaff(
  payload: unknown,
  fallbackStaffId: string,
): NonNullable<StaffSessionResponse["staff"]> | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const nested = root.staff ?? root.data ?? root.result ?? root.user ?? root;

  if (!nested || typeof nested !== "object") return null;

  const staff = nested as Record<string, unknown>;
  const readString = (keys: string[]) => {
    for (const key of keys) {
      const value = staff[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return "";
  };
  const role = readString(["role", "staffRole"]).toLowerCase();

  return {
    id:
      readString([
        "staffId",
        "staff_id",
        "staffCode",
        "staff_code",
        "id",
        "username",
      ]) || fallbackStaffId,
    name: readString(["staffName", "name", "fullName", "username"]),
    role:
      role === "supervise" || role === "supervisor" || role === "admin"
        ? "supervise"
        : "staff",
  };
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
  const [cartPage, setCartPage] = useState(1);
  const previousCartLengthRef = useRef(0);
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
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState<{
    code: string;
    source: ScanSource;
  } | null>(null);
  const [quickItemGroup, setQuickItemGroup] = useState(QUICK_ITEM_GROUPS[0]?.id || "fried");

  const [taxRatePercent, setTaxRatePercent] = useState(DEFAULT_TAX_RATE_PERCENT);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const lastAutoScanRef = useRef("");
  const scanInFlightRef = useRef(false);
  const scannerBufferRef = useRef("");
  const scannerLastKeyAtRef = useRef(0);
  const scannerResetTimerRef = useRef<number | null>(null);
  const hardwareScanHandlerRef = useRef<(barcode: string) => void>(() => {});

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

  const cartPageCount = Math.max(1, Math.ceil(cart.length / CART_PAGE_SIZE));
  const cartPageStart = (cartPage - 1) * CART_PAGE_SIZE;
  const visibleCartLines = cart.slice(cartPageStart, cartPageStart + CART_PAGE_SIZE);

  useEffect(() => {
    const previousLength = previousCartLengthRef.current;
    if (cart.length > previousLength) {
      // Show a newly added line, including the first cart restored from storage.
      setCartPage(Math.ceil(cart.length / CART_PAGE_SIZE));
    } else {
      // Removing an item on the last page must not leave an empty page visible.
      setCartPage((current) => Math.min(current, Math.max(1, Math.ceil(cart.length / CART_PAGE_SIZE))));
    }
    previousCartLengthRef.current = cart.length;
  }, [cart.length]);


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
    if (!isLoggedIn) return;
    const refresh = () => void loadOwnerProducts({ silent: true });
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [isLoggedIn]);

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
      if (scannerBufferRef.current) return;

      if (e.key.toLowerCase() === "p") openPayment();
      if (e.key === "Delete" && cart.length) clearCart();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, staffId, staffRole]);

  /**
   * USB/Bluetooth barcode scanners on iPad and Android tablets normally act
   * like a very fast keyboard and finish the value with Enter. This listener
   * keeps scanning available even when the barcode input has lost focus.
   */
  useEffect(() => {
    if (!isLoggedIn || cameraScannerOpen) return;

    const resetBuffer = () => {
      scannerBufferRef.current = "";
      scannerLastKeyAtRef.current = 0;

      if (scannerResetTimerRef.current !== null) {
        window.clearTimeout(scannerResetTimerRef.current);
        scannerResetTimerRef.current = null;
      }
    };

    const onHardwareScannerKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;

      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      // The main scan input already handles scanner input and Enter itself.
      if (isEditable) return;

      if (event.key === "Enter") {
        const barcode = scannerBufferRef.current.trim();
        resetBuffer();

        if (barcode.length >= 4) {
          event.preventDefault();
          hardwareScanHandlerRef.current(barcode);
        }
        return;
      }

      if (event.key.length !== 1) return;

      const now = performance.now();
      const elapsed = now - scannerLastKeyAtRef.current;

      // A pause means this is normal typing, so start a fresh scanner packet.
      if (scannerLastKeyAtRef.current && elapsed > 100) {
        scannerBufferRef.current = "";
      }

      scannerBufferRef.current += event.key;
      scannerLastKeyAtRef.current = now;

      if (scannerResetTimerRef.current !== null) {
        window.clearTimeout(scannerResetTimerRef.current);
      }

      scannerResetTimerRef.current = window.setTimeout(resetBuffer, 180);
    };

    window.addEventListener("keydown", onHardwareScannerKey, true);
    return () => {
      window.removeEventListener("keydown", onHardwareScannerKey, true);
      resetBuffer();
    };
  }, [isLoggedIn, cameraScannerOpen]);

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

  async function loadOwnerProducts(options: { silent?: boolean } = {}) {
    if (!options.silent) setProductsLoading(true);

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
        return loadedProducts;
      }

      if (!options.silent) toast.success(`${loadedProducts.length} products loaded`);
      return loadedProducts;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Products load failed.";

      setCatalog([]);
      if (!options.silent) toast.error(message);
      return [];
    } finally {
      if (!options.silent) setProductsLoading(false);
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

      const accessToken = getAccessToken();

      if (!accessToken) {
        throw new Error("401 Unauthorized: Login session has expired.");
      }

      const payload = await fetchStaffById(nextStaffId, accessToken);
      const staff = normalizeValidatedStaff(payload, nextStaffId);

      if (!staff?.id) {
        throw new Error("Staff validation returned an invalid response.");
      }

      setStaffId(staff.id);
      setStaffIdDraft(staff.id);
      setStaffName(staff.name || "");
      setStaffRole(staff.role === "supervise" ? "supervise" : "staff");

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

    if (!p.availableForSale) {
      toast.error(unavailableToastMessage(p.name));
      return false;
    }

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
      return true;
    }

    return false;
  }

  async function processProductCode(
    rawValue: string,
    source: ScanSource,
    allowNameSearch = false
  ) {
    if (!requireStaff()) return;

    const raw = rawValue.trim();
    if (!raw) return;
    if (scanInFlightRef.current) return;

    scanInFlightRef.current = true;
    setScanLoading(true);
    setLastScan({ code: raw, source });

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
          window.setTimeout(focusScanner, 80);
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
          window.setTimeout(focusScanner, 80);
        }

        return;
      }

      if (!allowNameSearch) {
        toast.error(`Barcode not found: ${raw}`);
        return;
      }

      const byName = catalog.find(
        (p) => p.name.toLowerCase() === normalizedRaw
      );

      if (byName) {
        if (addToCart(byName)) {
          setQuery("");
          window.setTimeout(focusScanner, 80);
        }
        return;
      }

      const firstNameHint = catalog.find((p) =>
        p.name.toLowerCase().includes(normalizedRaw)
      );

      if (firstNameHint) {
        if (addToCart(firstNameHint)) {
          setQuery("");
          window.setTimeout(focusScanner, 80);
        }
        return;
      }

      toast.error(`Barcode not found: ${raw}`);
    } finally {
      scanInFlightRef.current = false;
      setScanLoading(false);
    }
  }

  async function handleScanOrSearch() {
    await processProductCode(query, "manual", true);
  }

  hardwareScanHandlerRef.current = (barcode: string) => {
    void processProductCode(barcode, "hardware");
  };

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

    const latestProducts = await loadOwnerProducts({ silent: true });
    const unavailableItem = cart.find((line) => {
      const product = latestProducts.find(
        (p) =>
          p.id === line.id ||
          (!!line.dbId && p.dbId === line.dbId) ||
          (!!line.barcode && p.barcode === line.barcode) ||
          (!!line.sku && p.sku === line.sku),
      );
      return !product || !product.availableForSale;
    });

    if (unavailableItem) {
      toast.error(unavailableToastMessage(unavailableItem.name));
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
      const product = latestProducts.find(
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
    <div className="flex h-[100dvh] overflow-hidden bg-muted/30 text-foreground">

      <div className="relative z-10 flex min-h-0 w-full flex-col">
        <header className="shrink-0 border-b border-border bg-background">
          <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-2 md:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight">Nimi Mark <span className="text-primary">POS</span></h1>
                <p className="truncate text-[11px] text-muted-foreground">Register · {receiptSetting.currencyCode}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium sm:flex">
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
                onClick={toggleTheme}
                aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
                className="h-9 w-9 rounded-lg p-0"
              >
                {dark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
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
            <section className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-2 overflow-hidden px-3 py-2 md:px-4">
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-500" />
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
                    placeholder={productsLoading ? "Loading products..." : "Scan barcode / SKU or search product"}
                    disabled={productsLoading || scanLoading}
                    className="h-12 rounded-xl border-sky-400/40 bg-background pl-11 pr-10 text-base"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!!nameHints.length && (
                    <div className="absolute inset-x-0 top-14 z-30 max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
                      {nameHints.map((product) => (
                        <button
                          key={`${product.id}-${product.dbId}`}
                          type="button"
                          onClick={() => { addToCart(product); setQuery(""); focusScanner(); }}
                          className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border px-4 py-2 text-left last:border-0 hover:bg-muted/50"
                        >
                          <span className="min-w-0 truncate font-semibold">{product.name}</span>
                          <span className="shrink-0 tabular-nums">{product.availableForSale ? money(product.price) : "Out of Stock"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" variant="secondary" onClick={() => setCameraScannerOpen(true)} disabled={productsLoading || scanLoading} className="h-12 shrink-0 rounded-xl px-3">
                  <Camera className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Camera</span>
                </Button>
                <Button type="button" variant="outline" onClick={() => setActionsOpen(true)} className="h-12 shrink-0 rounded-xl px-3">
                  <Settings2 className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Actions</span>
                </Button>
              </div>

              <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5" aria-label="Items without barcode">
                {quickGroups.map((group) => (
                  <Button
                    key={group.id}
                    type="button"
                    variant={group.id === "fried" ? "warning" : group.id === "drink" ? "default" : "success"}
                    onClick={() => {
                      if (!requireStaff()) return;
                      setQuickItemGroup(group.id);
                      setQuickViewOpen(true);
                    }}
                    disabled={productsLoading}
                    className="group flex h-12 min-w-[170px] flex-1 items-center justify-start gap-2 rounded-xl px-3 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20">
                      <ManualGroupIcon groupId={group.id} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{group.label}</span>
                      <span className="block truncate text-[10px] font-medium opacity-75">{group.description}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold tabular-nums">{group.count}</span>
                  </Button>
                ))}
              </div>

              <Card className="flex min-h-0 flex-1 flex-col !gap-0 overflow-hidden border-border bg-card !py-0 shadow-sm">
                <CardHeader className="relative z-10 flex shrink-0 flex-row items-center justify-between border-b border-border px-4 py-2">
                  <CardTitle className="flex items-center gap-2 text-lg"><ShoppingCart className="h-5 w-5 text-primary" />Cart <Badge variant="info">{cart.length}</Badge></CardTitle>
                  <span className="truncate text-xs text-muted-foreground">{lastScan ? `Last scan: ${lastScan.code}` : `${catalog.length} products ready`}</span>
                </CardHeader>
                <CardContent className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 py-0 touch-pan-y min-[1000px]:overflow-hidden" aria-label="Cart items">
                  {cart.length === 0 ? <EmptyState /> : (
                    <div className="divide-y divide-border min-[1000px]:grid min-[1000px]:h-full min-[1000px]:grid-rows-[repeat(5,minmax(0,1fr))] min-[1000px]:divide-y-0">
                      {visibleCartLines.map((line) => (
                        <div key={line.id} className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px_130px_44px] sm:px-4 min-[1000px]:min-h-0 min-[1000px]:py-1">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"><CartLineVisual line={line} /></div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{line.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{money(line.price)} each{line.barcode ? ` · ${line.barcode}` : ""}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Discount</span>
                                {canEditDiscount ? (
                                  <select value={Math.round(line.discount * 100)} onChange={(e) => updateDisc(line.id, Number(e.target.value))} aria-label={`Discount for ${line.name}`} className="h-8 rounded-md border border-input bg-background px-2">
                                    {[0, 5, 10, 15, 20, 30, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
                                  </select>
                                ) : <span>{Math.round(line.discount * 100)}%</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1 sm:justify-center">
                            <IconButton onClick={() => updateQty(line.id, line.qty - 1)} icon={<Minus className="h-4 w-4" />} />
                            <span className="w-7 text-center font-bold tabular-nums">{line.qty}</span>
                            <IconButton onClick={() => updateQty(line.id, line.qty + 1)} icon={<Plus className="h-4 w-4" />} />
                          </div>
                          <div className="col-start-1 pl-14 text-sm font-bold tabular-nums sm:col-start-auto sm:pl-0 sm:text-right">{money(line.qty * line.price * (1 - line.discount))}</div>
                          <button type="button" onClick={() => removeLine(line.id)} aria-label={`Remove ${line.name}`} className="grid h-11 w-11 place-items-center justify-self-end rounded-lg text-red-500 hover:bg-red-500/10 sm:col-start-auto"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                {cart.length > CART_PAGE_SIZE && (
                  <nav className="flex h-11 shrink-0 items-center justify-center gap-3 border-t border-border bg-card px-3" aria-label="Cart pages">
                    <Button type="button" variant="outline" onClick={() => setCartPage((current) => Math.max(1, current - 1))} disabled={cartPage <= 1} className="h-8 min-w-20 rounded-lg">Prev</Button>
                    <span className="min-w-28 text-center text-xs font-semibold tabular-nums" aria-live="polite">
                      {cartPageStart + 1}–{Math.min(cartPageStart + CART_PAGE_SIZE, cart.length)} / {cart.length}
                    </span>
                    <Button type="button" variant="outline" onClick={() => setCartPage((current) => Math.min(cartPageCount, current + 1))} disabled={cartPage >= cartPageCount} className="h-8 min-w-20 rounded-lg">Next</Button>
                  </nav>
                )}
                <CardFooter className="relative z-10 shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-3 py-2 sm:px-4">
                  <div className="flex w-full items-center justify-between gap-3 text-xs sm:text-sm">
                    <span className="text-muted-foreground">Subtotal {money(subtotal)} · Tax {money(tax)}</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" onClick={() => void loadOwnerProducts()} disabled={productsLoading} className="hidden h-9 px-2 text-xs sm:inline-flex"><RotateCcw className="mr-1 h-3.5 w-3.5" />Products</Button>
                      <Button type="button" variant="ghost" onClick={loadReceiptSetting} className="hidden h-9 px-2 text-xs sm:inline-flex"><Receipt className="mr-1 h-3.5 w-3.5" />Receipt info</Button>
                      <Button type="button" variant="ghost" onClick={exportCSV} disabled={!cart.length} aria-label="Export cart CSV" className="h-9 px-2"><Download className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" onClick={printReceipt} disabled={!cart.length} aria-label="Print receipt" className="h-9 px-2"><Printer className="h-4 w-4" /></Button>
                      <label className="flex items-center gap-2">Discount
                        <select value={globalDiscount} onChange={(e) => setGlobalDiscount(Number(e.target.value))} disabled={!canEditDiscount} aria-label="Global discount" className="h-9 rounded-lg border border-input bg-background px-2 disabled:opacity-60">
                          {[0, 5, 10, 15, 20, 30, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <Button type="button" variant="danger" onClick={clearCart} disabled={!cart.length} className="h-12 shrink-0 rounded-xl px-3"><Trash2 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Void</span></Button>
                    <div className="min-w-0 flex-1 text-right"><div className="text-xs text-muted-foreground">Total due</div><div className="truncate text-xl font-black tabular-nums text-red-500 sm:text-2xl">{money(grandTotal)}</div></div>
                    <Button type="button" onClick={openPayment} disabled={!cart.length} className="h-12 min-w-[120px] shrink-0 rounded-xl text-base font-bold sm:min-w-[180px]"><CreditCard className="mr-2 h-5 w-5" />Pay</Button>
                  </div>
                </CardFooter>
              </Card>
            </section>

            <BarcodeLessProductDialog
              open={quickViewOpen}
              setOpen={setQuickViewOpen}
              products={quickViewProducts}
              activeGroup={activeQuickGroup}
              addItem={addQuickItem}
              money={money}
            />

            {cameraScannerOpen && (
              <CameraBarcodeScanner
                onClose={() => {
                  setCameraScannerOpen(false);
                  window.setTimeout(focusScanner, 120);
                }}
                onDetected={(barcode) => {
                  setCameraScannerOpen(false);
                  void processProductCode(barcode, "camera");
                }}
              />
            )}

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

function CameraBarcodeScanner({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (barcode: string) => void;
}) {
  const [cameraError, setCameraError] = useState("");
  const detectedRef = useRef(false);

  const { ref } = useZxing({
    constraints: {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    timeBetweenDecodingAttempts: 120,
    onDecodeResult(result) {
      // react-zxing version အလိုက် Result#getText() သို့မဟုတ်
      // DetectedBarcode.rawValue ပြန်လာနိုင်တာကြောင့် နှစ်မျိုးလုံး support လုပ်ထားသည်။
      const decoded = result as unknown as {
        rawValue?: string;
        text?: string;
        getText?: () => string;
      };
      const barcode = clean(
        typeof decoded.getText === "function"
          ? decoded.getText()
          : decoded.rawValue ?? decoded.text ?? ""
      );
      if (!barcode || detectedRef.current) return;

      detectedRef.current = true;
      navigator.vibrate?.(80);
      onDetected(barcode);
    },
    onError(error) {
      const errorName = error instanceof Error ? error.name : "";

      // These are normal frame-by-frame decoder misses, not camera failures.
      if (/NotFound|Checksum|Format/i.test(errorName)) return;

      setCameraError(
        errorName === "NotAllowedError"
          ? "Camera permission ပိတ်ထားပါတယ်။ Browser Settings မှာ Camera ကို Allow လုပ်ပါ။"
          : "Camera ဖွင့်မရပါ။ HTTPS, camera permission နှင့် အခြား app က camera သုံးနေခြင်းကို စစ်ပါ။"
      );
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera barcode scanner"
      className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col bg-slate-950 text-white"
      style={{
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        paddingLeft: "max(12px, env(safe-area-inset-left))",
        paddingRight: "max(12px, env(safe-area-inset-right))",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lg font-black sm:text-xl">
            <Camera className="h-5 w-5 text-sky-400" />
            Camera Barcode Scan
          </div>
          <p className="mt-1 truncate text-xs text-slate-300 sm:text-sm">
            Barcode ကို ဘောင်အလယ်မှာထားပါ — ဖတ်ပြီးတာနဲ့ cart ထဲ အလိုအလျောက်ထည့်ပါမယ်။
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 transition hover:bg-white/20 active:scale-95"
          aria-label="Close camera"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
        <video
          ref={ref}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,.40),transparent_25%,transparent_75%,rgba(2,6,23,.55))]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-[2.3/1] w-[86%] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-sky-300 shadow-[0_0_0_9999px_rgba(2,6,23,.24),0_0_34px_rgba(56,189,248,.75)]">
          <span className="absolute left-4 top-4 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-white" />
          <span className="absolute right-4 top-4 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-white" />
          <span className="absolute bottom-4 left-4 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-white" />
          <span className="absolute bottom-4 right-4 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-white" />
          <span className="absolute left-[8%] right-[8%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-gradient-to-r from-transparent via-sky-300 to-transparent shadow-[0_0_14px_rgba(125,211,252,1)]" />
        </div>

        {cameraError && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-red-300/30 bg-red-950/90 p-4 text-sm font-semibold leading-6 text-red-100 backdrop-blur">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <span>{cameraError}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 pt-3 text-center text-xs font-semibold text-slate-300 sm:text-sm">
        <ScanLine className="h-4 w-4 text-sky-400" />
        Rear camera ကိုသုံးထားပါတယ် · Safari / Chrome Camera permission လိုအပ်ပါတယ်
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
      type="button"
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-md border border-border bg-background/80 text-foreground shadow-sm transition hover:bg-muted active:scale-95 md:h-7 md:w-7 min-[1000px]:h-11 min-[1000px]:w-11 min-[1000px]:rounded-xl min-[1000px]:border-sky-400/25 min-[1000px]:bg-sky-500/10 xl:h-9 xl:w-9"
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
                const outOfStock = !product.availableForSale || stock <= 0;

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
                        {!product.availableForSale ? "Out of Stock" : `Stock ${stock}`}
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
                          aria-disabled={outOfStock}
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
      onClick: () => routerPush("/settings/refund"),
    },
    {
      label: "Receipt Shop Info",
      desc: "Receipt မှာထွက်မယ့် ဆိုင်လိပ်စာ၊ ဖုန်းနံပါတ်၊ currency ကိုပြင်မယ်",
      badge: "Settings",
      icon: <Store />,
      onClick: () => routerPush("/settings/shop"),
    },
    {
      label: "Receipt Info",
      desc: "payment လုပ်ပြီး receipt မှာထွက်မယ့် info",
      badge: "Settings",
      icon: <Paperclip />,
      onClick: () => routerPush("/settings/receipts"),
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
      <DialogContent className="flex h-[calc(100dvh-24px)] max-h-[760px] w-[calc(100vw-24px)] max-w-[1000px] flex-col gap-0 overflow-hidden border-border bg-card p-0 text-card-foreground sm:w-[calc(100vw-32px)] sm:max-w-[1000px]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sky-400" />
            Payment
          </DialogTitle>
          <DialogDescription>
            Cash / Card payment ကိုရွေးပြီး receipt save လုပ်ပါ။
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:overflow-hidden sm:p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex min-h-[220px] flex-col rounded-xl border border-border bg-background/40 p-3 sm:min-h-0">
            <div className="mb-3 flex items-center justify-between gap-3 font-bold">
              <span className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-sky-400" />
                Receipt Preview
              </span>
              <Badge variant="secondary" className="rounded-full">
                {cart.length} items
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
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

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain">
            <div className="shrink-0 rounded-xl border border-border bg-background/40 p-3">
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

            <div className="shrink-0 rounded-xl border border-border bg-background/40 p-3">
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

        <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-background/45 px-3 py-3 sm:flex sm:flex-wrap sm:justify-end sm:px-4">
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
