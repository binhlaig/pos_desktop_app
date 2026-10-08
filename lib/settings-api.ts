export type ReceiptSettings = {
  region?: string | null;
  currencyCode?: string | null;
  currencySymbol?: string | null;
  currencyDecimalDigits?: number | string | null;
  currencyPosition?: string | null;
};

// Reuse the register's authenticated same-origin proxy; clones let existing
// receipt/print metadata consumers share the provider's request safely.
const requests = new Map<string, { expires: number; response: Promise<Response> }>();
export async function getReceiptSettingsResponse(init: RequestInit = {}): Promise<Response> {
  const key = new Headers(init.headers).get("Authorization");
  // A cookie-only request has no verifiable shop identity here. Never reuse
  // another session's response after an account switch.
  if (!key) return fetch("/api/receipt-settings/my-shop", { ...init, method: "GET", cache: "no-store" });
  const existing = requests.get(key);
  if (existing && existing.expires > Date.now()) return (await existing.response).clone();
  const response = fetch("/api/receipt-settings/my-shop", { ...init, method: "GET", cache: "no-store" });
  const entry = { expires: Date.now() + 30_000, response };
  requests.set(key, entry);
  try {
    const result = await response;
    if (!result.ok && requests.get(key) === entry) requests.delete(key);
    return result.clone();
  } catch (error) {
    if (requests.get(key) === entry) requests.delete(key);
    throw error;
  }
}

export function invalidateReceiptSettings() { requests.clear(); }

export async function getReceiptSettings(init: RequestInit = {}): Promise<unknown> {
  const response = await getReceiptSettingsResponse(init);
  if (!response.ok) throw new Error(`Receipt settings request failed (${response.status})`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Invalid receipt settings response");
  return data;
}

// Currency belongs to shop settings; receipt-settings/my-shop is print metadata.
export async function getShopSettings(init: RequestInit = {}): Promise<unknown> {
  const response = await fetch("/api/shop/settings", { ...init, method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`Shop settings request failed (${response.status})`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid shop settings response");
  return data;
}
