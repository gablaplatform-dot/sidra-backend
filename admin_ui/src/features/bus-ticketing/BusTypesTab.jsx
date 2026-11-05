import React, { useCallback, useEffect, useRef, useState } from 'react';

import { uploadFileToStorage } from '../../lib/upload.js';
import { Chip, EmptyState, ErrorBanner, ErrorState, PrimaryButton, GhostButton, ConfirmDialog, ModalShell, ModalHeader, FieldLabel, Card, Skeleton, inputClass, inputStyle, INK, MUTED, FAINT, NAVY, LINE } from './shared.jsx';
import { listTypes, createType, updateType, deleteType } from './api.js';

const AMENITY_SUGGESTIONS = ['Air conditioning', 'WiFi', 'USB charging', 'Toilet', 'Reclining seats', 'TV / entertainment', 'Refreshments', 'Extra luggage space'];

const amenityIcon = (name) => {
  const n = String(name).toLowerCase();
  if (/air|a\/c|cool/.test(n)) return 'ph-snowflake';
  if (/wi-?fi|internet/.test(n)) return 'ph-wifi-high';
  if (/usb|charg|plug|power/.test(n)) return 'ph-plug-charging';
  if (/toilet|restroom|wc/.test(n)) return 'ph-toilet';
  if (/legroom|recline|seat/.test(n)) return 'ph-armchair';
  if (/tv|entertain|screen|music/.test(n)) return 'ph-television-simple';
  if (/snack|refresh|drink|food|meal|water/.test(n)) return 'ph-coffee';
  if (/luggage|bag|cargo/.test(n)) return 'ph-suitcase-rolling';
  return 'ph-check-circle';
};

const emptyForm = { name: '', seats: '60', description: '', imageUrl: '', amenities: [], sortOrder: '0', isActive: true };

const TypeModal = ({ open, type, token, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(emptyForm);
  const [amenityInput, setAmenityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setAmenityInput('');
    setForm(
      type
        ? {
            name: type.name || '',
            seats: String(type.seats ?? 60),
            description: type.description || '',
            imageUrl: type.imageUrl || '',
            amenities: Array.isArray(type.amenities) ? type.amenities : [],
            sortOrder: String(type.sortOrder ?? 0),
            isActive: type.isActive !== false
          }
        : emptyForm
    );
  }, [open, type]);

  const seats = Number(form.seats);
  const sortOrder = Number(form.sortOrder);
  const valid = form.name.trim().length >= 2 && Number.isInteger(seats) && seats >= 1 && seats <= 120 && Number.isInteger(sortOrder);

  const addAmenity = (raw) => {
    const value = String(raw || '').trim().slice(0, 40);
    if (!value) return;
    setForm((f) => (f.amenities.some((a) => a.toLowerCase() === value.toLowerCase()) || f.amenities.length >= 20 ? f : { ...f, amenities: [...f.amenities, value] }));
    setAmenityInput('');
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      onError('Please select an image file.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFileToStorage({ file, token, folder: 'bus-types' });
      setForm((f) => ({ ...f, imageUrl: uploaded.url }));
    } catch (e) {
      onError(e.message || 'Unable to upload the image');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      seats,
      description: form.description.trim(),
      imageUrl: form.imageUrl || null,
      amenities: form.amenities,
      sortOrder,
      isActive: form.isActive
    };
    try {
      if (type) await updateType(token, type.id, body);
      else await createType(token, body);
      await onSaved(type ? `${body.name} updated` : `${body.name} added`);
    } catch (e) {
      onError(e.message || 'Could not save this bus type');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-xl">
      <ModalHeader title={type ? 'Edit bus type' : 'Add a bus type'} subtitle="Companies pick from these when they set up their routes." onClose={onClose} />
      <div className="px-6 pb-2 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel>Name</FieldLabel>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Executive VIP" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Seats</FieldLabel>
            <input type="number" min="1" max="120" value={form.seats} onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))} className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            rows={3}
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What passengers can expect on this kind of bus"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Picture</FieldLabel>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; handleFile(file); }} />
            <div className="flex items-center gap-2">
              {form.imageUrl ? (
                <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))} className="text-xs font-semibold text-rose-600">Remove</button>
              ) : null}
              <GhostButton onClick={() => fileRef.current?.click()} disabled={uploading} className="!py-1.5">
                {uploading ? 'Uploading...' : form.imageUrl ? 'Change picture' : 'Upload picture'}
              </GhostButton>
            </div>
          </div>
          <div
            className="mt-2 rounded-2xl border bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer"
            style={{ borderColor: '#E2E8F0', minHeight: '9rem' }}
            onClick={() => fileRef.current?.click()}
          >
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="w-full max-h-56 object-cover" />
            ) : (
              <div className="text-center py-8" style={{ color: '#94A3B8' }}>
                <i className="ph ph-image text-3xl"></i>
                <p className="text-xs mt-1">Click to upload a picture of this bus type</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Amenities</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {form.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
                {a}
                <button type="button" onClick={() => setForm((f) => ({ ...f, amenities: f.amenities.filter((x) => x !== a) }))} aria-label={`Remove ${a}`} className="hover:text-rose-600">
                  <i className="ph ph-x"></i>
                </button>
              </span>
            ))}
          </div>
          <input
            value={amenityInput}
            onChange={(e) => setAmenityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addAmenity(amenityInput);
              }
            }}
            onBlur={() => addAmenity(amenityInput)}
            placeholder="Type an amenity and press Enter"
            className={inputClass}
            style={inputStyle}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AMENITY_SUGGESTIONS.filter((s) => !form.amenities.some((a) => a.toLowerCase() === s.toLowerCase())).map((s) => (
              <button key={s} type="button" onClick={() => addAmenity(s)} className="px-2.5 py-1 rounded-full text-xs font-medium border hover:bg-slate-50" style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
                + {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <FieldLabel>Display order</FieldLabel>
            <input type="number" step="1" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} className={inputClass} style={inputStyle} />
            <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>Lower numbers are listed first.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold pb-6" style={{ color: '#0F172A' }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Available to companies
          </label>
        </div>
      </div>
      <div className="p-6 pt-4 flex justify-end gap-3 flex-shrink-0">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save} disabled={saving || uploading || !valid}>{saving ? 'Saving...' : type ? 'Save changes' : 'Add bus type'}</PrimaryButton>
      </div>
    </ModalShell>
  );
};

export const BusTypesTab = ({ token, notify, createOpen, onCreateOpenChange }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listTypes(token);
      setItems(res?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load bus types.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const saved = async (message) => {
    setEditing(null);
    onCreateOpenChange(false);
    await load();
    notify(message);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await deleteType(token, deleting.id);
      await load();
      // The API keeps a type that routes still use and just hides it from new setups.
      notify(res?.deleted ? `${deleting.name} deleted` : `${deleting.name} is used by existing routes, so it was hidden instead of deleted`);
      setDeleting(null);
    } catch (e) {
      notify(e.message || 'Could not delete this bus type', 'error');
    } finally {
      setBusy(false);
    }
  };

  const modalOpen = createOpen || Boolean(editing);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: '#64748B' }}>The shared list of bus types every company chooses from.</p>
        <PrimaryButton onClick={() => { setEditing(null); onCreateOpenChange(true); }}>
          <i className="ph ph-plus"></i> Add bus type
        </PrimaryButton>
      </div>

      {items.length ? <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={load} /> : null}

      {loading && !items.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5" role="status" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-44 !rounded-none" />
              <div className="p-5 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /><div className="flex gap-2 pt-1"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /></div></div>
            </Card>
          ))}
        </div>
      ) : error && !items.length ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items.length ? (
        <EmptyState icon="ph-bus" title="No bus types yet" action={<PrimaryButton onClick={() => { setEditing(null); onCreateOpenChange(true); }}><i className="ph ph-plus"></i> Add the first bus type</PrimaryButton>}>
          Companies pick from this shared list when they set up their routes.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {items.map((type) => {
            const hidden = type.isActive === false;
            const amenities = Array.isArray(type.amenities) ? type.amenities : [];
            return (
              <Card key={type.id} className="bus-lift overflow-hidden flex flex-col" style={{ opacity: hidden ? 0.8 : 1 }}>
                <div className="relative h-44 bg-slate-100 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: '#CBD5E1' }}><i className="ph ph-bus text-6xl"></i></div>
                  {type.imageUrl ? (
                    <img src={type.imageUrl} alt={type.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : null}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(11,32,70,0.65), rgba(11,32,70,0) 55%)' }}></div>
                  <div className="absolute top-3 left-3"><Chip tone={hidden ? 'slate' : 'emerald'}>{hidden ? 'Hidden' : 'Active'}</Chip></div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 text-white">
                    <h3 className="font-bold text-lg leading-tight truncate drop-shadow">{type.name}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: NAVY }}>
                      <i className="ph-fill ph-armchair"></i>{type.seats} seats
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                  {type.description ? <p className="text-sm line-clamp-3" style={{ color: MUTED }}>{type.description}</p> : <p className="text-sm" style={{ color: FAINT }}>No description yet.</p>}
                  {amenities.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {amenities.slice(0, 6).map((a) => (
                        <span key={a} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
                          <i className={`ph ${amenityIcon(a)} text-sm`} style={{ color: MUTED }}></i>{a}
                        </span>
                      ))}
                      {amenities.length > 6 ? <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>+{amenities.length - 6}</span> : null}
                    </div>
                  ) : null}
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <GhostButton className="flex-1 !py-2" onClick={() => setEditing(type)}><i className="ph ph-pencil-simple"></i> Edit</GhostButton>
                    <button type="button" onClick={() => setDeleting(type)} className="p-2.5 rounded-xl border hover:bg-rose-50 transition" style={{ borderColor: LINE, color: '#E11D48' }} aria-label={`Delete ${type.name}`}>
                      <i className="ph ph-trash text-lg"></i>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TypeModal
        open={modalOpen}
        type={editing}
        token={token}
        onClose={() => { setEditing(null); onCreateOpenChange(false); }}
        onSaved={saved}
        onError={(message) => notify(message, 'error')}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={`Delete ${deleting?.name}?`}
        description="If routes already use this bus type it will be hidden from new setups instead of deleted, so history is kept."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};
