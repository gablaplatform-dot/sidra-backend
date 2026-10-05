import React, { useEffect, useMemo, useRef, useState } from "react";

import { IconChevronLeft, IconClose } from "../icons";
import { addDays, dateParts, todayEat, weekdayOf } from "../../lib/bus";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n) => String(n).padStart(2, "0");
const shortPrice = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Month grid inside a sheet. Only the booking window (today -> `horizon` days) is selectable.
export default function MonthCalendar({ open, onClose, days, value, onPick, horizon = 62 }) {
  const today = todayEat();
  const last = addDays(today, horizon - 1);
  const anchor = value || today;
  const [view, setView] = useState(() => ({ y: dateParts(anchor).y, m: dateParts(anchor).m }));
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const p = dateParts(value || today);
    setView({ y: p.y, m: p.m });
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const first = dateParts(today);
  const lastP = dateParts(last);
  const minIdx = first.y * 12 + first.m;
  const maxIdx = lastP.y * 12 + lastP.m;
  const idx = view.y * 12 + view.m;

  const cells = useMemo(() => {
    const lead = weekdayOf(`${view.y}-${pad(view.m + 1)}-01`);
    const out = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth(view.y, view.m); d += 1) out.push(`${view.y}-${pad(view.m + 1)}-${pad(d)}`);
    return out;
  }, [view]);

  if (!open) return null;

  const shift = (delta) => {
    const next = idx + delta;
    setView({ y: Math.floor(next / 12), m: next % 12 });
  };
  const monthName = dateParts(`${view.y}-${pad(view.m + 1)}-01`).monthLong;

  return (
    <div className="bus-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bus-sheet" role="dialog" aria-modal="true" aria-label="Pick a travel date">
        <div className="bus-sheet-head">
          <h2>Pick a date</h2>
          <button type="button" className="bus-icon-btn" onClick={onClose} ref={closeRef} aria-label="Close calendar"><IconClose width={20} height={20} /></button>
        </div>
        <div className="bus-cal">
          <div className="bus-cal-head">
            <button type="button" className="bus-icon-btn" onClick={() => shift(-1)} disabled={idx <= minIdx} aria-label="Previous month"><IconChevronLeft width={20} height={20} /></button>
            <strong>{monthName} {view.y}</strong>
            <button type="button" className="bus-icon-btn bus-flip" onClick={() => shift(1)} disabled={idx >= maxIdx} aria-label="Next month"><IconChevronLeft width={20} height={20} /></button>
          </div>
          <div className="bus-cal-grid">
            {DOW.map((d, i) => <div key={i} className="bus-cal-dow" aria-hidden="true">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} />;
              const info = days?.[d];
              const inWindow = d >= today && d <= last;
              const has = inWindow && info?.trips > 0;
              const cls = `bus-cal-cell ${has ? "has-trips" : "is-off"} ${d === value ? "is-active" : ""} ${d === today ? "is-today" : ""}`;
              return (
                <button
                  type="button"
                  key={d}
                  className={cls}
                  disabled={!has}
                  onClick={() => { onPick(d); onClose(); }}
                  aria-label={`${d}${has ? `, ${info.trips} trips` : ", no trips"}`}
                  aria-pressed={d === value}
                >
                  {Number(d.slice(8))}
                  {has && info.minPrice ? <small>{shortPrice(info.minPrice)}</small> : null}
                </button>
              );
            })}
          </div>
          <p className="bus-hint bus-cal-legend">The small number is the cheapest fare that day, in thousands of UGX. Greyed days have no trips.</p>
        </div>
      </div>
    </div>
  );
}
