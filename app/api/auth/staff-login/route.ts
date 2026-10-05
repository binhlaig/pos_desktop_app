import { NextRequest } from "next/server";
import { proxySessionRequest } from "@/lib/session-proxy";
export const runtime = "nodejs";
export async function POST(request: NextRequest) { return proxySessionRequest(request, "staff/login"); }
