import "server-only";
import { NextRequest } from "next/server";

export async function proxySessionRequest(request: NextRequest, action: "staff/login" | "refresh") {
  const configured = process.env.APP_FRONTEND_ORIGIN?.trim();
  if (!configured) return Response.json({ error: "Auth origin is not configured" }, { status: 503 });
  let origin: string;
  try { origin = new URL(configured).origin; } catch { return Response.json({ error: "Invalid auth origin" }, { status: 503 }); }
  if (request.headers.get("origin") !== origin) return Response.json({ error: "Allowed Origin required" }, { status: 403 });
  const base = (process.env.REMOTE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
  const headers = new Headers({ "Content-Type": "application/json", Origin: origin });
  // These headers are trusted only with ingress restricted to a sanitizing proxy.
  for (const name of ["user-agent","cf-connecting-ip","x-forwarded-for","x-real-ip","cf-ipcountry","x-geo-region","x-geo-city","x-device-id","x-device-name"]) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  if (action === "refresh") {
    const cookie = request.cookies.get("pos_refresh")?.value;
    if (cookie) headers.set("Cookie", `pos_refresh=${encodeURIComponent(cookie)}`);
  }
  try {
    const upstream = await fetch(`${base}/api/auth/${action}`, { method: "POST", headers,
      body: action === "refresh" ? undefined : await request.text(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    const response = new Response(await upstream.text(), { status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (cookie.startsWith("pos_refresh=") && /;\s*HttpOnly(?:;|$)/i.test(cookie)) response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch { return Response.json({ error: "Auth service unavailable" }, { status: 503 }); }
}
