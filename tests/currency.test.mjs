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
const settle = () => new Promise(resolve => setImmediate(resolve));
const config = (code, symbol, digits, position) => currency.normalizeCurrency({ currencyCode: code, currencySymbol: symbol, currencyDecimalDigits: digits, currencyPosition: position });

test("configured symbol, decimals and position override currency defaults", () => {
  assert.equal(currency.formatCurrency(10000, config("MMK", "Ks", 0, "AFTER")), "10,000 Ks");
  assert.equal(currency.formatCurrency(10000, config("JPY", "¥", "0", "BEFORE")), "¥ 10,000");
  assert.equal(currency.formatCurrency(10000, config("USD", "$", "2", "BEFORE")), "$ 10,000.00");
  assert.equal(currency.formatCurrency(10000.5, config("JPY", "custom", 2, "AFTER")), "10,000.50 custom");
});
test("nullable and invalid digits normalize to a safe integer", () => {
  for (const digits of [null, undefined, "", " ", "bad", -1, 1.2, "1.2", 21, Infinity, true]) {
    assert.equal(config(null, null, digits, null).currencyDecimalDigits, 0);
    assert.equal(currency.formatCurrency(10000, config(null, null, digits, null)), "10,000 Ks");
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
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const provider = compileModule("components/currency-provider.tsx", {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "next-auth/react": { useSession: () => session }, "next/navigation": { usePathname: () => "/dashboard" },
    "@/lib/auth-storage": { getStoredOwnerToken: () => "" }, "@/lib/currency": currency,
    "@/lib/settings-api": { invalidateReceiptSettings() {}, getReceiptSettings: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
  }, { localStorage, atob, window: {
    addEventListener: (name, fn) => { const handlers = listeners.get(name) || new Set(); handlers.add(fn); listeners.set(name, handlers); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  } });
  const render = () => { index = 0; return provider.CurrencyProvider({ children: null }).props.value; };
  return { render, storage, requests, setSession: (shopId, token) => { session = { status: "authenticated", data: { accessToken: token, user: { shopId } } }; },
    effects: async () => { effects.splice(0).forEach(fn => fn()); await settle(); },
    emit: (name, event) => listeners.get(name)?.forEach(fn => fn(event)),
  };
}
test("provider saves propagate, stale fetches cannot overwrite, shop caches stay isolated", async () => {
  const h = providerHarness();
  assert.equal(h.render().formatMoney(10000), "10,000 Ks");
  await h.effects();
  h.setSession(1, "first"); h.render(); await h.effects();
  h.requests[0].resolve(config("USD", "$", 2, "BEFORE")); await settle();
  assert.equal(h.render().formatMoney(10000), "$ 10,000.00");
  h.emit("online"); await settle();
  h.render().updateCurrency(config("JPY", "¥", 0, "BEFORE"));
  h.requests[1].resolve(config("USD", "$", 2, "BEFORE")); await settle();
  assert.equal(h.render().formatMoney(10000), "¥ 10,000");
  h.setSession(2, "second");
  assert.equal(h.render().formatMoney(10000), "10,000 Ks");
  await h.effects(); h.requests[2].reject(new Error("offline")); await settle();
  assert.equal(h.render().formatMoney(10000), "10,000 Ks");
  h.setSession(1, "first"); h.render(); await h.effects();
  h.requests[3].reject(new Error("offline")); await settle();
  assert.equal(h.render().formatMoney(10000), "¥ 10,000");
});
test("reload starts with SSR defaults then restores only the current shop cache", async () => {
  const h = providerHarness();
  h.storage.set("pos-receipt-currency:v1:1", JSON.stringify(config("USD", "$", 2, "BEFORE")));
  h.setSession(1, "fresh-token");
  assert.equal(h.render().formatMoney(0), "0 Ks");
  await h.effects();
  h.requests[0].reject(new Error("offline")); await settle();
  assert.equal(h.render().formatMoney(0), "$ 0.00");
});

test("cross-window currency saves update only the matching shop", async () => {
  const h = providerHarness();
  h.setSession(1, "first"); h.render(); await h.effects();
  h.requests[0].resolve(config("USD", "$", 2, "BEFORE")); await settle();
  h.emit("storage", { key: "pos-receipt-currency:v1:2", newValue: JSON.stringify(config("JPY", "¥", 0, "BEFORE")) });
  assert.equal(h.render().formatMoney(0), "$ 0.00");
  h.emit("storage", { key: "pos-receipt-currency:v1:1", newValue: JSON.stringify(config("JPY", "¥", 0, "BEFORE")) });
  assert.equal(h.render().formatMoney(0), "¥ 0");
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
  const context = { escapeHtml, Date, Number, String, getFashionSubtitle: () => "", formatReceiptDate: () => "date", formatDateTime: () => "date", formatRatePercent: value => String(value), normalizeOrderType: () => "TAKEAWAY", getPaymentLabel: () => "Cash", parseModifiers: () => [] };
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
