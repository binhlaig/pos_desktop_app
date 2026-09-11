/** Backend availability is independent from inventory quantity. */
export function readAvailableForSale(
  record: Record<string, unknown>,
  fallback = true,
) {
  const key = Object.keys(record).find((candidate) =>
    ["availableforsale", "available_for_sale"].includes(
      candidate.toLowerCase(),
    ),
  );

  if (!key || record[key] == null) return fallback;

  const value = record[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

export const unavailableToastMessage = (name: string) =>
  `${name} is currently Out of Stock and cannot be sold.`;
