import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compileModule(path, dependencies = {}, globals = {}) {
  const context = { exports: {}, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, Intl, Number, Headers, Date, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}
const currency = compileModule("lib/currency.ts");
const dateTime = compileModule("lib/date-time.ts");
const settle = () => new Promise(resolve => setImmediate(resolve));
const config = (code, symbol, digits, position) => currency.normalizeCurrency({ currencyCode: code, currencySymbol: symbol, currencyDecimalDigits: digits, currencyPosition: position });

test("configured symbol, decimals and position override currency defaults", () => {
  assert.equal(currency.formatCurrency(10000, config("MMK", "Ks", 0, "AFTER")), "10,000 Ks");
  assert.equal(currency.formatCurrency(10000, config("JPY", "¥", "0", "BEFORE")), "¥10,000");
  assert.equal(currency.formatCurrency(10000, config("USD", "$", "2", "BEFORE")), "$ 10,000.00");
  assert.equal(currency.formatCurrency(10000.5, config("JPY", "custom", 2, "AFTER")), "10,000.50 custom");
});
test("nullable and invalid digits normalize to a safe integer", () => {
  for (const digits of [null, undefined, "", " ", "bad", -1, 1.2, "1.2", 21, Infinity, true]) {
    assert.equal(config(null, null, digits, null).currencyDecimalDigits, 0);
    assert.equal(currency.formatCurrency(10000, config(null, null, digits, null)), "10,000");
  }
  assert.equal(config(null, null, "2", "before").currencyDecimalDigits, 2);
  assert.equal(config(null, null, 20, null).currencyDecimalDigits, 20);
});
test("zero, negative and compact monetary values", () => {
  const usd = config("USD", "$", 2, "BEFORE");
  assert.equal(currency.formatCurrency(0, usd), "$ 0.00");
  assert.equal(currency.formatCurrency(-1234.5, usd), "$ -1,234.50");
  assert.equal(currency.formatCurrency(-1234.5, config("MMK", "Ks", 0, "AFTER")), "-1,235 Ks");
  assert.equal(currency.formatCurrency(10000, usd, true), "$ 10.00K");
  assert.equal(currency.formatCurrency(1000000, config("MMK", "Ks", 0, "AFTER"), true), "1M Ks");
});
test("wrapped API data and snake case fields normalize", () => {
  assert.equal(currency.normalizeCurrency({ data: { receiptSetting: { currency_decimal_digits: "2", currency_symbol: "$", currency_position: "BEFORE" } } }).currencySymbol, "$");
});
test("authenticated settings requests deduplicate and retry failures", async () => {
  let calls = 0;
  const api = compileModule("lib/settings-api.ts", {}, { fetch: async () => { calls++; return new Response(JSON.stringify({ currencySymbol: "$" })); } });
  const init = { headers: { Authorization: "Bearer shop1" } };
  const responses = await Promise.all([api.getReceiptSettingsResponse(init), api.getReceiptSettingsResponse(init)]);
  assert.equal(calls, 1);
  for (const response of responses) assert.equal((await response.json()).currencySymbol, "$");
  await api.getReceiptSettingsResponse({ headers: { Authorization: "Bearer shop2" } });
  assert.equal(calls, 2);
  api.invalidateReceiptSettings();
  await api.getReceiptSettingsResponse(init);
  assert.equal(calls, 3);
  const failures = compileModule("lib/settings-api.ts", {}, { fetch: async () => { calls++; return new Response("error", { status: 503 }); } });
  await assert.rejects(failures.getReceiptSettings(init), /503/);
  await assert.rejects(failures.getReceiptSettings(init), /503/);
  assert.equal(calls, 5);
});

// Execute the provider's actual hooks and lifecycle with deterministic session,
// storage and deferred API responses, including stale response races.
function providerHarness() {
  const slots = [], effects = [], listeners = new Map(), storage = new Map(), requests = [];
  let storedToken = "";
  let index = 0, session = { data: null, status: "loading" };
  const react = {
    createContext: value => ({ value, Provider: "provider" }),
    useContext: context => context.value,
    useState: initial => { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = index++; return slots[i] ||= { current: initial }; },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: (fn, deps) => { const i = index++; const old = slots[i]; if (!old || deps.some((dep, j) => dep !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const provider = compileModule("components/currency-provider.tsx", {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "next-auth/react": { useSession: () => session }, "next/navigation": { usePathname: () => "/dashboard" },
    "@/lib/auth-storage": { getStoredOwnerToken: () => storedToken }, "@/lib/currency": currency,
    "@/lib/settings-api": { getShopSettings: init => new Promise((resolve, reject) => requests.push({ resolve, reject, init })) },
  }, { localStorage, atob, Event, window: {
    dispatchEvent: event => listeners.get(event.type)?.forEach(fn => fn(event)),
    addEventListener: (name, fn) => { const handlers = listeners.get(name) || new Set(); handlers.add(fn); listeners.set(name, handlers); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  } });
  const render = () => { index = 0; return provider.CurrencyProvider({ children: null }).props.value; };
  return { render, storage, requests, setStoredToken: token => { storedToken = token; }, setSession: (shopId, token) => { session = { status: "authenticated", data: { accessToken: token, user: { shopId } } }; },
    effects: async () => { effects.splice(0).forEach(fn => fn()); await settle(); },
    emit: (name, event) => listeners.get(name)?.forEach(fn => fn(event)),
  };
}
test("cookie-only settings requests never share an account cache",async()=>{
 let calls=0;const api=compileModule("lib/settings-api.ts",{}, {fetch:async()=>{calls++;return new Response('{}')}});
 await api.getReceiptSettingsResponse();await api.getReceiptSettingsResponse();assert.equal(calls,2);
});

const productionCurrency = { shopId:8375, shopCode:"SHP-JB5", currencyCode:"JPY", currencySymbol:"¥", currencyDecimalDigits:0, currencyPosition:"AFTER", taxPercent:0 };
test("production currency preserves AFTER with missing or conflicting region",()=>{
 for(const region of [undefined,null,"","JAPAN","MYANMAR"]) assert.equal(currency.formatCurrency(180,currency.normalizeCurrency({...productionCurrency,region})),"180 ¥");
 assert.equal(currency.formatCurrency(180,currency.normalizeCurrency({region:"JAPAN"})),"180");
 assert.equal(currency.normalizeCurrency({currencyCode:"JPY"}).currencySymbol,"");
});
test("session refresh wins over stored token",async()=>{
 const h=providerHarness();h.setStoredToken("old");h.setSession(8375,"fresh");h.render();await h.effects();h.render();await h.effects();
 assert.equal(h.requests[0].init.headers.Authorization,"Bearer fresh");h.requests[0].resolve(productionCurrency);await settle();assert.equal(h.render().formatMoney(180),"180 ¥");
 h.setSession(8375,"refreshed");h.render();await h.effects();assert.equal(h.requests[1].init.headers.Authorization,"Bearer refreshed");h.requests[1].resolve(productionCurrency);await settle();assert.equal(h.render().formatMoney(180),"180 ¥");
});
test("account switch rejects stale responses and old settings saves",async()=>{
 const h=providerHarness();h.setSession(1,"a");const old=h.render().updateCurrency;await h.effects();h.requests[0].resolve(productionCurrency);await settle();assert.equal(h.render().formatMoney(180),"180 ¥");
 h.emit("online");await settle();h.setSession(2,"b");assert.equal(h.render().formatMoney(180),"180");await h.effects();old(productionCurrency);
 h.requests[2].resolve({currencyCode:"USD",currencySymbol:"$",currencyDecimalDigits:2,currencyPosition:"BEFORE"});await settle();h.requests[1].resolve(productionCurrency);await settle();assert.equal(h.render().formatMoney(180),"$ 180.00");
});
test("latest request wins; empty and failed responses preserve valid currency",async()=>{
 const h=providerHarness();h.setSession(1,"a");h.render();await h.effects();h.emit("online");await settle();h.requests[1].resolve(productionCurrency);await settle();h.requests[0].resolve({currencySymbol:"Ks"});await settle();assert.equal(h.render().formatMoney(180),"180 ¥");
 h.emit("focus");await settle();h.requests[2].resolve({region:""});await settle();assert.equal(h.render().formatMoney(180),"180 ¥");h.emit("online");await settle();h.requests[3].reject(new Error("offline"));await settle();assert.equal(h.render().formatMoney(180),"180 ¥");
});
test("shop currency and receipt metadata use distinct authenticated endpoints",async()=>{
 const calls=[];const api=compileModule("lib/settings-api.ts",{}, {fetch:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(url==="/api/shop/settings"?productionCurrency:{shopName:"Shop"}));}});const init={headers:{Authorization:"Bearer fresh"}};
 assert.equal(currency.formatCurrency(180,currency.normalizeCurrency(await api.getShopSettings(init))),"180 ¥");assert.equal((await api.getReceiptSettings(init)).shopName,"Shop");assert.deepEqual(calls.map(c=>c.url),["/api/shop/settings","/api/receipt-settings/my-shop"]);for(const c of calls){assert.equal(c.init.headers.Authorization,"Bearer fresh");assert.equal(c.init.cache,"no-store");}
});

for (const [path, name] of [
  ["app/(protected)/dashboard/fashion/register/page.tsx", "buildReceiptHtml"],
  ["app/(protected)/dashboard/restaurant-pos/page.tsx", "buildPaymentReceiptHtml"],
  ["app/(protected)/dashboard/restaurant/orders/page.tsx", "buildOrderReceiptHtml"],
]) test(`${name}: printed totals and change use the supplied currency and escape symbols`, () => {
  const source = fs.readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const builder = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const context = { ...dateTime, escapeHtml, Date, Number, String, getFashionSubtitle: () => "", formatReceiptDate: () => "date", formatDateTime: () => "date", formatRatePercent: value => String(value), normalizeOrderType: () => "TAKEAWAY", getPaymentLabel: () => "Cash", parseModifiers: () => [] };
  vm.runInNewContext(ts.transpileModule(`${builder.getText(ast)}\nvar build = ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText, context);
  const receipt = { shopInfo: {}, items: [{ name: "item", itemName: "item", price: 10000, qty: 1, quantity: 1, unitPrice: 10000, totalPrice: 10000 }], receiptNo: "R1", subtotal: 10000, total: 10000, tax: 0, discount: 0, serviceCharge: 0, cashReceived: 10000, changeAmount: 0, paymentMethod: "CASH", paidAt: "2026-10-03", taxRatePercent: 0, serviceChargeRatePercent: 0, ads: [] };
  for (const settings of [config("MMK", "Ks", 0, "AFTER"), config("USD", "$", 2, "BEFORE"), config("JPY", "¥", 0, "BEFORE"), config("USD", "<symbol>", 2, "BEFORE")]) {
    const formatter = amount => currency.formatCurrency(amount, settings);
    const html = name === "buildPaymentReceiptHtml" ? context.build(receipt, { ads: [] }, formatter) : context.build(receipt, formatter);
    assert.ok(html.includes(escapeHtml(formatter(10000))));
    assert.ok(html.includes(escapeHtml(formatter(0))));
    assert.ok(!html.includes("<symbol>"));
  }
});

test("historical receipts preserve snapshots and never infer from current region",()=>{
 assert.equal(currency.formatHistoricalMoney(1000,{region:"JAPAN"}),"1,000");
 assert.equal(currency.formatHistoricalMoney(1000,{region:"JAPAN",currencyCode:"MMK",currencySymbol:"Ks",currencyDecimalDigits:0,currencyPosition:"AFTER"}),"1,000 Ks");
 assert.equal(currency.formatHistoricalMoney(1000,{currencySnapshot:{currencyCode:"JPY",currencySymbol:"¥",currencyDecimalDigits:0,currencyPosition:"BEFORE"}}),"¥1,000");
});

function shopProxy({status=200,body=JSON.stringify(productionCurrency),session={accessToken:"session-token"},env={REMOTE_API_BASE_URL:"https://upstream.example/",NODE_ENV:"production"}}={}) {
 const calls=[];
 const route=compileModule("app/api/shop/settings/route.ts",{"next-auth":{getServerSession:async()=>session},"next/server":{NextResponse:{json:(data,init)=>Response.json(data,init)}},"@/lib/auth":{authOptions:{}}},{Response,process:{env},fetch:async(url,init)=>{calls.push({url,init});return new Response(body,{status,headers:{"Content-Type":"application/json"}});}});
 return {route,calls};
}
test("shop proxy preserves authorization, full body, status and no-store",async()=>{
 for(const status of [200,401,403,503]) {
  const body=status===200?JSON.stringify(productionCurrency):JSON.stringify({message:"upstream failure",detail:"unchanged"});
  const {route,calls}=shopProxy({status,body});const response=await route.GET(new Request("https://pos.example/api/shop/settings",{headers:{Authorization:"Bearer refreshed"}}));
  assert.equal(response.status,status);assert.equal(await response.text(),body);assert.match(response.headers.get("Cache-Control"),/no-store/);
  assert.equal(calls[0].url,"https://upstream.example/api/shop/settings");assert.equal(calls[0].init.headers.Authorization,"Bearer refreshed");
 }
 const cookie=shopProxy();await cookie.route.GET(new Request("https://pos.example/api/shop/settings"));assert.equal(cookie.calls[0].init.headers.Authorization,"Bearer session-token");
 const missing=shopProxy({env:{NODE_ENV:"production"}});assert.equal((await missing.route.GET(new Request("https://pos.example/api/shop/settings"))).status,503);assert.equal(missing.calls.length,0);
 const unauthorized=shopProxy({session:null});assert.equal((await unauthorized.route.GET(new Request("https://pos.example/api/shop/settings"))).status,401);assert.equal(unauthorized.calls.length,0);
});
test("authenticated cookie session never uses another stored account token",async()=>{
 const h=providerHarness();h.setStoredToken("other-account");h.setSession(8375,undefined);h.render();await h.effects();h.render();await h.effects();assert.equal(h.requests[0].init.headers.Authorization,undefined);h.requests[0].resolve(productionCurrency);await settle();assert.equal(h.render().formatMoney(180),"180 \u00a5");
});
