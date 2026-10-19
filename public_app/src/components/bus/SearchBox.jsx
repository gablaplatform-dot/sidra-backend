import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

import { Skel } from "../Skeleton";
import { addDays, dayLabel, dayMonthLabel, todayEat } from "../../lib/bus";
import { Calendar, ChevronDown, Pin, Search, Swap } from "./icons";

const friendlyDate = (date, today) => {
  if (!date) return i18n.t("bus.search.pickDate");
  if (date === today) return i18n.t("bus.search.todayDate", { date: dayMonthLabel(date) });
  if (date === addDays(today, 1)) return i18n.t("bus.search.tomorrowDate", { date: dayMonthLabel(date) });
  return dayLabel(date);
};

// The one-row From | To | Date | Search pill. On phones it becomes a tidy stacked card; on the
// search page (`collapsible`) it folds down to a one-line route summary with an Edit button.
//   initial   { from, to, date }  - kept in sync if the URL changes underneath
//   onSubmit  (values) => void    - defaults to going to /bus/search
export default function SearchBox({ places, loading, initial = {}, onSubmit, collapsible = false, className = "" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayEat();
  const [from, setFrom] = useState(initial.from || "");
  const [to, setTo] = useState(initial.to || "");
  const [date, setDate] = useState(initial.date || today);
  const [open, setOpen] = useState(!collapsible);
  const dateRef = useRef(null);

  useEffect(() => { setFrom(initial.from || ""); }, [initial.from]);
  useEffect(() => { setTo(initial.to || ""); }, [initial.to]);
  useEffect(() => { if (initial.date) setDate(initial.date); }, [initial.date]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const submit = (e) => {
    e.preventDefault();
    const values = { from, to, date: date < today ? today : date };
    setOpen(!collapsible);
    if (onSubmit) {
      onSubmit(values);
      return;
    }
    const q = new URLSearchParams();
    if (values.from) q.set("from", values.from);
    if (values.to) q.set("to", values.to);
    if (values.date) q.set("date", values.date);
    navigate(`/bus/search${q.toString() ? `?${q}` : ""}`);
  };

  if (loading) {
    return (
      <div className={`bus-pill ${className}`} role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("bus.search.loadingPlaces")}</span>
        <div className="bus-pill-fields" aria-hidden="true">
          <Skel h={44} r={14} /><Skel h={44} r={14} /><Skel h={44} r={14} /><Skel h={52} r={999} />
        </div>
      </div>
    );
  }

  const origins = places?.origins || [];
  const destinations = (places?.destinations || []).filter((d) => d !== from);
  const summary = `${from || t("bus.search.anywhere")} → ${to || t("bus.search.anywhere")}`;

  return (
    <form className={`bus-pill ${open ? "is-open" : ""} ${collapsible ? "is-collapsible" : ""} ${className}`} onSubmit={submit} aria-label={t("bus.search.formAria")}>
      {collapsible ? (
        <button type="button" className="bus-pill-summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span><b>{summary}</b><small>{friendlyDate(date, today)}</small></span>
          <em>{open ? t("bus.search.close") : t("bus.search.edit")}</em>
        </button>
      ) : null}
      <div className="bus-pill-fields">
        <label className="bus-pill-field">
          <span className="bus-pill-label">{t("bus.search.from")}</span>
          <span className="bus-pill-control">
            <Pin size={18} />
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("bus.search.travellingFrom")}>
              <option value="">{t("bus.search.anywhere")}</option>
              {origins.map((o) => <option key={o} value={o}>{o}</option>)}
              {from && !origins.includes(from) ? <option value={from}>{from}</option> : null}
            </select>
            <ChevronDown size={16} className="bus-pill-caret" />
          </span>
        </label>
        <button type="button" className="bus-pill-swap" onClick={swap} aria-label={t("bus.search.swapAria")} title={t("bus.search.swap")}><Swap size={16} /></button>
        <label className="bus-pill-field">
          <span className="bus-pill-label">{t("bus.search.to")}</span>
          <span className="bus-pill-control">
            <Pin size={18} />
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("bus.search.travellingTo")}>
              <option value="">{t("bus.search.anywhere")}</option>
              {destinations.map((o) => <option key={o} value={o}>{o}</option>)}
              {to && !destinations.includes(to) ? <option value={to}>{to}</option> : null}
            </select>
            <ChevronDown size={16} className="bus-pill-caret" />
          </span>
        </label>
        <label className="bus-pill-field bus-pill-date">
          <span className="bus-pill-label">{t("bus.search.date")}</span>
          <span className="bus-pill-control">
            <Calendar size={18} />
            <span className="bus-pill-value">{friendlyDate(date, today)}</span>
            <input
              ref={dateRef}
              type="date"
              value={date}
              min={today}
              max={addDays(today, 61)}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* older browsers open it on their own */ } }}
              aria-label={t("bus.search.travelDate")}
              required
            />
          </span>
        </label>
        <button type="submit" className="bus-btn bus-btn-primary bus-pill-go"><Search size={18} /> {t("bus.search.go")}</button>
      </div>
    </form>
  );
}
