import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { operatorApi, ugx } from "../../../lib/bus";
import { Avatar, Chip, Empty, ErrorBox, PageHead, Pager, SearchBox, Segmented, Skel, StatusChip, useDebounced, useLoad } from "../../../components/bus/operator/ui";
import { IcChevronDown, IcReceipt } from "../../../components/bus/operator/icons";
import { dateTimeLabel, timeAgo, useNow } from "../../../components/bus/operator/util";

const FILTERS = ["", "confirmed", "refund_due", "cancelled"];
const LIMIT = 20;

export default function OperatorBookings() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") || "");
  const [q, setQ] = useState(params.get("q") || "");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState("");
  const now = useNow(60000);
  const query = useDebounced(q.trim());
  const data = useLoad(() => operatorApi.get("/bookings", { status, q: query, page, limit: LIMIT }), [status, query, page]);
  const d = data.data;

  const sync = (nextStatus, nextQ) => {
    const p = {};
    if (nextStatus) p.status = nextStatus;
    if (nextQ) p.q = nextQ;
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHead sub={t("busOp.bk.sub")} />
      <div className="bop-toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); sync(status, v); }} placeholder={t("busOp.bk.searchPh")} label={t("busOp.bk.searchAria")} />
        <Segmented label={t("busOp.bk.filterAria")} value={status} onChange={(v) => { setStatus(v); setPage(1); sync(v, q); }} options={FILTERS.map((v) => [v, v ? t(`busOp.ui.st.${v}`) : t("busOp.trips.f.all")])} />
      </div>
      <ErrorBox error={data.error} onRetry={data.refresh} />
      {data.loading && !d ? (
        <div className="bop-stack" role="status" aria-busy="true" aria-label={t("busOp.bk.loading")}>{[0, 1, 2, 3, 4, 5].map((i) => <div className="bop-card bop-skel-row" key={i}><Skel w={40} h={40} r={999} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="35%" h={14} /><Skel w="60%" h={11} /></div><Skel w={90} h={16} /><Skel w={84} h={26} r={999} /></div>)}</div>
      ) : d ? (
        d.items.length ? (
          <>
            <p className="bop-count">{t("busOp.dash.orders", { count: d.total })}{data.loading ? ` · ${t("busOp.dash.updating")}` : ""}</p>
            <div className={`bop-table is-orders ${data.loading ? "is-stale" : ""}`} role="table">
              <div className="bop-thead" role="row"><span role="columnheader">{t("busOp.td.order")}</span><span role="columnheader">{t("busOp.td.passenger")}</span><span role="columnheader">{t("busOp.nav.trip")}</span><span role="columnheader">{t("busOp.dash.colSeats")}</span><span role="columnheader">{t("busOp.bk.amount")}</span><span role="columnheader">{t("busOp.dash.colStatus")}</span></div>
              {d.items.map((b) => {
                const isOpen = open === (b.id || b.reference);
                return (
                  <div className="bop-trowgroup" role="rowgroup" key={b.id || b.reference}>
                    <div className={`bop-trow is-click ${isOpen ? "is-open" : ""}`} role="row" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : (b.id || b.reference))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(isOpen ? "" : (b.id || b.reference)))}>
                      <span className="c-ref" role="cell"><code>{b.reference}</code><small>{timeAgo(b.createdAt, now)}</small></span>
                      <span className="c-who" role="cell"><Avatar name={b.passengerName} size={38} /><span><strong>{b.passengerName}</strong><small>{b.passengerPhone}</small></span></span>
                      <span className="c-trip" role="cell"><strong>{b.route?.name}</strong><small>{dateTimeLabel(b.departureAt)}</small></span>
                      <span className="c-tix" role="cell"><Chip>{t("busOp.dash.seats", { count: Number(b.seatCount) || 0 })}</Chip></span>
                      <span className="c-amount" role="cell"><strong>{ugx(b.total)}</strong><small>{t("busOp.bk.fee", { amount: ugx(b.fee) })}</small></span>
                      <span className="c-status" role="cell"><StatusChip status={b.status} /><IcChevronDown size={16} className="bop-chev" /></span>
                    </div>
                    {isOpen ? (
                      <div className="bop-trow-extra">
                        <span className="bop-extra-label">{t("busOp.rt.tickets")}</span>
                        <div className="bop-chips">{b.tickets?.length ? b.tickets.map((tk) => <Chip key={tk.ticketNumber} tone={tk.status === "used" ? "green" : tk.status === "cancelled" ? "red" : ""} title={t(`busOp.ui.st.${tk.status}`, { defaultValue: tk.status })}><code>{tk.ticketNumber}</code> {tk.ticketTypeName}{tk.status === "used" ? ` · ${t("busOp.bk.checkedInLower")}` : ""}</Chip>) : <span className="bop-hint">{t("busOp.bk.noTickets")}</span>}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Pager page={page} total={d.total} limit={LIMIT} onPage={(p) => { setPage(p); window.scrollTo({ top: 0 }); }} />
          </>
        ) : <Empty icon={<IcReceipt size={28} />} title={q || status ? t("busOp.bk.noMatch") : t("busOp.dash.noOrders")} action={q || status ? <button className="bop-btn bop-btn-light" onClick={() => { setQ(""); setStatus(""); sync("", ""); }}>{t("busOp.bk.clearFilters")}</button> : null}>{q || status ? t("busOp.bk.noMatchHint") : t("busOp.bk.noneHint")}</Empty>
      ) : null}
    </>
  );
}
