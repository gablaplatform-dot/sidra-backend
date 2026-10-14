import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { formatUgx } from "../../lib/format";
import { getSession } from "../../lib/session";
import { BOOKING_STATUS, cancelBooking, myBookings, plural, todayEat, UNIT_WORD, whenLabel } from "../../lib/bookings";
import { Skel } from "../Skeleton";
import PaymentModal from "../PaymentModal";
import { IconCalendar, IconPin } from "../icons";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "closed", label: "Cancelled" }
];
const bucket = (b) => (["declined", "cancelled", "expired"].includes(b.status) ? "closed" : b.status === "completed" || b.endDate < todayEat() ? "past" : "upcoming");

const hoursLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `${h}h ${Math.floor((ms % 3600000) / 60000)}m` : `${Math.max(1, Math.floor(ms / 60000))}m`;
};

function BookingCard({ booking, onChanged, phone }) {
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
      setError(e.message || "We couldn't cancel this booking.");
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
            <small>{booking.provider.businessName} · ref {booking.reference}</small>
          </div>
        </div>
        <span className={`mo-chip bk-status bk-status-${status.tone}`}>{status.label}</span>
      </header>

      <dl className="bkc-facts">
        <div><dt>When</dt><dd>{whenLabel(booking)}</dd></div>
        <div><dt>How long</dt><dd>{plural(booking.units, UNIT_WORD[booking.unit])}{booking.quantity > 1 ? ` · ${booking.quantity} ${booking.unit === "night" ? "rooms" : "spaces"}` : ""}</dd></div>
        <div><dt>Guests</dt><dd>{booking.guests}</dd></div>
        {booking.total > 0 ? <div><dt>Total</dt><dd>{formatUgx(booking.total)}</dd></div> : null}
      </dl>

      {booking.paymentStatus === "payable" && booking.canPay ? (
        <div className="bkc-pay">
          <div>
            <strong>Pay {formatUgx(booking.amountDue)} to keep this booking</strong>
            <small>{booking.amountDue < booking.total ? `That's the deposit; ${formatUgx(booking.total - booking.amountDue)} is paid to the provider directly. ` : ""}{booking.payBy ? `Pay within ${hoursLeft(booking.payBy) || "the next few minutes"}, or the dates are released.` : ""}</small>
          </div>
          <button type="button" className="mo-paynow" onClick={() => setPaying(true)}>Pay now</button>
        </div>
      ) : booking.paymentStatus === "paid" ? (
        <p className="bkc-note"><strong>Paid:</strong> {formatUgx(booking.amountPaid)} received{booking.amountPaid < booking.total ? `. The remaining ${formatUgx(booking.total - booking.amountPaid)} is paid to the provider directly.` : "."}</p>
      ) : booking.paymentStatus === "awaiting_approval" && booking.status === "pending" ? (
        <p className="bkc-note">Once the provider confirms, you can pay {formatUgx(booking.amountDue)} here. Nothing is charged before that.</p>
      ) : null}

      {booking.status === "pending" ? (
        <p className="bkc-note">
          Waiting for {booking.provider.businessName} to answer{booking.expiresAt && hoursLeft(booking.expiresAt) ? ` (they have ${hoursLeft(booking.expiresAt)} left)` : ""}. The dates are held for you meanwhile.
        </p>
      ) : null}
      {booking.providerNote ? <p className="bkc-note"><strong>From the provider:</strong> {booking.providerNote}</p> : null}
      {booking.depositNote && booking.status !== "declined" && booking.status !== "expired" ? <p className="bkc-note"><strong>Payment:</strong> {booking.depositNote}</p> : null}

      {booking.contact && (booking.contact.address || booking.contact.phone) ? (
        <div className="bk-contact">
          <strong><IconPin width={14} height={14} /> Where to find them</strong>
          {booking.contact.address ? <span>{booking.contact.address}</span> : booking.contact.district ? <span>{booking.contact.district}</span> : null}
          {booking.contact.phone ? <a href={`tel:${booking.contact.phone}`}>{booking.contact.phone}</a> : null}
          {booking.contact.mapsUrl ? <a href={booking.contact.mapsUrl} target="_blank" rel="noreferrer">Open in Maps</a> : null}
        </div>
      ) : null}
      {booking.instructions ? <p className="bkc-note"><strong>Good to know:</strong> {booking.instructions}</p> : null}
      <p className="bkc-policy">{booking.policyText}</p>

      {error ? <p className="mo-error">{error}</p> : null}
      {paying ? (
        <PaymentModal
          title="Pay for your booking"
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
            <span>Cancel this booking?</span>
            <button type="button" className="secondary-button" onClick={() => setConfirming(false)} disabled={busy}>Keep it</button>
            <button type="button" className="bkc-danger" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel"}</button>
          </div>
        ) : (
          <button type="button" className="bkc-cancel" onClick={() => setConfirming(true)}>Cancel booking</button>
        )
      ) : null}
    </article>
  );
}

export default function MyBookings() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("upcoming");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    myBookings()
      .then((r) => setItems(r?.items || []))
      .catch((e) => {
        setItems([]);
        setError(e.message || "Your bookings could not be loaded.");
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
            {f.label} <span>{counts[f.key]}</span>
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
          <strong>{items.length ? "Nothing here" : "No bookings yet"}</strong>
          <p>{items.length ? "Try another tab." : "Book a hotel room, a venue or an appointment and it shows up here."}</p>
          {!items.length ? <Link to="/services" className="primary-button">Browse services</Link> : null}
        </div>
      )}
    </>
  );
}
