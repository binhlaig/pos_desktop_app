import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
}
function helper(fetch) {
  const context = { exports: {}, crypto: webcrypto, fetch, Uint8Array };
  vm.runInNewContext(compile(fs.readFileSync('lib/receipt-request.ts', 'utf8')), context);
  return context.exports;
}
const callers = [
  'components/regiect.tsx',
  'app/(protected)/dashboard/fashion/register/page.tsx',
  'app/(protected)/dashboard/restaurant-pos/page.tsx',
];

// Execute the actual checkout handler from each TSX file, with every API mocked.
function checkout(path, receiptFetch) {
  const source = fs.readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body, clearBody;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'completePayment') body = node.body;
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'clearCart') clearBody = node.body;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'completePayment') body = node.initializer.body;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(body);
  const calls = [];
  const item = { id: '1', dbId: '1', name: 'Mock item', qty: 1, price: 10, discount: 0, stock: 100, availableForSale: true };
  const noop = () => {};
  const context = {
    console, Math, Number, String, Boolean, JSON, Date, Error,
    receiptSavingRef: { current: false }, paymentSavingRef: { current: false },
    receiptAttemptsRef: { current: new Map() }, activeStaff: { staffId: 'mock', staffName: 'Mock' },
    staffId: 'mock', staffName: 'Mock', staffRole: 'CASHIER', cart: [item],
    paymentMethod: 'cash', cashNumber: 10, total: 10, grandTotal: 10, subtotal: 10,
    tax: 0, discount: 0, globalDiscount: 0, change: 0, serviceCharge: 0,
    serviceChargeRatePercent: 0, taxRatePercent: 0, canPayOrder: true,
    orderType: 'TAKEAWAY', selectedTable: null, selectedTableId: null,
    sessionAccessToken: 'mock', API_BASE: 'https://mock.invalid',
    requireStaff: () => true, getAccessToken: () => 'mock', ensurePageAccessToken: () => 'mock',
    authHeaders: () => ({}), round: (n) => n, validateCartStock: () => null,
    isSameMenuItem: (a, b) => a.id === b.id,
    loadOwnerProducts: async () => [item], fetchProducts: async () => [item], fetchMenuItems: async () => [item],
    asRecord: (v) => v && typeof v === 'object' ? v : {}, getNestedRecord: () => ({}),
    pickString: (v, keys) => keys.map(k => v[k]).find(v => typeof v === 'string') || '',
    getAuthOrFeatureError: async () => null, formatPaymentErrorMessage: v => v,
    toast: { error: noop, success: noop }, router: { refresh: noop },
    tableKitchenOrdersRef: { current: new Map() }, shopInfo: {},
    clearCart: noop, focusScanner: noop, loadReceiptSetting: noop, fetchTables: noop,
    logRequestAuth: noop, reportError: noop,
  };
  for (const name of source.matchAll(/\b(set[A-Z]\w*)\(/g)) context[name[1]] = noop;
  context.fetch = async (url, init) => {
    if (url.endsWith('/api/restaurant/payments')) {
      calls.push({ payment: true });
      return { ok: true, json: async () => ({ paymentNo: 'mock-payment' }) };
    }
    assert.ok(url.endsWith('/api/pos/receipts'));
    const payload = JSON.parse(init.body);
    calls.push(payload);
    return receiptFetch(payload);
  };
  Object.assign(context, helper(context.fetch));
  if (clearBody) vm.runInNewContext(compile(`function clearCart() ${clearBody.getText(ast)}`), context);
  vm.runInNewContext(compile(`async function run(paymentMethod = 'cash', cashGivenAmount = 10) ${body.getText(ast)}`), context);
  return { context, calls, run: () => context.run() };
}

for (const path of callers) {
  test(`${path}: request ID, synchronous double tap, identical retry`, async () => {
    const c = checkout(path, async () => { throw new Error('Mock lost response'); });
    // Stop post-payment UI cleanup so the restaurant attempt remains available for this handler test.
    c.context.setPaymentReceiptData = () => { throw new Error('Stop at mocked UI boundary'); };
    await Promise.all([c.run(), c.run()]);
    const receipts = c.calls.filter(v => !v.payment);
    const restaurant = path.includes('restaurant-pos');
    assert.equal(receipts.length, restaurant ? 2 : 1);
    assert.match(receipts[0].requestId, /^[A-Za-z0-9_-]{1,100}$/);
    assert.equal(c.calls.filter(v => v.payment).length, restaurant ? 1 : 0);
    await c.run();
    assert.ok(c.calls.filter(v => !v.payment).every(v => v.requestId === receipts[0].requestId));
    assert.equal(c.context.paymentSavingRef.current, false);
    assert.equal(c.context.receiptSavingRef.current, false);
  });
  test(`${path}: changed payload and new sale use new IDs`, async () => {
    const c = checkout(path, async () => { throw new Error('Mock offline'); });
    c.context.setPaymentReceiptData = () => { throw new Error('Stop at mocked UI boundary'); };
    await c.run();
    const first = c.calls.find(v => !v.payment).requestId;
    c.context.subtotal = 11;
    await c.run();
    assert.notEqual(c.calls.at(-1).requestId, first);
    c.context.subtotal = 10;
    await c.run();
    assert.equal(c.calls.at(-1).requestId, first);
    c.context.receiptAttemptsRef.current.clear();
    await c.run();
    assert.notEqual(c.calls.at(-1).requestId, first);
  });
  test(`${path}: early validation releases lock`, async () => {
    const c = checkout(path, async () => { throw new Error('Must not POST'); });
    c.context.cart = [];
    c.context.canPayOrder = false;
    await c.run();
    assert.equal(c.calls.length, 0);
    assert.equal(c.context.paymentSavingRef.current, false);
    assert.equal(c.context.receiptSavingRef.current, false);
  });
  test(`${path}: successful sale resets key for identical next sale`, async () => {
    const c = checkout(path, async () => ({
      ok: true, status: 200,
      json: async () => ({ receiptNo: 'mock-receipt' }),
      text: async () => JSON.stringify({ receiptNo: 'mock-receipt' }),
    }));
    await c.run();
    assert.equal(c.context.receiptAttemptsRef.current.size, 0);
    const first = c.calls.find(v => !v.payment).requestId;
    await c.run();
    assert.notEqual(c.calls.at(-1).requestId, first);
  });
}

test('restaurant receipt retry preserves exact body and does not retry 400/409', async () => {
  for (const status of [400, 409, 500]) {
    const calls = [];
    const h = helper(async (url, init) => { calls.push(init.body); return { status }; });
    await h.postReceiptWithRetry('/mock', { body: '{"requestId":"pos_mock"}' });
    assert.equal(calls.length, status === 500 ? 2 : 1);
    assert.ok(calls.every(body => body === calls[0]));
  }
});
