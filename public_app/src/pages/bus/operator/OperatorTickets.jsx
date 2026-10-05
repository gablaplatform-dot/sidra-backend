import React, { useCallback, useEffect, useRef, useState } from "react";

import { eatDateTimeLabel, eatTime, operatorApi } from "../../../lib/bus";
import { Chip, Panel, errMsg, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcArrowRight, IcCamera, IcCheck, IcClose, IcScan, IcTicket } from "../../../components/bus/operator/icons";
import { barcodeBars, timeAgo, useNow } from "../../../components/bus/operator/util";

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

const HISTORY_KEY = "gabla_bop_checks";
const readHistory = () => {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
};
const writeHistory = (list) => {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
};
const buzz = (pattern) => {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
};

function Barcode({ value }) {
  const bars = barcodeBars(value, 42);
  let x = 0;
  const rects = bars.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w * 1.5} height="46" /> : null;
    x += w * 1.5 + 1.5;
    return r;
  });
  return <svg className="bop-barcode" viewBox={`0 0 ${x} 46`} preserveAspectRatio="none" aria-hidden="true" fill="currentColor">{rects}</svg>;
}

function ResultTicket({ result, busy, onCheckIn, onNext }) {
  const ok = Boolean(result.valid);
  const checkedIn = Boolean(result.checkedIn);
  const tone = ok ? "ok" : "bad";
  const [from, to] = (result.route || "").split(/\s+(?:-|to|→)\s+/i);
  return (
    <section className={`bop-result is-${tone} ${checkedIn ? "is-in" : ""}`} role="status" aria-live="polite">
      <div className="bop-result-head">
        <span className="bop-result-badge">{ok ? <IcCheck size={30} strokeWidth={3} /> : <IcClose size={30} strokeWidth={3} />}</span>
        <div>
          <strong>{checkedIn ? "CHECKED IN" : ok ? "VALID" : "INVALID"}</strong>
          <p>{result.message}</p>
        </div>
      </div>

      {result.passengerName ? (
        <div className="bop-result-body">
          <div className="bop-result-route">
            <div><small>From</small><strong>{from || result.route}</strong></div>
            {to ? <><span className="bop-result-arrow" aria-hidden="true"><IcArrowRight size={20} /></span><div className="is-end"><small>To</small><strong>{to}</strong></div></> : null}
          </div>
          <dl className="bop-result-facts">
            <div><dt>Passenger</dt><dd>{result.passengerName}</dd></div>
            <div><dt>Seat</dt><dd className="is-seat">{result.seatNumber}</dd></div>
            <div><dt>Ticket type</dt><dd>{result.ticketTypeName}</dd></div>
            <div><dt>Departs</dt><dd>{eatDateTimeLabel(result.departureAt)}</dd></div>
            {result.checkedInAt ? <div><dt>Checked in</dt><dd>{eatTime(result.checkedInAt)}</dd></div> : null}
          </dl>
        </div>
      ) : null}

      <div className="bop-perf" aria-hidden="true"><i /><span /><i /></div>
      <div className="bop-result-stub">
        {result.ticketNumber ? <><Barcode value={result.ticketNumber} /><code>{result.ticketNumber}</code></> : <code>{result.queried}</code>}
      </div>

      <div className="bop-result-actions">
        {ok && !checkedIn ? <button className="bop-btn bop-btn-primary bop-btn-lg" onClick={onCheckIn} disabled={busy}>{busy ? "Checking in…" : "Check in passenger"}</button> : null}
        <button className={`bop-btn bop-btn-lg ${ok && !checkedIn ? "bop-btn-light" : "bop-btn-navy"}`} onClick={onNext}>Next ticket</button>
      </div>
    </section>
  );
}

export default function OperatorTickets() {
  const { toast } = useOperator();
  const now = useNow(20000);
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(readHistory);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const resultRef = useRef(null);
  const lastAuto = useRef("");
  const cameraMode = useRef(false);
  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  const remember = (res) => setHistory((h) => {
    const next = [{ ticketNumber: res.ticketNumber, passengerName: res.passengerName, seatNumber: res.seatNumber, valid: res.valid, checkedIn: res.checkedIn, route: res.route, at: Date.now() }, ...h.filter((x) => x.ticketNumber !== res.ticketNumber)].slice(0, 12);
    writeHistory(next);
    return next;
  });

  const verify = useCallback(async (code) => {
    const ticketNumber = formatTicket(code);
    if (!ticketNumber) { setError("Enter the ticket number from the passenger’s ticket."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await operatorApi.post("/tickets/verify", { ticketNumber });
      const full = { ...res, ticketNumber: res.ticketNumber || ticketNumber, queried: ticketNumber };
      setResult(full);
      remember(full);
      buzz(res.valid ? 40 : [90, 50, 90]);
    } catch (e) {
      setResult(null);
      setError(errMsg(e));
      buzz([90, 50, 90]);
    } finally {
      setBusy(false);
    }
  }, []);

  const checkIn = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await operatorApi.post("/tickets/check-in", { ticketNumber: result.ticketNumber });
      const full = { ...res, ticketNumber: res.ticketNumber || result.ticketNumber, queried: result.queried };
      setResult(full);
      remember(full);
      if (res.valid) { toast(`${res.passengerName} checked in`); buzz([40, 40, 40]); }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    stopScan();
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const reset = () => {
    setResult(null);
    setValue("");
    setError("");
    lastAuto.current = "";
    if (cameraMode.current && canScan) setScanning(true);
    else requestAnimationFrame(() => inputRef.current?.focus());
  };

  // A complete ticket number verifies itself (it is read-only), so gate staff can just scan or paste.
  const onType = (raw) => {
    const f = formatTicket(raw);
    const next = f === "GBT-" && raw.length < value.length ? "" : f;
    setValue(next);
    setError("");
    if (isComplete(next) && lastAuto.current !== next) {
      lastAuto.current = next;
      setResult(null);
      verify(next);
    }
    if (!isComplete(next)) lastAuto.current = "";
  };

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
                lastAuto.current = code;
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

  return (
    <div className="bop-verify">
      <div className="bop-verify-main">
        {!result ? (
        <section className="bop-card bop-scanner">
          <div className={`bop-viewfinder ${scanning ? "is-live" : ""} ${busy && !result ? "is-busy" : ""}`}>
            {scanning ? <video ref={videoRef} playsInline muted /> : (
              <div className="bop-viewfinder-idle"><IcScan size={44} strokeWidth={1.5} /></div>
            )}
            <i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" />
            <span className="bop-scanline" />
          </div>
          <div className="bop-scanner-copy">
            <h2>{scanning ? "Point the camera at the QR code" : "Verify a ticket"}</h2>
            <p>{scanning ? "It reads automatically as soon as the code is in the frame." : "Type or paste the ticket number. It checks itself when complete."}</p>
          </div>
          {canScan ? (
            <button type="button" className={`bop-btn ${scanning ? "bop-btn-ghost-light" : "bop-btn-primary"} bop-scanner-cam`} onClick={() => { setScanError(""); if (scanning) { cameraMode.current = false; stopScan(); } else { cameraMode.current = true; setScanning(true); } }}>
              <IcCamera size={19} /> {scanning ? "Stop camera" : "Scan QR code"}
            </button>
          ) : null}

          <form className="bop-scanner-form" onSubmit={(e) => { e.preventDefault(); lastAuto.current = formatTicket(value); verify(value); }}>
            <label htmlFor="ticket-number">Ticket number</label>
            <div className="bop-ticketinput">
              <IcTicket size={22} />
              <input id="ticket-number" ref={inputRef} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck="false" inputMode="text" enterKeyHint="go" placeholder="GBT-XXXX-XXXX" value={value} onChange={(e) => onType(e.target.value)} aria-describedby="ticket-hint" />
              {value ? <button type="button" className="bop-ticketinput-clear" onClick={reset} aria-label="Clear"><IcClose size={16} /></button> : null}
            </div>
            <button type="submit" className="bop-btn bop-btn-navy bop-btn-lg bop-btn-block" disabled={busy || !value}>{busy && !result ? "Checking…" : "Verify ticket"}</button>
            <small id="ticket-hint" className="bop-hint">{canScan ? "Use the camera for QR codes, or type the number printed under the code." : "Camera scanning isn’t supported in this browser, so please type the number."}</small>
          </form>
          {scanError ? <div className="bop-alert is-warn" style={{ margin: "0 20px 20px" }}><IcAlert size={17} /><span>{scanError}</span></div> : null}
          {error ? <div className="bop-alert is-error" style={{ margin: "0 20px 20px" }} role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
        </section>
        ) : null}

        <div ref={resultRef} className="bop-result-wrap">
          {busy && !result ? (
            <div className="bop-card bop-result-skel" role="status" aria-busy="true" aria-label="Checking ticket"><span className="skel" style={{ height: 76, borderRadius: 18 }} /><span className="skel" style={{ height: 14, width: "60%" }} /><span className="skel" style={{ height: 14, width: "40%" }} /></div>
          ) : null}
          {result ? <ResultTicket result={result} busy={busy} onCheckIn={checkIn} onNext={reset} /> : null}
        </div>
      </div>

      <Panel className="bop-recent" title="Recent checks" sub={history.length ? "This browser session" : "Tickets you check will be listed here"} action={history.length ? <button type="button" className="bop-linkbtn" onClick={() => { setHistory([]); writeHistory([]); }}>Clear</button> : null}>
        {history.length ? (
          <ul className="bop-recent-list">
            {history.map((h) => (
              <li key={h.ticketNumber + h.at}>
                <button type="button" className="bop-recent-row" onClick={() => { setValue(h.ticketNumber); lastAuto.current = h.ticketNumber; verify(h.ticketNumber); }}>
                  <span className={`bop-recent-ico ${h.checkedIn ? "is-in" : h.valid ? "is-ok" : "is-bad"}`}>{h.valid ? <IcCheck size={16} strokeWidth={3} /> : <IcClose size={16} strokeWidth={3} />}</span>
                  <span className="bop-feed-main"><strong>{h.passengerName || "Unknown ticket"}</strong><small><code>{h.ticketNumber}</code>{h.seatNumber ? ` · Seat ${h.seatNumber}` : ""}</small></span>
                  <span className="bop-feed-end"><Chip tone={h.checkedIn ? "green" : h.valid ? "blue" : "red"}>{h.checkedIn ? "Checked in" : h.valid ? "Valid" : "Invalid"}</Chip><small>{timeAgo(h.at, now)}</small></span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bop-recent-empty"><span className="bop-tile is-blue"><IcTicket size={20} /></span><p>Nothing checked yet. Scan or type a ticket number to begin.</p></div>
        )}
      </Panel>
    </div>
  );
}
