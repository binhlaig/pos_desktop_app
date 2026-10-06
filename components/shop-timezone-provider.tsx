"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getStoredOwnerToken } from "@/lib/auth-storage";
import { shopTimezone } from "@/lib/date-time";

const ShopTimezoneContext = createContext("");

export function ShopTimezoneProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [storedToken, setStoredToken] = useState("");
  const [profile, setProfile] = useState({ scope: "", timezone: "" });
  useEffect(() => {
    const sync = () => {
      try { setStoredToken(getStoredOwnerToken() || ""); }
      catch { setStoredToken(""); }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pos-auth-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pos-auth-updated", sync);
    };
  }, [pathname, status]);
  const sessionToken = session?.accessToken || session?.user?.accessToken;
  const token = sessionToken || storedToken;
  const timezone = (token && profile.scope === token ? profile.timezone : "") ||
    (sessionToken ? shopTimezone(session?.user) : null) || "";
  useEffect(() => {
    if (!token || status === "loading") return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/me/shop", {
          headers: { Authorization: /^Bearer\s/i.test(token) ? token : `${session?.tokenType || "Bearer"} ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const zone = shopTimezone(await response.json());
        if (active && zone) setProfile({ scope: token, timezone: zone });
      } catch { /* Keep timestamps unavailable until the authenticated zone is known. */ }
    };
    void load();
    window.addEventListener("online", load);
    window.addEventListener("receipt-shop-settings-updated", load);
    return () => {
      active = false;
      window.removeEventListener("online", load);
      window.removeEventListener("receipt-shop-settings-updated", load);
    };
  }, [token, status, session?.tokenType]);
  return <ShopTimezoneContext.Provider value={timezone}>{children}</ShopTimezoneContext.Provider>;
}

export function useShopTimezone() { return useContext(ShopTimezoneContext); }
