// import { getServerSession } from "next-auth";
// import { NextResponse } from "next/server";

// import { authOptions } from "@/lib/auth";

// type BackendProduct = Record<string, unknown>;

// const BACKEND_BASE = process.env.REMOTE_API_BASE_URL || "http://localhost:8080";
// const PRODUCTS_PATH = process.env.REMOTE_PRODUCTS_PATH || "/api/products";

// const getString = (data: BackendProduct, keys: string[]) => {
//   for (const key of keys) {
//     const realKey =
//       Object.keys(data).find((item) => item.toLowerCase() === key.toLowerCase()) ||
//       key;
//     const value = data[realKey];
//     if (value != null && String(value).trim()) return String(value).trim();
//   }

//   return "";
// };

// const getNumber = (data: BackendProduct, keys: string[]) => {
//   for (const key of keys) {
//     const realKey =
//       Object.keys(data).find((item) => item.toLowerCase() === key.toLowerCase()) ||
//       key;
//     const value = data[realKey];
//     const numberValue =
//       typeof value === "number" ? value : Number(String(value ?? "").trim());

//     if (Number.isFinite(numberValue)) return numberValue;
//   }

//   return 0;
// };

// const extractProducts = (data: unknown): BackendProduct[] => {
//   if (Array.isArray(data)) return data as BackendProduct[];
//   if (!data || typeof data !== "object") return [];

//   const payload = data as BackendProduct;
//   const list =
//     payload.data ||
//     payload.content ||
//     payload.items ||
//     payload.products ||
//     payload.result ||
//     payload.results;

//   return Array.isArray(list) ? (list as BackendProduct[]) : [];
// };

// export async function GET() {
//   const session = await getServerSession(authOptions);
//   const accessToken = (session as { accessToken?: string | null } | null)
//     ?.accessToken;
//   const tokenType =
//     (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

//   if (!session || !accessToken) {
//     return NextResponse.json(
//       { message: "Owner login session expired. Please login again." },
//       { status: 401 }
//     );
//   }

//   try {
//     const res = await fetch(`${BACKEND_BASE}${PRODUCTS_PATH}`, {
//       method: "GET",
//       headers: { Authorization: `${tokenType} ${accessToken}` },
//     });

//     const data = await res.json().catch(() => null);

//     if (!res.ok) {
//       return NextResponse.json(
//         {
//           message:
//             getString((data || {}) as BackendProduct, ["message", "error"]) ||
//             "Failed to load products.",
//         },
//         { status: res.status }
//       );
//     }

//     const products = extractProducts(data)
//       .map((product) => {
//         const dbId = getNumber(product, ["id"]);
//         const barcode = getString(product, [
//           "barcode",
//           "barCode",
//           "productBarcode",
//           "product_barcode",
//         ]);
//         const sku = getString(product, ["sku"]);
//         const id =
//           barcode ||
//           sku ||
//           getString(product, ["code", "productCode", "id"]);
//         const name =
//           getString(product, [
//             "productName",
//             "product_name",
//             "name",
//             "title",
//           ]) || id;

//         return {
//           id,
//           dbId,
//           barcode,
//           name,
//           price: getNumber(product, [
//             "productPrice",
//             "product_price",
//             "price",
//             "salePrice",
//           ]),
//           category: getString(product, ["category"]) || "General",
//           taxable: true,
//           stock: getNumber(product, [
//             "productQuantityAmount",
//             "product_quantity_amount",
//             "quantity",
//             "stock",
//           ]),
//           sku,
//           imageUrl: getString(product, [
//             "imagePath",
//             "image_path",
//             "imageUrl",
//             "image_url",
//           ]),
//           discount: getNumber(product, [
//             "productDiscount",
//             "product_discount",
//             "discount",
//           ]),
//         };
//       })
//       .filter((product) => product.id && product.name && product.price > 0);

//     return NextResponse.json({ products });
//   } catch (error) {
//     return NextResponse.json(
//       {
//         message:
//           error instanceof Error
//             ? error.message
//             : "Failed to connect to product API.",
//       },
//       { status: 502 }
//     );
//   }
// }






import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

type BackendProduct = Record<string, unknown>;

const BACKEND_BASE = process.env.REMOTE_API_BASE_URL || "http://localhost:8080";
const PRODUCTS_PATH = process.env.REMOTE_PRODUCTS_PATH || "/api/products";

const getString = (data: BackendProduct, keys: string[]) => {
  for (const key of keys) {
    const realKey =
      Object.keys(data).find((item) => item.toLowerCase() === key.toLowerCase()) ||
      key;
    const value = data[realKey];
    if (value != null && String(value).trim()) return String(value).trim();
  }

  return "";
};

const getNumber = (data: BackendProduct, keys: string[]) => {
  for (const key of keys) {
    const realKey =
      Object.keys(data).find((item) => item.toLowerCase() === key.toLowerCase()) ||
      key;
    const value = data[realKey];
    const numberValue =
      typeof value === "number" ? value : Number(String(value ?? "").trim());

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return 0;
};

const extractProducts = (data: unknown): BackendProduct[] => {
  if (Array.isArray(data)) return data as BackendProduct[];
  if (!data || typeof data !== "object") return [];

  const payload = data as BackendProduct;
  const list =
    payload.data ||
    payload.content ||
    payload.items ||
    payload.products ||
    payload.result ||
    payload.results;

  return Array.isArray(list) ? (list as BackendProduct[]) : [];
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;
  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

  if (!session || !accessToken) {
    return NextResponse.json(
      { message: "Owner login session expired. Please login again." },
      { status: 401 }
    );
  }

  try {
    const res = await fetch(`${BACKEND_BASE}${PRODUCTS_PATH}`, {
      method: "GET",
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          message:
            getString((data || {}) as BackendProduct, ["message", "error"]) ||
            "Failed to load products.",
        },
        { status: res.status }
      );
    }

    const products = extractProducts(data)
      .map((product) => {
        const dbId = getNumber(product, ["id"]);
        const barcode = getString(product, [
          "barcode",
          "barCode",
          "productBarcode",
          "product_barcode",
        ]);
        const sku = getString(product, ["sku"]);
        const id =
          barcode ||
          sku ||
          getString(product, ["code", "productCode", "id"]);
        const name =
          getString(product, [
            "productName",
            "product_name",
            "name",
            "title",
          ]) || id;

        return {
          id,
          dbId,
          barcode,
          name,
          price: getNumber(product, [
            "productPrice",
            "product_price",
            "price",
            "salePrice",
          ]),
          category:
            getString(product, ["category"]) || "General",
          taxable: true,
          stock: getNumber(product, [
            "productQuantityAmount",
            "product_quantity_amount",
            "quantity",
            "stock",
          ]),
          sku,
          imageUrl: getString(product, [
            "imagePath",
            "image_path",
            "imageUrl",
            "image_url",
          ]),
          discount: getNumber(product, [
            "productDiscount",
            "product_discount",
            "discount",
          ]),
        };
      })
      .filter((product) => product.id && product.name && product.price > 0);

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to connect to product API.",
      },
      { status: 502 }
    );
  }
}
