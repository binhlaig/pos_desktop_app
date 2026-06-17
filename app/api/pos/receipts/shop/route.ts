import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE =
  process.env.REMOTE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

async function getAuthorization(req: Request) {
  const session = await getServerSession(authOptions);

  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;

  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

  const requestAuthorization =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";

  return accessToken ? `${tokenType} ${accessToken}` : requestAuthorization;
}

export async function GET(req: Request) {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return NextResponse.json(
        { message: "Owner login session expired. Please login again." },
        { status: 401 }
      );
    }

    const paths = ["/api/pos/receipts/shop", "/api/pos/receipts/my"];
    let lastData: unknown = null;
    let lastStatus = 500;

    for (const path of paths) {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        return NextResponse.json(data, { status: res.status });
      }

      lastData = data;
      lastStatus = res.status;

      if (res.status < 500) {
        break;
      }
    }

    return NextResponse.json(lastData, { status: lastStatus });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shop receipts proxy failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
