import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import { Skel } from "../Skeleton";
import { addDays, dateParts, shortPrice, todayEat, ugx } from "../../lib/bus";
import { Calendar, ChevronLeft, ChevronRight } from "./icons";

// eGoTickets-style weekday tabs. The selected tab is white and fuses into the white results panel
// directly below it; the others sit on the sand band. `days` is the /bus/calendar map.
export default function DateTabs({ days, loading, value, onChange, onCalendar, count = 30 }) {
  const { t } = useTranslation();
  const start = todayEat();
  const dates = useMemo(() => Array.from({ length: count }, (_, i) => addDays(start, i)), [start, count]);
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector(".bus-tab-day.is-active");
    if (!el || !active) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2), behavior: reduce ? "auto" : "smooth" });
  }, [value, loading]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, loading]);

  const nudge = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className="bus-tabs-row">
      <button type="button" className="bus-tabs-arrow" onClick={() => nudge(-1)} disabled={edges.start} aria-label={t("bus.dateTabs.earlier")}><ChevronLeft size={18} /></button>
      {loading ? (
        <div className="bus-tabs-scroll" role="status" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t("bus.dateTabs.loading")}</span>
          {Array.from({ length: 9 }).map((_, i) => <span key={i} className="bus-tab-day is-skel"><Skel w={34} h={11} /><Skel w={30} h={26} /><Skel w={54} h={10} /></span>)}
        </div>
      ) : (
        <div className={`bus-tabs-scroll ${edges.end ? "" : "has-more"}`} ref={scroller} onScroll={measure} role="tablist" aria-label={t("bus.dateTabs.chooseDay")}>
          {dates.map((d) => {
            const info = days?.[d];
            const p = dateParts(d);
            const empty = !info?.trips;
            const active = d === value;
            const newMonth = d === start || p.d === 1;
            return (
              <button
                type="button"
                key={d}
                role="tab"
                aria-selected={active}
                disabled={empty && !active}
                className={`bus-tab-day ${active ? "is-active" : ""} ${empty ? "is-empty" : ""}`}
                onClick={() => onChange(d)}
                aria-label={`${p.weekday} ${p.d} ${p.month}, ${empty ? t("bus.dateTabs.noTrips") : `${t("bus.tripsCount", { count: info.trips })}${info.minPrice ? ` ${t("bus.fromPrice", { price: ugx(info.minPrice) })}` : ""}`}`}
              >
                <small>{d === start ? t("bus.dateTabs.today") : p.weekday}{newMonth ? <i> · {p.month}</i> : null}</small>
                <strong>{p.d}</strong>
                <span>{empty ? t("bus.dateTabs.noTrips") : t("bus.tripsCount", { count: info.trips })}</span>
                {!empty && info.minPrice ? <b>{shortPrice(info.minPrice)}</b> : null}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="bus-tabs-arrow" onClick={() => nudge(1)} disabled={edges.end} aria-label={t("bus.dateTabs.later")}><ChevronRight size={18} /></button>
      {onCalendar ? (
        <button type="button" className="bus-tabs-cal" onClick={onCalendar} disabled={loading}><Calendar size={17} /><span>{t("bus.dateTabs.calendar")}</span></button>
      ) : null}
    </div>
  );
}
