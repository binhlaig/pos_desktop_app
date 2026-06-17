// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// const API_BASE =
//   process.env.NEXT_PUBLIC_API_BASE_URL ||
//   process.env.REMOTE_API_BASE_URL ||
//   "http://localhost:8080";

// export async function POST(req: Request) {
//   try {
//     const session = await getServerSession(authOptions);
//     const accessToken = (session as { accessToken?: string | null } | null)
//       ?.accessToken;
//     const tokenType =
//       (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

//     const body = await req.json();

//     const requestAuthorization =
//       req.headers.get("authorization") || req.headers.get("Authorization") || "";
//     const authorization = accessToken
//       ? `${tokenType} ${accessToken}`
//       : requestAuthorization;

//     if (!authorization) {
//       return NextResponse.json(
//         { message: "Owner login session expired. Please login again." },
//         { status: 401 }
//       );
//     }

//     const res = await fetch(`${API_BASE}/api/pos/receipts`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         Authorization: authorization,
//       },
//       body: JSON.stringify(body),
//       cache: "no-store",
//     });

//     const data = await res.json().catch(() => null);

//     return NextResponse.json(data, { status: res.status });
//   } catch (error) {
//     const message =
//       error instanceof Error ? error.message : "Receipt proxy failed.";

//     return NextResponse.json({ message }, { status: 500 });
//   }
// }





import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE =
  process.env.REMOTE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

async function getAuthorization(req: Request) {
  const session = await getServerSession(authOptions);

  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;

  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";

  const requestAuthorization =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";

  return accessToken ? `${tokenType} ${accessToken}` : requestAuthorization;
}

async function fetchReceiptsList(authorization: string) {
  const paths = [
    "/api/pos/receipts/my",
    "/api/pos/receipts/shop",
    "/api/pos/receipts",
  ];

  let lastData: unknown = null;
  let lastStatus = 500;

  for (const path of paths) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      return { data, status: res.status };
    }

    lastData = data;
    lastStatus = res.status;

    if (res.status < 500) {
      break;
    }
  }

  return { data: lastData, status: lastStatus };
}

// GET /api/pos/receipts
// Login ဝင်ထားတဲ့ user ရဲ့ receipts တွေကို backend list endpoints မှယူမယ်
export async function GET(req: Request) {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return NextResponse.json(
        { message: "Owner login session expired. Please login again." },
        { status: 401 }
      );
    }

    const { data, status } = await fetchReceiptsList(authorization);

    return NextResponse.json(data, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Receipts proxy failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}

// POST /api/pos/receipts
// Payment complete လုပ်တဲ့အခါ receipt ကို backend DB ထဲ save မယ်
export async function POST(req: Request) {
  try {
    const authorization = await getAuthorization(req);

    if (!authorization) {
      return NextResponse.json(
        { message: "Owner login session expired. Please login again." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const res = await fetch(`${API_BASE}/api/pos/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Receipt proxy failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
