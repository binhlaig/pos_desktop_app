// "use client";

// import { useEffect, useMemo, useState } from "react";
// import {
//   ArrowLeft,
//   BadgeCheck,
//   Clock3,
//   Copy,
//   Loader2,
//   MapPin,
//   Megaphone,
//   Minus,
//   Moon,
//   Phone,
//   Percent,
//   Plus,
//   Printer,
//   Receipt,
//   RefreshCcw,
//   Save,
//   ShoppingBag,
//   Sparkles,
//   Store,
//   Sun,
// } from "lucide-react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";

// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";

// type ReceiptAd = {
//   id?: number | null;
//   title?: string | null;
//   message?: string | null;
//   active?: boolean;
// };

// type ReceiptShopInfo = {
//   shopName: string;
//   address: string;
//   phone: string;
//   secondPhone: string;
//   footerMessage: string;
//   taxRatePercent: number;
//   ads: ReceiptAd[];
// };

// const EMPTY_RECEIPT_PLACEHOLDERS = [
//   "Shop address မထည့်ရသေးပါ",
//   "Phone No မထည့်ရသေးပါ",
// ];

// const DEFAULT_INFO: ReceiptShopInfo = {
//   shopName: "Clear Blue Light POS",
//   address: "",
//   phone: "",
//   secondPhone: "",
//   footerMessage: "Thank you for shopping",
//   taxRatePercent: 10,
//   ads: [],
// };

// const TAX_RATE_STORAGE_KEY = "receipt_tax_rate_percent";
// const SHOP_PRINT_INFO_STORAGE_KEY = "receipt_shop_print_info";
// const SHOP_SETTINGS_UPDATED_EVENT = "receipt-shop-settings-updated";

// function clean(value: unknown) {
//   const text = String(value ?? "").trim();

//   if (!text) return "";
//   if (EMPTY_RECEIPT_PLACEHOLDERS.includes(text)) return "";
//   if (text.includes("မထည့်ရသေးပါ")) return "";

//   return text;
// }

// function getStoredTaxRatePercent() {
//   if (typeof window === "undefined") return null;

//   const n = Number(localStorage.getItem(TAX_RATE_STORAGE_KEY));

//   return Number.isFinite(n) ? n : null;
// }

// function readPercent(...values: unknown[]) {
//   for (const value of values) {
//     const n = Number(value);

//     if (!Number.isFinite(n)) continue;

//     const percent = n > 0 && n <= 1 ? n * 100 : n;
//     return Math.min(100, Math.max(0, Math.round(percent)));
//   }

//   return DEFAULT_INFO.taxRatePercent;
// }

// function getAccessToken() {
//   if (typeof window === "undefined") return "";

//   return (
//     localStorage.getItem("pos_shop_owner_token") ||
//     localStorage.getItem("pos_access_token") ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("token") ||
//     ""
//   ).trim();
// }

// function authHeaders(): Record<string, string> {
//   const token = getAccessToken();

//   return token
//     ? {
//         Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
//       }
//     : {};
// }

// function normalizeInfo(data: any): ReceiptShopInfo {
//   const payload =
//     data?.data && typeof data.data === "object"
//       ? data.data
//       : data?.setting && typeof data.setting === "object"
//       ? data.setting
//       : data?.receiptSetting && typeof data.receiptSetting === "object"
//       ? data.receiptSetting
//       : data?.receipt_setting && typeof data.receipt_setting === "object"
//       ? data.receipt_setting
//       : data;
//   const shop = payload?.shop && typeof payload.shop === "object" ? payload.shop : {};

//   return {
//     shopName:
//       clean(
//         payload?.shopName ??
//           payload?.shop_name ??
//           payload?.name ??
//           shop.shopName ??
//           shop.shop_name ??
//           shop.name
//       ) || DEFAULT_INFO.shopName,
//     address: clean(
//       payload?.address ??
//         payload?.shopAddress ??
//         payload?.shop_address ??
//         shop.address ??
//         shop.shopAddress ??
//         shop.shop_address
//     ),
//     phone: clean(
//       payload?.phone ??
//         payload?.shopPhone ??
//         payload?.shop_phone ??
//         shop.phone ??
//         shop.shopPhone ??
//         shop.shop_phone
//     ),
//     secondPhone: clean(
//       payload?.secondPhone ??
//         payload?.second_phone ??
//         payload?.shopSecondPhone ??
//         payload?.shop_second_phone ??
//         shop.secondPhone ??
//         shop.second_phone
//     ),
//     footerMessage:
//       clean(payload?.footerMessage ?? payload?.footer_message) ||
//       DEFAULT_INFO.footerMessage,
//     taxRatePercent: readPercent(
//       payload?.taxRatePercent,
//       payload?.tax_rate_percent,
//       payload?.taxPercent,
//       payload?.tax_percent,
//       payload?.taxRate,
//       payload?.tax_rate,
//       getStoredTaxRatePercent()
//     ),
//     ads: Array.isArray(payload?.ads)
//       ? payload.ads
//           .filter((ad: any) => ad?.active !== false && clean(ad?.message))
//           .map((ad: any) => ({
//             id: ad?.id ?? null,
//             title: clean(ad?.title),
//             message: clean(ad?.message),
//             active: ad?.active !== false,
//           }))
//       : [],
//   };
// }

// function jpy(n: number) {
//   return Math.round(n).toLocaleString("ja-JP", {
//     style: "currency",
//     currency: "JPY",
//   });
// }

// function escapeHtml(value: unknown) {
//   return String(value ?? "")
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replaceAll('"', "&quot;")
//     .replaceAll("'", "&#039;");
// }

// export default function ReceiptShopInfoPage() {
//   const router = useRouter();

//   const [info, setInfo] = useState<ReceiptShopInfo>(DEFAULT_INFO);
//   const [loading, setLoading] = useState(true);
//   const [savingTax, setSavingTax] = useState(false);
//   const [error, setError] = useState("");
//   const [isNight, setIsNight] = useState(false);

//   const todayText = useMemo(() => {
//     return new Date().toLocaleString("ja-JP", {
//       year: "numeric",
//       month: "2-digit",
//       day: "2-digit",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   }, []);

//   const phoneLine = useMemo(() => {
//     return info.phone || info.secondPhone
//       ? `${info.phone}${info.phone && info.secondPhone ? " / " : ""}${
//           info.secondPhone
//         }`
//       : "";
//   }, [info.phone, info.secondPhone]);

//   const sampleReceiptNo = useMemo(() => {
//     const now = new Date();
//     return `R-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
//       2,
//       "0"
//     )}${String(now.getDate()).padStart(2, "0")}-PREVIEW`;
//   }, []);

//   const completion = useMemo(() => {
//     let score = 0;
//     if (info.shopName) score += 25;
//     if (info.address) score += 25;
//     if (phoneLine) score += 25;
//     if (info.footerMessage) score += 25;
//     return score;
//   }, [info.shopName, info.address, phoneLine, info.footerMessage]);

//   useEffect(() => {
//     void loadInfo();
//   }, []);

//   useEffect(() => {
//     const saved = localStorage.getItem("receipt-shop-info-theme");

//     if (saved) {
//       setIsNight(saved === "night");
//       return;
//     }

//     setIsNight(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
//   }, []);

//   useEffect(() => {
//     document.documentElement.classList.toggle("dark", isNight);
//     localStorage.setItem("receipt-shop-info-theme", isNight ? "night" : "day");

//     return () => {
//       document.documentElement.classList.remove("dark");
//     };
//   }, [isNight]);

//   function toggleTheme() {
//     setIsNight((current) => !current);
//   }

//   async function loadInfo() {
//     try {
//       setLoading(true);
//       setError("");

//       const res = await fetch("/api/receipt-settings/my-shop", {
//         method: "GET",
//         headers: {
//           Accept: "application/json",
//           ...authHeaders(),
//         },
//         cache: "no-store",
//       });

//       const data = await res.json().catch(() => null);

//       if (!res.ok) {
//         throw new Error(
//           data?.message || `Receipt setting မဖတ်နိုင်ပါ။ Status: ${res.status}`
//         );
//       }

//       const normalized = normalizeInfo(data);

//       setInfo(normalized);
//       localStorage.setItem(
//         SHOP_PRINT_INFO_STORAGE_KEY,
//         JSON.stringify({
//           shopName: normalized.shopName,
//           address: normalized.address,
//           phone: normalized.phone,
//           secondPhone: normalized.secondPhone,
//         })
//       );
//       window.dispatchEvent(new Event(SHOP_SETTINGS_UPDATED_EVENT));
//     } catch (err) {
//       const message =
//         err instanceof Error ? err.message : "Receipt setting load failed.";

//       setError(message);
//       toast.error(message);
//       setInfo(DEFAULT_INFO);
//     } finally {
//       setLoading(false);
//     }
//   }

//   function updateTaxRate(nextValue: number) {
//     setInfo((current) => ({
//       ...current,
//       taxRatePercent: Math.min(100, Math.max(0, Math.round(nextValue))),
//     }));
//   }

//   async function saveTaxRate() {
//     const payload = {
//       shopName: info.shopName,
//       address: info.address,
//       phone: info.phone,
//       secondPhone: info.secondPhone,
//       footerMessage: info.footerMessage,
//       taxRatePercent: info.taxRatePercent,
//       taxRate: info.taxRatePercent / 100,
//     };

//     try {
//       setSavingTax(true);
//       setError("");

//       let res = await fetch("/api/receipt-settings/my-shop", {
//         method: "PUT",
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json",
//           ...authHeaders(),
//         },
//         body: JSON.stringify(payload),
//       });

//       let data = await res.json().catch(() => null);

//       if (res.status === 404 || res.status === 405) {
//         res = await fetch("/api/receipt-settings/my-shop", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//             ...authHeaders(),
//           },
//           body: JSON.stringify(payload),
//         });
//         data = await res.json().catch(() => null);
//       }

//       if (!res.ok) {
//         throw new Error(
//           data?.message || `Tax rate မသိမ်းနိုင်ပါ။ Status: ${res.status}`
//         );
//       }

//       setInfo((current) => ({
//         ...current,
//         taxRatePercent: readPercent(
//           data?.taxRatePercent,
//           data?.tax_rate_percent,
//           data?.taxPercent,
//           data?.tax_percent,
//           data?.taxRate,
//           data?.tax_rate,
//           payload.taxRatePercent
//         ),
//       }));
//       localStorage.setItem(TAX_RATE_STORAGE_KEY, String(payload.taxRatePercent));
//       window.dispatchEvent(new Event(SHOP_SETTINGS_UPDATED_EVENT));
//       toast.success("Tax rate သိမ်းပြီးပါပြီ");
//     } catch (err) {
//       const message =
//         err instanceof Error ? err.message : "Tax rate save failed.";

//       setError(message);
//       toast.error(message);
//     } finally {
//       setSavingTax(false);
//     }
//   }

//   async function copyReceiptInfo() {
//     const text = [
//       `Shop: ${info.shopName}`,
//       info.address ? `Address: ${info.address}` : "",
//       phoneLine ? `Phone: ${phoneLine}` : "",
//       `Tax Rate: ${info.taxRatePercent}%`,
//       `Footer: ${info.footerMessage}`,
//     ]
//       .filter(Boolean)
//       .join("\n");

//     try {
//       await navigator.clipboard.writeText(text);
//       toast.success("Receipt info copied");
//     } catch {
//       toast.error("Copy မလုပ်နိုင်ပါ");
//     }
//   }

//   function printReceiptInfo() {
//     if (loading) return;

//     const adsHtml = info.ads.length
//       ? `
//         <div class="divider"></div>
//         <div class="ads">
//           ${info.ads
//             .map(
//               (ad) => `
//                 <div class="ad">
//                   ${
//                     clean(ad.title)
//                       ? `<div class="ad-title">${escapeHtml(ad.title)}</div>`
//                       : ""
//                   }
//                   <div>${escapeHtml(ad.message)}</div>
//                 </div>
//               `
//             )
//             .join("")}
//         </div>
//       `
//       : "";

//     const html = `
//       <!doctype html>
//       <html>
//         <head>
//           <meta charset="utf-8" />
//           <title>${escapeHtml(info.shopName)} - Receipt Shop Info</title>
//           <style>
//             * { box-sizing: border-box; }
//             body {
//               margin: 0;
//               background: #fff;
//               color: #111827;
//               font-family: Arial, Helvetica, sans-serif;
//             }
//             .page {
//               width: 80mm;
//               min-height: 100vh;
//               padding: 14px 12px;
//               margin: 0 auto;
//             }
//             .center { text-align: center; }
//             .shop {
//               font-size: 18px;
//               font-weight: 900;
//               line-height: 1.25;
//             }
//             .small {
//               margin-top: 4px;
//               color: #4b5563;
//               font-size: 11px;
//               line-height: 1.45;
//               word-break: break-word;
//             }
//             .label {
//               margin-top: 10px;
//               display: inline-block;
//               border: 1px solid #111827;
//               border-radius: 999px;
//               padding: 3px 9px;
//               font-size: 10px;
//               font-weight: 900;
//               text-transform: uppercase;
//             }
//             .divider {
//               margin: 12px 0;
//               border-top: 1px dashed #9ca3af;
//             }
//             .row {
//               display: flex;
//               justify-content: space-between;
//               gap: 10px;
//               font-size: 11px;
//               line-height: 1.6;
//             }
//             .row span:first-child { color: #6b7280; }
//             .footer {
//               text-align: center;
//               font-size: 11px;
//               line-height: 1.5;
//               font-weight: 700;
//             }
//             .ads {
//               display: grid;
//               gap: 6px;
//             }
//             .ad {
//               border: 1px dashed #f59e0b;
//               background: #fffbeb;
//               color: #92400e;
//               border-radius: 8px;
//               padding: 7px 6px;
//               text-align: center;
//               font-size: 10px;
//               line-height: 1.45;
//             }
//             .ad-title {
//               margin-bottom: 2px;
//               font-weight: 900;
//               text-transform: uppercase;
//             }
//             @media print {
//               @page { size: 80mm auto; margin: 0; }
//               .page { width: 80mm; margin: 0; }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="page">
//             <div class="center">
//               <div class="shop">${escapeHtml(info.shopName || "Shop Name")}</div>
//               ${
//                 info.address
//                   ? `<div class="small">${escapeHtml(info.address).replaceAll(
//                       "\n",
//                       "<br/>"
//                     )}</div>`
//                   : `<div class="small">Shop address မထည့်ရသေးပါ</div>`
//               }
//               ${
//                 phoneLine
//                   ? `<div class="small">Phone: ${escapeHtml(phoneLine)}</div>`
//                   : `<div class="small">Phone No မထည့်ရသေးပါ</div>`
//               }
//               <div class="label">Receipt Shop Info</div>
//             </div>

//             <div class="divider"></div>

//             <div class="row"><span>Date</span><b>${escapeHtml(todayText)}</b></div>
//             <div class="row"><span>Tax Rate</span><b>${info.taxRatePercent}%</b></div>
//             <div class="row"><span>Preview Receipt</span><b>${escapeHtml(
//               sampleReceiptNo
//             )}</b></div>

//             ${adsHtml}

//             <div class="divider"></div>

//             <div class="footer">
//               ${escapeHtml(info.footerMessage || DEFAULT_INFO.footerMessage)}
//             </div>
//           </div>

//           <script>
//             window.onload = function () {
//               window.focus();
//               window.print();
//             };
//           </script>
//         </body>
//       </html>
//     `;

//     const printWindow = window.open("", "_blank", "width=420,height=720");

//     if (!printWindow) {
//       toast.error("Popup blocked. Please allow popup for print.");
//       return;
//     }

//     printWindow.document.open();
//     printWindow.document.write(html);
//     printWindow.document.close();
//   }

//   return (
//     <main className="min-h-dvh overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-950 transition-colors duration-500 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950 dark:text-white">
//       <div className="pointer-events-none fixed inset-0 overflow-hidden">
//         <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/10" />
//         <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-400/10" />
//         <div className="absolute bottom-[-120px] left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-400/10" />
//         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_35%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />
//       </div>

//       <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-5 md:px-6">
//         <header className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-xl shadow-sky-100/80 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
//           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" />

//           <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
//             <div className="min-w-0">
//               <Button
//                 type="button"
//                 variant="ghost"
//                 onClick={() => router.back()}
//                 className="mb-3 -ml-3 h-9 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
//               >
//                 <ArrowLeft className="h-4 w-4" />
//                 Back
//               </Button>

//               <div className="flex items-start gap-4">
//                 <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-100 to-emerald-100 text-cyan-700 shadow-lg shadow-cyan-100 dark:border-cyan-300/20 dark:from-cyan-400/15 dark:to-emerald-400/10 dark:text-cyan-200 dark:shadow-none">
//                   <Store className="h-7 w-7" />
//                 </div>

//                 <div className="min-w-0">
//                   <div className="mb-2 flex flex-wrap items-center gap-2">
//                     <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-200">
//                       <BadgeCheck className="mr-1 h-3 w-3" />
//                       View Only
//                     </Badge>
//                     <Badge className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 hover:bg-sky-100 dark:bg-sky-400/15 dark:text-sky-200">
//                       <Receipt className="mr-1 h-3 w-3" />
//                       Receipt Preview
//                     </Badge>
//                   </div>

//                   <h1 className="text-3xl font-black tracking-tight md:text-5xl">
//                     Receipt Shop Info
//                   </h1>
//                   <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
//                     Receipt မှာထွက်မယ့် ဆိုင်အချက်အလက်တွေကို ကြည့်နိုင်ပြီး
//                     print/copy လုပ်နိုင်ပါတယ်။ ဒီ page မှာ edit/save မလုပ်နိုင်ပါ။
//                   </p>
//                 </div>
//               </div>
//             </div>

//             <div className="flex flex-wrap items-center gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={toggleTheme}
//                 className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
//               >
//                 {isNight ? (
//                   <Sun className="h-4 w-4" />
//                 ) : (
//                   <Moon className="h-4 w-4" />
//                 )}
//                 {isNight ? "Day" : "Night"}
//               </Button>

//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={printReceiptInfo}
//                 disabled={loading}
//                 className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
//               >
//                 <Printer className="h-4 w-4" />
//                 Print
//               </Button>

//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={copyReceiptInfo}
//                 disabled={loading}
//                 className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
//               >
//                 <Copy className="h-4 w-4" />
//                 Copy Info
//               </Button>

//               <Button
//                 type="button"
//                 onClick={loadInfo}
//                 disabled={loading}
//                 className="h-11 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 font-bold text-white shadow-lg shadow-cyan-200 hover:from-cyan-400 hover:to-blue-400 dark:shadow-cyan-950/40"
//               >
//                 {loading ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <RefreshCcw className="h-4 w-4" />
//                 )}
//                 Reload
//               </Button>
//             </div>
//           </div>
//         </header>

//         {error && (
//           <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm leading-6 text-red-700 shadow-sm dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
//             {error}
//           </div>
//         )}

//         <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_430px]">
//           <div className="space-y-6">
//             <div className="grid gap-4 md:grid-cols-3">
//               <MetricCard
//                 icon={<Store className="h-5 w-5" />}
//                 label="Shop"
//                 value={info.shopName || "Not set"}
//                 loading={loading}
//                 tone="cyan"
//               />
//               <MetricCard
//                 icon={<Phone className="h-5 w-5" />}
//                 label="Phone"
//                 value={phoneLine || "Missing"}
//                 loading={loading}
//                 tone={phoneLine ? "emerald" : "rose"}
//               />
//               <MetricCard
//                 icon={<BadgeCheck className="h-5 w-5" />}
//                 label="Complete"
//                 value={`${completion}%`}
//                 loading={loading}
//                 tone={completion >= 75 ? "emerald" : "amber"}
//               />
//             </div>

//             <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl shadow-sky-100/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
//               <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
//                 <CardTitle className="flex items-center gap-3">
//                   <Percent className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
//                   Tax Rate Control
//                 </CardTitle>
//                 <CardDescription className="text-slate-600 dark:text-slate-300">
//                   Staff တွေသုံးတဲ့ POS screen မှာမပြင်စေဘဲ ဒီ settings page မှာ tax rate ကိုသတ်မှတ်ပါ။
//                 </CardDescription>
//               </CardHeader>

//               <CardContent className="p-5">
//                 <div className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-300/20 dark:bg-emerald-400/10 md:flex-row md:items-end md:justify-between">
//                   <div className="grid gap-2">
//                     <Label htmlFor="tax-rate-percent">Tax Rate (%)</Label>
//                     <div className="flex items-center gap-3">
//                       <Button
//                         type="button"
//                         size="icon"
//                         variant="outline"
//                         disabled={loading || savingTax}
//                         onClick={() => updateTaxRate(info.taxRatePercent - 1)}
//                         className="h-11 w-11 rounded-xl bg-white/80 dark:bg-white/10"
//                       >
//                         <Minus className="h-4 w-4" />
//                       </Button>

//                       <Input
//                         id="tax-rate-percent"
//                         type="number"
//                         min={0}
//                         max={100}
//                         step={1}
//                         value={info.taxRatePercent}
//                         disabled={loading || savingTax}
//                         onChange={(e) => updateTaxRate(Number(e.target.value || 0))}
//                         className="h-11 w-28 rounded-xl bg-white text-center text-lg font-black dark:bg-slate-950"
//                       />

//                       <Button
//                         type="button"
//                         size="icon"
//                         variant="outline"
//                         disabled={loading || savingTax}
//                         onClick={() => updateTaxRate(info.taxRatePercent + 1)}
//                         className="h-11 w-11 rounded-xl bg-white/80 dark:bg-white/10"
//                       >
//                         <Plus className="h-4 w-4" />
//                       </Button>
//                     </div>
//                   </div>

//                   <div className="flex flex-col gap-3 md:items-end">
//                     <div className="text-sm text-slate-600 dark:text-slate-300">
//                       Current tax:{" "}
//                       <b className="text-emerald-700 dark:text-emerald-200">
//                         {info.taxRatePercent}%
//                       </b>
//                     </div>
//                     <Button
//                       type="button"
//                       onClick={saveTaxRate}
//                       disabled={loading || savingTax}
//                       className="h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
//                     >
//                       {savingTax ? (
//                         <Loader2 className="h-4 w-4 animate-spin" />
//                       ) : (
//                         <Save className="h-4 w-4" />
//                       )}
//                       Save Tax Rate
//                     </Button>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl shadow-sky-100/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
//               <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
//                 <CardTitle className="flex items-center gap-3 text-2xl">
//                   <ShoppingBag className="h-6 w-6 text-cyan-500 dark:text-cyan-300" />
//                   Shop Information
//                 </CardTitle>
//                 <CardDescription className="text-slate-600 dark:text-slate-300">
//                   Receipt ထဲမှာ အသုံးပြုမယ့် ဆိုင်အချက်အလက်များ။
//                 </CardDescription>
//               </CardHeader>

//               <CardContent className="grid gap-4 p-5 md:grid-cols-2">
//                 <InfoTile
//                   icon={<Store className="h-5 w-5" />}
//                   label="Shop Name"
//                   value={info.shopName}
//                   loading={loading}
//                   accent="cyan"
//                 />

//                 <InfoTile
//                   icon={<Phone className="h-5 w-5" />}
//                   label="Phone"
//                   value={phoneLine || "Phone No မထည့်ရသေးပါ"}
//                   loading={loading}
//                   accent={phoneLine ? "emerald" : "rose"}
//                 />

//                 <InfoTile
//                   icon={<MapPin className="h-5 w-5" />}
//                   label="Address"
//                   value={info.address || "Shop address မထည့်ရသေးပါ"}
//                   loading={loading}
//                   accent={info.address ? "blue" : "rose"}
//                   className="md:col-span-2"
//                 />

//                 <InfoTile
//                   icon={<Sparkles className="h-5 w-5" />}
//                   label="Footer Message"
//                   value={info.footerMessage}
//                   loading={loading}
//                   accent="emerald"
//                   className="md:col-span-2"
//                 />
//               </CardContent>
//             </Card>

//             <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl shadow-sky-100/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
//               <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
//                 <CardTitle className="flex items-center gap-3">
//                   <Megaphone className="h-5 w-5 text-amber-500 dark:text-amber-300" />
//                   Receipt Advertisement
//                 </CardTitle>
//                 <CardDescription className="text-slate-600 dark:text-slate-300">
//                   Active ဖြစ်နေသော ကြော်ငြာစာသားများကို receipt footer အနားမှာပြပါမယ်။
//                 </CardDescription>
//               </CardHeader>

//               <CardContent className="p-5">
//                 {loading ? (
//                   <div className="grid gap-3">
//                     <SkeletonLine />
//                     <SkeletonLine />
//                   </div>
//                 ) : info.ads.length > 0 ? (
//                   <div className="grid gap-3 md:grid-cols-2">
//                     {info.ads.map((ad, index) => (
//                       <div
//                         key={`${ad.id ?? "ad"}-${index}`}
//                         className="group rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-amber-300/20 dark:from-amber-400/10 dark:to-orange-400/5"
//                       >
//                         <div className="mb-2 flex items-center justify-between gap-2">
//                           <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-100">
//                             Ad #{index + 1}
//                           </Badge>
//                           <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-100">
//                             Active
//                           </Badge>
//                         </div>

//                         {ad.title && (
//                           <div className="text-base font-black text-amber-900 dark:text-amber-100">
//                             {ad.title}
//                           </div>
//                         )}

//                         <div className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
//                           {ad.message}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-white/10 dark:bg-white/[0.04]">
//                     <Sparkles className="mx-auto h-9 w-9 text-slate-400" />
//                     <div className="mt-3 font-bold">Advertisement မရှိသေးပါ</div>
//                     <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
//                       Receipt settings API မှ active ads မရရှိသေးပါ။
//                     </p>
//                   </div>
//                 )}
//               </CardContent>
//             </Card>
//           </div>

//           <div className="lg:sticky lg:top-5 lg:self-start">
//             <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl shadow-sky-100/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
//               <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
//                 <CardTitle className="flex items-center gap-3">
//                   <Receipt className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
//                   Receipt Preview
//                 </CardTitle>
//                 <CardDescription className="text-slate-600 dark:text-slate-300">
//                   80mm receipt print style preview
//                 </CardDescription>
//               </CardHeader>

//               <CardContent className="p-5">
//                 <ReceiptPreview
//                   info={info}
//                   phoneLine={phoneLine}
//                   receiptNo={sampleReceiptNo}
//                   dateText={todayText}
//                   loading={loading}
//                 />
//               </CardContent>
//             </Card>
//           </div>
//         </section>
//       </div>
//     </main>
//   );
// }

// function MetricCard({
//   icon,
//   label,
//   value,
//   loading,
//   tone,
// }: {
//   icon: React.ReactNode;
//   label: string;
//   value: string;
//   loading: boolean;
//   tone: "cyan" | "emerald" | "amber" | "rose";
// }) {
//   const toneClass =
//     tone === "cyan"
//       ? "from-cyan-500/15 to-blue-500/10 text-cyan-700 dark:text-cyan-200"
//       : tone === "emerald"
//       ? "from-emerald-500/15 to-teal-500/10 text-emerald-700 dark:text-emerald-200"
//       : tone === "amber"
//       ? "from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-200"
//       : "from-rose-500/15 to-red-500/10 text-rose-700 dark:text-rose-200";

//   return (
//     <div className="rounded-[1.6rem] border border-white/70 bg-white/75 p-4 shadow-lg shadow-sky-100/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
//       <div
//         className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${toneClass}`}
//       >
//         {icon}
//       </div>
//       <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
//         {label}
//       </div>
//       {loading ? (
//         <div className="mt-2">
//           <SkeletonLine />
//         </div>
//       ) : (
//         <div className="mt-2 truncate text-xl font-black">{value}</div>
//       )}
//     </div>
//   );
// }

// function InfoTile({
//   icon,
//   label,
//   value,
//   loading,
//   accent,
//   className = "",
// }: {
//   icon: React.ReactNode;
//   label: string;
//   value: string;
//   loading: boolean;
//   accent: "cyan" | "blue" | "emerald" | "rose";
//   className?: string;
// }) {
//   const accentClass =
//     accent === "cyan"
//       ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200"
//       : accent === "blue"
//       ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-200"
//       : accent === "emerald"
//       ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200"
//       : "border-red-200 bg-red-50 text-red-700 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200";

//   return (
//     <div
//       className={`rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] ${className}`}
//     >
//       <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
//         <span
//           className={`grid h-10 w-10 place-items-center rounded-2xl border ${accentClass}`}
//         >
//           {icon}
//         </span>
//         {label}
//       </div>

//       {loading ? (
//         <SkeletonLine />
//       ) : (
//         <div className="whitespace-pre-line text-lg font-black leading-7 text-slate-950 dark:text-white">
//           {value}
//         </div>
//       )}
//     </div>
//   );
// }

// function ReceiptPreview({
//   info,
//   phoneLine,
//   receiptNo,
//   dateText,
//   loading,
// }: {
//   info: ReceiptShopInfo;
//   phoneLine: string;
//   receiptNo: string;
//   dateText: string;
//   loading: boolean;
// }) {
//   const sampleItems = [
//     { name: "Coffee", qty: 2, price: 280 },
//     { name: "Bread", qty: 1, price: 180 },
//     { name: "Milk", qty: 1, price: 220 },
//   ];

//   const subtotal = sampleItems.reduce(
//     (sum, item) => sum + item.qty * item.price,
//     0
//   );
//   const tax = Math.round(subtotal * (info.taxRatePercent / 100));
//   const grandTotal = subtotal + tax;

//   return (
//     <div className="mx-auto max-w-[360px]">
//       <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-b from-slate-200 to-slate-100 p-3 shadow-2xl shadow-slate-200/80 dark:border-white/10 dark:from-slate-700 dark:to-slate-800 dark:shadow-black/20">
//         <div className="overflow-hidden rounded-[1.5rem] bg-white font-mono text-slate-950 shadow-xl">
//           <div className="h-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" />

//           <div className="p-5">
//             {loading ? (
//               <div className="grid gap-3">
//                 <SkeletonLine light />
//                 <SkeletonLine light />
//                 <SkeletonLine light />
//               </div>
//             ) : (
//               <>
//                 <div className="text-center">
//                   <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg">
//                     <Store className="h-6 w-6" />
//                   </div>

//                   <div className="text-lg font-black uppercase tracking-wide">
//                     {info.shopName || "Shop Name"}
//                   </div>

//                   {info.address ? (
//                     <div className="mt-2 whitespace-pre-line text-[11px] leading-5 text-slate-600">
//                       {info.address}
//                     </div>
//                   ) : (
//                     <div className="mt-2 text-[11px] font-bold text-rose-500">
//                       Shop address မထည့်ရသေးပါ
//                     </div>
//                   )}

//                   {phoneLine ? (
//                     <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-600">
//                       <Phone className="h-3 w-3" />
//                       {phoneLine}
//                     </div>
//                   ) : (
//                     <div className="mt-1 text-[11px] font-bold text-rose-500">
//                       Phone No မထည့်ရသေးပါ
//                     </div>
//                   )}

//                   <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
//                     <Receipt className="h-3 w-3" />
//                     Official Receipt
//                   </div>
//                 </div>

//                 <DashedLine />

//                 <div className="space-y-1 text-[11px]">
//                   <ReceiptInfoRow label="Receipt" value={receiptNo} />
//                   <ReceiptInfoRow label="Date" value={dateText} />
//                   <ReceiptInfoRow label="Cashier" value="Preview Staff" />
//                 </div>

//                 <DashedLine />

//                 <div className="grid grid-cols-[1fr_34px_62px] border-b border-dashed border-slate-300 pb-2 text-[10px] font-black uppercase text-slate-500">
//                   <div>Item</div>
//                   <div className="text-right">Qty</div>
//                   <div className="text-right">Total</div>
//                 </div>

//                 <div className="space-y-2 py-2 text-[11px]">
//                   {sampleItems.map((item) => (
//                     <div
//                       key={item.name}
//                       className="grid grid-cols-[1fr_34px_62px] gap-2"
//                     >
//                       <div>
//                         <div className="font-black">{item.name}</div>
//                         <div className="text-[9px] text-slate-500">
//                           {jpy(item.price)} each
//                         </div>
//                       </div>
//                       <div className="text-right font-bold">x{item.qty}</div>
//                       <div className="text-right font-bold">
//                         {jpy(item.qty * item.price)}
//                       </div>
//                     </div>
//                   ))}
//                 </div>

//                 <DashedLine />

//                 <div className="space-y-1 text-[11px]">
//                   <ReceiptInfoRow label="Subtotal" value={jpy(subtotal)} />
//                   <ReceiptInfoRow
//                     label={`Tax (${info.taxRatePercent}%)`}
//                     value={jpy(tax)}
//                   />
//                   <div className="mt-2 flex items-center justify-between border-t-2 border-slate-950 pt-3">
//                     <span className="text-sm font-black">Grand Total</span>
//                     <span className="text-xl font-black">{jpy(grandTotal)}</span>
//                   </div>
//                 </div>

//                 {info.ads.length > 0 && (
//                   <>
//                     <DashedLine />
//                     <div className="grid gap-2">
//                       {info.ads.slice(0, 2).map((ad, index) => (
//                         <div
//                           key={`${ad.id ?? "receipt-ad"}-${index}`}
//                           className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-center"
//                         >
//                           {ad.title && (
//                             <div className="text-[10px] font-black uppercase text-amber-700">
//                               {ad.title}
//                             </div>
//                           )}
//                           <div className="mt-0.5 text-[10px] leading-4 text-amber-700">
//                             {ad.message}
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </>
//                 )}

//                 <DashedLine />

//                 <div className="text-center text-[11px] font-bold leading-5 text-slate-700">
//                   {info.footerMessage || DEFAULT_INFO.footerMessage}
//                 </div>

//                 <div className="mt-3 flex items-center justify-center gap-1 text-center font-mono text-[11px] tracking-[0.18em] text-slate-500">
//                   <Clock3 className="h-3 w-3" />
//                   {receiptNo}
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       </div>

//       <div className="mx-auto h-3 w-[86%] rounded-b-[2rem] bg-slate-300/80 dark:bg-slate-700" />
//     </div>
//   );
// }

// function ReceiptInfoRow({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="flex items-center justify-between gap-4">
//       <span className="text-slate-500">{label}</span>
//       <span className="text-right font-black">{value}</span>
//     </div>
//   );
// }

// function DashedLine() {
//   return <div className="my-4 border-t border-dashed border-slate-300" />;
// }

// function SkeletonLine({ light = false }: { light?: boolean }) {
//   return (
//     <div
//       className={`h-5 animate-pulse rounded-full ${
//         light ? "bg-slate-200" : "bg-slate-200 dark:bg-white/10"
//       }`}
//     />
//   );
// }








"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Copy,
  Loader2,
  MapPin,
  Megaphone,
  Minus,
  Moon,
  Phone,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCcw,
  Save,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReceiptAd = {
  id?: number | null;
  title?: string | null;
  message?: string | null;
  active?: boolean;
};

type ReceiptShopInfo = {
  shopName: string;
  address: string;
  phone: string;
  secondPhone: string;
  footerMessage: string;
  taxRatePercent: number;
  ads: ReceiptAd[];
};

const EMPTY_RECEIPT_PLACEHOLDERS = [
  "Shop address မထည့်ရသေးပါ",
  "Phone No မထည့်ရသေးပါ",
];

const DEFAULT_INFO: ReceiptShopInfo = {
  shopName: "Clear Blue Light POS",
  address: "",
  phone: "",
  secondPhone: "",
  footerMessage: "Thank you for shopping",
  taxRatePercent: 10,
  ads: [],
};

const TAX_RATE_STORAGE_KEY = "receipt_tax_rate_percent";
const SHOP_PRINT_INFO_STORAGE_KEY = "receipt_shop_print_info";
const SHOP_SETTINGS_UPDATED_EVENT = "receipt-shop-settings-updated";

function clean(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) return "";
  if (EMPTY_RECEIPT_PLACEHOLDERS.includes(text)) return "";
  if (text.includes("မထည့်ရသေးပါ")) return "";

  return text;
}

function getStoredTaxRatePercent() {
  if (typeof window === "undefined") return null;

  const n = Number(localStorage.getItem(TAX_RATE_STORAGE_KEY));

  return Number.isFinite(n) ? n : null;
}

function readPercent(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);

    if (!Number.isFinite(n)) continue;

    const percent = n > 0 && n <= 1 ? n * 100 : n;
    return Math.min(100, Math.max(0, Math.round(percent)));
  }

  return DEFAULT_INFO.taxRatePercent;
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

function normalizeInfo(data: any): ReceiptShopInfo {
  const payload =
    data?.data && typeof data.data === "object"
      ? data.data
      : data?.setting && typeof data.setting === "object"
      ? data.setting
      : data?.receiptSetting && typeof data.receiptSetting === "object"
      ? data.receiptSetting
      : data?.receipt_setting && typeof data.receipt_setting === "object"
      ? data.receipt_setting
      : data;
  const shop = payload?.shop && typeof payload.shop === "object" ? payload.shop : {};

  return {
    shopName:
      clean(
        payload?.shopName ??
          payload?.shop_name ??
          payload?.name ??
          shop.shopName ??
          shop.shop_name ??
          shop.name
      ) || DEFAULT_INFO.shopName,
    address: clean(
      payload?.address ??
        payload?.shopAddress ??
        payload?.shop_address ??
        shop.address ??
        shop.shopAddress ??
        shop.shop_address
    ),
    phone: clean(
      payload?.phone ??
        payload?.shopPhone ??
        payload?.shop_phone ??
        shop.phone ??
        shop.shopPhone ??
        shop.shop_phone
    ),
    secondPhone: clean(
      payload?.secondPhone ??
        payload?.second_phone ??
        payload?.shopSecondPhone ??
        payload?.shop_second_phone ??
        shop.secondPhone ??
        shop.second_phone
    ),
    footerMessage:
      clean(payload?.footerMessage ?? payload?.footer_message) ||
      DEFAULT_INFO.footerMessage,
    taxRatePercent: readPercent(
      payload?.taxRatePercent,
      payload?.tax_rate_percent,
      payload?.taxPercent,
      payload?.tax_percent,
      payload?.taxRate,
      payload?.tax_rate,
      getStoredTaxRatePercent()
    ),
    ads: Array.isArray(payload?.ads)
      ? payload.ads
          .filter((ad: any) => ad?.active !== false && clean(ad?.message))
          .map((ad: any) => ({
            id: ad?.id ?? null,
            title: clean(ad?.title),
            message: clean(ad?.message),
            active: ad?.active !== false,
          }))
      : [],
  };
}

function jpy(n: number) {
  return Math.round(n).toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
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

export default function ReceiptShopInfoPage() {
  const router = useRouter();

  const [info, setInfo] = useState<ReceiptShopInfo>(DEFAULT_INFO);
  const [loading, setLoading] = useState(true);
  const [savingTax, setSavingTax] = useState(false);
  const [error, setError] = useState("");
  const [isNight, setIsNight] = useState(false);

  const todayText = useMemo(() => {
    return new Date().toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const phoneLine = useMemo(() => {
    return info.phone || info.secondPhone
      ? `${info.phone}${info.phone && info.secondPhone ? " / " : ""}${
          info.secondPhone
        }`
      : "";
  }, [info.phone, info.secondPhone]);

  const sampleReceiptNo = useMemo(() => {
    const now = new Date();
    return `R-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(now.getDate()).padStart(2, "0")}-PREVIEW`;
  }, []);

  const completion = useMemo(() => {
    let score = 0;
    if (info.shopName) score += 25;
    if (info.address) score += 25;
    if (phoneLine) score += 25;
    if (info.footerMessage) score += 25;
    return score;
  }, [info.shopName, info.address, phoneLine, info.footerMessage]);

  useEffect(() => {
    void loadInfo();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("receipt-shop-info-theme");

    if (saved) {
      setIsNight(saved === "night");
      return;
    }

    setIsNight(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isNight);
    localStorage.setItem("receipt-shop-info-theme", isNight ? "night" : "day");

    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isNight]);

  function toggleTheme() {
    setIsNight((current) => !current);
  }

  async function loadInfo() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/receipt-settings/my-shop", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeaders(),
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message || `Receipt setting မဖတ်နိုင်ပါ။ Status: ${res.status}`
        );
      }

      const normalized = normalizeInfo(data);

      setInfo(normalized);
      localStorage.setItem(
        SHOP_PRINT_INFO_STORAGE_KEY,
        JSON.stringify({
          shopName: normalized.shopName,
          address: normalized.address,
          phone: normalized.phone,
          secondPhone: normalized.secondPhone,
        })
      );
      window.dispatchEvent(new Event(SHOP_SETTINGS_UPDATED_EVENT));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Receipt setting load failed.";

      setError(message);
      toast.error(message);
      setInfo(DEFAULT_INFO);
    } finally {
      setLoading(false);
    }
  }

  function updateTaxRate(nextValue: number) {
    setInfo((current) => ({
      ...current,
      taxRatePercent: Math.min(100, Math.max(0, Math.round(nextValue))),
    }));
  }

  async function saveTaxRate() {
    const payload = {
      shopName: info.shopName,
      address: info.address,
      phone: info.phone,
      secondPhone: info.secondPhone,
      footerMessage: info.footerMessage,
      taxRatePercent: info.taxRatePercent,
      taxRate: info.taxRatePercent / 100,
    };

    try {
      setSavingTax(true);
      setError("");

      let res = await fetch("/api/receipt-settings/my-shop", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      let data = await res.json().catch(() => null);

      if (res.status === 404 || res.status === 405) {
        res = await fetch("/api/receipt-settings/my-shop", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });
        data = await res.json().catch(() => null);
      }

      if (!res.ok) {
        throw new Error(
          data?.message || `Tax rate မသိမ်းနိုင်ပါ။ Status: ${res.status}`
        );
      }

      setInfo((current) => ({
        ...current,
        taxRatePercent: readPercent(
          data?.taxRatePercent,
          data?.tax_rate_percent,
          data?.taxPercent,
          data?.tax_percent,
          data?.taxRate,
          data?.tax_rate,
          payload.taxRatePercent
        ),
      }));
      localStorage.setItem(TAX_RATE_STORAGE_KEY, String(payload.taxRatePercent));
      window.dispatchEvent(new Event(SHOP_SETTINGS_UPDATED_EVENT));
      toast.success("Tax rate သိမ်းပြီးပါပြီ");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tax rate save failed.";

      setError(message);
      toast.error(message);
    } finally {
      setSavingTax(false);
    }
  }

  async function copyReceiptInfo() {
    const text = [
      `Shop: ${info.shopName}`,
      info.address ? `Address: ${info.address}` : "",
      phoneLine ? `Phone: ${phoneLine}` : "",
      `Tax Rate: ${info.taxRatePercent}%`,
      `Footer: ${info.footerMessage}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Receipt info copied");
    } catch {
      toast.error("Copy မလုပ်နိုင်ပါ");
    }
  }

  function printReceiptInfo() {
    if (loading) return;

    const adsHtml = info.ads.length
      ? `
        <div class="divider"></div>
        <div class="ads">
          ${info.ads
            .map(
              (ad) => `
                <div class="ad">
                  ${
                    clean(ad.title)
                      ? `<div class="ad-title">${escapeHtml(ad.title)}</div>`
                      : ""
                  }
                  <div>${escapeHtml(ad.message)}</div>
                </div>
              `
            )
            .join("")}
        </div>
      `
      : "";

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(info.shopName)} - Receipt Shop Info</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #fff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
            }
            .page {
              width: 80mm;
              min-height: 100vh;
              padding: 14px 12px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .shop {
              font-size: 18px;
              font-weight: 900;
              line-height: 1.25;
            }
            .small {
              margin-top: 4px;
              color: #4b5563;
              font-size: 11px;
              line-height: 1.45;
              word-break: break-word;
            }
            .label {
              margin-top: 10px;
              display: inline-block;
              border: 1px solid #111827;
              border-radius: 999px;
              padding: 3px 9px;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .divider {
              margin: 12px 0;
              border-top: 1px dashed #9ca3af;
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              font-size: 11px;
              line-height: 1.6;
            }
            .row span:first-child { color: #6b7280; }
            .footer {
              text-align: center;
              font-size: 11px;
              line-height: 1.5;
              font-weight: 700;
            }
            .ads {
              display: grid;
              gap: 6px;
            }
            .ad {
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
            @media print {
              @page { size: 80mm auto; margin: 0; }
              .page { width: 80mm; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="center">
              <div class="shop">${escapeHtml(info.shopName || "Shop Name")}</div>
              ${
                info.address
                  ? `<div class="small">${escapeHtml(info.address).replaceAll(
                      "\n",
                      "<br/>"
                    )}</div>`
                  : `<div class="small">Shop address မထည့်ရသေးပါ</div>`
              }
              ${
                phoneLine
                  ? `<div class="small">Phone: ${escapeHtml(phoneLine)}</div>`
                  : `<div class="small">Phone No မထည့်ရသေးပါ</div>`
              }
              <div class="label">Receipt Shop Info</div>
            </div>

            <div class="divider"></div>

            <div class="row"><span>Date</span><b>${escapeHtml(todayText)}</b></div>
            <div class="row"><span>Tax Rate</span><b>${info.taxRatePercent}%</b></div>
            <div class="row"><span>Preview Receipt</span><b>${escapeHtml(
              sampleReceiptNo
            )}</b></div>

            ${adsHtml}

            <div class="divider"></div>

            <div class="footer">
              ${escapeHtml(info.footerMessage || DEFAULT_INFO.footerMessage)}
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
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-[linear-gradient(135deg,var(--brand-soft),var(--background),color-mix(in_srgb,var(--brand-accent)_12%,var(--background)))] text-slate-950 transition-colors duration-500 dark:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-[var(--brand-primary)] opacity-20 blur-3xl dark:opacity-10" />
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-[var(--brand-accent)] opacity-20 blur-3xl dark:opacity-10" />
        <div className="absolute bottom-[-120px] left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-[var(--brand-primary)] opacity-10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--brand-soft),transparent_35%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-5 md:px-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--brand-accent),var(--brand-primary),var(--brand-accent))]" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                className="mb-3 -ml-3 h-9 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)] shadow-lg dark:text-[var(--brand-accent)] dark:shadow-none">
                  <Store className="h-7 w-7" />
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-200">
                      <BadgeCheck className="mr-1 h-3 w-3" />
                      View Only
                    </Badge>
                    <Badge className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)] dark:text-[var(--brand-accent)]">
                      <Receipt className="mr-1 h-3 w-3" />
                      Receipt Preview
                    </Badge>
                  </div>

                  <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                    Receipt Shop Info
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Receipt မှာထွက်မယ့် ဆိုင်အချက်အလက်တွေကို ကြည့်နိုင်ပြီး
                    print/copy လုပ်နိုင်ပါတယ်။ ဒီ page မှာ edit/save မလုပ်နိုင်ပါ။
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={toggleTheme}
                className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                {isNight ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {isNight ? "Day" : "Night"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={printReceiptInfo}
                disabled={loading}
                className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={copyReceiptInfo}
                disabled={loading}
                className="h-11 rounded-2xl border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Copy className="h-4 w-4" />
                Copy Info
              </Button>

              <Button
                type="button"
                onClick={loadInfo}
                disabled={loading}
                className="h-11 rounded-2xl bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))] font-bold text-white shadow-lg hover:brightness-110 dark:text-slate-950"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Reload
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm leading-6 text-red-700 shadow-sm dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_430px]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                icon={<Store className="h-5 w-5" />}
                label="Shop"
                value={info.shopName || "Not set"}
                loading={loading}
                tone="cyan"
              />
              <MetricCard
                icon={<Phone className="h-5 w-5" />}
                label="Phone"
                value={phoneLine || "Missing"}
                loading={loading}
                tone={phoneLine ? "emerald" : "rose"}
              />
              <MetricCard
                icon={<BadgeCheck className="h-5 w-5" />}
                label="Complete"
                value={`${completion}%`}
                loading={loading}
                tone={completion >= 75 ? "emerald" : "amber"}
              />
            </div>

            <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
              <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
                <CardTitle className="flex items-center gap-3">
                  <Percent className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
                  Tax Rate Control
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300">
                  Staff တွေသုံးတဲ့ POS screen မှာမပြင်စေဘဲ ဒီ settings page မှာ tax rate ကိုသတ်မှတ်ပါ။
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <div className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-300/20 dark:bg-emerald-400/10 md:flex-row md:items-end md:justify-between">
                  <div className="grid gap-2">
                    <Label htmlFor="tax-rate-percent">Tax Rate (%)</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={loading || savingTax}
                        onClick={() => updateTaxRate(info.taxRatePercent - 1)}
                        className="h-11 w-11 rounded-xl bg-white/80 dark:bg-white/10"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <Input
                        id="tax-rate-percent"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={info.taxRatePercent}
                        disabled={loading || savingTax}
                        onChange={(e) => updateTaxRate(Number(e.target.value || 0))}
                        className="h-11 w-28 rounded-xl bg-white text-center text-lg font-black dark:bg-slate-950"
                      />

                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={loading || savingTax}
                        onClick={() => updateTaxRate(info.taxRatePercent + 1)}
                        className="h-11 w-11 rounded-xl bg-white/80 dark:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      Current tax:{" "}
                      <b className="text-emerald-700 dark:text-emerald-200">
                        {info.taxRatePercent}%
                      </b>
                    </div>
                    <Button
                      type="button"
                      onClick={saveTaxRate}
                      disabled={loading || savingTax}
                      className="h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                    >
                      {savingTax ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Tax Rate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
              <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <ShoppingBag className="h-6 w-6 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
                  Shop Information
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300">
                  Receipt ထဲမှာ အသုံးပြုမယ့် ဆိုင်အချက်အလက်များ။
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                <InfoTile
                  icon={<Store className="h-5 w-5" />}
                  label="Shop Name"
                  value={info.shopName}
                  loading={loading}
                  accent="cyan"
                />

                <InfoTile
                  icon={<Phone className="h-5 w-5" />}
                  label="Phone"
                  value={phoneLine || "Phone No မထည့်ရသေးပါ"}
                  loading={loading}
                  accent={phoneLine ? "emerald" : "rose"}
                />

                <InfoTile
                  icon={<MapPin className="h-5 w-5" />}
                  label="Address"
                  value={info.address || "Shop address မထည့်ရသေးပါ"}
                  loading={loading}
                  accent={info.address ? "blue" : "rose"}
                  className="md:col-span-2"
                />

                <InfoTile
                  icon={<Sparkles className="h-5 w-5" />}
                  label="Footer Message"
                  value={info.footerMessage}
                  loading={loading}
                  accent="emerald"
                  className="md:col-span-2"
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
              <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
                <CardTitle className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5 text-amber-500 dark:text-amber-300" />
                  Receipt Advertisement
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300">
                  Active ဖြစ်နေသော ကြော်ငြာစာသားများကို receipt footer အနားမှာပြပါမယ်။
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                {loading ? (
                  <div className="grid gap-3">
                    <SkeletonLine />
                    <SkeletonLine />
                  </div>
                ) : info.ads.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {info.ads.map((ad, index) => (
                      <div
                        key={`${ad.id ?? "ad"}-${index}`}
                        className="group rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-amber-300/20 dark:from-amber-400/10 dark:to-orange-400/5"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-100">
                            Ad #{index + 1}
                          </Badge>
                          <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-100">
                            Active
                          </Badge>
                        </div>

                        {ad.title && (
                          <div className="text-base font-black text-amber-900 dark:text-amber-100">
                            {ad.title}
                          </div>
                        )}

                        <div className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
                          {ad.message}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-white/10 dark:bg-white/[0.04]">
                    <Sparkles className="mx-auto h-9 w-9 text-slate-400" />
                    <div className="mt-3 font-bold">Advertisement မရှိသေးပါ</div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Receipt settings API မှ active ads မရရှိသေးပါ။
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-5 lg:self-start">
            <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/80 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-black/20">
              <CardHeader className="border-b border-slate-200/70 dark:border-white/10">
                <CardTitle className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
                  Receipt Preview
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300">
                  80mm receipt print style preview
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <ReceiptPreview
                  info={info}
                  phoneLine={phoneLine}
                  receiptNo={sampleReceiptNo}
                  dateText={todayText}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "cyan"
      ? "from-[var(--brand-soft)] to-transparent text-[var(--brand-primary)] dark:text-[var(--brand-accent)]"
      : tone === "emerald"
      ? "from-emerald-500/15 to-teal-500/10 text-emerald-700 dark:text-emerald-200"
      : tone === "amber"
      ? "from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-200"
      : "from-rose-500/15 to-red-500/10 text-rose-700 dark:text-rose-200";

  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white/75 p-4 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
      <div
        className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${toneClass}`}
      >
        {icon}
      </div>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {loading ? (
        <div className="mt-2">
          <SkeletonLine />
        </div>
      ) : (
        <div className="mt-2 truncate text-xl font-black">{value}</div>
      )}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  loading,
  accent,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
  accent: "cyan" | "blue" | "emerald" | "rose";
  className?: string;
}) {
  const accentClass =
    accent === "cyan"
      ? "border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)] dark:text-[var(--brand-accent)]"
      : accent === "blue"
      ? "border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)] dark:text-[var(--brand-accent)]"
      : accent === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200";

  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] ${className}`}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        <span
          className={`grid h-10 w-10 place-items-center rounded-2xl border ${accentClass}`}
        >
          {icon}
        </span>
        {label}
      </div>

      {loading ? (
        <SkeletonLine />
      ) : (
        <div className="whitespace-pre-line text-lg font-black leading-7 text-slate-950 dark:text-white">
          {value}
        </div>
      )}
    </div>
  );
}

function ReceiptPreview({
  info,
  phoneLine,
  receiptNo,
  dateText,
  loading,
}: {
  info: ReceiptShopInfo;
  phoneLine: string;
  receiptNo: string;
  dateText: string;
  loading: boolean;
}) {
  const sampleItems = [
    { name: "Coffee", qty: 2, price: 280 },
    { name: "Bread", qty: 1, price: 180 },
    { name: "Milk", qty: 1, price: 220 },
  ];

  const subtotal = sampleItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );
  const tax = Math.round(subtotal * (info.taxRatePercent / 100));
  const grandTotal = subtotal + tax;

  return (
    <div className="mx-auto max-w-[360px]">
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-b from-slate-200 to-slate-100 p-3 shadow-2xl shadow-slate-200/80 dark:border-white/10 dark:from-slate-700 dark:to-slate-800 dark:shadow-black/20">
        <div className="overflow-hidden rounded-[1.5rem] bg-white font-mono text-slate-950 shadow-xl">
          <div className="h-2 bg-[linear-gradient(90deg,var(--brand-accent),var(--brand-primary),var(--brand-accent))]" />

          <div className="p-5">
            {loading ? (
              <div className="grid gap-3">
                <SkeletonLine light />
                <SkeletonLine light />
                <SkeletonLine light />
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg">
                    <Store className="h-6 w-6" />
                  </div>

                  <div className="text-lg font-black uppercase tracking-wide">
                    {info.shopName || "Shop Name"}
                  </div>

                  {info.address ? (
                    <div className="mt-2 whitespace-pre-line text-[11px] leading-5 text-slate-600">
                      {info.address}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] font-bold text-rose-500">
                      Shop address မထည့်ရသေးပါ
                    </div>
                  )}

                  {phoneLine ? (
                    <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-600">
                      <Phone className="h-3 w-3" />
                      {phoneLine}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] font-bold text-rose-500">
                      Phone No မထည့်ရသေးပါ
                    </div>
                  )}

                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                    <Receipt className="h-3 w-3" />
                    Official Receipt
                  </div>
                </div>

                <DashedLine />

                <div className="space-y-1 text-[11px]">
                  <ReceiptInfoRow label="Receipt" value={receiptNo} />
                  <ReceiptInfoRow label="Date" value={dateText} />
                  <ReceiptInfoRow label="Cashier" value="Preview Staff" />
                </div>

                <DashedLine />

                <div className="grid grid-cols-[1fr_34px_62px] border-b border-dashed border-slate-300 pb-2 text-[10px] font-black uppercase text-slate-500">
                  <div>Item</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Total</div>
                </div>

                <div className="space-y-2 py-2 text-[11px]">
                  {sampleItems.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-[1fr_34px_62px] gap-2"
                    >
                      <div>
                        <div className="font-black">{item.name}</div>
                        <div className="text-[9px] text-slate-500">
                          {jpy(item.price)} each
                        </div>
                      </div>
                      <div className="text-right font-bold">x{item.qty}</div>
                      <div className="text-right font-bold">
                        {jpy(item.qty * item.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <DashedLine />

                <div className="space-y-1 text-[11px]">
                  <ReceiptInfoRow label="Subtotal" value={jpy(subtotal)} />
                  <ReceiptInfoRow
                    label={`Tax (${info.taxRatePercent}%)`}
                    value={jpy(tax)}
                  />
                  <div className="mt-2 flex items-center justify-between border-t-2 border-slate-950 pt-3">
                    <span className="text-sm font-black">Grand Total</span>
                    <span className="text-xl font-black">{jpy(grandTotal)}</span>
                  </div>
                </div>

                {info.ads.length > 0 && (
                  <>
                    <DashedLine />
                    <div className="grid gap-2">
                      {info.ads.slice(0, 2).map((ad, index) => (
                        <div
                          key={`${ad.id ?? "receipt-ad"}-${index}`}
                          className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-center"
                        >
                          {ad.title && (
                            <div className="text-[10px] font-black uppercase text-amber-700">
                              {ad.title}
                            </div>
                          )}
                          <div className="mt-0.5 text-[10px] leading-4 text-amber-700">
                            {ad.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <DashedLine />

                <div className="text-center text-[11px] font-bold leading-5 text-slate-700">
                  {info.footerMessage || DEFAULT_INFO.footerMessage}
                </div>

                <div className="mt-3 flex items-center justify-center gap-1 text-center font-mono text-[11px] tracking-[0.18em] text-slate-500">
                  <Clock3 className="h-3 w-3" />
                  {receiptNo}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto h-3 w-[86%] rounded-b-[2rem] bg-slate-300/80 dark:bg-slate-700" />
    </div>
  );
}

function ReceiptInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}

function DashedLine() {
  return <div className="my-4 border-t border-dashed border-slate-300" />;
}

function SkeletonLine({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`h-5 animate-pulse rounded-full ${
        light ? "bg-slate-200" : "bg-slate-200 dark:bg-white/10"
      }`}
    />
  );
}