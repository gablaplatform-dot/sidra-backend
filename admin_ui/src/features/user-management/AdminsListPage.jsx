import React, { useState } from 'react';

import { initialsFor, formatDateTime, RoleBadge, StatusPill, Toast, useToast } from './shared.jsx';
import { InviteAdminModal } from './InviteAdminModal.jsx';
import { updateAdmin, resendInvite, revokeInvite } from './api.js';

export const AdminsListPage = ({ adminsData = [], invitesData = [], rolesData = [], currentUserId, token, onReload }) => {
  const [q, setQ] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { toast, notify, dismiss } = useToast();

  const filtered = adminsData
    .filter((a) => {
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return (a.name || '').toLowerCase().includes(query) || (a.email || '').toLowerCase().includes(query);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const pendingInvites = invitesData.filter((i) => i.status === 'sent');

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
      await onReload?.();
    } catch (e) {
      notify(e.message || 'Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (admin) =>
    withBusy(admin.id, async () => {
      await updateAdmin(token, admin.id, { isActive: admin.status !== 'active' });
      notify(admin.status === 'active' ? 'Admin suspended' : 'Admin reactivated');
    });

  const reassignRole = (admin, roleId) =>
    withBusy(admin.id, async () => {
      await updateAdmin(token, admin.id, { roleId });
      notify('Role updated');
    });

  const doResend = (invite) =>
    withBusy(invite.id, async () => {
      await resendInvite(token, invite.id);
      notify('Invite resent');
    });

  const doRevoke = (invite) =>
    withBusy(invite.id, async () => {
      await revokeInvite(token, invite.id);
      notify('Invite revoked');
    });

  return (
    <div className="view-fade p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Admins</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Manage who has access to this dashboard and what they can do.</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 6px -1px rgba(11,32,70,0.2)' }}
        >
          <i className="ph ph-user-plus text-base" />
          Invite admin
        </button>
      </div>

      {pendingInvites.length ? (
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
          <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: '#F1F5F9', backgroundColor: '#FFFBEB' }}>
            <i className="ph ph-paper-plane-tilt text-base" style={{ color: '#92400E' }} />
            <span className="text-sm font-bold" style={{ color: '#92400E' }}>Pending invites ({pendingInvites.length})</span>
          </div>
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{invite.name} <span className="font-normal" style={{ color: '#64748B' }}>&middot; {invite.email}</span></p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Invited as {invite.roleName} &middot; expires {formatDateTime(invite.expiresAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    disabled={busyId === invite.id}
                    onClick={() => doResend(invite)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition hover:bg-slate-50 disabled:opacity-50"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                  >
                    Resend
                  </button>
                  <button
                    disabled={busyId === invite.id}
                    onClick={() => doRevoke(invite)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition hover:bg-rose-50 disabled:opacity-50"
                    style={{ borderColor: '#FECACA', color: '#DC2626' }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
          <div className="relative max-w-sm">
            <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94A3B8' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search admins..."
              className="w-full rounded-full border pl-9 pr-4 py-2 text-sm outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                {['Admin', 'Role', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-extrabold uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {filtered.map((admin) => {
                const isSelf = admin.id === currentUserId;
                const busy = busyId === admin.id;
                return (
                  <tr key={admin.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#0B2046' }}>
                          {initialsFor(admin.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: '#0F172A' }}>
                            {admin.name}
                            {isSelf ? <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>(you)</span> : null}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#64748B' }}>{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {admin.role?.isProtected || isSelf ? (
                        <RoleBadge role={admin.role} />
                      ) : (
                        <select
                          value={admin.role?.id || ''}
                          disabled={busy}
                          onChange={(e) => reassignRole(admin, e.target.value)}
                          className="text-xs font-bold rounded-lg border px-2.5 py-1.5 outline-none bg-white disabled:opacity-50"
                          style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                        >
                          {rolesData.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={admin.status === 'active' ? 'Active' : 'Suspended'} />
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: '#64748B' }}>{formatDateTime(admin.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        disabled={busy || isSelf}
                        onClick={() => toggleStatus(admin)}
                        title={isSelf ? "You can't change your own access" : undefined}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border transition hover:bg-slate-50 disabled:opacity-40"
                        style={{ borderColor: '#E2E8F0', color: admin.status === 'active' ? '#DC2626' : '#166534' }}
                      >
                        {admin.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: '#94A3B8' }}>No admins match your search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <InviteAdminModal
        open={inviteOpen}
        rolesData={rolesData}
        token={token}
        onClose={() => setInviteOpen(false)}
        onInvited={onReload}
        onError={(m) => notify(m, 'error')}
      />

      <Toast message={toast.message} tone={toast.tone} onDismiss={dismiss} />
    </div>
  );
};
