import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

import {
  Chip, companyState, EmptyState, ErrorBanner, ErrorState, FilterPills, SearchBox, PrimaryButton, GhostButton, ConfirmDialog, ModalShell, ModalHeader,
  FieldLabel, inputClass, inputStyle, formatUgx, compactUgx, formatNumber, formatEatDate, CompanyAvatar, Cover, Rating, Card, Stat, SkeletonCards, SkeletonRows, thClass,
  INK, MUTED, FAINT, LINE, NAVY
} from './shared.jsx';
import { listOperators, updateOperator, resendInvitation } from './api.js';
import { InviteCompanyModal, InvitationResultModal } from './InviteCompanyModal.jsx';
import { CompanyDrawer } from './CompanyDrawer.jsx';

const STATE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'invited', label: 'Invited' },
  { value: 'registered', label: 'Registered' },
  { value: 'suspended', label: 'Suspended' }
];

// Row action menu. It is portalled with fixed positioning so the table's horizontal scroll
// container can't clip it (same approach as the Providers table).
const RowMenu = ({ actions }) => {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);

  const toggle = (e) => {
    e.stopPropagation();
    if (pos) {
      setPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const height = actions.length * 40 + 16;
    const top = rect.bottom + 6 + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
    setPos({ top, left: Math.max(8, rect.right - 208) });
  };

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} className="p-2 rounded-lg hover:bg-slate-100 transition" style={{ color: '#64748B' }} aria-label="Company actions">
        <i className="ph ph-dots-three-vertical text-lg"></i>
      </button>
      {pos
        ? createPortal(
            <div
              className="fixed w-52 bg-white border rounded-xl shadow-lg overflow-hidden"
              style={{ top: pos.top, left: pos.left, zIndex: 1200, borderColor: '#E2E8F0' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition hover:bg-slate-50"
                    style={action.tone === 'danger' ? { color: '#E11D48' } : { color: '#0F172A' }}
                    onClick={() => {
                      setPos(null);
                      action.onClick();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

const EditCompanyModal = ({ operator, token, onClose, onSaved, onError }) => {
  const [form, setForm] = useState({ companyName: '', contactPhone: '', commissionPercent: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (operator) {
      setForm({ companyName: operator.companyName || '', contactPhone: operator.contactPhone || '', commissionPercent: String(Number(operator.commissionPercent)) });
    }
  }, [operator]);

  const commission = Number(form.commissionPercent);
  const commissionValid = form.commissionPercent !== '' && Number.isFinite(commission) && commission >= 0 && commission <= 50;
  const canSave = form.companyName.trim().length >= 2 && commissionValid;

  const save = async () => {
    if (!operator || !canSave) return;
    // Only send what changed (the API rejects an empty phone string).
    const patch = {};
    if (form.companyName.trim() !== operator.companyName) patch.companyName = form.companyName.trim();
    if (form.contactPhone.trim() && form.contactPhone.trim() !== (operator.contactPhone || '')) patch.contactPhone = form.contactPhone.trim();
    if (commission !== Number(operator.commissionPercent)) patch.commissionPercent = commission;
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateOperator(token, operator.id, patch);
      await onSaved?.(`${patch.companyName || operator.companyName} updated`);
      onClose();
    } catch (e) {
      onError?.(e.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={Boolean(operator)} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader title="Edit company" subtitle={operator?.companyName} onClose={onClose} />
      <div className="px-6 pb-2 space-y-4 overflow-y-auto">
        <div>
          <FieldLabel>Company name</FieldLabel>
          <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Contact phone</FieldLabel>
          <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="+256 7XX XXX XXX" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Commission (%)</FieldLabel>
          <input type="number" min="0" max="50" step="0.5" value={form.commissionPercent} onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))} className={inputClass} style={inputStyle} />
          <p className="mt-1 text-xs" style={{ color: commissionValid ? '#94A3B8' : '#E11D48' }}>
            {commissionValid ? 'Taken from each ticket sale. Applies to new bookings only.' : 'Enter a number between 0 and 50.'}
          </p>
        </div>
      </div>
      <div className="p-6 pt-4 flex justify-end gap-3 flex-shrink-0">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save} disabled={saving || !canSave}>{saving ? 'Saving...' : 'Save changes'}</PrimaryButton>
      </div>
    </ModalShell>
  );
};

const VIEW_KEY = 'gabla_bus_companies_view';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
};

const parkLine = (op) => [op.parkName, op.parkDistrict].filter(Boolean).join(' - ');

const CompanyCard = ({ op, actions, onOpen }) => {
  const state = companyState(op);
  return (
    <Card className="bus-lift overflow-hidden cursor-pointer flex flex-col" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <Cover url={op.coverUrl} name={op.companyName} className="h-24 flex-shrink-0">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,32,70,0) 40%, rgba(11,32,70,0.35))' }}></div>
        <div className="absolute top-2.5 right-2.5"><Chip tone={state.tone}>{state.label}</Chip></div>
      </Cover>
      <div className="px-4 pb-4 flex-1 flex flex-col">
        <div className="flex items-end gap-3 -mt-7 relative">
          <CompanyAvatar name={op.companyName} url={op.logoUrl} size={56} radius={16} className="!border-2 !border-white shadow-md" />
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}><RowMenu actions={actions} /></div>
        </div>
        <h3 className="mt-2 font-bold text-[15px] truncate" style={{ color: INK }}>{op.companyName}</h3>
        <p className="text-xs mt-0.5 truncate flex items-center gap-1" style={{ color: MUTED }}>
          <i className="ph ph-map-pin flex-shrink-0"></i>{op.parkName ? parkLine(op) : `Invited ${formatEatDate(op.invitationSentAt || op.createdAt)}`}
        </p>
        <div className="mt-2"><Rating avg={op.ratingAvg} count={op.ratingCount} /></div>
        <div className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
          <Stat label="Fleet">{op.fleetSize ? formatNumber(op.fleetSize) : '-'}</Stat>
          <Stat label="Routes">{formatNumber(op.stats?.routes)}</Stat>
          <Stat label="Sales"><span title={formatUgx(op.stats?.revenue)}>{compactUgx(op.stats?.revenue)}</span></Stat>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
          <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: MUTED }}><i className="ph ph-wallet"></i>Wallet</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: NAVY }}>{compactUgx(op.walletBalance)}</span>
        </div>
      </div>
    </Card>
  );
};

export const CompaniesTab = ({ token, settings, notify, onChanged, inviteOpen, onInviteOpenChange, focusId, onFocusHandled }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [resendResult, setResendResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(readView);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage can be blocked (private window); the toggle still works for this session.
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The API can only filter on active/suspended, so the invited/registered split is done
      // client side over the (up to 100) companies returned.
      const res = await listOperators(token, { q: query, limit: 100 });
      setItems(res?.items || []);
      setTotal(res?.total || 0);
    } catch (e) {
      setError(e.message || 'Unable to load bus companies.');
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Deep link from the overview: open that company's drawer once.
  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      onFocusHandled?.();
    }
  }, [focusId, onFocusHandled]);

  const counts = useMemo(() => {
    const c = { '': items.length, invited: 0, registered: 0, suspended: 0 };
    items.forEach((op) => { c[companyState(op).key] += 1; });
    return c;
  }, [items]);
  const filters = STATE_FILTERS.map((f) => ({ ...f, count: counts[f.value] }));

  const visible = items.filter((op) => !stateFilter || companyState(op).key === stateFilter);
  const selected = items.find((op) => op.id === selectedId) || null;

  const refresh = async (message) => {
    await load();
    onChanged?.();
    if (message) notify(message);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const next = statusTarget.status === 'suspended' ? 'active' : 'suspended';
    setBusy(true);
    try {
      await updateOperator(token, statusTarget.id, { status: next });
      await refresh(`${statusTarget.companyName} ${next === 'suspended' ? 'suspended' : 'activated'}`);
      setStatusTarget(null);
    } catch (e) {
      notify(e.message || 'Could not update this company', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (op) => {
    setBusy(true);
    try {
      const delivery = await resendInvitation(token, op.id);
      setResendResult({ delivery, email: op.email, companyName: op.companyName });
      await refresh();
    } catch (e) {
      notify(e.message || 'Could not resend the invitation', 'error');
    } finally {
      setBusy(false);
    }
  };

  const rowActions = (op) => [
    { label: 'View details', onClick: () => setSelectedId(op.id) },
    { label: 'Edit commission', onClick: () => setEditTarget(op) },
    ...(op.onboardingStatus !== 'registered' ? [{ label: 'Resend invitation', onClick: () => resend(op) }] : []),
    op.status === 'suspended'
      ? { label: 'Activate', onClick: () => setStatusTarget(op) }
      : { label: 'Suspend', tone: 'danger', onClick: () => setStatusTarget(op) }
  ];

  const hasData = items.length > 0;
  const cardsClass = view === 'table' ? 'xl:hidden' : '';
  const tableClass = view === 'table' ? 'hidden xl:block' : 'hidden';

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search company, park or email..." />
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-0.5 p-0.5 rounded-xl border bg-white" style={{ borderColor: LINE }} role="group" aria-label="Layout">
            {[{ id: 'table', icon: 'ph-list', label: 'Table' }, { id: 'cards', icon: 'ph-squares-four', label: 'Cards' }].map((m) => (
              <button key={m.id} type="button" onClick={() => changeView(m.id)} aria-label={`${m.label} view`} aria-pressed={view === m.id} title={`${m.label} view`}
                className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center transition"
                style={view === m.id ? { backgroundColor: NAVY, color: '#fff' } : { color: MUTED }}>
                <i className={`ph ${m.icon} text-lg`}></i>
              </button>
            ))}
          </div>
          <PrimaryButton onClick={() => onInviteOpenChange(true)} className="flex-1 lg:flex-none">
            <i className="ph ph-plus"></i> Invite company
          </PrimaryButton>
        </div>
      </div>

      <FilterPills options={filters} value={stateFilter} onChange={setStateFilter} />
      {hasData ? <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={load} /> : null}

      {loading && !hasData ? (
        <>
          <SkeletonCards count={6} className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${view === 'table' ? 'xl:hidden' : 'xl:grid-cols-3'}`} />
          {view === 'table' ? <div className="hidden xl:block"><SkeletonRows rows={6} /></div> : null}
        </>
      ) : error && !hasData ? (
        <ErrorState message={error} onRetry={load} />
      ) : !visible.length ? (
        <EmptyState
          icon="ph-bus"
          title={items.length || query ? 'No companies match' : 'No bus companies yet'}
          action={!items.length && !query ? <PrimaryButton onClick={() => onInviteOpenChange(true)}><i className="ph ph-plus"></i> Invite the first company</PrimaryButton> : null}
        >
          {items.length || query ? 'Try a different search or filter.' : 'Invite a bus company and it will appear here once they get your email.'}
        </EmptyState>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }} className="transition-opacity">
          {/* Card grid: phones, tablets and (optionally) desktop */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${view === 'cards' ? 'xl:grid-cols-3' : ''} gap-4 ${cardsClass}`}>
            {visible.map((op) => (
              <CompanyCard key={op.id} op={op} actions={rowActions(op)} onOpen={() => setSelectedId(op.id)} />
            ))}
          </div>

          {/* Table: wide screens */}
          <Card className={`overflow-hidden ${tableClass}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: LINE, color: FAINT, backgroundColor: '#FBFCFD' }}>
                  <th className={thClass}>Company</th>
                  <th className={thClass}>Bus park</th>
                  <th className={`${thClass} text-right`}>Fleet</th>
                  <th className={`${thClass} text-right`}>Routes</th>
                  <th className={`${thClass} text-right`}>Sales</th>
                  <th className={`${thClass} text-right`}>Wallet</th>
                  <th className={thClass}>Status</th>
                  <th className="p-3.5 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((op) => {
                  const state = companyState(op);
                  return (
                    <tr key={op.id} className="border-b last:border-0 cursor-pointer hover:bg-slate-50/70 transition" style={{ borderColor: '#F1F5F9' }} onClick={() => setSelectedId(op.id)}>
                      <td className="p-3.5">
                        <div className="flex items-center gap-3 min-w-[190px]">
                          <CompanyAvatar name={op.companyName} url={op.logoUrl} size={42} />
                          <div className="min-w-0">
                            <p className="font-bold truncate" style={{ color: INK }}>{op.companyName}</p>
                            <div className="mt-0.5"><Rating avg={op.ratingAvg} count={op.ratingCount} size={12} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 min-w-[120px]">
                        {op.parkName ? (
                          <>
                            <p className="font-medium" style={{ color: INK }}>{op.parkName}</p>
                            <p className="text-xs" style={{ color: FAINT }}>{op.parkDistrict || '-'}</p>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: FAINT }}>Invited {formatEatDate(op.invitationSentAt || op.createdAt)}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right tabular-nums">{op.fleetSize ? formatNumber(op.fleetSize) : '-'}</td>
                      <td className="p-3.5 text-right tabular-nums">{formatNumber(op.stats?.routes)}</td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <p className="font-bold tabular-nums" style={{ color: NAVY }} title={formatUgx(op.stats?.revenue)}>{compactUgx(op.stats?.revenue)}</p>
                        <p className="text-xs tabular-nums" style={{ color: FAINT }}>{formatNumber(op.stats?.bookings)} bookings - {Number(op.commissionPercent)}% fee</p>
                      </td>
                      <td className="p-3.5 text-right font-semibold whitespace-nowrap tabular-nums" title={formatUgx(op.walletBalance)}>{compactUgx(op.walletBalance)}</td>
                      <td className="p-3.5"><Chip tone={state.tone}>{state.label}</Chip></td>
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <RowMenu actions={rowActions(op)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <p className="mt-3 text-xs px-1" style={{ color: MUTED }}>
            Showing {visible.length} of {total} {total === 1 ? 'company' : 'companies'}
            {total > items.length ? ` (the ${items.length} most recent are loaded - use search to find others)` : ''}
          </p>
        </div>
      )}

      <CompanyDrawer
        open={Boolean(selected)}
        operator={selected}
        questions={settings?.onboardingFields || []}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onEdit={setEditTarget}
        onToggleStatus={setStatusTarget}
        onResend={resend}
      />

      <InviteCompanyModal
        open={inviteOpen}
        token={token}
        defaultCommission={settings ? Number(settings.defaultCommissionPercent) : null}
        onClose={() => onInviteOpenChange(false)}
        onInvited={() => refresh()}
        onError={(message) => notify(message, 'error')}
      />
      <InvitationResultModal result={resendResult} onClose={() => setResendResult(null)} />
      <EditCompanyModal operator={editTarget} token={token} onClose={() => setEditTarget(null)} onSaved={refresh} onError={(message) => notify(message, 'error')} />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        tone={statusTarget?.status === 'suspended' ? 'default' : 'danger'}
        title={statusTarget?.status === 'suspended' ? `Activate ${statusTarget?.companyName}?` : `Suspend ${statusTarget?.companyName}?`}
        description={
          statusTarget?.status === 'suspended'
            ? 'Their routes and trips will show up in passenger search again and they can sign in to the operator dashboard.'
            : 'Their routes and trips disappear from passenger search and they are locked out of the operator dashboard.'
        }
        confirmLabel={statusTarget?.status === 'suspended' ? 'Activate' : 'Suspend'}
        busy={busy}
        onConfirm={confirmStatusChange}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
};
