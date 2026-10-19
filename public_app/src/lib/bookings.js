import i18n, { intlLocale } from "../i18n";
import { request } from "./api";

// Dates are plain "YYYY-MM-DD" strings in East Africa Time (UTC+3, no daylight saving), the same
// calendar the API books in, so a guest in any timezone sees the same days as the provider.
const EAT_MS = 3 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

export const todayEat = () => iso(Date.now() + EAT_MS);
export const addDays = (date, n) => {
  const [y, m, d] = date.split("-").map(Number);
  return iso(Date.UTC(y, m - 1, d + n));
};
export const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const monthStart = (date) => `${date.slice(0, 7)}-01`;
export const addMonths = (date, n) => {
  const [y, m] = date.split("-").map(Number);
  return iso(Date.UTC(y, m - 1 + n, 1));
};

export const dateLabel = (date, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(intlLocale(), { timeZone: "UTC", ...opts });
export const monthLabel = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(intlLocale(), { timeZone: "UTC", month: "long", year: "numeric" });

// UNIT_WORD values are translation keys (booking.units.<word>), not display text: pass them to plural()/unitLabel().
export const UNIT_WORD = { night: "night", day: "day", hour: "hour" };
// "3 nights", "1 guest": `word` is one of night | day | hour | guest.
export const plural = (n, word) => i18n.t(`booking.units.${word}`, { count: n, defaultValue: `${n} ${word}` });
// The singular word on its own ("night"), for "UGX 50,000 / night".
export const unitLabel = (word) => i18n.t(`booking.unitSingular.${word}`, { defaultValue: word });
// "2 rooms" for overnight stays, "2 spaces" for anything else.
export const quantityLabel = (unit, n) => i18n.t(unit === "night" ? "booking.roomsCount" : "booking.spacesCount", { count: n });

// `label` is looked up when read, so it follows the active language.
const statusEntry = (key, tone) => ({ tone, get label() { return i18n.t(`booking.status.${key}`); } });
export const BOOKING_STATUS = {
  pending: statusEntry("pending", "wait"),
  confirmed: statusEntry("confirmed", "ok"),
  declined: statusEntry("declined", "bad"),
  cancelled: statusEntry("cancelled", "bad"),
  completed: statusEntry("completed", "done"),
  expired: statusEntry("expired", "bad")
};

export const whenLabel = (b) => {
  if (b.unit === "hour") return `${dateLabel(b.startDate)} · ${b.startTime}–${b.endTime}`;
  return b.startDate === b.endDate ? dateLabel(b.startDate) : `${dateLabel(b.startDate)} → ${dateLabel(b.endDate)}`;
};

export const loadAvailability = (listingId, from, to, date) => {
  const params = new URLSearchParams({ listingId, from, to });
  if (date) params.set("date", date);
  return request(`/bookings/availability?${params.toString()}`);
};

export const createBooking = (payload) => request("/bookings", { method: "POST", body: JSON.stringify(payload) });
export const myBookings = () => request("/bookings/mine");
export const cancelBooking = (id) => request(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
export const providerBookings = () => request("/bookings/provider");
export const respondToBooking = (id, action, note) =>
  request(`/bookings/provider/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action, note: note || undefined }) });
