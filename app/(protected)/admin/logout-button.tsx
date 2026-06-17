"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clearStoredAuthData } from "@/lib/auth-storage";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    clearStoredAuthData();
    await signOut({ redirect: false, callbackUrl: "/login" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className="rounded-md border-slate-300"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
