"use client";

import { useEffect } from "react";

import {
  applyBrandColors,
  getStoredBrandColors,
} from "@/lib/brand-colors";

export function BrandColorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos-dashboard-color");
      const allowed = ["blue", "violet", "emerald", "rose", "amber", "indigo"];
      document.documentElement.setAttribute("data-dashboard-color", saved && allowed.includes(saved) ? saved : "blue");
    } catch { /* Use the SSR default when storage is unavailable. */ }
    applyBrandColors(getStoredBrandColors());
  }, []);

  return children;
}
