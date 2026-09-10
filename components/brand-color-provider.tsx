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
    applyBrandColors(getStoredBrandColors());
  }, []);

  return children;
}