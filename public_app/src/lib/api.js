import i18n from "../i18n";
import { clearSession, getSession, setSession } from "./session";

export const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

// ---- Response cache -------------------------------------------------------------------------------------------
// Each call to the API costs a round trip to the server (about 0.4 s from Uganda), so what rarely changes is kept:
//  - category trees: shown instantly from this device's copy (up to a day old) and refreshed in the background;
//  - home / shop shelves: reused for a minute while moving between pages.
// Identical requests that are already in flight are shared instead of sent twice.
const STORE_PREFIX = "gabla_api_cache:v1:";
const TREES = /^\/(product-categories|service-categories|categories|shop-categories)(\?|$|\/(?!mine))/;
const SHELVES = /^\/(listings\/(new-arrivals|best-sellers)|promotions\/featured|bus\/popular-routes|providers\?sort=top-rated)/;
const TREE_FRESH_MS = 5 * 60 * 1000;
const TREE_STALE_MS = 24 * 60 * 60 * 1000;
const SHELF_FRESH_MS = 60 * 1000;
const memory = new Map(); // key -> { at, data }
const inflight = new Map(); // key -> Promise

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeStored = (key, entry) => {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable: the in-memory copy still works */
  }
};
export const clearApiCache = () => {
  memory.clear();
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(STORE_PREFIX)) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const send = async (path, options, session) => {
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

export const request = (path, options = {}) => {
  const session = getSession();
  const method = String(options.method || "GET").toUpperCase();

  if (method !== "GET") {
    // A change to categories (a seller adding one, an admin editing the tree) must show up on the very next load.
    if (/categor/i.test(path)) clearApiCache();
    return send(path, options, session);
  }

  const tree = TREES.test(path);
  const shelf = !tree && SHELVES.test(path);
  if (!tree && !shelf) return send(path, options, session);

  // Shelves can differ per signed-in person (audiences), trees cannot.
  const key = `${shelf ? `${session?.user?.id || "anon"}|` : ""}${path}`;
  const now = Date.now();
  const hit = memory.get(key) || (tree ? readStored(key) : null);
  if (hit && !memory.has(key)) memory.set(key, hit);

  const refresh = () => {
    if (inflight.has(key)) return inflight.get(key);
    const call = send(path, options, session)
      .then((data) => {
        const entry = { at: Date.now(), data };
        memory.set(key, entry);
        if (tree) writeStored(key, entry);
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, call);
    return call;
  };

  if (hit) {
    const age = now - hit.at;
    if (age < (tree ? TREE_FRESH_MS : SHELF_FRESH_MS)) return Promise.resolve(hit.data);
    if (tree && age < TREE_STALE_MS) {
      refresh().catch(() => {}); // update this device's copy for next time
      return Promise.resolve(hit.data);
    }
  }
  return refresh();
};
