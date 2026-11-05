import React, { useEffect, useMemo, useState } from 'react';

import { FieldListEditor, fieldsForEditor, sanitizeFields } from '../../lib/fieldEditor.jsx';
import { Spinner, ErrorBanner, ErrorState, PrimaryButton, GhostButton, FieldLabel, inputClass, inputStyle } from './shared.jsx';
import { saveSettings } from './api.js';

const BUILT_IN = [
  { label: 'Bus park name', icon: 'ph-map-pin' },
  { label: 'Park district', icon: 'ph-map-trifold' },
  { label: 'Fleet size', icon: 'ph-bus' },
  { label: 'First routes & prices', icon: 'ph-path' }
];

const toDraft = (settings) => ({
  fields: fieldsForEditor(settings?.onboardingFields),
  commission: String(Number(settings?.defaultCommissionPercent ?? 0)),
  holdMinutes: String(settings?.holdMinutes ?? 10)
});

export const QuestionsTab = ({ token, settings, loading, error, onRetry, onSaved, notify }) => {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever fresh settings arrive (first load, or after a save).
  useEffect(() => {
    if (settings) setDraft(toDraft(settings));
  }, [settings]);

  const baseline = useMemo(() => JSON.stringify(toDraft(settings)), [settings]);
  const dirty = JSON.stringify(draft) !== baseline;

  const commission = Number(draft.commission);
  const hold = Number(draft.holdMinutes);
  const commissionValid = draft.commission !== '' && Number.isFinite(commission) && commission >= 0 && commission <= 50;
  const holdValid = draft.holdMinutes !== '' && Number.isInteger(hold) && hold >= 3 && hold <= 60;

  const save = async () => {
    const fields = sanitizeFields(draft.fields);
    const keys = new Set();
    for (const f of fields) {
      if (keys.has(f.key)) return notify(`Two questions would share the key "${f.key}". Rename one of them.`, 'error');
      keys.add(f.key);
      if ((f.type === 'select' || f.type === 'multi_select') && !f.options.length) {
        return notify(`"${f.label}" needs at least one choice.`, 'error');
      }
    }
    if (!commissionValid) return notify('Default commission must be between 0 and 50.', 'error');
    if (!holdValid) return notify('Seat hold time must be a whole number of minutes between 3 and 60.', 'error');

    setSaving(true);
    try {
      const saved = await saveSettings(token, { onboardingFields: fields, defaultCommissionPercent: commission, holdMinutes: hold });
      onSaved(saved);
      notify('Onboarding questions and settings saved');
    } catch (e) {
      notify(e.message || 'Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) return <Spinner />;
  if (!settings) return <ErrorState message={error || 'Unable to load settings.'} onRetry={onRetry} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <ErrorBanner message={error} onRetry={onRetry} />

      <section className="bg-white border rounded-2xl p-6" style={{ borderColor: '#E2E8F0' }}>
        <h3 className="font-bold" style={{ color: '#0F172A' }}>Always asked</h3>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Every bus company answers these when they open their invitation. They are built in and can't be removed.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BUILT_IN.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
              <i className={`ph ${item.icon}`}></i>
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-6" style={{ borderColor: '#E2E8F0' }}>
        <FieldListEditor
          title="Extra questions"
          description="Anything else you need to know about a company (licence number, insurance cover, SACCO membership...). Answers show in the company's detail panel."
          fields={draft.fields}
          onChange={(fields) => setDraft((d) => ({ ...d, fields }))}
        />
      </section>

      <section className="bg-white border rounded-2xl p-6" style={{ borderColor: '#E2E8F0' }}>
        <h3 className="font-bold" style={{ color: '#0F172A' }}>Booking settings</h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel>Default commission (%)</FieldLabel>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={draft.commission}
              onChange={(e) => setDraft((d) => ({ ...d, commission: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
            <p className="mt-1 text-xs" style={{ color: commissionValid ? '#94A3B8' : '#E11D48' }}>
              {commissionValid ? 'Used for newly invited companies. You can still set it per company.' : 'Enter a number between 0 and 50.'}
            </p>
          </div>
          <div>
            <FieldLabel>Seat hold time (minutes)</FieldLabel>
            <input
              type="number"
              min="3"
              max="60"
              step="1"
              value={draft.holdMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, holdMinutes: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
            <p className="mt-1 text-xs" style={{ color: holdValid ? '#94A3B8' : '#E11D48' }}>
              {holdValid ? 'How long seats stay reserved while a passenger pays.' : 'Enter a whole number between 3 and 60.'}
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 sticky bottom-[-1rem] md:bottom-[-2rem] py-3 z-10" style={{ backgroundColor: 'rgba(248,250,252,0.9)' }}>
        {dirty ? <span className="text-xs font-semibold mr-auto" style={{ color: '#B45309' }}>You have unsaved changes</span> : null}
        <GhostButton onClick={() => setDraft(toDraft(settings))} disabled={!dirty || saving}>Discard</GhostButton>
        <PrimaryButton onClick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : 'Save changes'}</PrimaryButton>
      </div>
    </div>
  );
};
