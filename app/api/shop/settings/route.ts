import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const API_BASE = (
  process.env.REMOTE_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
).replace(/\/+$/, "");

const SHOP_SETTINGS_PATH =
  process.env.REMOTE_SHOP_SETTINGS_PATH || "/api/shop/settings";

async function getAuthorization(req: Request) {
  const supplied = req.headers.get("authorization")?.trim();
  if (supplied) return supplied;
  const session = await getServerSession(authOptions);

  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;
  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

  const requestAuthorization =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";

  return requestAuthorization || (accessToken ? `${tokenType} ${accessToken}` : "");
}

function noStoreJson(data: unknown, status: number) {
  const response = NextResponse.json(data, { status });

  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(req: Request) {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return noStoreJson(
        { message: "Owner login session expired. Please login again." },
        401
      );
    }

    if (!API_BASE) return noStoreJson({ message: "Shop settings API base URL is not configured." }, 503);

    const res = await fetch(`${API_BASE}${SHOP_SETTINGS_PATH}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
    });

    return new Response(await res.text() || null, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        message:
          error instanceof Error ? error.message : "Shop settings proxy failed.",
      },
      500
    );
  }
}
