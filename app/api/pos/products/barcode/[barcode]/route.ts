import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type ParamsContext = {
  params: Promise<{ barcode: string }> | { barcode: string };
};

function getBackendBase() {
  return (
    process.env.REMOTE_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8080"
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeProductForPos(p: any) {
  const dbId = clean(p?.id);
  const barcode = clean(p?.barcode);
  const sku = clean(p?.sku);

  return {
    id: barcode || sku || dbId,
    dbId,
    sku,
    barcode,

    name: p?.productName ?? p?.product_name ?? p?.name ?? "",
    price: Number(p?.productPrice ?? p?.product_price ?? p?.price ?? 0),

    category: p?.category ?? "General",

    stock: Number(
      p?.productQuantityAmount ??
        p?.product_quantity_amount ??
        p?.stock ??
        p?.quantity ??
        0
    ),

    taxable: true,

    imagePath:
      p?.imagePath ??
      p?.image_path ??
      p?.productImage ??
      p?.product_image ??
      null,

    raw: p,
  };
}

export async function GET(_req: Request, context: ParamsContext) {
  const params = await Promise.resolve(context.params);
  const target = clean(params.barcode);

  if (!target) {
    return NextResponse.json(
      { message: "Barcode is required." },
      { status: 400 }
    );
  }

  const BACKEND_BASE = getBackendBase();

  const session = await getServerSession(authOptions);

  const token =
    (session as any)?.accessToken ||
    (session as any)?.access_token ||
    (session as any)?.token ||
    "";

  try {
    const res = await fetch(`${BACKEND_BASE}/api/products`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);

    if (!res.ok) {
      return NextResponse.json(
        {
          message:
            data?.message ||
            data?.error ||
            "Backend products load failed.",
        },
        { status: res.status }
      );
    }

    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.content)
      ? data.content
      : [];

    const product = arr.find((p: any) => {
      const pBarcode = clean(p?.barcode);
      const pSku = clean(p?.sku);
      const pId = clean(p?.id);

      return pBarcode === target || pSku === target || pId === target;
    });

    if (!product) {
      return NextResponse.json(
        { message: `Product not found for barcode ${target}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      product: normalizeProductForPos(product),
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Barcode lookup API proxy error." },
      { status: 500 }
    );
  }
}