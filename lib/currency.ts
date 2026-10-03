export type CurrencyConfig = {
  currencyCode: string;
  currencySymbol: string;
  currencyDecimalDigits: number;
  currencyPosition: "BEFORE" | "AFTER";
};

export const DEFAULT_CURRENCY: CurrencyConfig = {
  currencyCode: "MMK",
  currencySymbol: "Ks",
  currencyDecimalDigits: 0,
  currencyPosition: "AFTER",
};

export function receiptSettingsPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const root = data as Record<string, unknown>;
  for (const key of ["data", "setting", "receiptSetting", "receipt_setting", "settings"]) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return receiptSettingsPayload(nested);
    }
  }
  return root;
}

export function normalizeCurrency(data: unknown): CurrencyConfig {
  const value = receiptSettingsPayload(data);
  const text = (input: unknown, fallback: string) =>
    typeof input === "string" && input.trim() ? input.trim() : fallback;
  const rawDigits = value.currencyDecimalDigits ?? value.currency_decimal_digits;
  const digits = typeof rawDigits === "number" || (typeof rawDigits === "string" && rawDigits.trim())
    ? Number(rawDigits) : NaN;
  return {
    currencyCode: text(value.currencyCode ?? value.currency_code, DEFAULT_CURRENCY.currencyCode),
    currencySymbol: text(value.currencySymbol ?? value.currency_symbol, DEFAULT_CURRENCY.currencySymbol),
    currencyDecimalDigits: Number.isInteger(digits) && digits >= 0 && digits <= 20 ? digits : 0,
    currencyPosition: String(value.currencyPosition ?? value.currency_position).toUpperCase() === "BEFORE" ? "BEFORE" : "AFTER",
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
  return normalized.currencyPosition === "BEFORE"
    ? `${normalized.currencySymbol} ${value}`
    : `${value} ${normalized.currencySymbol}`;
}
