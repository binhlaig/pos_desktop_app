export type DeviceLocation = { latitude: number; longitude: number; accuracy: number };

/** One login-time request; denial, timeout and unsupported browsers never prevent login. */
export function getDeviceLocation(): Promise<DeviceLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (location: DeviceLocation | null) => {
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(location);
    };
    // Also bounds time spent waiting for a browser permission prompt.
    const timer = setTimeout(() => finish(null), 9500);
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        const { latitude, longitude, accuracy } = coords;
        finish(Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
          Number.isFinite(longitude) && Math.abs(longitude) <= 180 && Number.isFinite(accuracy) && accuracy >= 0
          ? { latitude, longitude, accuracy } : null);
      }, () => finish(null), { enableHighAccuracy: true, timeout: 9000, maximumAge: 300000 });
    } catch { finish(null); }
  });
}

export function locationPayload(location: DeviceLocation | null) {
  return { latitude: location?.latitude ?? null, longitude: location?.longitude ?? null,
    locationAccuracy: location?.accuracy ?? null };
}
