import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Read the existing authenticated profile endpoint; no separate shop setting.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const authorization = request.headers.get("authorization") ||
    (session?.accessToken ? `${session.tokenType || "Bearer"} ${session.accessToken}` : "");
  if (!authorization) return Response.json({ message: "Authentication required" }, { status: 401 });
  const base = (process.env.REMOTE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
  try {
    const upstream = await fetch(`${base}/api/me/shop`, {
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return Response.json(await upstream.json(), {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ message: "Shop profile unavailable" }, { status: 502 });
  }
}
