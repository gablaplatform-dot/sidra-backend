import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { formatUgx } from "../../lib/format";
import { BOOKING_STATUS, providerBookings, respondToBooking, whenLabel } from "../../lib/bookings";
import { Skel } from "../Skeleton";

const timeLeft = (iso, t) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t("profile.bookings.expiring");
  const h = Math.floor(ms / 3600000);
  return h >= 1
    ? t("profile.bookings.hoursMinsLeft", { h, m: Math.floor((ms % 3600000) / 60000) })
    : t("profile.bookings.minsLeft", { m: Math.max(1, Math.floor(ms / 60000)) });
};

function Row({ booking, onChanged }) {
  const { t } = useTranslation();
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(null); // "decline" | "cancel" while the note box is open

  const act = async (action) => {
    setBusy(action);
    setError("");
    try {
      await respondToBooking(booking.id, action, note);
      setAsking(null);
      setNote("");
      onChanged();
    } catch (e) {
      setError(e.message || t("profile.bookings.errAction"));
    } finally {
      setBusy("");
    }
  };

  return (
    <article className="pbk-row">
      <div className="pbk-main">
        <div className="pbk-top">
          <strong>{booking.listing.name}</strong>
          <span className={`mo-chip bk-status bk-status-${status.tone}`}>{booking.status === "pending" ? t("profile.bookings.needsAnswerLeft", { time: timeLeft(booking.expiresAt, t) }) : t(`profile.bookings.status.${booking.status}`, { defaultValue: status.label })}</span>
        </div>
        <p className="pbk-when">{whenLabel(booking)} · {t(`profile.bookings.unit.${booking.unit}`, { count: booking.units })}{booking.quantity > 1 ? ` · ${t(booking.unit === "night" ? "profile.bookings.rooms" : "profile.bookings.spaces", { count: booking.quantity })}` : ""} · {t("profile.bookings.guests", { count: booking.guests })}{booking.total > 0 ? ` · ${formatUgx(booking.total)}` : ""}</p>
        <p className="pbk-guest">
          <b>{booking.customer?.name}</b> · <a href={`tel:${booking.customer?.phone}`}>{booking.customer?.phone}</a>
          {booking.customer?.email ? <> · <a href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a></> : null}
        </p>
        {booking.customer?.notes ? <p className="pbk-note">“{booking.customer.notes}”</p> : null}
        {booking.amountDue > 0 && !["declined", "cancelled", "expired"].includes(booking.status) ? (
          <p className="pbk-pay">
            {booking.paymentStatus === "paid"
              ? t("profile.bookings.paidOnline", { amount: formatUgx(booking.amountPaid) })
              : booking.paymentStatus === "payable"
                ? t("profile.bookings.waitingPay", { amount: formatUgx(booking.amountDue) })
                : t("profile.bookings.willPay", { amount: formatUgx(booking.amountDue) })}
          </p>
        ) : null}
        <small className="pbk-ref">{t("profile.bookings.ref")} {booking.reference}{booking.mode === "instant" ? ` · ${t("profile.bookings.bookedInstantly")}` : ""}</small>
      </div>

      {error ? <p className="mo-error">{error}</p> : null}
      {asking ? (
        <div className="pbk-ask">
          <label className="field">
            <span>{asking === "decline" ? t("profile.bookings.whyDecline") : t("profile.bookings.whyCancel")}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("profile.bookings.notePlaceholder")} />
          </label>
          <div className="pbk-actions">
            <button type="button" className="secondary-button" onClick={() => setAsking(null)}>{t("profile.bookings.back")}</button>
            <button type="button" className="bkc-danger" disabled={Boolean(busy)} onClick={() => act(asking)}>{busy ? t("profile.bookings.sending") : asking === "decline" ? t("profile.bookings.declineRequest") : t("profile.bookings.cancelBooking")}</button>
          </div>
        </div>
      ) : (
        <div className="pbk-actions">
          {booking.status === "pending" ? (
            <>
              <button type="button" className="secondary-button" onClick={() => setAsking("decline")}>{t("profile.bookings.decline")}</button>
              <button type="button" className="cta-button" disabled={Boolean(busy)} onClick={() => act("accept")}>{busy === "accept" ? t("profile.bookings.accepting") : t("profile.bookings.accept")}</button>
            </>
          ) : null}
          {booking.status === "confirmed" ? (
            <>
              <button type="button" className="secondary-button" onClick={() => setAsking("cancel")}>{t("profile.bookings.cancel")}</button>
              {booking.canComplete ? <button type="button" className="cta-button" disabled={Boolean(busy)} onClick={() => act("complete")}>{busy === "complete" ? t("profile.bookings.saving") : t("profile.bookings.markCompleted")}</button> : null}
            </>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function ProfileBookingsTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    providerBookings()
      .then((r) => setItems(r?.items || []))
      .catch((e) => {
        setItems([]);
        setError(e.message || t("profile.bookings.errLoad"));
      });
  }, []);
  useEffect(load, [load]);

  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const pending = (items || []).filter((b) => b.status === "pending");
  const upcoming = (items || []).filter((b) => b.status === "confirmed" && b.endDate >= today);
  const history = (items || []).filter((b) => !pending.includes(b) && !upcoming.includes(b)).reverse();

  return (
    <section className="pbk">
      <header className="detail-block-header">
        <h3>{t("profile.tabs.bookings")}</h3>
        <Link to="/profile/listings/new" className="secondary-button">{t("profile.bookings.newService")}</Link>
      </header>
      <p className="provider-meta">{t("profile.bookings.intro")}</p>
      {error ? <div className="error-message">{error}</div> : null}

      {items === null ? (
        <><Skel h={96} r={16} /><Skel h={96} r={16} style={{ marginTop: 12 }} /></>
      ) : !items.length ? (
        <div className="mo-empty">
          <strong>{t("profile.bookings.emptyTitle")}</strong>
          <p>{t("profile.bookings.emptyText")}</p>
        </div>
      ) : (
        <>
          <div className="pbk-stats">
            <div><b>{pending.length}</b><span>{t("profile.bookings.statNeedAnswer")}</span></div>
            <div><b>{upcoming.length}</b><span>{t("profile.bookings.statUpcoming")}</span></div>
            <div><b>{items.filter((b) => b.status === "completed").length}</b><span>{t("profile.bookings.statCompleted")}</span></div>
          </div>
          {pending.length ? <><h4 className="pbk-h">{t("profile.bookings.needsAnswer")}</h4>{pending.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
          {upcoming.length ? <><h4 className="pbk-h">{t("profile.bookings.upcoming")}</h4>{upcoming.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
          {history.length ? <><h4 className="pbk-h">{t("profile.bookings.history")}</h4>{history.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
        </>
      )}
    </section>
  );
}
