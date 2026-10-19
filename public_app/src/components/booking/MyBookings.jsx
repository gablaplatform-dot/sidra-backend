import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { formatUgx } from "../../lib/format";
import { getSession } from "../../lib/session";
import { BOOKING_STATUS, cancelBooking, myBookings, plural, quantityLabel, todayEat, UNIT_WORD, whenLabel } from "../../lib/bookings";
import { Skel } from "../Skeleton";
import PaymentModal from "../PaymentModal";
import { IconCalendar, IconPin } from "../icons";

const FILTERS = [
  { key: "upcoming" },
  { key: "past" },
  { key: "closed" }
];
const bucket = (b) => (["declined", "cancelled", "expired"].includes(b.status) ? "closed" : b.status === "completed" || b.endDate < todayEat() ? "past" : "upcoming");

const hoursLeft = (t, iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? t("booking.my.hoursMinutes", { h, m: Math.floor((ms % 3600000) / 60000) }) : t("booking.my.minutes", { m: Math.max(1, Math.floor(ms / 60000)) });
};

function BookingCard({ booking, onChanged, phone }) {
  const { t } = useTranslation();
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelBooking(booking.id);
      setConfirming(false);
      onChanged();
    } catch (e) {
      setError(e.message || t("booking.my.cancelError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="mo-card bkc">
      <header className="mo-card-head">
        <div className="mo-seller">
          {booking.listing.imageUrl ? <img src={booking.listing.imageUrl} alt="" /> : <span><IconCalendar width={18} height={18} /></span>}
          <div>
            <Link to={`/shop/product/${booking.listing.id}`}>{booking.listing.name}</Link>
            <small>{booking.provider.businessName} · {t("booking.my.ref", { ref: booking.reference })}</small>
          </div>
        </div>
        <span className={`mo-chip bk-status bk-status-${status.tone}`}>{status.label}</span>
      </header>

      <dl className="bkc-facts">
        <div><dt>{t("booking.when")}</dt><dd>{whenLabel(booking)}</dd></div>
        <div><dt>{t("booking.my.howLong")}</dt><dd>{plural(booking.units, UNIT_WORD[booking.unit])}{booking.quantity > 1 ? ` · ${quantityLabel(booking.unit, booking.quantity)}` : ""}</dd></div>
        <div><dt>{t("booking.guests")}</dt><dd>{booking.guests}</dd></div>
        {booking.total > 0 ? <div><dt>{t("booking.total")}</dt><dd>{formatUgx(booking.total)}</dd></div> : null}
      </dl>

      {booking.paymentStatus === "payable" && booking.canPay ? (
        <div className="bkc-pay">
          <div>
            <strong>{t("booking.my.payToKeep", { amount: formatUgx(booking.amountDue) })}</strong>
            <small>{booking.amountDue < booking.total ? `${t("booking.my.depositNote", { amount: formatUgx(booking.total - booking.amountDue) })} ` : ""}{booking.payBy ? t("booking.my.payWithin", { time: hoursLeft(t, booking.payBy) || t("booking.my.fewMinutes") }) : ""}</small>
          </div>
          <button type="button" className="mo-paynow" onClick={() => setPaying(true)}>{t("booking.payNow")}</button>
        </div>
      ) : booking.paymentStatus === "paid" ? (
        <p className="bkc-note"><strong>{t("booking.my.paid")}:</strong> {booking.amountPaid < booking.total ? t("booking.my.receivedRemaining", { amount: formatUgx(booking.amountPaid), rest: formatUgx(booking.total - booking.amountPaid) }) : t("booking.my.received", { amount: formatUgx(booking.amountPaid) })}</p>
      ) : booking.paymentStatus === "awaiting_approval" && booking.status === "pending" ? (
        <p className="bkc-note">{t("booking.my.awaitingApproval", { amount: formatUgx(booking.amountDue) })}</p>
      ) : null}

      {booking.status === "pending" ? (
        <p className="bkc-note">
          {booking.expiresAt && hoursLeft(t, booking.expiresAt)
            ? t("booking.my.waitingLeft", { name: booking.provider.businessName, left: hoursLeft(t, booking.expiresAt) })
            : t("booking.my.waiting", { name: booking.provider.businessName })}
        </p>
      ) : null}
      {booking.providerNote ? <p className="bkc-note"><strong>{t("booking.my.fromProvider")}:</strong> {booking.providerNote}</p> : null}
      {booking.depositNote && booking.status !== "declined" && booking.status !== "expired" ? <p className="bkc-note"><strong>{t("booking.my.payment")}:</strong> {booking.depositNote}</p> : null}

      {booking.contact && (booking.contact.address || booking.contact.phone) ? (
        <div className="bk-contact">
          <strong><IconPin width={14} height={14} /> {t("booking.whereToFind")}</strong>
          {booking.contact.address ? <span>{booking.contact.address}</span> : booking.contact.district ? <span>{booking.contact.district}</span> : null}
          {booking.contact.phone ? <a href={`tel:${booking.contact.phone}`}>{booking.contact.phone}</a> : null}
          {booking.contact.mapsUrl ? <a href={booking.contact.mapsUrl} target="_blank" rel="noreferrer">{t("booking.openInMaps")}</a> : null}
        </div>
      ) : null}
      {booking.instructions ? <p className="bkc-note"><strong>{t("booking.my.goodToKnow")}:</strong> {booking.instructions}</p> : null}
      <p className="bkc-policy">{booking.policyText}</p>

      {error ? <p className="mo-error">{error}</p> : null}
      {paying ? (
        <PaymentModal
          title={t("booking.my.payTitle")}
          summary={`${booking.listing.name} · ${whenLabel(booking)}`}
          amount={booking.amountDue}
          endpoint={`/payments/bookings/${encodeURIComponent(booking.id)}/pay`}
          defaultPhone={phone}
          onClose={() => setPaying(false)}
          onPaid={onChanged}
        />
      ) : null}
      {booking.canCancel ? (
        confirming ? (
          <div className="bkc-confirm">
            <span>{t("booking.my.cancelQuestion")}</span>
            <button type="button" className="secondary-button" onClick={() => setConfirming(false)} disabled={busy}>{t("booking.my.keepIt")}</button>
            <button type="button" className="bkc-danger" onClick={cancel} disabled={busy}>{busy ? t("booking.my.cancelling") : t("booking.my.yesCancel")}</button>
          </div>
        ) : (
          <button type="button" className="bkc-cancel" onClick={() => setConfirming(true)}>{t("booking.my.cancelBooking")}</button>
        )
      ) : null}
    </article>
  );
}

export default function MyBookings() {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("upcoming");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    myBookings()
      .then((r) => setItems(r?.items || []))
      .catch((e) => {
        setItems([]);
        setError(e.message || t("booking.my.loadError"));
      });
  }, []);
  useEffect(load, [load]);

  const counts = { upcoming: 0, past: 0, closed: 0 };
  (items || []).forEach((b) => {
    counts[bucket(b)] += 1;
  });
  const shown = (items || []).filter((b) => bucket(b) === filter);

  return (
    <>
      <div className="mo-filters" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "is-active" : ""} onClick={() => setFilter(f.key)}>
            {t(`booking.my.filters.${f.key}`)} <span>{counts[f.key]}</span>
          </button>
        ))}
      </div>
      {error ? <div className="error-message">{error}</div> : null}
      {items === null ? (
        <div className="mo-card"><Skel h={44} w={240} r={12} /><Skel h={14} w="80%" style={{ marginTop: 16 }} /><Skel h={54} w="100%" r={12} style={{ marginTop: 16 }} /></div>
      ) : shown.length ? (
        <div className="mo-list">{shown.map((b) => <BookingCard key={b.id} booking={b} onChanged={load} phone={getSession()?.user?.phone || ""} />)}</div>
      ) : (
        <div className="mo-empty">
          <strong>{items.length ? t("booking.my.nothingHere") : t("booking.my.noBookings")}</strong>
          <p>{items.length ? t("booking.my.tryAnotherTab") : t("booking.my.noBookingsHint")}</p>
          {!items.length ? <Link to="/services" className="primary-button">{t("services.browseServicesCta")}</Link> : null}
        </div>
      )}
    </>
  );
}
