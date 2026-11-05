import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const initialsFor = (value) =>
  String(value || 'NA')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'NA';

export const formatDateTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-UG', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const formatDateShort = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
};

// Same visual grouping/order used across the permission catalog on both admin_ui and the
// backend (src/constants/permissions.js) - kept in sync manually since this is UI-only styling
// metadata (color/icon), not part of the actual permission contract.
export const PERMISSION_GROUP_META = {
  Core: { color: '#0B2046', icon: 'ph-squares-four' },
  Finance: { color: '#B45309', icon: 'ph-wallet' },
  System: { color: '#9F1239', icon: 'ph-gear' }
};

export const ROLE_TONES = {
  super_admin: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046' },
  operations: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046' },
  finance: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046' },
  auditor: { from: '#CFFAFE', to: '#A5F3FC', ink: '#0B2046' }
};
export const roleTone = (roleKey) => ROLE_TONES[roleKey] || { from: '#E2E8F0', to: '#CBD5E1', ink: '#0B2046' };

export const RoleBadge = ({ role }) => {
  const t = roleTone(role?.key);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border"
      style={{ borderColor: 'rgba(15,23,42,0.06)', background: `linear-gradient(135deg, ${t.from}, ${t.to})`, color: t.ink }}
    >
      <i className="ph ph-shield-check text-sm" />
      {role?.name || 'No role'}
    </span>
  );
};

export const StatusPill = ({ status }) => {
  const tones = {
    Active: 'bg-emerald-100 text-emerald-800',
    Suspended: 'bg-slate-200 text-slate-700',
    sent: 'bg-amber-100 text-amber-800',
    revoked: 'bg-slate-200 text-slate-700',
    accepted: 'bg-emerald-100 text-emerald-800',
    expired: 'bg-rose-100 text-rose-700'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${tones[status] || 'bg-slate-200 text-slate-700'}`}>
      {status}
    </span>
  );
};

export const ModalShell = ({ open, children, onClose, maxWidth = 'max-w-3xl' }) => (
  <AnimatePresence>
    {open ? (
      <>
        <motion.div
          className="fixed inset-0 bg-slate-900/40 z-[998]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className={`fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] ${maxWidth} bg-white rounded-2xl z-[999] overflow-hidden border max-h-[85vh] flex flex-col`}
          style={{ borderColor: '#E2E8F0', boxShadow: '0 24px 60px -30px rgba(11,32,70,0.55)' }}
          initial={{ y: 18, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {children}
        </motion.div>
      </>
    ) : null}
  </AnimatePresence>
);

export const ConfirmDialog = ({ open, title, description, confirmLabel = 'Confirm', tone = 'default', onConfirm, onClose }) => (
  <ModalShell open={open} onClose={onClose} maxWidth="max-w-md">
    <div className="p-6">
      <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{title}</h3>
      <p className="mt-2 text-sm" style={{ color: '#64748B' }}>{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border transition hover:bg-slate-50" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition hover:opacity-90"
          style={{ backgroundColor: tone === 'danger' ? '#DC2626' : '#0B2046' }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);

export const Toast = ({ message, tone = 'success', onDismiss }) => {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          className="fixed bottom-6 right-6 z-[1100] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          style={
            tone === 'error'
              ? { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' }
              : { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }
          }
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export const useToast = () => {
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  const notify = (message, tone = 'success') => setToast({ message, tone });
  const dismiss = () => setToast((t) => ({ ...t, message: '' }));
  return { toast, notify, dismiss };
};

export const CopyField = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) - the value is still
      // selectable in the input, so this is a soft failure.
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
      <input readOnly value={value} className="flex-1 min-w-0 bg-transparent text-xs outline-none" style={{ color: '#0F172A' }} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={copy}
        className="flex-shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg transition hover:opacity-90"
        style={{ backgroundColor: copied ? '#DCFCE7' : '#0B2046', color: copied ? '#166534' : '#fff' }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};
