import { clearSession, getSession } from "./session";

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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 401 means the token is gone/expired — drop it locally too, so the header stops looking
    // signed-in and the next request doesn't keep retrying with a token the API already rejected.
    if (response.status === 401 && session?.accessToken) {
      clearSession();
      window.dispatchEvent(new Event("gabla-session-expired"));
    }
    const error = new Error(body?.error?.message || "Request failed");
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
};
