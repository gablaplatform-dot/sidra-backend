import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Skel } from "../../Skeleton";
import { uploadFile } from "../../../lib/storage";
import { request } from "../../../lib/api";

// Small building blocks shared by the bus-company onboarding, login and portal screens.

// ------------------------------------------------------------------ contexts
export const OperatorContext = createContext(null);
export const useOperator = () => useContext(OperatorContext);

// ------------------------------------------------------------------ icons not in the shared set
const ico = (children) => (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
);
export const IconPlus = ico(<path d="M12 5v14M5 12h14" />);
export const IconMinus = ico(<path d="M5 12h14" />);
export const IconChevronRight = ico(<polyline points="9 6 15 12 9 18" />);
export const IconChevronDown = ico(<polyline points="6 9 12 15 18 9" />);
export const IconLogout = ico(<><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" /><polyline points="16 8 20 12 16 16" /><path d="M20 12H9" /></>);
export const IconEdit = ico(<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5l3 3" /></>);
export const IconTrash = ico(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" /></>);
export const IconPrint = ico(<><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /></>);
export const IconHome = ico(<><path d="M4 11l8-6.5 8 6.5" /><path d="M6 10v9h12v-9" /></>);
export const IconExternal = ico(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></>);
export const IconPause = ico(<><path d="M8 5v14M16 5v14" /></>);
export const IconPlay = ico(<polygon points="7 4 19 12 7 20" />);
export const IconAlert = ico(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></>);
export const IconSearchLite = ico(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.2-4.2" /></>);
export const IconGoogle = (props) => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

// ------------------------------------------------------------------ helpers
export const errMsg = (e, fallback = "Something went wrong. Please try again.") => {
  if (e && e.status === 429) return "Too many requests right now. Please wait a minute and try again.";
  return (e && e.message) || fallback;
};

export const digitsOnly = (v) => String(v ?? "").replace(/[^\d]/g, "");
export const thousands = (v) => {
  const d = digitsOnly(v);
  return d ? Number(d).toLocaleString("en-US") : "";
};

export const compactUgx = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
};

// "07:30" -> "07:30 AM"
export const timeLabel = (hhmm) => {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Monday-first week, but values are JS weekdays (0 = Sunday) like the backend expects.
export const WEEK = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" }, { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" }
];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const daysLabel = (days = []) => {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEK.filter((d) => set.has(d.v)).map((d) => d.l).join(", ") || "No days";
};

export function DayChips({ value = [], onChange, readOnly = false }) {
  const set = new Set(value);
  const all = set.size === 7;
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="bop-days" role="group" aria-label="Days of the week">
      {WEEK.map((d) => (
        <button key={d.v} type="button" className={`bop-day-chip ${set.has(d.v) ? "is-on" : ""}`} aria-pressed={set.has(d.v)} disabled={readOnly} onClick={() => toggle(d.v)}>
          {d.l}
        </button>
      ))}
      {!readOnly ? (
        <button type="button" className={`bop-day-chip is-all ${all ? "is-on" : ""}`} onClick={() => onChange(all ? [] : ALL_DAYS)}>
          Every day
        </button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ data loading
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback((silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    return fn()
      .then((data) => {
        if (id === seq.current) setState({ data, loading: false, error: null });
        return data;
      })
      .catch((error) => {
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: () => run(true), refresh: () => run(false), setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ------------------------------------------------------------------ loading + state blocks
export const ListSkel = ({ rows = 5, h = 70 }) => (
  <div className="bop-skel-list" role="status" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div className="bus-card bop-skel-row" key={i} style={{ minHeight: h }}>
        <Skel w={46} h={46} r={14} />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <Skel w="45%" h={14} />
          <Skel w="75%" h={11} />
        </div>
        <Skel w={70} h={26} r={999} />
      </div>
    ))}
  </div>
);

export const CardsSkel = ({ count = 4 }) => (
  <div className="bop-kpis" role="status" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <div className="bus-card bop-kpi" key={i}>
        <Skel w="50%" h={11} />
        <Skel w="70%" h={26} style={{ marginTop: 12 }} />
        <Skel w="40%" h={10} style={{ marginTop: 10 }} />
      </div>
    ))}
  </div>
);

export function ErrorBox({ error, onRetry, className = "" }) {
  if (!error) return null;
  return (
    <div className={`bus-alert bus-alert-error bop-errorbox ${className}`} role="alert">
      <span>{errMsg(error)}</span>
      {onRetry ? <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export const Empty = ({ icon, title, children, action }) => (
  <div className="bus-card bus-empty bop-empty">
    {icon ? <span className="bop-empty-icon">{icon}</span> : null}
    <strong>{title}</strong>
    {children ? <p>{children}</p> : null}
    {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
  </div>
);

export const PageHead = ({ title, sub, actions }) => (
  <div className="bop-pagehead">
    <div>
      <h1>{title}</h1>
      {sub ? <p>{sub}</p> : null}
    </div>
    {actions ? <div className="bop-pagehead-actions">{actions}</div> : null}
  </div>
);

export const Field = ({ label, hint, error, children, className = "" }) => (
  <label className={`bus-field bop-field ${className}`}>
    {label ? <span>{label}</span> : null}
    {children}
    {error ? <em className="bop-field-error">{error}</em> : hint ? <small className="bus-hint">{hint}</small> : null}
  </label>
);

export const StatusChip = ({ status }) => {
  const map = {
    scheduled: ["Scheduled", "bus-chip-orange"], departed: ["Departed", "bus-chip-amber"], completed: ["Completed", ""], cancelled: ["Cancelled", "bus-chip-red"],
    confirmed: ["Confirmed", "bus-chip-green"], refund_due: ["Refund pending", "bus-chip-amber"], valid: ["Not boarded", "bus-chip-orange"], used: ["Checked in", "bus-chip-green"],
    requested: ["Pending", "bus-chip-amber"], paid: ["Paid", "bus-chip-green"], rejected: ["Rejected", "bus-chip-red"], active: ["Active", "bus-chip-green"], paused: ["Paused", "bus-chip-amber"],
    pending_payment: ["Awaiting payment", "bus-chip-amber"], expired: ["Expired", ""], failed: ["Failed", "bus-chip-red"]
  };
  const [label, cls] = map[status] || [status, ""];
  return <span className={`bus-chip ${cls}`}>{label}</span>;
};

// ------------------------------------------------------------------ dialogs
export function Modal({ title, subtitle, onClose, children, footer, size = "md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="bop-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bop-modal bop-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="bop-modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="bop-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="bop-modal-body">{children}</div>
        {footer ? <footer className="bop-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Confirm({ title, children, confirmLabel = "Confirm", danger = false, busy = false, error, onConfirm, onCancel, cancelLabel = "Keep as is" }) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="bus-btn bus-btn-light" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`bus-btn ${danger ? "bus-btn-danger" : "bus-btn-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </>
      }
    >
      <div className="bop-confirm-text">{children}</div>
      {error ? <div className="bus-alert bus-alert-error" style={{ marginTop: 12 }} role="alert">{errMsg(error)}</div> : null}
    </Modal>
  );
}

export function Pager({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="bop-pager">
      <button type="button" className="bus-btn bus-btn-light bus-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="bus-btn bus-btn-light bus-btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

// ------------------------------------------------------------------ toasts
export function useToasts() {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);
  const view = (
    <div className="bop-toasts" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`bop-toast is-${t.tone}`}>{t.message}</div>)}
    </div>
  );
  return [push, view];
}

// ------------------------------------------------------------------ image upload
// Signed-in operator: the normal storage upload. During onboarding (no session yet) the invitation
// token authorises the upload instead.
export const uploadOperatorImage = (file) => uploadFile(file, "bus-operators", { register: false });

export const uploadOnboardingImage = async (file, token) => {
  const upload = await request("/bus/onboarding/upload-url", {
    method: "POST",
    body: JSON.stringify({ token, contentType: file.type, filename: file.name })
  });
  const put = await fetch(upload.uploadUrl, { method: upload.method || "PUT", headers: upload.headers || { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("Unable to upload the image");
  if (!upload.publicUrl) throw new Error("Storage is not configured");
  return upload.publicUrl;
};

export function ImageField({ label, value, onChange, uploader, kind = "logo", hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLink, setShowLink] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("That image is too large. Please choose one under 6 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onChange(await uploader(file));
    } catch (err) {
      setError(`${errMsg(err, "Upload failed").replace(/[.!]*$/, ".")} You can skip this for now, or paste an image link instead.`);
      setShowLink(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bop-imgfield is-${kind}`}>
      {label ? <span className="bop-imgfield-label">{label}</span> : null}
      <div className="bop-imgfield-row">
        <div className="bop-imgfield-preview" style={value && kind === "cover" ? { backgroundImage: `url(${value})` } : undefined}>
          {value && kind === "logo" ? <img src={value} alt="" /> : !value ? <span>{kind === "logo" ? "Logo" : "Cover"}</span> : null}
        </div>
        <div className="bop-imgfield-actions">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
          <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : value ? "Change image" : "Upload image"}
          </button>
          {value ? <button type="button" className="bus-btn bus-btn-sm bop-linkbtn" onClick={() => onChange("")}>Remove</button> : null}
          <button type="button" className="bop-linkbtn" onClick={() => setShowLink((s) => !s)}>{showLink ? "Hide link" : "Use a link"}</button>
        </div>
      </div>
      {showLink ? <input className="bus-input" type="url" placeholder="https://…" value={value || ""} onChange={(e) => onChange(e.target.value.trim())} /> : null}
      {hint && !error ? <small className="bus-hint">{hint}</small> : null}
      {error ? <small className="bop-field-error">{error}</small> : null}
    </div>
  );
}
