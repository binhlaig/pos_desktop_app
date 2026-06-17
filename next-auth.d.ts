import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string | null;
    tokenType?: string | null;
    accessTokenExpires?: number | null;
    error?: "AccessTokenExpired" | string | null;
    businessType?: string | null;
    shopStatus?: string | null;
    subscriptionPlan?: string | null;
    subscriptionEndDate?: string | null;
    features?: Record<string, unknown> | null;
    limits?: Record<string, unknown> | null;
    user: DefaultSession["user"] & {
      id?: string | number | null;
      username?: string | null;
      role?: string | null;
      shopId?: number | null;
      shopCode?: string | null;
      businessType?: string | null;
      image?: string | null;
      avatarUrl?: string | null;
      imageUrl?: string | null;
      shopStatus?: string | null;
      subscriptionPlan?: string | null;
      subscriptionEndDate?: string | null;
      features?: Record<string, unknown> | null;
      limits?: Record<string, unknown> | null;
      accessToken?: string | null;
      tokenType?: string | null;
    };
  }

  interface User {
    username?: string | null;
    role?: string | null;
    shopId?: number | null;
    shopCode?: string | null;
    businessType?: string | null;
    image?: string | null;
    avatarUrl?: string | null;
    imageUrl?: string | null;
    shopStatus?: string | null;
    subscriptionPlan?: string | null;
    subscriptionEndDate?: string | null;
    features?: Record<string, unknown> | null;
    limits?: Record<string, unknown> | null;
    accessToken?: string | null;
    tokenType?: string | null;
    accessTokenExpires?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string | number | null;
    username?: string | null;
    role?: string | null;
    shopId?: number | null;
    shopCode?: string | null;
    businessType?: string | null;
    image?: string | null;
    shopStatus?: string | null;
    subscriptionPlan?: string | null;
    subscriptionEndDate?: string | null;
    features?: Record<string, unknown> | null;
    limits?: Record<string, unknown> | null;
    accessToken?: string | null;
    tokenType?: string | null;
    accessTokenExpires?: number | null;
    error?: "AccessTokenExpired" | string | null;
  }
}
