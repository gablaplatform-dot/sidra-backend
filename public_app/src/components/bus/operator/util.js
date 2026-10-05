import { useEffect, useRef, useState } from "react";

import { eatDate, eatTime, dayLabel, addDays, todayEat } from "../../../lib/bus";

// Small pure helpers + hooks for the bus-company portal.

// ------------------------------------------------------------------ time
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const timeAgo = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = now - t;
  if (diff < -5 * 60000) return `${dayLabel(eatDate(t))} · ${eatTime(t)}`;
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dayLabel(eatDate(t));
};

// "Good morning" / afternoon / evening in Kampala time.
export const greeting = (now = Date.now()) => {
  const h = new Date(now + 3 * 3600 * 1000).getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// ------------------------------------------------------------------ trips
// What the operator sees on a departures board, from the stored status + the clock.
export const tripStatus = (trip, now = Date.now()) => {
  const dep = new Date(trip.departureAt).getTime();
  const delay = Number(trip.delayMinutes) || 0;
  const eff = dep + delay * 60000;
  if (trip.status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "red" };
  if (trip.status === "completed") return { key: "completed", label: "Completed", tone: "grey" };
  if (trip.status === "departed") return { key: "departed", label: "Departed", tone: "amber" };
  if (now >= eff) return { key: "departed", label: "Departed", tone: "amber", inferred: true };
  if (delay > 0) return { key: "delayed", label: `Delayed +${delay}m`, tone: "amber" };
  if (eff - now < 45 * 60000) return { key: "boarding", label: "Boarding", tone: "green", pulse: true };
  return { key: "scheduled", label: "Scheduled", tone: "blue" };
};

export const occupancy = (trip) => {
  const seats = Number(trip.seats) || 0;
  const taken = Number(trip.seatsTaken) || 0;
  const pct = seats ? Math.min(100, Math.round((taken / seats) * 100)) : 0;
  return { seats, taken, pct, level: pct >= 90 ? "full" : pct >= 60 ? "high" : pct >= 25 ? "mid" : "low" };
};

export const isTomorrow = (departureAt) => eatDate(departureAt) === addDays(todayEat(), 1);

// ------------------------------------------------------------------ people
export const initials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const HUES = [214, 24, 160, 262, 340, 188, 38, 290];
export const hueOf = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
};

// ------------------------------------------------------------------ money
export const ugxShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
};

// A "nice" axis top (1, 2, 2.5, 5 x 10^n) and evenly spaced ticks.
export const niceScale = (max, ticks = 4) => {
  const m = Math.max(max, 1);
  const rough = m / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(m / step) * step;
  const out = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(v);
  return { top, ticks: out };
};

export const pctChange = (now, before) => {
  const a = Number(now) || 0;
  const b = Number(before) || 0;
  if (!b) return a ? null : 0;
  return ((a - b) / b) * 100;
};

// ------------------------------------------------------------------ seat map
// Rows of seat numbers for a coach. Small vehicles are 1+2, everything else 2+2 with a 5-seat back bench
// when the remainder is one seat (the common layout).
export function seatRows(total) {
  const n = Math.max(0, Number(total) || 0);
  const compact = n <= 18;
  const left = compact ? 1 : 2;
  const right = 2;
  const per = left + right;
  const rows = [];
  let seat = 1;
  let remaining = n;
  while (remaining > 0) {
    if (remaining === 1 && rows.length) {
      // merge the odd seat into a back bench of 5 (2+2 layouts) or leave it alone in compact vehicles
      if (!compact) {
        const last = rows.pop();
        rows.push({ bench: [...last.left, ...last.right, seat] });
        seat += 1;
        remaining -= 1;
        break;
      }
    }
    const take = Math.min(per, remaining);
    const l = [];
    const r = [];
    for (let i = 0; i < take; i += 1) (i < left ? l : r).push(seat + i);
    rows.push({ left: l, right: r });
    seat += take;
    remaining -= take;
  }
  return { rows, left, right, compact };
}

// ------------------------------------------------------------------ barcode (decorative, derived from the ticket number)
export const barcodeBars = (value = "", count = 46) => {
  const bars = [];
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  let x = h || 1;
  for (let i = 0; i < count; i += 1) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    bars.push(1 + (x % 3));
  }
  return bars;
};

// ------------------------------------------------------------------ size observer
export function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
