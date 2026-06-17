import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black tracking-normal sm:text-3xl">
            Products
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Supermarket product management route.
          </p>
        </header>

        <Card className="rounded-md border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Product tools</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild className="rounded-md">
              <Link href="/admin/law_stock_products">Open stock products</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md">
              <Link href="/dashboard/register">Open POS</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
