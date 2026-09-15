// Persists proof of an anonymous contact unlock on this device/browser, keyed by provider, so a
// reload doesn't ask an anonymous payer to unlock (and pay) again. There's no account to key this
// to, so it's inherently device-local, not cross-device — that's an accepted trade-off of not
// requiring sign-in.
const KEY = "gabla_unlocked_contacts";

const readMap = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const getUnlockedContactId = (providerId) => readMap()[providerId] || null;

export const saveUnlockedContactId = (providerId, unlockId) => {
  try {
    const map = readMap();
    map[providerId] = unlockId;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private browsing, quota) — the unlock still worked this session,
    // it just won't survive a reload. Not worth surfacing an error for.
  }
};
