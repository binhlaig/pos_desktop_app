"use client";

import { usePathname } from "next/navigation";

import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getPageTypeByPath, isPosCashierRoute } from "@/lib/business-type";

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
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {guard}
      <DashboardSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
