import React, { useState } from "react";
import { Link } from "react-router-dom";

import { dayLabel, eatDate, operatorApi, normalizeUgPhone, ugx } from "../../../lib/bus";
import { IconUsers } from "../../../components/icons";
import { Empty, ErrorBox, ListSkel, PageHead, useDebounced, useLoad } from "../../../components/bus/operator/ui";

export default function OperatorCustomers() {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const data = useLoad(() => operatorApi.get("/customers", { q: query }), [query]);
  const d = data.data;

  return (
    <>
      <PageHead title="Customers" sub="People who have travelled with you. Customers with 3 or more bookings are loyal." actions={<Link to="/bus/operator/announcements" className="bus-btn bus-btn-primary">Message all customers</Link>} />
      <div className="bop-toolbar"><input className="bus-input bop-search" type="search" placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></div>
      <ErrorBox error={data.error} onRetry={data.refresh} />
      {data.loading && !d ? <ListSkel rows={6} h={72} /> : d ? (
        d.items.length ? (
          <>
            <p className="bus-hint bop-count">{d.total} customer{d.total === 1 ? "" : "s"}</p>
            <div className={`bop-stack ${data.loading ? "is-stale" : ""}`}>
              {d.items.map((c) => {
                const wa = normalizeUgPhone(c.phone);
                return (
                  <article key={c.userId} className="bus-card bop-customer">
                    <span className="bop-avatar">{(c.name || "?").slice(0, 1).toUpperCase()}</span>
                    <div className="bop-customer-main">
                      <strong>{c.name} {c.loyal ? <span className="bus-chip bus-chip-orange">Loyal</span> : null}</strong>
                      <small>{c.phone}{c.email ? ` · ${c.email}` : ""}</small>
                    </div>
                    <div className="bop-customer-stats">
                      <span><b>{c.bookings}</b> booking{c.bookings === 1 ? "" : "s"}</span>
                      <span><b>{c.tickets}</b> ticket{c.tickets === 1 ? "" : "s"}</span>
                      <span><b>{ugx(c.spent)}</b> spent</span>
                      <span>Last trip {c.lastTravelAt ? dayLabel(eatDate(c.lastTravelAt)) : "-"}</span>
                    </div>
                    <div className="bop-customer-actions">
                      {wa ? <a className="bus-btn bus-btn-light bus-btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                      {c.email ? <a className="bus-btn bus-btn-light bus-btn-sm" href={`mailto:${c.email}`}>Email</a> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : <Empty icon={<IconUsers width={28} height={28} />} title={query ? "No customers match" : "No customers yet"}>{query ? "Try a different name, phone or email." : "Customers appear here after their first paid booking."}</Empty>
      ) : null}
    </>
  );
}
