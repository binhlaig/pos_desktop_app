const AUTH_STORAGE_KEYS = [
  "pos_shop_owner_token",
  "pos_access_token",
  "access_token",
  "token",
  "business_type",
  "businessType",
  "shop_business_type",
  "pos_business_type",
];

export function getStoredOwnerToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

export function clearStoredAuthData() {
  if (typeof window === "undefined") return;

  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
