import React, { useCallback, useEffect, useRef, useState } from "react";

import { DOC_TYPE_LABEL, emailStatusInfo, formatDocDate, listDocuments, openDocumentPdf, resendDocument } from "../../lib/documents";
import { formatUgx } from "../../lib/format";
import { IconReceipt } from "../icons";
import Pagination from "../Pagination";
import { Skel } from "../Skeleton";

const PAGE_SIZE = 15;
const FILTERS = [
  { key: "", label: "All" },
  { key: "quotation", label: "Quotations" },
  { key: "receipt", label: "Receipts" }
];

export const EmailChip = ({ doc }) => {
  const info = emailStatusInfo(doc.emailStatus, doc.emailedTo);
  return (
    <span className={`docs-chip is-${info.tone}`} title={info.detail}>
      {info.tone === "ok" ? "✓ " : ""}{info.label}
    </span>
  );
};

const NumberCell = ({ doc }) => (
  <div className="docs-num">
    <strong>{doc.number}</strong>
    {doc.revision > 1 ? <span className="docs-chip is-rev">rev {doc.revision}</span> : null}
    {doc.status === "superseded" ? <span className="docs-chip is-muted">Superseded</span> : null}
  </div>
);

const TypeBadge = ({ type }) => <span className={`docs-type is-${type}`}>{DOC_TYPE_LABEL[type] || type}</span>;

function Actions({ doc, onOpenOrder, onNotice }) {
  const [viewing, setViewing] = useState(false);
  const [resending, setResending] = useState(false);

  const view = async () => {
    setViewing(true);
    try {
      await openDocumentPdf(doc);
    } catch (error) {
      onNotice({ tone: "bad", docId: doc.id, text: error.message || "Unable to open this PDF." });
    } finally {
      setViewing(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const result = await resendDocument(doc.id);
      const info = emailStatusInfo(result.status, doc.emailedTo);
      onNotice({
        tone: result.sent ? "ok" : info.tone === "bad" ? "bad" : "warn",
        docId: doc.id,
        text: result.sent ? `Emailed again${doc.customerName ? ` to ${doc.customerName}` : " to the buyer"}.` : `Not sent. ${info.detail}`,
        refresh: true
      });
    } catch (error) {
      onNotice({ tone: "bad", docId: doc.id, text: error.message || "Unable to resend this document." });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="docs-row-actions">
      <button type="button" className="docs-btn is-small" onClick={view} disabled={viewing}>{viewing ? "Opening…" : "View PDF"}</button>
      {doc.status !== "superseded" ? (
        <button type="button" className="docs-btn is-small" onClick={resend} disabled={resending}>{resending ? "Sending…" : "Resend email"}</button>
      ) : null}
      <button type="button" className="docs-btn is-small is-quiet" onClick={() => onOpenOrder?.(doc.orderId)}>Open order</button>
    </div>
  );
}

const ListSkeleton = () => (
  <div className="docs-list-skel" role="status" aria-busy="true">
    <span className="sr-only">Loading your documents…</span>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="docs-skel-row">
        <div className="docs-skel-main"><Skel h={16} w="40%" /><Skel h={12} w="62%" /></div>
        <Skel h={26} w={92} r={999} className="docs-skel-hide-sm" />
        <Skel h={34} w={150} r={10} />
      </div>
    ))}
  </div>
);

export default function IssuedDocuments({ onOpenOrder, active = true }) {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(
    ({ quiet = false } = {}) => {
      const id = ++requestId.current;
      if (!quiet) setLoading(true);
      setError("");
      listDocuments({ type: type || undefined, page, limit: PAGE_SIZE })
        .then((result) => id === requestId.current && setData(result))
        .catch((loadError) => id === requestId.current && setError(loadError.message || "Unable to load your documents."))
        .finally(() => id === requestId.current && setLoading(false));
    },
    [type, page]
  );

  useEffect(() => {
    if (active) load();
  }, [load, active]);

  const handleNotice = (next) => {
    setNotice(next);
    if (next.refresh) load({ quiet: true });
  };

  const items = data?.items || [];
  const noticeFor = (id) => (notice?.docId === id ? notice : null);

  return (
    <section className="docs-issued" hidden={!active}>
      <div className="docs-issued-head">
        <div className="docs-filters" role="group" aria-label="Filter documents">
          {FILTERS.map((filter) => (
            <button key={filter.key || "all"} type="button" className={`docs-filter${type === filter.key ? " is-active" : ""}`} aria-pressed={type === filter.key} onClick={() => { setType(filter.key); setPage(1); setNotice(null); }}>
              {filter.label}
            </button>
          ))}
        </div>
        {data ? <p className="docs-count" aria-live="polite">{data.total} document{data.total === 1 ? "" : "s"}</p> : null}
      </div>

      {error ? (
        <div className="error-message home-error docs-inline-error" role="alert">
          {error} <button type="button" className="docs-link-btn" onClick={() => load()}>Try again</button>
        </div>
      ) : null}

      {loading && !data ? (
        <ListSkeleton />
      ) : items.length ? (
        <div className={loading ? "docs-fade" : undefined} aria-busy={loading}>
          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="is-num">Total</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Email</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <React.Fragment key={doc.id}>
                    <tr className={doc.status === "superseded" ? "is-superseded" : undefined}>
                      <td><NumberCell doc={doc} /><TypeBadge type={doc.type} /></td>
                      <td><span className="docs-cust">{doc.customerName || "Customer"}</span><span className="docs-sub">Order {doc.orderRef}</span></td>
                      <td className="is-num"><strong>{formatUgx(doc.total)}</strong></td>
                      <td>{formatDocDate(doc.issuedAt)}</td>
                      <td><EmailChip doc={doc} /></td>
                      <td><Actions doc={doc} onOpenOrder={onOpenOrder} onNotice={handleNotice} /></td>
                    </tr>
                    {noticeFor(doc.id) ? (
                      <tr className="docs-notice-row"><td colSpan={6}><p className={`docs-result is-${noticeFor(doc.id).tone}`} role="status">{noticeFor(doc.id).text}</p></td></tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="docs-cards">
            {items.map((doc) => (
              <li key={doc.id} className={`docs-card${doc.status === "superseded" ? " is-superseded" : ""}`}>
                <div className="docs-card-top">
                  <TypeBadge type={doc.type} />
                  <EmailChip doc={doc} />
                </div>
                <NumberCell doc={doc} />
                <p className="docs-card-cust">{doc.customerName || "Customer"} <span className="docs-sub">· Order {doc.orderRef}</span></p>
                <div className="docs-card-money">
                  <strong>{formatUgx(doc.total)}</strong>
                  <span className="docs-sub">{formatDocDate(doc.issuedAt)}</span>
                </div>
                <Actions doc={doc} onOpenOrder={onOpenOrder} onNotice={handleNotice} />
                {noticeFor(doc.id) ? <p className={`docs-result is-${noticeFor(doc.id).tone}`} role="status">{noticeFor(doc.id).text}</p> : null}
              </li>
            ))}
          </ul>

          <Pagination page={page} limit={PAGE_SIZE} total={data?.total || 0} onPageChange={(next) => { setPage(next); setNotice(null); }} />
        </div>
      ) : !error ? (
        <div className="docs-state">
          <IconReceipt />
          <h3>{type ? `No ${type === "receipt" ? "receipts" : "quotations"} yet` : "No documents yet"}</h3>
          <p>Documents appear here automatically when buyers place or pay for orders.</p>
          <p className="docs-hint">A quotation is sent when a buyer places a cash order; a receipt is sent once an order is paid.</p>
        </div>
      ) : null}
    </section>
  );
}
