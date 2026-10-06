type DateValue = string | Date | number | null | undefined;

export function shopTimezone(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const zone = record.timezone ?? record.shopTimezone ?? record.timeZone;
  if (typeof zone === "string" && zone.trim()) {
    try { new Intl.DateTimeFormat("en-GB", { timeZone: zone.trim() }); return zone.trim(); } catch { /* Invalid API zone. */ }
  }
  for (const key of ["shop", "data", "user", "settings", "profile"]) {
    const nested = shopTimezone(record[key]);
    if (nested) return nested;
  }
  return null;
}

/** Persisted events must identify an instant. Never guess the zone of a wall-clock string. */
export function parseBusinessTimestamp(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && !/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: DateValue, timezone: string | null | undefined, options: Intl.DateTimeFormatOptions, locale = "en-GB") {
  const date = parseBusinessTimestamp(value);
  if (!date || !timezone) return "-";
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone, hour12: false }).format(date);
  } catch { return "-"; }
}

export function formatShopDateTime(value: DateValue, timezone?: string | null) {
  return format(value, timezone, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(", ", " ");
}
export function formatShopDate(value: DateValue, timezone?: string | null, options?: Intl.DateTimeFormatOptions, locale = "en-GB") {
  return format(value, timezone, options || { year: "numeric", month: "2-digit", day: "2-digit" }, locale);
}
export function formatShopTime(value: DateValue, timezone?: string | null) {
  return format(value, timezone, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function shopDateKey(value: DateValue, timezone?: string | null) {
  const date = formatShopDate(value, timezone);
  return date === "-" ? "" : date.split("/").reverse().join("-");
}
export function isShopToday(value: DateValue, timezone?: string | null) {
  const key = shopDateKey(value, timezone);
  return !!key && key === shopDateKey(new Date(), timezone);
}
