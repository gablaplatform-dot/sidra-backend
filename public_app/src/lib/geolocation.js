// One-shot browser geolocation lookup, promise-based. Rejects with a short reason string
// ("unsupported" | "denied" | "unavailable" | "timeout") so callers can show a specific fallback
// message instead of a generic error.
export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("denied"));
        else if (err.code === err.TIMEOUT) reject(new Error("timeout"));
        else reject(new Error("unavailable"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
