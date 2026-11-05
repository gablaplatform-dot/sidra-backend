import React from 'react';

// Shared by the directory-Category editor, the Shop Categories editor and the Bus ticketing
// onboarding-questions editor so every "admin defines custom questions" screen behaves the same.
export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Single choice' },
  { value: 'multi_select', label: 'Multiple choice' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'url', label: 'Link (URL)' },
  { value: 'phone', label: 'Phone number' }
];

export const fieldsForEditor = (fields = []) =>
  (fields || []).map((f) => ({
    key: f.key || '',
    label: f.label || '',
    type: f.type || 'text',
    required: Boolean(f.required),
    options: Array.isArray(f.options) ? f.options.join(', ') : (f.options || ''),
    unit: f.unit || ''
  }));

export const slugifyFieldKey = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Shared by both the directory-Category editor and the ProductCategory (Shop Categories) editor -
// converts the editor's comma-separated `options` text back into an array and fills in a key from
// the label when the admin didn't type one.
export const sanitizeFields = (fields = []) =>
  (fields || [])
    .filter((f) => f.label && f.label.trim())
    .map((f) => ({
      key: (f.key && f.key.trim()) || slugifyFieldKey(f.label),
      label: f.label.trim(),
      type: f.type || 'text',
      required: Boolean(f.required),
      options: typeof f.options === 'string'
        ? f.options.split(',').map((o) => o.trim()).filter(Boolean)
        : (Array.isArray(f.options) ? f.options : []),
      unit: f.unit ? f.unit.trim() : undefined
    }));

export const FieldListEditor = ({ title, description, fields = [], onChange }) => {
  const updateField = (index, patch) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const addField = () => {
    onChange([...fields, { key: '', label: '', type: 'text', required: false, options: '', unit: '' }]);
  };

  const removeField = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>{title}</label>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{description}</p>
        </div>
        <button
          type="button"
          onClick={addField}
          className="px-3 py-2 rounded-xl text-sm font-semibold border hover:bg-slate-50 transition shrink-0"
          style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
        >
          <i className="ph ph-plus mr-1"></i>
          Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-2xl border p-4 bg-slate-50 text-xs" style={{ borderColor: '#E2E8F0', color: '#94A3B8' }}>
          No custom fields defined yet.
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={index} className="rounded-2xl border p-4 bg-slate-50 space-y-3" style={{ borderColor: '#E2E8F0' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Label</label>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder="e.g. Years of experience"
                    className="w-full bg-white border text-sm rounded-lg py-2 px-3 outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value })}
                    className="w-full bg-white border text-sm rounded-lg py-2 px-3 outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    {CUSTOM_FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(field.type === 'select' || field.type === 'multi_select') ? (
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Choices (comma separated)</label>
                  <input
                    value={field.options}
                    onChange={(e) => updateField(index, { options: e.target.value })}
                    placeholder="e.g. Small, Medium, Large"
                    className="w-full bg-white border text-sm rounded-lg py-2 px-3 outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#0F172A' }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                  Required
                </label>
                <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                  <input
                    value={field.unit}
                    onChange={(e) => updateField(index, { unit: e.target.value })}
                    placeholder="Unit (optional, e.g. sq ft)"
                    className="w-full bg-white border text-xs rounded-lg py-1.5 px-2.5 outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="p-2 rounded-lg hover:bg-rose-50 transition shrink-0"
                  style={{ color: '#E11D48' }}
                  title="Remove field"
                >
                  <i className="ph ph-trash text-lg"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
