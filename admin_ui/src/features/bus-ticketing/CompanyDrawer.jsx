import React from 'react';

import { DrawerShell } from '../../lib/drawer.jsx';
import { Chip, companyState, formatUgx, compactUgx, formatNumber, formatEatDateTime, humanize, PrimaryButton, GhostButton, CompanyAvatar, Cover, Stars, Eyebrow, INK, MUTED, FAINT, LINE, NAVY } from './shared.jsx';

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
    <span className="text-sm flex-shrink-0" style={{ color: '#64748B' }}>{label}</span>
    <span className="text-sm font-medium text-right min-w-0 break-words" style={{ color: '#0F172A' }}>{children}</span>
  </div>
);

const Section = ({ title, icon, children }) => (
  <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: '#E2E8F0' }}>
    <h4 className="text-[10.5px] font-bold uppercase tracking-[0.09em] mb-2 flex items-center gap-2" style={{ color: '#94A3B8' }}>
      {icon ? <i className={`ph ${icon} text-sm`}></i> : null}{title}
    </h4>
    {children}
  </section>
);

const Tile = ({ label, children, sub }) => (
  <div className="rounded-2xl border bg-white p-3.5 min-w-0" style={{ borderColor: LINE }}>
    <Eyebrow>{label}</Eyebrow>
    <p className="mt-1 text-lg font-extrabold tabular-nums truncate" style={{ color: NAVY }}>{children}</p>
    {sub ? <p className="text-[11px] tabular-nums truncate" style={{ color: FAINT }}>{sub}</p> : null}
  </div>
);

const ContactButton = ({ href, icon, label, external }) => (
  <a
    href={href}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    className="flex-1 min-w-[96px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border bg-white text-sm font-semibold hover:bg-slate-50 transition"
    style={{ borderColor: LINE, color: INK }}
  >
    <i className={`ph ${icon} text-base`}></i>{label}
  </a>
);

const digits = (value) => String(value || '').replace(/[^\d+]/g, '');

// Renders one admin-defined onboarding answer according to the question's type.
const formatAnswer = (field, value) => {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return <span style={{ color: '#94A3B8' }}>Not answered</span>;
  if (field?.type === 'boolean' || typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (field?.type === 'url') return <a href={/^https?:\/\//i.test(String(value)) ? String(value) : undefined} target="_blank" rel="noreferrer" className="underline" style={{ color: '#0B2046' }}>{String(value)}</a>;
  return `${value}${field?.unit ? ` ${field.unit}` : ''}`;
};

export const CompanyDrawer = ({ open, operator, questions = [], onClose, onEdit, onToggleStatus, onResend, busy }) => {
  const state = operator ? companyState(operator) : null;
  const answers = operator?.customFields || {};
  const known = new Set(questions.map((q) => q.key));
  // Answers to questions that were later removed from the settings still deserve to be visible.
  const orphaned = Object.keys(answers).filter((key) => !known.has(key));
  const stats = operator?.stats || {};
  const whatsapp = digits(operator?.whatsapp).replace(/^\+/, '').replace(/^0/, '256');

  return (
    <DrawerShell open={open} onClose={onClose}>
      {operator ? (
        <>
          <div className="flex-shrink-0">
            <Cover url={operator.coverUrl} name={operator.companyName} className="h-32 sm:h-40">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,32,70,0.25), rgba(11,32,70,0) 45%, rgba(11,32,70,0.35))' }}></div>
              <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white inline-flex items-center justify-center shadow transition" aria-label="Close">
                <i className="ph ph-x text-lg" style={{ color: NAVY }}></i>
              </button>
            </Cover>
            <div className="px-5 sm:px-6 pb-4 border-b" style={{ borderColor: LINE }}>
              <div className="flex items-end gap-4 -mt-9 relative">
                <CompanyAvatar name={operator.companyName} url={operator.logoUrl} size={72} radius={20} className="!border-4 !border-white shadow-md" />
                <div className="pb-1 min-w-0 flex-1"><Chip tone={state.tone}>{state.label}</Chip></div>
              </div>
              <h2 className="mt-3 text-xl font-bold truncate" style={{ color: INK }}>{operator.companyName}</h2>
              <div className="mt-1 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs" style={{ color: MUTED }}>
                {operator.parkName ? <span className="inline-flex items-center gap-1"><i className="ph ph-map-pin"></i>{[operator.parkName, operator.parkDistrict].filter(Boolean).join(', ')}</span> : null}
                {operator.ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums"><Stars value={operator.ratingAvg} size={13} /><span style={{ color: INK }}>{Number(operator.ratingAvg || 0).toFixed(1)}</span> ({formatNumber(operator.ratingCount)} reviews)</span>
                ) : (
                  <span>No ratings yet</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Sales" sub={`${formatNumber(stats.bookings)} bookings`}><span title={formatUgx(stats.revenue)}>{compactUgx(stats.revenue)}</span></Tile>
              <Tile label="Wallet balance" sub="Available to pay out"><span title={formatUgx(operator.walletBalance)}>{compactUgx(operator.walletBalance)}</span></Tile>
              <Tile label="Commission" sub={`${compactUgx(stats.commission)} earned`}>{Number(operator.commissionPercent)}%</Tile>
              <Tile label="Upcoming trips" sub={`${formatNumber(stats.routes)} active routes`}>{formatNumber(stats.upcomingTrips)}</Tile>
            </div>

            {operator.description ? (
              <Section title="About" icon="ph-info">
                <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>{operator.description}</p>
              </Section>
            ) : null}

            <Section title="Contact" icon="ph-address-book">
              <Row label="Email">{operator.email || '-'}</Row>
              <Row label="Contact person">{operator.contactName || '-'}</Row>
              <Row label="Phone">{operator.contactPhone || '-'}</Row>
              {operator.whatsapp ? <Row label="WhatsApp">{operator.whatsapp}</Row> : null}
              <div className="mt-3 flex gap-2 flex-wrap">
                {operator.contactPhone ? <ContactButton href={`tel:${digits(operator.contactPhone)}`} icon="ph-phone" label="Call" /> : null}
                {operator.whatsapp ? <ContactButton href={`https://wa.me/${whatsapp}`} icon="ph-whatsapp-logo" label="WhatsApp" external /> : null}
                {operator.email ? <ContactButton href={`mailto:${operator.email}`} icon="ph-envelope-simple" label="Email" /> : null}
              </div>
            </Section>

            <Section title="Bus park" icon="ph-map-pin">
              <Row label="Park name">{operator.parkName || <span style={{ color: '#94A3B8' }}>Not set yet</span>}</Row>
              <Row label="District">{operator.parkDistrict || '-'}</Row>
              {operator.parkAddress ? <Row label="Address">{operator.parkAddress}</Row> : null}
              <Row label="Fleet size">{operator.fleetSize ? `${formatNumber(operator.fleetSize)} buses` : '-'}</Row>
              {operator.parkLat && operator.parkLng ? (
                <a href={`https://www.google.com/maps?q=${operator.parkLat},${operator.parkLng}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: NAVY }}>
                  <i className="ph ph-map-trifold"></i> Open in Maps
                </a>
              ) : null}
            </Section>

            <Section title="Onboarding answers" icon="ph-list-checks">
              {questions.length || orphaned.length ? (
                <>
                  {questions.map((q) => (
                    <Row key={q.key} label={q.label}>{formatAnswer(q, answers[q.key])}</Row>
                  ))}
                  {orphaned.map((key) => (
                    <Row key={key} label={humanize(key)}>{formatAnswer(null, answers[key])}</Row>
                  ))}
                </>
              ) : (
                <p className="text-sm py-2" style={{ color: '#94A3B8' }}>No extra onboarding questions are set up.</p>
              )}
              {operator.onboardingStatus !== 'registered' ? (
                <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>Answers appear here once the company completes registration.</p>
              ) : null}
            </Section>

            <Section title="Timeline" icon="ph-clock-counter-clockwise">
              <ol className="relative ml-2 border-l pl-5 space-y-4 py-1" style={{ borderColor: LINE }}>
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 0 1px #F59E0B' }}></span>
                  <p className="text-sm font-semibold" style={{ color: INK }}>Invited</p>
                  <p className="text-xs tabular-nums" style={{ color: MUTED }}>{formatEatDateTime(operator.invitationSentAt || operator.createdAt)}</p>
                </li>
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white" style={operator.registeredAt ? { backgroundColor: '#10B981', boxShadow: '0 0 0 1px #10B981' } : { backgroundColor: '#E2E8F0', boxShadow: '0 0 0 1px #CBD5E1' }}></span>
                  <p className="text-sm font-semibold" style={{ color: operator.registeredAt ? INK : FAINT }}>{operator.registeredAt ? 'Registered' : 'Not registered yet'}</p>
                  {operator.registeredAt ? <p className="text-xs tabular-nums" style={{ color: MUTED }}>{formatEatDateTime(operator.registeredAt)}</p> : null}
                </li>
              </ol>
            </Section>
          </div>

          <div className="px-4 sm:px-6 py-3 border-t flex items-center gap-2 sm:gap-3 flex-wrap flex-shrink-0 bg-white" style={{ borderColor: LINE }}>
            <GhostButton onClick={() => onEdit(operator)} disabled={busy}><i className="ph ph-pencil-simple"></i> Edit</GhostButton>
            {operator.onboardingStatus !== 'registered' ? (
              <GhostButton onClick={() => onResend(operator)} disabled={busy}><i className="ph ph-paper-plane-tilt"></i> <span className="hidden sm:inline">Resend invite</span><span className="sm:hidden">Resend</span></GhostButton>
            ) : null}
            <PrimaryButton
              className="ml-auto"
              onClick={() => onToggleStatus(operator)}
              disabled={busy}
            >
              {operator.status === 'suspended' ? 'Activate company' : 'Suspend company'}
            </PrimaryButton>
          </div>
        </>
      ) : null}
    </DrawerShell>
  );
};
