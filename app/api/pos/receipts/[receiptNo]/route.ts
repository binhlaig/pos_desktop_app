import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.REMOTE_API_BASE_URL ||
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

export async function GET(
  req: Request,
  context: { params: Promise<{ receiptNo: string }> }
) {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return NextResponse.json(
        { message: "Owner login session expired. Please login again." },
        { status: 401 }
      );
    }

    const { receiptNo } = await context.params;

    if (!receiptNo) {
      return NextResponse.json(
        { message: "Receipt No is required." },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${API_BASE}/api/pos/receipts/${encodeURIComponent(receiptNo)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Receipt search proxy failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}