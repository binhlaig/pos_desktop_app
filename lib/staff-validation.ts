const DEFAULT_API_BASE_URL = "http://localhost:8080";

export const PUBLIC_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

function payloadMessage(payload: unknown) {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;

  for (const key of ["message", "error", "detail", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

async function readPayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function authorizationValue(accessToken: string) {
  return accessToken.startsWith("Bearer ")
    ? accessToken
    : `Bearer ${accessToken}`;
}

export function buildStaffValidationUrl(staffId: string) {
  return `${PUBLIC_API_BASE_URL}/api/staff/by-staff-id/${encodeURIComponent(
    staffId.trim(),
  )}`;
}

export async function fetchStaffById(staffId: string, accessToken: string) {
  const url = buildStaffValidationUrl(staffId);
  const cleanToken = accessToken.trim();

  if (process.env.NODE_ENV === "development") {
    console.debug("[Staff validation]", {
      url,
      hasAuthorization: Boolean(cleanToken),
    });
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cleanToken
          ? { Authorization: authorizationValue(cleanToken) }
          : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `Backend API is not reachable at ${PUBLIC_API_BASE_URL}. Check that the backend is running and allows requests from this app.`,
    );
  }

  const payload = await readPayload(response);

  if (!response.ok) {
    const backendMessage = payloadMessage(payload);
    const statusText = response.statusText || "Request failed";

    throw new Error(
      `${response.status} ${statusText}: ${backendMessage || statusText}`,
    );
  }

  return payload;
}
