import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { getSession } from "../../lib/session";
import { loginPath } from "../../lib/authRedirect";
import { formatUgx } from "../../lib/format";
import { addDays, addMonths, createBooking, dateLabel, diffDays, loadAvailability, monthStart, plural, quantityLabel, todayEat, UNIT_WORD, unitLabel, whenLabel } from "../../lib/bookings";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { IconCheck } from "../icons";

const Stepper = ({ label, value, min, max, onChange, hint }) => {
  const { t } = useTranslation();
  return (
  <div className="bk-stepper">
    <div>
      <strong>{label}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
    <div className="bk-stepper-ctl">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t("booking.panel.fewer", { label })}>−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t("booking.panel.more", { label })}>+</button>
    </div>
  </div>
  );
};

// The whole booking flow for one service: pick dates (or an hourly slot), choose how many, add your
// details, then send. Confirmed on the spot or sent to the provider, depending on how they set it up.
export default function BookingPanel({ listing }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [session] = useState(() => getSession());
  const config = listing.booking;
  const unit = config.unit;
  const instant = listing.bookingMode === "instant";
  const price = Number(listing.price) || 0;
  const today = todayEat();
  const lastDay = addDays(today, config.advanceDays - 1);

  const [month, setMonth] = useState(monthStart(today));
  const [days, setDays] = useState({});
  const [loadError, setLoadError] = useState("");
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [slots, setSlots] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [hours, setHours] = useState(config.minUnits || 1);
  const [quantity, setQuantity] = useState(1);
  const [guests, setGuests] = useState(Math.min(2, config.capacity));
  const [step, setStep] = useState("dates"); // dates | details | done
  const [details, setDetails] = useState(() => ({ name: session?.user?.name || "", phone: session?.user?.phone || "", email: session?.user?.email || "", notes: "" }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [version, setVersion] = useState(0);

  // Availability for the month on screen and the one after (the API serves up to ~3 months at a time).
  useEffect(() => {
    let active = true;
    loadAvailability(listing.id, month, addDays(month, 62))
      .then((data) => active && setDays((prev) => ({ ...prev, ...data.days })))
      .catch((e) => active && setLoadError(e.message || t("booking.panel.calendarError")));
    return () => {
      active = false;
    };
  }, [listing.id, month, version]);

  // Hourly services: the open slots for the picked day.
  useEffect(() => {
    if (unit !== "hour" || !start) {
      setSlots(null);
      return undefined;
    }
    let active = true;
    setSlots(null);
    loadAvailability(listing.id, start, start, start)
      .then((data) => active && setSlots(data.slots || []))
      .catch(() => active && setSlots([]));
    return () => {
      active = false;
    };
  }, [listing.id, unit, start, version]);

  const dayFree = useCallback((d) => days[d]?.free ?? null, [days]);

  // Can this date be picked on its own (as a start)?
  const info = (date) => {
    const d = days[date];
    if (date < today || date > lastDay) return { disabled: true };
    if (!d) return { disabled: false, free: config.inventory };
    // Picking a check-out: that day itself may be full, the nights before it may not.
    if (unit === "night" && start && !end && date > start) return { disabled: !rangeOk(start, date), free: d.free, showFree: false };
    if (unit === "day" && start && !end && date > start) return { disabled: !rangeOk(start, date), free: d.free, showFree: false };
    return { disabled: d.free < 1, free: d.free, partly: d.partlyBooked, showFree: config.inventory > 1 };
  };

  function rangeOk(a, b) {
    if (unit === "night") {
      for (let x = a; x < b; x = addDays(x, 1)) if ((dayFree(x) ?? 1) < 1) return false;
      return true;
    }
    for (let x = a; x <= b; x = addDays(x, 1)) if ((dayFree(x) ?? 1) < 1) return false;
    return true;
  }

  const pick = (date) => {
    setError("");
    if (unit === "hour") {
      setStart(date);
      setStartTime("");
      return;
    }
    if (!start || end || date <= start) {
      setStart(date);
      setEnd(null);
      return;
    }
    setEnd(date);
  };

  // Units booked (nights / days / hours) and how many can be taken at once across the chosen range.
  const units = unit === "hour" ? hours : start && end ? (unit === "night" ? diffDays(start, end) : diffDays(start, end) + 1) : unit === "day" && start ? 1 : 0;
  const hourSlots = useMemo(() => {
    if (unit !== "hour" || !slots || !startTime) return [];
    const i = slots.findIndex((s) => s.time === startTime);
    return i < 0 ? [] : slots.slice(i, i + hours);
  }, [unit, slots, startTime, hours]);
  const hourOk = unit === "hour" && startTime && hourSlots.length === hours && hourSlots.every((s) => s.free >= 1);

  const dayRange = () => {
    if (!start) return [];
    const last = unit === "night" ? (end ? addDays(end, -1) : null) : end || start;
    if (!last) return [];
    const list = [];
    for (let x = start; x <= last; x = addDays(x, 1)) list.push(x);
    return list;
  };
  const effectiveEnd = unit === "day" && start && !end ? start : end;
  const maxQty = unit === "hour"
    ? Math.max(1, Math.min(config.inventory, ...(hourSlots.length ? hourSlots.map((s) => s.free) : [config.inventory])))
    : Math.max(1, Math.min(config.inventory, ...(dayRange().length ? dayRange().map((d) => dayFree(d) ?? config.inventory) : [config.inventory])));
  const qty = Math.min(quantity, maxQty);
  const maxGuests = config.capacity * qty;
  const guestCount = Math.min(guests, maxGuests);

  const ready = unit === "hour" ? hourOk : Boolean(start && (unit === "day" || end) && rangeOk(start, effectiveEnd || start));
  const tooShort = ready && units < config.minUnits;
  const tooLong = ready && units > config.maxUnits;
  const total = price * units * qty;
  const onlinePct = Number(config.depositPercent) || 0;
  const dueOnline = onlinePct > 0 && total > 0 ? Math.round((total * onlinePct) / 100) : 0;

  const payload = () => ({
    listingId: listing.id,
    startDate: start,
    ...(unit === "hour" ? { startTime, hours } : { endDate: effectiveEnd || start }),
    quantity: qty,
    guests: guestCount,
    customer: { name: details.name.trim(), phone: details.phone.trim(), email: details.email.trim() || undefined, notes: details.notes.trim() || undefined }
  });

  const submit = async (event) => {
    event.preventDefault();
    if (details.name.trim().length < 2) return setError(t("booking.panel.nameRequired"));
    if (details.phone.replace(/\D/g, "").length < 7) return setError(t("booking.panel.phoneRequired"));
    setSubmitting(true);
    setError("");
    try {
      const booking = await createBooking(payload());
      setResult(booking);
      setStep("done");
    } catch (e) {
      setError(e.message || t("booking.panel.createFailed"));
      if (e.code === "NOT_AVAILABLE" || e.code === "DATES_BLOCKED") {
        setStep("dates");
        setVersion((v) => v + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStart(null);
    setEnd(null);
    setStartTime("");
    setQuantity(1);
    setResult(null);
    setError("");
    setStep("dates");
    setVersion((v) => v + 1);
  };

  const unitWord = UNIT_WORD[unit];
  const summaryWhen = unit === "hour" && start && startTime ? `${dateLabel(start)} · ${startTime}–${hourSlots.length ? addHour(startTime, hours) : ""}` : start && effectiveEnd ? (start === effectiveEnd ? dateLabel(start) : `${dateLabel(start)} → ${dateLabel(effectiveEnd)}`) : "";

  return (
    <section className="pd-card bk-panel" id="book" aria-label={t("booking.panel.ariaLabel")}>
      <header className="bk-head">
        <div>
          <h2>{t("booking.panel.title", { name: listing.name })}</h2>
          <p>{price > 0 ? <><strong>{formatUgx(price)}</strong> / {unitLabel(unitWord)}</> : t("booking.panel.priceOnRequest")}</p>
        </div>
        <span className={`bk-mode ${instant ? "is-instant" : ""}`}>{instant ? t("booking.panel.instant") : t("booking.panel.replyWithin", { hours: config.responseHours })}</span>
      </header>

      {step === "dates" ? (
        <>
          <p className="bk-lead">
            {t(`booking.panel.lead.${unit}`)}
          </p>
          {loadError ? <div className="error-message">{loadError}</div> : null}
          <AvailabilityCalendar month={month} onMonth={setMonth} info={info} start={start} end={unit === "day" && start && !end ? null : end} onPick={pick} maxDate={addMonths(monthStart(lastDay), 1)} />

          {unit === "hour" && start ? (
            <div className="bk-slots">
              <h3>{dateLabel(start, { weekday: "long", day: "numeric", month: "long" })}</h3>
              {slots === null ? <p className="bk-muted">{t("booking.panel.loadingTimes")}</p> : slots.length ? (
                <>
                  <div className="bk-chips" role="listbox" aria-label={t("booking.panel.startTime")}>
                    {slots.map((s) => (
                      <button key={s.time} type="button" role="option" aria-selected={startTime === s.time} disabled={s.free < 1} className={`bk-chip ${startTime === s.time ? "is-on" : ""}`} onClick={() => setStartTime(s.time)}>{s.time}</button>
                    ))}
                  </div>
                  <label className="bk-hours">
                    <span>{t("booking.panel.forHowLong")}</span>
                    <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                      {Array.from({ length: Math.max(1, config.maxUnits - config.minUnits + 1) }, (_, i) => config.minUnits + i).map((h) => <option key={h} value={h}>{plural(h, "hour")}</option>)}
                    </select>
                  </label>
                  {startTime && !hourOk ? <p className="bk-warn">{t("booking.panel.hoursNotFree")}</p> : null}
                </>
              ) : <p className="bk-muted">{t("booking.panel.noTimes")}</p>}
            </div>
          ) : null}

          {ready && !tooShort && !tooLong ? (
            <div className="bk-summary">
              <div className="bk-when">
                <span>{unit === "night" ? t("booking.panel.stay") : t("booking.when")}</span>
                <strong>{summaryWhen}</strong>
                <small>{plural(units, unitWord)}{unit === "night" ? ` · ${t("booking.panel.checkInOut", { checkIn: config.checkIn, checkOut: config.checkOut })}` : ""}</small>
              </div>
              {config.inventory > 1 ? <Stepper label={unit === "night" ? t("booking.rooms") : t("booking.spaces")} value={qty} min={1} max={maxQty} onChange={setQuantity} hint={t("booking.panel.available", { n: maxQty })} /> : null}
              <Stepper label={t("booking.guests")} value={guestCount} min={1} max={maxGuests} onChange={setGuests} hint={t("booking.panel.upTo", { n: maxGuests })} />
              <div className="bk-total">
                <span>{price > 0 ? `${formatUgx(price)} × ${plural(units, unitWord)}${qty > 1 ? ` × ${qty}` : ""}` : t("booking.panel.priceAgreed")}</span>
                {price > 0 ? <strong>{formatUgx(total)}</strong> : null}
              </div>
              {dueOnline > 0 ? <p className="bk-hint bk-pay-note"><Trans i18nKey={instant ? "booking.panel.payNoteInstant" : "booking.panel.payNoteConfirm"} values={{ amount: formatUgx(dueOnline), kind: onlinePct === 100 ? t("booking.panel.fullAmount") : t("booking.panel.depositPct", { pct: onlinePct }) }} components={{ strong: <strong /> }} /></p> : null}
              <button type="button" className="cta-button bk-go" onClick={() => { setError(""); setStep("details"); }}>{t("booking.panel.continue")}</button>
            </div>
          ) : (
            <p className="bk-hint">
              {tooShort ? t("booking.panel.minimum", { n: plural(config.minUnits, unitWord) }) : tooLong ? t("booking.panel.maximum", { n: plural(config.maxUnits, unitWord) }) : start && !end && unit === "night" ? t("booking.panel.pickCheckout") : unit !== "hour" ? t("booking.panel.chooseDates") : ""}
            </p>
          )}
          {error ? <div className="error-message">{error}</div> : null}
          <ul className="bk-facts">
            <li>{t(`booking.panel.policy.${config.cancellation}`, { defaultValue: "" })}</li>
            {config.depositNote ? <li>{config.depositNote}</li> : null}
            {config.leadTimeHours ? <li>{t("booking.panel.leadTime", { n: plural(config.leadTimeHours, "hour") })}</li> : null}
          </ul>
        </>
      ) : null}

      {step === "details" ? (
        !session ? (
          <div className="bk-signin">
            <h3>{t("booking.panel.signInTitle")}</h3>
            <p>{t("booking.panel.signInText")}</p>
            <Link to={loginPath(location, { resume: "book" })} className="primary-button" style={{ display: "block", textAlign: "center" }}>{t("nav.signIn")}</Link>
            <button type="button" className="link-button" onClick={() => setStep("dates")}>{t("booking.panel.changeDates")}</button>
          </div>
        ) : (
          <form className="bk-form" onSubmit={submit}>
            <button type="button" className="link-button" onClick={() => setStep("dates")}>{t("booking.panel.changeDates")}</button>
            <div className="bk-recap">
              <strong>{summaryWhen}</strong>
              <span>{plural(units, unitWord)}{qty > 1 ? ` · ${quantityLabel(unit, qty)}` : ""} · {plural(guestCount, "guest")}</span>
              {price > 0 ? <b>{formatUgx(total)}</b> : null}
            </div>
            {error ? <div className="error-message">{error}</div> : null}
            <label className="field"><span>{t("booking.panel.yourName")}</span><input required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} autoComplete="name" /></label>
            <label className="field"><span>{t("booking.panel.phone")}</span><input required inputMode="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} autoComplete="tel" placeholder="0772 123 456" /></label>
            <label className="field"><span>{t("booking.panel.email")}</span><input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} autoComplete="email" /></label>
            <label className="field"><span>{t("booking.panel.notes")}</span><textarea rows="3" maxLength={800} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} /></label>
            <p className="bk-hint">{instant ? t("booking.panel.hintInstant") : t("booking.panel.hintAwaiting", { hours: config.responseHours })} {price > 0 ? (dueOnline > 0 ? t("booking.panel.noPaymentDue", { amount: formatUgx(dueOnline) }) : t("booking.panel.noPayment")) : ""}</p>
            <button type="submit" className="cta-button bk-go" disabled={submitting}>{submitting ? t("booking.panel.sending") : instant ? (price > 0 ? t("booking.panel.confirmTotal", { total: formatUgx(total) }) : t("booking.panel.confirm")) : t("booking.panel.sendRequest")}</button>
          </form>
        )
      ) : null}

      {step === "done" && result ? (
        <div className="bk-done">
          <span className={`bk-done-icon ${result.status === "confirmed" ? "is-ok" : ""}`}><IconCheck /></span>
          <h3>{result.status === "confirmed" ? t("booking.panel.booked") : t("booking.panel.requestSent")}</h3>
          <p>
            {result.status === "confirmed"
              ? t("booking.panel.doneConfirmed")
              : t("booking.panel.donePending", { name: result.provider.businessName, hours: config.responseHours })}
          </p>
          <dl className="bk-ref">
            <div><dt>{t("booking.panel.reference")}</dt><dd>{result.reference}</dd></div>
            <div><dt>{t("booking.when")}</dt><dd>{whenLabel(result)}</dd></div>
            {result.total > 0 ? <div><dt>{t("booking.total")}</dt><dd>{formatUgx(result.total)}</dd></div> : null}
          </dl>
          {result.contact?.address || result.contact?.phone ? (
            <div className="bk-contact">
              <strong>{t("booking.whereToFind")}</strong>
              {result.contact.address ? <span>{result.contact.address}</span> : null}
              {result.contact.phone ? <a href={`tel:${result.contact.phone}`}>{result.contact.phone}</a> : null}
              {result.contact.mapsUrl ? <a href={result.contact.mapsUrl} target="_blank" rel="noreferrer">{t("booking.openInMaps")}</a> : null}
            </div>
          ) : null}
          {result.paymentStatus === "payable" ? <p className="bk-hint bk-pay-note"><Trans i18nKey="booking.panel.payWithin" values={{ amount: formatUgx(result.amountDue), hours: config.payWithinHours }} components={{ strong: <strong /> }} /></p> : result.paymentStatus === "awaiting_approval" ? <p className="bk-hint bk-pay-note">{t("booking.panel.payAfterConfirm", { amount: formatUgx(result.amountDue) })}</p> : null}
          <Link to="/orders?tab=bookings" className="primary-button" style={{ display: "block", textAlign: "center" }}>{result.paymentStatus === "payable" ? t("booking.payNow") : t("booking.panel.viewBookings")}</Link>
          <button type="button" className="link-button" onClick={reset}>{t("booking.panel.bookOther")}</button>
        </div>
      ) : null}
    </section>
  );
}

function addHour(time, hours) {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + hours) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
