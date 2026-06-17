import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const sessionRecord = session as
    | (typeof session & { accessToken?: unknown; error?: unknown })
    | null;

  if (
    !session ||
    !sessionRecord?.accessToken ||
    sessionRecord.error === "AccessTokenExpired"
  ) {
    redirect("/login");
  }

  return children;
}
