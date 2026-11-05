import React, { useEffect, useState } from 'react';

import { ModalShell, PERMISSION_GROUP_META } from './shared.jsx';
import { createRole, updateRole } from './api.js';

const emptyForm = { name: '', description: '', permissions: [] };

export const RoleEditor = ({ open, role, permissionsCatalog, token, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(role);
  const isProtected = Boolean(role?.isProtected);

  useEffect(() => {
    if (!open) return;
    setForm(
      role
        ? { name: role.name, description: role.description || '', permissions: role.permissions.slice() }
        : emptyForm
    );
  }, [open, role]);

  const grouped = permissionsCatalog.reduce((acc, perm) => {
    const group = perm.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(perm);
    return acc;
  }, {});

  const togglePermission = (key) => {
    if (isProtected) return;
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key) ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key]
    }));
  };

  const hasAll = form.permissions.includes('*');

  const save = async () => {
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (isEdit) {
        const patch = { description: form.description };
        if (!isProtected) {
          patch.name = name;
          patch.permissions = form.permissions;
        }
        await updateRole(token, role.id, patch);
      } else {
        await createRole(token, { name, description: form.description, permissions: form.permissions });
      }
      onSaved?.();
    } catch (e) {
      onError?.(e.message || 'Could not save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{isEdit ? 'Edit role' : 'New role'}</h3>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
              {isProtected
                ? 'Super Admin always has every permission and cannot be renamed or restricted.'
                : 'Choose a name and the modules this role can access.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0" aria-label="Close">
            <i className="ph ph-x text-lg" style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Role name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isProtected}
              placeholder="e.g. Finance"
              className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What this role is for"
              className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>Module permissions</label>
            <div className="mt-2 space-y-4">
              {Object.entries(grouped).map(([group, perms]) => {
                const meta = PERMISSION_GROUP_META[group] || { color: '#334155', icon: 'ph-squares-four' };
                return (
                  <div key={group} className="rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                    <div className="px-3.5 py-2 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
                      <i className={`ph ${meta.icon} text-sm`} style={{ color: meta.color }} />
                      <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: meta.color }}>{group}</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                      {perms.map((perm) => {
                        const checked = hasAll || form.permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${isProtected ? '' : 'cursor-pointer hover:bg-slate-50'}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{perm.label}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{perm.description}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isProtected}
                              onChange={() => togglePermission(perm.key)}
                              className="w-5 h-5 rounded flex-shrink-0"
                              style={{ accentColor: '#0B2046' }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t flex justify-end gap-3" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-lg border transition hover:bg-slate-50" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#0B2046' }}
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
