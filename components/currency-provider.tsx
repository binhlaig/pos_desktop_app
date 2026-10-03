"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { DEFAULT_CURRENCY, formatCurrency, normalizeCurrency, type CurrencyConfig, type MoneyFormatter } from "@/lib/currency";
import { getReceiptSettings, invalidateReceiptSettings } from "@/lib/settings-api";

type State = { scope: string; currency: CurrencyConfig };
type CurrencyContextValue = {
  currency: CurrencyConfig;
  formatMoney: MoneyFormatter;
  updateCurrency: (data: unknown) => void;
};
const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  formatMoney: (amount, compact) => formatCurrency(amount, DEFAULT_CURRENCY, compact),
  updateCurrency: () => {},
});

function tokenShop(token: string): string {
  try {
    const payload = JSON.parse(atob(token.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
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
  const token = sessionToken || storedToken;
  const shop = sessionToken
    ? session?.user?.shopId ?? session?.user?.shopCode ?? tokenShop(token)
    : tokenShop(token);
  // Unknown-shop credentials never use a persistent cache. Include credentials
  // in the in-memory scope so switching accounts immediately masks old state.
  const scope = token ? `${shop || "unknown"}:${token}` : "";
  const cacheKey = shop ? `pos-receipt-currency:v1:${shop}` : "";
  const currency = scope && state.scope === scope ? state.currency : DEFAULT_CURRENCY;
  const updateCurrency = useCallback((data: unknown) => {
    if (!scope) return;
    const next = normalizeCurrency(data);
    revision.current += 1;
    setState({ scope, currency: next });
    try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    invalidateReceiptSettings();
  }, [scope, cacheKey]);
  useEffect(() => {
    if (!scope || status === "loading") return;
    let active = true;
    const load = async (restoreCache = false) => {
      const requestRevision = ++revision.current;
      // Restore browser storage after the initial hydration render.
      await Promise.resolve();
      if (!active || requestRevision !== revision.current) return;
      if (restoreCache) {
        try {
          const cached = cacheKey && localStorage.getItem(cacheKey);
          if (cached) setState({ scope, currency: normalizeCurrency(JSON.parse(cached)) });
        } catch { /* Ignore unavailable or damaged cache. */ }
      }
      try {
        const data = await getReceiptSettings({ headers: { Authorization: /^Bearer\s/i.test(token) ? token : `${session?.tokenType || "Bearer"} ${token}` } });
        if (active && requestRevision === revision.current) {
          const next = normalizeCurrency(data);
          setState({ scope, currency: next });
          try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Offline display still works in memory. */ }
        }
      } catch { /* Keep this shop's last successfully loaded settings. */ }
    };
    const refresh = () => { invalidateReceiptSettings(); void load(); };
    const syncCache = (event: StorageEvent) => {
      if (!cacheKey || event.key !== cacheKey || !event.newValue) return;
      try {
        const next = normalizeCurrency(JSON.parse(event.newValue));
        revision.current += 1;
        setState({ scope, currency: next });
        invalidateReceiptSettings();
      } catch { /* Ignore damaged cache updates. */ }
    };
    void load(true);
    window.addEventListener("online", refresh);
    window.addEventListener("receipt-shop-settings-updated", refresh);
    window.addEventListener("storage", syncCache);
    return () => {
      active = false;
      window.removeEventListener("online", refresh);
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
