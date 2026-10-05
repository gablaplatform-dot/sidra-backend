import React, { useState } from "react";
import { Link } from "react-router-dom";

import { dayLabel, eatDate, normalizeUgPhone, operatorApi, ugx } from "../../../lib/bus";
import { Avatar, Chip, Empty, ErrorBox, PageHead, SearchBox, Skel, useDebounced, useLoad } from "../../../components/bus/operator/ui";
import { IcMail, IcMegaphone, IcSpark, IcUsers, IcWallet, IcWhatsapp } from "../../../components/bus/operator/icons";
import { ugxShort } from "../../../components/bus/operator/util";

export default function OperatorCustomers() {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const data = useLoad(() => operatorApi.get("/customers", { q: query }), [query]);
  const d = data.data;
  const loyal = d ? d.items.filter((c) => c.loyal).length : 0;
  const spent = d ? d.items.reduce((a, c) => a + Number(c.spent || 0), 0) : 0;

  return (
    <>
      <PageHead sub="People who have travelled with you. Customers with 3 or more orders are loyal." actions={<Link to="/bus/operator/announcements" className="bop-btn bop-btn-primary"><IcMegaphone size={18} /> Message all customers</Link>} />

      {d && !query ? (
        <div className="bop-kpis bop-kpis-3 is-compact bop-mb">
          <div className="bop-card bop-stat"><span className="bop-tile is-blue"><IcUsers size={22} /></span><div><small>Customers</small><strong>{d.total}</strong><span>paid at least once</span></div></div>
          <div className="bop-card bop-stat"><span className="bop-tile is-orange"><IcSpark size={22} /></span><div><small>Loyal customers</small><strong>{loyal}</strong><span>{d.total ? Math.round((loyal / d.total) * 100) : 0}% of all customers</span></div></div>
          <div className="bop-card bop-stat"><span className="bop-tile is-green"><IcWallet size={22} /></span><div><small>Total spent</small><strong><em>UGX</em> {ugxShort(spent)}</strong><span>across all orders</span></div></div>
        </div>
      ) : null}

      <div className="bop-toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search name, phone or email" label="Search customers" /></div>
      <ErrorBox error={data.error} onRetry={data.refresh} />
      {data.loading && !d ? (
        <div className="bop-stack" role="status" aria-busy="true" aria-label="Loading customers">{[0, 1, 2, 3, 4, 5].map((i) => <div className="bop-card bop-skel-row" key={i}><Skel w={42} h={42} r={999} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="35%" h={14} /><Skel w="55%" h={11} /></div><Skel w={90} h={16} /></div>)}</div>
      ) : d ? (
        d.items.length ? (
          <div className={`bop-table is-customers ${data.loading ? "is-stale" : ""}`} role="table">
            <div className="bop-thead" role="row"><span role="columnheader">Customer</span><span role="columnheader">Orders</span><span role="columnheader">Tickets</span><span role="columnheader">Total spent</span><span role="columnheader">Last travel</span><span role="columnheader" /></div>
            {d.items.map((c) => {
              const wa = normalizeUgPhone(c.phone);
              return (
                <div className="bop-trow" role="row" key={c.userId}>
                  <span className="c-cust" role="cell"><Avatar name={c.name} size={42} /><span><strong>{c.name} {c.loyal ? <Chip tone="orange"><IcSpark size={11} /> Loyal</Chip> : null}</strong><small>{c.phone}{c.email ? ` · ${c.email}` : ""}</small></span></span>
                  <span className="c-n" data-label="Orders" role="cell"><b>{c.bookings}</b></span>
                  <span className="c-n" data-label="Tickets" role="cell"><b>{c.tickets}</b></span>
                  <span className="c-spent" data-label="Spent" role="cell"><b>{ugx(c.spent)}</b></span>
                  <span className="c-last" data-label="Last trip" role="cell">{c.lastTravelAt ? dayLabel(eatDate(c.lastTravelAt)) : "-"}</span>
                  <span className="c-actions" role="cell">
                    {wa ? <a className="bop-icon-btn is-sm is-wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name}`} title="WhatsApp"><IcWhatsapp size={17} /><span className="bop-btn-label">WhatsApp</span></a> : null}
                    {c.email ? <a className="bop-icon-btn is-sm" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} title="Email"><IcMail size={17} /><span className="bop-btn-label">Email</span></a> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : <Empty icon={<IcUsers size={28} />} title={query ? "No customers match" : "No customers yet"}>{query ? "Try a different name, phone or email." : "Customers appear here after their first paid booking."}</Empty>
      ) : null}
    </>
  );
}
