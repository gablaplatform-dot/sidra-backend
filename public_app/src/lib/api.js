import i18n from "../i18n";
import { clearSession, getSession, setSession } from "./session";

export const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

export const request = async (path, options = {}) => {
  const session = getSession();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(options.headers || {})
    }
  });
  // The API hands a fresh token back as the session ages, so a signed-in user is never signed out for being idle.
  const renewed = response.headers.get("X-Renewed-Token");
  if (renewed && session?.accessToken) setSession({ ...(getSession() || session), accessToken: renewed });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 401 means the token is gone/expired — drop it locally too, so the header stops looking
    // signed-in and the next request doesn't keep retrying with a token the API already rejected.
    if (response.status === 401 && session?.accessToken) {
      clearSession();
      window.dispatchEvent(new Event("gabla-session-expired"));
    }
    const error = new Error(body?.error?.message || i18n.t("errors.requestFailed"));
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
};
