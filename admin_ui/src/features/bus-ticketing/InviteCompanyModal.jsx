import React, { useEffect, useState } from 'react';

import { ModalShell, ModalHeader, CopyField, FieldLabel, PrimaryButton, GhostButton, inputClass, inputStyle } from './shared.jsx';
import { inviteOperator } from './api.js';

const emptyForm = { companyName: '', contactName: '', email: '', phone: '', commissionPercent: '' };

const DELIVERY_REASONS = {
  not_configured: "Email delivery isn't configured on this server.",
  rejected: 'The email provider rejected the message.',
  delivery_failed: "The email provider couldn't be reached.",
  no_recipient: 'There is no email address on file.'
};

// Shown after an invitation is created or re-sent. When the email went out we just say so; when it
// didn't (no Resend key in dev, provider error...) the backend hands back the onboarding link so the
// admin can copy it and send it to the company themselves.
export const InvitationResult = ({ delivery, email, companyName, onDone }) => {
  const sent = Boolean(delivery?.sent);
  return (
    <div className="px-6 pb-6 space-y-4 overflow-y-auto">
      {sent ? (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#065F46' }}>
            <i className="ph ph-paper-plane-tilt" />
            Invitation emailed
          </p>
          <p className="mt-1 text-xs" style={{ color: '#065F46' }}>
            We sent {companyName ? `${companyName}'s` : 'the'} registration link to {email}. It expires in 7 days.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border px-4 py-3" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#92400E' }}>
              <i className="ph ph-warning-circle" />
              The email was not sent
            </p>
            <p className="mt-1 text-xs" style={{ color: '#92400E' }}>
              {DELIVERY_REASONS[delivery?.deliveryStatus] || "We couldn't deliver the email."} Share this link with {companyName || 'the company'}
              {email ? ` (${email})` : ''} directly - it expires in 7 days.
            </p>
          </div>
          {delivery?.link ? <CopyField value={delivery.link} /> : null}
        </>
      )}
      <div className="flex justify-end">
        <PrimaryButton onClick={onDone}>Done</PrimaryButton>
      </div>
    </div>
  );
};

export const InviteCompanyModal = ({ open, token, defaultCommission, onClose, onInvited, onError }) => {
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Keyed on `open` only: a successful invite reloads the list, which must not wipe the result
  // screen (with the copyable link) the admin is still reading.
  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setResult(null);
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const commission = form.commissionPercent === '' ? null : Number(form.commissionPercent);
  const commissionInvalid = commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 50);
  const canSend = form.companyName.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email.trim()) && !commissionInvalid;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const body = {
        companyName: form.companyName.trim(),
        email: form.email.trim().toLowerCase(),
        ...(form.contactName.trim() ? { contactName: form.contactName.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(commission !== null ? { commissionPercent: commission } : {})
      };
      const res = await inviteOperator(token, body);
      setResult({ delivery: res.delivery, email: body.email, companyName: res.operator?.companyName || body.companyName });
      await onInvited?.(res);
    } catch (e) {
      onError?.(e.message || 'Could not invite this company');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader
        title="Invite a bus company"
        subtitle="They get an email with a link to register and set up their bus park and first routes."
        onClose={onClose}
      />
      {result ? (
        <InvitationResult {...result} onDone={onClose} />
      ) : (
        <>
          <div className="px-6 pb-2 space-y-4 overflow-y-auto">
            <div>
              <FieldLabel>Company name</FieldLabel>
              <input value={form.companyName} onChange={set('companyName')} placeholder="e.g. Link Bus Services" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input type="email" value={form.email} onChange={set('email')} placeholder="manager@linkbus.co.ug" className={inputClass} style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>The invitation goes here. They sign in with the Google account for this address.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Contact person (optional)</FieldLabel>
                <input value={form.contactName} onChange={set('contactName')} placeholder="Jane Nakato" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Phone (optional)</FieldLabel>
                <input value={form.phone} onChange={set('phone')} placeholder="+256 7XX XXX XXX" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <FieldLabel>Commission % (optional)</FieldLabel>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={form.commissionPercent}
                onChange={set('commissionPercent')}
                placeholder={defaultCommission != null ? `Default: ${defaultCommission}%` : 'Platform default'}
                className={inputClass}
                style={inputStyle}
              />
              {commissionInvalid ? <p className="mt-1 text-xs text-rose-600">Commission must be between 0 and 50.</p> : <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>Leave empty to use the platform default.</p>}
            </div>
          </div>
          <div className="p-6 pt-4 flex justify-end gap-3 flex-shrink-0">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={send} disabled={sending || !canSend}>
              {sending ? 'Sending...' : 'Send invitation'}
            </PrimaryButton>
          </div>
        </>
      )}
    </ModalShell>
  );
};

// Used by "Resend invitation": same result screen, driven from the outside.
export const InvitationResultModal = ({ result, onClose }) => (
  <ModalShell open={Boolean(result)} onClose={onClose} maxWidth="max-w-lg">
    <ModalHeader title="Invitation re-sent" onClose={onClose} />
    {result ? <InvitationResult {...result} onDone={onClose} /> : null}
  </ModalShell>
);
