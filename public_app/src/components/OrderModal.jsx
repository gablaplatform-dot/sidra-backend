import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { getSession } from "../lib/session";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";
import { initialOrderDetails, placeCashOrder, validateOrderDetails } from "../lib/orders";
import OrderDetailsFields from "./OrderDetailsFields";
import { IconClose } from "./icons";

// Order without paying online: the order goes straight to the seller and the buyer pays them in
// cash on delivery / pickup. For services there is no delivery step and the price is agreed with
// the provider directly.
export default function OrderModal({ listing, providerId, onClose, payOnline = false }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [session] = useState(() => getSession());
  const [details, setDetails] = useState(() => initialOrderDetails(session));
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  const isService = listing.type === "service";
  const unitPrice = Number(listing.price) || 0;
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const total = unitPrice * qty;

  const submit = async (event) => {
    event.preventDefault();
    const problem = validateOrderDetails(details, { delivery: !isService });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await placeCashOrder({
        providerId,
        items: [{ listingId: listing.id, name: listing.name, quantity: qty, unitPrice }],
        details,
        delivery: !isService,
        paymentMethod: payOnline ? "online" : "cash"
      });
      setPlaced(order);
    } catch (submitError) {
      setError(submitError.message || t("orders.modal.placeFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t("form.close")}>
          <IconClose />
        </button>

        {!session ? (
          <>
            <h2>{t("orders.modal.signInTitle")}</h2>
            <p>{t("orders.modal.signInBody", { name: listing.name })}</p>
            <Link to={loginPath(location, { resume: payOnline ? "buy" : "order" })} className="primary-button" style={{ display: "block", textAlign: "center" }}>{t("nav.signIn")}</Link>
          </>
        ) : placed ? (
          <div className="od-done">
            <h2>{payOnline ? t("orders.modal.requestSent") : t("orders.modal.sent")}</h2>
            <p>
              <Trans
                i18nKey={payOnline ? "orders.modal.placedOnline" : "orders.modal.placedCash"}
                values={{ seller: placed.providerName || t("orders.modal.theSeller"), name: listing.name, phone: details.phone }}
                components={{ strong: <strong /> }}
              />
            </p>
            {payOnline ? (
              <p className="od-pay">
                <Trans
                  i18nKey="orders.modal.onlineReceipt"
                  values={{ amount: formatUgx(placed.total) }}
                  components={{ strong: <strong />, ordersLink: <Link to="/orders" onClick={onClose} /> }}
                />
              </p>
            ) : !isService && placed.total > 0 ? (
              <p className="od-pay">
                <Trans
                  i18nKey={details.method === "pickup" ? "orders.modal.cashReceiptPickup" : "orders.modal.cashReceiptDelivery"}
                  values={{ amount: formatUgx(placed.total) }}
                  components={{ strong: <strong /> }}
                />
              </p>
            ) : null}
            <p className="modal-hint">{t("orders.modal.reference", { ref: String(placed.id).slice(-6).toUpperCase() })}</p>
            <button type="button" className="primary-button" onClick={onClose}>{t("form.done")}</button>
          </div>
        ) : (
          <>
            <h2>{t(!payOnline && isService ? "orders.modal.titleRequest" : "orders.modal.titleOrder", { name: listing.name })}</h2>
            {unitPrice > 0 ? <p className="modal-hint">{isService ? formatUgx(unitPrice) : t("orders.modal.priceEach", { price: formatUgx(unitPrice) })}</p> : null}
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              {!isService ? (
                <label className="field">
                  <span>{t("orders.modal.quantity")}</span>
                  <input type="number" min="1" max="99" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </label>
              ) : null}
              <OrderDetailsFields value={details} onChange={setDetails} delivery={!isService} />

              <div className="od-payline">
                <span className="od-payline-title">{payOnline ? t("orders.modal.payAfterAccept") : isService ? t("orders.modal.noPaymentNow") : t("orders.modal.payCashOnDelivery")}</span>
                <span>
                  {payOnline
                    ? t(total > 0 ? "orders.modal.onlineNote" : "orders.modal.onlineNoteNoTotal", { amount: formatUgx(total) })
                    : isService
                      ? t("orders.modal.serviceNote")
                      : t(`orders.modal.${details.method === "pickup" ? "cashNotePickup" : "cashNoteDelivery"}${total > 0 ? "" : "NoTotal"}`, { amount: formatUgx(total) })}
                </span>
              </div>

              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? t("orders.modal.sending") : payOnline ? t(total > 0 ? "orders.modal.sendRequestAmount" : "orders.modal.sendRequest", { amount: formatUgx(total) }) : isService ? t("orders.modal.sendServiceRequest") : t(total > 0 ? "orders.modal.placeOrderAmount" : "orders.modal.placeOrder", { amount: formatUgx(total) })}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
