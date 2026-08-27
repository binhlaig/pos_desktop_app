import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

type StaffRole = "staff" | "supervise";

type StaffPayload = Record<string, unknown>;
type Attempt = {
  method: string;
  path: string;
  status: number | "network-error";
  error?: string;
};

const BACKEND_BASE = (
  process.env.REMOTE_API_BASE_URL || "http://localhost:8080"
).replace(/\/+$/, "");
const STAFF_VALIDATE_PATH =
  process.env.REMOTE_STAFF_VALIDATE_PATH || "/api/staff/by-staff-id";
const STAFF_LIST_PATH = process.env.REMOTE_STAFF_LIST_PATH || "/api/staff";
const STAFF_ID_KEYS = [
  "staffId",
  "staff_id",
  "staffCode",
  "staff_code",
  "staffNo",
  "staff_no",
  "employeeId",
  "employeeCode",
  "code",
  "id",
];

const normalizeRole = (value: unknown): StaffRole => {
  const role = String(value || "staff").toLowerCase();
  return role === "supervise" || role === "supervisor" || role === "admin"
    ? "supervise"
    : "staff";
};

const pickStaff = (data: unknown): StaffPayload | null => {
  if (!data || typeof data !== "object") return null;

  const payload = data as StaffPayload;
  const nested = payload.staff || payload.data || payload.result || payload.user;

  if (nested && typeof nested === "object") {
    return nested as StaffPayload;
  }

  return payload;
};

const extractStaffList = (data: unknown): StaffPayload[] => {
  if (Array.isArray(data)) return data as StaffPayload[];
  if (!data || typeof data !== "object") return [];

  const payload = data as StaffPayload;
  const list =
    payload.data ||
    payload.content ||
    payload.items ||
    payload.staff ||
    payload.staffs ||
    payload.result ||
    payload.results;

  if (Array.isArray(list)) return list as StaffPayload[];

  const staff = pickStaff(data);
  return staff ? [staff] : [];
};

const getString = (data: StaffPayload, keys: string[]) => {
  for (const key of keys) {
    const realKey =
      Object.keys(data).find((item) => item.toLowerCase() === key.toLowerCase()) ||
      key;
    const value = data[realKey];
    if (value != null && String(value).trim()) return String(value).trim();
  }

  return "";
};

const getBool = (data: StaffPayload, keys: string[], fallback = true) => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (["true", "active", "enabled", "1", "yes"].includes(normalized)) {
        return true;
      }
      if (["false", "inactive", "disabled", "0", "no"].includes(normalized)) {
        return false;
      }
    }
  }

  return fallback;
};

const staffIdMatches = (staff: StaffPayload, staffId: string) =>
  STAFF_ID_KEYS.some(
    (key) => getString(staff, [key]).toLowerCase() === staffId.toLowerCase()
  );

const staffMatchesOwnerShop = (
  staff: StaffPayload,
  shopId?: number | null,
  shopCode?: string | null
) => {
  const shop = staff.shop;
  const nestedShop = shop && typeof shop === "object" ? (shop as StaffPayload) : {};
  const staffShopId = staff.shopId ?? staff.shop_id ?? nestedShop.id ?? nestedShop.shopId;
  const staffShopCode =
    staff.shopCode ?? staff.shop_code ?? nestedShop.code ?? nestedShop.shopCode;

  if (staffShopId != null && shopId != null && Number(staffShopId) !== shopId) {
    return false;
  }

  if (
    staffShopCode != null &&
    shopCode &&
    String(staffShopCode).toUpperCase() !== shopCode.toUpperCase()
  ) {
    return false;
  }

  return true;
};

async function backendFetch(path: string, init: RequestInit) {
  const url = path.startsWith("http") ? path : `${BACKEND_BASE}${path}`;
  return fetch(url, init);
}

function staffValidatePath(staffId: string) {
  const encodedStaffId = encodeURIComponent(staffId);

  if (STAFF_VALIDATE_PATH.includes("{staffId}")) {
    return STAFF_VALIDATE_PATH.replace("{staffId}", encodedStaffId);
  }

  if (/\/by-staff-id\/?$/.test(STAFF_VALIDATE_PATH)) {
    return `${STAFF_VALIDATE_PATH.replace(/\/+$/, "")}/${encodedStaffId}`;
  }

  return STAFF_VALIDATE_PATH;
}

async function backendFetchAttempt(
  path: string,
  init: RequestInit,
  attempts: Attempt[]
) {
  try {
    const res = await backendFetch(path, init);
    attempts.push({
      method: init.method || "GET",
      path,
      status: res.status,
    });
    return res;
  } catch (error) {
    attempts.push({
      method: init.method || "GET",
      path,
      status: "network-error",
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown fetch error",
    });
    return null;
  }
}

async function parseJson(res: Response) {
  return res.json().catch(() => null);
}

async function parseErrorMessage(res: Response) {
  const data = await parseJson(res);
  const message = getString((data || {}) as StaffPayload, [
    "message",
    "error",
    "detail",
  ]);

  if (message) return message;

  const text = await res.text().catch(() => "");
  return text.trim() || "Staff validation failed.";
}

function normalizeStaffSession(
  staff: StaffPayload,
  staffId: string,
  shopId?: number | null,
  shopCode?: string | null
) {
  if (!staffMatchesOwnerShop(staff, shopId, shopCode)) {
    return {
      error: "This Staff ID belongs to another shop.",
      status: 403,
    };
  }

  if (!getBool(staff, ["active", "enabled", "isActive", "status"], true)) {
    return {
      error: "This Staff ID is inactive.",
      status: 403,
    };
  }

  return {
    staff: {
      id:
        getString(staff, STAFF_ID_KEYS) ||
        staffId,
      name: getString(staff, ["name", "staffName", "username", "fullName"]),
      role: normalizeRole(staff.role ?? staff.staffRole),
      shopId,
      shopCode,
    },
  };
}

function makeStaffSessionFromValidResponse(
  data: StaffPayload,
  staffId: string,
  shopId?: number | null,
  shopCode?: string | null
) {
  return {
    staff: {
      id: getString(data, STAFF_ID_KEYS) || staffId,
      name: getString(data, ["name", "staffName", "username", "fullName"]),
      role: normalizeRole(data.role ?? data.staffRole),
      shopId,
      shopCode,
    },
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as { accessToken?: string | null } | null)
    ?.accessToken;
  const tokenType =
    (session as { tokenType?: string | null } | null)?.tokenType || "Bearer";
  const user = session?.user as
    | { shopId?: number | null; shopCode?: string | null }
    | undefined;

  if (!session || !accessToken) {
    return NextResponse.json(
      { message: "Owner login session expired. Please login again." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const staffId = String((body as { staffId?: unknown }).staffId || "").trim();

  if (!staffId) {
    return NextResponse.json(
      { message: "Staff ID is required." },
      { status: 400 }
    );
  }

  const shopId = user?.shopId ?? null;
  const shopCode = user?.shopCode ?? null;
  const authHeaders = {
    Authorization: `${tokenType} ${accessToken}`,
    "Content-Type": "application/json",
  };

  const attempts: Attempt[] = [];
  const validatePayload = { staffId, shopId, shopCode };
  const query = new URLSearchParams({
    staffId,
    staff_id: staffId,
    staffCode: staffId,
    staff_code: staffId,
    username: staffId,
    q: staffId,
    keyword: staffId,
    search: staffId,
    id: staffId,
    ...(shopId != null ? { shopId: String(shopId) } : {}),
    ...(shopId != null ? { shop_id: String(shopId) } : {}),
    ...(shopCode ? { shopCode } : {}),
    ...(shopCode ? { shop_code: shopCode } : {}),
  });

  const shouldTryNextEndpoint = (status: number) =>
    [400, 404, 405, 415, 500].includes(status);

  const validateLooksLikeListPath =
    STAFF_VALIDATE_PATH === STAFF_LIST_PATH ||
    /\/api\/staffs?\/?$/.test(STAFF_VALIDATE_PATH);
  const validatePath = staffValidatePath(staffId);
  const validateUsesPathParameter = validatePath !== STAFF_VALIDATE_PATH;

  const validateRes = validateLooksLikeListPath || validateUsesPathParameter
    ? null
    : await backendFetchAttempt(
        validatePath,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(validatePayload),
        },
        attempts
      );

  if (validateRes?.ok) {
    const data = await parseJson(validateRes);
    const valid = (data as StaffPayload | null)?.valid;
    const staff = pickStaff(data);

    if (valid === true && !staff) {
      return NextResponse.json(
        makeStaffSessionFromValidResponse(
          (data || {}) as StaffPayload,
          staffId,
          shopId,
          shopCode
        )
      );
    }

    if (valid === false || !staff) {
      return NextResponse.json(
        { message: "This Staff ID is not allowed for this owner shop." },
        { status: 403 }
      );
    }

    const normalized = normalizeStaffSession(staff, staffId, shopId, shopCode);

    if ("error" in normalized) {
      return NextResponse.json(
        { message: normalized.error },
        { status: normalized.status }
      );
    }

    return NextResponse.json({ staff: normalized.staff });
  }

  if (validateRes && !shouldTryNextEndpoint(validateRes.status)) {
    return NextResponse.json(
      { message: await parseErrorMessage(validateRes) },
      { status: validateRes.status }
    );
  }

  const validateGetPath = validateUsesPathParameter
    ? validatePath
    : `${validatePath}?${query.toString()}`;
  const validateGetRes = validateLooksLikeListPath
    ? null
    : await backendFetchAttempt(
        validateGetPath,
        {
          method: "GET",
          headers: { Authorization: `${tokenType} ${accessToken}` },
        },
        attempts
      );

  if (validateGetRes?.ok) {
    const data = await parseJson(validateGetRes);
    const valid = (data as StaffPayload | null)?.valid;
    const staff = pickStaff(data);

    if (valid === true && !staff) {
      return NextResponse.json(
        makeStaffSessionFromValidResponse(
          (data || {}) as StaffPayload,
          staffId,
          shopId,
          shopCode
        )
      );
    }

    if (valid === false || !staff) {
      return NextResponse.json(
        { message: "This Staff ID is not allowed for this owner shop." },
        { status: 403 }
      );
    }

    const normalized = normalizeStaffSession(staff, staffId, shopId, shopCode);

    if ("error" in normalized) {
      return NextResponse.json(
        { message: normalized.error },
        { status: normalized.status }
      );
    }

    return NextResponse.json({ staff: normalized.staff });
  }

  if (validateGetRes && !shouldTryNextEndpoint(validateGetRes.status)) {
    return NextResponse.json(
      { message: await parseErrorMessage(validateGetRes) },
      { status: validateGetRes.status }
    );
  }

  const fallbackPaths = [
    STAFF_LIST_PATH,
  ];

  for (const path of fallbackPaths) {
    const res = await backendFetchAttempt(
      path,
      {
        method: "GET",
        headers: { Authorization: `${tokenType} ${accessToken}` },
      },
      attempts
    );

    if (!res?.ok) continue;

    const data = await parseJson(res);
    const staffList = extractStaffList(data);

    const staff = staffList
      .filter(Boolean)
      .map((item) => item as StaffPayload)
      .find((item) => staffIdMatches(item, staffId)) ??
      (staffList.length === 1 ? (staffList[0] as StaffPayload) : null);

    if (!staff) continue;

    const normalized = normalizeStaffSession(staff, staffId, shopId, shopCode);

    if ("error" in normalized) {
      return NextResponse.json(
        { message: normalized.error },
        { status: normalized.status }
      );
    }

    return NextResponse.json({ staff: normalized.staff });
  }

  console.warn("POS staff session lookup failed", {
    staffId,
    shopId,
    shopCode,
    backendBase: BACKEND_BASE,
    attempts,
  });

  return NextResponse.json(
    {
      message: "Staff ID ကို ဒီ owner ရဲ့ shop ထဲမှာမတွေ့ပါ။",
      debug: {
        staffId,
        shopId,
        shopCode,
        backendBase: BACKEND_BASE,
        attempts,
      },
    },
    { status: 403 }
  );
}
