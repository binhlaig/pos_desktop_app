"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { DEFAULT_CURRENCY, formatCurrency, normalizeCurrency, type CurrencyConfig, type MoneyFormatter } from "@/lib/currency";
import { getShopSettings } from "@/lib/settings-api";

type State = { scope: string; currency: CurrencyConfig };
type CurrencyContextValue = { currency: CurrencyConfig; formatMoney: MoneyFormatter; updateCurrency: (data: unknown) => void };
const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  formatMoney: (amount, compact) => formatCurrency(amount, DEFAULT_CURRENCY, compact),
  updateCurrency: () => {},
});
function tokenShop(token: string): string {
  try {
    const part = token.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return String(payload.shopId ?? payload.shop_id ?? payload.shopCode ?? "");
  } catch { return ""; }
}
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [storedToken, setStoredToken] = useState("");
  const [state, setState] = useState<State>({ scope: "", currency: DEFAULT_CURRENCY });
  const revision = useRef(0);
  useEffect(() => {
    const sync = () => { try { setStoredToken(getStoredOwnerToken() || ""); } catch { setStoredToken(""); } };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pos-auth-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pos-auth-updated", sync);
    };
  }, [pathname, status]);
  const sessionToken = session?.accessToken || session?.user?.accessToken;
  // A refreshed session token may differ from an older stored token.
  // Use the session and its shop together; never disable authenticated loading.
  const token = sessionToken || (status === "unauthenticated" ? storedToken : "");
  const shop = status === "authenticated" ? session?.user?.shopId ?? session?.user?.shopCode ?? tokenShop(token) : tokenShop(token);
  const scope = token ? `${shop || "unknown"}:${token}`
    : status === "authenticated" && shop ? `${shop}:cookie-session` : "";
  const cacheKey = shop ? `pos-receipt-currency:v1:${shop}` : "";
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const currency = scope && state.scope === scope ? state.currency : DEFAULT_CURRENCY;
  const updateCurrency = useCallback((data: unknown) => {
    if (!scope || activeScope.current !== scope) return;
    const next = normalizeCurrency(data);
    if (next.currencyCode || next.currencySymbol) {
      revision.current += 1;
      setState({ scope, currency: next });
    }
    // A partial settings-save response may omit region; reload shop metadata.
    window.dispatchEvent(new Event("receipt-shop-settings-updated"));
  }, [scope]);
  useEffect(() => {
    if (!scope || status === "loading") return;
    let active = true;
    const load = async () => {
      const requestRevision = ++revision.current;
      await Promise.resolve();
      if (!active || activeScope.current !== scope || requestRevision !== revision.current) return;
      try { if (cacheKey) localStorage.removeItem(cacheKey); } catch { /* Legacy cache is not authoritative. */ }
      const headers: Record<string, string> = token ? { Authorization: /^Bearer\s/i.test(token) ? token : `${session?.tokenType || "Bearer"} ${token}` } : {};
      let next = DEFAULT_CURRENCY;
      try { next = normalizeCurrency(await getShopSettings({ headers })); }
      catch { /* Keep known currency for this authenticated scope on failure. */ }
      if (!active || activeScope.current !== scope || requestRevision !== revision.current) return;
      // An empty/failed response must not erase this scope's known currency.
      if (next.currencyCode || next.currencySymbol) setState({ scope, currency: next });
    };
    const refresh = () => { void load(); };
    const syncCache = (event: StorageEvent) => { if (event.key === cacheKey) refresh(); };
    void load();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("receipt-shop-settings-updated", refresh);
    window.addEventListener("storage", syncCache);
    return () => {
      active = false;
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("receipt-shop-settings-updated", refresh);
      window.removeEventListener("storage", syncCache);
    };
  }, [scope, token, cacheKey, status, session?.tokenType]);
  const value = useMemo(() => ({ currency, updateCurrency, formatMoney: (amount?: number | null, compact = false) => formatCurrency(amount, currency, compact) }), [currency, updateCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
export function useCurrency() { return useContext(CurrencyContext); }
export function Money({ amount }: { amount: number }) {
  const { formatMoney } = useCurrency();
  return <>{formatMoney(amount)}</>;
}
