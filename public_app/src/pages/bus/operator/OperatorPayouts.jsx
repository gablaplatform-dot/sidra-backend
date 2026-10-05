import React, { useEffect, useState } from "react";

import { eatDateTimeLabel, isUgPhone, normalizeUgPhone, operatorApi, phoneNetwork, ugx } from "../../../lib/bus";
import { Empty, ErrorBox, Field, PageHead, Panel, Skel, StatusChip, digitsOnly, errMsg, thousands, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcCheck, IcClock, IcWallet } from "../../../components/bus/operator/icons";

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

  const items = payouts.data?.items || [];
  const paidTotal = items.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <>
      <PageHead sub="Withdraw your ticket sales to mobile money." />
      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />

      <div className="bop-payout-top">
        {!s ? <div className="bop-balance" role="status" aria-busy="true" aria-label="Loading balance"><Skel w="30%" h={12} className="bop-skel-dark" /><Skel w="60%" h={44} r={12} className="bop-skel-dark" style={{ marginTop: 16 }} /><Skel w="45%" h={12} className="bop-skel-dark" style={{ marginTop: 16 }} /></div> : (
          <section className="bop-balance">
            <div className="bop-balance-main">
              <small>Available to withdraw</small>
              <strong><em>UGX</em> {Number(s.walletBalance).toLocaleString("en-US")}</strong>
              <p>Your ticket sales after Gabla’s {Number(s.commissionPercent)}% fee.</p>
            </div>
            <dl className="bop-balance-meta">
              <div><dt><IcClock size={14} /> In progress</dt><dd>{ugx(s.pendingPayouts)}</dd></div>
              <div><dt><IcCheck size={14} strokeWidth={3} /> Paid out</dt><dd>{ugx(paidTotal)}</dd></div>
              <div><dt><IcWallet size={14} /> Gabla fee</dt><dd>{Number(s.commissionPercent)}%</dd></div>
            </dl>
          </section>
        )}
      </div>

      <div className="bop-grid bop-grid-even">
        <Panel title="Request a payout" sub={`Minimum ${ugx(MIN)}. Sent to your mobile money.`}>
          <form className="bop-form" onSubmit={submit} noValidate>
            <Field label="Amount (UGX)" error={amountError}>
              <div className="bop-price-input is-lg"><span>UGX</span><input className="bop-input" inputMode="numeric" placeholder="500,000" value={thousands(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} aria-invalid={Boolean(amountError)} /></div>
            </Field>
            {s && balance >= MIN ? (
              <div className="bop-chips">
                {[0.25, 0.5].map((f) => Math.floor(balance * f) >= MIN ? <button type="button" key={f} className="bop-chip" onClick={() => setAmount(String(Math.floor((balance * f) / 1000) * 1000))}>{f * 100}%</button> : null)}
                <button type="button" className="bop-chip is-orange" onClick={() => setAmount(String(Math.floor(balance)))}>Withdraw everything</button>
              </div>
            ) : null}
            <Field label="Mobile money number" error={phoneError} hint={network ? `${network} number` : "MTN Mobile Money or Airtel Money"}>
              <input className="bop-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(phoneError)} />
            </Field>
            {error ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
            <button type="submit" className="bop-btn bop-btn-primary bop-btn-lg" disabled={busy || !s}>{busy ? "Requesting…" : "Request payout"}</button>
            {s && balance < MIN ? <p className="bop-hint">You need at least {ugx(MIN)} available to request a payout.</p> : null}
          </form>
        </Panel>

        <Panel title="Payout history" sub={items.length ? `${items.length} payout${items.length === 1 ? "" : "s"}` : undefined}>
          <ErrorBox error={payouts.error} onRetry={payouts.refresh} />
          {payouts.loading ? (
            <div className="bop-timeline" role="status" aria-busy="true" aria-label="Loading payouts">{[0, 1, 2].map((i) => <div className="bop-tl-item" key={i}><span className="bop-tl-dot" /><div style={{ display: "grid", gap: 8, flex: 1 }}><Skel w="40%" h={16} /><Skel w="70%" h={11} /></div></div>)}</div>
          ) : items.length ? (
            <ol className="bop-timeline">
              {items.map((p) => (
                <li key={p.id} className={`bop-tl-item is-${p.status === "paid" ? "green" : p.status === "rejected" ? "red" : "amber"}`}>
                  <span className="bop-tl-dot" aria-hidden="true" />
                  <div className="bop-tl-body">
                    <div className="bop-tl-top"><strong>{ugx(p.amount)}</strong><StatusChip status={p.status} /></div>
                    <p>To {p.phone} · requested {eatDateTimeLabel(p.createdAt)}</p>
                    {p.processedAt ? <p>Processed {eatDateTimeLabel(p.processedAt)}</p> : null}
                    {p.note ? <p className="bop-tl-note">{p.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : <Empty compact icon={<IcWallet size={24} />} title="No payouts yet">Requested payouts and their status show here.</Empty>}
        </Panel>
      </div>
    </>
  );
}
