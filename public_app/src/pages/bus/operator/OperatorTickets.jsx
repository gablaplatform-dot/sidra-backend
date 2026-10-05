import React, { useCallback, useEffect, useRef, useState } from "react";

import { eatDateTimeLabel, eatTime, operatorApi } from "../../../lib/bus";
import { IconCheck, IconQr } from "../../../components/icons";
import { PageHead, errMsg, useOperator } from "../../../components/bus/operator/ui";

// GBT-XXXX-XXXX, typed or pasted in any shape.
export const formatTicket = (value) => {
  let raw = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if ("GBT".startsWith(raw)) return raw === "GBT" ? "GBT-" : raw;
  if (raw.startsWith("GBT")) raw = raw.slice(3);
  raw = raw.slice(0, 8);
  return `GBT-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ""}`;
};
const TICKET_RE = /GBT-?[A-Z0-9]{4}-?[A-Z0-9]{4}/i;
const isComplete = (v) => /^GBT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v);

export default function OperatorTickets() {
  const { toast } = useOperator();
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  const remember = (res) => setHistory((h) => [{ ...res, at: Date.now() }, ...h.filter((x) => x.ticketNumber !== res.ticketNumber)].slice(0, 8));

  const verify = useCallback(async (code) => {
    const ticketNumber = formatTicket(code);
    if (!ticketNumber) { setError("Enter the ticket number from the passenger’s ticket."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await operatorApi.post("/tickets/verify", { ticketNumber });
      setResult({ ...res, ticketNumber: res.ticketNumber || ticketNumber, queried: ticketNumber });
      remember(res.ticketNumber ? res : { ...res, ticketNumber });
    } catch (e) {
      setResult(null);
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const checkIn = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await operatorApi.post("/tickets/check-in", { ticketNumber: result.ticketNumber });
      setResult({ ...res, queried: result.queried });
      remember(res);
      if (res.valid) toast(`${res.passengerName} checked in`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setResult(null); setValue(""); setError(""); inputRef.current?.focus(); };

  // ---- camera (only when the browser can detect QR codes natively)
  const stopScan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);
  useEffect(() => stopScan, [stopScan]);

  useEffect(() => {
    if (!scanning) return undefined;
    let cancelled = false;
    let timer;
    (async () => {
      try {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            const text = codes[0]?.rawValue || "";
            if (text) {
              const match = text.match(TICKET_RE);
              const code = formatTicket(match ? match[0] : text);
              if (isComplete(code)) {
                stopScan();
                setValue(code);
                verify(code);
                return;
              }
            }
          } catch { /* keep scanning */ }
          timer = setTimeout(tick, 350);
        };
        tick();
      } catch (e) {
        setScanError(e?.name === "NotAllowedError" ? "Camera permission was denied. Type the ticket number instead." : "Couldn’t open the camera. Type the ticket number instead.");
        stopScan();
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [scanning, stopScan, verify]);

  const tone = !result ? "" : result.checkedIn ? "is-ok" : result.valid ? "is-ok" : "is-bad";

  return (
    <>
      <PageHead title="Verify tickets" sub="Type the ticket number or scan the QR code, then check the passenger in." />
      <div className="bop-verify">
        <section className="bus-card bop-verify-card">
          <form onSubmit={(e) => { e.preventDefault(); verify(value); }}>
            <label className="bus-label" htmlFor="ticket-number">Ticket number</label>
            <input id="ticket-number" ref={inputRef} className="bop-ticket-input" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck="false" inputMode="text" placeholder="GBT-XXXX-XXXX" value={value} onChange={(e) => { const f = formatTicket(e.target.value); setValue(f === "GBT-" && e.target.value.length < value.length ? "" : f); setError(""); }} />
            <div className="bop-verify-actions">
              <button type="submit" className="bus-btn bus-btn-primary" disabled={busy || !value}>{busy && !result?.valid ? "Checking…" : "Verify ticket"}</button>
              {canScan ? <button type="button" className="bus-btn bus-btn-light" onClick={() => { setScanError(""); scanning ? stopScan() : setScanning(true); }}><IconQr width={18} height={18} /> {scanning ? "Stop camera" : "Scan QR code"}</button> : null}
            </div>
            {!canScan ? <small className="bus-hint">Camera scanning isn’t supported in this browser, so please type the number.</small> : null}
            {scanError ? <div className="bus-alert bus-alert-warn" style={{ marginTop: 12 }}>{scanError}</div> : null}
          </form>
          {scanning ? <div className="bop-scanner"><video ref={videoRef} playsInline muted /><span className="bop-scan-frame" /></div> : null}
          {error ? <div className="bus-alert bus-alert-error" style={{ marginTop: 14 }} role="alert">{error}</div> : null}
        </section>

        {result ? (
          <section className={`bop-result ${tone}`} role="status" aria-live="polite">
            <div className="bop-result-badge">
              {result.valid ? <IconCheck width={34} height={34} strokeWidth={3} /> : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>}
              <strong>{result.checkedIn ? "CHECKED IN" : result.valid ? "VALID" : "INVALID"}</strong>
            </div>
            <p className="bop-result-msg">{result.message}</p>
            {result.passengerName ? (
              <dl className="bop-result-facts">
                <div><dt>Passenger</dt><dd>{result.passengerName}</dd></div>
                <div><dt>Seat</dt><dd>{result.seatNumber}</dd></div>
                <div><dt>Ticket</dt><dd>{result.ticketTypeName}</dd></div>
                <div><dt>Route</dt><dd>{result.route}</dd></div>
                <div><dt>Departs</dt><dd>{eatDateTimeLabel(result.departureAt)}</dd></div>
                <div><dt>Ticket no.</dt><dd><code>{result.ticketNumber}</code></dd></div>
                {result.checkedInAt ? <div><dt>Checked in</dt><dd>{eatTime(result.checkedInAt)}</dd></div> : null}
              </dl>
            ) : null}
            <div className="bop-result-actions">
              {result.valid && !result.checkedIn ? <button className="bus-btn bus-btn-primary bop-big" onClick={checkIn} disabled={busy}>{busy ? "Checking in…" : "Check in passenger"}</button> : null}
              <button className="bus-btn bus-btn-light" onClick={reset}>Next ticket</button>
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section className="bus-card bop-panel">
            <header className="bop-panel-head"><div><h2>Recent checks</h2><p>This session only</p></div></header>
            <ul className="bop-list">
              {history.map((h) => (
                <li key={h.ticketNumber + h.at}>
                  <button type="button" className="bop-list-row" onClick={() => { setValue(h.ticketNumber); verify(h.ticketNumber); }}>
                    <span className={`bop-dot ${h.valid ? "is-ok" : "is-bad"}`} />
                    <span className="bop-list-main"><strong>{h.passengerName || "Unknown ticket"}</strong><small><code>{h.ticketNumber}</code>{h.seatNumber ? ` · Seat ${h.seatNumber}` : ""}</small></span>
                    <span className={`bus-chip ${h.checkedIn ? "bus-chip-green" : h.valid ? "bus-chip-orange" : "bus-chip-red"}`}>{h.checkedIn ? "Checked in" : h.valid ? "Valid" : "Invalid"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
