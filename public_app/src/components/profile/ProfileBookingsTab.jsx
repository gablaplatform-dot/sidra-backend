import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { formatUgx } from "../../lib/format";
import { BOOKING_STATUS, plural, providerBookings, respondToBooking, UNIT_WORD, whenLabel } from "../../lib/bookings";
import { Skel } from "../Skeleton";

const timeLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `${h}h ${Math.floor((ms % 3600000) / 60000)}m left` : `${Math.max(1, Math.floor(ms / 60000))}m left`;
};

function Row({ booking, onChanged }) {
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
      setError(e.message || "That didn't work. Please try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <article className="pbk-row">
      <div className="pbk-main">
        <div className="pbk-top">
          <strong>{booking.listing.name}</strong>
          <span className={`mo-chip bk-status bk-status-${status.tone}`}>{booking.status === "pending" ? `Needs your answer · ${timeLeft(booking.expiresAt)}` : status.label}</span>
        </div>
        <p className="pbk-when">{whenLabel(booking)} · {plural(booking.units, UNIT_WORD[booking.unit])}{booking.quantity > 1 ? ` · ${booking.quantity} ${booking.unit === "night" ? "rooms" : "spaces"}` : ""} · {plural(booking.guests, "guest")}{booking.total > 0 ? ` · ${formatUgx(booking.total)}` : ""}</p>
        <p className="pbk-guest">
          <b>{booking.customer?.name}</b> · <a href={`tel:${booking.customer?.phone}`}>{booking.customer?.phone}</a>
          {booking.customer?.email ? <> · <a href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a></> : null}
        </p>
        {booking.customer?.notes ? <p className="pbk-note">“{booking.customer.notes}”</p> : null}
        {booking.amountDue > 0 && !["declined", "cancelled", "expired"].includes(booking.status) ? (
          <p className="pbk-pay">
            {booking.paymentStatus === "paid"
              ? `Paid online: ${formatUgx(booking.amountPaid)}`
              : booking.paymentStatus === "payable"
                ? `Waiting for the guest to pay ${formatUgx(booking.amountDue)}`
                : `Guest will pay ${formatUgx(booking.amountDue)} online once you accept`}
          </p>
        ) : null}
        <small className="pbk-ref">Ref {booking.reference}{booking.mode === "instant" ? " · booked instantly" : ""}</small>
      </div>

      {error ? <p className="mo-error">{error}</p> : null}
      {asking ? (
        <div className="pbk-ask">
          <label className="field">
            <span>{asking === "decline" ? "Tell the guest why (optional)" : "Tell the guest why you're cancelling (optional)"}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. We're fully booked that weekend" />
          </label>
          <div className="pbk-actions">
            <button type="button" className="secondary-button" onClick={() => setAsking(null)}>Back</button>
            <button type="button" className="bkc-danger" disabled={Boolean(busy)} onClick={() => act(asking)}>{busy ? "Sending…" : asking === "decline" ? "Decline request" : "Cancel booking"}</button>
          </div>
        </div>
      ) : (
        <div className="pbk-actions">
          {booking.status === "pending" ? (
            <>
              <button type="button" className="secondary-button" onClick={() => setAsking("decline")}>Decline</button>
              <button type="button" className="cta-button" disabled={Boolean(busy)} onClick={() => act("accept")}>{busy === "accept" ? "Accepting…" : "Accept booking"}</button>
            </>
          ) : null}
          {booking.status === "confirmed" ? (
            <>
              <button type="button" className="secondary-button" onClick={() => setAsking("cancel")}>Cancel</button>
              {booking.canComplete ? <button type="button" className="cta-button" disabled={Boolean(busy)} onClick={() => act("complete")}>{busy === "complete" ? "Saving…" : "Mark completed"}</button> : null}
            </>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function ProfileBookingsTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    providerBookings()
      .then((r) => setItems(r?.items || []))
      .catch((e) => {
        setItems([]);
        setError(e.message || "Your bookings could not be loaded.");
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
        <h3>Bookings</h3>
        <Link to="/profile/listings/new" className="secondary-button">+ New bookable service</Link>
      </header>
      <p className="provider-meta">Guests book the services you've set up for bookings. Answer requests quickly: unanswered ones expire and free the dates.</p>
      {error ? <div className="error-message">{error}</div> : null}

      {items === null ? (
        <><Skel h={96} r={16} /><Skel h={96} r={16} style={{ marginTop: 12 }} /></>
      ) : !items.length ? (
        <div className="mo-empty">
          <strong>No bookings yet</strong>
          <p>Open a service, switch on &ldquo;This is a booking service&rdquo; under Bookings, and guests can reserve it.</p>
        </div>
      ) : (
        <>
          <div className="pbk-stats">
            <div><b>{pending.length}</b><span>need an answer</span></div>
            <div><b>{upcoming.length}</b><span>upcoming</span></div>
            <div><b>{items.filter((b) => b.status === "completed").length}</b><span>completed</span></div>
          </div>
          {pending.length ? <><h4 className="pbk-h">Needs your answer</h4>{pending.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
          {upcoming.length ? <><h4 className="pbk-h">Upcoming</h4>{upcoming.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
          {history.length ? <><h4 className="pbk-h">History</h4>{history.map((b) => <Row key={b.id} booking={b} onChanged={load} />)}</> : null}
        </>
      )}
    </section>
  );
}
