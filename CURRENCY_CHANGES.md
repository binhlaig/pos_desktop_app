Desktop Register repository ထဲမှာ တိုက်ရိုက်ပြင်ထားပါသည်။

လက်ရှိ shop ၏ Receipt Settings currency ကို supermarket၊ fashion၊ restaurant register၊ cart၊ checkout၊ change၊ dashboard၊ products၊ salary၊ receipt preview/reprint နှင့် printing တွေမှာ shared formatter/provider ဖြင့် အသုံးပြုထားပါသည်။ Default သည် MMK / Ks / 0 / AFTER ဖြစ်ပါသည်။ Settings save အောင်မြင်ပါက display ချက်ချင်းပြောင်းပြီး offline အတွက် shop တူညီသည့် နောက်ဆုံးအောင်မြင်သော settings ကိုသာ ပြန်သုံးပါသည်။ ဈေးနှုန်းနှင့် checkout တွက်ချက်မှုများကို currency conversion မလုပ်ပါ။

ပြင်ထားသောဖိုင်များ:

- `lib/currency.ts` — strict configuration၊ nullable normalization နှင့် shared formatter အသစ်။
- `lib/settings-api.ts` — ရှိပြီးသား authenticated receipt-settings proxy ကိုသုံးသော shared API request အသစ်။
- `components/currency-provider.tsx` — shared state၊ shop cache၊ settings update၊ stale-response ကာကွယ်မှု အသစ်။
- `lib/auth-storage.ts` — logout အပြီး shared state ကို အသိပေးခြင်း။
- `app/layout.tsx` — provider ချိတ်ဆက်ခြင်းနှင့် hydration ပြင်ဆင်ခြင်း။
- `components/dashboard/brand-color-provider.tsx` — saved theme ကို client lifecycle မှာ အသုံးပြုခြင်း။
- `components/regiect.tsx` — supermarket/fruit register၊ totals၊ payment နှင့် printing။
- `components/pos/card_function.tsx` — cart amounts။
- `components/pos/effect.tsx` — မသုံးသော hardcoded formatter ဖယ်ရှားခြင်း။
- `components/pos/staff-management.tsx` — salary display။
- `app/(protected)/admin/page.tsx` — monetary demo values။
- `app/(protected)/dashboard/page.tsx` — totals၊ chart labels/tooltips နှင့် valid trailing-slash regex။
- `app/(protected)/dashboard/barcode-print/page.tsx` — barcode price labels။
- `app/(protected)/dashboard/fashion/register/page.tsx` — fashion register၊ checkout နှင့် receipt printing။
- `app/(protected)/dashboard/restaurant-pos/page.tsx` — restaurant register၊ payment နှင့် receipt printing။
- `app/(protected)/dashboard/restaurant/orders/page.tsx` — order totals နှင့် reprints။
- `app/(protected)/dashboard/products/page.tsx` — prices၊ inventory values နှင့် chart tooltip။
- `app/(protected)/dashboard/products/[productId]/page.tsx` — product/sales amounts။
- `app/(protected)/dashboard/receipts/page.tsx` — receipt list၊ preview နှင့် printing။
- `app/(protected)/dashboard/staff/page.tsx` — salary နှင့် compact amounts။
- `app/(protected)/settings/shop/page.tsx` — Receipt currency controls၊ authenticated save နှင့် account/shop ပြောင်းလဲမှု။
- `app/(protected)/settings/receipts/page.tsx` — receipt preview နှင့် printing။
- `app/(protected)/settings/refund/page.tsx` — refund amounts။
- `app/pos/paydrow/page.tsx` — cash drawer amounts နှင့် denomination labels။
- `tests/currency.test.mjs` — formatter၊ settings state/cache၊ authenticated request နှင့် printing tests အသစ်။
- `CURRENCY_CHANGES.md` — ဖိုင်စာရင်းနှင့် validation မှတ်တမ်း။

စစ်ဆေးမှုများ:

- `npx tsc --noEmit` အောင်မြင်ပါသည်။ package.json တွင် သီးခြား typecheck script မရှိပါ။
- `npm run build` အောင်မြင်ပါသည်။ Sandbox ၏ worker spawn EPERM ကြောင့် ခွင့်ပြုထားသော sandbox အပြင် run ဖြင့် စစ်ထားပါသည်။
- `node --test tests/*.test.mjs` — tests ၂၄ ခုလုံး အောင်မြင်ပါသည်။ BEFORE/AFTER၊ number/string/null digits၊ zero/negative/compact amounts၊ save propagation၊ reload၊ offline cache isolation၊ cross-window update၊ stale fetch နှင့် printing HTML escaping ပါဝင်ပါသည်။ ရှိပြီးသား checkout regression tests လည်း အောင်ပါသည်။
- Shared currency/API/provider နှင့် test အသစ်တို့၏ ESLint အောင်မြင်ပါသည်။
- `npm run lint` ကို run ထားပြီး ရှိပြီးသား errors ၃၀၊ warnings ၆၅ ကြောင့် မအောင်ပါ။ Changed files ၏ မူရင်း source နှင့် နှိုင်းယှဉ်ရာတွင် error/warning အသစ် မတိုးပါ။
- Currency search ကို ပြန်စစ်ထားပါသည်။ ကျန်သည့် MMK/Ks/JPY/USD/¥ matches သည် defaults၊ Settings ရွေးချယ်စရာများနှင့် မူရင်း cash denomination ရှင်းလင်းချက် comments ဖြစ်ပါသည်။ Percentages၊ stock counts၊ dates နှင့် denomination တန်ဖိုးများကို ထိန်းထားပါသည်။

Live backend save နှင့် physical printer ကို ဤ session တွင် လက်တွေ့ end-to-end မစမ်းထားပါ။ Authenticated proxy၊ device registration၊ Electron/printer integration နှင့် checkout business calculations ကို ထိန်းထားပါသည်။
