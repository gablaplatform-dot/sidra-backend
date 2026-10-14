import React from "react";

import { addDays, addMonths, monthLabel, monthStart, todayEat } from "../../lib/bookings";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A month grid of bookable days. The parent decides what each day may do; this only draws it.
// `info(date)` returns { free, disabled, partly } for a date, `value` is the picked { start, end }.
export default function AvailabilityCalendar({ month, onMonth, info, start, end, onPick, minMonth, maxDate }) {
  const first = monthStart(month);
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const next = addMonths(first, 1);
  const length = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000);
  const today = todayEat();
  const cells = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => addDays(first, i))];
  const canPrev = first > monthStart(minMonth || today);
  const canNext = !maxDate || next <= maxDate;

  return (
    <div className="cal" role="group" aria-label={monthLabel(first)}>
      <div className="cal-head">
        <button type="button" onClick={() => onMonth(addMonths(first, -1))} disabled={!canPrev} aria-label="Previous month">‹</button>
        <strong>{monthLabel(first)}</strong>
        <button type="button" onClick={() => onMonth(next)} disabled={!canNext} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid cal-week" aria-hidden="true">
        {WEEK.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const state = info(date);
          const picked = date === start || date === end;
          const inRange = start && end && date > start && date < end;
          return (
            <button
              key={date}
              type="button"
              disabled={state.disabled}
              onClick={() => onPick(date)}
              className={`cal-day ${state.disabled ? "is-off" : ""} ${picked ? "is-picked" : ""} ${inRange ? "is-range" : ""} ${date === today ? "is-today" : ""} ${state.partly ? "is-partly" : ""}`}
              aria-label={`${date}${state.disabled ? ", not available" : ""}`}
              aria-pressed={picked}
            >
              <span>{Number(date.slice(8))}</span>
              {!state.disabled && state.free > 1 && state.showFree ? <small>{state.free} left</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
