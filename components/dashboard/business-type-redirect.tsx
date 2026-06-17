"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { getHomePathByBusinessType } from "@/lib/business-type";
import { resolveCurrentBusinessType } from "@/components/dashboard/business-type-client";

export function BusinessTypeRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function redirectByBusinessType() {
      const type = await resolveCurrentBusinessType();

      if (active) router.replace(getHomePathByBusinessType(type));
    }

    void redirectByBusinessType();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening dashboard...
      </div>
    </main>
  );
}
