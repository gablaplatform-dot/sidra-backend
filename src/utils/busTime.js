// Uganda is on East Africa Time (UTC+3) all year with no daylight saving, so departure times are
// kept as "HH:mm" in EAT and converted to real UTC instants only when a trip is created.
const EAT_OFFSET_HOURS = 3;

const pad = (n) => String(n).padStart(2, "0");

export const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
export const isTimeString = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ""));

// "2026-10-12" + "07:30" (EAT) -> the UTC Date for that moment.
export const eatToUtc = (dateString, timeString) => {
  const [y, m, d] = dateString.split("-").map(Number);
  const [hh, mm] = timeString.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - EAT_OFFSET_HOURS, mm));
};

// The EAT calendar date ("YYYY-MM-DD") a UTC instant falls on.
export const eatDateString = (date) => {
  const shifted = new Date(new Date(date).getTime() + EAT_OFFSET_HOURS * 3600 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

export const eatTimeString = (date) => {
  const shifted = new Date(new Date(date).getTime() + EAT_OFFSET_HOURS * 3600 * 1000);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
};

export const todayEat = () => eatDateString(new Date());

export const addDaysToDateString = (dateString, days) => {
  const [y, m, d] = dateString.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
};

// 0 = Sunday ... 6 = Saturday, for an EAT calendar date.
export const weekdayOf = (dateString) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const enumerateDates = (fromDate, toDate, maxDays = 120) => {
  const out = [];
  for (let day = fromDate; day <= toDate && out.length < maxDays; day = addDaysToDateString(day, 1)) out.push(day);
  return out;
};

// Start and end instants (UTC) of an EAT calendar day.
export const eatDayBounds = (dateString) => ({
  start: eatToUtc(dateString, "00:00"),
  end: new Date(eatToUtc(dateString, "00:00").getTime() + 24 * 3600 * 1000)
});

const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", weekday: "short", day: "numeric", month: "long", year: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit", hour12: false });
export const formatEatDate = (date) => longDate.format(new Date(date));
export const formatEatTime = (date) => shortTime.format(new Date(date));
