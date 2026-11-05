import React, { useState } from 'react';

import { roleTone, ConfirmDialog, Toast, useToast } from './shared.jsx';
import { RoleEditor } from './RoleEditor.jsx';
import { deleteRole } from './api.js';

export const RolesListPage = ({ rolesData = [], permissionsData = [], token, onReload }) => {
  const [editor, setEditor] = useState({ open: false, role: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, notify, dismiss } = useToast();

  const openCreate = () => setEditor({ open: true, role: null });
  const openEdit = (role) => setEditor({ open: true, role });

  const onSaved = async () => {
    setEditor({ open: false, role: null });
    await onReload?.();
    notify('Role saved');
  };

  const onError = (message) => notify(message, 'error');

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    try {
      await deleteRole(token, confirmDelete.id);
      setConfirmDelete(null);
      await onReload?.();
      notify('Role deleted');
    } catch (e) {
      notify(e.message || 'Could not delete role', 'error');
    }
  };

  return (
    <div className="view-fade p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Define what each admin role can see and do.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 6px -1px rgba(11,32,70,0.2)' }}
        >
          <i className="ph ph-plus text-base" />
          New role
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rolesData.map((role) => {
          const tone = roleTone(role.key);
          return (
            <div key={role.id} className="rounded-2xl border bg-white p-5 flex flex-col gap-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold"
                      style={{ background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`, color: tone.ink }}
                    >
                      <i className="ph ph-shield-check text-sm" />
                      {role.name}
                    </span>
                    {role.isProtected ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        Protected
                      </span>
                    ) : role.isSystem ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                        Built-in
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm" style={{ color: '#64748B' }}>{role.description || 'No description'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {role.permissions.includes('*') ? (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: '#F1F5F9', color: '#0F172A' }}>All modules</span>
                ) : role.permissions.length ? (
                  role.permissions.slice(0, 4).map((p) => (
                    <span key={p} className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>{p}</span>
                  ))
                ) : (
                  <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>No permissions granted</span>
                )}
                {role.permissions.length > 4 && !role.permissions.includes('*') ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>+{role.permissions.length - 4}</span>
                ) : null}
              </div>

              <div className="mt-auto pt-3 border-t flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
                <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                  <i className="ph ph-users mr-1" />{role.adminCount} admin{role.adminCount === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(role)} className="p-2 rounded-lg hover:bg-slate-100 transition" title="Edit role">
                    <i className="ph ph-pencil-simple" style={{ color: '#334155' }} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(role)}
                    disabled={role.isSystem || role.isProtected}
                    className="p-2 rounded-lg hover:bg-rose-50 transition disabled:opacity-30 disabled:hover:bg-transparent"
                    title={role.isSystem ? 'Built-in roles cannot be deleted' : 'Delete role'}
                  >
                    <i className="ph ph-trash" style={{ color: '#DC2626' }} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RoleEditor
        open={editor.open}
        role={editor.role}
        permissionsCatalog={permissionsData}
        token={token}
        onClose={() => setEditor({ open: false, role: null })}
        onSaved={onSaved}
        onError={onError}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this role?"
        description={
          confirmDelete?.adminCount
            ? `${confirmDelete.name} still has ${confirmDelete.adminCount} admin${confirmDelete.adminCount === 1 ? '' : 's'} assigned. Reassign them first.`
            : `This permanently removes "${confirmDelete?.name}". This cannot be undone.`
        }
        confirmLabel="Delete role"
        tone="danger"
        onConfirm={confirmRemove}
        onClose={() => setConfirmDelete(null)}
      />

      <Toast message={toast.message} tone={toast.tone} onDismiss={dismiss} />
    </div>
  );
};
