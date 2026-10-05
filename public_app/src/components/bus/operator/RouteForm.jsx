import React from "react";

import { IcBus, IcCheck, IcMinus, IcPlus } from "./icons";
import { ALL_DAYS, DayChips, Field, digitsOnly, thousands } from "./ui";

// One bus route: where it goes, how long it takes, which bus, the ticket types (with prices) and
// the daily departure times. Used by the onboarding wizard and by the portal's route editor.

export const emptyRoute = () => ({
  name: "",
  originName: "",
  destinationName: "",
  boardingPoint: "",
  dropoffPoint: "",
  hours: "3",
  minutes: "0",
  busTypeId: "",
  ticketTypes: [{ name: "Economy", price: "" }],
  departures: [{ departureTime: "07:00", daysOfWeek: ALL_DAYS, name: "" }]
});

export const routeFromApi = (r) => ({
  name: r.name || "",
  originName: r.originName || "",
  destinationName: r.destinationName || "",
  boardingPoint: r.boardingPoint || "",
  dropoffPoint: r.dropoffPoint || "",
  hours: String(Math.floor((r.durationMinutes || 0) / 60)),
  minutes: String((r.durationMinutes || 0) % 60),
  busTypeId: r.busTypeId || r.busType?.id || "",
  ticketTypes: [],
  departures: []
});

export const routeTitle = (r) => r.name?.trim() || (r.originName && r.destinationName ? `${r.originName.trim()} → ${r.destinationName.trim()}` : "New route");

const durationOf = (r) => (Number(r.hours) || 0) * 60 + (Number(r.minutes) || 0);

export const validateRoute = (r, { full = true } = {}) => {
  if (!r.originName.trim()) return "Where does this route start? Enter the “From” town.";
  if (!r.destinationName.trim()) return "Where does this route go? Enter the “To” town.";
  if (r.originName.trim().toLowerCase() === r.destinationName.trim().toLowerCase()) return "“From” and “To” must be different towns.";
  if (durationOf(r) < 10) return "Enter how long the journey takes (at least 10 minutes).";
  if (durationOf(r) > 4000) return "That journey is too long. Please check the duration.";
  if (!full) return "";
  const types = r.ticketTypes.filter((t) => t.name.trim() || t.price !== "");
  if (!types.length) return "Add at least one ticket type with a price, for example Economy.";
  for (const t of types) {
    if (!t.name.trim()) return "Every ticket type needs a name.";
    if (t.price === "" || Number.isNaN(Number(t.price))) return `Enter a price for “${t.name}”.`;
  }
  if (new Set(types.map((t) => t.name.trim().toLowerCase())).size !== types.length) return "Two ticket types share the same name.";
  if (!r.departures.length) return "Add at least one departure time.";
  for (const d of r.departures) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.departureTime || "")) return "Every departure needs a time.";
    if (!d.daysOfWeek.length) return `Pick at least one day for the ${d.departureTime} departure.`;
  }
  return "";
};

export const routePayload = (r, { full = true } = {}) => {
  const payload = {
    name: routeTitle(r),
    originName: r.originName.trim(),
    destinationName: r.destinationName.trim(),
    boardingPoint: r.boardingPoint.trim(),
    dropoffPoint: r.dropoffPoint.trim(),
    durationMinutes: durationOf(r),
    busTypeId: r.busTypeId || null
  };
  if (!full) return payload;
  return {
    ...payload,
    ticketTypes: r.ticketTypes.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), price: Number(t.price) })),
    departures: r.departures.map((d) => ({ departureTime: d.departureTime, daysOfWeek: d.daysOfWeek, ...(d.name.trim() ? { name: d.name.trim() } : {}) }))
  };
};

export function PriceInput({ value, onChange, ...rest }) {
  return (
    <div className="bop-price-input">
      <span>UGX</span>
      <input className="bop-input" inputMode="numeric" placeholder="35,000" value={thousands(value)} onChange={(e) => onChange(digitsOnly(e.target.value))} {...rest} />
    </div>
  );
}

export function BusTypePicker({ busTypes = [], value, onChange }) {
  return (
    <div className="bop-typegrid" role="radiogroup" aria-label="Bus type">
      {busTypes.map((t) => {
        const on = value === t.id;
        const amenities = (Array.isArray(t.amenities) ? t.amenities : []).map((a) => (typeof a === "string" ? a : a?.name)).filter(Boolean);
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} className={`bop-typecard ${on ? "is-on" : ""}`} onClick={() => onChange(on ? "" : t.id)}>
            <span className="bop-typecard-art">{t.imageUrl ? <img src={t.imageUrl} alt="" /> : <IcBus size={26} />}</span>
            <span className="bop-typecard-body">
              <strong>{t.name}</strong>
              <small>{t.seats} seats</small>
              {amenities.length ? <em>{amenities.slice(0, 3).join(" · ")}</em> : null}
            </span>
            {on ? <span className="bop-typecard-tick"><IcCheck size={14} strokeWidth={3} /></span> : null}
          </button>
        );
      })}
      {!busTypes.length ? <p className="bop-hint">No bus types are set up yet. You can choose one later.</p> : null}
    </div>
  );
}

export default function RouteForm({ value, onChange, busTypes, full = true }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setType = (i, patch) => set({ ticketTypes: value.ticketTypes.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const setDep = (i, patch) => set({ departures: value.departures.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const placeholderName = value.originName && value.destinationName ? `${value.originName.trim()} → ${value.destinationName.trim()}` : "Kampala → Mbarara";

  return (
    <div className="bop-routeform">
      <div className="bop-grid2">
        <Field label="From"><input className="bop-input" placeholder="Kampala" value={value.originName} onChange={(e) => set({ originName: e.target.value })} maxLength={80} /></Field>
        <Field label="To"><input className="bop-input" placeholder="Mbarara" value={value.destinationName} onChange={(e) => set({ destinationName: e.target.value })} maxLength={80} /></Field>
      </div>
      <Field label="Route name" hint="Passengers see this name. Leave empty to use “From → To”.">
        <input className="bop-input" placeholder={placeholderName} value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
      </Field>
      <div className="bop-grid2">
        <Field label="Boarding point" hint="Where passengers get on, e.g. Namirembe Bus Park, Gate 3"><input className="bop-input" value={value.boardingPoint} onChange={(e) => set({ boardingPoint: e.target.value })} maxLength={160} /></Field>
        <Field label="Drop-off point" hint="Where the bus stops at the end"><input className="bop-input" value={value.dropoffPoint} onChange={(e) => set({ dropoffPoint: e.target.value })} maxLength={160} /></Field>
      </div>

      <div className="bop-field">
        <span className="bop-field-label">Journey time</span>
        <div className="bop-duration">
          <label><input className="bop-input" type="number" min="0" max="60" inputMode="numeric" value={value.hours} onChange={(e) => set({ hours: e.target.value })} /> <em>hours</em></label>
          <label><input className="bop-input" type="number" min="0" max="59" inputMode="numeric" value={value.minutes} onChange={(e) => set({ minutes: e.target.value })} /> <em>minutes</em></label>
        </div>
      </div>

      <div className="bop-field">
        <span className="bop-field-label">Bus type</span>
        <BusTypePicker busTypes={busTypes} value={value.busTypeId} onChange={(id) => set({ busTypeId: id })} />
      </div>

      {full ? (
        <>
          <div className="bop-subsection">
            <div className="bop-subhead">
              <div><h3>Ticket types and prices</h3><p>For example Economy 35,000 and VIP 50,000.</p></div>
              <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={() => set({ ticketTypes: [...value.ticketTypes, { name: "", price: "" }] })} disabled={value.ticketTypes.length >= 10}><IcPlus size={16} /> Add type</button>
            </div>
            {value.ticketTypes.map((t, i) => (
              <div className="bop-rowline" key={i}>
                <input className="bop-input" placeholder="Ticket name (Economy, VIP…)" value={t.name} onChange={(e) => setType(i, { name: e.target.value })} maxLength={60} aria-label="Ticket type name" />
                <PriceInput value={t.price} onChange={(price) => setType(i, { price })} aria-label="Ticket price" />
                <button type="button" className="bop-icon-btn" aria-label="Remove ticket type" onClick={() => set({ ticketTypes: value.ticketTypes.filter((_, idx) => idx !== i) })} disabled={value.ticketTypes.length <= 1}><IcMinus size={18} /></button>
              </div>
            ))}
          </div>

          <div className="bop-subsection">
            <div className="bop-subhead">
              <div><h3>Departure times</h3><p>These repeat on the days you choose. You can add more later under Sessions.</p></div>
              <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={() => set({ departures: [...value.departures, { departureTime: "12:00", daysOfWeek: ALL_DAYS, name: "" }] })} disabled={value.departures.length >= 20}><IcPlus size={16} /> Add time</button>
            </div>
            {value.departures.map((d, i) => (
              <div className="bop-dep" key={i}>
                <div className="bop-dep-top">
                  <input className="bop-input bop-time" type="time" value={d.departureTime} onChange={(e) => setDep(i, { departureTime: e.target.value })} aria-label="Departure time" />
                  <input className="bop-input" placeholder="Label (optional) e.g. Morning bus" value={d.name} onChange={(e) => setDep(i, { name: e.target.value })} maxLength={80} aria-label="Departure label" />
                  <button type="button" className="bop-icon-btn" aria-label="Remove departure" onClick={() => set({ departures: value.departures.filter((_, idx) => idx !== i) })} disabled={value.departures.length <= 1}><IcMinus size={18} /></button>
                </div>
                <DayChips value={d.daysOfWeek} onChange={(days) => setDep(i, { daysOfWeek: days })} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
