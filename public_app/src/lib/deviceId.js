// A persisted, anonymous per-browser id used only to correlate a visitor's own engagement events
// (profile visits, contact clicks) into "sessions" for analytics - not an identity, just a
// consistent sessionId string the backend already accepts on those endpoints.
const KEY = "gabla_device_id";

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};
