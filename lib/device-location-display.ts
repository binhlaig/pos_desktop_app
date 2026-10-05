export type LocationFields = {
  district?: string | null; city?: string | null; region?: string | null; country?: string | null;
  countryCode?: string | null; latitude?: number | null; longitude?: number | null;
  locationAccuracy?: number | null; locationSource?: string | null;
};
export function formatDeviceLocation(row: LocationFields): string {
  const seen = new Set<string>();
  const parts = [row.district, row.city, row.region, row.country || row.countryCode]
    .map(value => value?.trim()).filter((value): value is string => Boolean(value))
    .filter(value => { const key = value.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  if (parts.length) return parts.join(", ");
  return row.locationSource === "GPS" && row.latitude != null && row.longitude != null
    ? "GPS location recorded; place name unavailable" : "Location unavailable";
}
export function deviceLocationDetail(row: LocationFields): string {
  if (row.locationSource === "GPS") {
    return row.locationAccuracy != null && Number.isFinite(row.locationAccuracy) && row.locationAccuracy >= 0
      ? `GPS • ±${Math.round(row.locationAccuracy)} m` : "GPS • accuracy unavailable";
  }
  return row.locationSource === "IP" || [row.city, row.region, row.country, row.countryCode].some(Boolean)
    ? "Approximate network location" : "";
}
