import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { eatDate, normalizeUgPhone, operatorApi, ugx } from "../../../lib/bus";
import { Avatar, Chip, Empty, ErrorBox, PageHead, SearchBox, Skel, useDebounced, useLoad } from "../../../components/bus/operator/ui";
import { IcMail, IcMegaphone, IcSpark, IcUsers, IcWallet, IcWhatsapp } from "../../../components/bus/operator/icons";
import { dayLabel, ugxShort } from "../../../components/bus/operator/util";

export default function OperatorCustomers() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const data = useLoad(() => operatorApi.get("/customers", { q: query }), [query]);
  const d = data.data;
  const loyal = d ? d.items.filter((c) => c.loyal).length : 0;
  const spent = d ? d.items.reduce((a, c) => a + Number(c.spent || 0), 0) : 0;

  return (
    <>
      <PageHead sub={t("busOp.cu.sub")} actions={<Link to="/bus/operator/announcements" className="bop-btn bop-btn-primary"><IcMegaphone size={18} /> {t("busOp.cu.messageAll")}</Link>} />

      {d && !query ? (
        <div className="bop-kpis bop-kpis-3 is-compact bop-mb">
          <div className="bop-card bop-stat"><span className="bop-tile is-blue"><IcUsers size={22} /></span><div><small>{t("busOp.nav.customers")}</small><strong>{d.total}</strong><span>{t("busOp.cu.paidOnce")}</span></div></div>
          <div className="bop-card bop-stat"><span className="bop-tile is-orange"><IcSpark size={22} /></span><div><small>{t("busOp.cu.loyalCustomers")}</small><strong>{loyal}</strong><span>{t("busOp.cu.pctOfAll", { pct: d.total ? Math.round((loyal / d.total) * 100) : 0 })}</span></div></div>
          <div className="bop-card bop-stat"><span className="bop-tile is-green"><IcWallet size={22} /></span><div><small>{t("busOp.cu.totalSpent")}</small><strong><em>UGX</em> {ugxShort(spent)}</strong><span>{t("busOp.cu.acrossOrders")}</span></div></div>
        </div>
      ) : null}

      <div className="bop-toolbar"><SearchBox value={q} onChange={setQ} placeholder={t("busOp.cu.searchPh")} label={t("busOp.cu.searchAria")} /></div>
      <ErrorBox error={data.error} onRetry={data.refresh} />
      {data.loading && !d ? (
        <div className="bop-stack" role="status" aria-busy="true" aria-label={t("busOp.cu.loading")}>{[0, 1, 2, 3, 4, 5].map((i) => <div className="bop-card bop-skel-row" key={i}><Skel w={42} h={42} r={999} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="35%" h={14} /><Skel w="55%" h={11} /></div><Skel w={90} h={16} /></div>)}</div>
      ) : d ? (
        d.items.length ? (
          <div className={`bop-table is-customers ${data.loading ? "is-stale" : ""}`} role="table">
            <div className="bop-thead" role="row"><span role="columnheader">{t("busOp.cu.customer")}</span><span role="columnheader">{t("busOp.nav.orders")}</span><span role="columnheader">{t("busOp.rt.tickets")}</span><span role="columnheader">{t("busOp.cu.totalSpent")}</span><span role="columnheader">{t("busOp.cu.lastTravel")}</span><span role="columnheader" /></div>
            {d.items.map((c) => {
              const wa = normalizeUgPhone(c.phone);
              return (
                <div className="bop-trow" role="row" key={c.userId}>
                  <span className="c-cust" role="cell"><Avatar name={c.name} size={42} /><span><strong>{c.name} {c.loyal ? <Chip tone="orange"><IcSpark size={11} /> {t("busOp.cu.loyal")}</Chip> : null}</strong><small>{c.phone}{c.email ? ` · ${c.email}` : ""}</small></span></span>
                  <span className="c-n" data-label={t("busOp.nav.orders")} role="cell"><b>{c.bookings}</b></span>
                  <span className="c-n" data-label={t("busOp.rt.tickets")} role="cell"><b>{c.tickets}</b></span>
                  <span className="c-spent" data-label={t("busOp.cu.spent")} role="cell"><b>{ugx(c.spent)}</b></span>
                  <span className="c-last" data-label={t("busOp.cu.lastTrip")} role="cell">{c.lastTravelAt ? dayLabel(eatDate(c.lastTravelAt)) : "-"}</span>
                  <span className="c-actions" role="cell">
                    {wa ? <a className="bop-icon-btn is-sm is-wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={t("busOp.cu.whatsappX", { name: c.name })} title="WhatsApp"><IcWhatsapp size={17} /><span className="bop-btn-label">WhatsApp</span></a> : null}
                    {c.email ? <a className="bop-icon-btn is-sm" href={`mailto:${c.email}`} aria-label={t("busOp.cu.emailX", { name: c.name })} title={t("busOp.login.email")}><IcMail size={17} /><span className="bop-btn-label">{t("busOp.login.email")}</span></a> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : <Empty icon={<IcUsers size={28} />} title={query ? t("busOp.cu.noMatch") : t("busOp.cu.none")}>{query ? t("busOp.cu.noMatchHint") : t("busOp.cu.noneHint")}</Empty>
      ) : null}
    </>
  );
}
