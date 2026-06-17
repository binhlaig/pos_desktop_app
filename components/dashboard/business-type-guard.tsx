"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  BusinessPageType,
  canAccessBusinessPage,
  getHomePathByBusinessType,
} from "@/lib/business-type";
import { resolveCurrentBusinessType } from "@/components/dashboard/business-type-client";

type BusinessTypeGuardProps = {
  allow: BusinessPageType;
};

export function BusinessTypeGuard({ allow }: BusinessTypeGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function guardRoute() {
      const type = await resolveCurrentBusinessType();

      if (!active || canAccessBusinessPage(type, allow)) return;

      router.replace(getHomePathByBusinessType(type));
    }

    void guardRoute();

    return () => {
      active = false;
    };
  }, [allow, pathname, router]);

  return null;
}
