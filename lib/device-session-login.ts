import { getDeviceLocation, locationPayload } from "./device-location";

/** Use from password-based STAFF login screens. Existing owner staff-selection is unchanged. */
export async function loginStaff(input: { shopCode: string; staffId: number; password: string },
  device: { deviceId: string; deviceName: string } = currentDevice()): Promise<Record<string, unknown>> {
  const location = await getDeviceLocation();
  const response = await fetch("/api/auth/staff-login", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json",
      "X-Device-ID": device.deviceId, "X-Device-Name": device.deviceName },
    body: JSON.stringify({ ...input, ...locationPayload(location) }),
  });
  if (!response.ok) throw new Error(response.status === 409 ? "Device limit reached" : "Staff login failed");
  return response.json();
}

/** Silent refresh never requests geolocation or exposes the HttpOnly refresh credential. */
export async function refreshDeviceSession(): Promise<Record<string, unknown>> {
  const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("Session expired. Please sign in again.");
  return response.json();
}

function currentDevice(): { deviceId: string; deviceName: string } {
  const key = "pos_device_id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    deviceId = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(key, deviceId);
  }
  const ua = navigator.userAgent;
  const deviceName = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "iPad POS" :
    /iPhone/i.test(ua) ? "iPhone POS" : /Android/i.test(ua) ? "Android POS" :
    /Windows/i.test(ua) ? "Windows POS" : /Macintosh/i.test(ua) ? "Mac POS" : "POS Web Browser";
  return { deviceId, deviceName };
}
