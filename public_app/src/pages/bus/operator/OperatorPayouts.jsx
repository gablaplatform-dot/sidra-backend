import React, { useEffect, useState } from "react";

import { eatDateTimeLabel, isUgPhone, normalizeUgPhone, operatorApi, phoneNetwork, ugx } from "../../../lib/bus";
import { IconWallet } from "../../../components/icons";
import { CardsSkel, Empty, ErrorBox, Field, ListSkel, PageHead, StatusChip, digitsOnly, errMsg, thousands, useLoad, useOperator } from "../../../components/bus/operator/ui";

const MIN = 10000;

export default function OperatorPayouts() {
  const { operator, toast } = useOperator();
  const stats = useLoad(() => operatorApi.get("/stats"), []);
  const payouts = useLoad(() => operatorApi.get("/payouts"), []);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(operator.contactPhone || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const s = stats.data;
  const balance = Number(s?.walletBalance || 0);
  useEffect(() => { if (!phone && operator.contactPhone) setPhone(operator.contactPhone); }, [operator.contactPhone, phone]);

  const n = Number(amount) || 0;
  const amountError = !touched ? "" : n < MIN ? `The smallest payout is ${ugx(MIN)}.` : n > balance ? "That’s more than your available balance." : "";
  const phoneError = touched && !isUgPhone(phone) ? "Enter a valid MTN or Airtel number, like 0772 123 456." : "";
  const network = phoneNetwork(phone);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (n < MIN || n > balance || !isUgPhone(phone)) return;
    setBusy(true);
    try {
      await operatorApi.post("/payouts", { amount: n, phone: normalizeUgPhone(phone) });
      toast("Payout requested. Gabla will send it to your mobile money.");
      setAmount("");
      setTouched(false);
      await Promise.all([stats.reload(), payouts.reload()]);
    } catch (err) {
      setError(err.code === "BUS_INSUFFICIENT_FUNDS" ? "That’s more than your available balance right now. Refresh and try a smaller amount." : errMsg(err));
      stats.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Payouts" sub="Withdraw your ticket sales to mobile money." />
      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />
      {!s ? <CardsSkel count={3} /> : (
        <div className="bop-kpis bop-kpis-3">
          <div className="bus-card bop-kpi is-navy"><small>Available to withdraw</small><strong>{ugx(s.walletBalance)}</strong><span>Your sales after Gabla’s fee</span></div>
          <div className="bus-card bop-kpi"><small>Payouts pending</small><strong>{ugx(s.pendingPayouts)}</strong><span>Waiting for Gabla to send</span></div>
          <div className="bus-card bop-kpi"><small>Gabla fee</small><strong>{Number(s.commissionPercent)}%</strong><span>Taken from each ticket sold</span></div>
        </div>
      )}

      <div className="bop-two">
        <form className="bus-card bop-panel" onSubmit={submit} noValidate>
          <header className="bop-panel-head"><div><h2>Request a payout</h2><p>Minimum {ugx(MIN)}</p></div></header>
          <div className="bop-form">
            <Field label="Amount (UGX)" error={amountError}>
              <input className="bus-input" inputMode="numeric" placeholder="e.g. 500,000" value={thousands(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} aria-invalid={Boolean(amountError)} />
            </Field>
            <div className="bop-chips">
              {s && balance >= MIN ? <button type="button" className="bus-chip" onClick={() => setAmount(String(Math.floor(balance)))}>Withdraw everything</button> : null}
            </div>
            <Field label="Mobile money number" error={phoneError} hint={network ? `${network} number` : "MTN Mobile Money or Airtel Money"}>
              <input className="bus-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(phoneError)} />
            </Field>
            {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
            <button type="submit" className="bus-btn bus-btn-primary" disabled={busy || !s}>{busy ? "Requesting…" : "Request payout"}</button>
            {s && balance < MIN ? <p className="bus-hint">You need at least {ugx(MIN)} available to request a payout.</p> : null}
          </div>
        </form>

        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>Payout history</h2></div></header>
          <ErrorBox error={payouts.error} onRetry={payouts.refresh} />
          {payouts.loading ? <ListSkel rows={3} h={60} /> : payouts.data.items.length ? (
            <ul className="bop-list">
              {payouts.data.items.map((p) => (
                <li key={p.id}>
                  <div className="bop-list-row">
                    <span className="bop-list-main"><strong>{ugx(p.amount)}</strong><small>To {p.phone} · {eatDateTimeLabel(p.createdAt)}</small>{p.note ? <small>Note: {p.note}</small> : null}</span>
                    <StatusChip status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<IconWallet width={26} height={26} />} title="No payouts yet">Requested payouts and their status show here.</Empty>}
        </section>
      </div>
    </>
  );
}
