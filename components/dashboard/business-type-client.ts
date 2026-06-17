"use client";

import { getSession } from "next-auth/react";

import {
  BusinessType,
  decodeJwtBusinessType,
  getStoredBusinessType,
  pickBusinessType,
  storeBusinessType,
} from "@/lib/business-type";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getStoredToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("pos_shop_owner_token") ||
    localStorage.getItem("pos_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

export async function resolveCurrentBusinessType(): Promise<BusinessType | null> {
  const session = await getSession().catch(() => null);
  const sessionRecord = asRecord(session);
  const userRecord = asRecord(sessionRecord.user);

  const fromSession =
    pickBusinessType(sessionRecord) || pickBusinessType(userRecord);
  if (fromSession) {
    storeBusinessType(fromSession);
    return fromSession;
  }

  const fromStorage = getStoredBusinessType();
  if (fromStorage) return fromStorage;

  const fromSessionJwt = decodeJwtBusinessType(
    typeof sessionRecord.accessToken === "string"
      ? sessionRecord.accessToken
      : null
  );
  if (fromSessionJwt) {
    storeBusinessType(fromSessionJwt);
    return fromSessionJwt;
  }

  const fromStoredJwt = decodeJwtBusinessType(getStoredToken());
  if (fromStoredJwt) {
    storeBusinessType(fromStoredJwt);
    return fromStoredJwt;
  }

  const res = await fetch("/api/shop/settings", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  const fromShopSettings = pickBusinessType(data);

  if (fromShopSettings) {
    storeBusinessType(fromShopSettings);
  }

  return fromShopSettings;
}
