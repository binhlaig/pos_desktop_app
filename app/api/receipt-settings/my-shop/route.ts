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

  return requestAuthorization || (accessToken ? `${tokenType} ${accessToken}` : "");
}

async function proxyReceiptSettings(req: Request, method: "GET" | "POST" | "PUT" | "PATCH") {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return NextResponse.json(
        { message: "Owner login session expired. Please login again." },
        { status: 401 }
      );
    }

    const body = method === "GET" ? undefined : await req.text();

    const res = await fetch(`${API_BASE}/api/receipt-settings/my-shop`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Receipt settings proxy failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return proxyReceiptSettings(req, "GET");
}

export async function POST(req: Request) {
  return proxyReceiptSettings(req, "POST");
}

export async function PUT(req: Request) {
  return proxyReceiptSettings(req, "PUT");
}

export async function PATCH(req: Request) {
  return proxyReceiptSettings(req, "PATCH");
}
