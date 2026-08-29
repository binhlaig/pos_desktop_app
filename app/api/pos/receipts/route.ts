import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const BACKEND_API_BASE_URL = (
  process.env.BACKEND_API_BASE_URL ||
  process.env.REMOTE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

async function getAuthorization(request: Request) {
  const requestAuthorization = request.headers.get("authorization")?.trim();
  if (requestAuthorization) return requestAuthorization;

  const session = await getServerSession(authOptions);
  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;
  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

  return accessToken ? `${tokenType} ${accessToken}` : "";
}

function getBackendUrl(request: Request, path: string) {
  const backendUrl = new URL(path, `${BACKEND_API_BASE_URL}/`);
  const requestUrl = new URL(request.url);

  if (backendUrl.origin === requestUrl.origin) {
    throw new Error("Receipt backend URL points to the Next.js application.");
  }

  return backendUrl;
}

async function forwardBackendResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("json")) {
    const body = await response.json().catch(() => null);
    return NextResponse.json(
      body ?? { message: "Backend returned an empty response." },
      { status: response.status }
    );
  }

  const body = await response.text().catch(() => "");
  return new NextResponse(body || "Backend returned an empty response.", {
    status: response.status,
    headers: {
      "Content-Type": contentType || "text/plain; charset=utf-8",
    },
  });
}

function proxyFailureResponse(error: unknown) {
  const configurationError =
    error instanceof Error && error.message.includes("points to the Next.js");

  return NextResponse.json(
    {
      message: configurationError
        ? "Receipt backend URL is misconfigured."
        : "Receipt backend service is unavailable.",
    },
    { status: configurationError ? 500 : 502 }
  );
}

export async function GET(request: Request) {
  try {
    const authorization = await getAuthorization(request);

    if (!authorization) {
      return NextResponse.json(
        { message: "Authorization token is required." },
        { status: 401 }
      );
    }

    const response = await fetch(
      getBackendUrl(request, "/api/pos/receipts/shop"),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
        },
        cache: "no-store",
      }
    );

    return forwardBackendResponse(response);
  } catch (error) {
    return proxyFailureResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await getAuthorization(request);

    if (!authorization) {
      return NextResponse.json(
        { message: "Authorization token is required." },
        { status: 401 }
      );
    }

    const body = await request.text();
    const response = await fetch(getBackendUrl(request, "/api/pos/receipts"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": request.headers.get("content-type") || "application/json",
        Authorization: authorization,
      },
      body,
      cache: "no-store",
    });

    return forwardBackendResponse(response);
  } catch (error) {
    return proxyFailureResponse(error);
  }
}
