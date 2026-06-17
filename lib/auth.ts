import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { pickBusinessType } from "@/lib/business-type";

type SpringLoginResponse = {
  token?: string;
  accessToken?: string;
  jwt?: string;
  tokenType?: string;
  username?: string;
  role?: string;
  shopId?: number | string | null;
  shopCode?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  businessType?: string | null;
  business_type?: string | null;
  shopType?: string | null;
  shop_type?: string | null;
  shopStatus?: string | null;
  subscriptionPlan?: string | null;
  subscriptionEndDate?: string | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
};

type AuthUserFields = {
  id?: string | number | null;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  shopId?: number | null;
  shopCode?: string | null;
  businessType?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  shopStatus?: string | null;
  subscriptionPlan?: string | null;
  subscriptionEndDate?: string | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  accessToken?: string | null;
  tokenType?: string | null;
  accessTokenExpires?: number | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    const parsed: unknown = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    );
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getTokenExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);
  return Number.isFinite(exp) ? exp : null;
}

function isTokenExpired(exp?: number | null) {
  if (!exp) return false;
  return Math.floor(Date.now() / 1000) >= exp;
}

function pickToken(data: SpringLoginResponse) {
  return pickString(
    data.token ||
      data.accessToken ||
      data.jwt ||
      data.data?.token ||
      data.data?.accessToken ||
      data.data?.jwt,
  );
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNumberOrNull(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickRecordOrNull(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        shopCode: { label: "Shop Code", type: "text" },
      },

      async authorize(credentials) {
        const username = String(credentials?.username || "").trim();
        const password = String(credentials?.password || "");
        const shopCode = String(credentials?.shopCode || "")
          .trim()
          .toUpperCase();

        if (!username || !password || !shopCode) return null;

        const BACKEND_BASE =
          process.env.REMOTE_API_BASE_URL ||
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          "http://localhost:8080";

        try {
          const res = await fetch(`${BACKEND_BASE}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ username, password, shopCode }),
            cache: "no-store",
          });

          if (!res.ok) {
            return null;
          }

          const data: SpringLoginResponse | null = await res
            .json()
            .catch(() => null);

          if (!data) return null;

          const accessToken =
            pickString(data.token, data.accessToken) || pickToken(data);

          if (!accessToken) {
            return null;
          }

          const payload = decodeJwtPayload(accessToken);
          const exp = getTokenExpiry(accessToken);

          const parsedUsername =
            pickString(
              data.username,
              data.user?.username,
              data.user?.name,
              data.data?.username,
              data.data?.name,
              payload?.username,
              payload?.sub,
              username,
            ) || username;

          const parsedId =
            pickString(
              data.user?.id,
              data.data?.id,
              payload?.id,
              payload?.userId,
              payload?.sub,
              parsedUsername,
            ) || parsedUsername;

          const parsedRole =
            pickString(
              data.role,
              data.user?.role,
              data.data?.role,
              payload?.role,
              "CASHIER",
            ) || "CASHIER";

          const parsedShopId = pickNumberOrNull(
            data.shopId,
            data.user?.shopId,
            data.data?.shopId,
            payload?.shopId,
          );

          const parsedShopCode =
            pickString(
              data.shopCode,
              data.user?.shopCode,
              data.data?.shopCode,
              payload?.shopCode,
              shopCode,
            ) || shopCode;

          const parsedImageUrl =
            pickString(
              data.imageUrl,
              data.image,
              data.user?.imageUrl,
              data.user?.image,
              data.user?.avatarUrl,
              data.data?.imageUrl,
              data.data?.image,
              data.data?.avatarUrl,
              payload?.imageUrl,
              payload?.image,
              payload?.avatarUrl,
            ) || null;

          const parsedTokenType =
            pickString(data.tokenType, data.data?.tokenType, payload?.tokenType) ||
            "Bearer";

          const parsedBusinessType =
            pickBusinessType(data) ||
            pickBusinessType(data.user) ||
            pickBusinessType(data.data) ||
            pickBusinessType(payload) ||
            null;

          const parsedShopStatus =
            pickString(
              data.shopStatus,
              data.user?.shopStatus,
              data.data?.shopStatus,
              payload?.shopStatus,
            ) || null;

          const parsedSubscriptionPlan =
            pickString(
              data.subscriptionPlan,
              data.user?.subscriptionPlan,
              data.data?.subscriptionPlan,
              payload?.subscriptionPlan,
            ) || null;

          const parsedSubscriptionEndDate =
            pickString(
              data.subscriptionEndDate,
              data.user?.subscriptionEndDate,
              data.data?.subscriptionEndDate,
              payload?.subscriptionEndDate,
            ) || null;

          const parsedFeatures = pickRecordOrNull(
            data.features,
            data.user?.features,
            data.data?.features,
            payload?.features,
          );

          const parsedLimits = pickRecordOrNull(
            data.limits,
            data.user?.limits,
            data.data?.limits,
            payload?.limits,
          );

          return {
            id: parsedId,
            name: parsedUsername,
            username: parsedUsername,

            role: parsedRole,
            shopId: parsedShopId,
            shopCode: parsedShopCode,

            image: parsedImageUrl,
            imageUrl: parsedImageUrl,
            avatarUrl: parsedImageUrl,

            businessType: parsedBusinessType,

            shopStatus: parsedShopStatus,
            subscriptionPlan: parsedSubscriptionPlan,
            subscriptionEndDate: parsedSubscriptionEndDate,
            features: parsedFeatures,
            limits: parsedLimits,

            accessToken,
            tokenType: parsedTokenType,
            accessTokenExpires: exp,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUserFields;

        token.userId = authUser.id ?? null;
        token.username = authUser.username || authUser.name || null;
        token.role = authUser.role ?? null;

        token.shopId = authUser.shopId ?? null;
        token.shopCode = authUser.shopCode ?? null;
        token.businessType = authUser.businessType ?? null;

        token.image =
          authUser.imageUrl || authUser.image || authUser.avatarUrl || null;

        token.shopStatus = authUser.shopStatus ?? null;
        token.subscriptionPlan = authUser.subscriptionPlan ?? null;
        token.subscriptionEndDate = authUser.subscriptionEndDate ?? null;
        token.features = authUser.features ?? null;
        token.limits = authUser.limits ?? null;

        token.accessToken = authUser.accessToken ?? null;
        token.tokenType = authUser.tokenType || "Bearer";
        token.accessTokenExpires = authUser.accessTokenExpires ?? null;
      }

      const expired = isTokenExpired(
        token.accessTokenExpires as number | null | undefined,
      );

      if (expired) {
        token.error = "AccessTokenExpired";
        token.accessToken = null;
      } else {
        delete token.error;
      }

      return token;
    },

    async session({ session, token }) {
      const expired = isTokenExpired(
        token.accessTokenExpires as number | null | undefined,
      );

      const accessToken = expired ? null : token.accessToken ?? null;
      const tokenType = token.tokenType || "Bearer";

      session.user = {
        ...(session.user || {}),
        id: token.userId ?? null,
        name: token.username ?? null,
        username: token.username ?? null,
        role: token.role ?? null,

        shopId: token.shopId ?? null,
        shopCode: token.shopCode ?? null,
        businessType: token.businessType ?? null,

        image: token.image ?? null,
        imageUrl: token.image ?? null,
        avatarUrl: token.image ?? null,

        shopStatus: token.shopStatus ?? null,
        subscriptionPlan: token.subscriptionPlan ?? null,
        subscriptionEndDate: token.subscriptionEndDate ?? null,
        features: token.features ?? null,
        limits: token.limits ?? null,

        accessToken,
        tokenType,
      };

      session.accessToken = accessToken;
      session.tokenType = tokenType;
      session.businessType = token.businessType ?? null;
      session.shopStatus = token.shopStatus ?? null;
      session.subscriptionPlan = token.subscriptionPlan ?? null;
      session.subscriptionEndDate = token.subscriptionEndDate ?? null;
      session.features = token.features ?? null;
      session.limits = token.limits ?? null;
      session.accessTokenExpires = token.accessTokenExpires ?? null;
      session.error = expired ? "AccessTokenExpired" : token.error ?? null;

      return session;
    },
  },
};
