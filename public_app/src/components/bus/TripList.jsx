import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  addDays, arrivalAt, busApi, dayDiff, dayLabel, durationLabel, eatDate, eatTime, effectiveDeparture, longDayLabel, minutesUntil,
  stopsLabel, stopsOf, timeOfDay, timeParts, todayEat, tripStatus, ugx, TIME_SLOTS
} from "../../lib/bus";
import DateTabs from "./DateTabs";
import MonthCalendar from "./MonthCalendar";
import useLoad from "./useLoad";
import { Skel } from "../Skeleton";
import { AmenityChips, BusLogo, EmptyState, ErrorBox, Rating, StatusPill, TripSkeletons } from "./parts";
import { ArrowRight, Calendar, Close, Moon, Pin, Sliders, Sun, Sunrise, Sunset } from "./icons";

const WINDOW_DAYS = 62;
const SLOT_ICON = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon };

// "07:30 AM" as a big clock with a small AM/PM.
export function Clock({ value, plus = 0 }) {
  const { t, ap } = timeParts(value);
  return (
    <strong className="bus-time">
      <b>{t}</b><i>{ap}</i>
      {plus > 0 ? <sup className="bus-plusday" title={`Arrives ${plus} day${plus > 1 ? "s" : ""} later`}>+{plus}</sup> : null}
    </strong>
  );
}

export function TripCard({ trip, index = 0 }) {
  const { route, operator, busType } = trip;
  const delay = Number(trip.delayMinutes) || 0;
  const soldOut = trip.soldOut;
  const cancelled = trip.status === "cancelled";
  const closed = !soldOut && !trip.bookable;
  const status = tripStatus(trip);
  const arrive = arrivalAt(trip.departureAt, route.durationMinutes);
  const plus = dayDiff(trip.departureAt, arrive);
  const stops = stopsOf(route);
  const leaving = delay ? eatTime(effectiveDeparture(trip)) : null;
  const depDate = eatDate(trip.departureAt);
  const arrDate = eatDate(arrive);
  const left = minutesUntil(effectiveDeparture(trip));
  const disabled = soldOut || closed;

  return (
    <article
      className={`bus-trip ${soldOut ? "is-soldout" : ""} ${closed ? "is-closed" : ""} ${delay ? "is-delayed" : ""}`}
      style={{ "--i": Math.min(index, 8) }}
      aria-label={`${operator.companyName} to ${route.destinationName} at ${eatTime(trip.departureAt)}`}
    >
      <div className="bus-trip-body">
        <div className="bus-trip-co">
          <BusLogo name={operator.companyName} src={operator.logoUrl} size={48} />
          <span className="bus-trip-co-text">
            <Link to={`/bus/parks/${operator.slug}`} className="bus-trip-name">{operator.companyName}</Link>
            <Rating avg={operator.ratingAvg} count={operator.ratingCount} />
          </span>
          {busType ? <span className="bus-trip-type">{busType.name}</span> : null}
        </div>

        <div className="bus-trip-leg">
          <small className="bus-lbl">Departs</small>
          <Clock value={trip.departureAt} />
          <span className="bus-trip-place">{route.originName}</span>
          <span className="bus-trip-date">{dayLabel(depDate)}</span>
        </div>

        <div className="bus-trip-track-wrap" title={stops.length ? `Stops: ${stops.map((s) => s.name).join(", ")}` : "Direct, no stops"}>
          <span className="bus-trip-dur">{durationLabel(route.durationMinutes)}</span>
          <span className="bus-trip-track" aria-hidden="true">
            <i className="end" />
            {stops.slice(0, 5).map((s, i) => <i key={`${s.name}-${i}`} className="mid" />)}
            <i className="end" />
          </span>
          <span className="bus-trip-stops">{stopsLabel(route)}</span>
        </div>

        <div className="bus-trip-leg is-arr">
          <small className="bus-lbl">Arrives</small>
          <Clock value={arrive} plus={plus} />
          <span className="bus-trip-place">{route.destinationName}</span>
          <span className="bus-trip-date">{dayLabel(arrDate)}</span>
        </div>

        <div className="bus-trip-buy">
          <div className="bus-trip-price">
            {trip.priceFrom ? <><small>from</small><b>{ugx(trip.priceFrom)}</b></> : <b>-</b>}
          </div>
          <StatusPill tone={status.tone}>{soldOut ? "No seats left" : status.tone === "green" && trip.seatsLeft > 5 ? `${trip.seatsLeft} seats left` : status.label}</StatusPill>
          {disabled ? (
            <span className="bus-btn bus-btn-light bus-trip-cta" aria-disabled="true">{cancelled ? "Cancelled" : soldOut ? "Sold out" : "Sales closed"}</span>
          ) : (
            <Link to={`/bus/trip/${trip.id}`} className="bus-btn bus-btn-primary bus-trip-cta bus-stretch">Select <ArrowRight size={16} /></Link>
          )}
        </div>
      </div>

      <div className="bus-trip-foot">
        {route.boardingPoint || operator.parkName ? <span className="bus-meta"><Pin size={14} />Board at {route.boardingPoint || operator.parkName}</span> : null}
        {delay > 0 ? <span className="bus-meta is-warn">Delayed {delay} min · leaving about {leaving}</span> : null}
        {!delay && !disabled && left > 0 && left <= 180 ? <span className="bus-meta is-warn">Leaves in {durationLabel(left)}</span> : null}
        <AmenityChips list={busType?.amenities} max={3} tone="is-quiet" />
      </div>
    </article>
  );
}

const SORTS = [
  { id: "earliest", label: "Earliest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "fastest", label: "Fastest" },
  { id: "seats", label: "Most seats" }
];

const sorters = {
  earliest: (a, b) => new Date(a.departureAt) - new Date(b.departureAt),
  cheapest: (a, b) => Number(a.priceFrom ?? Infinity) - Number(b.priceFrom ?? Infinity) || new Date(a.departureAt) - new Date(b.departureAt),
  fastest: (a, b) => (a.route.durationMinutes || 0) - (b.route.durationMinutes || 0) || new Date(a.departureAt) - new Date(b.departureAt),
  seats: (a, b) => b.seatsLeft - a.seatsLeft || new Date(a.departureAt) - new Date(b.departureAt)
};

const toggle = (set, v) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

function FilterGroup({ title, children }) {
  return (
    <fieldset className="bus-fgroup">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function Filters({ facets, sel, setSel, showCompanies, activeCount, onClear }) {
  return (
    <div className="bus-filters-panel">
      <div className="bus-filters-head">
        <h3>Filters</h3>
        {activeCount ? <button type="button" className="bus-linkbtn" onClick={onClear}>Reset ({activeCount})</button> : null}
      </div>

      <FilterGroup title="Departure time">
        <div className="bus-slots">
          {TIME_SLOTS.map((s) => {
            const Icon = SLOT_ICON[s.id];
            const n = facets.slots[s.id] || 0;
            const on = sel.slots.has(s.id);
            return (
              <button type="button" key={s.id} className={`bus-slot ${on ? "is-on" : ""}`} aria-pressed={on} disabled={!n && !on} onClick={() => setSel((c) => ({ ...c, slots: toggle(c.slots, s.id) }))}>
                <Icon size={18} />
                <b>{s.label}</b>
                <small>{s.range.split(" - ")[0]}</small>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {facets.types.length > 1 || sel.types.size ? (
        <FilterGroup title="Bus type">
          {facets.types.map((t) => (
            <label className="bus-check" key={t.id}>
              <input type="checkbox" checked={sel.types.has(t.id)} onChange={() => setSel((c) => ({ ...c, types: toggle(c.types, t.id) }))} />
              <span className="bus-check-box" aria-hidden="true" />
              <span className="bus-check-label">{t.name}</span>
              <em>{t.count}</em>
            </label>
          ))}
        </FilterGroup>
      ) : null}

      {showCompanies && (facets.ops.length > 1 || sel.ops.size) ? (
        <FilterGroup title="Bus company">
          {facets.ops.map((o) => (
            <label className="bus-check" key={o.slug}>
              <input type="checkbox" checked={sel.ops.has(o.slug)} onChange={() => setSel((c) => ({ ...c, ops: toggle(c.ops, o.slug) }))} />
              <span className="bus-check-box" aria-hidden="true" />
              <BusLogo name={o.name} src={o.logoUrl} size={24} />
              <span className="bus-check-label">{o.name}</span>
              <em>{o.count}</em>
            </label>
          ))}
        </FilterGroup>
      ) : null}
    </div>
  );
}

const emptySel = () => ({ types: new Set(), ops: new Set(), slots: new Set() });

// Date tabs + sorted/filtered trip list for a set of filters. Shared by the search page and a single
// company's page. `date` may be empty: then the first day that has trips is shown.
//   header(selected)  renders inside the sand band above the tabs (the search pill)
export default function TripExplorer({ filters, date, onDate, header, emptyAction, showCompanyFilter = true, kicker }) {
  const [sort, setSort] = useState("earliest");
  const [calOpen, setCalOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState(emptySel);
  const today = todayEat();
  const key = JSON.stringify(filters);

  const cal = useLoad(
    () => busApi.calendar({ from: today, to: addDays(today, WINDOW_DAYS - 1), fromPlace: filters.from, toPlace: filters.to, operatorSlug: filters.operatorSlug, busTypeId: filters.busTypeId }),
    [key, today]
  );
  const days = cal.data?.days || {};
  const dayKeys = Object.keys(days).sort();
  const firstDay = dayKeys[0] || "";
  const nextAfter = (d) => dayKeys.find((k) => k > d) || "";
  const selected = date || firstDay || today;
  // Without an explicit date wait for the calendar so we don't fetch a day that has no trips.
  const waitingForCalendar = !date && cal.loading;

  const trips = useLoad(
    () => busApi.trips({ date: selected, from: filters.from, to: filters.to, operatorSlug: filters.operatorSlug, busTypeId: filters.busTypeId }),
    [key, selected],
    { enabled: !waitingForCalendar }
  );

  useEffect(() => setSel(emptySel()), [key]);

  const raw = trips.data?.items || [];

  const facets = useMemo(() => {
    const types = new Map();
    const ops = new Map();
    const slots = {};
    for (const t of raw) {
      if (t.busType) types.set(t.busType.id, { id: t.busType.id, name: t.busType.name, count: (types.get(t.busType.id)?.count || 0) + 1 });
      ops.set(t.operator.slug, { slug: t.operator.slug, name: t.operator.companyName, logoUrl: t.operator.logoUrl, count: (ops.get(t.operator.slug)?.count || 0) + 1 });
      const s = timeOfDay(t.departureAt);
      slots[s] = (slots[s] || 0) + 1;
    }
    return { types: [...types.values()].sort((a, b) => a.name.localeCompare(b.name)), ops: [...ops.values()].sort((a, b) => a.name.localeCompare(b.name)), slots };
  }, [raw]);

  const activeCount = sel.types.size + sel.ops.size + sel.slots.size;

  const items = useMemo(() => {
    const list = raw.filter((t) => (!sel.types.size || (t.busType && sel.types.has(t.busType.id))) && (!sel.ops.size || sel.ops.has(t.operator.slug)) && (!sel.slots.size || sel.slots.has(timeOfDay(t.departureAt))));
    return list.sort(sorters[sort]);
  }, [raw, sel, sort]);

  const loading = waitingForCalendar || trips.loading;
  const nothingAtAll = !cal.loading && !cal.error && dayKeys.length === 0;
  const upNext = nextAfter(selected);
  const minPrice = items.reduce((m, t) => (t.priceFrom ? Math.min(m, Number(t.priceFrom)) : m), Infinity);
  const clear = () => setSel(emptySel());

  const kick = kicker ?? (filters.from || filters.to ? `${filters.from || "Anywhere"} to ${filters.to || "Anywhere"}` : "All routes");

  return (
    <>
      <section className="bus-band bus-band-tabs" aria-label="Choose a day">
        <div className="bus-wrap">
          {header ? header(selected) : null}
          {cal.error ? (
            <ErrorBox error={cal.error} onRetry={cal.reload} title="Couldn't load available days" />
          ) : (
            <DateTabs days={days} loading={cal.loading} value={selected} onChange={onDate} onCalendar={() => setCalOpen(true)} />
          )}
        </div>
      </section>
      <MonthCalendar open={calOpen} onClose={() => setCalOpen(false)} days={days} value={selected} onPick={onDate} horizon={WINDOW_DAYS} />

      <section className="bus-panel" aria-label="Trips">
        <div className="bus-wrap">
          <div className="bus-results-head">
            <div className="bus-results-title">
              <span className="bus-kicker">{kick}</span>
              {loading ? (
                <Skel w={150} h={30} style={{ marginTop: 6 }} />
              ) : (
                <h2 aria-live="polite">
                  {trips.error ? "Trips" : `${items.length}${activeCount && raw.length !== items.length ? ` of ${raw.length}` : ""} ${raw.length === 1 && !activeCount ? "trip" : "trips"}`}
                  {!trips.error && Number.isFinite(minPrice) ? <small>from {ugx(minPrice)}</small> : null}
                </h2>
              )}
              <p className="bus-results-sub">{longDayLabel(selected)} · times in East Africa Time</p>
            </div>
            <div className="bus-sortbar">
              <span className="bus-sortlabel">Sort by</span>
              <div className="bus-sort" role="group" aria-label="Sort trips">
                {SORTS.map((s) => (
                  <button type="button" key={s.id} className={`bus-pillbtn ${sort === s.id ? "is-active" : ""}`} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
                ))}
              </div>
              <button type="button" className="bus-filterbtn" onClick={() => setSheet(true)}>
                <Sliders size={17} /> Filters{activeCount ? <b>{activeCount}</b> : null}
              </button>
            </div>
          </div>

          <div className="bus-results-grid">
            <aside className="bus-rail" aria-label="Filters">
              <Filters facets={facets} sel={sel} setSel={setSel} showCompanies={showCompanyFilter} activeCount={activeCount} onClear={clear} />
            </aside>

            <div className="bus-results" key={`${key}-${selected}`}>
              {loading ? (
                <TripSkeletons />
              ) : trips.error ? (
                <ErrorBox error={trips.error} onRetry={trips.reload} title="Couldn't load trips" />
              ) : items.length ? (
                <div className="bus-trip-list">{items.map((t, i) => <TripCard key={t.id} trip={t} index={i} />)}</div>
              ) : raw.length && activeCount ? (
                <EmptyState icon={Sliders} title="No trips match those filters" action={<button type="button" className="bus-btn bus-btn-navy" onClick={clear}>Reset filters</button>}>
                  {raw.length} {raw.length === 1 ? "trip is" : "trips are"} available on {dayLabel(selected)} without them.
                </EmptyState>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title={nothingAtAll ? "No upcoming trips match this search" : `No trips on ${dayLabel(selected)}`}
                  action={
                    nothingAtAll ? emptyAction : upNext ? (
                      <>
                        <button type="button" className="bus-btn bus-btn-primary" onClick={() => onDate(upNext)}>Next trips: {dayLabel(upNext)} <ArrowRight size={16} /></button>
                        <button type="button" className="bus-btn bus-btn-light" onClick={() => setCalOpen(true)}>Open calendar</button>
                      </>
                    ) : <button type="button" className="bus-btn bus-btn-light" onClick={() => setCalOpen(true)}>Open calendar</button>
                  }
                >
                  {nothingAtAll ? "Try a different route or bus type, or clear your filters." : upNext ? "Other days on this route still have seats." : "Try another day from the calendar."}
                </EmptyState>
              )}
            </div>
          </div>
        </div>
      </section>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} count={items.length} activeCount={activeCount} onClear={clear}>
        <Filters facets={facets} sel={sel} setSel={setSel} showCompanies={showCompanyFilter} activeCount={activeCount} onClear={clear} />
      </FilterSheet>
    </>
  );
}

// Bottom sheet (phones) that holds the same filters as the desktop rail.
function FilterSheet({ open, onClose, children, count, activeCount, onClear }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="bus-sheet-backdrop bus-sheet-bottom" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bus-sheet bus-filter-sheet" role="dialog" aria-modal="true" aria-label="Filter trips">
        <span className="bus-sheet-grab" aria-hidden="true" />
        <div className="bus-sheet-head">
          <h2>Filters</h2>
          <button type="button" className="bus-icon-btn" onClick={onClose} ref={closeRef} aria-label="Close filters"><Close size={18} /></button>
        </div>
        <div className="bus-sheet-scroll">{children}</div>
        <div className="bus-sheet-foot">
          {activeCount ? <button type="button" className="bus-btn bus-btn-light" onClick={onClear}>Reset</button> : null}
          <button type="button" className="bus-btn bus-btn-primary" onClick={onClose}>Show {count} {count === 1 ? "trip" : "trips"}</button>
        </div>
      </div>
    </div>
  );
}
