import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const context = { exports: {}, Intl, Date, Number };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/date-time.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { formatShopDateTime, formatShopDate, formatShopTime, shopDateKey, isShopToday, shopTimezone } = context.exports;

test("the same UTC record displays the authenticated shop time on every host", () => {
  const original = process.env.TZ;
  try {
    for (const host of ["Asia/Tokyo", "Asia/Yangon", "America/Los_Angeles", "UTC"]) {
      process.env.TZ = host;
      assert.equal(formatShopDateTime("2026-10-06T04:00:00Z", "Asia/Yangon"), "06/10/2026 10:30:00");
      assert.equal(formatShopDateTime("2026-10-06T04:00:00Z", "Asia/Tokyo"), "06/10/2026 13:00:00");
      assert.equal(formatShopDate("2026-10-05T16:00:00Z", "Asia/Yangon"), "05/10/2026");
      assert.equal(shopDateKey("2026-10-05T16:00:00Z", "Asia/Tokyo"), "2026-10-06");
      assert.equal(formatShopTime("2026-10-06T04:00:00Z", "Asia/Yangon"), "10:30:00");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("missing values and an unavailable authenticated zone never use the browser zone", () => {
  for (const value of [null, undefined, "", "invalid", new Date(NaN)]) {
    assert.equal(formatShopDateTime(value, "Asia/Tokyo"), "-");
    assert.equal(shopDateKey(value, "Asia/Tokyo"), "");
    assert.equal(isShopToday(value, "Asia/Tokyo"), false);
  }
  assert.equal(formatShopDateTime("2026-10-06T04:00:00Z", ""), "-");
  assert.equal(formatShopDateTime(new Date("2026-10-06T04:00:00Z"), "Asia/Tokyo"), "06/10/2026 13:00:00");
  assert.equal(formatShopDateTime(0, "UTC"), "01/01/1970 00:00:00");
});

test("existing login and shop profile response shapes supply one validated timezone", () => {
  assert.equal(shopTimezone({ timezone: "Asia/Yangon" }), "Asia/Yangon");
  assert.equal(shopTimezone({ data: { shop: { region: "JAPAN", timezone: "Asia/Tokyo" } } }), "Asia/Tokyo");
  assert.equal(shopTimezone({ user: { timezone: "Asia/Tokyo" } }), "Asia/Tokyo");
  assert.equal(shopTimezone({ timezone: "invalid" }), null);
  assert.equal(shopTimezone({ region: "MYANMAR" }), null);
});

test("bad timezone and ambiguous timestamp strings cannot crash or use host time", () => {
  for (const formatter of [formatShopDateTime, formatShopDate, formatShopTime]) {
    assert.equal(formatter("2026-10-06T04:00:00Z", "Invalid/Timezone"), "-");
    assert.equal(formatter("2026-10-06T04:00:00Z", null), "-");
    assert.equal(formatter("2026-10-06T04:00:00Z", undefined), "-");
    assert.equal(formatter("2026-10-06T04:00:00", "Asia/Tokyo"), "-");
  }
  assert.equal(formatShopDateTime("2026-10-06T04:00:00+00:00", "Asia/Yangon"), "06/10/2026 10:30:00");
  assert.equal(formatShopDate("2026-10-06T04:00:00Z", "Invalid/Timezone", { month: "short" }), "-");
});

test("provider loads /api/me/shop and never displays a previous shop's timezone", async () => {
  const slots = [], effects = [], requests = [];
  let index = 0, session = { data: { accessToken: "myanmar-token", user: {} }, status: "authenticated" };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useContext: () => "",
    useState: initial => {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = next; }];
    },
    useEffect: (fn, deps) => {
      const i = index++, old = slots[i];
      if (!old || deps.some((dep, j) => dep !== old.deps[j])) effects.push(() => {
        old?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx: (_, props) => props },
    "next-auth/react": { useSession: () => session },
    "next/navigation": { usePathname: () => "/dashboard" },
    "@/lib/auth-storage": { getStoredOwnerToken: () => "" },
    "@/lib/date-time": context.exports,
  };
  const runtime = {
    exports: {},
    require: name => dependencies[name],
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("components/shop-timezone-provider.tsx", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, runtime);
  const render = () => { index = 0; return runtime.exports.ShopTimezoneProvider({ children: null }).value; };
  const runEffects = () => { while (effects.length) effects.shift()(); };
  const respond = async (request, timezone) => {
    request.resolve({ ok: true, json: async () => ({ timezone }) });
    await new Promise(resolve => setImmediate(resolve));
  };
  assert.equal(render(), ""); runEffects();
  assert.equal(requests[0].url, "/api/me/shop");
  assert.equal(requests[0].options.headers.Authorization, "Bearer myanmar-token");
  await respond(requests[0], "Asia/Yangon");
  assert.equal(render(), "Asia/Yangon"); runEffects();
  assert.equal(requests.length, 1, "loading timezone must not trigger another fetch");
  session = { data: { accessToken: "japan-token", user: {} }, status: "authenticated" };
  assert.equal(render(), ""); runEffects();
  await respond(requests[1], "Asia/Tokyo");
  assert.equal(render(), "Asia/Tokyo");
  session = { data: { accessToken: "old-token", user: {} }, status: "authenticated" };
  render(); runEffects();
  session = { data: { accessToken: "new-token", user: {} }, status: "authenticated" };
  render(); runEffects();
  await respond(requests[2], "Asia/Yangon");
  assert.equal(render(), "", "a stale response cannot populate the new shop");
  await respond(requests[3], "Asia/Tokyo");
  assert.equal(render(), "Asia/Tokyo");
  session = { data: null, status: "unauthenticated" };
  assert.equal(render(), "");
});
