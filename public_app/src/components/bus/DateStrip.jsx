import React, { useEffect, useMemo, useRef } from "react";

import { Skel } from "../Skeleton";
import { addDays, dateParts, todayEat } from "../../lib/bus";

const shortPrice = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
};

// Horizontally scrollable run of days. `days` is the /bus/calendar map; a day without trips is
// muted and not selectable (there is nothing to book).
export default function DateStrip({ days, loading, value, onChange, count = 30 }) {
  const start = todayEat();
  const dates = useMemo(() => Array.from({ length: count }, (_, i) => addDays(start, i)), [start, count]);
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector(".bus-day.is-active");
    if (!el || !active) return;
    el.scrollTo({ left: Math.max(0, active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2), behavior: "smooth" });
  }, [value, loading]);

  if (loading) {
    return (
      <div className="bus-datestrip" role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading dates…</span>
        {Array.from({ length: 9 }).map((_, i) => <Skel key={i} w={74} h={98} r={16} style={{ flex: "0 0 auto" }} />)}
      </div>
    );
  }

  return (
    <div className="bus-datestrip" ref={scroller} role="listbox" aria-label="Choose a travel day">
      {dates.map((d) => {
        const info = days?.[d];
        const p = dateParts(d);
        const empty = !info?.trips;
        const active = d === value;
        return (
          <button
            type="button"
            key={d}
            role="option"
            aria-selected={active}
            disabled={empty && !active}
            className={`bus-day ${active ? "is-active" : ""} ${empty ? "is-empty" : ""}`}
            onClick={() => onChange(d)}
            aria-label={`${p.weekday} ${p.d} ${p.month}, ${empty ? "no trips" : `${info.trips} trips from UGX ${Number(info.minPrice || 0).toLocaleString("en-US")}`}`}
          >
            <small>{d === start ? "Today" : p.weekday}</small>
            <strong>{p.d}</strong>
            <em>{p.month}</em>
            <span>{empty ? "No trips" : `${info.trips} ${info.trips === 1 ? "trip" : "trips"}`}</span>
            {!empty && info.minPrice ? <b>{shortPrice(info.minPrice)}</b> : null}
          </button>
        );
      })}
    </div>
  );
}
