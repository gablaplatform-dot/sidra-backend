import React, { useEffect, useState } from 'react';

import { ModalShell, CopyField } from './shared.jsx';
import { createInvite } from './api.js';

const emptyForm = { name: '', email: '', roleId: '' };

export const InviteAdminModal = ({ open, rolesData = [], token, onClose, onInvited, onError }) => {
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setForm({ ...emptyForm, roleId: rolesData[0]?.id || '' });
    setResult(null);
  };

  // Without this, form.roleId stays '' the first time the modal opens (reset() was only ever
  // called from close()), so the Role select never matches a real option and Send stays
  // disabled until the admin happens to touch the dropdown themselves. Keyed on `open` alone,
  // not `rolesData` - a successful send triggers onInvited()'s reload, which hands this modal a
  // new `rolesData` array reference while it's still open (showing the "copy this link" result
  // screen); depending on `rolesData` here would re-fire this effect at that exact moment and
  // wipe the just-set `result` back to null before the admin ever saw the invite link.
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    onClose();
    reset();
  };

  const send = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name || !email || !form.roleId) return;
    setSending(true);
    try {
      const invite = await createInvite(token, { name, email, roleId: form.roleId });
      await onInvited?.();
      if (invite.inviteUrl) {
        setResult(invite);
      } else {
        close();
      }
    } catch (e) {
      onError?.(e.message || 'Could not send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell open={open} onClose={close} maxWidth="max-w-lg">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Invite an admin</h3>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>They'll get an email to set their own password.</p>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0" aria-label="Close">
            <i className="ph ph-x text-lg" style={{ color: '#64748B' }} />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#92400E' }}>
                <i className="ph ph-warning-circle" />
                Email delivery isn't configured here
              </p>
              <p className="mt-1 text-xs" style={{ color: '#92400E' }}>Share this invite link with {result.name} directly - it expires in 7 days.</p>
            </div>
            <CopyField value={result.inviteUrl} />
            <div className="flex justify-end">
              <button onClick={close} className="px-5 py-2.5 text-sm font-semibold rounded-lg text-white transition hover:opacity-90" style={{ backgroundColor: '#0B2046' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jane Doe"
                className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@company.com"
                className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Role</label>
              <select
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-white"
                style={{ borderColor: '#E2E8F0' }}
              >
                {rolesData.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button onClick={close} className="px-4 py-2.5 text-sm font-semibold rounded-lg border transition hover:bg-slate-50" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !form.name.trim() || !form.email.trim() || !form.roleId}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0B2046' }}
              >
                {sending ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
