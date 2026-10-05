import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

import { withRefreshCookieBridge } from "@/lib/session-cookie-bridge";
const handler = withRefreshCookieBridge(NextAuth(authOptions));

export { handler as GET, handler as POST };
