import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Skel } from "../Skeleton";
import { IconSearch } from "../icons";
import { addDays, todayEat } from "../../lib/bus";

// The big From / To / Date card on the bus home page.
export default function SearchBox({ places, loading }) {
  const navigate = useNavigate();
  const today = todayEat();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(today);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const submit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (date) q.set("date", date < today ? today : date);
    navigate(`/bus/search${q.toString() ? `?${q}` : ""}`);
  };

  if (loading) {
    return (
      <div className="bus-search" role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading destinations…</span>
        <Skel h={70} r={12} /><Skel w={42} h={46} r={12} /><Skel h={70} r={12} /><Skel h={70} r={12} /><Skel h={48} w={140} r={12} />
      </div>
    );
  }

  const origins = places?.origins || [];
  const destinations = (places?.destinations || []).filter((d) => d !== from);

  return (
    <form className="bus-search" onSubmit={submit} aria-label="Search bus trips">
      <label className="bus-field">
        <span>From</span>
        <select className="bus-select" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Anywhere</option>
          {origins.map((o) => <option key={o} value={o}>{o}</option>)}
          {from && !origins.includes(from) ? <option value={from}>{from}</option> : null}
        </select>
      </label>
      <button type="button" className="bus-swap" onClick={swap} aria-label="Swap origin and destination" title="Swap">⇄</button>
      <label className="bus-field">
        <span>To</span>
        <select className="bus-select" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Anywhere</option>
          {destinations.map((o) => <option key={o} value={o}>{o}</option>)}
          {to && !destinations.includes(to) ? <option value={to}>{to}</option> : null}
        </select>
      </label>
      <label className="bus-field">
        <span>Travel date</span>
        <input className="bus-input" type="date" value={date} min={today} max={addDays(today, 61)} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <button type="submit" className="bus-btn bus-btn-primary"><IconSearch width={18} height={18} /> Search buses</button>
    </form>
  );
}
