import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const API_BASE =
  process.env.REMOTE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

const SHOP_SETTINGS_PATH =
  process.env.REMOTE_SHOP_SETTINGS_PATH || "/api/shop/settings";

async function getAuthorization(req: Request) {
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

    const res = await fetch(`${API_BASE}${SHOP_SETTINGS_PATH}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return noStoreJson(data, res.status);
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
