export type CurrencyConfig = {
  region?: string | null;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimalDigits: number;
  currencyPosition: "BEFORE" | "AFTER";
};

// Unknown currency must never be silently labelled as MMK or JPY.
export const DEFAULT_CURRENCY: CurrencyConfig = {
  currencyCode: "", currencySymbol: "", currencyDecimalDigits: 0, currencyPosition: "AFTER",
};

export function currencyForRegion(region: unknown): CurrencyConfig {
  switch (String(region ?? "").trim().toUpperCase()) {
    case "JAPAN": return { region: "JAPAN", currencyCode: "JPY", currencySymbol: "¥", currencyDecimalDigits: 0, currencyPosition: "BEFORE" };
    case "MYANMAR": return { region: "MYANMAR", currencyCode: "MMK", currencySymbol: "Ks", currencyDecimalDigits: 0, currencyPosition: "AFTER" };
    default: return DEFAULT_CURRENCY;
  }
}

export function receiptSettingsPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const root = data as Record<string, unknown>;
  for (const key of ["data", "setting", "receiptSetting", "receipt_setting", "settings"]) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      // Keep outer shop metadata when an API wraps only receipt settings.
      return { ...root, ...receiptSettingsPayload(nested) };
    }
  }
  return root;
}

export function normalizeCurrency(data: unknown): CurrencyConfig {
  const value = receiptSettingsPayload(data);
  const text = (input: unknown) => typeof input === "string" ? input.trim() : "";
  const code = text(value.currencyCode ?? value.currency_code ?? value.code).toUpperCase();
  const symbol = text(value.currencySymbol ?? value.currency_symbol ?? value.symbol);
  const rawDigits = value.currencyDecimalDigits ?? value.currency_decimal_digits ?? value.decimalDigits;
  const digits = typeof rawDigits === "number" || (typeof rawDigits === "string" && rawDigits.trim()) ? Number(rawDigits) : NaN;
  const position = String(value.currencyPosition ?? value.currency_position ?? value.position ?? "AFTER").toUpperCase();
  return {
    currencyCode: code, currencySymbol: symbol,
    currencyDecimalDigits: Number.isInteger(digits) && digits >= 0 && digits <= 20 ? digits : 0,
    currencyPosition: position === "BEFORE" ? "BEFORE" : "AFTER",
  };
}

export type MoneyFormatter = (amount?: number | null, compact?: boolean) => string;
export function formatCurrency(amount: number | null | undefined, config: CurrencyConfig, compact = false): string {
  const normalized = normalizeCurrency(config);
  const number = Number(amount ?? 0);
  const value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: normalized.currencyDecimalDigits,
    maximumFractionDigits: normalized.currencyDecimalDigits,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(Number.isFinite(number) ? number : 0);
  if (!normalized.currencySymbol) return value;
  return normalized.currencyPosition === "BEFORE"
    ? `${normalized.currencySymbol}${normalized.currencyCode === "JPY" ? "" : " "}${value}`
    : `${value} ${normalized.currencySymbol}`;
}

// Historical receipts use their saved currency, never today's shop region.
export function formatHistoricalMoney(amount?: number | null, receipt?: unknown): string {
  const row = receipt && typeof receipt === "object" ? receipt as Record<string, unknown> : {};
  const nested = row.currencySnapshot ?? row.currency_snapshot;
  const saved = nested && typeof nested === "object" ? nested as Record<string, unknown> : row;
  const code = saved.currencyCode ?? saved.currency_code;
  const symbol = saved.currencySymbol ?? saved.currency_symbol;
  const snapshot = typeof code === "string" && typeof symbol === "string" && code && symbol
    ? normalizeCurrency({ currencyCode: code, currencySymbol: symbol,
        currencyDecimalDigits: saved.currencyDecimalDigits ?? saved.currency_decimal_digits,
        currencyPosition: String(saved.currencyPosition ?? saved.currency_position ?? "AFTER") })
    : DEFAULT_CURRENCY;
  return formatCurrency(amount, snapshot);
}
