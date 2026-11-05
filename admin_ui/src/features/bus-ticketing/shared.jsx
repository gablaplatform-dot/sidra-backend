import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { ModalShell as BaseModalShell, initialsFor } from '../user-management/shared.jsx';

// The copy / initials building blocks are the same ones the Admins and Roles screens use, so bus
// screens look and behave identically. Toasts are bus-local (see below) because they need to sit
// above the bottom edge of a phone and carry an icon.
export { CopyField, initialsFor } from '../user-management/shared.jsx';

// Design tokens used across the module (plain values because the rest of the admin app styles with inline hex).
export const INK = '#0F172A';
export const MUTED = '#64748B';
export const FAINT = '#94A3B8';
export const LINE = '#E2E8F0';
export const NAVY = '#0B2046';
export const GOLD = '#FACC15';

// ---------------------------------------------------------------------------------------------
// Global bits for the module: shimmer skeletons and hidden scrollbars on horizontal chip rows.
// Rendered once by BusTicketingView.
export const BusStyles = () => (
  <style>{`
    @keyframes bus-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .bus-shimmer { background: linear-gradient(90deg, #EEF2F7 25%, #F8FAFC 50%, #EEF2F7 75%); background-size: 200% 100%; animation: bus-shimmer 1.5s linear infinite; }
    .bus-hide-scroll { scrollbar-width: none; -ms-overflow-style: none; }
    .bus-hide-scroll::-webkit-scrollbar { display: none; }
    .bus-lift { transition: transform .18s ease, box-shadow .18s ease; }
    .bus-lift:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -18px rgba(11,32,70,.35); }
    @keyframes bus-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .bus-bar { transform-origin: left center; animation: bus-bar-grow .7s cubic-bezier(.2,.8,.2,1) both; }
    @media (prefers-reduced-motion: reduce) { .bus-shimmer, .bus-bar { animation: none; } .bus-lift { transition: none; } }
  `}</style>
);

// The Admins/Roles modal renders in place, which leaves the sidebar and sticky header on top of
// its backdrop (the page content is its own stacking context). The bus modals are portalled to
// <body> instead so they properly cover the whole app.
export const ModalShell = (props) => (typeof document === 'undefined' ? null : createPortal(<BaseModalShell {...props} />, document.body));

export const ConfirmDialog = ({ open, title, description, confirmLabel = 'Confirm', tone = 'default', busy = false, onConfirm, onClose }) => (
  <ModalShell open={open} onClose={onClose} maxWidth="max-w-md">
    <div className="p-6">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: tone === 'danger' ? '#FFE4E6' : '#E0E7FF', color: tone === 'danger' ? '#BE123C' : NAVY }}>
        <i className={`ph ${tone === 'danger' ? 'ph-warning' : 'ph-question'} text-2xl`}></i>
      </div>
      <h3 className="text-lg font-bold" style={{ color: INK }}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{description}</p>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-xl border transition hover:bg-slate-50" style={{ borderColor: LINE, color: INK }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: tone === 'danger' ? '#DC2626' : NAVY }}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);

// ---------------------------------------------------------------------------------------------
// Formatting. Money is always UGX with thousands separators; "compact" is for chart labels and KPI
// cards where "UGX 520,354,000" would not fit. Everything numeric is rendered with tabular figures
// at the call site (Tailwind `tabular-nums`).
export const formatUgx = (value) => {
  const n = Number(value ?? 0);
  return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0'}`;
};

export const formatNumber = (value) => Number(value ?? 0).toLocaleString('en-US');

const trim = (n) => String(Math.round(n * 10) / 10).replace(/\.0$/, '');
export const compactNumber = (value) => {
  const n = Math.abs(Number(value ?? 0));
  if (!Number.isFinite(n)) return '0';
  const sign = Number(value) < 0 ? '-' : '';
  if (n >= 1e9) return `${sign}${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${sign}${trim(n / 1e6)}M`;
  if (n >= 1e4) return `${sign}${trim(n / 1e3)}K`;
  return `${sign}${Math.round(n).toLocaleString('en-US')}`;
};
export const compactUgx = (value) => `UGX ${compactNumber(value)}`;

// Bus times are always shown in East Africa Time, whatever timezone the admin's laptop is set to.
const EAT_ZONE = 'Africa/Kampala';
const eatDateTime = new Intl.DateTimeFormat('en-GB', { timeZone: EAT_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const eatDate = new Intl.DateTimeFormat('en-GB', { timeZone: EAT_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
const eatShortParts = new Intl.DateTimeFormat('en-GB', { timeZone: EAT_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const eatTimeOnly = new Intl.DateTimeFormat('en-GB', { timeZone: EAT_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

const validDate = (iso) => {
  const d = new Date(iso);
  return iso && !Number.isNaN(d.getTime()) ? d : null;
};

export const formatEatDateTime = (iso) => {
  const d = validDate(iso);
  if (!d) return '-';
  return `${eatDateTime.format(d).replace(',', '')} EAT`;
};

export const formatEatDate = (iso) => {
  const d = validDate(iso);
  return d ? eatDate.format(d) : '-';
};

// "Tue 13 Oct, 20:30" - compact departure label for lists and cards.
export const formatEatShort = (iso) => {
  const d = validDate(iso);
  if (!d) return '-';
  const get = (type) => eatShortParts.formatToParts(d).find((p) => p.type === type)?.value || '';
  return `${get('weekday')} ${get('day')} ${get('month')}, ${get('hour')}:${get('minute')}`;
};

const eatDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: EAT_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
// "Tuesday 13 October" - group headings in mobile lists.
export const formatEatDay = (iso) => {
  const d = validDate(iso);
  return d ? eatDayFmt.format(d).replace(',', '') : '-';
};

export const formatEatTime = (iso) => {
  const d = validDate(iso);
  return d ? eatTimeOnly.format(d) : '-';
};

export const humanize = (value) => {
  const raw = String(value ?? '').replace(/_/g, ' ').trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
};

// ---------------------------------------------------------------------------------------------
// Chips
const CHIP_TONES = {
  amber: { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
  emerald: { bg: '#D1FAE5', fg: '#065F46', dot: '#10B981' },
  rose: { bg: '#FFE4E6', fg: '#BE123C', dot: '#F43F5E' },
  slate: { bg: '#E2E8F0', fg: '#475569', dot: '#94A3B8' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6' }
};

export const Chip = ({ tone = 'slate', dot = true, children }) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.slate;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: t.bg, color: t.fg }}>
      {dot ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.dot }}></span> : null}
      {children}
    </span>
  );
};

// A company is "Suspended" when an admin suspended it, otherwise it is either still waiting on
// the emailed invitation ("Invited") or has finished the registration form ("Registered").
export const companyState = (operator) => {
  if (operator?.status === 'suspended') return { key: 'suspended', label: 'Suspended', tone: 'slate' };
  if (operator?.onboardingStatus === 'registered') return { key: 'registered', label: 'Registered', tone: 'emerald' };
  return { key: 'invited', label: 'Invited', tone: 'amber' };
};

const BOOKING_TONES = {
  confirmed: 'emerald',
  refund_due: 'rose',
  cancelled: 'slate',
  pending_payment: 'amber',
  failed: 'slate',
  expired: 'slate'
};

export const bookingStatusLabel = (status) => (status === 'refund_due' ? 'Refund due' : status === 'pending_payment' ? 'Awaiting payment' : humanize(status));
export const BookingChip = ({ status }) => <Chip tone={BOOKING_TONES[status] || 'slate'}>{bookingStatusLabel(status)}</Chip>;

const PAYOUT_TONES = { requested: 'amber', paid: 'emerald', rejected: 'rose' };
export const PayoutChip = ({ status }) => <Chip tone={PAYOUT_TONES[status] || 'slate'}>{status === 'requested' ? 'Requested' : humanize(status)}</Chip>;

// ---------------------------------------------------------------------------------------------
// Small building blocks
export const Eyebrow = ({ children, className = '' }) => (
  <p className={`text-[10.5px] font-bold uppercase tracking-[0.09em] ${className}`} style={{ color: FAINT }}>{children}</p>
);

export const Card = ({ className = '', style, children, ...rest }) => (
  <div className={`bg-white border rounded-2xl ${className}`} style={{ borderColor: LINE, boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 10px 28px -22px rgba(11,32,70,0.35)', ...style }} {...rest}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
    <div className="min-w-0">
      <h3 className="text-[15px] font-bold" style={{ color: INK }}>{title}</h3>
      {subtitle ? <p className="text-xs mt-0.5" style={{ color: MUTED }}>{subtitle}</p> : null}
    </div>
    {action || null}
  </div>
);

const AVATAR_TINTS = [
  ['#FEF3C7', '#92400E'], ['#DBEAFE', '#1E3A8A'], ['#D1FAE5', '#065F46'], ['#FFE4E6', '#9F1239'], ['#E0E7FF', '#3730A3'], ['#FFEDD5', '#9A3412'], ['#CCFBF1', '#115E59']
];
const tintFor = (name) => {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};

// Company logo with a coloured-initials fallback (no logo uploaded yet, or the image failed to load).
export const CompanyAvatar = ({ name, url, size = 40, radius = 12, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const [bg, fg] = tintFor(name);
  const box = { width: size, height: size, borderRadius: radius };
  if (url && !failed) {
    return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover flex-shrink-0 bg-white border ${className}`} style={{ ...box, borderColor: LINE }} />;
  }
  return (
    <div className={`flex items-center justify-center font-bold flex-shrink-0 ${className}`} style={{ ...box, backgroundColor: bg, color: fg, fontSize: Math.max(11, Math.round(size * 0.36)) }}>
      {initialsFor(name)}
    </div>
  );
};

// Cover photo with a tinted gradient fallback (no photo, or it failed to load).
export const Cover = ({ url, name, className = '', children }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const [bg, fg] = tintFor(name);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${bg}, #E2E8F0)` }}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <i className="ph ph-bus absolute right-4 bottom-2 text-6xl opacity-30" style={{ color: fg }}></i>
      )}
      {children}
    </div>
  );
};

// 0-5 stars with fractional fill (4.4 shows 4 and a bit stars).
export const Stars = ({ value = 0, size = 14 }) => {
  const pct = (Math.max(0, Math.min(5, Number(value) || 0)) / 5) * 100;
  const row = [0, 1, 2, 3, 4].map((i) => <i key={i} className="ph-fill ph-star flex-shrink-0"></i>);
  return (
    <span className="relative inline-block leading-none align-middle" style={{ fontSize: size }} role="img" aria-label={`${Number(value || 0).toFixed(1)} out of 5`}>
      <span className="flex" style={{ color: '#E2E8F0' }}>{row}</span>
      <span className="absolute inset-y-0 left-0 overflow-hidden flex" style={{ width: `${pct}%`, color: '#F59E0B' }}>{row}</span>
    </span>
  );
};

export const Rating = ({ avg, count, size = 13 }) =>
  Number(count) > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums" style={{ color: MUTED }}>
      <Stars value={avg} size={size} />
      <span style={{ color: INK }}>{Number(avg || 0).toFixed(1)}</span>
      <span>({formatNumber(count)})</span>
    </span>
  ) : (
    <span className="text-xs" style={{ color: FAINT }}>No ratings yet</span>
  );

// ---------------------------------------------------------------------------------------------
// Loading / empty / error states
export const Skeleton = ({ className = '', style }) => <div className={`bus-shimmer rounded-lg ${className}`} style={style} aria-hidden="true" />;

export const SkeletonCards = ({ count = 6, className = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' }) => (
  <div className={className} role="status" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 !rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 !rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </Card>
    ))}
  </div>
);

export const SkeletonRows = ({ rows = 6 }) => (
  <Card className="overflow-hidden" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
        <Skeleton className="w-10 h-10 !rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
        <Skeleton className="h-3.5 w-24 hidden sm:block" />
        <Skeleton className="h-6 w-20 !rounded-full" />
      </div>
    ))}
  </Card>
);

// Kept as the default "loading" block so every screen shows the same shimmer.
export const Spinner = () => <SkeletonRows rows={5} />;

export const EmptyState = ({ icon = 'ph-bus', title, children, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed bg-white/60" style={{ borderColor: '#CBD5E1' }}>
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9', color: FAINT }}>
      <i className={`ph ${icon} text-3xl`}></i>
    </div>
    {title ? <p className="font-bold" style={{ color: INK }}>{title}</p> : null}
    <p className={`text-sm max-w-sm ${title ? 'mt-1' : 'font-medium'}`} style={{ color: MUTED }}>{children}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

// Full-block error for a screen that has nothing to show (the inline ErrorBanner covers refresh failures).
export const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 text-center rounded-2xl border bg-white" style={{ borderColor: '#FECDD3' }}>
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FFE4E6', color: '#E11D48' }}>
      <i className="ph ph-cloud-slash text-3xl"></i>
    </div>
    <p className="font-bold" style={{ color: INK }}>Couldn't load this</p>
    <p className="text-sm mt-1 max-w-sm" style={{ color: MUTED }}>{message || 'Something went wrong while talking to the server.'}</p>
    {onRetry ? (
      <button type="button" onClick={onRetry} className="mt-5 px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 hover:opacity-90" style={{ backgroundColor: NAVY }}>
        <i className="ph ph-arrow-clockwise"></i> Try again
      </button>
    ) : null}
  </div>
);

export const ErrorBanner = ({ message, onDismiss, onRetry }) =>
  message ? (
    <div className="px-4 py-3 rounded-xl text-sm bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-between gap-3" role="alert">
      <span className="flex items-center gap-2 min-w-0"><i className="ph ph-warning-circle text-lg flex-shrink-0"></i><span className="min-w-0 break-words">{message}</span></span>
      <span className="flex items-center gap-3 flex-shrink-0">
        {onRetry ? <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button> : null}
        {onDismiss ? <button type="button" onClick={onDismiss} className="text-rose-400 hover:text-rose-600" aria-label="Dismiss"><i className="ph ph-x"></i></button> : null}
      </span>
    </div>
  ) : null;

// ---------------------------------------------------------------------------------------------
// Toasts: bottom-centre on phones (above the home bar), bottom-right on desktop.
export const useToast = () => {
  const [toast, setToast] = useState({ message: '', tone: 'success', stamp: 0 });
  const notify = useCallback((message, tone = 'success') => setToast((t) => ({ message, tone, stamp: t.stamp + 1 })), []);
  const dismiss = useCallback(() => setToast((t) => ({ ...t, message: '' })), []);
  return { toast, notify, dismiss };
};

export const Toast = ({ message, tone = 'success', stamp = 0, onDismiss }) => {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDismiss, tone === 'error' ? 5000 : 3200);
    return () => clearTimeout(t);
  }, [message, stamp, tone, onDismiss]);

  if (typeof document === 'undefined') return null;
  const error = tone === 'error';
  return createPortal(
    <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-[1100] flex justify-center sm:justify-end pointer-events-none">
      <AnimatePresence>
        {message ? (
          <motion.div
            key={stamp}
            role={error ? 'alert' : 'status'}
            className="pointer-events-auto max-w-sm w-full sm:w-auto flex items-start gap-3 pl-3.5 pr-2 py-3 rounded-2xl text-sm font-semibold border"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              backgroundColor: error ? '#FEF2F2' : '#ECFDF5',
              color: error ? '#991B1B' : '#065F46',
              borderColor: error ? '#FECACA' : '#A7F3D0',
              boxShadow: '0 18px 40px -20px rgba(15,23,42,0.45)'
            }}
          >
            <i className={`ph-fill ${error ? 'ph-warning-circle' : 'ph-check-circle'} text-xl flex-shrink-0 mt-px`}></i>
            <span className="flex-1 min-w-0 break-words leading-snug pt-0.5">{message}</span>
            <button type="button" onClick={onDismiss} className="p-1 rounded-lg opacity-60 hover:opacity-100 flex-shrink-0" aria-label="Dismiss"><i className="ph ph-x"></i></button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------------------------
// Controls
export const FilterPills = ({ options, value, onChange }) => (
  <div className="flex items-center gap-2 overflow-x-auto bus-hide-scroll -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" role="tablist">
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value || 'all'}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition ${active ? 'text-white shadow-sm' : 'bg-white hover:bg-slate-50'}`}
          style={active ? { backgroundColor: NAVY, borderColor: NAVY } : { borderColor: LINE, color: MUTED }}
        >
          {opt.label}
          {opt.count !== undefined && opt.count !== null ? (
            <span className="tabular-nums px-1.5 rounded-full text-[10.5px] leading-[18px]" style={active ? { backgroundColor: 'rgba(255,255,255,0.18)' } : { backgroundColor: '#F1F5F9', color: MUTED }}>{opt.count}</span>
          ) : null}
        </button>
      );
    })}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative w-full sm:max-w-80">
    <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ color: MUTED }}></i>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full bg-white border text-sm rounded-full py-2.5 pl-10 pr-9 outline-none shadow-sm focus:border-slate-400 transition"
      style={{ borderColor: LINE }}
    />
    {value ? (
      <button type="button" onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100" style={{ color: FAINT }} aria-label="Clear search">
        <i className="ph ph-x-circle-fill text-base"></i>
      </button>
    ) : null}
  </div>
);

export const Pager = ({ page, limit, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <div className="px-4 py-3 border-t flex items-center justify-between gap-3 text-sm" style={{ borderColor: LINE, backgroundColor: 'rgba(248,250,252,0.6)' }}>
      <p className="tabular-nums" style={{ color: MUTED }}>
        <span className="font-semibold" style={{ color: INK }}>{formatNumber(from)}-{formatNumber(to)}</span> <span className="hidden sm:inline">of </span><span className="sm:hidden">/ </span>
        <span className="font-semibold" style={{ color: INK }}>{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums mr-1 hidden sm:inline" style={{ color: FAINT }}>Page {page} of {pages}</span>
        <button className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 inline-flex items-center gap-1 font-medium" style={{ borderColor: LINE, color: MUTED }} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <i className="ph ph-caret-left"></i> Prev
        </button>
        <button className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 inline-flex items-center gap-1 font-medium" style={{ borderColor: LINE, color: MUTED }} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <i className="ph ph-caret-right"></i>
        </button>
      </div>
    </div>
  );
};

export const PrimaryButton = ({ children, className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2 ${className}`}
    style={{ backgroundColor: NAVY }}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`px-4 py-2.5 text-sm font-semibold rounded-xl border bg-white transition hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center gap-2 ${className}`}
    style={{ borderColor: LINE, color: INK }}
  >
    {children}
  </button>
);

export const FieldLabel = ({ children }) => (
  <label className="block text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{children}</label>
);

export const inputClass = 'mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-white';
export const inputStyle = { borderColor: LINE };

export const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="p-6 pb-4 flex items-start justify-between gap-4 flex-shrink-0">
    <div className="min-w-0">
      <h3 className="text-lg font-bold" style={{ color: INK }}>{title}</h3>
      {subtitle ? <p className="mt-1 text-sm" style={{ color: MUTED }}>{subtitle}</p> : null}
    </div>
    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0" aria-label="Close">
      <i className="ph ph-x text-lg" style={{ color: MUTED }} />
    </button>
  </div>
);

// Header-cell style for desktop tables: tiny uppercase labels like the eGoTickets reference.
export const thClass = 'p-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] whitespace-nowrap';

// Label-over-value pair used in mobile cards: tiny uppercase label, bold value.
export const Stat = ({ label, children, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <Eyebrow>{label}</Eyebrow>
    <div className="mt-0.5 text-sm font-bold tabular-nums truncate" style={{ color: INK }}>{children}</div>
  </div>
);
