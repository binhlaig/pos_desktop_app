"use client";

import { usePathname } from "next/navigation";

import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getPageTypeByPath, isPosCashierRoute } from "@/lib/business-type";
import { DashboardHeader } from "@/components/dashboard/header";


export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const guard = <BusinessTypeGuard allow={getPageTypeByPath(pathname)} />;

  if (isPosCashierRoute(pathname)) {
    return (
      <>
        {guard}
        {children}
      </>
    );
  }

  return (
    // <div className="min-h-screen bg-background text-foreground lg:flex">
    //   {guard}
    //   <DashboardSidebar />
    //   <div className="min-w-0 flex-1">{children}</div>
    // </div>

    <div className="flex min-h-screen">
      <DashboardSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
