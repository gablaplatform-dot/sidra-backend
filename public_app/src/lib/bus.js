import { request } from "./api";

// Everything the bus screens share: the API calls customers use, plus Uganda-specific formatting
// (UGX, East Africa Time). All departure times are shown in EAT regardless of the viewer's device.

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const eatParts = (value) => {
  const d = new Date(new Date(value).getTime() + EAT_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
};

export const ugx = (value) => `UGX ${Number(value || 0).toLocaleString("en-US")}`;

// "YYYY-MM-DD" for a moment, as seen in Kampala.
export const eatDate = (value = Date.now()) => {
  const p = eatParts(value);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
};
export const todayEat = () => eatDate(Date.now());

export const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const weekdayOf = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const dateParts = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m: m - 1, d, weekday: WEEKDAYS[weekdayOf(dateStr)], month: MONTHS[m - 1], monthLong: MONTHS_LONG[m - 1] };
};

// "Fri 7 Oct"
export const dayLabel = (dateStr) => {
  const p = dateParts(dateStr);
  return `${p.weekday} ${p.d} ${p.month}`;
};

// "Friday, 7 October 2026"
export const longDayLabel = (dateStr) => {
  const p = dateParts(dateStr);
  return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdayOf(dateStr)]}, ${p.d} ${p.monthLong} ${p.y}`;
};

// "07:30 AM"
export const eatTime = (value) => {
  const p = eatParts(value);
  const h12 = p.h % 12 || 12;
  return `${pad(h12)}:${pad(p.min)} ${p.h < 12 ? "AM" : "PM"}`;
};

export const eatDateOf = (value) => eatDate(value);

export const eatDateTimeLabel = (value) => `${dayLabel(eatDate(value))} · ${eatTime(value)}`;

// Arrival estimate from departure + duration (minutes).
export const arrivalTime = (departureAt, durationMinutes) => eatTime(new Date(new Date(departureAt).getTime() + (Number(durationMinutes) || 0) * 60000));

export const durationLabel = (minutes) => {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h}h ${pad(r)}m` : `${h}h`;
};

// Ugandan mobile numbers: accept 07XXXXXXXX, 7XXXXXXXX, +2567XXXXXXXX and normalise to 2567XXXXXXXX.
export const normalizeUgPhone = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.startsWith("256") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return "";
};
export const isUgPhone = (value) => Boolean(normalizeUgPhone(value));

// Which mobile money network a number is on (a hint shown next to the phone field).
export const phoneNetwork = (value) => {
  const n = normalizeUgPhone(value);
  if (!n) return "";
  const prefix = n.slice(3, 5);
  if (["77", "78", "76"].includes(prefix)) return "MTN Mobile Money";
  if (["70", "75", "74"].includes(prefix)) return "Airtel Money";
  return "";
};

export const qrSrc = (ticketNumber) => `${(import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "")}/bus/tickets/${encodeURIComponent(ticketNumber)}/qr.png`;

const qs = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

const json = (body) => JSON.stringify(body);

export const busApi = {
  places: () => request("/bus/places"),
  popularRoutes: (limit = 8) => request(`/bus/popular-routes${qs({ limit })}`),
  types: () => request("/bus/types"),
  parks: (params) => request(`/bus/parks${qs(params)}`),
  park: (slug) => request(`/bus/parks/${encodeURIComponent(slug)}`),
  // { date, from, to, operatorSlug, busTypeId }
  trips: (params) => request(`/bus/trips${qs(params)}`),
  // { from, to, fromPlace, toPlace, operatorSlug, busTypeId }
  calendar: (params) => request(`/bus/calendar${qs(params)}`),
  trip: (id) => request(`/bus/trips/${id}`),
  book: (body) => request("/bus/bookings", { method: "POST", body: json(body) }),
  booking: (id) => request(`/bus/bookings/${id}`),
  myTickets: () => request("/bus/my-tickets"),
  myTicket: (ticketNumber) => request(`/bus/my-tickets/${encodeURIComponent(ticketNumber)}`),
  myMessages: () => request("/bus/my-messages")
};

// The signed-in bus company's own API (operator portal). Same shape: path under /bus/operator.
export const operatorApi = {
  get: (path, params) => request(`/bus/operator${path}${qs(params)}`),
  post: (path, body) => request(`/bus/operator${path}`, { method: "POST", body: json(body ?? {}) }),
  patch: (path, body) => request(`/bus/operator${path}`, { method: "PATCH", body: json(body ?? {}) }),
  del: (path) => request(`/bus/operator${path}`, { method: "DELETE" })
};

export const BUS_STATUS_LABEL = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  failed: "Payment failed",
  expired: "Expired",
  cancelled: "Cancelled",
  refund_due: "Refund pending"
};

// ---------------------------------------------------------------------------------------------
// Presentation helpers for the redesigned customer screens (append-only; nothing above changes).
// ---------------------------------------------------------------------------------------------

// { t: "07:30", ap: "AM" } so screens can set the AM/PM smaller than the clock.
export const timeParts = (value) => {
  const p = eatParts(value);
  return { t: `${pad(p.h % 12 || 12)}:${pad(p.min)}`, ap: p.h < 12 ? "AM" : "PM" };
};

export const arrivalAt = (departureAt, minutes) => new Date(new Date(departureAt).getTime() + (Number(minutes) || 0) * 60000);

// Whole calendar days between two moments as seen in Kampala (0 = same day).
export const dayDiff = (a, b) => {
  const toUtc = (str) => Date.UTC(...str.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((toUtc(eatDate(b)) - toUtc(eatDate(a))) / 86400000);
};

export const shortPrice = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
};

// Airport-style three letter codes for towns (first three letters unless a clash needs an override).
const CITY_CODES = {
  kampala: "KLA", mbarara: "MBR", mbale: "MBL", entebbe: "EBB", jinja: "JIN", gulu: "GUL", arua: "ARU", "fort portal": "FPO",
  kabale: "KBL", kasese: "KSE", masaka: "MSK", lira: "LIR", soroti: "SRT", hoima: "HMA", kisoro: "KSR", kitgum: "KTG",
  rukungiri: "RKG", busia: "BSA", tororo: "TRR", iganga: "IGA", mityana: "MTY", mubende: "MBD", masindi: "MSD", moroto: "MOR"
};
export const cityCode = (name) => {
  const key = String(name || "").trim().toLowerCase();
  if (CITY_CODES[key]) return CITY_CODES[key];
  const letters = key.replace(/[^a-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "---").padEnd(3, "-");
};

// Stable hue per company name so imagery-less cards still look intentional.
export const hueOf = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};

export const TIME_SLOTS = [
  { id: "morning", label: "Morning", range: "05:00 - 11:59" },
  { id: "afternoon", label: "Afternoon", range: "12:00 - 16:59" },
  { id: "evening", label: "Evening", range: "17:00 - 20:59" },
  { id: "night", label: "Night", range: "21:00 - 04:59" }
];
export const timeOfDay = (value) => {
  const h = eatParts(value).h;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
};

// When the bus really leaves (scheduled time plus any delay the company posted).
export const effectiveDeparture = (trip) => new Date(new Date(trip.departureAt).getTime() + (Number(trip.delayMinutes) || 0) * 60000);
export const minutesUntil = (value, now = Date.now()) => Math.round((new Date(value).getTime() - now) / 60000);
export const untilLabel = (mins) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${pad(m % 60)}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

// One short status for a departure: { tone: green|amber|red|muted|navy, label }.
export const tripStatus = (trip, now = Date.now()) => {
  const delay = Number(trip.delayMinutes) || 0;
  const left = minutesUntil(effectiveDeparture(trip), now);
  if (trip.status === "cancelled") return { tone: "red", label: "Cancelled" };
  if (trip.soldOut) return { tone: "red", label: "Sold out" };
  if (!trip.bookable) return { tone: "muted", label: left <= 0 ? "Departed" : "Sales closed" };
  if (delay > 0) return { tone: "amber", label: `Delayed ${delay} min` };
  if (left <= 45 && left > 0) return { tone: "amber", label: `Boarding in ${untilLabel(left)}` };
  if (trip.seatsLeft <= 5) return { tone: "red", label: `Only ${trip.seatsLeft} left` };
  return { tone: "green", label: left < 24 * 60 ? `Departs in ${untilLabel(left)}` : "On time" };
};

// Stops are stored as [{ name, offsetMinutes }]; older rows may use minutesFromStart.
export const stopsOf = (route) => (Array.isArray(route?.stops) ? route.stops.filter((s) => s && s.name) : []);
export const stopOffset = (stop) => {
  const v = Number(stop?.offsetMinutes ?? stop?.minutesFromStart);
  return Number.isFinite(v) ? v : null;
};
export const stopsLabel = (route) => {
  const n = stopsOf(route).length;
  return n ? `${n} ${n === 1 ? "stop" : "stops"}` : "Non-stop";
};

// Unsplash photos come at a fixed width; ask for a bigger crop where we show them large.
export const imgSize = (url, width = 1600) => {
  if (!url || !/images\.unsplash\.com/.test(url)) return url || "";
  const u = url.replace(/([?&])w=\d+/, `$1w=${width}`);
  return /[?&]w=/.test(u) ? u : `${u}${u.includes("?") ? "&" : "?"}w=${width}`;
};

const icsEscape = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// A calendar entry for a ticket: leaves 'departureAt' (+ delay), runs for the route's duration.
export const buildTripIcs = ({ ticket, booking }) => {
  const { trip, operator } = booking;
  const start = effectiveDeparture(trip);
  const end = new Date(start.getTime() + (Number(trip.route.durationMinutes) || 60) * 60000);
  const title = `Bus to ${trip.route.destinationName} - ${operator?.companyName || "Gabla Bus"}`;
  const bp = trip.route.boardingPoint || "";
  const where = [bp, operator?.parkName && !bp.toLowerCase().includes(operator.parkName.toLowerCase()) ? operator.parkName : ""].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gabla Bus//Ticket//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${ticket.ticketNumber}@gabla.bus`, `DTSTAMP:${icsStamp(Date.now())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`, `LOCATION:${icsEscape(where)}`,
    `DESCRIPTION:${icsEscape(`Ticket ${ticket.ticketNumber}, seat ${ticket.seatNumber ?? "-"}. Passenger ${ticket.passengerName}. Board 30 minutes early. Times are East Africa Time.`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"
  ];
  return lines.join("\r\n");
};

export const downloadText = (filename, text, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
