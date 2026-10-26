import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { docTypeLabel, openDocumentPdf } from "../lib/documents";
import { clearSession, getSession } from "../lib/session";
import SiteHeader from "../components/SiteHeader";
import { IconCheck, IconChevronLeft, IconReceipt } from "../components/icons";
import { Skel } from "../components/Skeleton";
import QuotationModal from "../components/profile/QuotationModal";
import {
  ORDER_FLOW, Avatar, StatusBadge, actionsFor, canEditQuotation, customerName, formatOrderDateTime, formatUgx, isClosed, issuedDocs,
  orderRef, paymentChip, updateOrderStatus
} from "../components/profile/orderKit";

// One order, full screen: who bought what, how it gets to them, what has been paid, and the next step.
export default function ProviderOrderView() {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const load = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      return request(`/engagement/provider/orders/${encodeURIComponent(orderId)}`)
        .then((result) => {
          setOrder(result);
          setError("");
        })
        .catch((loadError) => setError(loadError.status === 404 ? t("profile.orders.errNotFound") : loadError.message || t("profile.orders.errLoad")))
        .finally(() => setLoading(false));
    },
    [orderId, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  const back = () => navigate("/profile?tab=orders");

  const runAction = async (action) => {
    if (action.tone === "danger" && !window.confirm(t("profile.orders.confirmClose"))) return;
    setBusy(true);
    setError("");
    try {
      await updateOrderStatus(order.id, action.status);
      await load({ quiet: true });
    } catch (updateError) {
      setError(updateError.message || t("profile.orders.errUpdate"));
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (doc) => {
    setOpeningDoc(doc.id);
    setError("");
    try {
      await openDocumentPdf(doc);
    } catch (openError) {
      setError(openError.message || t("profile.orders.errOpenDoc"));
    } finally {
      setOpeningDoc(null);
    }
  };

  const logout = () => {
    clearSession();
    setSession(null);
    navigate("/home");
  };

  const actions = order ? actionsFor(order) : [];
  const closed = order ? isClosed(order) : false;
  const flowIndex = order ? ORDER_FLOW.indexOf(order.status) : -1;
  const chip = order ? paymentChip(order, t) : null;
  const name = order ? customerName(order, t) : "";
  const fulfillment = order?.fulfillment || {};
  const hasCoords = Number.isFinite(fulfillment.lat) && Number.isFinite(fulfillment.lng);

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />
      <div className="pov-page">
        <button type="button" className="pov-back" onClick={back}><IconChevronLeft aria-hidden="true" /> {t("profile.orders.backToOrders")}</button>

        {error ? <div className="error-message home-error">{error}</div> : null}

        {loading ? (
          <div className="pov-card"><Skel w="40%" h={22} /><Skel w="100%" h={90} /><Skel w="70%" h={16} /></div>
        ) : order ? (
          <>
            <section className="pov-card pov-top">
              <div>
                <p className="eyebrow">{t("profile.orders.orderTitle", { ref: orderRef(order.id) })}</p>
                <h1>{formatUgx(order.total)}</h1>
                <small>{t("profile.orders.placedOn", { date: formatOrderDateTime(order.createdAt) })}</small>
              </div>
              <StatusBadge status={order.status} t={t} />
            </section>

            {closed && order.status !== "fulfilled" ? (
              <div className="pov-closed">{t("profile.orders.closedNote")}</div>
            ) : (
              <section className="pov-card">
                <ol className="pov-steps" aria-label={t("profile.orders.progress")}>
                  {ORDER_FLOW.map((step, i) => (
                    <li key={step} className={i < flowIndex || order.status === "fulfilled" ? "is-done" : i === flowIndex ? "is-now" : ""}>
                      <span>{i < flowIndex || order.status === "fulfilled" ? <IconCheck width={14} height={14} /> : i + 1}</span>
                      {t(`profile.orders.status.${step}`)}
                    </li>
                  ))}
                </ol>
                {order.paymentMethod === "online" && order.status === "accepted" ? <p className="pov-hint">{t("profile.orders.notPaidHint")}</p> : null}
                {actions.length ? (
                  <div className="pov-actions">
                    {actions.map((action) => (
                      <button key={action.status} type="button" className={action.tone === "primary" ? "po-primary" : "po-danger"} disabled={busy} onClick={() => runAction(action)}>{t(action.labelKey)}</button>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            <section className="pov-card">
              <h2>{t("profile.orders.customerTitle")}</h2>
              <div className="pov-person">
                <Avatar name={name} />
                <div>
                  <strong>{name}</strong>
                  {order.customer?.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}
                  {order.customer?.email ? <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a> : null}
                </div>
              </div>
              {order.customer?.notes ? <p className="pov-note"><b>{t("profile.orders.note")}</b> {order.customer.notes}</p> : null}
            </section>

            <section className="pov-card">
              <h2>{t("profile.orders.deliveryTitle")}</h2>
              {fulfillment.method === "delivery" ? (
                <p>
                  {fulfillment.address || t("profile.orders.noAddress")}
                  {hasCoords ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${fulfillment.lat},${fulfillment.lng}`} target="_blank" rel="noreferrer">{t("profile.orders.directions")}</a>
                    </>
                  ) : null}
                </p>
              ) : fulfillment.method === "pickup" ? (
                <p>{t("profile.orders.willPickUp")}</p>
              ) : (
                <p>{t("profile.orders.noAddress")}</p>
              )}
            </section>

            <section className="pov-card">
              <h2>{t("profile.orders.itemsTitle")}</h2>
              <ul className="pov-items">
                {(order.items || []).map((item) => (
                  <li key={item.id}>
                    <span>{item.name}<small>{formatUgx(item.unitPrice)} × {item.quantity}</small></span>
                    <strong>{formatUgx(item.total)}</strong>
                  </li>
                ))}
              </ul>
              <div className="pov-total">
                <span>{t("profile.orders.total")}</span>
                <strong>{formatUgx(order.total)}</strong>
              </div>
            </section>

            <section className="pov-card">
              <h2>{t("profile.orders.paymentTitle")}</h2>
              <p><span className={`po-pay is-${chip.tone}`}>{chip.label}</span></p>
              {order.paymentMethod === "online" && order.paymentStatus === "payable" ? <p className="pov-hint">{t("profile.orders.waitingBuyerPay", { amount: formatUgx(order.total) })}</p> : null}
              {order.paymentMethod === "cash" && order.paymentStatus !== "paid_cash" ? (
                <p className="pov-hint">{t(fulfillment.method === "pickup" ? "profile.orders.cashOnPickup" : "profile.orders.cashOnDelivery", { amount: formatUgx(order.total) })}</p>
              ) : null}
            </section>

            {issuedDocs(order).length || canEditQuotation(order) ? (
              <section className="pov-card">
                <h2>{t("profile.orders.docsTitle")}</h2>
                <div className="docs-order-docs" aria-label={t("profile.orders.docsAria")}>
                  {issuedDocs(order).map((doc) => (
                    <button key={doc.id} type="button" className={`docs-doc-chip is-${doc.type}`} onClick={() => openDoc(doc)} disabled={openingDoc === doc.id} title={t("profile.orders.openPdf", { type: docTypeLabel(doc.type), amount: formatUgx(doc.total) })}>
                      <IconReceipt aria-hidden="true" />
                      <span>{docTypeLabel(doc.type)} {doc.number}{doc.revision > 1 ? ` · ${t("profile.orders.rev", { n: doc.revision })}` : ""}</span>
                    </button>
                  ))}
                  {canEditQuotation(order) ? <button type="button" className="docs-btn is-small" onClick={() => setQuoting(true)}>{t("profile.orders.editQuotation")}</button> : null}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="empty-state"><p>{t("profile.orders.errNotFound")}</p><Link to="/home" className="secondary-button">{t("profile.backHome")}</Link></div>
        )}
      </div>
      {quoting && order ? <QuotationModal order={order} onClose={() => setQuoting(false)} onIssued={() => load({ quiet: true })} /> : null}
    </main>
  );
}
