import { request } from "./api";
import { getDeviceId } from "./deviceId";
import { getUnlockedContactId } from "./unlockedContacts";

// Logged-in visitors are recognised by their account (checked via the authenticated /contact
// endpoint); anonymous ones by a device-local unlock id saved after a successful payment (see
// lib/unlockedContacts) - there's no account to check them against otherwise. Rejects when the
// visitor hasn't unlocked this provider.
export const fetchUnlockedContact = (providerId, session) => {
  if (session) return request(`/providers/${encodeURIComponent(providerId)}/contact`);
  const unlockId = getUnlockedContactId(providerId);
  if (!unlockId) return Promise.reject(new Error("not unlocked"));
  return request(`/providers/${encodeURIComponent(providerId)}/contact/unlocked?unlockId=${encodeURIComponent(unlockId)}`);
};

// Fire-and-forget ping that powers the provider's own Analytics tab; never blocks the call/WhatsApp
// navigation the click already triggered.
export const trackContactEvent = (providerId, type, value) => {
  request(`/engagement/providers/${encodeURIComponent(providerId)}/contact-events`, {
    method: "POST",
    body: JSON.stringify({ type, value: value ?? null, sessionId: getDeviceId() })
  }).catch(() => {});
};
