import React, { useState } from "react";

import { BUS_STATUS_LABEL, eatDateTimeLabel, operatorApi, ugx } from "../../../lib/bus";
import { IconReceipt } from "../../../components/icons";
import { Empty, ErrorBox, ListSkel, PageHead, Pager, StatusChip, useDebounced, useLoad } from "../../../components/bus/operator/ui";

const FILTERS = [["", "All"], ["confirmed", "Confirmed"], ["refund_due", "Refund pending"], ["cancelled", "Cancelled"]];
const LIMIT = 20;

export default function OperatorBookings() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(q.trim());
  const data = useLoad(() => operatorApi.get("/bookings", { status, q: query, page, limit: LIMIT }), [status, query, page]);
  const d = data.data;

  return (
    <>
      <PageHead title="Bookings" sub="Every order from passengers, newest first." />
      <div className="bop-toolbar">
        <input className="bus-input bop-search" type="search" placeholder="Search reference, name, phone or ticket" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search bookings" />
        <div className="bus-filter-row" style={{ margin: 0 }}>
          {FILTERS.map(([v, l]) => <button key={v || "all"} className={`bus-chip ${status === v ? "is-active" : ""}`} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}
        </div>
      </div>
      <ErrorBox error={data.error} onRetry={data.refresh} />
      {data.loading && !d ? <ListSkel rows={6} h={74} /> : d ? (
        d.items.length ? (
          <>
            <p className="bus-hint bop-count">{d.total} booking{d.total === 1 ? "" : "s"}{data.loading ? " · updating…" : ""}</p>
            <div className={`bop-stack ${data.loading ? "is-stale" : ""}`}>
              {d.items.map((b) => (
                <article key={b.id || b.reference} className="bus-card bop-booking">
                  <div className="bop-booking-ref"><code>{b.reference}</code><StatusChip status={b.status} /></div>
                  <div className="bop-booking-who"><strong>{b.passengerName}</strong><small>{b.passengerPhone}</small></div>
                  <div className="bop-booking-trip"><strong>{b.route?.name}</strong><small>{eatDateTimeLabel(b.departureAt)}</small></div>
                  <div className="bop-booking-money"><strong>{ugx(b.total)}</strong><small>{b.seatCount} seat{b.seatCount === 1 ? "" : "s"} · fee {ugx(b.fee)}</small></div>
                  {b.tickets?.length ? <div className="bop-booking-tickets">{b.tickets.map((t) => <span key={t.ticketNumber} className={`bus-chip ${t.status === "used" ? "bus-chip-green" : t.status === "cancelled" ? "bus-chip-red" : ""}`} title={BUS_STATUS_LABEL[t.status] || t.status}>{t.ticketNumber} · {t.ticketTypeName}</span>)}</div> : null}
                </article>
              ))}
            </div>
            <Pager page={page} total={d.total} limit={LIMIT} onPage={setPage} />
          </>
        ) : <Empty icon={<IconReceipt width={28} height={28} />} title={q || status ? "No bookings match" : "No bookings yet"}>{q || status ? "Try a different search or filter." : "When passengers buy tickets, their orders show up here."}</Empty>
      ) : null}
    </>
  );
}
