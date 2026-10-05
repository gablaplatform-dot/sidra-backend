import { request } from "./api";
import { getDeviceId } from "./deviceId";

// What the shopper looks at feeds "This can work for you". Always fire-and-forget: tracking must
// never slow down or break the page, and a failure is simply a missed signal.
export const trackInterest = (event) => {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  request("/interest/events", { method: "POST", body: JSON.stringify({ deviceId, ...event }) }).catch(() => {});
};

// At sign-in, what this device browsed anonymously becomes the account's history.
export const claimInterest = () => {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  request("/interest/claim", { method: "POST", body: JSON.stringify({ deviceId }) }).catch(() => {});
};

export const clearInterest = () => {
  const deviceId = getDeviceId();
  return request(`/interest${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""}`, { method: "DELETE" });
};
