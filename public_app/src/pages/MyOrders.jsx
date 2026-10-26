import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { clearSession, getSession } from "../lib/session";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";
import { intlLocale } from "../i18n";
import { ORDER_STATUS } from "../lib/myOrders";
import { openDocumentPdf } from "../lib/documents";
import SiteHeader from "../components/SiteHeader";
import MyBookings from "../components/booking/MyBookings";
import PaymentModal from "../components/PaymentModal";
import { Skel } from "../components/Skeleton";
import { IconBox, IconCheck, IconPin, IconReceipt } from "../components/icons";

const FILTERS = [
  { key: "all" },
  { key: "open" },
  { key: "done" },
  { key: "closed" }
];
const bucket = (order) => (order.status === "fulfilled" ? "done" : ["rejected", "canceled"].includes(order.status) ? "closed" : "open");

const dateLabel = (value) => new Date(value).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });
const orderRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;

function OrderCard({ order, onPaid, phone }) {
  const { t } = useTranslation();
  const statusKey = ORDER_STATUS[order.status] ? order.status : "pending";
  const status = ORDER_STATUS[statusKey];
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "paid_cash";
  const quotes = order.documents.filter((d) => d.type === "quotation");
  const receipts = order.documents.filter((d) => d.type === "receipt");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const online = order.paymentMethod === "online";
  const closed = online && order.paymentStatus === "closed";

  const open = async (doc) => {
    setBusy(doc.id);
    setError("");
    try {
      await openDocumentPdf(doc);
    } catch (e) {
      setError(e.message || t("orders.docOpenFailed"));
    } finally {
      setBusy("");
    }
  };

  const stepKeys = ["placed", online || order.paymentMethod === "mobile_money" ? (paid ? "acceptedPaid" : "accepted") : "accepted", "delivering", paid && order.status === "fulfilled" ? "deliveredPaid" : "completed"];

  return (
    <article className="mo-card">
      <header className="mo-card-head">
        <div className="mo-seller">
          {order.provider.avatarUrl ? <img src={order.provider.avatarUrl} alt="" /> : <span>{order.provider.businessName.slice(0, 1).toUpperCase()}</span>}
          <div>
            <Link to={`/provider/${order.provider.id}`}>{order.provider.businessName}</Link>
            <small>{t("orders.orderRef", { ref: orderRef(order.id) })} · {dateLabel(order.createdAt)}</small>
          </div>
        </div>
        <span className={`mo-chip mo-chip-${status.tone}`}>{t(`orders.status.${statusKey}`)}</span>
      </header>

      {status.step >= 0 ? (
        <ol className="mo-steps" aria-label={t("orders.progress")}>
          {stepKeys.map((stepKey, i) => (
            <li key={stepKey} className={i <= status.step ? "is-done" : ""}>
              <span>{i <= status.step ? <IconCheck width={12} height={12} /> : i + 1}</span>
              {t(`orders.steps.${stepKey}`)}
            </li>
          ))}
        </ol>
      ) : null}

      <ul className="mo-items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span><IconBox width={16} height={16} /> {item.listingId ? <Link to={`/shop/product/${item.listingId}`}>{item.name}</Link> : item.name} <em>× {item.quantity}</em></span>
            <strong>{formatUgx(item.total)}</strong>
          </li>
        ))}
      </ul>

      <div className="mo-pay">
        <div>
          <small>{paid ? t("orders.paid") : t("orders.toPay")}</small>
          <strong>{formatUgx(order.total)}</strong>
        </div>
        {online && order.paymentStatus === "payable" ? (
          <button type="button" className="mo-paynow" onClick={() => setPaying(true)}>{t("orders.payNow")}</button>
        ) : (
          <span className={`mo-chip ${paid ? "mo-chip-green" : "mo-chip-amber"}`}>
            {order.paymentMethod === "mobile_money"
              ? t("orders.paidMobileMoney")
              : online
                ? closed ? t("orders.notCharged") : t("orders.waitingAccept")
                : paid ? t("orders.cashCollected") : order.fulfillment.method === "pickup" ? t("orders.cashOnPickup") : t("orders.cashOnDelivery")}
          </span>
        )}
      </div>
      {online && order.paymentStatus === "payable" ? (
        <p className="mo-where">{t("orders.acceptedPayHint")}</p>
      ) : online && order.paymentStatus === "awaiting_approval" ? (
        <p className="mo-where">{t("orders.awaitingHint")}</p>
      ) : null}
      {order.fulfillment.method === "delivery" && order.fulfillment.address ? (
        <p className="mo-where"><IconPin width={15} height={15} /> {order.fulfillment.address}</p>
      ) : order.fulfillment.method === "pickup" ? (
        <p className="mo-where"><IconPin width={15} height={15} /> {t("orders.pickupNote")}</p>
      ) : null}

      <section className="mo-docs" aria-label={t("orders.docsTitle")}>
        <h3><IconReceipt width={16} height={16} /> {t("orders.docsTitle")}</h3>
        {order.documents.length ? (
          <ul>
            {[...receipts, ...quotes].map((doc) => (
              <li key={doc.id} className={doc.status === "superseded" ? "is-old" : ""}>
                <div>
                  <strong>{doc.type === "receipt" ? t("orders.receipt") : t("orders.quotation")} {doc.number}{doc.revision > 1 ? ` · ${t("orders.revision", { n: doc.revision })}` : ""}</strong>
                  <small>
                    {dateLabel(doc.issuedAt)} · {formatUgx(doc.total)}
                    {doc.status === "superseded" ? ` · ${t("orders.replaced")}` : doc.emailedAt ? ` · ${t("orders.emailedTo", { email: doc.emailedTo })}` : ""}
                  </small>
                </div>
                <button type="button" onClick={() => open(doc)} disabled={busy === doc.id}>{busy === doc.id ? t("orders.opening") : t("orders.viewPdf")}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mo-docs-empty">
            {paid ? t("orders.receiptSoon") : t("orders.quotationSoon")}
          </p>
        )}
        {error ? <p className="mo-error">{error}</p> : null}
      </section>
      {paying ? (
        <PaymentModal
          title={t("orders.payForOrder")}
          summary={`${order.provider.businessName} · ${order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}`}
          amount={Number(order.total)}
          endpoint={`/payments/orders/${encodeURIComponent(order.id)}/pay`}
          defaultPhone={phone}
          onClose={() => setPaying(false)}
          onPaid={onPaid}
        />
      ) : null}
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="mo-card" aria-hidden="true">
      <div className="mo-card-head"><Skel h={44} w={220} r={12} /><Skel h={26} w={110} r={999} /></div>
      <Skel h={14} w="100%" style={{ marginTop: 18 }} />
      <Skel h={14} w="80%" style={{ marginTop: 10 }} />
      <Skel h={54} w="100%" r={12} style={{ marginTop: 18 }} />
    </div>
  );
}

export default function MyOrders() {
  const { t } = useTranslation();
  const location = useLocation();
  const [session, setSession] = useState(() => getSession());
  const [orders, setOrders] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "bookings" ? "bookings" : "orders";
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    request("/engagement/orders/mine?limit=50")
      .then((result) => setOrders(result?.items || []))
      .catch((e) => {
        setOrders([]);
        setError(e.message || t("orders.loadFailed"));
      });
  }, []);

  useEffect(() => {
    document.title = `${t("nav.myOrders")} | Gabla`;
    if (session) load();
  }, [session, load]);

  const logout = () => {
    clearSession();
    setSession(null);
  };

  const shown = (orders || []).filter((o) => filter === "all" || bucket(o) === filter);
  const counts = { all: orders?.length ?? 0, open: 0, done: 0, closed: 0 };
  (orders || []).forEach((o) => {
    counts[bucket(o)] += 1;
  });

  return (
    <main className="home-shell home-themed mo-page">
      <SiteHeader session={session} onLogout={logout} />
      <div className="mo-wrap">
        <header className="mo-title">
          <h1>{tab === "bookings" ? t("orders.myBookings") : t("nav.myOrders")}</h1>
          <p>{tab === "bookings" ? t("orders.bookingsSubtitle") : t("orders.subtitle")}</p>
        </header>

        {!session ? (
          <div className="mo-empty">
            <strong>{t("orders.signInTitle")}</strong>
            <p>{t("orders.signInBody")}</p>
            <Link to={loginPath(location)} className="primary-button">{t("nav.signIn")}</Link>
          </div>
        ) : (
          <>
            <div className="mo-tabs" role="tablist" aria-label={t("orders.tabsLabel")}>
              <button type="button" role="tab" aria-selected={tab === "orders"} className={tab === "orders" ? "is-active" : ""} onClick={() => setSearchParams({})}>{t("orders.tabOrders")}</button>
              <button type="button" role="tab" aria-selected={tab === "bookings"} className={tab === "bookings" ? "is-active" : ""} onClick={() => setSearchParams({ tab: "bookings" })}>{t("orders.tabBookings")}</button>
            </div>
            {tab === "bookings" ? <MyBookings /> : <>
            <div className="mo-filters" role="tablist">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "is-active" : ""} onClick={() => setFilter(f.key)}>
                  {t(`orders.filters.${f.key}`)} <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            {error ? <div className="error-message">{error}</div> : null}
            {orders === null ? (
              <><CardSkeleton /><CardSkeleton /></>
            ) : shown.length ? (
              <div className="mo-list">{shown.map((o) => <OrderCard key={o.id} order={o} onPaid={load} phone={session?.user?.phone || ""} />)}</div>
            ) : (
              <div className="mo-empty">
                <strong>{orders.length ? t("orders.noneHere") : t("orders.noneYet")}</strong>
                <p>{orders.length ? t("orders.tryFilter") : t("orders.noneYetHint")}</p>
                {!orders.length ? <Link to="/shop" className="primary-button">{t("orders.browseShop")}</Link> : null}
              </div>
            )}
            </>}
          </>
        )}
      </div>
    </main>
  );
}
