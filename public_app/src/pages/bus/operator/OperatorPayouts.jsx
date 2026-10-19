import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isUgPhone, normalizeUgPhone, operatorApi, phoneNetwork, ugx } from "../../../lib/bus";
import { Empty, ErrorBox, Field, PageHead, Panel, Skel, StatusChip, digitsOnly, errMsg, thousands, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcCheck, IcClock, IcWallet } from "../../../components/bus/operator/icons";
import { dateTimeLabel } from "../../../components/bus/operator/util";

const MIN = 10000;

export default function OperatorPayouts() {
  const { t } = useTranslation();
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
  const amountError = !touched ? "" : n < MIN ? t("busOp.po.smallest", { amount: ugx(MIN) }) : n > balance ? t("busOp.po.moreThanBalance") : "";
  const phoneError = touched && !isUgPhone(phone) ? t("busOp.po.vPhone") : "";
  const network = phoneNetwork(phone);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (n < MIN || n > balance || !isUgPhone(phone)) return;
    setBusy(true);
    try {
      await operatorApi.post("/payouts", { amount: n, phone: normalizeUgPhone(phone) });
      toast(t("busOp.po.requested"));
      setAmount("");
      setTouched(false);
      await Promise.all([stats.reload(), payouts.reload()]);
    } catch (err) {
      setError(err.code === "BUS_INSUFFICIENT_FUNDS" ? t("busOp.po.insufficient") : errMsg(err));
      stats.reload();
    } finally {
      setBusy(false);
    }
  };

  const items = payouts.data?.items || [];
  const paidTotal = items.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <>
      <PageHead sub={t("busOp.po.sub")} />
      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />

      <div className="bop-payout-top">
        {!s ? <div className="bop-balance" role="status" aria-busy="true" aria-label={t("busOp.po.loadingBalance")}><Skel w="30%" h={12} className="bop-skel-dark" /><Skel w="60%" h={44} r={12} className="bop-skel-dark" style={{ marginTop: 16 }} /><Skel w="45%" h={12} className="bop-skel-dark" style={{ marginTop: 16 }} /></div> : (
          <section className="bop-balance">
            <div className="bop-balance-main">
              <small>{t("busOp.po.available")}</small>
              <strong><em>UGX</em> {Number(s.walletBalance).toLocaleString("en-US")}</strong>
              <p>{t("busOp.po.afterFee", { pct: Number(s.commissionPercent) })}</p>
            </div>
            <dl className="bop-balance-meta">
              <div><dt><IcClock size={14} /> {t("busOp.po.inProgress")}</dt><dd>{ugx(s.pendingPayouts)}</dd></div>
              <div><dt><IcCheck size={14} strokeWidth={3} /> {t("busOp.po.paidOut")}</dt><dd>{ugx(paidTotal)}</dd></div>
              <div><dt><IcWallet size={14} /> {t("busOp.pf.fee")}</dt><dd>{Number(s.commissionPercent)}%</dd></div>
            </dl>
          </section>
        )}
      </div>

      <div className="bop-grid bop-grid-even">
        <Panel title={t("busOp.po.request")} sub={t("busOp.po.minimum", { amount: ugx(MIN) })}>
          <form className="bop-form" onSubmit={submit} noValidate>
            <Field label={t("busOp.po.amount")} error={amountError}>
              <div className="bop-price-input is-lg"><span>UGX</span><input className="bop-input" inputMode="numeric" placeholder="500,000" value={thousands(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} aria-invalid={Boolean(amountError)} /></div>
            </Field>
            {s && balance >= MIN ? (
              <div className="bop-chips">
                {[0.25, 0.5].map((f) => Math.floor(balance * f) >= MIN ? <button type="button" key={f} className="bop-chip" onClick={() => setAmount(String(Math.floor((balance * f) / 1000) * 1000))}>{f * 100}%</button> : null)}
                <button type="button" className="bop-chip is-orange" onClick={() => setAmount(String(Math.floor(balance)))}>{t("busOp.po.withdrawAll")}</button>
              </div>
            ) : null}
            <Field label={t("busOp.po.momoNumber")} error={phoneError} hint={network ? t("busOp.po.networkNumber", { network }) : t("busOp.po.momoHint")}>
              <input className="bop-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(phoneError)} />
            </Field>
            {error ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
            <button type="submit" className="bop-btn bop-btn-primary bop-btn-lg" disabled={busy || !s}>{busy ? t("busOp.po.requesting") : t("busOp.po.requestBtn")}</button>
            {s && balance < MIN ? <p className="bop-hint">{t("busOp.po.needAtLeast", { amount: ugx(MIN) })}</p> : null}
          </form>
        </Panel>

        <Panel title={t("busOp.po.history")} sub={items.length ? t("busOp.po.nPayouts", { count: items.length }) : undefined}>
          <ErrorBox error={payouts.error} onRetry={payouts.refresh} />
          {payouts.loading ? (
            <div className="bop-timeline" role="status" aria-busy="true" aria-label={t("busOp.po.loadingPayouts")}>{[0, 1, 2].map((i) => <div className="bop-tl-item" key={i}><span className="bop-tl-dot" /><div style={{ display: "grid", gap: 8, flex: 1 }}><Skel w="40%" h={16} /><Skel w="70%" h={11} /></div></div>)}</div>
          ) : items.length ? (
            <ol className="bop-timeline">
              {items.map((p) => (
                <li key={p.id} className={`bop-tl-item is-${p.status === "paid" ? "green" : p.status === "rejected" ? "red" : "amber"}`}>
                  <span className="bop-tl-dot" aria-hidden="true" />
                  <div className="bop-tl-body">
                    <div className="bop-tl-top"><strong>{ugx(p.amount)}</strong><StatusChip status={p.status} /></div>
                    <p>{t("busOp.po.toRequested", { phone: p.phone, when: dateTimeLabel(p.createdAt) })}</p>
                    {p.processedAt ? <p>{t("busOp.po.processed", { when: dateTimeLabel(p.processedAt) })}</p> : null}
                    {p.note ? <p className="bop-tl-note">{p.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : <Empty compact icon={<IcWallet size={24} />} title={t("busOp.po.none")}>{t("busOp.po.noneHint")}</Empty>}
        </Panel>
      </div>
    </>
  );
}
