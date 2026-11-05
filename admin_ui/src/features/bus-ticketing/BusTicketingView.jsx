import React, { useCallback, useEffect, useState } from 'react';

import { Toast, useToast, PrimaryButton, BusStyles, INK, MUTED, LINE, NAVY, GOLD } from './shared.jsx';
import { getOverview, getSettings } from './api.js';
import { OverviewTab } from './OverviewTab.jsx';
import { CompaniesTab } from './CompaniesTab.jsx';
import { QuestionsTab } from './QuestionsTab.jsx';
import { BusTypesTab } from './BusTypesTab.jsx';
import { BookingsTab } from './BookingsTab.jsx';
import { PayoutsTab } from './PayoutsTab.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'ph-squares-four' },
  { id: 'companies', label: 'Companies', icon: 'ph-buildings' },
  { id: 'questions', label: 'Onboarding questions', short: 'Onboarding', icon: 'ph-list-checks' },
  { id: 'types', label: 'Bus types', icon: 'ph-bus' },
  { id: 'bookings', label: 'Bookings', icon: 'ph-ticket' },
  { id: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' }
];

// "Bus ticketing" module: the admin side of the bus company marketplace (invite companies, shared
// bus types, bookings/refunds and payouts). Gated by the `busticketing` admin permission - see
// NAV_PERMISSION_MAP in react-app.jsx.
export const BusTicketingView = ({ token }) => {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [typeCreateOpen, setTypeCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusCompanyId, setFocusCompanyId] = useState(null);
  const { toast, notify, dismiss } = useToast();

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      setOverview(await getOverview(token));
    } catch (e) {
      setOverviewError(e.message || 'Unable to load the bus ticketing overview.');
    } finally {
      setOverviewLoading(false);
    }
  }, [token]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      setSettings(await getSettings(token));
    } catch (e) {
      setSettingsError(e.message || 'Unable to load bus settings.');
    } finally {
      setSettingsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadOverview();
    loadSettings();
  }, [token, loadOverview, loadSettings]);

  // KPI cards deep-link into the tab that explains the number, pre-filtered where it makes sense.
  const goTo = (target, status = '') => {
    if (target === 'bookings') setBookingStatus(status);
    if (target === 'payouts') setPayoutStatus(status);
    setTab(target);
  };

  // Rows on the overview open that company's drawer on the Companies tab.
  const openCompany = (id) => {
    setFocusCompanyId(id);
    setTab('companies');
  };

  const refreshAll = () => {
    loadOverview();
    setRefreshKey((k) => k + 1);
  };

  const badge = (id) => {
    const n = id === 'bookings' ? overview?.refundsDue : id === 'payouts' ? overview?.payoutsPending : 0;
    return Number(n) > 0 ? n : null;
  };

  return (
    <div className="view-fade space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <BusStyles />
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0" style={{ backgroundColor: NAVY, color: GOLD }}>
              <i className="ph-fill ph-bus text-2xl"></i>
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: INK }}>Bus ticketing</h1>
              <p className="text-sm mt-0.5 hidden lg:block" style={{ color: MUTED }}>Invite bus companies, manage bus types, and keep an eye on bookings, refunds and payouts.</p>
              <p className="text-[13px] mt-0.5 lg:hidden" style={{ color: MUTED }}>Companies, bookings, refunds and payouts.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tab === 'overview' ? (
            <button
              type="button"
              onClick={refreshAll}
              className="w-10 h-10 rounded-xl border bg-white inline-flex items-center justify-center hover:bg-slate-50 transition"
              style={{ borderColor: LINE, color: MUTED }}
              aria-label="Refresh overview"
              title="Refresh"
            >
              <i className={`ph ph-arrow-clockwise text-lg ${overviewLoading ? 'animate-spin' : ''}`}></i>
            </button>
          ) : null}
          {tab !== 'companies' ? (
            <PrimaryButton onClick={() => { setTab('companies'); setInviteOpen(true); }} aria-label="Invite company">
              <i className="ph ph-plus"></i> <span className="hidden sm:inline">Invite company</span><span className="sm:hidden">Invite</span>
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      <div
        className="sticky top-[-1rem] md:top-[-2rem] z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 overflow-x-auto bus-hide-scroll"
        style={{ backgroundColor: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center gap-1 bg-white border rounded-2xl p-1 w-fit shadow-sm" style={{ borderColor: LINE }} role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap inline-flex items-center gap-2 ${active ? 'text-white shadow-sm' : 'hover:bg-slate-50'}`}
                style={active ? { backgroundColor: NAVY } : { color: MUTED }}
              >
                <i className={`ph ${t.icon} text-base`} style={active ? { color: GOLD } : undefined}></i>
                {t.short ? (
                  <>
                    <span className="hidden md:inline">{t.label}</span>
                    <span className="md:hidden">{t.short}</span>
                  </>
                ) : (
                  t.label
                )}
                {badge(t.id) ? (
                  <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold text-white inline-flex items-center justify-center tabular-nums" style={{ backgroundColor: '#E11D48' }}>{badge(t.id)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'overview' ? <OverviewTab token={token} overview={overview} loading={overviewLoading} error={overviewError} onRetry={refreshAll} goTo={goTo} onOpenCompany={openCompany} refreshKey={refreshKey} /> : null}
      {tab === 'companies' ? (
        <CompaniesTab token={token} settings={settings} notify={notify} onChanged={loadOverview} inviteOpen={inviteOpen} onInviteOpenChange={setInviteOpen} focusId={focusCompanyId} onFocusHandled={() => setFocusCompanyId(null)} />
      ) : null}
      {tab === 'questions' ? (
        <QuestionsTab token={token} settings={settings} loading={settingsLoading} error={settingsError} onRetry={loadSettings} onSaved={setSettings} notify={notify} />
      ) : null}
      {tab === 'types' ? <BusTypesTab token={token} notify={notify} createOpen={typeCreateOpen} onCreateOpenChange={setTypeCreateOpen} /> : null}
      {tab === 'bookings' ? <BookingsTab token={token} status={bookingStatus} onStatusChange={setBookingStatus} notify={notify} onChanged={loadOverview} /> : null}
      {tab === 'payouts' ? <PayoutsTab token={token} status={payoutStatus} onStatusChange={setPayoutStatus} notify={notify} onChanged={loadOverview} /> : null}

      <Toast message={toast.message} tone={toast.tone} stamp={toast.stamp} onDismiss={dismiss} />
    </div>
  );
};
