import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IconArrowRight, IconCalendar, IconPin } from "../icons";
import { addDays, busApi, dayLabel, durationLabel, eatTime, longDayLabel, todayEat, ugx } from "../../lib/bus";
import DateStrip from "./DateStrip";
import MonthCalendar from "./MonthCalendar";
import useLoad from "./useLoad";
import { ArrivalTime, BusLogo, ErrorBox, Rating, TripSkeletons, asList } from "./parts";

const WINDOW_DAYS = 62;

export function TripCard({ trip }) {
  const { route, operator, busType } = trip;
  const delay = Number(trip.delayMinutes) || 0;
  const soldOut = trip.soldOut;
  const closed = !soldOut && !trip.bookable;
  const low = !soldOut && trip.seatsLeft <= 5;
  const departs = delay ? eatTime(new Date(new Date(trip.departureAt).getTime() + delay * 60000)) : null;
  const amenities = asList(busType?.amenities);

  return (
    <article className="bus-card bus-trip" aria-label={`${operator.companyName} to ${route.destinationName} at ${eatTime(trip.departureAt)}`}>
      <div className="bus-trip-main">
        <div className="bus-trip-co">
          <BusLogo name={operator.companyName} src={operator.logoUrl} />
          <span>
            <Link to={`/bus/parks/${operator.slug}`} className="bus-trip-name">{operator.companyName}</Link>
            <Rating avg={operator.ratingAvg} count={operator.ratingCount} />
          </span>
        </div>
        <div className="bus-trip-times">
          <div>
            <strong>{eatTime(trip.departureAt)}</strong>
            <small>{route.originName}</small>
          </div>
          <div className="bus-trip-track">{durationLabel(route.durationMinutes)}</div>
          <div>
            <strong><ArrivalTime departureAt={trip.departureAt} minutes={route.durationMinutes} /></strong>
            <small>{route.destinationName}</small>
          </div>
        </div>
        <div className="bus-trip-meta">
          {busType ? <span className="bus-chip bus-chip-orange" title={amenities.join(", ")}>{busType.name}</span> : null}
          {delay > 0 ? <span className="bus-chip bus-chip-amber">Delayed {delay} min · leaving about {departs}</span> : null}
          {route.boardingPoint ? <span className="bus-chip"><IconPin width={13} height={13} /> {route.boardingPoint}</span> : null}
          {!route.boardingPoint && operator.parkName ? <span className="bus-chip"><IconPin width={13} height={13} /> {operator.parkName}</span> : null}
        </div>
      </div>
      <div className="bus-trip-buy">
        <div className="bus-trip-price">
          {trip.priceFrom ? <div className="bus-price"><small>from </small>{ugx(trip.priceFrom)}</div> : null}
          <span className={`bus-seats-left ${low || soldOut ? "is-low" : ""}`}>
            {soldOut ? "No seats left" : low ? `Only ${trip.seatsLeft} seat${trip.seatsLeft === 1 ? "" : "s"} left` : `${trip.seatsLeft} seats left`}
          </span>
        </div>
        {soldOut ? (
          <span className="bus-btn bus-btn-light" aria-disabled="true" style={{ opacity: 0.6 }}>Sold out</span>
        ) : closed ? (
          <span className="bus-btn bus-btn-light" aria-disabled="true" style={{ opacity: 0.6 }}>Sales closed</span>
        ) : (
          <Link to={`/bus/trip/${trip.id}`} className="bus-btn bus-btn-primary">Buy ticket <IconArrowRight width={16} height={16} /></Link>
        )}
      </div>
    </article>
  );
}

const SORTS = [
  { id: "earliest", label: "Earliest" },
  { id: "cheapest", label: "Cheapest" }
];

// Date strip + month calendar + sorted trip list for a set of filters. Shared by the search page
// and a single company's page. `date` may be empty: then the first day that has trips is shown.
export default function TripExplorer({ filters, date, onDate, emptyAction }) {
  const [sort, setSort] = useState("earliest");
  const [calOpen, setCalOpen] = useState(false);
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

  const items = useMemo(() => {
    const list = [...(trips.data?.items || [])];
    if (sort === "cheapest") list.sort((a, b) => Number(a.priceFrom ?? Infinity) - Number(b.priceFrom ?? Infinity) || new Date(a.departureAt) - new Date(b.departureAt));
    else list.sort((a, b) => new Date(a.departureAt) - new Date(b.departureAt));
    return list;
  }, [trips.data, sort]);

  const loading = waitingForCalendar || trips.loading;
  const nothingAtAll = !cal.loading && !cal.error && dayKeys.length === 0;
  const upNext = nextAfter(selected);

  return (
    <div className="bus-explorer">
      <div className="bus-explorer-head">
        <h2 className="bus-section-title">Choose a day</h2>
        <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={() => setCalOpen(true)} disabled={cal.loading}>
          <IconCalendar width={16} height={16} /> Pick from calendar
        </button>
      </div>
      {cal.error ? <ErrorBox error={cal.error} onRetry={cal.reload} title="Couldn't load available days" /> : <DateStrip days={days} loading={cal.loading} value={selected} onChange={onDate} />}
      <MonthCalendar open={calOpen} onClose={() => setCalOpen(false)} days={days} value={selected} onPick={onDate} horizon={WINDOW_DAYS} />

      <div className="bus-list-head">
        <div>
          <h2 className="bus-section-title">{longDayLabel(selected)}</h2>
          <p className="bus-section-sub" aria-live="polite">{loading ? "Looking for trips…" : trips.error ? "" : `${items.length} ${items.length === 1 ? "trip" : "trips"} · times in East Africa Time`}</p>
        </div>
        <div className="bus-sort" role="group" aria-label="Sort trips">
          {SORTS.map((s) => (
            <button type="button" key={s.id} className={`bus-chip ${sort === s.id ? "is-active" : ""}`} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <TripSkeletons />
      ) : trips.error ? (
        <ErrorBox error={trips.error} onRetry={trips.reload} title="Couldn't load trips" />
      ) : items.length ? (
        <div className="bus-trip-list">{items.map((t) => <TripCard key={t.id} trip={t} />)}</div>
      ) : (
        <div className="bus-card bus-empty">
          <strong>{nothingAtAll ? "No upcoming trips match these filters" : `No trips on ${dayLabel(selected)}`}</strong>
          <p>
            {nothingAtAll
              ? "Try a different route or bus type, or clear your filters."
              : upNext
                ? "Try another day - the next departure is on "
                : "Try another day from the calendar."}
            {upNext && !nothingAtAll ? <button type="button" className="bus-linkbtn" onClick={() => onDate(upNext)}>{dayLabel(upNext)}</button> : null}
          </p>
          {nothingAtAll && emptyAction ? <div style={{ marginTop: 14 }}>{emptyAction}</div> : null}
        </div>
      )}
    </div>
  );
}
