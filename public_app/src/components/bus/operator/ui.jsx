import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Skel } from "../../Skeleton";
import { uploadFile } from "../../../lib/storage";
import { request } from "../../../lib/api";
import {
  IcAlert, IcCheck, IcClose, IcEdit, IcExternal, IcLogout, IcMinus, IcPause, IcPlay, IcPlus, IcPrint, IcSearch, IcTrash, IcChevronRight, IcChevronDown, IcGoogle, IcHome, IcInfo, IcUpload
} from "./icons";
import { hueOf, initials } from "./util";

export { Skel };

// Building blocks shared by the bus-company onboarding, sign-in and portal screens.

// ------------------------------------------------------------------ contexts
export const OperatorContext = createContext(null);
export const useOperator = () => useContext(OperatorContext);

// The shell's top bar shows the page title. Pages with a dynamic title (trip detail) set it here.
export const ShellContext = createContext({ setMeta: () => {} });
export function useTitle(title, back) {
  const { setMeta } = useContext(ShellContext);
  useEffect(() => {
    setMeta({ title, back: back || null });
    return () => setMeta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, back]);
}

// Legacy icon names (kept so older imports keep working).
export const IconPlus = IcPlus;
export const IconMinus = IcMinus;
export const IconChevronRight = IcChevronRight;
export const IconChevronDown = IcChevronDown;
export const IconLogout = IcLogout;
export const IconEdit = IcEdit;
export const IconTrash = IcTrash;
export const IconPrint = IcPrint;
export const IconHome = IcHome;
export const IconExternal = IcExternal;
export const IconPause = IcPause;
export const IconPlay = IcPlay;
export const IconAlert = IcAlert;
export const IconSearchLite = IcSearch;
export const IconGoogle = IcGoogle;

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
  { v: 1, l: "Mon", s: "M" }, { v: 2, l: "Tue", s: "T" }, { v: 3, l: "Wed", s: "W" }, { v: 4, l: "Thu", s: "T" }, { v: 5, l: "Fri", s: "F" }, { v: 6, l: "Sat", s: "S" }, { v: 0, l: "Sun", s: "S" }
];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const daysLabel = (days = []) => {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEK.filter((d) => set.has(d.v)).map((d) => d.l).join(", ") || "No days";
};

// Editable day picker (or read-only dots for cards).
export function DayChips({ value = [], onChange, readOnly = false, compact = false }) {
  const set = new Set(value);
  const all = set.size === 7;
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next].sort((a, b) => a - b));
  };
  if (readOnly) {
    return (
      <div className={`bop-daydots ${compact ? "is-compact" : ""}`} role="img" aria-label={daysLabel(value)}>
        {WEEK.map((d) => <span key={d.v} className={set.has(d.v) ? "is-on" : ""} title={d.l}>{d.s}</span>)}
      </div>
    );
  }
  return (
    <div className="bop-days" role="group" aria-label="Days of the week">
      {WEEK.map((d) => (
        <button key={d.v} type="button" className={`bop-day-chip ${set.has(d.v) ? "is-on" : ""}`} aria-pressed={set.has(d.v)} onClick={() => toggle(d.v)}>
          {d.l}
        </button>
      ))}
      <button type="button" className={`bop-day-chip is-all ${all ? "is-on" : ""}`} onClick={() => onChange(all ? [] : ALL_DAYS)}>
        Every day
      </button>
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

// ------------------------------------------------------------------ skeletons (shapes match the final layouts)
export const ListSkel = ({ rows = 5, h = 70, avatar = true }) => (
  <div className="bop-skel-list" role="status" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div className="bop-card bop-skel-row" key={i} style={{ minHeight: h }}>
        {avatar ? <Skel w={44} h={44} r={14} /> : null}
        <div style={{ flex: 1, display: "grid", gap: 9 }}>
          <Skel w="42%" h={14} />
          <Skel w="72%" h={11} />
        </div>
        <Skel w={74} h={26} r={999} />
      </div>
    ))}
  </div>
);

export const CardsSkel = ({ count = 4 }) => (
  <div className="bop-kpis" role="status" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <div className="bop-card bop-kpi" key={i}>
        <div className="bop-skel-between"><Skel w={34} h={34} r={11} /><Skel w={70} h={34} r={10} /></div>
        <Skel w="48%" h={11} style={{ marginTop: 16 }} />
        <Skel w="72%" h={26} style={{ marginTop: 10 }} />
        <Skel w="55%" h={11} style={{ marginTop: 12 }} />
      </div>
    ))}
  </div>
);

export const PanelSkel = ({ h = 240, lines = 0 }) => (
  <div className="bop-card bop-panel" role="status" aria-busy="true" aria-label="Loading">
    <Skel w="38%" h={16} />
    <Skel w="24%" h={11} style={{ marginTop: 10 }} />
    <Skel h={h} r={14} style={{ marginTop: 18 }} />
    {lines ? <div style={{ display: "grid", gap: 10, marginTop: 14 }}>{Array.from({ length: lines }).map((_, i) => <Skel key={i} h={12} w={`${90 - i * 14}%`} />)}</div> : null}
  </div>
);

export function ErrorBox({ error, onRetry, className = "" }) {
  if (!error) return null;
  return (
    <div className={`bop-alert is-error bop-errorbox ${className}`} role="alert">
      <IcAlert size={18} />
      <span>{errMsg(error)}</span>
      {onRetry ? <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export const Empty = ({ icon, title, children, action, compact = false }) => (
  <div className={`bop-card bop-empty ${compact ? "is-compact" : ""}`}>
    {icon ? <span className="bop-empty-icon">{icon}</span> : null}
    <strong>{title}</strong>
    {children ? <p>{children}</p> : null}
    {action ? <div className="bop-empty-action">{action}</div> : null}
  </div>
);

// Sub line + page actions. The page title itself lives in the shell's top bar.
export const PageHead = ({ sub, actions, lead }) => {
  if (!sub && !actions && !lead) return null;
  return (
    <div className="bop-pagehead">
      <div className="bop-pagehead-text">
        {lead ? <h2 className="bop-lead-title">{lead}</h2> : null}
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="bop-pagehead-actions">{actions}</div> : null}
    </div>
  );
};

export const Panel = ({ title, sub, action, children, className = "", flush = false, ...rest }) => (
  <section className={`bop-card bop-panel ${flush ? "is-flush" : ""} ${className}`} {...rest}>
    {title ? (
      <header className="bop-panel-head">
        <div><h2>{title}</h2>{sub ? <p>{sub}</p> : null}</div>
        {action ? <div className="bop-panel-action">{action}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export const Field = ({ label, hint, error, children, className = "" }) => (
  <label className={`bop-field ${className}`}>
    {label ? <span className="bop-field-label">{label}</span> : null}
    {children}
    {error ? <em className="bop-field-error">{error}</em> : hint ? <small className="bop-hint">{hint}</small> : null}
  </label>
);

// ------------------------------------------------------------------ chips, status, avatar, switch, tabs
export const Chip = ({ tone = "", dot = false, children, className = "", ...rest }) => (
  <span className={`bop-chip ${tone ? `is-${tone}` : ""} ${className}`} {...rest}>{dot ? <i className="bop-chip-dot" /> : null}{children}</span>
);

const STATUS = {
  scheduled: ["Scheduled", "blue"], departed: ["Departed", "amber"], completed: ["Completed", "grey"], cancelled: ["Cancelled", "red"],
  confirmed: ["Confirmed", "green"], refund_due: ["Refund pending", "amber"], valid: ["Not boarded", "blue"], used: ["Checked in", "green"],
  requested: ["Pending", "amber"], paid: ["Paid", "green"], rejected: ["Rejected", "red"], active: ["Active", "green"], paused: ["Paused", "amber"],
  pending_payment: ["Awaiting payment", "amber"], expired: ["Expired", "grey"], failed: ["Failed", "red"]
};
export const StatusChip = ({ status, label }) => {
  const [text, tone] = STATUS[status] || [status, "grey"];
  return <Chip tone={tone} dot>{label || text}</Chip>;
};

export function Avatar({ name = "", src, size = 40, square = false, className = "" }) {
  const hue = hueOf(name);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.37), borderRadius: square ? Math.round(size * 0.3) : "50%" };
  if (src) return <span className={`bop-avatar has-img ${className}`} style={style}><img src={src} alt="" loading="lazy" /></span>;
  return <span className={`bop-avatar ${className}`} style={{ ...style, background: `hsl(${hue} 80% 94%)`, color: `hsl(${hue} 60% 30%)` }} aria-hidden="true">{initials(name)}</span>;
}

export function Switch({ checked, onChange, label, disabled = false, busy = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled || busy} className={`bop-switch ${checked ? "is-on" : ""} ${busy ? "is-busy" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

// options: [[value, label, count?], ...]
export function Segmented({ options, value, onChange, label, className = "" }) {
  return (
    <div className={`bop-seg ${className}`} role="group" aria-label={label}>
      {options.map(([v, l, count]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} className={value === v ? "is-on" : ""} onClick={() => onChange(v)}>
          {l}{count !== undefined && count !== null ? <b>{count}</b> : null}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="bop-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={value === t.key} className={value === t.key ? "is-on" : ""} onClick={() => onChange(t.key)}>
          {t.icon}{t.label}{t.count !== undefined ? <b>{t.count}</b> : null}
        </button>
      ))}
    </div>
  );
}

export const Meter = ({ pct = 0, level = "mid", label, className = "" }) => (
  <span className={`bop-meter is-${level} ${className}`} role="img" aria-label={label || `${pct}% full`}><i style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }} /></span>
);

export const SearchBox = ({ value, onChange, placeholder, label }) => (
  <div className="bop-search">
    <IcSearch size={18} />
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder} />
  </div>
);

// ------------------------------------------------------------------ dialogs (centered on desktop, bottom sheet on phones)
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, subtitle, onClose, children, footer, size = "md" }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prevFocus = document.activeElement;
    const node = box.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = node?.querySelector(`.bop-modal-body ${FOCUSABLE.split(",").join(", .bop-modal-body ")}`);
    (first || node)?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") { closeRef.current?.(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="bop-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} className={`bop-modal bop-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <span className="bop-modal-grab" aria-hidden="true" />
        <header className="bop-modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="bop-icon-btn" onClick={onClose} aria-label="Close"><IcClose size={20} /></button>
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
          <button type="button" className="bop-btn bop-btn-light" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`bop-btn ${danger ? "bop-btn-danger" : "bop-btn-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </>
      }
    >
      <div className={`bop-confirm ${danger ? "is-danger" : ""}`}>
        <span className="bop-confirm-icon">{danger ? <IcAlert size={22} /> : <IcInfo size={22} />}</span>
        <div className="bop-confirm-text">{children}</div>
      </div>
      {error ? <div className="bop-alert is-error" style={{ marginTop: 14 }} role="alert">{errMsg(error)}</div> : null}
    </Modal>
  );
}

export function Pager({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="bop-pager">
      <span>{from}–{to} of {total}</span>
      <div>
        <button type="button" className="bop-btn bop-btn-light bop-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <b>{page} / {pages}</b>
        <button type="button" className="bop-btn bop-btn-light bop-btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ toasts
export function useToasts() {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4800);
  }, []);
  const view = (
    <div className="bop-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`bop-toast is-${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
          <span className="bop-toast-ico">{t.tone === "error" ? <IcAlert size={16} /> : <IcCheck size={16} strokeWidth={2.6} />}</span>
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}><IcClose size={14} /></button>
        </div>
      ))}
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
      {label ? <span className="bop-field-label">{label}</span> : null}
      <div className="bop-imgfield-row">
        <button type="button" className="bop-imgfield-preview" onClick={() => input.current?.click()} disabled={busy} aria-label={value ? `Change ${label || "image"}` : `Upload ${label || "image"}`} style={value && kind === "cover" ? { backgroundImage: `url(${value})` } : undefined}>
          {value && kind === "logo" ? <img src={value} alt="" /> : !value ? <span><IcUpload size={20} />{kind === "logo" ? "Logo" : "Cover"}</span> : null}
        </button>
        <div className="bop-imgfield-actions">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
          <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : value ? "Change image" : "Upload image"}
          </button>
          {value ? <button type="button" className="bop-linkbtn" onClick={() => onChange("")}>Remove</button> : null}
          <button type="button" className="bop-linkbtn" onClick={() => setShowLink((s) => !s)}>{showLink ? "Hide link" : "Use a link"}</button>
        </div>
      </div>
      {showLink ? <input className="bop-input" type="url" placeholder="https://…" value={value || ""} onChange={(e) => onChange(e.target.value.trim())} aria-label={`${label || "Image"} link`} /> : null}
      {hint && !error ? <small className="bop-hint">{hint}</small> : null}
      {error ? <small className="bop-field-error">{error}</small> : null}
    </div>
  );
}
