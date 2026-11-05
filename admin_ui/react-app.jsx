import CommunityModeration from './src/components/CommunityModeration';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';

import { API_BASE, TOKEN_KEY, apiRequest } from './src/lib/api.js';
import { uploadFileToStorage } from './src/lib/upload.js';
import { DrawerShell, SheetHandle, useIsMobile } from './src/lib/drawer.jsx';
import { fieldsForEditor, sanitizeFields, FieldListEditor } from './src/lib/fieldEditor.jsx';
import { AcceptInvitePage, AdminsListPage, RolesListPage } from './src/features/user-management/index.js';
import { BusTicketingView } from './src/features/bus-ticketing/index.js';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:5174').replace(/\/$/, '');

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const UGANDA_DEFAULT_CENTER = { lat: 1.3733, lng: 32.2903 };

let googleMapsLoadPromise = null;
const loadGoogleMaps = () => {
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('Map picking is not configured. Set VITE_GOOGLE_MAPS_API_KEY.'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
};

const geocodeAddress = (google, query) =>
  new Promise((resolve) => {
    if (!query) {
      resolve(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query, componentRestrictions: { country: 'UG' } }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) resolve(results[0].geometry.location);
      else resolve(null);
    });
  });

const newSessionToken = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// google.maps.places.Autocomplete is blocked for API keys/projects created after March 2025
// ("not available to new customers"), so location search uses the Places API (New) REST
// endpoints directly instead of the legacy JS widget.
const placesAutocomplete = async (input, sessionToken) => {
  if (!input?.trim() || !GOOGLE_MAPS_API_KEY) return [];
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY },
    body: JSON.stringify({ input, includedRegionCodes: ['ug'], sessionToken })
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      text: p.text?.text || '',
      mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
      secondaryText: p.structuredFormat?.secondaryText?.text || ''
    }));
};

const placeDetails = async (placeId, sessionToken) => {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    { headers: { 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'location,formattedAddress,addressComponents' } }
  );
  if (!res.ok) return null;
  return res.json().catch(() => null);
};

const parseNewAddressComponents = (components = []) => {
  const get = (type) => components.find((c) => c.types?.includes(type))?.longText || '';
  return {
    city: get('locality') || get('administrative_area_level_2') || '',
    region: get('administrative_area_level_1') || '',
    country: get('country') || 'Uganda'
  };
};

const flattenCategoriesWithPath = (items = [], parentPath = '', depth = 0) =>
  items.flatMap((item) => {
    const path = parentPath ? `${parentPath} / ${item.name}` : item.name;
    const children = item.children || item.subcategories || [];
    return [{ id: item.id, name: item.name, path, depth, raw: item }, ...flattenCategoriesWithPath(children, path, depth + 1)];
  });


// Plain-text matching that ignores case and accents, so "cafe" finds "Café".
const foldText = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

// Pick one category out of a nested tree. Type to search every level at once (names, full paths and the search
// aliases admins set), or browse level by level with a breadcrumb. Replaces a long flat dropdown.
const CategoryPicker = ({ tree = [], value, onChange, placeholder = 'Choose a category', required = false, allowAnyLevel = true }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [trail, setTrail] = useState([]); // ids of the opened parents, outermost first
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const flat = useMemo(() => flattenCategoriesWithPath(tree), [tree]);
  const byId = useMemo(() => new Map(flat.map((item) => [item.id, item])), [flat]);
  const childrenOf = (raw) => raw?.children || raw?.subcategories || [];
  const selected = value ? byId.get(value) : null;

  const ancestorsOf = (id) => {
    const chain = [];
    let current = byId.get(id)?.raw?.parentId;
    while (current && byId.has(current)) {
      chain.unshift(current);
      current = byId.get(current).raw.parentId;
    }
    return chain;
  };
  const pathNames = (id) => [...ancestorsOf(id), id].map((x) => byId.get(x)?.name).filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openPicker = () => {
    setOpen(true);
    setQuery('');
    setTrail(selected ? ancestorsOf(selected.id) : []);
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const choose = (id) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const searching = query.trim().length > 0;
  const tokens = foldText(query).split(/\s+/).filter(Boolean);
  const scored = searching
    ? flat
        .map((item) => {
          const name = foldText(item.name);
          const path = foldText(item.path);
          const aliases = foldText((item.raw?.searchAliases || item.raw?.settings?.searchAliases || []).join(' '));
          const haystack = `${path} ${aliases}`;
          if (!tokens.every((t) => haystack.includes(t))) return null;
          let score = 0;
          if (name === foldText(query).trim()) score += 100;
          if (name.startsWith(tokens[0])) score += 40;
          if (tokens.every((t) => name.includes(t))) score += 25;
          if (tokens.every((t) => aliases.includes(t)) && !tokens.every((t) => name.includes(t))) score += 10;
          score -= item.depth; // a broader match first when otherwise equal
          return { item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
        .slice(0, 60)
        .map((r) => r.item)
    : [];

  const level = trail.length ? childrenOf(byId.get(trail[trail.length - 1])?.raw) : tree;
  const rows = searching
    ? scored.map((item) => ({ id: item.id, name: item.name, node: item.raw, path: item.path }))
    : level.map((node) => ({ id: node.id, name: node.name, node }));
  const parentRow = !searching && trail.length && allowAnyLevel ? byId.get(trail[trail.length - 1]) : null;
  const items = parentRow ? [{ id: parentRow.id, name: parentRow.name, isParent: true, node: parentRow.raw }, ...rows] : rows;

  useEffect(() => { setActive(0); }, [query, trail, open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const activate = (row) => {
    if (!row) return;
    const kids = childrenOf(row.node);
    if (row.isParent || !kids.length) return choose(row.id);
    if (searching) return choose(row.id);
    setTrail((t) => [...t, row.id]);
  };
  const browseInto = (row, event) => {
    event.stopPropagation();
    setQuery('');
    setTrail([...ancestorsOf(row.id), row.id]);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); activate(items[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    else if (event.key === 'Backspace' && !query && trail.length) { setTrail((t) => t.slice(0, -1)); }
  };

  const mark = (text) => {
    if (!tokens.length) return text;
    const folded = foldText(text);
    const hit = tokens.map((t) => ({ t, i: folded.indexOf(t) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i)[0];
    if (!hit) return text;
    return (
      <>
        {text.slice(0, hit.i)}
        <mark style={{ background: '#FEF08A', color: 'inherit', borderRadius: 3 }}>{text.slice(hit.i, hit.i + hit.t.length)}</mark>
        {text.slice(hit.i + hit.t.length)}
      </>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <input tabIndex={-1} aria-hidden="true" required={required} value={value || ''} onChange={() => {}} style={{ position: 'absolute', opacity: 0, height: 1, width: 1, pointerEvents: 'none' }} />
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none flex items-center gap-3 text-left"
        style={{ borderColor: open ? '#0B2046' : '#E2E8F0' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <i className="ph ph-folders text-lg" style={{ color: '#64748B' }}></i>
        <span className="flex-1 min-w-0 truncate" style={{ color: selected ? '#0F172A' : '#94A3B8' }}>
          {selected ? pathNames(selected.id).join('  ›  ') : placeholder}
        </span>
        {selected ? (
          <span role="button" tabIndex={0} aria-label="Clear category" onClick={(e) => { e.stopPropagation(); onChange(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }} className="px-1.5 text-lg leading-none" style={{ color: '#94A3B8' }}>×</span>
        ) : null}
        <i className={`ph ph-caret-${open ? 'up' : 'down'}`} style={{ color: '#64748B' }}></i>
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#CBD5E1', boxShadow: '0 10px 30px -12px rgba(11,32,70,0.25)' }}>
          <div className="p-2 border-b" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <i className="ph ph-magnifying-glass" style={{ color: '#94A3B8' }}></i>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search any category or subcategory…"
                className="flex-1 bg-transparent text-sm outline-none"
                aria-label="Search categories"
              />
              {query ? <button type="button" onClick={() => setQuery('')} className="text-xs font-semibold" style={{ color: '#64748B' }}>Clear</button> : null}
            </div>
          </div>

          {!searching ? (
            <div className="px-3 py-2 flex flex-wrap items-center gap-1 text-xs border-b" style={{ borderColor: '#F1F5F9', color: '#64748B' }}>
              <button type="button" onClick={() => setTrail([])} className="font-semibold hover:underline" style={{ color: trail.length ? '#0B2046' : '#64748B' }}>All categories</button>
              {trail.map((id, i) => (
                <React.Fragment key={id}>
                  <span>›</span>
                  <button type="button" onClick={() => setTrail(trail.slice(0, i + 1))} className="font-semibold hover:underline" style={{ color: i === trail.length - 1 ? '#64748B' : '#0B2046' }}>{byId.get(id)?.name}</button>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs border-b" style={{ borderColor: '#F1F5F9', color: '#64748B' }}>
              {scored.length ? `${scored.length}${scored.length === 60 ? '+' : ''} match${scored.length === 1 ? '' : 'es'} across all levels` : 'No category matches that'}
            </div>
          )}

          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {items.map((row, index) => {
              const kids = childrenOf(row.node);
              const isActive = index === active;
              const isSelected = row.id === value;
              return (
                <div
                  key={`${row.isParent ? 'self-' : ''}${row.id}`}
                  data-row={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => activate(row)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  style={{ background: isActive ? '#F1F5F9' : 'transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>
                      {row.isParent ? <>Use “{row.name}” itself</> : searching ? mark(row.name) : row.name}
                    </p>
                    {searching ? (
                      <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{row.path.split(' / ').slice(0, -1).join('  ›  ') || 'Top level'}</p>
                    ) : row.isParent ? (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Pick this level without choosing a subcategory</p>
                    ) : null}
                  </div>
                  {isSelected ? <i className="ph ph-check text-lg" style={{ color: '#087F70' }}></i> : null}
                  {!row.isParent && kids.length ? (
                    searching ? (
                      <button type="button" onClick={(e) => browseInto(row, e)} className="text-xs font-semibold px-2 py-1 rounded-md border" style={{ borderColor: '#E2E8F0', color: '#0B2046' }}>{kids.length} sub ›</button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#64748B' }}>{kids.length} <i className="ph ph-caret-right"></i></span>
                    )
                  ) : null}
                </div>
              );
            })}
            {!items.length && !searching ? <p className="px-3 py-4 text-sm" style={{ color: '#94A3B8' }}>No categories here yet.</p> : null}
          </div>
          <div className="px-3 py-2 border-t text-[11px]" style={{ borderColor: '#F1F5F9', color: '#94A3B8' }}>↑ ↓ to move · Enter to choose or open · Backspace to go up · Esc to close</div>
        </div>
      ) : null}
    </div>
  );
};

const customStyles = {
  scrollbar: `
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
  `,
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .view-fade { animation: fadeIn 0.3s ease-in-out; }
  `,
  toggle: `
    .toggle-checkbox:checked { right: 0; border-color: #0B2046; }
    .toggle-checkbox:checked + .toggle-label { background-color: #0B2046; }
    .toggle-checkbox { position: absolute; display: block; width: 1.5rem; height: 1.5rem; border-radius: 9999px; background-color: white; border: 4px solid #CBD5E1; appearance: none; cursor: pointer; transition: all 0.3s; z-index: 10; }
    .toggle-label { display: block; overflow: hidden; height: 1.5rem; border-radius: 9999px; background-color: #CBD5E1; cursor: pointer; transition: background-color 0.3s; }
  `,
  loginScene: `
    @keyframes gablaFloat {
      0%, 100% { transform: translate3d(0, 0, 0); }
      50% { transform: translate3d(0, -10px, 0); }
    }
    @keyframes gablaPulse {
      0%, 100% { opacity: 0.55; transform: scale(0.98); }
      50% { opacity: 1; transform: scale(1.04); }
    }
    @keyframes gablaRise {
      0% { opacity: 0; transform: translate3d(0, 36px, 0) scale(0.82); }
      20% { opacity: 1; }
      100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    @keyframes gablaTrail {
      0% { opacity: 0; transform: scaleY(0.25); }
      25% { opacity: 0.85; }
      100% { opacity: 0; transform: scaleY(1); }
    }
    @keyframes gablaSpark {
      0%, 100% { opacity: 0.25; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    @keyframes gablaBeamPulse {
      0%, 100% { opacity: 0.3; transform: translateX(-50%) scaleY(0.92); }
      50% { opacity: 0.85; transform: translateX(-50%) scaleY(1.04); }
    }
    @keyframes gablaHoloFlicker {
      0%, 100% { opacity: 0.58; }
      22% { opacity: 0.42; }
      46% { opacity: 0.72; }
      68% { opacity: 0.5; }
      84% { opacity: 0.78; }
    }
    @keyframes gablaScan {
      0% { transform: translateY(-108%); opacity: 0; }
      18% { opacity: 0.55; }
      100% { transform: translateY(108%); opacity: 0; }
    }
    @media (max-height: 900px) {
      .gabla-login-shell {
        padding-top: 1.75rem !important;
        padding-bottom: 1rem !important;
      }
      .gabla-login-card {
        margin-top: 1.5rem !important;
      }
      .gabla-login-form {
        padding: 1.1rem !important;
      }
      .gabla-login-bowl {
        width: 76% !important;
        max-width: 440px !important;
      }
      .gabla-login-footer {
        padding-top: 0.75rem !important;
      }
    }
    @media (max-height: 760px) {
      .gabla-login-shell {
        padding-top: 1.1rem !important;
        padding-bottom: 0.65rem !important;
      }
      .gabla-login-brand {
        transform: scale(0.9);
        transform-origin: top center;
      }
      .gabla-login-card {
        margin-top: 0.75rem !important;
      }
      .gabla-login-form {
        padding: 0.95rem !important;
      }
      .gabla-login-bowl {
        width: 68% !important;
        max-width: 360px !important;
      }
      .gabla-login-footer {
        padding-top: 0.35rem !important;
      }
    }
  `
};

const formatUgx = (value) => {
  const n = Number(value ?? 0);
  return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-UG') : '0'}`;
};

const formatDateShort = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
};

const normalizeStatus = (value, fallback = 'Pending') => {
  const raw = String(value ?? fallback).replace(/_/g, ' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const initialsFor = (value) =>
  String(value || 'NA')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'NA';

const DialogShell = ({ open, children, onClose }) => (
  typeof document === 'undefined'
    ? null
    : createPortal(
        <AnimatePresence>
          {open ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.4)',
                  backdropFilter: 'blur(2px)',
                  zIndex: 998
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '50%',
                  zIndex: 999,
                  width: 'min(32rem, calc(100vw - 2rem))',
                  maxHeight: 'min(720px, calc(100dvh - 2rem))',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    width: '100%',
                    maxHeight: 'min(720px, calc(100dvh - 2rem))',
                    borderRadius: '1.5rem',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    boxShadow: '0 24px 80px -28px rgba(11,32,70,0.42)'
                  }}
                >
                  {children}
                </motion.div>
              </div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body
      )
);

const mapUser = (user, index = 0) => ({
  id: user.id ? `#${String(user.id).slice(0, 8).toUpperCase()}` : `#USR-${index + 1}`,
  sourceId: user.id,
  name: user.name || 'Unnamed user',
  avatar: user.avatarUrl || null,
  initials: initialsFor(user.name || user.email),
  email: user.email || '-',
  phone: user.phone || '-',
  date: formatDateShort(user.createdAt),
  status: user.isActive === false ? 'Suspended' : 'Active'
});

const mapProvider = (provider, index = 0) => ({
  id: provider.id || `PRV-${index + 1}`,
  businessName: provider.businessName || 'Unnamed provider',
  category: provider.category?.name || provider.categoryName || 'Uncategorized',
  subscriptionStatus: normalizeStatus(provider.subscriptionStatus, 'None'),
  walletStatus: provider.walletEnabled ? 'Enabled' : 'Disabled',
  onlinePaymentsEnabled: provider.onlinePaymentsEnabled !== false,
  approvalStatus: provider.isApproved ? 'Approved' : normalizeStatus(provider.moderationStatus, 'Pending'),
  dateJoined: provider.createdAt || new Date().toISOString(),
  avatar: provider.media?.profileImage || null,
  initials: initialsFor(provider.businessName),
  contact: {
    name: provider.user?.name || provider.contact?.name || provider.businessName || 'Provider',
    phone: provider.contact?.phone || provider.user?.phone || '-',
    email: provider.user?.email || provider.contact?.email || '-',
    location: provider.location?.address || provider.location?.city || '-'
  },
  description: provider.description || '',
  servicesProducts: (provider.listings || provider.serviceProducts || []).map((item, itemIndex) => ({
    id: item.id || `SP-${itemIndex + 1}`,
    type: normalizeStatus(item.type, 'Service'),
    name: item.name || item.title || 'Untitled',
    priceUgx: Number(item.price || item.priceUgx || 0)
  })),
  gallery: Array.isArray(provider.media?.gallery) ? provider.media.gallery : [],
  walletBalanceUgx: Number(provider.wallet?.balance || 0),
  recentTransactions: (provider.transactions || []).slice(0, 5).map((t, tIndex) => ({
    id: t.id || `TX-${tIndex + 1}`,
    type: normalizeStatus(t.type, 'Transaction'),
    amountUgx: Number(t.amount || 0),
    status: normalizeStatus(t.status, 'Pending'),
    date: t.createdAt || new Date().toISOString()
  })),
  contactUnlocks: Number(provider.contactClicks || provider.contactUnlocks || 0),
  profileVisits: Number(provider.profileViews || provider.profileVisits || 0),
  ratingAvg: Number(provider.ratingAvg || 0),
  ratingCount: Number(provider.ratingCount || 0)
});

const mapCategory = (category, index = 0) => ({
  taxonomyKind: category.taxonomyKind || 'service',
  id: category.id || `CAT-${index + 1}`,
  name: category.name || 'Unnamed category',
  parentId: category.parentId || null,
  icon: category.settings?.icon || 'ph-folders',
  status: normalizeStatus(category.status, 'Active'),
  providers: Number(category.providers || 0),
  listings: Number(category.listings || 0),
  growthPct: Number(category.settings?.growthPct || 0),
  accent: category.settings?.accent || { from: 'rgba(11,32,70,0.10)', to: 'rgba(250,204,21,0.14)' },
  behavior: category.behavior,
  viewType: category.viewType,
  appView: category.appView,
  moderationStatus: category.moderationStatus || 'approved',
  createdByProviderId: category.createdByProviderId || null,
  settings: category.settings || {},
  sortOrder: Number(category.sortOrder ?? index),
  providerFields: Array.isArray(category.providerFields) ? category.providerFields : [],
  listingFields: Array.isArray(category.listingFields) ? category.listingFields : [],
  imageUrl: category.imageUrl || category.settings?.imageUrl || category.settings?.pictureUrl || '',
  imageKey: category.settings?.imageKey || '',
  layout: category.settings?.layout || 'default',
  searchAliases: Array.isArray(category.settings?.searchAliases) ? category.settings.searchAliases : [],
  subcategories: (category.children || category.subcategories || []).map(mapCategory)
});

const withSortOrder = (items = []) => items.map((item, index) => ({ ...item, sortOrder: index }));

const mapProductCategory = (category, index = 0) => ({
  id: category.id || `PCAT-${index + 1}`,
  name: category.name || 'Unnamed category',
  parentId: category.parentId || null,
  status: normalizeStatus(category.status, category.isActive === false ? 'Paused' : 'Active'),
  isActive: category.isActive !== false,
  products: Number(category.products || 0),
  moderationStatus: category.moderationStatus || 'approved',
  createdByProviderId: category.createdByProviderId || null,
  sortOrder: Number(category.sortOrder ?? index),
  imageUrl: category.imageUrl || '',
  listingFields: Array.isArray(category.listingFields) ? category.listingFields : [],
  providerCategoryId: category.providerCategoryId || null,
  effectiveListingFields: Array.isArray(category.effectiveListingFields) ? category.effectiveListingFields : [],
  bookable: Boolean(category.bookable),
  bookingUnit: category.bookingUnit || '',
  createdAt: category.createdAt || null,
  updatedAt: category.updatedAt || null,
  subcategories: (category.children || category.subcategories || []).map(mapProductCategory)
});

const mapListing = (listing, index = 0) => ({
  id: listing.id || `LST-${index + 1}`,
  title: listing.name || listing.title || 'Untitled listing',
  type: normalizeStatus(listing.type, 'Service'),
  provider: listing.provider?.businessName || listing.provider?.name || 'Unknown provider',
  providerId: listing.providerId || listing.provider?.id || '',
  category: listing.provider?.category?.name || 'Uncategorized',
  priceUgx: Number(listing.price || listing.priceUgx || 0),
  status: normalizeStatus(listing.status, 'Pending'),
  featured: Boolean(listing.featured),
  onlinePaymentEnabled: listing.onlinePaymentEnabled !== false,
  createdAt: listing.createdAt || new Date().toISOString(),
  // The apps save the cover as media.imageUrl and extra photos in media.gallery.
  thumbnail: listing.media?.imageUrl || listing.media?.thumbnail || listing.media?.thumbnailUrl || listing.media?.images?.[0] || listing.media?.gallery?.[0] || '',
  gallery: (Array.isArray(listing.media?.gallery) ? listing.media.gallery : Array.isArray(listing.media?.images) ? listing.media.images : []).filter(Boolean),
  description: listing.description || '',
  views: Number(listing.views ?? listing.customFields?.views ?? 0),
  purchases: Number(listing.purchases ?? listing.customFields?.purchases ?? 0),
  revenueUgx: Number(listing.revenueUgx ?? listing.customFields?.revenueUgx ?? 0)
});

const toBackendListingStatus = (status) => String(status || '').toLowerCase();
const toBackendListingType = (type) => String(type || '').toLowerCase();

const mapTransaction = (transaction, index = 0) => {
  const type = String(transaction.type || '').toLowerCase();
  const kind = type === 'subscription' ? 'Subscription'
    : type === 'contact_unlock' ? 'Contact Unlock'
    : type === 'withdrawal' ? 'Withdrawal'
    : 'Product Purchase';
  const status = transaction.status === 'succeeded' ? 'Completed' : normalizeStatus(transaction.status, 'Pending');
  const amount = Number(transaction.amount || 0);
  const fee = Number(transaction.fee || 0);
  const net = Number(transaction.netAmount || 0);
  return {
    id: transaction.id || `TX-${index + 1}`,
    kind,
    method: transaction.metadata?.method || transaction.metadata?.paymentMethod || 'Ledger',
    status,
    amountUgx: amount,
    platformFeeUgx: fee,
    netAmountUgx: net,
    provider: transaction.provider || { id: transaction.providerId || '-', name: 'Unknown provider' },
    user: transaction.user || { id: transaction.userId || '-', name: 'Unknown user', email: '-' },
    date: transaction.createdAt || new Date().toISOString(),
    reference: transaction.metadata?.reference || transaction.metadata?.orderId || transaction.id || `TX-${index + 1}`,
    breakdown: {
      grossUgx: amount,
      platformFeeUgx: fee,
      gatewayFeeUgx: Number(transaction.metadata?.gatewayFee || 0),
      vatUgx: Number(transaction.metadata?.vat || 0),
      netToProviderUgx: kind === 'Subscription' ? 0 : net,
      netToPlatformUgx: kind === 'Subscription' ? amount : fee
    },
    walletImpact: {
      providerDeltaUgx: kind === 'Withdrawal' ? -amount : net,
      platformDeltaUgx: kind === 'Withdrawal' ? fee : kind === 'Subscription' ? amount : fee,
      externalDeltaUgx: kind === 'Withdrawal' ? net : -amount,
      note: transaction.metadata?.note || `${kind} transaction posted by backend.`
    },
    timeline: [
      { at: transaction.createdAt || new Date().toISOString(), label: 'Created', detail: `${kind} transaction created.` },
      { at: transaction.updatedAt || transaction.createdAt || new Date().toISOString(), label: status, detail: `Status is ${status}.` }
    ]
  };
};

const mapWallet = (wallet, index = 0) => ({
  providerId: wallet.providerId || `WAL-${index + 1}`,
  provider: wallet.provider || 'Unknown provider',
  avatar: wallet.avatar || null,
  initials: wallet.initials || initialsFor(wallet.provider),
  status: normalizeStatus(wallet.status, 'Disabled'),
  balanceUgx: Number(wallet.balance || wallet.balanceUgx || 0),
  totalEarnedUgx: Number(wallet.totalEarned || wallet.totalEarnedUgx || 0),
  totalWithdrawnUgx: Number(wallet.totalWithdrawn || wallet.totalWithdrawnUgx || 0),
  pendingWithdrawalsUgx: Number(wallet.pendingWithdrawals || wallet.pendingWithdrawalsUgx || 0),
  lastActivityAt: wallet.lastActivityAt || new Date().toISOString(),
  analytics: {
    avgDailyUgx: Number(wallet.analytics?.avgDailyUgx || 0),
    successRate: Number(wallet.analytics?.successRate || 0),
    lastPayoutAt: wallet.analytics?.lastPayoutAt || null,
    chargebacks: Number(wallet.analytics?.chargebacks || 0),
    payoutMethods: wallet.analytics?.payoutMethods || []
  },
  chart: wallet.chart || { labels: [], inflow: [], outflow: [], balance: [] },
  deposits: wallet.deposits || [],
  withdrawals: wallet.withdrawals || [],
  transactions: (wallet.transactions || []).map((t) => ({
    id: t.id,
    type: normalizeStatus(t.type, 'Transaction'),
    amountUgx: Number(t.amount || 0),
    direction: Number(t.netAmount || t.amount || 0) >= 0 ? 'Credit' : 'Debit',
    status: t.status === 'succeeded' ? 'Completed' : normalizeStatus(t.status, 'Pending'),
    at: t.createdAt
  }))
});

const mapSubscription = (subscription, index = 0) => ({
  id: subscription.id || `SUB-${index + 1}`,
  providerId: subscription.providerId || '',
  provider: subscription.provider || 'Unknown provider',
  avatar: subscription.avatar || null,
  initials: initialsFor(subscription.provider),
  plan: normalizeStatus(subscription.plan, 'Basic'),
  amountUgx: Number(subscription.amount || subscription.amountUgx || 0),
  expiryAt: subscription.expiresAt || subscription.expiryAt || new Date().toISOString(),
  status: normalizeStatus(subscription.status, 'Pending'),
  revenueGeneratedUgx: Number(subscription.revenueGeneratedUgx || 0),
  providerActivity: subscription.providerActivity || { listings: 0, profileViews30d: 0, contactUnlocks30d: 0, purchases30d: 0, ratingAvg: 0 },
  paymentHistory: subscription.paymentHistory || [],
  renewalHistory: subscription.renewalHistory || []
});

const ToggleSwitch = ({ id, name, checked, onChange }) => (
  <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
    <input
      type="checkbox"
      name={name}
      id={id}
      checked={checked}
      onChange={onChange}
      className="toggle-checkbox"
    />
    <label htmlFor={id} className="toggle-label"></label>
  </div>
);

const RevenueChart = () => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const loadChart = () => {
      if (typeof window.Chart === 'undefined') {
        setTimeout(loadChart, 100);
        return;
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      const ctx = canvasRef.current.getContext('2d');
      let gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(11, 32, 70, 0.2)');
      gradient.addColorStop(1, 'rgba(11, 32, 70, 0)');
      chartRef.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          datasets: [{
            label: 'Revenue (UGX)',
            data: [65000, 72000, 68000, 85000, 92000, 110000, 105000, 120000, 115000, 130000, 125000, 142800],
            borderColor: '#0B2046',
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#FACC15',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0F172A',
              padding: 12,
              titleFont: { size: 13 },
              bodyFont: { size: 14, weight: 'bold' },
              displayColors: false,
              callbacks: {
                label: function (context) {
                  return 'UGX ' + context.parsed.y.toLocaleString();
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#E2E8F0', borderDash: [5, 5], drawBorder: false },
              ticks: { callback: function (value) { return 'UGX ' + value / 1000 + 'k'; }, padding: 10 }
            },
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { padding: 10 }
            }
          }
        }
      });
    };
    loadChart();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, []);

  return <canvas ref={canvasRef} />;
};

const DistributionChart = () => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const loadChart = () => {
      if (typeof window.Chart === 'undefined') {
        setTimeout(loadChart, 100);
        return;
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      const ctx = canvasRef.current.getContext('2d');
      chartRef.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Users', 'Providers'],
          datasets: [{
            data: [94, 6],
            backgroundColor: ['#0B2046', '#FACC15'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0F172A',
              padding: 10,
              callbacks: {
                label: function (context) {
                  return ' ' + context.label + ': ' + context.parsed + '%';
                }
              }
            }
          }
        }
      });
    };
    loadChart();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, []);

  return <canvas ref={canvasRef} />;
};

const DashboardView = ({ dashboard, providersData = [], transactionsData = [], subscriptionsData = [] }) => {
  const cards = dashboard?.cards || {};
  const recentActivity = [
    ...(providersData || []).slice(0, 2).map((provider) => ({
      icon: 'ph-user-circle-plus',
      bg: 'bg-blue-50',
      color: '#0B2046',
      title: provider.moderationStatus === 'approved' ? 'Provider Approved' : 'Provider Pending Review',
      detail: `${provider.businessName || 'Provider'} is ${normalizeStatus(provider.moderationStatus, 'Pending').toLowerCase()}.`,
      at: formatDateShort(provider.updatedAt || provider.createdAt)
    })),
    ...(transactionsData || []).slice(0, 1).map((transaction) => ({
      icon: 'ph-wallet',
      bg: 'bg-emerald-50',
      color: '#10B981',
      title: `${normalizeStatus(transaction.type, 'Transaction')} Transaction`,
      detail: `${formatUgx(transaction.amount)} is ${normalizeStatus(transaction.status, 'Pending').toLowerCase()}.`,
      at: formatDateShort(transaction.updatedAt || transaction.createdAt)
    })),
    ...(subscriptionsData || []).slice(0, 1).map((subscription) => ({
      icon: 'ph-star',
      bg: 'bg-yellow-50',
      color: '#CA8A04',
      title: 'Subscription Update',
      detail: `${subscription.provider || 'Provider'} is on ${normalizeStatus(subscription.plan, 'Basic')} plan.`,
      at: formatDateShort(subscription.updatedAt || subscription.createdAt || subscription.expiresAt)
    }))
  ].slice(0, 4);
  return (
  <div className="view-fade space-y-8 max-w-7xl mx-auto">
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Platform Overview</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Welcome back. Here's what's happening on Gabla today.</p>
      </div>
      <div className="flex items-center gap-3 bg-white border rounded-lg p-1 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md text-white shadow-sm" style={{ backgroundColor: '#0B2046' }}>Today</button>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md transition" style={{ color: '#64748B' }}>7 Days</button>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md transition" style={{ color: '#64748B' }}>30 Days</button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <div className="p-6 rounded-2xl border relative overflow-hidden group transition-all" style={{ background: 'linear-gradient(135deg, #DCEBFF, #BFD8FF)', borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}></div>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i className="ph-fill ph-users text-6xl" style={{ color: '#0B2046' }}></i>
        </div>
        <div className="flex items-center gap-4 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.10)', color: '#0B2046', border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className="ph ph-users text-2xl"></i>
          </div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>Total Users</h3>
        </div>
        <div className="flex items-end justify-between relative">
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: '#0B2046' }}>{Number(cards.users ?? 0).toLocaleString('en-UG')}</h2>
          <span className="flex items-center text-sm font-extrabold px-2.5 py-1 rounded-full border" style={{ color: '#065F46', backgroundColor: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.75)' }}>
            <i className="ph ph-trend-up mr-1"></i> +12.5%
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl border relative overflow-hidden group transition-all" style={{ background: 'linear-gradient(135deg, #CCFBF1, #99F6E4)', borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}></div>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i className="ph-fill ph-storefront text-6xl" style={{ color: '#0B2046' }}></i>
        </div>
        <div className="flex items-center gap-4 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(13,148,136,0.14)', color: '#0B2046', border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className="ph ph-storefront text-2xl"></i>
          </div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>Providers</h3>
        </div>
        <div className="flex items-end justify-between relative">
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: '#0B2046' }}>{Number(cards.providers ?? 0).toLocaleString('en-UG')}</h2>
          <span className="flex items-center text-sm font-extrabold px-2.5 py-1 rounded-full border" style={{ color: '#065F46', backgroundColor: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.75)' }}>
            <i className="ph ph-trend-up mr-1"></i> +5.2%
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl border relative overflow-hidden group transition-all" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}></div>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i className="ph-fill ph-currency-dollar text-6xl" style={{ color: '#0B2046' }}></i>
        </div>
        <div className="flex items-center gap-4 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046', border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className="ph ph-currency-dollar text-2xl"></i>
          </div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>Revenue (30d)</h3>
        </div>
        <div className="flex items-end justify-between relative">
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: '#0B2046' }}>{formatUgx(cards.revenue)}</h2>
          <span className="flex items-center text-sm font-extrabold px-2.5 py-1 rounded-full border" style={{ color: '#065F46', backgroundColor: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.75)' }}>
            <i className="ph ph-trend-up mr-1"></i> +18.1%
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl border relative overflow-hidden group transition-all" style={{ background: 'linear-gradient(135deg, #FFE4E6, #FECDD3)', borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}></div>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i className="ph-fill ph-star text-6xl" style={{ color: '#9F1239' }}></i>
        </div>
        <div className="flex items-center gap-4 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#9F1239', border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className="ph ph-star text-2xl"></i>
          </div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>Active Subs</h3>
        </div>
        <div className="flex items-end justify-between relative">
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: '#9F1239' }}>{Number(cards.activeSubscriptions ?? 0).toLocaleString('en-UG')}</h2>
          <span className="flex items-center text-sm font-extrabold px-2.5 py-1 rounded-full border" style={{ color: '#9F1239', backgroundColor: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.75)' }}>
            <i className="ph ph-trend-down mr-1"></i> -1.4%
          </span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border lg:col-span-2" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.6)' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Revenue Overview</h3>
            <p className="text-sm" style={{ color: '#64748B' }}>Earnings from subscriptions and transactions</p>
          </div>
          <button className="hover:text-sidra-blue" style={{ color: '#64748B' }}>
            <i className="ph ph-dots-three text-2xl"></i>
          </button>
        </div>
        <div className="h-72 w-full">
          <RevenueChart />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.6)' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Platform Distribution</h3>
            <p className="text-sm" style={{ color: '#64748B' }}>Users vs Providers</p>
          </div>
          <button style={{ color: '#64748B' }}>
            <i className="ph ph-dots-three text-2xl"></i>
          </button>
        </div>
        <div className="h-64 w-full flex items-center justify-center relative">
          <DistributionChart />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
            <span className="text-2xl font-bold" style={{ color: '#0F172A' }}>26k</span>
            <span className="text-xs uppercase" style={{ color: '#64748B' }}>Total</span>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#0B2046' }}></span>
            <span className="text-sm" style={{ color: '#64748B' }}>Users (94%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FACC15' }}></span>
            <span className="text-sm" style={{ color: '#64748B' }}>Providers (6%)</span>
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
      <div className="bg-white p-6 rounded-2xl border lg:col-span-2" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.6)' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Recent Activity</h3>
          <button className="text-sm font-medium hover:underline" style={{ color: '#0B2046' }}>View All</button>
        </div>
        <div className="space-y-6 relative" style={{ '--tw-before-content': '' }}>
          {recentActivity.length ? recentActivity.map((activity, index) => (
            <div key={`${activity.title}-${index}`} className="relative flex items-start gap-4">
              <div className={`absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full ${activity.bg} border-4 border-white z-10`}>
                <i className={`ph ${activity.icon} text-lg`} style={{ color: activity.color }}></i>
              </div>
              <div className="pl-14">
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{activity.title}</p>
                <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{activity.detail}</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{activity.at}</p>
              </div>
            </div>
          )) : (
            <div className="p-8 rounded-2xl border text-center" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>No recent activity yet</p>
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>Backend events will appear here as providers, subscriptions and transactions are created.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[50px] opacity-30 -mr-10 -mt-10" style={{ backgroundColor: '#FACC15' }}></div>
        <h3 className="text-lg font-bold mb-6 relative z-10">Quick Actions</h3>
        <div className="space-y-3 relative z-10">
          {[
            { icon: 'ph-user-plus', label: 'Add New Admin' },
            { icon: 'ph-folder-plus', label: 'Create Category' },
            { icon: 'ph-file-text', label: 'Generate Report' },
            { icon: 'ph-megaphone', label: 'Send Broadcast' },
          ].map((action, i) => (
            <button key={i} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/20 transition backdrop-blur-sm border border-white/5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-3">
                <i className={`ph ${action.icon} text-xl`} style={{ color: '#FACC15' }}></i>
                <span className="font-medium text-sm">{action.label}</span>
              </div>
              <i className="ph ph-caret-right text-white/50"></i>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

const UsersView = ({ usersData = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const users = usersData.map(mapUser);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'All Statuses' || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>User Management</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Manage all registered users on the platform.</p>
        </div>
        <button className="px-5 py-2.5 text-white rounded-lg font-medium flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 6px -1px rgba(11,32,70,0.2)' }}>
          <i className="ph ph-plus"></i> Add User
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
        <div className="relative flex-1">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }}></i>
          <input
            type="text"
            placeholder="Search by name, email or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-lg py-2 pl-10 pr-4 outline-none transition-all"
            style={{ borderColor: '#E2E8F0' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 border text-sm rounded-lg py-2 px-4 outline-none"
          style={{ borderColor: '#E2E8F0' }}
        >
          <option>All Statuses</option>
          <option>Active</option>
          <option>Suspended</option>
          <option>Pending</option>
        </select>
        <button className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
          <i className="ph ph-funnel"></i> Filters
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: '#E2E8F0' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(248,250,252,0.8)', borderColor: '#E2E8F0', color: '#64748B' }}>
              <th className="p-4 pl-6">User Info</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Date Joined</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition group">
                <td className="p-4 pl-6">
                  <div className="flex items-center gap-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                        {user.initials}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold" style={{ color: '#0F172A' }}>{user.name}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>ID: {user.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p style={{ color: '#0F172A' }}>{user.email}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{user.phone}</p>
                </td>
                <td className="p-4" style={{ color: '#0F172A' }}>{user.date}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-md transition hover:bg-blue-50" style={{ color: '#64748B' }}><i className="ph ph-eye text-lg"></i></button>
                    {user.status === 'Active' ? (
                      <button className="p-1.5 rounded-md transition hover:bg-yellow-50 hover:text-yellow-600" style={{ color: '#64748B' }}><i className="ph ph-pause text-lg"></i></button>
                    ) : (
                      <button className="p-1.5 rounded-md transition hover:bg-emerald-50 hover:text-emerald-600" style={{ color: '#64748B' }}><i className="ph ph-play text-lg"></i></button>
                    )}
                    <button className="p-1.5 rounded-md transition hover:bg-rose-50 hover:text-rose-600" style={{ color: '#64748B' }}><i className="ph ph-trash text-lg"></i></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t flex items-center justify-between text-sm" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.5)' }}>
          <p style={{ color: '#64748B' }}>Showing <span className="font-medium" style={{ color: '#0F172A' }}>1</span> to <span className="font-medium" style={{ color: '#0F172A' }}>{filtered.length}</span> of <span className="font-medium" style={{ color: '#0F172A' }}>24,593</span> results</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded-md bg-white disabled:opacity-50" style={{ borderColor: '#E2E8F0', color: '#64748B' }} disabled>Previous</button>
            <button className="px-3 py-1 border rounded-md bg-white hover:bg-slate-50" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProvidersView = ({ providersData = [], categoriesData = [], token, onReload }) => {
  const isMobile = useIsMobile();
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? n.toLocaleString('en-UG') : '0'}`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const categoryOptions = ['All Categories', 'Plumbing', 'Electricians', 'Salon & Beauty', 'Cleaning', 'Construction', 'Auto', 'IT & Tech', 'Health', 'Catering'];
  const statusOptions = ['All Statuses', 'Approved', 'Pending', 'Rejected', 'Suspended'];
  const subscriptionOptions = ['All Subscriptions', 'Active', 'Past Due', 'Canceled', 'None'];

  const initialProviders = [
    {
      id: 'PRV-10021',
      businessName: 'Kampala Elite Plumbing',
      category: 'Plumbing',
      subscriptionStatus: 'Active',
      walletStatus: 'Enabled',
      approvalStatus: 'Pending',
      dateJoined: '2023-10-24T10:15:00Z',
      avatar: 'https://i.pravatar.cc/150?img=21',
      contact: { name: 'Joseph Ssemanda', phone: '+256 781 234 111', email: 'kampala.plumbing@gabla.ug', location: 'Kampala, Uganda' },
      description: 'Fast and reliable plumbing services across Kampala and Wakiso. Emergency call-outs, installations, and maintenance for homes and businesses.',
      servicesProducts: [
        { id: 'SP-1', type: 'Service', name: 'Emergency Leak Repair', priceUgx: 80000 },
        { id: 'SP-2', type: 'Service', name: 'Pipe Installation', priceUgx: 150000 },
        { id: 'SP-3', type: 'Product', name: 'Tap Set (Premium)', priceUgx: 120000 }
      ],
      gallery: [
        'https://images.unsplash.com/photo-1581579185169-4b1ce1f44c3a?auto=format&fit=crop&w=800&q=60',
        'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=60',
        'https://images.unsplash.com/photo-1600566753151-384129cf4e3f?auto=format&fit=crop&w=800&q=60'
      ],
      walletBalanceUgx: 325000,
      recentTransactions: [
        { id: 'TX-90021', type: 'Purchase', amountUgx: 95000, status: 'Completed', date: '2023-10-24T12:10:00Z' },
        { id: 'TX-90020', type: 'Contact Unlock', amountUgx: 1500, status: 'Completed', date: '2023-10-24T11:40:00Z' },
        { id: 'TX-90019', type: 'Withdrawal', amountUgx: 200000, status: 'Pending', date: '2023-10-23T09:20:00Z' }
      ],
      contactUnlocks: 64,
      profileVisits: 1420,
      ratingAvg: 4.6,
      ratingCount: 128
    },
    {
      id: 'PRV-10020',
      businessName: 'Nakasero Spark Electric',
      category: 'Electricians',
      subscriptionStatus: 'Active',
      walletStatus: 'Enabled',
      approvalStatus: 'Approved',
      dateJoined: '2023-10-18T08:30:00Z',
      avatar: 'https://i.pravatar.cc/150?img=12',
      contact: { name: 'Grace Nantongo', phone: '+256 703 555 901', email: 'spark.electric@gabla.ug', location: 'Kampala, Uganda' },
      description: 'Certified electricians for residential and commercial work. Wiring, lighting, solar setup, and troubleshooting with safety-first service.',
      servicesProducts: [
        { id: 'SP-4', type: 'Service', name: 'House Wiring Inspection', priceUgx: 60000 },
        { id: 'SP-5', type: 'Service', name: 'Solar Installation (Basic)', priceUgx: 850000 }
      ],
      gallery: [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=60',
        'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=60'
      ],
      walletBalanceUgx: 1289000,
      recentTransactions: [
        { id: 'TX-90018', type: 'Subscription', amountUgx: 29000, status: 'Completed', date: '2023-10-18T08:40:00Z' },
        { id: 'TX-90017', type: 'Purchase', amountUgx: 420000, status: 'Completed', date: '2023-10-20T15:05:00Z' }
      ],
      contactUnlocks: 112,
      profileVisits: 3920,
      ratingAvg: 4.8,
      ratingCount: 311
    },
    {
      id: 'PRV-10019',
      businessName: 'Kireka Cleaners',
      category: 'Cleaning',
      subscriptionStatus: 'Past Due',
      walletStatus: 'Enabled',
      approvalStatus: 'Approved',
      dateJoined: '2023-09-29T14:05:00Z',
      avatar: null,
      initials: 'KC',
      contact: { name: 'Hassan Sserunkuma', phone: '+256 789 440 220', email: 'kireka.cleaners@gabla.ug', location: 'Wakiso, Uganda' },
      description: 'Home and office cleaning with weekly and monthly packages. Deep cleaning, move-in/move-out, and post-construction clean-ups.',
      servicesProducts: [
        { id: 'SP-6', type: 'Service', name: 'Deep Cleaning (2BR)', priceUgx: 150000 },
        { id: 'SP-7', type: 'Service', name: 'Office Cleaning (Small)', priceUgx: 220000 }
      ],
      gallery: [
        'https://images.unsplash.com/photo-1581579185169-4b1ce1f44c3a?auto=format&fit=crop&w=800&q=60'
      ],
      walletBalanceUgx: 89000,
      recentTransactions: [
        { id: 'TX-90016', type: 'Withdrawal', amountUgx: 80000, status: 'Failed', date: '2023-10-05T11:22:00Z' },
        { id: 'TX-90015', type: 'Purchase', amountUgx: 120000, status: 'Completed', date: '2023-10-02T08:45:00Z' }
      ],
      contactUnlocks: 41,
      profileVisits: 980,
      ratingAvg: 4.3,
      ratingCount: 74
    },
    {
      id: 'PRV-10018',
      businessName: 'Nabugabo Designs',
      category: 'IT & Tech',
      subscriptionStatus: 'None',
      walletStatus: 'Disabled',
      approvalStatus: 'Rejected',
      dateJoined: '2023-09-10T16:18:00Z',
      avatar: 'https://i.pravatar.cc/150?img=5',
      contact: { name: 'Patricia Nakitto', phone: '+256 772 101 909', email: 'nabugabo.designs@gabla.ug', location: 'Kampala, Uganda' },
      description: 'Branding and UI design studio. Logos, social media kits, landing pages, and product design for startups and SMEs.',
      servicesProducts: [
        { id: 'SP-8', type: 'Service', name: 'Logo Design Package', priceUgx: 250000 },
        { id: 'SP-9', type: 'Service', name: 'Landing Page UI', priceUgx: 450000 }
      ],
      gallery: [
        'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=800&q=60',
        'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=60'
      ],
      walletBalanceUgx: 0,
      recentTransactions: [
        { id: 'TX-90014', type: 'Subscription', amountUgx: 29000, status: 'Failed', date: '2023-09-11T10:12:00Z' }
      ],
      contactUnlocks: 9,
      profileVisits: 320,
      ratingAvg: 4.1,
      ratingCount: 19
    },
    {
      id: 'PRV-10017',
      businessName: 'Mbarara Auto Care',
      category: 'Auto',
      subscriptionStatus: 'Canceled',
      walletStatus: 'Enabled',
      approvalStatus: 'Suspended',
      dateJoined: '2023-08-22T09:00:00Z',
      avatar: 'https://i.pravatar.cc/150?img=33',
      contact: { name: 'Allan Kasaija', phone: '+256 701 778 300', email: 'mbarara.autocare@gabla.ug', location: 'Mbarara, Uganda' },
      description: 'Vehicle servicing and diagnostics. Oil change, brake checks, detailing, and quick repairs with transparent pricing.',
      servicesProducts: [
        { id: 'SP-10', type: 'Service', name: 'Full Service Package', priceUgx: 180000 },
        { id: 'SP-11', type: 'Product', name: 'Engine Oil (5L)', priceUgx: 95000 }
      ],
      gallery: [
        'https://images.unsplash.com/photo-1515923160492-5d7b58d26167?auto=format&fit=crop&w=800&q=60'
      ],
      walletBalanceUgx: 540000,
      recentTransactions: [
        { id: 'TX-90013', type: 'Withdrawal', amountUgx: 300000, status: 'Completed', date: '2023-09-01T13:30:00Z' },
        { id: 'TX-90012', type: 'Purchase', amountUgx: 180000, status: 'Completed', date: '2023-08-25T10:00:00Z' }
      ],
      contactUnlocks: 27,
      profileVisits: 640,
      ratingAvg: 4.0,
      ratingCount: 52
    }
  ];

  const [providers, setProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [subscriptionFilter, setSubscriptionFilter] = useState('All Subscriptions');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [menuState, setMenuState] = useState({ id: null, anchorEl: null, position: null });
  const [providerListings, setProviderListings] = useState([]);
  const [providerListingsLoading, setProviderListingsLoading] = useState(false);

  useEffect(() => {
    if (!selectedId || activeTab !== 'Services') return undefined;
    let active = true;
    setProviderListingsLoading(true);
    apiRequest(`/admin/listings?providerId=${encodeURIComponent(selectedId)}&limit=100`, { token })
      .then((result) => {
        if (!active) return;
        setProviderListings(result?.items || []);
      })
      .catch(() => {
        if (active) setProviderListings([]);
      })
      .finally(() => {
        if (active) setProviderListingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, activeTab, token]);
  const emptyProviderForm = {
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    whatsapp: '',
    website: '',
    categoryId: '',
    description: '',
    locationName: '',
    address: '',
    city: '',
    region: '',
    country: 'Uganda',
    district: '',
    latitude: null,
    longitude: null
  };
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [providerForm, setProviderForm] = useState(emptyProviderForm);
  const [providerFormSaving, setProviderFormSaving] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [districts, setDistricts] = useState([]);

  // Static reference list, fetched once - backend is the single source of truth so this and
  // public_app's district picker never drift apart.
  useEffect(() => {
    let active = true;
    apiRequest('/providers/districts')
      .then((result) => {
        if (active) setDistricts(result?.items || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const locationInputRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerObjRef = useRef(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsOpen, setLocationSuggestionsOpen] = useState(false);
  const placesSessionTokenRef = useRef(null);
  const locationDebounceRef = useRef(null);

  useEffect(() => {
    if (!addProviderOpen) {
      setLocationSuggestions([]);
      setLocationSuggestionsOpen(false);
      placesSessionTokenRef.current = null;
    }
  }, [addProviderOpen]);

  const handleLocationInputChange = (value) => {
    setProviderForm((form) => ({ ...form, locationName: value }));
    clearTimeout(locationDebounceRef.current);
    if (!value.trim()) {
      setLocationSuggestions([]);
      setLocationSuggestionsOpen(false);
      return;
    }
    if (!placesSessionTokenRef.current) placesSessionTokenRef.current = newSessionToken();
    locationDebounceRef.current = setTimeout(async () => {
      const results = await placesAutocomplete(value, placesSessionTokenRef.current);
      setLocationSuggestions(results);
      setLocationSuggestionsOpen(results.length > 0);
    }, 300);
  };

  const selectLocationSuggestion = async (suggestion) => {
    setLocationSuggestionsOpen(false);
    setProviderForm((form) => ({ ...form, locationName: suggestion.text }));
    const details = await placeDetails(suggestion.placeId, placesSessionTokenRef.current);
    placesSessionTokenRef.current = null;
    if (!details) return;
    const { city, region, country } = parseNewAddressComponents(details.addressComponents);
    setProviderForm((form) => ({
      ...form,
      locationName: details.formattedAddress || suggestion.text,
      address: details.formattedAddress || form.address,
      city: city || form.city,
      region: region || form.region,
      country: country || form.country,
      latitude: details.location?.latitude ?? form.latitude,
      longitude: details.location?.longitude ?? form.longitude
    }));
  };

  useEffect(() => {
    if (!mapPickerOpen) return undefined;
    let active = true;
    loadGoogleMaps()
      .then(async (google) => {
        if (!active || !mapContainerRef.current) return;
        let center = UGANDA_DEFAULT_CENTER;
        let zoom = 7;
        if (providerForm.latitude != null && providerForm.longitude != null) {
          center = { lat: providerForm.latitude, lng: providerForm.longitude };
          zoom = 16;
        } else {
          const query = providerForm.locationName.trim() ||
            [providerForm.address, providerForm.city, providerForm.region, providerForm.country].filter(Boolean).join(', ');
          const geocoded = await geocodeAddress(google, query);
          if (geocoded) {
            center = { lat: geocoded.lat(), lng: geocoded.lng() };
            zoom = 14;
          }
        }
        if (!active || !mapContainerRef.current) return;
        const map = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false
        });
        const marker = new google.maps.Marker({ position: center, map, draggable: true });
        map.addListener('click', (e) => marker.setPosition(e.latLng));
        mapObjRef.current = map;
        markerObjRef.current = marker;
      })
      .catch((error) => {
        window.alert(error.message || 'Unable to load the map');
        setMapPickerOpen(false);
      });
    return () => {
      active = false;
      mapObjRef.current = null;
      markerObjRef.current = null;
    };
  }, [mapPickerOpen]);

  const confirmMapPick = () => {
    const pos = markerObjRef.current?.getPosition();
    if (pos) {
      setProviderForm((form) => ({ ...form, latitude: pos.lat(), longitude: pos.lng() }));
    }
    setMapPickerOpen(false);
  };

  const selectedProvider = providers.find(p => p.id === selectedId) || null;
  const activeMenuProvider = providers.find((p) => p.id === menuState.id) || null;
  const flatCategoryOptions = flattenCategoriesWithPath(categoriesData);
  const selectedCategoryOption = flatCategoryOptions.find((category) => category.id === providerForm.categoryId) || null;
  const closeMenu = () => setMenuState({ id: null, anchorEl: null, position: null });
  const getMenuPosition = (anchorEl) => {
    if (!anchorEl || typeof window === 'undefined') return null;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 192;
    const estimatedHeight = 252;
    const left = Math.min(window.innerWidth - menuWidth - 16, Math.max(16, rect.right - menuWidth));
    const nextTop = rect.bottom + 8 + estimatedHeight > window.innerHeight - 16
      ? Math.max(16, rect.top - estimatedHeight - 8)
      : rect.bottom + 8;
    return { top: nextTop, left };
  };

  useEffect(() => {
    setProviders(providersData.map(mapProvider));
  }, [providersData]);

  useEffect(() => {
    const onClick = (e) => {
      const target = e.target;
      if (!target.closest?.('[data-menu-root="true"]')) {
        closeMenu();
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!menuState.id || !menuState.anchorEl) return undefined;

    const syncPosition = () => {
      if (!menuState.anchorEl?.isConnected) {
        closeMenu();
        return;
      }
      setMenuState((prev) => {
        if (prev.id !== menuState.id) return prev;
        return { ...prev, position: getMenuPosition(menuState.anchorEl) };
      });
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [menuState.id, menuState.anchorEl]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, statusFilter, subscriptionFilter]);

  const filtered = providers.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q ||
      p.businessName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.contact.email.toLowerCase().includes(q) ||
      p.contact.phone.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === 'All Categories' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'All Statuses' || p.approvalStatus === statusFilter;
    const matchesSubscription = subscriptionFilter === 'All Subscriptions' || p.subscriptionStatus === subscriptionFilter;
    return matchesQuery && matchesCategory && matchesStatus && matchesSubscription;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const badge = (variant) => {
    const map = {
      Approved: 'bg-emerald-100 text-emerald-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Rejected: 'bg-rose-100 text-rose-800',
      Suspended: 'bg-slate-200 text-slate-700',
      Active: 'bg-emerald-100 text-emerald-800',
      'Past Due': 'bg-yellow-100 text-yellow-800',
      Canceled: 'bg-rose-100 text-rose-800',
      None: 'bg-slate-200 text-slate-700',
      Enabled: 'bg-blue-100 text-blue-800',
      Disabled: 'bg-slate-200 text-slate-700',
      Completed: 'bg-emerald-100 text-emerald-800',
      Failed: 'bg-rose-100 text-rose-800'
    };
    return map[variant] || 'bg-slate-200 text-slate-700';
  };

  const Avatar = ({ provider }) => {
    if (provider.avatar) {
      return <img src={provider.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />;
    }
    return (
      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
        {provider.initials || provider.businessName.split(' ').slice(0, 2).map(s => s[0]).join('')}
      </div>
    );
  };

  const updateProvider = async (id, patch) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    if (!token) return;
    if (patch.approvalStatus) {
      const statusMap = { Approved: 'approved', Rejected: 'rejected', Suspended: 'suspended', Pending: 'pending' };
      try {
        await apiRequest(`/admin/providers/${id}/status`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({ status: statusMap[patch.approvalStatus] || 'pending' })
        });
        onReload?.();
      } catch (error) {
        window.alert(error.message || 'Unable to update provider');
      }
    }
    if (patch.onlinePaymentsEnabled !== undefined) {
      try {
        await apiRequest(`/admin/providers/${id}/online-payments`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({ enabled: patch.onlinePaymentsEnabled })
        });
        onReload?.();
      } catch (error) {
        window.alert(error.message || 'Unable to update online payments');
      }
    }
  };

  const submitProviderInvite = async (event) => {
    event.preventDefault();
    if (!providerForm.businessName.trim() || !providerForm.contactName.trim() || !providerForm.email.trim() || !providerForm.categoryId) {
      window.alert('Business name, contact person, email, and category are required.');
      return;
    }
    setProviderFormSaving(true);
    try {
      await apiRequest('/providers/admin', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: providerForm.contactName.trim(),
          email: providerForm.email.trim(),
          phone: providerForm.phone.trim() || undefined,
          businessName: providerForm.businessName.trim(),
          description: providerForm.description.trim(),
          categoryId: providerForm.categoryId,
          location: {
            address: providerForm.address.trim() || undefined,
            city: providerForm.city.trim() || undefined,
            region: providerForm.region.trim() || undefined,
            country: providerForm.country.trim() || 'Uganda',
            district: providerForm.district || undefined,
            ...(providerForm.latitude != null && providerForm.longitude != null
              ? { geo: { type: 'Point', coordinates: [providerForm.longitude, providerForm.latitude] } }
              : {})
          },
          contact: {
            email: providerForm.email.trim(),
            phone: providerForm.phone.trim() || null,
            whatsapp: providerForm.whatsapp.trim() || null,
            website: providerForm.website.trim() || null
          },
          customFields: {
            assignedCategoryId: providerForm.categoryId
          }
        })
      });
      setProviderForm(emptyProviderForm);
      setAddProviderOpen(false);
      await onReload?.();
    } catch (error) {
      window.alert(error.message || 'Unable to create provider invitation');
    } finally {
      setProviderFormSaving(false);
    }
  };

  const deleteProvider = async (provider) => {
    if (!provider?.id || !token) return;
    const confirmed = window.confirm(`Delete provider "${provider.businessName}"? This removes the provider profile and related provider records.`);
    if (!confirmed) return;

    try {
      await apiRequest(`/admin/providers/${provider.id}`, {
        token,
        method: 'DELETE'
      });
      setProviders((prev) => prev.filter((item) => item.id !== provider.id));
      if (selectedId === provider.id) {
        setSelectedId(null);
        setActiveTab('Overview');
      }
      closeMenu();
      onReload?.();
    } catch (error) {
      window.alert(error.message || 'Unable to delete provider');
    }
  };

  const resendGoogleLink = async (provider) => {
    if (!provider?.id || !token) return;
    try {
      await apiRequest(`/providers/admin/${provider.id}/resend-google-link`, { token, method: 'POST' });
      window.alert(`Reconnect link sent to ${provider.contact?.email || 'the provider'}.`);
    } catch (error) {
      window.alert(error.message || 'Unable to send the reconnect link');
    }
    closeMenu();
  };

  const actions = (p) => ([
    { label: 'View Profile', onClick: () => { setSelectedId(p.id); setActiveTab('Overview'); } },
    { label: 'Approve', onClick: () => updateProvider(p.id, { approvalStatus: 'Approved' }) },
    { label: 'Reject', onClick: () => updateProvider(p.id, { approvalStatus: 'Rejected' }) },
    { label: 'Suspend', onClick: () => updateProvider(p.id, { approvalStatus: 'Suspended' }) },
    { label: 'Resend Google Link', onClick: () => resendGoogleLink(p) },
    { label: 'Delete Provider', tone: 'danger', onClick: () => deleteProvider(p) }
  ]);

  const Tabs = ({ active, onChange }) => {
    const tabs = ['Overview', 'Services', 'Wallet', 'Transactions', 'Analytics'];
    return (
      <div className="flex items-center gap-2 bg-slate-50 border rounded-xl p-1" style={{ borderColor: '#E2E8F0' }}>
        {tabs.map((t) => {
          const isActive = active === t;
          return (
            <button
              key={t}
              onClick={() => onChange(t)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition"
              style={isActive ? { backgroundColor: '#0B2046', color: 'white' } : { color: '#64748B' }}
            >
              {t}
            </button>
          );
        })}
      </div>
    );
  };

  const StatCard = ({ icon, label, value, sub }) => (
    <div className="bg-white rounded-2xl border p-5" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.7)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#0F172A' }}>{value}</p>
          {sub ? <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{sub}</p> : null}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046' }}>
          <i className={`ph ${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );

  const Drawer = ({ open, onClose, provider }) => (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 bg-slate-900/30 z-[998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-x-0 bottom-0 max-h-[88vh] w-full sm:inset-x-auto sm:bottom-auto sm:top-20 sm:right-0 sm:h-[calc(100vh-5rem)] sm:max-h-none sm:w-[560px] lg:w-[640px] bg-white z-[999] border-t sm:border-t-0 sm:border-l rounded-t-2xl sm:rounded-none flex flex-col"
            style={{ borderColor: '#E2E8F0' }}
            initial={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <SheetHandle />
            <div className="p-6 border-b" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {provider ? <Avatar provider={provider} /> : null}
                  <div>
                    <p className="text-lg font-bold" style={{ color: '#0F172A' }}>{provider?.businessName}</p>
                    <p className="text-sm" style={{ color: '#64748B' }}>{provider?.category} • Joined {formatDate(provider?.dateJoined)}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
                  <i className="ph ph-x text-xl"></i>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(provider?.approvalStatus)}`}>{provider?.approvalStatus}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(provider?.subscriptionStatus)}`}>{provider?.subscriptionStatus} Subscription</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(provider?.walletStatus)}`}>Wallet {provider?.walletStatus}</span>
                {provider ? (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100" style={{ color: '#0F172A' }}>
                    Online payments
                    <ToggleSwitch
                      id={`online-payments-${provider.id}`}
                      name={`online-payments-${provider.id}`}
                      checked={provider.onlinePaymentsEnabled}
                      onChange={() => updateProvider(provider.id, { onlinePaymentsEnabled: !provider.onlinePaymentsEnabled })}
                    />
                  </span>
                ) : null}
                {provider ? (
                  <a
                    href={`${PUBLIC_APP_URL}/provider/${provider.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                  >
                    View public profile ↗
                  </a>
                ) : null}
                {provider ? (
                  <button
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                    onClick={() => resendGoogleLink(provider)}
                  >
                    Resend Google link
                  </button>
                ) : null}
                <button
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-rose-50 transition"
                  style={{ borderColor: 'rgba(244,63,94,0.25)', color: '#E11D48' }}
                  onClick={() => deleteProvider(provider)}
                >
                  Delete Provider
                </button>
              </div>

              <div className="mt-5">
                <Tabs active={activeTab} onChange={setActiveTab} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {provider && activeTab === 'Overview' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard icon="ph-wallet" label="Wallet Balance" value={formatUgx(provider.walletBalanceUgx)} sub="Available balance" />
                    <StatCard icon="ph-star" label="Rating" value={`${provider.ratingAvg.toFixed(1)} / 5`} sub={`${provider.ratingCount} reviews`} />
                    <StatCard icon="ph-eye" label="Profile Visits" value={provider.profileVisits.toLocaleString('en-UG')} sub="Last 30 days" />
                    <StatCard icon="ph-lock-key" label="Contact Unlocks" value={provider.contactUnlocks.toLocaleString('en-UG')} sub="Total unlocks" />
                  </div>

                  <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Business Info</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Contact Person</p>
                        <p className="mt-1 font-medium" style={{ color: '#0F172A' }}>{provider.contact.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Phone</p>
                        <p className="mt-1 font-medium" style={{ color: '#0F172A' }}>{provider.contact.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Email</p>
                        <p className="mt-1 font-medium" style={{ color: '#0F172A' }}>{provider.contact.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Location</p>
                        <p className="mt-1 font-medium" style={{ color: '#0F172A' }}>{provider.contact.location}</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Description</p>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: '#334155' }}>{provider.description}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Gallery</h3>
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{provider.gallery.length} items</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {provider.gallery.map((src, i) => (
                        <div key={i} className="rounded-xl overflow-hidden bg-slate-100 aspect-square">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {provider && activeTab === 'Services' ? (
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Services & Products</h3>
                    <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{providerListingsLoading ? '…' : `${providerListings.length} items`}</span>
                  </div>
                  {providerListingsLoading ? (
                    <p className="text-sm" style={{ color: '#64748B' }}>Loading…</p>
                  ) : providerListings.length ? (
                    <div className="space-y-3">
                      {providerListings.map((sp) => (
                        <div key={sp.id} className="flex items-center justify-between p-4 rounded-xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{sp.name}</p>
                            <p className="text-xs mt-1" style={{ color: '#64748B' }}>{sp.type} &middot; {sp.status}</p>
                          </div>
                          <span className="text-sm font-bold" style={{ color: '#0B2046' }}>{formatUgx(sp.price)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: '#64748B' }}>This provider hasn&apos;t added any products or services yet.</p>
                  )}
                </div>
              ) : null}

              {provider && activeTab === 'Wallet' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard icon="ph-wallet" label="Balance" value={formatUgx(provider.walletBalanceUgx)} sub="Current wallet balance" />
                    <StatCard icon="ph-shield-check" label="Wallet Status" value={provider.walletStatus} sub="Provider wallet availability" />
                  </div>
                  <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Recent Wallet Activity</h3>
                    <div className="space-y-3">
                      {provider.recentTransactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: '#E2E8F0' }}>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{t.type}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{formatDate(t.date)} • {t.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: '#0B2046' }}>{formatUgx(t.amountUgx)}</p>
                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge(t.status)}`}>{t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {provider && activeTab === 'Transactions' ? (
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                  <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Recent Transactions</h3>
                  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#E2E8F0' }}>
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(248,250,252,0.8)', color: '#64748B' }}>
                          <th className="p-3">ID</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                        {provider.recentTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition">
                            <td className="p-3 font-medium" style={{ color: '#0F172A' }}>{t.id}</td>
                            <td className="p-3" style={{ color: '#334155' }}>{t.type}</td>
                            <td className="p-3 font-semibold" style={{ color: '#0B2046' }}>{formatUgx(t.amountUgx)}</td>
                            <td className="p-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge(t.status)}`}>{t.status}</span></td>
                            <td className="p-3" style={{ color: '#64748B' }}>{formatDate(t.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {provider && activeTab === 'Analytics' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard icon="ph-chart-line-up" label="Conversion" value={`${Math.min(100, Math.round((provider.contactUnlocks / Math.max(1, provider.profileVisits)) * 100))}%`} sub="Unlocks / visits" />
                    <StatCard icon="ph-user-focus" label="Engagement" value={`${Math.min(100, Math.round((provider.profileVisits / 5000) * 100))}%`} sub="Relative activity score" />
                  </div>
                  <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Performance</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Response Rate', value: `${88 + (provider.ratingAvg - 4) * 5}%` },
                        { label: 'Repeat Users', value: `${12 + Math.floor(provider.contactUnlocks / 20)}%` },
                        { label: 'Completion', value: `${90 + Math.floor(provider.ratingAvg)}%` }
                      ].map((m) => (
                        <div key={m.label} className="p-4 rounded-xl bg-slate-50 border" style={{ borderColor: '#E2E8F0' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{m.label}</p>
                          <p className="text-xl font-bold mt-1" style={{ color: '#0B2046' }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="relative view-fade space-y-6 max-w-7xl mx-auto pb-12">
      {addProviderOpen
        ? createPortal(
            <motion.div
                className="fixed inset-0 z-[1100] bg-white flex flex-col"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
              >
            <div className="h-20 shrink-0 border-b flex items-center justify-between px-5 sm:px-8" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setAddProviderOpen(false)}
                  className="w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-slate-50 transition shrink-0"
                  style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                  title="Back to providers"
                >
                  <i className="ph ph-arrow-left text-xl"></i>
                </button>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate" style={{ color: '#0F172A' }}>Invite a service provider</h1>
                  <p className="text-sm truncate" style={{ color: '#64748B' }}>Create the provider record and send their secure registration link.</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm font-semibold" style={{ color: '#087F70' }}>
                <i className="ph ph-envelope-simple text-lg"></i>
                Invitation sent automatically
              </div>
            </div>

            <form onSubmit={submitProviderInvite} className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10">
                <div className="space-y-10">
                  <section>
                    <div className="mb-5">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#087F70' }}>Business details</p>
                      <h2 className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>Who are we inviting?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Business or company name *</label>
                        <input
                          required
                          value={providerForm.businessName}
                          onChange={(e) => setProviderForm((form) => ({ ...form, businessName: e.target.value }))}
                          placeholder="e.g. Acacia Family Clinic"
                          className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                          style={{ borderColor: '#E2E8F0' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Primary contact person *</label>
                        <input
                          required
                          value={providerForm.contactName}
                          onChange={(e) => setProviderForm((form) => ({ ...form, contactName: e.target.value }))}
                          placeholder="Full name"
                          className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                          style={{ borderColor: '#E2E8F0' }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Short description</label>
                        <textarea
                          value={providerForm.description}
                          onChange={(e) => setProviderForm((form) => ({ ...form, description: e.target.value }))}
                          placeholder="A short description of the services this provider offers."
                          className="w-full min-h-28 bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none resize-y"
                          style={{ borderColor: '#E2E8F0' }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="border-t pt-8" style={{ borderColor: '#E2E8F0' }}>
                    <div className="mb-5">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#087F70' }}>Classification</p>
                      <h2 className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>Assign category and app experience</h2>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Category *</label>
                      <CategoryPicker
                        required
                        tree={categoriesData}
                        value={providerForm.categoryId}
                        onChange={(id) => setProviderForm((form) => ({ ...form, categoryId: id }))}
                        placeholder="Search or browse categories…"
                      />
                      <p className="mt-1.5 text-xs" style={{ color: '#64748B' }}>Type to search every level, or open a category to browse its subcategories. Pick the most specific one that applies.</p>
                    </div>
                    {selectedCategoryOption ? (
                      <div className="mt-4 px-4 py-3 rounded-lg border flex items-center gap-3" style={{ borderColor: '#CDE9E4', backgroundColor: '#F0FAF8' }}>
                        <i className="ph ph-layout text-xl" style={{ color: '#087F70' }}></i>
                        <p className="text-sm" style={{ color: '#335B56' }}>
                          This provider will use the <strong>{normalizeStatus(selectedCategoryOption.raw.appView || selectedCategoryOption.raw.viewType, 'Directory')}</strong> profile experience.
                        </p>
                      </div>
                    ) : null}
                  </section>

                  <section className="border-t pt-8" style={{ borderColor: '#E2E8F0' }}>
                    <div className="mb-5">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#087F70' }}>Contact details</p>
                      <h2 className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>Where should customers reach them?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {[
                        ['Email address *', 'email', 'email', 'name@company.com'],
                        ['Phone number', 'phone', 'tel', '+256 700 000000'],
                        ['WhatsApp number', 'whatsapp', 'tel', '+256 700 000000'],
                        ['Website (optional)', 'website', 'url', 'https://company.com']
                      ].map(([label, key, type, placeholder]) => (
                        <div key={key}>
                          <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>{label}</label>
                          <input
                            required={key === 'email'}
                            type={type}
                            value={providerForm[key]}
                            onChange={(e) => setProviderForm((form) => ({ ...form, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                            style={{ borderColor: '#E2E8F0' }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="border-t pt-8" style={{ borderColor: '#E2E8F0' }}>
                    <div className="mb-5">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#087F70' }}>Location</p>
                      <h2 className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>Where is the provider based?</h2>
                    </div>

                    <div className="mb-5 relative">
                      <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Search location name</label>
                      <input
                        ref={locationInputRef}
                        value={providerForm.locationName}
                        onChange={(e) => handleLocationInputChange(e.target.value)}
                        onFocus={() => setLocationSuggestionsOpen(locationSuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setLocationSuggestionsOpen(false), 150)}
                        placeholder="Start typing a place in Uganda, e.g. Acacia Mall, Kampala"
                        className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                        style={{ borderColor: '#E2E8F0' }}
                        autoComplete="off"
                      />
                      {locationSuggestionsOpen && locationSuggestions.length ? (
                        <div
                          className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden"
                          style={{ borderColor: '#E2E8F0' }}
                        >
                          {locationSuggestions.map((s) => (
                            <button
                              key={s.placeId}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectLocationSuggestion(s)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition flex flex-col"
                            >
                              <span className="font-semibold" style={{ color: '#0F172A' }}>{s.mainText}</span>
                              {s.secondaryText ? <span className="text-xs" style={{ color: '#64748B' }}>{s.secondaryText}</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setMapPickerOpen(true)}
                          className="px-4 py-2 rounded-lg border font-semibold text-sm hover:bg-slate-50 transition flex items-center gap-2"
                          style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                        >
                          <i className="ph ph-map-pin"></i>
                          Pick coordinates on map
                        </button>
                        {providerForm.latitude != null && providerForm.longitude != null ? (
                          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#087F70' }}>
                            <i className="ph ph-check-circle"></i>
                            {providerForm.latitude.toFixed(5)}, {providerForm.longitude.toFixed(5)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#94A3B8' }}>No coordinates picked yet</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {[
                        ['City', 'city', 'e.g. Kampala'],
                        ['Country', 'country', 'Uganda']
                      ].map(([label, key, placeholder]) => (
                        <div key={key}>
                          <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>{label}</label>
                          <input
                            value={providerForm[key]}
                            onChange={(e) => setProviderForm((form) => ({ ...form, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                            style={{ borderColor: '#E2E8F0' }}
                          />
                        </div>
                      ))}
                      <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>District</label>
                        <select
                          value={providerForm.district}
                          onChange={(e) => setProviderForm((form) => ({ ...form, district: e.target.value }))}
                          className="w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm outline-none"
                          style={{ borderColor: '#E2E8F0' }}
                        >
                          <option value="">Select district (shoppers can filter by this)</option>
                          {districts.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="lg:sticky lg:top-8 lg:self-start">
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                    <div className="p-5" style={{ backgroundColor: '#0B2046' }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl" style={{ backgroundColor: '#FACC15', color: '#0B2046' }}>G</div>
                      <h3 className="mt-5 text-lg font-bold text-white">Invitation preview</h3>
                      <p className="mt-2 text-sm leading-6" style={{ color: '#B9C8DD' }}>Gabla will create a pending provider record and email a secure registration link valid for 7 days.</p>
                    </div>
                    <div className="p-5 space-y-4 bg-white">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Provider</p>
                        <p className="mt-1 text-sm font-bold" style={{ color: '#0F172A' }}>{providerForm.businessName || 'Business name'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Recipient</p>
                        <p className="mt-1 text-sm font-semibold break-all" style={{ color: '#334155' }}>{providerForm.email || 'provider@email.com'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Category</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: '#334155' }}>
                          {selectedCategoryOption?.path || 'Not selected'}
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="sticky bottom-0 border-t bg-white px-5 sm:px-8 py-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 -10px 30px -24px rgba(11,32,70,0.35)' }}>
                <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAddProviderOpen(false)}
                    className="px-5 py-2.5 rounded-lg border font-semibold text-sm hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#334155' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={providerFormSaving}
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60 flex items-center gap-2"
                    style={{ backgroundColor: '#0B2046' }}
                  >
                    <i className="ph ph-paper-plane-tilt text-lg"></i>
                    {providerFormSaving ? 'Creating invitation...' : 'Create and send invitation'}
                  </button>
                </div>
              </div>
            </form>
            </motion.div>,
            document.body
          )
        : null}

      {mapPickerOpen
        ? createPortal(
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
              <div className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl border" style={{ borderColor: '#E2E8F0', boxShadow: '0 24px 60px -30px rgba(11,32,70,0.55)' }}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#087F70' }}>Pick coordinates</p>
                    <h3 className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>Drag the pin to the exact spot</h3>
                  </div>
                  <button type="button" onClick={() => setMapPickerOpen(false)} className="p-2 rounded-lg hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
                    <i className="ph ph-x text-xl"></i>
                  </button>
                </div>
                <div ref={mapContainerRef} className="w-full" style={{ height: '420px', backgroundColor: '#F1F5F9' }} />
                <div className="p-5 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E2E8F0' }}>
                  <button
                    type="button"
                    onClick={() => setMapPickerOpen(false)}
                    className="px-5 py-2.5 rounded-lg border font-semibold text-sm hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#334155' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmMapPick}
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white"
                    style={{ backgroundColor: '#0B2046' }}
                  >
                    Use this location
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Providers</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Manage providers, approvals, subscriptions, and wallets.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2.5 text-white rounded-lg font-medium transition hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 6px -1px rgba(11,32,70,0.2)' }}
            onClick={() => {
              setProviderForm(emptyProviderForm);
              setAddProviderOpen(true);
            }}
          >
            <i className="ph ph-plus"></i> Add Provider
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
          <div className="relative">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }}></i>
            <input
              type="text"
              placeholder="Search providers by name, category, phone or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 pl-10 pr-4 outline-none transition-all"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ borderColor: '#E2E8F0' }}
          >
            {categoryOptions.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ borderColor: '#E2E8F0' }}
          >
            {statusOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
          <select
            value={subscriptionFilter}
            onChange={(e) => setSubscriptionFilter(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ borderColor: '#E2E8F0' }}
          >
            {subscriptionOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: '#E2E8F0' }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
              {filtered.length} providers
            </p>
            <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
              Page {page} of {totalPages}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(248,250,252,0.8)', borderColor: '#E2E8F0', color: '#64748B' }}>
                  <th className="p-4 pl-6">Provider</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Subscription</th>
                  <th className="p-4">Wallet</th>
                  <th className="p-4">Approval</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
                <AnimatePresence mode="popLayout">
                  {pageItems.map((p) => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                      className="hover:bg-slate-50/50 transition cursor-pointer"
                      onClick={() => { setSelectedId(p.id); setActiveTab('Overview'); }}
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar provider={p} />
                          <div className="min-w-0">
                            <p className="font-semibold truncate" style={{ color: '#0F172A' }}>{p.businessName}</p>
                            <p className="text-xs truncate" style={{ color: '#64748B' }}>{p.contact.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4" style={{ color: '#0F172A' }}>{p.category}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge(p.subscriptionStatus)}`}>
                          {p.subscriptionStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge(p.walletStatus)}`}>
                          {p.walletStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge(p.approvalStatus)}`}>
                          {p.approvalStatus}
                        </span>
                      </td>
                      <td className="p-4" style={{ color: '#64748B' }}>{formatDate(p.dateJoined)}</td>
                      <td className="p-4 pr-6 text-right">
                        <div data-menu-root="true" className="relative inline-flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-2 rounded-lg hover:bg-slate-50 transition"
                            style={{ color: '#64748B' }}
                            onClick={(e) => {
                              const anchorEl = e.currentTarget;
                              setMenuState((prev) => (
                                prev.id === p.id
                                  ? { id: null, anchorEl: null, position: null }
                                  : { id: p.id, anchorEl, position: getMenuPosition(anchorEl) }
                              ));
                            }}
                          >
                            <i className="ph ph-dots-three-vertical text-lg"></i>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex items-center justify-between text-sm" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.5)' }}>
            <p style={{ color: '#64748B' }}>
              Showing <span className="font-medium" style={{ color: '#0F172A' }}>{Math.min(filtered.length, (page - 1) * pageSize + 1)}</span> to{' '}
              <span className="font-medium" style={{ color: '#0F172A' }}>{Math.min(filtered.length, page * pageSize)}</span> of{' '}
              <span className="font-medium" style={{ color: '#0F172A' }}>{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 border rounded-md bg-white disabled:opacity-50"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="px-3 py-1.5 border rounded-md bg-white disabled:opacity-50"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selectedProvider)}
        provider={selectedProvider}
        onClose={() => { setSelectedId(null); setActiveTab('Overview'); }}
      />
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {activeMenuProvider && menuState.position ? (
                <motion.div
                  data-menu-root="true"
                  className="fixed w-48 bg-white border rounded-xl shadow-lg overflow-hidden"
                  style={{ top: menuState.position.top, left: menuState.position.left, zIndex: 1200, borderColor: '#E2E8F0' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    {actions(activeMenuProvider).map((action) => (
                      <button
                        key={action.label}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition"
                        style={action.tone === 'danger' ? { color: '#E11D48' } : { color: '#0F172A' }}
                        onClick={() => {
                          action.onClick();
                          closeMenu();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = action.tone === 'danger' ? 'rgba(225,29,72,0.08)' : 'rgba(248,250,252,1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
};

const CategoriesView = ({ categoriesData = [], token, onReload }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const formatUgxCompact = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return 'UGX 0';
    if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `UGX ${(n / 1_000).toFixed(1)}K`;
    return `UGX ${n.toLocaleString('en-UG')}`;
  };

  const makeId = () => `CAT-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

  const initial = [
    {
      id: 'CAT-PLUMB',
      name: 'Plumbing',
      icon: 'ph-drop',
      status: 'Active',
      providers: 182,
      listings: 640,
      growthPct: 12.4,
      accent: { from: '#AEE9E1', to: '#97E0D6' },
      subcategories: [
        { id: 'CAT-PL-1', name: 'Emergency Repairs', status: 'Active', providers: 58, listings: 210, growthPct: 9.8 },
        { id: 'CAT-PL-2', name: 'Installations', status: 'Active', providers: 71, listings: 265, growthPct: 14.2 },
        { id: 'CAT-PL-3', name: 'Drain Cleaning', status: 'Active', providers: 32, listings: 98, growthPct: 7.1 }
      ]
    },
    {
      id: 'CAT-ELEC',
      name: 'Electricians',
      icon: 'ph-lightning',
      status: 'Active',
      providers: 143,
      listings: 512,
      growthPct: 8.6,
      accent: { from: '#8FB0E8', to: '#7EA4E4' },
      subcategories: [
        { id: 'CAT-EL-1', name: 'Wiring & Inspection', status: 'Active', providers: 62, listings: 210, growthPct: 6.3 },
        { id: 'CAT-EL-2', name: 'Solar Installation', status: 'Active', providers: 21, listings: 76, growthPct: 18.5 }
      ]
    },
    {
      id: 'CAT-BEAUTY',
      name: 'Salon & Beauty',
      icon: 'ph-scissors',
      status: 'Active',
      providers: 260,
      listings: 910,
      growthPct: 15.1,
      accent: { from: '#F3A3D5', to: '#EF8DCB' },
      subcategories: [
        { id: 'CAT-BE-1', name: 'Hair Styling', status: 'Active', providers: 110, listings: 380, growthPct: 11.0 },
        { id: 'CAT-BE-2', name: 'Makeup', status: 'Active', providers: 64, listings: 220, growthPct: 16.7 },
        { id: 'CAT-BE-3', name: 'Nails', status: 'Active', providers: 52, listings: 188, growthPct: 10.2 }
      ]
    },
    {
      id: 'CAT-CLEAN',
      name: 'Cleaning',
      icon: 'ph-sparkle',
      status: 'Active',
      providers: 96,
      listings: 288,
      growthPct: 5.4,
      accent: { from: '#84C7E8', to: '#6FBCE4' },
      subcategories: [
        { id: 'CAT-CL-1', name: 'Home Cleaning', status: 'Active', providers: 51, listings: 150, growthPct: 6.4 },
        { id: 'CAT-CL-2', name: 'Office Cleaning', status: 'Active', providers: 22, listings: 68, growthPct: 4.1 },
        { id: 'CAT-CL-3', name: 'Post-Construction', status: 'Active', providers: 13, listings: 41, growthPct: 8.9 }
      ]
    },
    {
      id: 'CAT-FOOD',
      name: 'Catering',
      icon: 'ph-fork-knife',
      status: 'Paused',
      providers: 74,
      listings: 196,
      growthPct: -2.2,
      accent: { from: '#F7A68B', to: '#F29274' },
      subcategories: [
        { id: 'CAT-FO-1', name: 'Weddings', status: 'Active', providers: 18, listings: 52, growthPct: 3.2 },
        { id: 'CAT-FO-2', name: 'Corporate', status: 'Paused', providers: 9, listings: 21, growthPct: -4.8 }
      ]
    },
    {
      id: 'CAT-TRANS',
      name: 'Boda & Transport',
      icon: 'ph-motorcycle',
      status: 'Active',
      providers: 310,
      listings: 1040,
      growthPct: 21.3,
      accent: { from: '#7F86E8', to: '#6F77E4' },
      subcategories: [
        { id: 'CAT-TR-1', name: 'Boda (City)', status: 'Active', providers: 190, listings: 640, growthPct: 24.1 },
        { id: 'CAT-TR-2', name: 'Courier Delivery', status: 'Active', providers: 56, listings: 210, growthPct: 19.7 }
      ]
    }
  ];

  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [openPath, setOpenPath] = useState([]);
  const [subSearch, setSubSearch] = useState('');
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      return localStorage.getItem('gabla_categories_display') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const [modal, setModal] = useState({ open: false, mode: null, categoryId: null, subId: null });
  const [form, setForm] = useState({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: '', providerFields: [], listingFields: [], layout: 'default', searchAliases: [] });
  const [categoryTab, setCategoryTab] = useState('general');
  const CATEGORY_TABS = [
    { key: 'general', label: 'General' },
    { key: 'layout', label: 'Layout & search' },
    { key: 'providerFields', label: 'Provider fields' },
    { key: 'listingFields', label: 'Listing fields' }
  ];
  const [confirm, setConfirm] = useState({ open: false, scope: null, categoryId: null, subId: null });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [activeDrag, setActiveDrag] = useState({ scope: null, itemId: null, parentId: null });
  const [savingOrder, setSavingOrder] = useState(false);
  const categoryImageInputRef = useRef(null);
  const categoriesRef = useRef([]);
  const topLevelOrderStartRef = useRef([]);
  const subcategoryOrderStartRef = useRef({ parentId: null, ids: [] });
  const lastSyncedPathRef = useRef('');

  useEffect(() => {
    setCategories((categoriesData || []).map(mapCategory));
  }, [categoriesData]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const serializePath = (path) => path.filter(Boolean).join(',');

  const syncPathToUrl = (path, { replace = false } = {}) => {
    const serialized = serializePath(path);
    if (serialized === lastSyncedPathRef.current) return;
    lastSyncedPathRef.current = serialized;
    const params = new URLSearchParams(location.search);
    if (path.length) {
      params.set('cat', serialized);
    } else {
      params.delete('cat');
    }
    const nextSearch = params.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('cat') || '';
    const incoming = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const serialized = serializePath(incoming);
    if (serialized === serializePath(openPath)) return;
    lastSyncedPathRef.current = serialized;
    setOpenPath(incoming);
  }, [location.search]);

  useEffect(() => {
    if (!openPath.length) return;
    const validPrefix = [];
    for (const id of openPath) {
      const node = findCategoryNode(categoriesRef.current, id);
      if (!node) break;
      validPrefix.push(id);
    }
    if (serializePath(validPrefix) !== serializePath(openPath)) {
      setOpenPath(validPrefix);
      syncPathToUrl(validPrefix, { replace: true });
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem('gabla_categories_display', displayMode);
    } catch {
      // ignore
    }
  }, [displayMode]);

  const findPathIds = (items, targetId, currentPath = []) => {
    for (const item of items) {
      const nextPath = [...currentPath, item.id];
      if (item.id === targetId) return nextPath;
      const found = findPathIds(item.subcategories || [], targetId, nextPath);
      if (found) return found;
    }
    return null;
  };

  const openNode = (id) => {
    const path = findPathIds(categoriesRef.current, id);
    const nextPath = path || [id];
    setOpenPath(nextPath);
    syncPathToUrl(nextPath);
    setSubSearch('');
  };

  const closeNode = () => {
    setOpenPath([]);
    syncPathToUrl([]);
  };

  const goBack = () => {
    const next = openPath.slice(0, -1);
    setOpenPath(next);
    syncPathToUrl(next);
    setSubSearch('');
  };

  const goToPathIndex = (index) => {
    const next = openPath.slice(0, index + 1);
    setOpenPath(next);
    syncPathToUrl(next);
    setSubSearch('');
  };

  const updateTree = (items, targetId, updater) => {
    let changed = false;
    const next = items.map((item) => {
      if (item.id === targetId) {
        changed = true;
        return updater(item);
      }
      const subs = item.subcategories || [];
      if (!subs.length) return item;
      const nextSubs = updateTree(subs, targetId, updater);
      if (nextSubs === subs) return item;
      changed = true;
      return { ...item, subcategories: nextSubs };
    });
    return changed ? next : items;
  };

  const flattenCategoryNodes = (items, prefix = '') => {
    const result = [];
    for (const item of items) {
      result.push({ id: item.id, name: `${prefix}${item.name}` });
      const subs = item.subcategories || [];
      if (subs.length) {
        result.push(...flattenCategoryNodes(subs, `${prefix}— `));
      }
    }
    return result;
  };

  const findCategoryNode = (items, id) => {
    for (const item of items) {
      if (item.id === id) return item;
      const found = findCategoryNode(item.subcategories || [], id);
      if (found) return found;
    }
    return null;
  };

  const buildCategorySettings = (baseSettings = {}) => {
    const nextSettings = { ...baseSettings };
    delete nextSettings.status;
    delete nextSettings.icon;
    if (form.imageUrl) {
      nextSettings.imageUrl = form.imageUrl;
    } else {
      delete nextSettings.imageUrl;
    }
    if (form.imageKey) {
      nextSettings.imageKey = form.imageKey;
    } else {
      delete nextSettings.imageKey;
    }
    nextSettings.layout = form.layout || 'default';
    if (form.searchAliases.length) {
      nextSettings.searchAliases = form.searchAliases;
    } else {
      delete nextSettings.searchAliases;
    }
    return nextSettings;
  };

  const persistOrder = async ({ parentId = null, orderedIds, nextCategories, onSuccess }) => {
    const previousCategories = categories;
    setCategories(nextCategories);
    setSavingOrder(true);
    try {
      await apiRequest('/categories/reorder', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ parentId, orderedIds })
      });
      onSuccess?.();
      await onReload?.();
    } catch (error) {
      setCategories(previousCategories);
      window.alert(error.message || 'Unable to save category order');
    } finally {
      setSavingOrder(false);
      setActiveDrag({ scope: null, itemId: null, parentId: null });
    }
  };

  const beginTopLevelReorder = (itemId) => {
    if (savingOrder) return;
    topLevelOrderStartRef.current = categoriesRef.current.map((item) => item.id);
    setActiveDrag({ scope: 'category', itemId, parentId: null });
  };

  const updateTopLevelOrder = (nextOrder) => {
    setCategories(withSortOrder(nextOrder));
  };

  const finishTopLevelReorder = async () => {
    const nextCategories = withSortOrder(categoriesRef.current);
    const orderedIds = nextCategories.map((item) => item.id);
    if (JSON.stringify(orderedIds) === JSON.stringify(topLevelOrderStartRef.current)) {
      setCategories(nextCategories);
      setActiveDrag({ scope: null, itemId: null, parentId: null });
      return;
    }

    await persistOrder({
      parentId: null,
      orderedIds,
      nextCategories
    });
  };

  const beginSubcategoryReorder = (parentId, itemId) => {
    if (savingOrder) return;
    const parent = findCategoryNode(categoriesRef.current, parentId);
    subcategoryOrderStartRef.current = {
      parentId,
      ids: (parent?.subcategories || []).map((item) => item.id)
    };
    setActiveDrag({ scope: 'subcategory', itemId, parentId });
  };

  const updateSubcategoryOrder = (parentId, nextOrder) => {
    setCategories((current) =>
      updateTree(current, parentId, (parent) => ({ ...parent, subcategories: withSortOrder(nextOrder) }))
    );
  };

  const finishSubcategoryReorder = async (parentId) => {
    const parent = findCategoryNode(categoriesRef.current, parentId);
    const nextSubcategories = withSortOrder(parent?.subcategories || []);
    const orderedIds = nextSubcategories.map((item) => item.id);
    if (
      subcategoryOrderStartRef.current.parentId !== parentId ||
      JSON.stringify(orderedIds) === JSON.stringify(subcategoryOrderStartRef.current.ids)
    ) {
      setCategories((current) =>
        updateTree(current, parentId, (node) => ({ ...node, subcategories: nextSubcategories }))
      );
      setActiveDrag({ scope: null, itemId: null, parentId: null });
      return;
    }

    const nextCategories = updateTree(categoriesRef.current, parentId, (node) => ({ ...node, subcategories: nextSubcategories }));

    await persistOrder({
      parentId,
      orderedIds,
      nextCategories,
      onSuccess: () => openNode(parentId)
    });
  };

  const closeModal = () => setModal({ open: false, mode: null, categoryId: null, subId: null });

  const openAddCategory = () => {
    setForm({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: '', providerFields: [], listingFields: [], layout: 'default', searchAliases: [] });
    setModal({ open: true, mode: 'addCategory', categoryId: null, subId: null });
    setCategoryTab('general');
  };

  const openAddSubcategory = (categoryId = '') => {
    setForm({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: categoryId, providerFields: [], listingFields: [], layout: 'default', searchAliases: [] });
    setModal({ open: true, mode: 'addSubcategory', categoryId: null, subId: null });
    setCategoryTab('general');
  };

  const openEditCategory = (categoryId) => {
    const cat = findCategoryNode(categories, categoryId);
    if (!cat) return;
    setForm({
      name: cat.name,
      status: cat.status,
      imageUrl: cat.imageUrl || '',
      imageKey: cat.imageKey || '',
      parentId: '',
      providerFields: fieldsForEditor(cat.providerFields),
      listingFields: fieldsForEditor(cat.listingFields),
      layout: cat.layout || 'default',
      searchAliases: Array.isArray(cat.searchAliases) ? cat.searchAliases : []
    });
    setModal({ open: true, mode: 'editCategory', categoryId, subId: null });
    setCategoryTab('general');
  };

  const openEditSubcategory = (categoryId, subId) => {
    const sub = findCategoryNode(categories, subId);
    if (!sub) return;
    setForm({
      name: sub.name,
      status: sub.status,
      imageUrl: sub.imageUrl || '',
      imageKey: sub.imageKey || '',
      parentId: categoryId,
      providerFields: fieldsForEditor(sub.providerFields),
      listingFields: fieldsForEditor(sub.listingFields),
      layout: sub.layout || 'default',
      searchAliases: Array.isArray(sub.searchAliases) ? sub.searchAliases : []
    });
    setModal({ open: true, mode: 'editSubcategory', categoryId, subId });
    setCategoryTab('general');
  };

  const requestDeleteCategory = (categoryId) => {
    setConfirm({ open: true, scope: 'category', categoryId, subId: null });
  };

  const requestDeleteSubcategory = (categoryId, subId) => {
    setConfirm({ open: true, scope: 'subcategory', categoryId, subId });
  };

  const matchesNodeQuery = (node, q) => {
    if (!q) return true;
    if ((node.name || '').toLowerCase().includes(q)) return true;
    return (node.subcategories || []).some((child) => matchesNodeQuery(child, q));
  };

  const filtered = categories.filter((c) => {
    const q = search.trim().toLowerCase();
    return matchesNodeQuery(c, q);
  });
  const canReorderCategories = !search.trim() && !savingOrder;

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'bg-emerald-100 text-emerald-800';
    if (s === 'paused') return 'bg-yellow-100 text-yellow-800';
    return 'bg-slate-200 text-slate-700';
  };

  const growthChip = (pct) => {
    const n = Number(pct ?? 0);
    if (!Number.isFinite(n)) return { text: '0.0%', cls: 'bg-slate-100 text-slate-700' };
    if (n >= 0) return { text: `+${n.toFixed(1)}%`, cls: 'bg-emerald-50 text-emerald-700' };
    return { text: `${n.toFixed(1)}%`, cls: 'bg-rose-50 text-rose-700' };
  };


  const submit = async () => {
    const name = form.name.trim();
    if (!name) return;
    const editedCategoryId = modal.mode === 'editCategory' ? modal.categoryId : modal.subId;
    const currentSettings = editedCategoryId ? (findCategoryNode(categories, editedCategoryId)?.settings || {}) : {};
    const settings = buildCategorySettings(modal.mode?.startsWith('edit') ? currentSettings : {});
    const providerFields = sanitizeFields(form.providerFields);
    const listingFields = sanitizeFields(form.listingFields);
    const isActive = form.status === 'Active';

    if (modal.mode === 'addCategory') {
      await apiRequest('/categories', {
        token,
        method: 'POST',
        body: JSON.stringify({ name, settings, providerFields, listingFields, isActive })
      });
      await onReload?.();
      closeModal();
      return;
    }

    if (modal.mode === 'editCategory') {
      await apiRequest(`/categories/${modal.categoryId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name, settings, providerFields, listingFields, isActive })
      });
      await onReload?.();
      closeModal();
      return;
    }

    if (modal.mode === 'addSubcategory') {
      const parentId = form.parentId;
      if (!parentId) return;
      await apiRequest('/categories/sub', {
        token,
        method: 'POST',
        body: JSON.stringify({ name, parentId, settings, providerFields, listingFields, isActive })
      });
      await onReload?.();
      openNode(parentId);
      closeModal();
      return;
    }

    if (modal.mode === 'editSubcategory') {
      await apiRequest(`/categories/${modal.subId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name, settings, providerFields, listingFields, isActive })
      });
      await onReload?.();
      closeModal();
    }
  };

  const handleCategoryImageFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      window.alert('Please select an image file.');
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await uploadFileToStorage({
        file,
        token,
        folder: 'category-images'
      });
      setForm((prev) => ({
        ...prev,
        imageUrl: uploaded.url,
        imageKey: uploaded.key
      }));
    } catch (error) {
      window.alert(error.message || 'Unable to upload category image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCategoryImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await handleCategoryImageFile(file);
  };

  const approveCategory = async (categoryId, event) => {
    event?.stopPropagation();
    try {
      await apiRequest(`/categories/${categoryId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus: 'approved' })
      });
      await onReload?.();
    } catch (error) {
      window.alert(error.message || 'Unable to approve this category');
    }
  };

  const confirmDelete = async () => {
    if (!confirm.open) return;
    try {
      if (confirm.scope === 'category') {
        await apiRequest(`/categories/${confirm.categoryId}`, { token, method: 'DELETE' });
        setOpenPath((prev) => {
          const idx = prev.indexOf(confirm.categoryId);
          if (idx === -1) return prev;
          return prev.slice(0, idx);
        });
      } else if (confirm.scope === 'subcategory') {
        await apiRequest(`/categories/${confirm.subId}`, { token, method: 'DELETE' });
        setOpenPath((prev) => {
          const idx = prev.indexOf(confirm.subId);
          if (idx === -1) return prev;
          return prev.slice(0, idx);
        });
      }
      await onReload?.();
      setConfirm({ open: false, scope: null, categoryId: null, subId: null });
    } catch (error) {
      window.alert(error.message || 'Unable to delete category');
    }
  };

  const countPending = (items) =>
    items.reduce((sum, item) => sum + (item.moderationStatus === 'pending' ? 1 : 0) + countPending(item.subcategories || []), 0);
  const pendingCategoryCount = countPending(categories);

  const currentNodeId = openPath.length ? openPath[openPath.length - 1] : null;
  const selectedCategory = currentNodeId ? findCategoryNode(categories, currentNodeId) : null;
  const pathNodes = openPath.map((id) => findCategoryNode(categories, id)).filter(Boolean);
  const selectedSubs = (selectedCategory?.subcategories || []).filter((s) => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q);
  });
  const canReorderSubcategories = Boolean(selectedCategory) && !subSearch.trim() && !savingOrder;

  const CategoryCard = ({ category }) => {
    const dragControls = useDragControls();
    const g = growthChip(category.growthPct);
    const subCount = (category.subcategories || []).length;
    const isDragging = activeDrag.scope === 'category' && activeDrag.itemId === category.id;
    const content = (
      <div
        className="relative aspect-[4/3] p-6 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${category.accent?.from || 'rgba(219,234,254,0.95)'}, ${category.accent?.to || 'rgba(254,249,195,0.70)'})`
        }}
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 pointer-events-none" style={{ background: category.imageUrl ? 'linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.68))' : 'radial-gradient(650px 320px at 30% 0%, rgba(255,255,255,0.85), rgba(255,255,255,0))' }}></div>
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: category.imageUrl ? 'radial-gradient(420px 220px at 80% 70%, rgba(15,23,42,0.35), rgba(15,23,42,0))' : 'radial-gradient(400px 220px at 80% 70%, rgba(11,32,70,0.10), rgba(11,32,70,0))' }}></div>

        <div className="relative flex flex-col items-center justify-end text-center gap-4 h-full w-full">
          {canReorderCategories ? (
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => {
                event.stopPropagation();
                beginTopLevelReorder(category.id);
                dragControls.start(event);
              }}
              className="absolute top-0 right-0 p-2 rounded-xl border bg-white/80 hover:bg-white transition cursor-grab active:cursor-grabbing"
              style={{ borderColor: 'rgba(226,232,240,0.85)', color: '#0B2046', backdropFilter: 'blur(8px)' }}
              aria-label={`Drag ${category.name}`}
              title="Drag to reorder"
            >
              <i className="ph ph-dots-six-vertical text-lg"></i>
            </button>
          ) : null}
          {!category.imageUrl ? (
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-white/65 border" style={{ borderColor: 'rgba(226,232,240,0.75)', color: '#0B2046' }}>
              <i className="ph ph-image text-3xl"></i>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-extrabold tracking-widest uppercase" style={{ color: category.imageUrl ? '#FFFFFF' : '#0F172A' }}>{category.name}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge(category.status)}`}>{category.status}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${g.cls}`}>{g.text}</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold" style={category.imageUrl ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' } : { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                {subCount}
              </span>
              {category.moderationStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                  <i className="ph ph-hourglass-medium"></i> Pending review
                </span>
              ) : null}
            </div>
            {category.moderationStatus === 'pending' ? (
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 hover:bg-white transition"
                style={{ color: '#0B2046' }}
                onClick={(event) => approveCategory(category.id, event)}
              >
                Approve
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );

    if (!canReorderCategories) {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border overflow-hidden group cursor-pointer"
          style={{
            borderColor: 'rgba(226,232,240,0.85)',
            boxShadow: '0 14px 40px -28px rgba(11,32,70,0.35)'
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => openNode(category.id)}
        >
          {content}
        </motion.div>
      );
    }

    return (
      <Reorder.Item
        value={category}
        id={category.id}
        dragListener={false}
        dragControls={dragControls}
        className="rounded-3xl border overflow-hidden group cursor-pointer"
        style={{
          borderColor: isDragging ? 'rgba(11,32,70,0.35)' : 'rgba(226,232,240,0.85)',
          boxShadow: '0 14px 40px -28px rgba(11,32,70,0.35)',
          opacity: isDragging ? 0.88 : 1
        }}
        whileDrag={{
          scale: 1.02,
          rotate: 1,
          zIndex: 40,
          boxShadow: '0 28px 80px -28px rgba(11,32,70,0.45)'
        }}
        whileHover={{ y: -2 }}
        onClick={() => openNode(category.id)}
        onDragStart={() => beginTopLevelReorder(category.id)}
        onDragEnd={finishTopLevelReorder}
      >
        {content}
      </Reorder.Item>
    );
  };

  const SubcategoryRow = ({ subcategory, parentId, reorderEnabled = false }) => {
    const dragControls = useDragControls();
    const sg = growthChip(subcategory.growthPct);
    const isDraggingSubcategory =
      activeDrag.scope === 'subcategory' &&
      activeDrag.parentId === parentId &&
      activeDrag.itemId === subcategory.id;

    const content = (
      <>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{subcategory.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(subcategory.status)}`}>{subcategory.status}</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sg.cls}`}>{sg.text}</span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
              {(subcategory.subcategories || []).length}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
              {subcategory.providers.toLocaleString('en-UG')} providers • {subcategory.listings.toLocaleString('en-UG')} listings
            </span>
            {subcategory.moderationStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                <i className="ph ph-hourglass-medium"></i> Pending review
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subcategory.moderationStatus === 'pending' ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border hover:bg-slate-100 transition"
              style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
              onClick={(event) => approveCategory(subcategory.id, event)}
            >
              Approve
            </button>
          ) : null}
          {reorderEnabled ? (
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                beginSubcategoryReorder(parentId, subcategory.id);
                dragControls.start(event);
              }}
              className="p-2 rounded-xl border bg-white hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
              style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
              aria-label={`Drag ${subcategory.name}`}
              title="Drag to reorder"
            >
              <i className="ph ph-dots-six-vertical text-lg"></i>
            </button>
          ) : null}
          <button
            className="p-2 rounded-xl hover:bg-slate-100 transition"
            style={{ color: '#0B2046' }}
            onClick={(event) => {
              event.stopPropagation();
              openEditSubcategory(parentId, subcategory.id);
            }}
          >
            <i className="ph ph-pencil-simple text-lg"></i>
          </button>
          <button
            className="p-2 rounded-xl hover:bg-rose-50 transition"
            style={{ color: '#E11D48' }}
            onClick={(event) => {
              event.stopPropagation();
              requestDeleteSubcategory(parentId, subcategory.id);
            }}
          >
            <i className="ph ph-trash text-lg"></i>
          </button>
          <button
            className="p-2 rounded-xl hover:bg-slate-100 transition"
            style={{ color: '#0B2046' }}
            onClick={(event) => {
              event.stopPropagation();
              openNode(subcategory.id);
            }}
            title="Open"
          >
            <i className="ph ph-caret-right text-lg"></i>
          </button>
        </div>
      </>
    );

    if (!reorderEnabled) {
      return (
        <motion.div
          layout
          className="flex items-center justify-between gap-3 p-4 rounded-2xl border bg-slate-50 hover:bg-white transition"
          style={{ borderColor: '#E2E8F0' }}
          whileHover={{ y: -1 }}
          onClick={() => openNode(subcategory.id)}
        >
          {content}
        </motion.div>
      );
    }

    return (
      <Reorder.Item
        value={subcategory}
        id={subcategory.id}
        dragListener={false}
        dragControls={dragControls}
        className="flex items-center justify-between gap-3 p-4 rounded-2xl border bg-slate-50 hover:bg-white transition"
        style={{
          borderColor: isDraggingSubcategory ? 'rgba(11,32,70,0.35)' : '#E2E8F0',
          opacity: isDraggingSubcategory ? 0.88 : 1
        }}
        whileHover={{ y: -1 }}
        whileDrag={{
          scale: 1.01,
          zIndex: 30,
          boxShadow: '0 20px 44px -20px rgba(11,32,70,0.35)'
        }}
        onClick={() => openNode(subcategory.id)}
        onDragStart={() => beginSubcategoryReorder(parentId, subcategory.id)}
        onDragEnd={() => finishSubcategoryReorder(parentId)}
      >
        {content}
      </Reorder.Item>
    );
  };

  const countDescendants = (node) => {
    const subs = node.subcategories || [];
    return subs.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
  };

  const CategoriesTable = ({ items }) => (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: '#64748B', backgroundColor: 'rgba(248,250,252,0.8)' }}>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Providers</th>
              <th className="px-5 py-3 font-semibold">Listings</th>
              <th className="px-5 py-3 font-semibold">Subcategories</th>
              <th className="px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((category) => (
              <tr
                key={category.id}
                className="border-t hover:bg-slate-50 transition cursor-pointer"
                style={{ borderColor: '#E2E8F0' }}
                onClick={() => openNode(category.id)}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0" style={{ borderColor: 'rgba(226,232,240,0.9)' }}>
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <i className="ph ph-image text-lg" style={{ color: '#0B2046' }}></i>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{category.name}</p>
                      <p className="text-xs truncate" style={{ color: '#64748B' }}>{countDescendants(category)} total subcategories</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(category.status)}`}>{category.status}</span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#0B2046' }}>{category.providers.toLocaleString('en-UG')}</td>
                <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#0B2046' }}>{category.listings.toLocaleString('en-UG')}</td>
                <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#0B2046' }}>{(category.subcategories || []).length}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-2 rounded-xl hover:bg-white transition"
                      style={{ color: '#0B2046' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditCategory(category.id);
                      }}
                      title="Edit"
                    >
                      <i className="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-rose-50 transition"
                      style={{ color: '#E11D48' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteCategory(category.id);
                      }}
                      title="Delete"
                    >
                      <i className="ph ph-trash text-lg"></i>
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-white transition"
                      style={{ color: '#0B2046' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openNode(category.id);
                      }}
                      title="Open"
                    >
                      <i className="ph ph-caret-right text-lg"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Service Categories</h1>
            {pendingCategoryCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                <i className="ph ph-hourglass-medium"></i> {pendingCategoryCount} pending review
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Manage categories and nested subcategories for Gabla. Categories providers add themselves are live right away and flagged here for review.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl border flex items-center gap-1" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-semibold transition"
              style={displayMode === 'grid' ? { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' } : { backgroundColor: 'transparent', color: '#64748B' }}
              onClick={() => setDisplayMode('grid')}
              title="Grid"
            >
              <i className="ph ph-squares-four"></i>
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-semibold transition"
              style={displayMode === 'list' ? { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' } : { backgroundColor: 'transparent', color: '#64748B' }}
              onClick={() => setDisplayMode('list')}
              title="List"
            >
              <i className="ph ph-table"></i>
            </button>
          </div>
          <button
            className="px-4 py-2.5 text-white rounded-xl font-semibold transition hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 10px -4px rgba(11,32,70,0.35)' }}
            onClick={openAddCategory}
          >
            <i className="ph ph-folder-plus"></i>
            Add Category
          </button>
          <button
            className="px-4 py-2.5 rounded-xl font-semibold transition hover:bg-slate-50 border flex items-center gap-2"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            onClick={() => openAddSubcategory('')}
          >
            <i className="ph ph-plus"></i>
            Add Subcategory
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
        <div className="relative">
          <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
          <input
            type="text"
            placeholder="Search categories or subcategories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-xl py-3 pl-12 pr-4 outline-none transition-all"
            style={{ borderColor: '#E2E8F0' }}
          />
        </div>
        <p className="mt-3 text-xs" style={{ color: '#64748B' }}>
          {displayMode === 'list'
            ? (canReorderCategories ? 'Switch to grid to drag and save category order.' : 'Clear the search to reorder categories in grid view.')
            : (canReorderCategories ? 'Drag categories by the handle to save their order in the app.' : 'Clear the search to reorder categories.')}
        </p>
      </div>

      {filtered.length ? (
        displayMode === 'list' ? (
          <CategoriesTable items={filtered} />
        ) : (
          canReorderCategories ? (
            <Reorder.Group
              axis="y"
              values={categories}
              onReorder={updateTopLevelOrder}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {categories.map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </Reorder.Group>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filtered.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </AnimatePresence>
            </motion.div>
          )
        )
      ) : (
        <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046' }}>
            <i className="ph ph-magnifying-glass text-3xl"></i>
          </div>
          <p className="mt-4 text-base font-bold" style={{ color: '#0F172A' }}>No categories found</p>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Try a different keyword or create a new category.</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              className="px-5 py-2.5 text-white rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: '#0B2046' }}
              onClick={openAddCategory}
            >
              Add Category
            </button>
            <button
              className="px-5 py-2.5 rounded-xl font-semibold transition hover:bg-slate-50 border"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
              onClick={() => setSearch('')}
            >
              Clear Search
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedCategory ? (
          <motion.section
            className="fixed top-20 bottom-0 left-0 right-0 md:left-64 z-[950] bg-slate-50 flex flex-col"
            initial={{ opacity: 0, y: 18, pointerEvents: 'auto' }}
            animate={{ opacity: 1, y: 0, pointerEvents: 'auto' }}
            exit={{ opacity: 0, y: 18, pointerEvents: 'none' }}
            transition={{ duration: 0.22 }}
          >
            <div className="border-b bg-white/90 backdrop-blur-sm shrink-0" style={{ borderColor: '#E2E8F0', boxShadow: '0 10px 40px -28px rgba(11,32,70,0.28)' }}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {pathNodes.length ? (
                      <div className="mb-3 flex items-center gap-2">
                        {openPath.length > 1 ? (
                          <button
                            type="button"
                            className="p-2 rounded-xl border hover:bg-slate-50 transition"
                            style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                            onClick={goBack}
                            title="Back"
                          >
                            <i className="ph ph-arrow-left"></i>
                          </button>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-1 text-xs font-semibold" style={{ color: '#64748B' }}>
                          {pathNodes.map((node, idx) => (
                            <span key={node.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                className="hover:underline transition"
                                style={{ color: idx === pathNodes.length - 1 ? '#0B2046' : '#64748B' }}
                                onClick={() => goToPathIndex(idx)}
                              >
                                {node.name}
                              </button>
                              {idx < pathNodes.length - 1 ? <i className="ph ph-caret-right"></i> : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center border overflow-hidden bg-slate-100 shrink-0"
                        style={{
                          borderColor: 'rgba(226,232,240,0.85)',
                          background: selectedCategory.imageUrl ? '#E2E8F0' : `linear-gradient(135deg, ${selectedCategory.accent?.from || 'rgba(219,234,254,0.95)'}, ${selectedCategory.accent?.to || 'rgba(254,249,195,0.70)'})`
                        }}
                      >
                        {selectedCategory.imageUrl ? (
                          <img src={selectedCategory.imageUrl} alt={selectedCategory.name} className="w-full h-full object-cover" />
                        ) : (
                          <i className="ph ph-image text-2xl" style={{ color: '#0B2046' }}></i>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-extrabold truncate" style={{ color: '#0F172A' }}>{selectedCategory.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(selectedCategory.status)}`}>{selectedCategory.status}</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${growthChip(selectedCategory.growthPct).cls}`}>{growthChip(selectedCategory.growthPct).text}</span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                            {(selectedCategory.subcategories || []).length} subcategories
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button onClick={closeNode} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
                    <i className="ph ph-x text-xl"></i>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Providers</p>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: '#0B2046' }}>{(selectedCategory.providers || 0).toLocaleString('en-UG')}</p>
                  </div>
                  <div className="p-3 rounded-2xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Listings</p>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: '#0B2046' }}>{(selectedCategory.listings || 0).toLocaleString('en-UG')}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: '#0B2046' }}
                    onClick={() => openAddSubcategory(selectedCategory.id)}
                  >
                    <i className="ph ph-plus mr-2"></i>
                    Add Subcategory
                  </button>
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                    onClick={() => openEditCategory(selectedCategory.id)}
                  >
                    <i className="ph ph-pencil-simple mr-2"></i>
                    Edit Category
                  </button>
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-rose-50 transition"
                    style={{ borderColor: 'rgba(244,63,94,0.25)', color: '#E11D48' }}
                    onClick={() => requestDeleteCategory(selectedCategory.id)}
                  >
                    <i className="ph ph-trash mr-2"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>

              <motion.div
                key={currentNodeId}
                className="flex-1 overflow-y-auto"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_360px] gap-6 items-start">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold" style={{ color: '#0F172A' }}>Subcategories</p>
                        <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                          {selectedSubs.length} items
                        </span>
                      </div>

                      <div className="mt-3 bg-white p-3 rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
                        <div className="relative">
                          <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
                          <input
                            value={subSearch}
                            onChange={(e) => setSubSearch(e.target.value)}
                            placeholder="Search subcategories..."
                            className="w-full bg-slate-50 border text-sm rounded-xl py-3 pl-12 pr-4 outline-none transition-all"
                            style={{ borderColor: '#E2E8F0' }}
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-xs" style={{ color: '#64748B' }}>
                        {canReorderSubcategories ? 'Drag subcategories by the handle to save their order in the app.' : 'Clear the subcategory search to reorder items.'}
                      </p>

                      {(selectedCategory.subcategories || []).length ? (
                        selectedSubs.length ? (
                          canReorderSubcategories ? (
                            <Reorder.Group
                              axis="y"
                              values={selectedCategory.subcategories || []}
                              onReorder={(nextOrder) => updateSubcategoryOrder(selectedCategory.id, nextOrder)}
                              className="mt-4 space-y-2"
                            >
                              {(selectedCategory.subcategories || []).map((s) => (
                                <SubcategoryRow
                                  key={s.id}
                                  subcategory={s}
                                  parentId={selectedCategory.id}
                                  reorderEnabled
                                />
                              ))}
                            </Reorder.Group>
                          ) : (
                            <div className="mt-4 space-y-2">
                              {selectedSubs.map((s) => (
                                <SubcategoryRow
                                  key={s.id}
                                  subcategory={s}
                                  parentId={selectedCategory.id}
                                />
                              ))}
                            </div>
                          )
                        ) : (
                          <div className="mt-4 p-8 rounded-2xl border bg-slate-50 text-center" style={{ borderColor: '#E2E8F0' }}>
                            <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046' }}>
                              <i className="ph ph-magnifying-glass text-2xl"></i>
                            </div>
                            <p className="mt-3 text-sm font-semibold" style={{ color: '#0F172A' }}>No matches</p>
                            <p className="mt-1 text-xs" style={{ color: '#64748B' }}>Try another keyword.</p>
                            <button
                              className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-white transition"
                              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                              onClick={() => setSubSearch('')}
                            >
                              Clear Search
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="mt-4 p-8 rounded-2xl border bg-slate-50 text-center" style={{ borderColor: '#E2E8F0' }}>
                          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                            <i className="ph ph-folder-notch-open text-2xl"></i>
                          </div>
                          <p className="mt-3 text-sm font-semibold" style={{ color: '#0F172A' }}>No subcategories yet</p>
                          <p className="mt-1 text-xs" style={{ color: '#64748B' }}>Add subcategories to organize providers and listings.</p>
                          <button
                            className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                            style={{ backgroundColor: '#0B2046' }}
                            onClick={() => openAddSubcategory(selectedCategory.id)}
                          >
                            Add Subcategory
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="xl:sticky xl:top-6 space-y-4">
                      <div className="rounded-3xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0', boxShadow: '0 16px 44px -30px rgba(11,32,70,0.20)' }}>
                        <div
                          className="relative aspect-[16/10] flex items-end p-5"
                          style={{
                            background: selectedCategory.imageUrl
                              ? '#E2E8F0'
                              : `linear-gradient(135deg, ${selectedCategory.accent?.from || 'rgba(219,234,254,0.95)'}, ${selectedCategory.accent?.to || 'rgba(254,249,195,0.70)'})`
                          }}
                        >
                          {selectedCategory.imageUrl ? (
                            <img src={selectedCategory.imageUrl} alt={selectedCategory.name} className="absolute inset-0 w-full h-full object-cover" />
                          ) : null}
                          <div className="absolute inset-0" style={{ background: selectedCategory.imageUrl ? 'linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.70))' : 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(15,23,42,0.12))' }}></div>
                          <div className="relative">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: selectedCategory.imageUrl ? 'rgba(255,255,255,0.82)' : '#475569' }}>Current Category</p>
                            <p className="mt-2 text-2xl font-extrabold" style={{ color: selectedCategory.imageUrl ? '#FFFFFF' : '#0F172A' }}>{selectedCategory.name}</p>
                          </div>
                        </div>
                        <div className="p-5 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#64748B' }}>Status</span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(selectedCategory.status)}`}>{selectedCategory.status}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#64748B' }}>Nested items</span>
                            <span className="font-semibold" style={{ color: '#0F172A' }}>{(selectedCategory.subcategories || []).length}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#64748B' }}>App view</span>
                            <span className="font-semibold" style={{ color: '#0F172A' }}>{selectedCategory.appView || selectedCategory.viewType || 'directory'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <DrawerShell
        open={modal.open}
        onClose={closeModal}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold" style={{ color: '#0F172A' }}>
                {modal.mode === 'addCategory' ? 'Add Category' : null}
                {modal.mode === 'editCategory' ? 'Edit Category' : null}
                {modal.mode === 'addSubcategory' ? 'Add Subcategory' : null}
                {modal.mode === 'editSubcategory' ? 'Edit Subcategory' : null}
              </p>
              <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Changes are saved to the backend.</p>
            </div>
            <button onClick={closeModal} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
              <i className="ph ph-x text-xl"></i>
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 bg-slate-50 border rounded-xl p-1 flex-wrap" style={{ borderColor: '#E2E8F0' }}>
            {CATEGORY_TABS.map((t) => {
              const isActive = categoryTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setCategoryTab(t.key)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg transition"
                  style={isActive ? { backgroundColor: '#0B2046', color: 'white' } : { color: '#64748B' }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {categoryTab === 'general' ? (
            <>
              {modal.mode === 'addSubcategory' && !form.parentId ? (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Parent Category</label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm(f => ({ ...f, parentId: e.target.value }))}
                    className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <option value="">Select a parent category</option>
                    {flattenCategoryNodes(categories).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>Picture</label>
                  <input
                    ref={categoryImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCategoryImageSelect}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl text-sm font-semibold border hover:bg-slate-50 transition disabled:opacity-60"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                    onClick={() => categoryImageInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? 'Uploading...' : form.imageUrl ? 'Change Picture' : 'Upload Picture'}
                  </button>
                </div>
                <div
                  className="rounded-2xl border p-4 bg-slate-50 transition"
                  style={{ borderColor: imageDropActive ? 'rgba(59,130,246,0.45)' : '#E2E8F0', boxShadow: imageDropActive ? '0 0 0 4px rgba(59,130,246,0.10)' : 'none' }}
                  onClick={() => categoryImageInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImageDropActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImageDropActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImageDropActive(false);
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImageDropActive(false);
                    const file = event.dataTransfer?.files?.[0];
                    await handleCategoryImageFile(file);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      categoryImageInputRef.current?.click();
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white border shrink-0 flex items-center justify-center" style={{ borderColor: '#E2E8F0' }}>
                      {form.imageUrl ? (
                        <img src={form.imageUrl} alt="Category preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center px-2">
                          <i className="ph ph-image text-2xl" style={{ color: '#94A3B8' }}></i>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>No image</p>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Category cover image</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: '#64748B' }}>
                        {imageDropActive ? 'Drop the image here to upload.' : 'Click or drop an image here. This image will be shown for this category in the user app.'}
                      </p>
                      {form.imageUrl ? (
                        <button
                          type="button"
                          className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-rose-50 transition"
                          style={{ borderColor: 'rgba(244,63,94,0.25)', color: '#E11D48' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setForm((prev) => ({ ...prev, imageUrl: '', imageKey: '' }));
                          }}
                        >
                          Remove Picture
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={modal.mode?.includes('Sub') ? 'e.g., Drain Cleaning' : 'e.g., Plumbing'}
                  className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none transition-all"
                  style={{ borderColor: '#E2E8F0' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Visibility</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                  style={{ borderColor: '#E2E8F0' }}
                >
                  <option value="Active">Active (visible on public site)</option>
                  <option value="Paused">Hidden (paused, admin-only)</option>
                </select>
              </div>
            </>
          ) : null}

          {categoryTab === 'layout' ? (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Profile layout</label>
                <select
                  value={form.layout}
                  onChange={(e) => setForm(f => ({ ...f, layout: e.target.value }))}
                  className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                  style={{ borderColor: '#E2E8F0' }}
                >
                  <option value="default">Default (Directory)</option>
                  <option value="gallery">Gallery (visual-first)</option>
                  <option value="menu">Menu (catalog / price list)</option>
                  <option value="booking">Booking (availability-led)</option>
                  <option value="portfolio">Portfolio (trust / case studies)</option>
                  <option value="ecommerce">Ecommerce (storefront)</option>
                </select>
                <p className="mt-1.5 text-xs" style={{ color: '#64748B' }}>Controls how every provider under this category is laid out on their public profile.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Search aliases</label>
                <input
                  value={form.searchAliases.join(', ')}
                  onChange={(e) => setForm(f => ({
                    ...f,
                    searchAliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  }))}
                  placeholder="e.g. wash my car, auto detailing, car cleaning"
                  className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                  style={{ borderColor: '#E2E8F0' }}
                />
                <p className="mt-1.5 text-xs" style={{ color: '#64748B' }}>Comma-separated. Helps home page search match this category on phrases that don&apos;t contain its name.</p>
              </div>
            </>
          ) : null}

          {categoryTab === 'providerFields' ? (
            <FieldListEditor
              title="Provider fields"
              description="Extra questions shown on the provider's onboarding and profile."
              fields={form.providerFields}
              onChange={(providerFields) => setForm((f) => ({ ...f, providerFields }))}
            />
          ) : null}

          {categoryTab === 'listingFields' ? (
            <FieldListEditor
              title="Listing fields"
              description="Extra questions shown when a provider adds a listing in this category."
              fields={form.listingFields}
              onChange={(listingFields) => setForm((f) => ({ ...f, listingFields }))}
            />
          ) : null}
        </div>

        <div className="p-4 sm:p-6 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
          <button
            onClick={closeModal}
            className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#0B2046' }}
            disabled={!form.name.trim() || (modal.mode === 'addSubcategory' && !form.parentId)}
          >
            Save
          </button>
        </div>
      </DrawerShell>

      <DialogShell
        open={confirm.open}
        onClose={() => setConfirm({ open: false, scope: null, categoryId: null, subId: null })}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-lg font-bold" style={{ color: '#0F172A' }}>Delete</p>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>This action removes the category from the backend.</p>
        </div>
        <div className="p-6">
          <div className="p-4 rounded-2xl border bg-rose-50" style={{ borderColor: 'rgba(244,63,94,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#9F1239' }}>
              {confirm.scope === 'category' ? 'Delete this category?' : 'Delete this subcategory?'}
            </p>
            <p className="mt-1 text-xs" style={{ color: '#9F1239' }}>
              {confirm.scope === 'category'
                ? 'Categories with subcategories can’t be deleted — remove or move those first.'
                : 'You can recreate it later.'}
            </p>
          </div>
        </div>
        <div className="p-6 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
          <button
            onClick={() => setConfirm({ open: false, scope: null, categoryId: null, subId: null })}
            className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#E11D48' }}
          >
            Delete
          </button>
        </div>
      </DialogShell>
    </div>
  );
};

const SHOP_CATEGORY_ACCENT = { from: 'rgba(11,32,70,0.10)', to: 'rgba(250,204,21,0.14)' };

const CategoryWorkspace = ({ data, token, onReload }) => {
  const [section, setSection] = useState('service');
  const services = (data.categories || []).filter(c => (c.taxonomyKind || 'service') === 'service');
  const shops = data.shopCategories || [];
  return <div className="space-y-6">
    <div className="rounded-2xl border bg-white p-5" style={{borderColor:'#E2E8F0'}}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Category workspace</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Services & shops</h1>
      <p className="mt-2 text-sm text-slate-500">Manage business categories, their subcategories, and the questions providers answer when creating a listing.</p>
      <div className="mt-5 flex flex-wrap gap-3" role="tablist" aria-label="Category type">
        {[{key:'service',label:'Service Categories',icon:'ph-wrench',count:services.length},{key:'shop',label:'Shop Categories',icon:'ph-shopping-bag',count:shops.length}].map(tab => <button key={tab.key} type="button" role="tab" aria-selected={section===tab.key} onClick={()=>setSection(tab.key)} className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${section===tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><i className={`ph ${tab.icon} text-lg`}/>{tab.label}<span className="rounded-md bg-white/15 px-2 py-0.5 text-xs">{tab.count}</span></button>)}
      </div>
    </div>
    {section === 'service' ? <CategoriesView key="service" categoriesData={services} token={token} onReload={onReload}/> : <ShopCategoriesView key="shop" categoriesData={shops} token={token} onReload={onReload}/>}
  </div>;
};

const ShopCategoriesView = ({ categoriesData = [], token, onReload, kind = 'product' }) => {
  // The same screen manages the product tree and the service tree; only the endpoint, wording and
  // the booking hints on service nodes differ.
  const isService = kind === 'service';
  const api = isService ? '/service-categories' : '/product-categories';
  const itemWord = isService ? 'services' : 'products';
  const treeName = isService ? 'Service Categories' : 'Shop Categories';
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [openPath, setOpenPath] = useState([]);
  const [subSearch, setSubSearch] = useState('');
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      return localStorage.getItem((isService ? 'gabla_service_categories_display' : 'gabla_shop_categories_display')) || 'grid';
    } catch {
      return 'grid';
    }
  });

  const [modal, setModal] = useState({ open: false, mode: null, categoryId: null, subId: null });
  const [form, setForm] = useState({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: '', listingFields: [], bookable: false, bookingUnit: '', providerCategoryId: '' });
  const [categoryTab, setCategoryTab] = useState('details');
  const [confirm, setConfirm] = useState({ open: false, scope: null, categoryId: null, subId: null });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [activeDrag, setActiveDrag] = useState({ scope: null, itemId: null, parentId: null });
  const [savingOrder, setSavingOrder] = useState(false);
  const categoryImageInputRef = useRef(null);
  const categoriesRef = useRef([]);
  const topLevelOrderStartRef = useRef([]);
  const subcategoryOrderStartRef = useRef({ parentId: null, ids: [] });
  const lastSyncedPathRef = useRef('');

  useEffect(() => {
    setCategories((categoriesData || []).map(mapProductCategory));
  }, [categoriesData]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const serializePath = (path) => path.filter(Boolean).join(',');

  const syncPathToUrl = (path, { replace = false } = {}) => {
    const serialized = serializePath(path);
    if (serialized === lastSyncedPathRef.current) return;
    lastSyncedPathRef.current = serialized;
    const params = new URLSearchParams(location.search);
    if (path.length) {
      params.set(isService ? 'vcat' : 'scat', serialized);
    } else {
      params.delete(isService ? 'vcat' : 'scat');
    }
    const nextSearch = params.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get(isService ? 'vcat' : 'scat') || '';
    const incoming = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const serialized = serializePath(incoming);
    if (serialized === serializePath(openPath)) return;
    lastSyncedPathRef.current = serialized;
    setOpenPath(incoming);
  }, [location.search]);

  useEffect(() => {
    if (!openPath.length) return;
    const validPrefix = [];
    for (const id of openPath) {
      const node = findCategoryNode(categoriesRef.current, id);
      if (!node) break;
      validPrefix.push(id);
    }
    if (serializePath(validPrefix) !== serializePath(openPath)) {
      setOpenPath(validPrefix);
      syncPathToUrl(validPrefix, { replace: true });
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem((isService ? 'gabla_service_categories_display' : 'gabla_shop_categories_display'), displayMode);
    } catch {
      // ignore
    }
  }, [displayMode]);

  const findCategoryNode = (items, id) => {
    for (const item of items) {
      if (item.id === id) return item;
      const found = findCategoryNode(item.subcategories || [], id);
      if (found) return found;
    }
    return null;
  };

  const findPathIds = (items, targetId, currentPath = []) => {
    for (const item of items) {
      const nextPath = [...currentPath, item.id];
      if (item.id === targetId) return nextPath;
      const found = findPathIds(item.subcategories || [], targetId, nextPath);
      if (found) return found;
    }
    return null;
  };

  const openNode = (id) => {
    const path = findPathIds(categoriesRef.current, id);
    const nextPath = path || [id];
    setOpenPath(nextPath);
    syncPathToUrl(nextPath);
    setSubSearch('');
  };

  const closeNode = () => {
    setOpenPath([]);
    syncPathToUrl([]);
  };

  const goBack = () => {
    const next = openPath.slice(0, -1);
    setOpenPath(next);
    syncPathToUrl(next);
    setSubSearch('');
  };

  const goToPathIndex = (index) => {
    const next = openPath.slice(0, index + 1);
    setOpenPath(next);
    syncPathToUrl(next);
    setSubSearch('');
  };

  const updateTree = (items, targetId, updater) => {
    let changed = false;
    const next = items.map((item) => {
      if (item.id === targetId) {
        changed = true;
        return updater(item);
      }
      const subs = item.subcategories || [];
      if (!subs.length) return item;
      const nextSubs = updateTree(subs, targetId, updater);
      if (nextSubs === subs) return item;
      changed = true;
      return { ...item, subcategories: nextSubs };
    });
    return changed ? next : items;
  };

  const flattenCategoryNodes = (items, prefix = '') => {
    const result = [];
    for (const item of items) {
      result.push({ id: item.id, name: `${prefix}${item.name}` });
      const subs = item.subcategories || [];
      if (subs.length) {
        result.push(...flattenCategoryNodes(subs, `${prefix}— `));
      }
    }
    return result;
  };

  const persistOrder = async ({ parentId = null, orderedIds, nextCategories, onSuccess }) => {
    const previousCategories = categories;
    setCategories(nextCategories);
    setSavingOrder(true);
    try {
      await apiRequest(`${api}/reorder`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ parentId, orderedIds })
      });
      onSuccess?.();
      await onReload?.();
    } catch (error) {
      setCategories(previousCategories);
      window.alert(error.message || 'Unable to save category order');
    } finally {
      setSavingOrder(false);
      setActiveDrag({ scope: null, itemId: null, parentId: null });
    }
  };

  const beginTopLevelReorder = (itemId) => {
    if (savingOrder) return;
    topLevelOrderStartRef.current = categoriesRef.current.map((item) => item.id);
    setActiveDrag({ scope: 'category', itemId, parentId: null });
  };

  const updateTopLevelOrder = (nextOrder) => {
    setCategories(withSortOrder(nextOrder));
  };

  const finishTopLevelReorder = async () => {
    const nextCategories = withSortOrder(categoriesRef.current);
    const orderedIds = nextCategories.map((item) => item.id);
    if (JSON.stringify(orderedIds) === JSON.stringify(topLevelOrderStartRef.current)) {
      setCategories(nextCategories);
      setActiveDrag({ scope: null, itemId: null, parentId: null });
      return;
    }

    await persistOrder({
      parentId: null,
      orderedIds,
      nextCategories
    });
  };

  const beginSubcategoryReorder = (parentId, itemId) => {
    if (savingOrder) return;
    const parent = findCategoryNode(categoriesRef.current, parentId);
    subcategoryOrderStartRef.current = {
      parentId,
      ids: (parent?.subcategories || []).map((item) => item.id)
    };
    setActiveDrag({ scope: 'subcategory', itemId, parentId });
  };

  const updateSubcategoryOrder = (parentId, nextOrder) => {
    setCategories((current) =>
      updateTree(current, parentId, (parent) => ({ ...parent, subcategories: withSortOrder(nextOrder) }))
    );
  };

  const finishSubcategoryReorder = async (parentId) => {
    const parent = findCategoryNode(categoriesRef.current, parentId);
    const nextSubcategories = withSortOrder(parent?.subcategories || []);
    const orderedIds = nextSubcategories.map((item) => item.id);
    if (
      subcategoryOrderStartRef.current.parentId !== parentId ||
      JSON.stringify(orderedIds) === JSON.stringify(subcategoryOrderStartRef.current.ids)
    ) {
      setCategories((current) =>
        updateTree(current, parentId, (node) => ({ ...node, subcategories: nextSubcategories }))
      );
      setActiveDrag({ scope: null, itemId: null, parentId: null });
      return;
    }

    const nextCategories = updateTree(categoriesRef.current, parentId, (node) => ({ ...node, subcategories: nextSubcategories }));

    await persistOrder({
      parentId,
      orderedIds,
      nextCategories,
      onSuccess: () => openNode(parentId)
    });
  };

  const closeModal = () => setModal({ open: false, mode: null, categoryId: null, subId: null });

  const openAddCategory = () => {
    setForm({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: '', listingFields: [], bookable: false, bookingUnit: '', providerCategoryId: '' });
    setCategoryTab('details');
    setModal({ open: true, mode: 'addCategory', categoryId: null, subId: null });
  };

  const openAddSubcategory = (categoryId = '') => {
    setForm({ name: '', status: 'Active', imageUrl: '', imageKey: '', parentId: categoryId, listingFields: [], bookable: false, bookingUnit: '', providerCategoryId: '' });
    setCategoryTab('details');
    setModal({ open: true, mode: 'addSubcategory', categoryId: null, subId: null });
  };

  const openEditCategory = (categoryId) => {
    const cat = findCategoryNode(categories, categoryId);
    if (!cat) return;
    setForm({
      name: cat.name,
      status: cat.status,
      imageUrl: cat.imageUrl || '',
      imageKey: cat.imageKey || '',
      parentId: '',
      listingFields: fieldsForEditor(cat.listingFields),
      bookable: Boolean(cat.bookable),
      bookingUnit: cat.bookingUnit || '', providerCategoryId: cat.providerCategoryId || ''
    });
    setCategoryTab('details');
    setModal({ open: true, mode: 'editCategory', categoryId, subId: null });
  };

  const openEditSubcategory = (categoryId, subId) => {
    const sub = findCategoryNode(categories, subId);
    if (!sub) return;
    setForm({
      name: sub.name,
      status: sub.status,
      imageUrl: sub.imageUrl || '',
      imageKey: sub.imageKey || '',
      parentId: categoryId,
      listingFields: fieldsForEditor(sub.listingFields),
      bookable: Boolean(sub.bookable),
      bookingUnit: sub.bookingUnit || '', providerCategoryId: sub.providerCategoryId || ''
    });
    setCategoryTab('details');
    setModal({ open: true, mode: 'editSubcategory', categoryId, subId });
  };

  const requestDeleteCategory = (categoryId) => {
    setConfirm({ open: true, scope: 'category', categoryId, subId: null });
  };

  const requestDeleteSubcategory = (categoryId, subId) => {
    setConfirm({ open: true, scope: 'subcategory', categoryId, subId });
  };

  const matchesNodeQuery = (node, q) => {
    if (!q) return true;
    if ((node.name || '').toLowerCase().includes(q)) return true;
    return (node.subcategories || []).some((child) => matchesNodeQuery(child, q));
  };

  const filtered = categories.filter((c) => {
    const q = search.trim().toLowerCase();
    return matchesNodeQuery(c, q);
  });
  const canReorderCategories = !search.trim() && !savingOrder;

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'bg-emerald-100 text-emerald-800';
    if (s === 'paused') return 'bg-yellow-100 text-yellow-800';
    return 'bg-slate-200 text-slate-700';
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return;
    const imageUrl = form.imageUrl || undefined;
    const isActive = form.status === 'Active';
    const listingFields = sanitizeFields(form.listingFields);
    const association = {};
    const bookingHints = isService ? { bookable: Boolean(form.bookable), bookingUnit: form.bookable ? (form.bookingUnit || 'night') : null } : {};

    if (modal.mode === 'addCategory') {
      await apiRequest(api, {
        token,
        method: 'POST',
        body: JSON.stringify({ name, imageUrl, isActive, listingFields, ...association, ...bookingHints })
      });
      await onReload?.();
      closeModal();
      return;
    }

    if (modal.mode === 'editCategory') {
      await apiRequest(`${api}/${modal.categoryId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name, imageUrl, isActive, listingFields, ...association, ...bookingHints })
      });
      await onReload?.();
      closeModal();
      return;
    }

    if (modal.mode === 'addSubcategory') {
      const parentId = form.parentId;
      if (!parentId) return;
      await apiRequest(`${api}/sub`, {
        token,
        method: 'POST',
        body: JSON.stringify({ name, parentId, imageUrl, isActive, listingFields, ...association, ...bookingHints })
      });
      await onReload?.();
      openNode(parentId);
      closeModal();
      return;
    }

    if (modal.mode === 'editSubcategory') {
      await apiRequest(`${api}/${modal.subId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name, imageUrl, isActive, listingFields, ...association, ...bookingHints })
      });
      await onReload?.();
      closeModal();
    }
  };

  const handleCategoryImageFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      window.alert('Please select an image file.');
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await uploadFileToStorage({
        file,
        token,
        folder: isService ? 'service-category-images' : 'shop-category-images'
      });
      setForm((prev) => ({
        ...prev,
        imageUrl: uploaded.url,
        imageKey: uploaded.key
      }));
    } catch (error) {
      window.alert(error.message || 'Unable to upload category image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCategoryImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await handleCategoryImageFile(file);
  };

  const approveCategory = async (categoryId, event) => {
    event?.stopPropagation();
    try {
      await apiRequest(`${api}/${categoryId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus: 'approved' })
      });
      await onReload?.();
    } catch (error) {
      window.alert(error.message || 'Unable to approve this category');
    }
  };

  const confirmDelete = async () => {
    if (!confirm.open) return;
    try {
      if (confirm.scope === 'category') {
        await apiRequest(`${api}/${confirm.categoryId}`, { token, method: 'DELETE' });
        setOpenPath((prev) => {
          const idx = prev.indexOf(confirm.categoryId);
          if (idx === -1) return prev;
          return prev.slice(0, idx);
        });
      } else if (confirm.scope === 'subcategory') {
        await apiRequest(`${api}/${confirm.subId}`, { token, method: 'DELETE' });
        setOpenPath((prev) => {
          const idx = prev.indexOf(confirm.subId);
          if (idx === -1) return prev;
          return prev.slice(0, idx);
        });
      }
      await onReload?.();
      setConfirm({ open: false, scope: null, categoryId: null, subId: null });
    } catch (error) {
      window.alert(error.message || 'Unable to delete category');
    }
  };

  const countPending = (items) =>
    items.reduce((sum, item) => sum + (item.moderationStatus === 'pending' ? 1 : 0) + countPending(item.subcategories || []), 0);
  const pendingCategoryCount = countPending(categories);

  const currentNodeId = openPath.length ? openPath[openPath.length - 1] : null;
  const selectedCategory = currentNodeId ? findCategoryNode(categories, currentNodeId) : null;
  const pathNodes = openPath.map((id) => findCategoryNode(categories, id)).filter(Boolean);
  const selectedSubs = (selectedCategory?.subcategories || []).filter((s) => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q);
  });
  const canReorderSubcategories = Boolean(selectedCategory) && !subSearch.trim() && !savingOrder;

  const editingCategoryNode = modal.mode === 'editCategory'
    ? findCategoryNode(categories, modal.categoryId)
    : modal.mode === 'editSubcategory'
      ? findCategoryNode(categories, modal.subId)
      : null;

  const CategoryCard = ({ category }) => {
    const dragControls = useDragControls();
    const subCount = (category.subcategories || []).length;
    const isDragging = activeDrag.scope === 'category' && activeDrag.itemId === category.id;
    const content = (
      <div
        className="relative aspect-[4/3] p-6 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${SHOP_CATEGORY_ACCENT.from}, ${SHOP_CATEGORY_ACCENT.to})`
        }}
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 pointer-events-none" style={{ background: category.imageUrl ? 'linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.68))' : 'radial-gradient(650px 320px at 30% 0%, rgba(255,255,255,0.85), rgba(255,255,255,0))' }}></div>
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: category.imageUrl ? 'radial-gradient(420px 220px at 80% 70%, rgba(15,23,42,0.35), rgba(15,23,42,0))' : 'radial-gradient(400px 220px at 80% 70%, rgba(11,32,70,0.10), rgba(11,32,70,0))' }}></div>

        <div className="relative flex flex-col items-center justify-end text-center gap-4 h-full w-full">
          {canReorderCategories ? (
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => {
                event.stopPropagation();
                beginTopLevelReorder(category.id);
                dragControls.start(event);
              }}
              className="absolute top-0 right-0 p-2 rounded-xl border bg-white/80 hover:bg-white transition cursor-grab active:cursor-grabbing"
              style={{ borderColor: 'rgba(226,232,240,0.85)', color: '#0B2046', backdropFilter: 'blur(8px)' }}
              aria-label={`Drag ${category.name}`}
              title="Drag to reorder"
            >
              <i className="ph ph-dots-six-vertical text-lg"></i>
            </button>
          ) : null}
          {!category.imageUrl ? (
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-white/65 border" style={{ borderColor: 'rgba(226,232,240,0.75)', color: '#0B2046' }}>
              <i className="ph ph-image text-3xl"></i>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-extrabold tracking-widest uppercase" style={{ color: category.imageUrl ? '#FFFFFF' : '#0F172A' }}>{category.name}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge(category.status)}`}>{category.status}</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold" style={category.imageUrl ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' } : { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                {category.products.toLocaleString('en-UG')} {itemWord}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold" style={category.imageUrl ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' } : { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                {subCount} sub
              </span>
              {category.moderationStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                  <i className="ph ph-hourglass-medium"></i> Pending review
                </span>
              ) : null}
            </div>
            {category.moderationStatus === 'pending' ? (
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 hover:bg-white transition"
                style={{ color: '#0B2046' }}
                onClick={(event) => approveCategory(category.id, event)}
              >
                Approve
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );

    if (!canReorderCategories) {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border overflow-hidden group cursor-pointer"
          style={{
            borderColor: 'rgba(226,232,240,0.85)',
            boxShadow: '0 14px 40px -28px rgba(11,32,70,0.35)'
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => openNode(category.id)}
        >
          {content}
        </motion.div>
      );
    }

    return (
      <Reorder.Item
        value={category}
        id={category.id}
        dragListener={false}
        dragControls={dragControls}
        className="rounded-3xl border overflow-hidden group cursor-pointer"
        style={{
          borderColor: isDragging ? 'rgba(11,32,70,0.35)' : 'rgba(226,232,240,0.85)',
          boxShadow: '0 14px 40px -28px rgba(11,32,70,0.35)',
          opacity: isDragging ? 0.88 : 1
        }}
        whileDrag={{
          scale: 1.02,
          rotate: 1,
          zIndex: 40,
          boxShadow: '0 28px 80px -28px rgba(11,32,70,0.45)'
        }}
        whileHover={{ y: -2 }}
        onClick={() => openNode(category.id)}
        onDragStart={() => beginTopLevelReorder(category.id)}
        onDragEnd={finishTopLevelReorder}
      >
        {content}
      </Reorder.Item>
    );
  };

  const SubcategoryRow = ({ subcategory, parentId, reorderEnabled = false }) => {
    const dragControls = useDragControls();
    const isDraggingSubcategory =
      activeDrag.scope === 'subcategory' &&
      activeDrag.parentId === parentId &&
      activeDrag.itemId === subcategory.id;

    const content = (
      <>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{subcategory.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(subcategory.status)}`}>{subcategory.status}</span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
              {(subcategory.subcategories || []).length}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
              {subcategory.products.toLocaleString('en-UG')} {itemWord}
            </span>
            {subcategory.moderationStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                <i className="ph ph-hourglass-medium"></i> Pending review
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subcategory.moderationStatus === 'pending' ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border hover:bg-slate-100 transition"
              style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
              onClick={(event) => approveCategory(subcategory.id, event)}
            >
              Approve
            </button>
          ) : null}
          {reorderEnabled ? (
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                beginSubcategoryReorder(parentId, subcategory.id);
                dragControls.start(event);
              }}
              className="p-2 rounded-xl border bg-white hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
              style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
              aria-label={`Drag ${subcategory.name}`}
              title="Drag to reorder"
            >
              <i className="ph ph-dots-six-vertical text-lg"></i>
            </button>
          ) : null}
          <button
            className="p-2 rounded-xl hover:bg-slate-100 transition"
            style={{ color: '#0B2046' }}
            onClick={(event) => {
              event.stopPropagation();
              openEditSubcategory(parentId, subcategory.id);
            }}
          >
            <i className="ph ph-pencil-simple text-lg"></i>
          </button>
          <button
            className="p-2 rounded-xl hover:bg-rose-50 transition"
            style={{ color: '#E11D48' }}
            onClick={(event) => {
              event.stopPropagation();
              requestDeleteSubcategory(parentId, subcategory.id);
            }}
          >
            <i className="ph ph-trash text-lg"></i>
          </button>
          <button
            className="p-2 rounded-xl hover:bg-slate-100 transition"
            style={{ color: '#0B2046' }}
            onClick={(event) => {
              event.stopPropagation();
              openNode(subcategory.id);
            }}
            title="Open"
          >
            <i className="ph ph-caret-right text-lg"></i>
          </button>
        </div>
      </>
    );

    if (!reorderEnabled) {
      return (
        <motion.div
          layout
          className="flex items-center justify-between gap-3 p-4 rounded-2xl border bg-slate-50 hover:bg-white transition"
          style={{ borderColor: '#E2E8F0' }}
          whileHover={{ y: -1 }}
          onClick={() => openNode(subcategory.id)}
        >
          {content}
        </motion.div>
      );
    }

    return (
      <Reorder.Item
        value={subcategory}
        id={subcategory.id}
        dragListener={false}
        dragControls={dragControls}
        className="flex items-center justify-between gap-3 p-4 rounded-2xl border bg-slate-50 hover:bg-white transition"
        style={{
          borderColor: isDraggingSubcategory ? 'rgba(11,32,70,0.35)' : '#E2E8F0',
          opacity: isDraggingSubcategory ? 0.88 : 1
        }}
        whileHover={{ y: -1 }}
        whileDrag={{
          scale: 1.01,
          zIndex: 30,
          boxShadow: '0 20px 44px -20px rgba(11,32,70,0.35)'
        }}
        onClick={() => openNode(subcategory.id)}
        onDragStart={() => beginSubcategoryReorder(parentId, subcategory.id)}
        onDragEnd={() => finishSubcategoryReorder(parentId)}
      >
        {content}
      </Reorder.Item>
    );
  };

  const countDescendants = (node) => {
    const subs = node.subcategories || [];
    return subs.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
  };

  const ShopCategoriesTable = ({ items }) => (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: '#64748B', backgroundColor: 'rgba(248,250,252,0.8)' }}>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">{isService ? 'Services' : 'Products'}</th>
              <th className="px-5 py-3 font-semibold">Subcategories</th>
              <th className="px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((category) => (
              <tr
                key={category.id}
                className="border-t hover:bg-slate-50 transition cursor-pointer"
                style={{ borderColor: '#E2E8F0' }}
                onClick={() => openNode(category.id)}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0" style={{ borderColor: 'rgba(226,232,240,0.9)' }}>
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <i className="ph ph-image text-lg" style={{ color: '#0B2046' }}></i>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{category.name}</p>
                      <p className="text-xs truncate" style={{ color: '#64748B' }}>{countDescendants(category)} total subcategories</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(category.status)}`}>{category.status}</span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#0B2046' }}>{category.products.toLocaleString('en-UG')}</td>
                <td className="px-5 py-4 text-sm font-semibold" style={{ color: '#0B2046' }}>{(category.subcategories || []).length}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-2 rounded-xl hover:bg-white transition"
                      style={{ color: '#0B2046' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditCategory(category.id);
                      }}
                      title="Edit"
                    >
                      <i className="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-rose-50 transition"
                      style={{ color: '#E11D48' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteCategory(category.id);
                      }}
                      title="Delete"
                    >
                      <i className="ph ph-trash text-lg"></i>
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-white transition"
                      style={{ color: '#0B2046' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openNode(category.id);
                      }}
                      title="Open"
                    >
                      <i className="ph ph-caret-right text-lg"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>{treeName}</h1>
            {pendingCategoryCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                <i className="ph ph-hourglass-medium"></i> {pendingCategoryCount} pending review
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{isService ? 'Manage the service categories (hotels, venues, repairs, salons...), the questions providers answer for each, and which ones are normally booked. Subcategories providers add themselves are live right away and flagged here for review.' : 'Manage shop product categories and nested subcategories. Subcategories providers add themselves are live right away and flagged here for review.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl border flex items-center gap-1" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-semibold transition"
              style={displayMode === 'grid' ? { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' } : { backgroundColor: 'transparent', color: '#64748B' }}
              onClick={() => setDisplayMode('grid')}
              title="Grid"
            >
              <i className="ph ph-squares-four"></i>
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-semibold transition"
              style={displayMode === 'list' ? { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' } : { backgroundColor: 'transparent', color: '#64748B' }}
              onClick={() => setDisplayMode('list')}
              title="List"
            >
              <i className="ph ph-table"></i>
            </button>
          </div>
          <button
            className="px-4 py-2.5 text-white rounded-xl font-semibold transition hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 10px -4px rgba(11,32,70,0.35)' }}
            onClick={openAddCategory}
          >
            <i className="ph ph-folder-plus"></i>
            Add Category
          </button>
          <button
            className="px-4 py-2.5 rounded-xl font-semibold transition hover:bg-slate-50 border flex items-center gap-2"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            onClick={() => openAddSubcategory('')}
          >
            <i className="ph ph-plus"></i>
            Add Subcategory
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
        <div className="relative">
          <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
          <input
            type="text"
            placeholder={isService ? 'Search service categories or subcategories...' : 'Search shop categories or subcategories...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border text-sm rounded-xl py-3 pl-12 pr-4 outline-none transition-all"
            style={{ borderColor: '#E2E8F0' }}
          />
        </div>
        <p className="mt-3 text-xs" style={{ color: '#64748B' }}>
          {displayMode === 'list'
            ? (canReorderCategories ? 'Switch to grid to drag and save category order.' : 'Clear the search to reorder categories in grid view.')
            : (canReorderCategories ? 'Drag categories by the handle to save their order in the app.' : 'Clear the search to reorder categories.')}
        </p>
      </div>

      {filtered.length ? (
        displayMode === 'list' ? (
          <ShopCategoriesTable items={filtered} />
        ) : (
          canReorderCategories ? (
            <Reorder.Group
              axis="y"
              values={categories}
              onReorder={updateTopLevelOrder}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {categories.map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </Reorder.Group>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filtered.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </AnimatePresence>
            </motion.div>
          )
        )
      ) : (
        <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046' }}>
            <i className="ph ph-magnifying-glass text-3xl"></i>
          </div>
          <p className="mt-4 text-base font-bold" style={{ color: '#0F172A' }}>No categories found</p>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Try a different keyword or create a new category.</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              className="px-5 py-2.5 text-white rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: '#0B2046' }}
              onClick={openAddCategory}
            >
              Add Category
            </button>
            <button
              className="px-5 py-2.5 rounded-xl font-semibold transition hover:bg-slate-50 border"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
              onClick={() => setSearch('')}
            >
              Clear Search
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedCategory ? (
          <motion.section
            className="fixed top-20 bottom-0 left-0 right-0 md:left-64 z-[950] bg-slate-50 flex flex-col"
            initial={{ opacity: 0, y: 18, pointerEvents: 'auto' }}
            animate={{ opacity: 1, y: 0, pointerEvents: 'auto' }}
            exit={{ opacity: 0, y: 18, pointerEvents: 'none' }}
            transition={{ duration: 0.22 }}
          >
            <div className="border-b bg-white/90 backdrop-blur-sm shrink-0" style={{ borderColor: '#E2E8F0', boxShadow: '0 10px 40px -28px rgba(11,32,70,0.28)' }}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {pathNodes.length ? (
                      <div className="mb-3 flex items-center gap-2">
                        {openPath.length > 1 ? (
                          <button
                            type="button"
                            className="p-2 rounded-xl border hover:bg-slate-50 transition"
                            style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                            onClick={goBack}
                            title="Back"
                          >
                            <i className="ph ph-arrow-left"></i>
                          </button>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-1 text-xs font-semibold" style={{ color: '#64748B' }}>
                          {pathNodes.map((node, idx) => (
                            <span key={node.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                className="hover:underline transition"
                                style={{ color: idx === pathNodes.length - 1 ? '#0B2046' : '#64748B' }}
                                onClick={() => goToPathIndex(idx)}
                              >
                                {node.name}
                              </button>
                              {idx < pathNodes.length - 1 ? <i className="ph ph-caret-right"></i> : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center border overflow-hidden bg-slate-100 shrink-0"
                        style={{
                          borderColor: 'rgba(226,232,240,0.85)',
                          background: selectedCategory.imageUrl ? '#E2E8F0' : `linear-gradient(135deg, ${SHOP_CATEGORY_ACCENT.from}, ${SHOP_CATEGORY_ACCENT.to})`
                        }}
                      >
                        {selectedCategory.imageUrl ? (
                          <img src={selectedCategory.imageUrl} alt={selectedCategory.name} className="w-full h-full object-cover" />
                        ) : (
                          <i className="ph ph-image text-2xl" style={{ color: '#0B2046' }}></i>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-extrabold truncate" style={{ color: '#0F172A' }}>{selectedCategory.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(selectedCategory.status)}`}>{selectedCategory.status}</span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                            {(selectedCategory.subcategories || []).length} subcategories
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button onClick={closeNode} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
                    <i className="ph ph-x text-xl"></i>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{isService ? 'Services' : 'Products'}</p>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: '#0B2046' }}>{(selectedCategory.products || 0).toLocaleString('en-UG')}</p>
                  </div>
                  <div className="p-3 rounded-2xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Subcategories</p>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: '#0B2046' }}>{(selectedCategory.subcategories || []).length}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: '#0B2046' }}
                    onClick={() => openAddSubcategory(selectedCategory.id)}
                  >
                    <i className="ph ph-plus mr-2"></i>
                    Add Subcategory
                  </button>
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                    onClick={() => openEditCategory(selectedCategory.id)}
                  >
                    <i className="ph ph-pencil-simple mr-2"></i>
                    Edit Category
                  </button>
                  <button
                    className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-rose-50 transition"
                    style={{ borderColor: 'rgba(244,63,94,0.25)', color: '#E11D48' }}
                    onClick={() => requestDeleteCategory(selectedCategory.id)}
                  >
                    <i className="ph ph-trash mr-2"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>

              <motion.div
                key={currentNodeId}
                className="flex-1 overflow-y-auto"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold" style={{ color: '#0F172A' }}>Subcategories</p>
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                        {selectedSubs.length} items
                      </span>
                    </div>

                    <div className="mt-3 bg-white p-3 rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
                      <div className="relative">
                        <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
                        <input
                          value={subSearch}
                          onChange={(e) => setSubSearch(e.target.value)}
                          placeholder="Search subcategories..."
                          className="w-full bg-slate-50 border text-sm rounded-xl py-3 pl-12 pr-4 outline-none transition-all"
                          style={{ borderColor: '#E2E8F0' }}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-xs" style={{ color: '#64748B' }}>
                      {canReorderSubcategories ? 'Drag subcategories by the handle to save their order in the app.' : 'Clear the subcategory search to reorder items.'}
                    </p>

                    {(selectedCategory.subcategories || []).length ? (
                      selectedSubs.length ? (
                        canReorderSubcategories ? (
                          <Reorder.Group
                            axis="y"
                            values={selectedCategory.subcategories || []}
                            onReorder={(nextOrder) => updateSubcategoryOrder(selectedCategory.id, nextOrder)}
                            className="mt-4 space-y-2"
                          >
                            {(selectedCategory.subcategories || []).map((s) => (
                              <SubcategoryRow
                                key={s.id}
                                subcategory={s}
                                parentId={selectedCategory.id}
                                reorderEnabled
                              />
                            ))}
                          </Reorder.Group>
                        ) : (
                          <div className="mt-4 space-y-2">
                            {selectedSubs.map((s) => (
                              <SubcategoryRow
                                key={s.id}
                                subcategory={s}
                                parentId={selectedCategory.id}
                              />
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="mt-4 p-8 rounded-2xl border bg-slate-50 text-center" style={{ borderColor: '#E2E8F0' }}>
                          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046' }}>
                            <i className="ph ph-magnifying-glass text-2xl"></i>
                          </div>
                          <p className="mt-3 text-sm font-semibold" style={{ color: '#0F172A' }}>No matches</p>
                          <p className="mt-1 text-xs" style={{ color: '#64748B' }}>Try another keyword.</p>
                          <button
                            className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-white transition"
                            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                            onClick={() => setSubSearch('')}
                          >
                            Clear Search
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="mt-4 p-8 rounded-2xl border bg-slate-50 text-center" style={{ borderColor: '#E2E8F0' }}>
                        <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                          <i className="ph ph-folder-notch-open text-2xl"></i>
                        </div>
                        <p className="mt-3 text-sm font-semibold" style={{ color: '#0F172A' }}>No subcategories yet</p>
                        <p className="mt-1 text-xs" style={{ color: '#64748B' }}>Add subcategories to organize products.</p>
                        <button
                          className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: '#0B2046' }}
                          onClick={() => openAddSubcategory(selectedCategory.id)}
                        >
                          Add Subcategory
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <DrawerShell
        open={modal.open}
        onClose={closeModal}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold" style={{ color: '#0F172A' }}>
                {modal.mode === 'addCategory' ? 'Add ' + (isService ? 'Service' : 'Shop') + ' Category' : null}
                {modal.mode === 'editCategory' ? 'Edit ' + (isService ? 'Service' : 'Shop') + ' Category' : null}
                {modal.mode === 'addSubcategory' ? 'Add Subcategory' : null}
                {modal.mode === 'editSubcategory' ? 'Edit Subcategory' : null}
              </p>
              <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Changes are saved to the backend.</p>
            </div>
            <button onClick={closeModal} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
              <i className="ph ph-x text-xl"></i>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {[{ key: 'details', label: 'Details' }, { key: 'fields', label: 'Listing fields' }].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryTab(tab.key)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                style={categoryTab === tab.key
                  ? { backgroundColor: '#0B2046', color: '#fff' }
                  : { backgroundColor: '#F1F5F9', color: '#475569' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {categoryTab === 'fields' ? (
            <FieldListEditor
              title="Listing fields"
              description={`Extra questions shown when a provider adds a ${isService ? 'service' : 'product'} in this category (e.g. ${isService ? 'Amenities, Capacity, Star rating' : 'Make, Color, Mileage'}). A subcategory automatically inherits its parent's fields too - only add ones specific to this category here.`}
              fields={form.listingFields}
              onChange={(listingFields) => setForm((f) => ({ ...f, listingFields }))}
            />
          ) : null}

          {categoryTab === 'details' && modal.mode === 'addSubcategory' && !form.parentId ? (
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Parent Category</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              >
                <option value="">Select a parent category</option>
                {flattenCategoryNodes(categories).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {categoryTab === 'details' ? (
          <>
          {isService ? (
            <div className="rounded-2xl border p-4 bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-semibold" style={{ color: '#0F172A' }}>Usually booked</span>
                  <span className="block text-xs mt-0.5" style={{ color: '#64748B' }}>Hotels, venues, salons and similar. Providers still choose per service whether it takes bookings; this suggests it and pre-fills the unit.</span>
                </span>
                <input type="checkbox" checked={Boolean(form.bookable)} onChange={(e) => setForm((f) => ({ ...f, bookable: e.target.checked }))} className="h-5 w-5" />
              </label>
              {form.bookable ? (
                <div className="mt-3">
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Booked by the</label>
                  <select value={form.bookingUnit || 'night'} onChange={(e) => setForm((f) => ({ ...f, bookingUnit: e.target.value }))} className="bg-white border text-sm rounded-xl py-2 px-3 outline-none" style={{ borderColor: '#E2E8F0' }}>
                    <option value="night">Night (rooms, stays)</option>
                    <option value="day">Day (venues, car hire)</option>
                    <option value="hour">Hour (appointments, studios)</option>
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>Picture</label>
              <input
                ref={categoryImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCategoryImageSelect}
              />
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-sm font-semibold border hover:bg-slate-50 transition disabled:opacity-60"
                style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                onClick={() => categoryImageInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? 'Uploading...' : form.imageUrl ? 'Change Picture' : 'Upload Picture'}
              </button>
            </div>
            <div
              className="rounded-2xl border p-4 bg-slate-50 transition"
              style={{ borderColor: imageDropActive ? 'rgba(59,130,246,0.45)' : '#E2E8F0', boxShadow: imageDropActive ? '0 0 0 4px rgba(59,130,246,0.10)' : 'none' }}
              onClick={() => categoryImageInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setImageDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setImageDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setImageDropActive(false);
              }}
              onDrop={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                setImageDropActive(false);
                const file = event.dataTransfer?.files?.[0];
                await handleCategoryImageFile(file);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  categoryImageInputRef.current?.click();
                }
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white border shrink-0 flex items-center justify-center" style={{ borderColor: '#E2E8F0' }}>
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="Category preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center px-2">
                      <i className="ph ph-image text-2xl" style={{ color: '#94A3B8' }}></i>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>No image</p>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Category cover image</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: '#64748B' }}>
                    {imageDropActive ? 'Drop the image here to upload.' : 'Click or drop an image here. This image will be shown for this category in the shop app.'}
                  </p>
                  {form.imageUrl ? (
                    <button
                      type="button"
                      className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-rose-50 transition"
                      style={{ borderColor: 'rgba(244,63,94,0.25)', color: '#E11D48' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setForm((prev) => ({ ...prev, imageUrl: '', imageKey: '' }));
                      }}
                    >
                      Remove Picture
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={modal.mode?.includes('Sub') ? 'e.g., Kitchenware' : 'e.g., Home & Living'}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none transition-all"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Visibility</label>
            <select
              value={form.status}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="Active">Active (visible on public site)</option>
              <option value="Paused">Hidden (paused, admin-only)</option>
            </select>
          </div>

          {(modal.mode === 'editCategory' || modal.mode === 'editSubcategory') && editingCategoryNode ? (
            <div className="p-4 rounded-2xl border bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Moderation status</p>
                  <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
                    {editingCategoryNode.moderationStatus === 'pending'
                      ? 'This category was submitted by a provider and is awaiting approval.'
                      : 'This category has been approved.'}
                  </p>
                </div>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                  style={editingCategoryNode.moderationStatus === 'pending' ? { backgroundColor: '#FEF3C7', color: '#92400E' } : { backgroundColor: '#DCFCE7', color: '#166534' }}
                >
                  {editingCategoryNode.moderationStatus === 'pending' ? 'Pending review' : 'Approved'}
                </span>
              </div>
              {editingCategoryNode.moderationStatus === 'pending' ? (
                <button
                  type="button"
                  className="mt-3 px-3 py-2 rounded-xl text-sm font-semibold border hover:bg-white transition"
                  style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                  onClick={(event) => approveCategory(editingCategoryNode.id, event)}
                >
                  Approve
                </button>
              ) : null}
            </div>
          ) : null}
          </>
          ) : null}
        </div>

        <div className="p-4 sm:p-6 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
          <button
            onClick={closeModal}
            className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#0B2046' }}
            disabled={!form.name.trim() || (modal.mode === 'addSubcategory' && !form.parentId)}
          >
            Save
          </button>
        </div>
      </DrawerShell>

      <DialogShell
        open={confirm.open}
        onClose={() => setConfirm({ open: false, scope: null, categoryId: null, subId: null })}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-lg font-bold" style={{ color: '#0F172A' }}>Delete</p>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>This action removes the category from the backend.</p>
        </div>
        <div className="p-6">
          <div className="p-4 rounded-2xl border bg-rose-50" style={{ borderColor: 'rgba(244,63,94,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#9F1239' }}>
              {confirm.scope === 'category' ? 'Delete this category?' : 'Delete this subcategory?'}
            </p>
            <p className="mt-1 text-xs" style={{ color: '#9F1239' }}>
              {confirm.scope === 'category'
                ? 'Categories with subcategories can’t be deleted — remove or move those first.'
                : 'You can recreate it later.'}
            </p>
          </div>
        </div>
        <div className="p-6 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
          <button
            onClick={() => setConfirm({ open: false, scope: null, categoryId: null, subId: null })}
            className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#E11D48' }}
          >
            Delete
          </button>
        </div>
      </DialogShell>
    </div>
  );
};

const ListingsView = ({ listingsData = [], providersData = [], categoriesData = [], token, onReload }) => {
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? n.toLocaleString('en-UG') : '0'}`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const categories = ['All Categories', ...(categoriesData || []).map(c => c.name || 'Uncategorized')];
  const types = ['All Types', 'Service', 'Product'];
  const statuses = ['All Statuses', 'Approved', 'Pending', 'Suspended'];
  const sorts = [
    { key: 'newest', label: 'Newest' },
    { key: 'popular', label: 'Most Viewed' },
    { key: 'revenue', label: 'Top Revenue' },
    { key: 'price_low', label: 'Price: Low' },
    { key: 'price_high', label: 'Price: High' }
  ];

  const initial = [
    {
      id: 'LST-20031',
      title: 'Emergency Leak Repair',
      type: 'Service',
      provider: 'Kampala Elite Plumbing',
      providerId: 'PRV-10021',
      category: 'Plumbing',
      priceUgx: 80000,
      status: 'Approved',
      featured: true,
      createdAt: '2023-10-24T12:05:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1600566753151-384129cf4e3f?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Rapid response leak repair for homes and businesses in Kampala & Wakiso. Includes inspection, sealing, and basic fittings replacement.',
      views: 4820,
      purchases: 164,
      revenueUgx: 13120000
    },
    {
      id: 'LST-20030',
      title: 'Solar Installation (Basic)',
      type: 'Service',
      provider: 'Nakasero Spark Electric',
      providerId: 'PRV-10020',
      category: 'Electricians',
      priceUgx: 850000,
      status: 'Approved',
      featured: false,
      createdAt: '2023-10-20T10:55:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Entry-level solar installation for small households. Panel setup, wiring, and controller configuration with safety checks included.',
      views: 3210,
      purchases: 38,
      revenueUgx: 32300000
    },
    {
      id: 'LST-20029',
      title: 'Deep Cleaning (2BR)',
      type: 'Service',
      provider: 'Kireka Cleaners',
      providerId: 'PRV-10019',
      category: 'Cleaning',
      priceUgx: 150000,
      status: 'Suspended',
      featured: false,
      createdAt: '2023-10-05T09:12:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1581579185169-4b1ce1f44c3a?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1581579185169-4b1ce1f44c3a?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Thorough deep cleaning for 2-bedroom homes. Includes kitchen, bathrooms, floors, and high-touch surfaces. Supplies included.',
      views: 980,
      purchases: 27,
      revenueUgx: 4050000
    },
    {
      id: 'LST-20028',
      title: 'Tap Set (Premium)',
      type: 'Product',
      provider: 'Kampala Elite Plumbing',
      providerId: 'PRV-10021',
      category: 'Plumbing',
      priceUgx: 120000,
      status: 'Pending',
      featured: false,
      createdAt: '2023-10-23T16:40:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1585675100414-02a0c0cbe94a?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1585675100414-02a0c0cbe94a?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Premium chrome tap set suitable for kitchens and bathrooms. Durable build with smooth handle action and easy installation.',
      views: 1220,
      purchases: 59,
      revenueUgx: 7080000
    },
    {
      id: 'LST-20027',
      title: 'Logo Design Package',
      type: 'Service',
      provider: 'Nabugabo Designs',
      providerId: 'PRV-10018',
      category: 'IT & Tech',
      priceUgx: 250000,
      status: 'Approved',
      featured: false,
      createdAt: '2023-09-18T10:05:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Brand-ready logo design with 3 concepts, 2 revision rounds, and final exports for web + print. Ideal for SMEs and startups.',
      views: 4100,
      purchases: 84,
      revenueUgx: 21000000
    },
    {
      id: 'LST-20026',
      title: 'Engine Oil (5L)',
      type: 'Product',
      provider: 'Mbarara Auto Care',
      providerId: 'PRV-10017',
      category: 'Auto',
      priceUgx: 95000,
      status: 'Approved',
      featured: true,
      createdAt: '2023-08-25T11:00:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1612810436541-336b8238eacb?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1612810436541-336b8238eacb?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1515923160492-5d7b58d26167?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'High-performance engine oil (5L) for petrol and diesel vehicles. Suitable for daily driving and long trips.',
      views: 6900,
      purchases: 310,
      revenueUgx: 29450000
    },
    {
      id: 'LST-20025',
      title: 'Bridal Makeup (Full)',
      type: 'Service',
      provider: 'Kampala Glam Studio',
      providerId: 'PRV-10022',
      category: 'Salon & Beauty',
      priceUgx: 180000,
      status: 'Pending',
      featured: false,
      createdAt: '2023-10-10T09:30:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1527799820374-dcf8b41e2dba?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Premium bridal makeup session including skin prep, lashes, and touch-up kit. Tailored looks for photos and long wear.',
      views: 1750,
      purchases: 23,
      revenueUgx: 4140000
    },
    {
      id: 'LST-20024',
      title: 'Boda Courier Delivery (City)',
      type: 'Service',
      provider: 'Kawempe Riders',
      providerId: 'PRV-10023',
      category: 'Boda & Transport',
      priceUgx: 12000,
      status: 'Approved',
      featured: false,
      createdAt: '2023-10-02T14:20:00Z',
      thumbnail: 'https://images.unsplash.com/photo-1558980664-10ea85d918e1?auto=format&fit=crop&w=900&q=60',
      gallery: [
        'https://images.unsplash.com/photo-1558980664-10ea85d918e1?auto=format&fit=crop&w=900&q=60'
      ],
      description: 'Fast boda courier delivery across Kampala. Same-day delivery for documents and small parcels with tracking updates.',
      views: 9800,
      purchases: 1240,
      revenueUgx: 14880000
    }
  ];

  const providers = ['All Providers', ...(providersData || []).map(p => p.businessName || 'Unnamed provider')];

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [providerFilter, setProviderFilter] = useState('All Providers');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const selected = items.find(i => i.id === selectedId) || null;

  const pageSize = 12;
  const [bannedProviders, setBannedProviders] = useState(() => ({}));
  const [edit, setEdit] = useState({ open: false, id: null });
  const [editForm, setEditForm] = useState({ title: '', priceUgx: '', status: 'Pending', type: 'Service', category: 'Plumbing', description: '', onlinePaymentEnabled: true });

  useEffect(() => {
    setItems((listingsData || []).map(mapListing));
  }, [listingsData]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, categoryFilter, providerFilter, statusFilter, sortKey]);

  const badge = (value) => {
    const v = String(value || '');
    const map = {
      Approved: 'bg-emerald-100 text-emerald-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Suspended: 'bg-slate-200 text-slate-700',
      Service: 'bg-blue-100 text-blue-800',
      Product: 'bg-purple-100 text-purple-800'
    };
    return map[v] || 'bg-slate-200 text-slate-700';
  };

  const filtered = items
    .filter((l) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.provider.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q);
      const matchType = typeFilter === 'All Types' || l.type === typeFilter;
      const matchCategory = categoryFilter === 'All Categories' || l.category === categoryFilter;
      const matchProvider = providerFilter === 'All Providers' || l.provider === providerFilter;
      const matchStatus = statusFilter === 'All Statuses' || l.status === statusFilter;
      return matchQuery && matchType && matchCategory && matchProvider && matchStatus;
    })
    .sort((a, b) => {
      if (sortKey === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortKey === 'price_high') return (b.priceUgx || 0) - (a.priceUgx || 0);
      if (sortKey === 'price_low') return (a.priceUgx || 0) - (b.priceUgx || 0);
      if (sortKey === 'popular') return (b.views || 0) - (a.views || 0);
      if (sortKey === 'revenue') return (b.revenueUgx || 0) - (a.revenueUgx || 0);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const updateListing = async (id, patch) => {
    await apiRequest(`/admin/listings/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({
        ...(patch.title !== undefined ? { name: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priceUgx !== undefined ? { price: Number(patch.priceUgx || 0) } : {}),
        ...(patch.status !== undefined ? { status: toBackendListingStatus(patch.status) } : {}),
        ...(patch.type !== undefined ? { type: toBackendListingType(patch.type) } : {}),
        ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
        ...(patch.onlinePaymentEnabled !== undefined ? { onlinePaymentEnabled: patch.onlinePaymentEnabled } : {})
      })
    });
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await onReload?.();
  };

  const removeListing = async (id) => {
    await apiRequest(`/admin/listings/${id}`, { token, method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedId(prev => (prev === id ? null : prev));
    await onReload?.();
  };

  const isBanned = (providerId) => Boolean(bannedProviders?.[providerId]);

  const banProvider = async (providerId) => {
    setBannedProviders(prev => {
      const next = { ...(prev || {}) };
      next[providerId] = !next[providerId];
      return next;
    });
    setItems(prev => prev.map(i => i.providerId === providerId ? { ...i, status: 'Suspended' } : i));
    await apiRequest(`/admin/providers/${providerId}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status: isBanned(providerId) ? 'approved' : 'suspended' })
    });
    await onReload?.();
  };

  const openEdit = (listing) => {
    if (!listing) return;
    setEditForm({
      title: listing.title || '',
      priceUgx: String(listing.priceUgx ?? ''),
      status: listing.status || 'Pending',
      type: listing.type || 'Service',
      category: listing.category || 'Plumbing',
      description: listing.description || '',
      onlinePaymentEnabled: listing.onlinePaymentEnabled !== false
    });
    setEdit({ open: true, id: listing.id });
  };

  const saveEdit = async () => {
    const id = edit.id;
    if (!id) return;
    const price = Number(String(editForm.priceUgx).replace(/[^\d]/g, ''));
    await updateListing(id, {
      title: editForm.title.trim() || 'Untitled',
      priceUgx: Number.isFinite(price) ? price : 0,
      status: editForm.status,
      type: editForm.type,
      category: editForm.category,
      description: editForm.description,
      onlinePaymentEnabled: editForm.onlinePaymentEnabled
    });
    setEdit({ open: false, id: null });
  };

  const ModalShell = ({ open, children, onClose }) => (
    createPortal(
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/30 z-[998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-white border rounded-2xl z-[999] overflow-y-auto overscroll-contain max-h-[90vh]"
              style={{ borderColor: '#E2E8F0', boxShadow: '0 20px 70px -30px rgba(11,32,70,0.45)' }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>,
      document.body
    )
  );

  const CountPill = ({ label, value, active, onClick, tone = 'blue' }) => {
    const tones = {
      blue: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046' },
      navy: { from: '#C7D2FE', to: '#A5B4FC', ink: '#0B2046' },
      cyan: { from: '#CFFAFE', to: '#A5F3FC', ink: '#0B2046' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046' },
      yellow: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046' },
      slate: { from: '#F1F5F9', to: '#E2E8F0', ink: '#0F172A' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239' }
    };
    const t = tones[tone] || tones.blue;
    return (
    <button
      onClick={onClick}
      className="px-4 py-3 rounded-2xl border text-left transition hover:-translate-y-0.5"
      style={active
        ? { borderColor: 'rgba(250,204,21,0.78)', background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: '0 18px 46px -34px rgba(11,32,70,0.40)' }
        : { borderColor: 'rgba(226,232,240,0.78)', background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: '0 12px 34px -30px rgba(11,32,70,0.20)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: active ? t.ink : '#0B2046' }}>{value}</p>
    </button>
    );
  };

  const StatChip = ({ label, value, icon, variant = 'light' }) => (
    <div
      className="p-3 rounded-2xl border"
      style={variant === 'dark'
        ? { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }
        : { borderColor: 'rgba(226,232,240,0.85)', backgroundColor: '#ffffff' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: variant === 'dark' ? 'rgba(226,232,240,0.85)' : '#94A3B8' }}>{label}</p>
          <p className="mt-1 text-sm font-extrabold" style={{ color: variant === 'dark' ? '#F8FAFC' : '#0F172A' }}>{value}</p>
        </div>
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={variant === 'dark'
            ? { backgroundColor: 'rgba(250,204,21,0.18)', color: '#FDE68A' }
            : { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}
        >
          <i className={`ph ${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Listings</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Moderate services and products from providers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2.5 rounded-xl font-semibold border transition hover:bg-slate-50 flex items-center gap-2"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            onClick={() => { setQuery(''); setTypeFilter('All Types'); setCategoryFilter('All Categories'); setProviderFilter('All Providers'); setStatusFilter('All Statuses'); }}
          >
            <i className="ph ph-faders text-lg"></i>
            Reset Filters
          </button>
          <button
            className="px-4 py-2.5 text-white rounded-xl font-semibold transition hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 10px -4px rgba(11,32,70,0.35)' }}
            onClick={() => {
              const firstProvider = providersData?.[0];
              if (!firstProvider) {
                window.alert('Create a provider before adding listings.');
                return;
              }
              apiRequest('/admin/listings', {
                token,
                method: 'POST',
                body: JSON.stringify({
                  providerId: firstProvider.id,
                  name: 'New listing',
                  description: '',
                  price: 0,
                  type: 'service',
                  status: 'pending'
                })
              }).then(() => onReload?.()).catch((error) => window.alert(error.message || 'Unable to create listing'));
            }}
          >
            <i className="ph ph-plus"></i>
            Add Listing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -12px rgba(11,32,70,0.10)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="relative flex-1">
                <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search listings (title, provider, category, ID)..."
                  className="w-full bg-slate-50 border text-sm rounded-2xl py-3 pl-12 pr-4 outline-none transition-all"
                  style={{ borderColor: '#E2E8F0' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-2xl border bg-white flex items-center gap-2" style={{ borderColor: '#E2E8F0' }}>
                  <i className="ph ph-sort-ascending text-lg" style={{ color: '#64748B' }}></i>
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="text-sm outline-none" style={{ color: '#0F172A' }}>
                    {sorts.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <button
                  className="px-3 py-2 rounded-2xl border bg-white hover:bg-slate-50 transition flex items-center gap-2"
                  style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                  onClick={() => setQuery('')}
                >
                  <i className="ph ph-x text-lg" style={{ color: '#64748B' }}></i>
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <CountPill
                label="All"
                value={items.length.toLocaleString('en-UG')}
                active={typeFilter === 'All Types' && statusFilter === 'All Statuses'}
                onClick={() => { setTypeFilter('All Types'); setStatusFilter('All Statuses'); }}
                tone="blue"
              />
              <CountPill
                label="Services"
                value={items.filter(i => i.type === 'Service').length.toLocaleString('en-UG')}
                active={typeFilter === 'Service'}
                onClick={() => setTypeFilter('Service')}
                tone="navy"
              />
              <CountPill
                label="Products"
                value={items.filter(i => i.type === 'Product').length.toLocaleString('en-UG')}
                active={typeFilter === 'Product'}
                onClick={() => setTypeFilter('Product')}
                tone="cyan"
              />
              <CountPill
                label="Pending"
                value={items.filter(i => i.status === 'Pending').length.toLocaleString('en-UG')}
                active={statusFilter === 'Pending'}
                onClick={() => setStatusFilter('Pending')}
                tone="yellow"
              />
              <CountPill
                label="Approved"
                value={items.filter(i => i.status === 'Approved').length.toLocaleString('en-UG')}
                active={statusFilter === 'Approved'}
                onClick={() => setStatusFilter('Approved')}
                tone="teal"
              />
              <CountPill
                label="Suspended"
                value={items.filter(i => i.status === 'Suspended').length.toLocaleString('en-UG')}
                active={statusFilter === 'Suspended'}
                onClick={() => setStatusFilter('Suspended')}
                tone="rose"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-slate-50 border text-sm rounded-2xl py-3 px-3 outline-none" style={{ borderColor: '#E2E8F0' }}>
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full bg-slate-50 border text-sm rounded-2xl py-3 px-3 outline-none" style={{ borderColor: '#E2E8F0' }}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="w-full bg-slate-50 border text-sm rounded-2xl py-3 px-3 outline-none" style={{ borderColor: '#E2E8F0' }}>
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-slate-50 border text-sm rounded-2xl py-3 px-3 outline-none" style={{ borderColor: '#E2E8F0' }}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: '#0F172A' }}>Choose Listings</p>
            <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
              Showing {Math.min(filtered.length, (page - 1) * pageSize + 1)}–{Math.min(filtered.length, page * pageSize)} of {filtered.length}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -12px rgba(11,32,70,0.10)' }}>
              <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046' }}>
                <i className="ph ph-magnifying-glass text-3xl"></i>
              </div>
              <p className="mt-4 text-base font-bold" style={{ color: '#0F172A' }}>No listings found</p>
              <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Try adjusting filters or search terms.</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {pageItems.map((l) => {
                  const active = l.id === selectedId;
                  const banned = isBanned(l.providerId);
                  return (
                    <motion.button
                      key={l.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => setSelectedId(l.id)}
                      className="text-left rounded-2xl border bg-white overflow-hidden group"
                      style={active
                        ? { borderColor: 'rgba(250,204,21,0.8)', boxShadow: '0 18px 50px -34px rgba(250,204,21,0.8)' }
                        : { borderColor: 'rgba(226,232,240,0.85)', boxShadow: '0 14px 40px -34px rgba(11,32,70,0.28)' }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="relative">
                        <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                          {l.thumbnail ? <img src={l.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" /> : null}
                        </div>
                        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${badge(l.type)}`}>{l.type}</span>
                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${badge(l.status)}`}>{l.status}</span>
                        </div>
                        <div className="absolute top-2 right-2 flex flex-wrap items-center gap-1.5">
                          {l.featured ? (
                            <span className="px-2 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'rgba(250,204,21,0.30)', color: '#0B2046' }}>
                              Featured
                            </span>
                          ) : null}
                          {banned ? (
                            <span className="px-2 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'rgba(225,29,72,0.12)', color: '#E11D48' }}>
                              Provider banned
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-extrabold line-clamp-1" style={{ color: '#0F172A' }}>{l.title}</p>
                        <p className="mt-1 text-xs line-clamp-1" style={{ color: '#64748B' }}>{l.provider}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-sm font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(l.priceUgx)}</p>
                          <p className="text-[11px] font-semibold" style={{ color: '#94A3B8' }}>{formatDate(l.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold" style={{ color: '#94A3B8' }}>{l.id} • {l.category}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}

          {filtered.length ? (
            <div className="pt-2 flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 border rounded-xl bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                  style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 border rounded-xl bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                  style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="xl:col-span-4">
          <div className="sticky top-24">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: 'rgba(255,255,255,0.14)',
                backgroundColor: '#0B2046',
                boxShadow: '0 18px 60px -40px rgba(11,32,70,0.65)'
              }}
            >
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-sm font-extrabold" style={{ color: '#F8FAFC' }}>Listing Details</p>
                {selected ? (
                  <button
                    className="px-3 py-2 rounded-xl border transition text-sm font-semibold"
                    style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}
                    onClick={() => setSelectedId(null)}
                  >
                    Close
                  </button>
                ) : null}
              </div>

              <div className="p-4">
                <AnimatePresence mode="wait">
                  {selected ? (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-[16/10] border" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
                        {selected.thumbnail ? <img src={selected.thumbnail} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                      {selected.gallery?.length ? (
                        <div className="flex gap-2 overflow-x-auto">
                          {selected.gallery.map((src, i) => (
                            <img key={`${src}-${i}`} src={src} alt="" className="h-16 w-16 flex-none rounded-xl object-cover border" style={{ borderColor: 'rgba(255,255,255,0.14)' }} />
                          ))}
                        </div>
                      ) : null}

                      <div>
                        <p className="text-base font-extrabold" style={{ color: '#F8FAFC' }}>{selected.title}</p>
                        <p className="text-xs font-semibold mt-1" style={{ color: 'rgba(226,232,240,0.80)' }}>{selected.id} • Created {formatDate(selected.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(selected.type)}`}>{selected.type}</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(selected.status)}`}>{selected.status}</span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(250,204,21,0.16)', color: '#FDE68A', border: '1px solid rgba(250,204,21,0.22)' }}>
                            {formatUgx(selected.priceUgx)}
                          </span>
                          {selected.featured ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(250,204,21,0.22)', color: '#FDE68A', border: '1px solid rgba(250,204,21,0.24)' }}>
                              Featured
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <StatChip variant="dark" label="Views" value={(selected.views || 0).toLocaleString('en-UG')} icon="ph-eye" />
                        <StatChip variant="dark" label="Buys" value={(selected.purchases || 0).toLocaleString('en-UG')} icon="ph-shopping-cart" />
                        <StatChip variant="dark" label="Revenue" value={formatUgx(selected.revenueUgx || 0)} icon="ph-currency-circle-dollar" />
                      </div>

                      <div className="p-4 rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(226,232,240,0.80)' }}>Provider</p>
                        <p className="mt-2 text-sm font-extrabold" style={{ color: '#F8FAFC' }}>{selected.provider}</p>
                        <p className="text-xs font-semibold mt-1" style={{ color: 'rgba(226,232,240,0.75)' }}>
                          {selected.category} • Provider ID: {selected.providerId}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {isBanned(selected.providerId) ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(225,29,72,0.18)', color: '#FDA4AF', border: '1px solid rgba(225,29,72,0.22)' }}>
                              Banned
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(16,185,129,0.16)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.20)' }}>
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(226,232,240,0.80)' }}>Description</p>
                        <p className="mt-2 text-sm leading-relaxed line-clamp-5" style={{ color: 'rgba(226,232,240,0.88)' }}>{selected.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="px-4 py-2.5 rounded-xl font-semibold border transition"
                          style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}
                          onClick={() => openEdit(selected)}
                        >
                          <i className="ph ph-pencil-simple mr-2"></i>
                          Edit
                        </button>
                        <button
                          className="px-4 py-2.5 rounded-xl font-semibold border transition"
                          style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}
                          onClick={() => updateListing(selected.id, { featured: !selected.featured })}
                        >
                          <i className="ph ph-sparkle mr-2"></i>
                          {selected.featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: '#FACC15', color: '#0B2046' }}
                          onClick={() => updateListing(selected.id, { status: 'Approved' })}
                        >
                          Approve
                        </button>
                        <button
                          className="px-4 py-2.5 rounded-xl font-semibold border transition"
                          style={{ borderColor: 'rgba(250,204,21,0.40)', backgroundColor: 'rgba(250,204,21,0.10)', color: '#FDE68A' }}
                          onClick={() => updateListing(selected.id, { status: 'Suspended' })}
                        >
                          Suspend
                        </button>
                        <button
                          className="col-span-2 px-4 py-2.5 rounded-xl font-semibold border transition"
                          style={{ borderColor: 'rgba(225,29,72,0.28)', backgroundColor: 'rgba(225,29,72,0.12)', color: '#FDA4AF' }}
                          onClick={() => banProvider(selected.providerId)}
                        >
                          <i className="ph ph-prohibit mr-2"></i>
                          {isBanned(selected.providerId) ? 'Unban Provider' : 'Ban Provider'}
                        </button>
                        <button
                          className="col-span-2 px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: '#E11D48' }}
                          onClick={() => removeListing(selected.id)}
                        >
                          Delete Listing
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="p-10 text-center"
                    >
                      <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.18)', color: '#FDE68A', border: '1px solid rgba(250,204,21,0.20)' }}>
                        <i className="ph ph-hand-pointing text-3xl"></i>
                      </div>
                      <p className="mt-4 text-base font-extrabold" style={{ color: '#F8FAFC' }}>Select a listing</p>
                      <p className="mt-1 text-sm" style={{ color: 'rgba(226,232,240,0.80)' }}>Tap an item on the left to view details and actions.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalShell open={edit.open} onClose={() => setEdit({ open: false, id: null })}>
        <div className="p-6 border-b flex items-start justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <p className="text-lg font-extrabold" style={{ color: '#0F172A' }}>Edit Listing</p>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Changes are saved to the backend.</p>
          </div>
          <button onClick={() => setEdit({ open: false, id: null })} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
            <i className="ph ph-x text-xl"></i>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Title</label>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Type</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              >
                {['Service', 'Product'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              >
                {['Pending', 'Approved', 'Suspended'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Category</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              >
                {categories.filter(c => c !== 'All Categories').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Price (UGX)</label>
              <input
                value={editForm.priceUgx}
                onChange={(e) => setEditForm(f => ({ ...f, priceUgx: e.target.value }))}
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none min-h-[120px]"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          {editForm.type === 'Product' ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border" style={{ borderColor: '#E2E8F0' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Online purchase</p>
                <p className="text-xs" style={{ color: '#64748B' }}>Let customers pay for this product online with mobile money.</p>
              </div>
              <ToggleSwitch
                id="listing-online-payment"
                name="listing-online-payment"
                checked={editForm.onlinePaymentEnabled}
                onChange={() => setEditForm(f => ({ ...f, onlinePaymentEnabled: !f.onlinePaymentEnabled }))}
              />
            </div>
          ) : null}
        </div>
        <div className="p-6 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.65)' }}>
          <button
            onClick={() => setEdit({ open: false, id: null })}
            className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-slate-50 transition"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            className="px-4 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#0B2046' }}
            disabled={!editForm.title.trim()}
          >
            Save
          </button>
        </div>
      </ModalShell>
    </div>
  );
};

const TransactionsView = ({ transactionsData = [] }) => {
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-UG') : '0'}`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-UG', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const ymd = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const transactions = (transactionsData || []).map(mapTransaction);

  const tabs = [
    { key: 'Subscription', label: 'Subscription Payments', icon: 'ph-star' },
    { key: 'Product Purchase', label: 'Product Purchases', icon: 'ph-bag' },
    { key: 'Contact Unlock', label: 'Contact Unlock Payments', icon: 'ph-lock-key' },
    { key: 'Withdrawal', label: 'Withdrawals', icon: 'ph-wallet' }
  ];

  const [activeKind, setActiveKind] = useState('Subscription');
  const [q, setQ] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [providerFilter, setProviderFilter] = useState('All Providers');
  const [userFilter, setUserFilter] = useState('All Users');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [details, setDetails] = useState({ open: false, id: null });

  useEffect(() => {
    setProviderFilter('All Providers');
    setUserFilter('All Users');
    setStatusFilter('All Statuses');
    setTypeFilter('All Types');
    setQ('');
  }, [activeKind]);

  const byKind = transactions.filter(t => t.kind === activeKind);

  const providerOptions = Array.from(new Map(byKind.map(t => [t.provider.id, t.provider])).values())
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const userOptions = Array.from(new Map(byKind.map(t => [t.user.id, t.user])).values())
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const typeOptions = Array.from(new Set(byKind.map(t => t.method))).sort((a, b) => a.localeCompare(b, 'en'));

  const statusOptions = Array.from(new Set(byKind.map(t => t.status))).sort((a, b) => a.localeCompare(b, 'en'));

  const inDateRange = (t) => {
    const day = ymd(t.date);
    if (!day) return false;
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    return true;
  };

  const filtered = byKind.filter((t) => {
    const query = q.trim().toLowerCase();
    const matchesQuery = !query ||
      t.id.toLowerCase().includes(query) ||
      t.user.name.toLowerCase().includes(query) ||
      t.user.email.toLowerCase().includes(query) ||
      t.provider.name.toLowerCase().includes(query);

    const matchesDates = inDateRange(t);
    const matchesProvider = providerFilter === 'All Providers' || t.provider.id === providerFilter;
    const matchesUser = userFilter === 'All Users' || t.user.id === userFilter;
    const matchesStatus = statusFilter === 'All Statuses' || t.status === statusFilter;
    const matchesType = typeFilter === 'All Types' || t.method === typeFilter;
    return matchesQuery && matchesDates && matchesProvider && matchesUser && matchesStatus && matchesType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const datasetForAnalytics = transactions.filter((t) => {
    const day = ymd(t.date);
    if (!day) return false;
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    return true;
  });

  const totalRevenueUgx = datasetForAnalytics
    .filter(t => t.status === 'Completed' && t.kind !== 'Withdrawal')
    .reduce((sum, t) => sum + (t.kind === 'Subscription' ? t.amountUgx : t.platformFeeUgx), 0);

  const feesCollectedUgx = datasetForAnalytics
    .filter(t => t.status === 'Completed')
    .reduce((sum, t) => sum + (t.platformFeeUgx || 0), 0);

  const pendingWithdrawalsUgx = datasetForAnalytics
    .filter(t => t.kind === 'Withdrawal' && t.status === 'Pending')
    .reduce((sum, t) => sum + (t.amountUgx || 0), 0);

  const failedCount = datasetForAnalytics.filter(t => t.status === 'Failed').length;

  const selected = details.open ? transactions.find(t => t.id === details.id) : null;

  const statusTone = (status) => {
    const map = {
      Completed: { bg: 'bg-emerald-100', fg: 'text-emerald-800', dot: '#10B981' },
      Pending: { bg: 'bg-yellow-100', fg: 'text-yellow-800', dot: '#F59E0B' },
      Failed: { bg: 'bg-rose-100', fg: 'text-rose-800', dot: '#F43F5E' },
      Reversed: { bg: 'bg-slate-200', fg: 'text-slate-700', dot: '#64748B' }
    };
    return map[status] || { bg: 'bg-slate-200', fg: 'text-slate-700', dot: '#64748B' };
  };

  const delta = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return 'UGX 0';
    const sign = n > 0 ? '+' : '-';
    return `${sign}${formatUgx(Math.abs(n)).replace('UGX ', 'UGX ')}`;
  };

  const Card = ({ tone, icon, label, value, sub }) => {
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046', iconBg: 'rgba(11,32,70,0.10)' },
      gold: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046', iconBg: 'rgba(250,204,21,0.22)' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046', iconBg: 'rgba(13,148,136,0.14)' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239', iconBg: 'rgba(244,63,94,0.12)' }
    };
    const t = tones[tone] || tones.navy;
    return (
      <div className="rounded-2xl border p-5 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.8)', filter: 'blur(0px)' }} />
        <div className="flex items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: t.ink }}>{value}</p>
            {sub ? <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(15,23,42,0.60)' }}>{sub}</p> : null}
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.iconBg, color: t.ink, border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className={`ph ${icon} text-xl`} />
          </div>
        </div>
      </div>
    );
  };

  const ModalShell = ({ open, children, onClose }) => (
    createPortal(
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/40 z-[998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed top-4 md:top-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl bg-white rounded-2xl z-[999] overflow-y-auto overscroll-contain max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-8rem)] border"
              style={{ borderColor: '#E2E8F0', boxShadow: '0 24px 60px -30px rgba(11,32,70,0.55)' }}
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>,
      document.body
    )
  );

  const FilterPill = ({ label, value }) => (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span>{value}</span>
    </span>
  );

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Transactions</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Monitor revenue, fees, withdrawals, and payment health.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl p-1 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
          {['Today', '7 Days', '30 Days'].map((r, idx) => (
            <button
              key={r}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition"
              style={idx === 2 ? { backgroundColor: '#0B2046', color: 'white' } : { color: '#64748B' }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card tone="navy" icon="ph-chart-line-up" label="Total Revenue" value={formatUgx(totalRevenueUgx)} sub="Completed (excl. withdrawals)" />
        <Card tone="gold" icon="ph-coins" label="Fees Collected" value={formatUgx(feesCollectedUgx)} sub="Platform fees captured" />
        <Card tone="teal" icon="ph-hourglass-medium" label="Pending Withdrawals" value={formatUgx(pendingWithdrawalsUgx)} sub="Awaiting payout" />
        <Card tone="rose" icon="ph-warning-circle" label="Failed Transactions" value={failedCount.toLocaleString('en-UG')} sub="Within date range" />
      </div>

      <div className="bg-white rounded-2xl border p-2" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => {
            const active = activeKind === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveKind(t.key)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
                style={active ? { backgroundColor: '#0B2046', color: 'white' } : { backgroundColor: 'rgba(248,250,252,0.8)', color: '#64748B' }}
              >
                <i className={`ph ${t.icon} text-base`} style={active ? { color: '#FACC15' } : {}} />
                {t.label}
                <span className="ml-1 text-xs font-extrabold px-2 py-0.5 rounded-full" style={active ? { backgroundColor: 'rgba(250,204,21,0.18)', color: '#FDE68A', border: '1px solid rgba(250,204,21,0.22)' } : { backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                  {byKind.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <div className="relative">
              <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by transaction ID, user, provider..."
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 pl-10 pr-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          <div className="lg:col-span-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="All Providers">All Providers</option>
              {providerOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="All Users">All Users</option>
              {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="All Statuses">All Statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="All Types">All Types</option>
              {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2 flex gap-2">
            <button
              onClick={() => { setQ(''); setStartDate(''); setEndDate(''); setProviderFilter('All Providers'); setUserFilter('All Users'); setStatusFilter('All Statuses'); setTypeFilter('All Types'); }}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white hover:bg-slate-50 transition"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill label="Tab" value={tabs.find(t => t.key === activeKind)?.label || activeKind} />
          <FilterPill label="Range" value={`${startDate || '…'} → ${endDate || '…'}`} />
          {providerFilter !== 'All Providers' ? <FilterPill label="Provider" value={providerOptions.find(p => p.id === providerFilter)?.name || providerFilter} /> : null}
          {userFilter !== 'All Users' ? <FilterPill label="User" value={userOptions.find(u => u.id === userFilter)?.name || userFilter} /> : null}
          {statusFilter !== 'All Statuses' ? <FilterPill label="Status" value={statusFilter} /> : null}
          {typeFilter !== 'All Types' ? <FilterPill label="Type" value={typeFilter} /> : null}
          {q.trim() ? <FilterPill label="Search" value={q.trim()} /> : null}
          <span className="ml-auto text-xs font-semibold" style={{ color: '#64748B' }}>{filtered.length.toLocaleString('en-UG')} results</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider font-extrabold" style={{ backgroundColor: 'rgba(248,250,252,0.85)', borderColor: '#E2E8F0', color: '#64748B' }}>
                <th className="p-4 pl-6">Transaction ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Platform fee</th>
                <th className="p-4">Net amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
              {filtered.map((t) => {
                const tone = statusTone(t.status);
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => setDetails({ open: true, id: t.id })}
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tone.dot }} />
                        <div>
                          <p className="font-extrabold tracking-tight" style={{ color: '#0F172A' }}>{t.id}</p>
                          <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{t.method} • {t.reference}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold" style={{ color: '#0F172A' }}>{t.user.name}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{t.user.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold" style={{ color: '#0F172A' }}>{t.provider.name}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{t.provider.id}</p>
                    </td>
                    <td className="p-4 font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(t.amountUgx)}</td>
                    <td className="p-4 font-semibold" style={{ color: '#334155' }}>{formatUgx(t.platformFeeUgx)}</td>
                    <td className="p-4 font-extrabold" style={{ color: '#0F172A' }}>{formatUgx(t.netAmountUgx)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold ${tone.bg} ${tone.fg}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6" style={{ color: '#64748B' }}>{formatDate(t.date)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                      <i className="ph ph-magnifying-glass text-3xl" />
                    </div>
                    <p className="mt-4 text-base font-extrabold" style={{ color: '#0F172A' }}>No transactions found</p>
                    <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Adjust your filters to see more results.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell open={details.open} onClose={() => setDetails({ open: false, id: null })}>
        <div className="p-6 border-b flex items-start justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
          <div className="min-w-0">
            <p className="text-lg font-extrabold truncate" style={{ color: '#0F172A' }}>{selected?.id || 'Transaction Details'}</p>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{selected ? `${tabs.find(t => t.key === selected.kind)?.label || selected.kind} • ${selected.method} • ${formatDateTime(selected.date)}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {selected ? (
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold border ${statusTone(selected.status).bg} ${statusTone(selected.status).fg}`} style={{ borderColor: 'rgba(226,232,240,0.8)' }}>
                {selected.status}
              </span>
            ) : null}
            <button onClick={() => setDetails({ open: false, id: null })} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
              <i className="ph ph-x text-xl" />
            </button>
          </div>
        </div>

        {selected ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Full Breakdown</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Gross</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>{formatUgx(selected.breakdown.grossUgx)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Platform fee</span>
                    <span className="font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(selected.breakdown.platformFeeUgx)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Gateway fee</span>
                    <span className="font-semibold" style={{ color: '#0F172A' }}>{formatUgx(selected.breakdown.gatewayFeeUgx)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>VAT</span>
                    <span className="font-semibold" style={{ color: '#0F172A' }}>{formatUgx(selected.breakdown.vatUgx)}</span>
                  </div>
                  <div className="h-px my-3" style={{ backgroundColor: '#E2E8F0' }} />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: '#334155' }}>{selected.kind === 'Withdrawal' ? 'Net payout' : selected.kind === 'Subscription' ? 'Net to platform' : 'Net to provider'}</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>
                      {selected.kind === 'Subscription' ? formatUgx(selected.breakdown.netToPlatformUgx) : formatUgx(selected.breakdown.netToProviderUgx)}
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Metadata</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span style={{ color: '#334155' }}>Reference</span>
                      <span className="font-semibold" style={{ color: '#0F172A' }}>{selected.reference}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: '#334155' }}>Type</span>
                      <span className="font-semibold" style={{ color: '#0F172A' }}>{selected.method}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: '#334155' }}>Category</span>
                      <span className="font-semibold" style={{ color: '#0F172A' }}>{tabs.find(t => t.key === selected.kind)?.label || selected.kind}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Wallet Impact</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Provider wallet</span>
                    <span className="font-extrabold" style={{ color: selected.walletImpact.providerDeltaUgx >= 0 ? '#065F46' : '#9F1239' }}>
                      {delta(selected.walletImpact.providerDeltaUgx)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Platform ledger</span>
                    <span className="font-extrabold" style={{ color: selected.walletImpact.platformDeltaUgx >= 0 ? '#0B2046' : '#9F1239' }}>
                      {delta(selected.walletImpact.platformDeltaUgx)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>External movement</span>
                    <span className="font-semibold" style={{ color: '#0F172A' }}>
                      {delta(selected.walletImpact.externalDeltaUgx)}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl border p-3 bg-white" style={{ borderColor: '#E2E8F0' }}>
                    <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Note</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: '#0F172A' }}>{selected.walletImpact.note}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Related</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold truncate" style={{ color: '#0F172A' }}>{selected.user.name}</p>
                        <p className="text-xs font-semibold truncate" style={{ color: '#64748B' }}>{selected.user.email}</p>
                      </div>
                      <span className="text-xs font-extrabold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                        {selected.user.id}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold truncate" style={{ color: '#0F172A' }}>{selected.provider.name}</p>
                        <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Provider</p>
                      </div>
                      <span className="text-xs font-extrabold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(250,204,21,0.18)', color: '#92400E', border: '1px solid rgba(250,204,21,0.25)' }}>
                        {selected.provider.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Timeline</p>
                <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{selected.timeline.length} events</span>
              </div>
              <div className="mt-4 space-y-3">
                {selected.timeline
                  .slice()
                  .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                  .map((e, idx) => (
                    <div key={`${e.at}-${idx}`} className="flex items-start gap-3">
                      <div className="mt-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0B2046' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{e.label}</p>
                          <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{formatDateTime(e.at)}</p>
                        </div>
                        <p className="text-sm mt-0.5" style={{ color: '#334155' }}>{e.detail}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm" style={{ color: '#64748B' }}>No transaction selected.</p>
          </div>
        )}
      </ModalShell>
    </div>
  );
};

// Countries and cultures providers can say they serve. Countries come preloaded; cultures are added here. Entries a
// provider suggested wait for approval, and customers only see (and can filter by) approved ones.
const AudiencesView = ({ token }) => {
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState('culture');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState({ id: '', name: '' });

  const load = async () => {
    try {
      const data = await apiRequest('/audiences/admin/all', { token });
      setItems(data?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load');
      setItems((prev) => prev || []);
    }
  };
  useEffect(() => { if (token) load(); }, [token]);

  const run = async (id, fn) => {
    setBusy(id);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message || 'That did not work');
    } finally {
      setBusy('');
    }
  };

  const add = (event) => {
    event.preventDefault();
    const name = adding.trim();
    if (name.length < 2) return;
    run('add', async () => {
      await apiRequest('/audiences', { token, method: 'POST', body: JSON.stringify({ kind, name }) });
      setAdding('');
    });
  };
  const approve = (a) => run(a.id, () => apiRequest(`/audiences/${a.id}`, { token, method: 'PATCH', body: JSON.stringify({ moderationStatus: 'approved' }) }));
  const rename = (a) => run(a.id, async () => {
    await apiRequest(`/audiences/${a.id}`, { token, method: 'PATCH', body: JSON.stringify({ name: editing.name }) });
    setEditing({ id: '', name: '' });
  });
  const remove = (a) => {
    const msg = a.providerCount ? `Delete “${a.name}”? ${a.providerCount} provider${a.providerCount === 1 ? '' : 's'} will stop being listed under it.` : `Delete “${a.name}”?`;
    if (!window.confirm(msg)) return;
    run(a.id, () => apiRequest(`/audiences/${a.id}`, { token, method: 'DELETE' }));
  };

  const all = items || [];
  const pending = all.filter((a) => a.moderationStatus === 'pending');
  const q = query.trim().toLowerCase();
  const shown = all.filter((a) => a.kind === kind && (!q || a.name.toLowerCase().includes(q) || String(a.code || '').toLowerCase().includes(q)));
  const card = { boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04)', borderColor: '#E2E8F0' };

  return (
    <div className="view-fade space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Target audiences</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>The countries and cultures service providers choose from to say who they serve. Customers can filter by them.</p>
      </div>

      {error ? <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</div> : null}

      {pending.length ? (
        <div className="rounded-2xl border p-5" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#92400E' }}>Waiting for your approval ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 bg-white rounded-xl border px-4 py-3" style={{ borderColor: '#FDE68A' }}>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{a.name} <span className="text-xs font-medium px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{a.kind}</span></p>
                  <p className="text-xs" style={{ color: '#64748B' }}>Suggested by {a.createdBy || 'a provider'} · used by {a.providerCount}</p>
                </div>
                <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>Reject</button>
                <button type="button" disabled={busy === a.id} onClick={() => approve(a)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#0B2046' }}>Approve</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border" style={card}>
        <div className="p-5 border-b flex flex-wrap items-center gap-3" style={{ borderColor: '#F1F5F9' }}>
          <div className="flex gap-2">
            {[{ k: 'culture', l: 'Cultures' }, { k: 'country', l: 'Countries' }].map((t) => (
              <button key={t.k} type="button" onClick={() => { setKind(t.k); setQuery(''); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={kind === t.k ? { backgroundColor: '#0B2046', color: '#fff' } : { backgroundColor: '#F1F5F9', color: '#475569' }}>
                {t.l} <span className="ml-1 text-xs opacity-70">{all.filter((a) => a.kind === t.k && a.moderationStatus === 'approved').length}</span>
              </button>
            ))}
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${kind === 'country' ? 'countries' : 'cultures'}…`} className="flex-1 min-w-[180px] bg-slate-50 border text-sm rounded-lg py-2 px-3 outline-none" style={{ borderColor: '#E2E8F0' }} />
        </div>

        <form onSubmit={add} className="p-5 border-b flex flex-wrap gap-3" style={{ borderColor: '#F1F5F9' }}>
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={kind === 'country' ? 'Add a country that is missing…' : 'Add a culture or community, e.g. Baganda, Eritrean, Indian…'} className="flex-1 min-w-[220px] bg-slate-50 border text-sm rounded-lg py-2.5 px-3 outline-none" style={{ borderColor: '#E2E8F0' }} />
          <button type="submit" disabled={busy === 'add' || adding.trim().length < 2} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#EA580C' }}>Add {kind}</button>
        </form>

        {items === null ? <p className="p-6 text-sm" style={{ color: '#64748B' }}>Loading…</p> : !shown.length ? (
          <p className="p-6 text-sm" style={{ color: '#64748B' }}>{q ? 'Nothing matches that.' : kind === 'culture' ? 'No cultures yet. Add the first one above.' : 'No countries.'}</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {shown.map((a) => (
              <li key={a.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  {editing.id === a.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); rename(a); }} className="flex gap-2">
                      <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: a.id, name: e.target.value })} className="bg-slate-50 border text-sm rounded-lg py-1.5 px-3 outline-none" style={{ borderColor: '#E2E8F0' }} />
                      <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#0B2046' }}>Save</button>
                      <button type="button" onClick={() => setEditing({ id: '', name: '' })} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
                    </form>
                  ) : (
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                      {a.name} {a.code ? <span className="text-xs font-bold ml-1" style={{ color: '#94A3B8' }}>{a.code}</span> : null}
                      {a.moderationStatus === 'pending' ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>pending</span> : null}
                    </p>
                  )}
                </div>
                <span className="text-xs" style={{ color: '#64748B' }}>{a.providerCount} provider{a.providerCount === 1 ? '' : 's'}</span>
                {editing.id !== a.id ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing({ id: a.id, name: a.name })} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>Rename</button>
                    <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: '#FECACA', color: '#B91C1C' }}>Delete</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const PAYOUT_STATUS = {
  requested: { label: 'Waiting', bg: '#FEF3C7', fg: '#92400E' },
  approved: { label: 'Paying…', bg: '#DBEAFE', fg: '#1E40AF' },
  payout_unknown: { label: 'Check gateway', bg: '#FFEDD5', fg: '#9A3412' },
  paid: { label: 'Paid', bg: '#DCFCE7', fg: '#166534' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', fg: '#991B1B' }
};

const REFUND_REASONS = {
  order_canceled: 'The seller cancelled a paid order',
  order_rejected: 'The seller rejected a paid order',
  order_already_paid: 'Paid twice for the same order',
  order_missing: 'The order no longer exists',
  booking_cancelled_by_provider: 'The provider cancelled a paid booking',
  booking_cancelled_by_guest: 'The guest cancelled a paid booking',
  booking_already_paid: 'Paid twice for the same booking',
  booking_expired: 'Paid after the booking expired',
  booking_cancelled: 'Paid after the booking was cancelled',
  booking_missing: 'The booking no longer exists',
  bus_seats_gone: 'Paid for bus seats that were no longer free'
};
const refundReason = (code) => REFUND_REASONS[code] || (String(code || '').startsWith('amount_mismatch') ? `Amount didn't match (${String(code).replace('amount_mismatch: ', '')})` : String(code || '—').replace(/_/g, ' '));
const ugxFmt = (v) => `UGX ${Number(v || 0).toLocaleString('en-UG')}`;

// Provider payout requests, and payments that have to be returned. Both used to be reachable only through the API.
const PayoutsView = ({ token, onReload }) => {
  const [tab, setTab] = useState('withdrawals');
  const [withdrawals, setWithdrawals] = useState(null);
  const [refunds, setRefunds] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState({});
  const [skip, setSkip] = useState({});

  const load = async () => {
    setError('');
    try {
      const [w, r] = await Promise.all([apiRequest('/admin/withdrawals', { token }), apiRequest('/admin/refunds', { token })]);
      setWithdrawals(w?.items || []);
      setRefunds(r?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load payouts');
      setWithdrawals((prev) => prev || []);
      setRefunds((prev) => prev || []);
    }
  };
  useEffect(() => { if (token) load(); }, [token]);

  const act = async (id, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    setError('');
    try {
      await apiRequest(`/admin/withdrawals/${id}/${action}`, { token, method: 'POST', body: JSON.stringify({ note: notes[id] || undefined }) });
    } catch (e) {
      setError(e.message || 'That did not work');
    } finally {
      setBusyId('');
      await load();
      onReload?.();
    }
  };

  const resolveRefund = async (row) => {
    if (!window.confirm(`Mark ${ugxFmt(row.amount)} as refunded to ${row.payerName || row.payerPhone || 'the payer'}?\n\nOnly do this after you have sent the money back by mobile money.`)) return;
    setBusyId(row.transactionId);
    setError('');
    try {
      await apiRequest(`/admin/refunds/${row.transactionId}/resolve`, { token, method: 'POST', body: JSON.stringify({ note: notes[row.transactionId] || undefined, skipReversal: Boolean(skip[row.transactionId]) }) });
    } catch (e) {
      setError(e.message || 'That did not work');
    } finally {
      setBusyId('');
      await load();
      onReload?.();
    }
  };

  const open = (withdrawals || []).filter((w) => ['requested', 'approved', 'payout_unknown'].includes(w.status)).length;
  const card = { boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04)', borderColor: '#E2E8F0' };
  const btn = (primary) => ({ backgroundColor: primary ? '#0B2046' : '#fff', color: primary ? '#fff' : '#0F172A', border: primary ? 'none' : '1px solid #E2E8F0' });

  return (
    <div className="view-fade space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Payouts &amp; refunds</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Pay out provider withdrawals, and send back payments that couldn&apos;t be passed on.</p>
      </div>

      <div className="flex gap-2">
        {[{ k: 'withdrawals', l: 'Withdrawals', n: open }, { k: 'refunds', l: 'Refunds', n: (refunds || []).length }].map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={tab === t.k ? { backgroundColor: '#0B2046', color: '#fff' } : { backgroundColor: '#F1F5F9', color: '#475569' }}>
            {t.l}{t.n ? <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: tab === t.k ? 'rgba(255,255,255,0.2)' : '#E2E8F0' }}>{t.n}</span> : null}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</div> : null}

      {tab === 'withdrawals' ? (
        <div className="bg-white rounded-2xl border overflow-x-auto" style={card}>
          {withdrawals === null ? <p className="p-6 text-sm" style={{ color: '#64748B' }}>Loading…</p> : !withdrawals.length ? <p className="p-6 text-sm" style={{ color: '#64748B' }}>No withdrawal requests yet.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr style={{ color: '#64748B' }}>{['Provider', 'Requested', 'Fee', 'To pay out', 'Phone', 'Status', 'Date', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {withdrawals.map((w) => {
                  const st = PAYOUT_STATUS[w.status] || { label: w.status, bg: '#F1F5F9', fg: '#475569' };
                  const stuck = w.status === 'approved' && w.approvedAt && Date.now() - new Date(w.approvedAt).getTime() > 5 * 60 * 1000;
                  const busy = busyId === w.id;
                  return (
                    <tr key={w.id} className="border-t align-top" style={{ borderColor: '#F1F5F9' }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{w.provider}</td>
                      <td className="px-4 py-3">{ugxFmt(w.amount)}</td>
                      <td className="px-4 py-3">{ugxFmt(w.fee)}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: '#0B2046' }}>{ugxFmt(w.netAmount)}</td>
                      <td className="px-4 py-3">{w.payoutPhone || <span style={{ color: '#DC2626' }}>none on file</span>}</td>
                      <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: st.bg, color: st.fg }}>{st.label}</span>{w.note ? <p className="text-xs mt-1 max-w-[220px]" style={{ color: '#64748B' }}>{w.note}</p> : null}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>{new Date(w.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {w.status === 'requested' ? (
                          <div className="flex flex-col gap-2 items-end">
                            <input value={notes[w.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))} placeholder="Note (optional)" className="w-44 text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: '#E2E8F0' }} />
                            <div className="flex gap-2">
                              <button type="button" disabled={busy} onClick={() => act(w.id, 'reject', `Reject this withdrawal? ${ugxFmt(w.amount)} goes back to ${w.provider}'s wallet.`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={btn(false)}>Reject</button>
                              <button type="button" disabled={busy || !w.payoutPhone} onClick={() => act(w.id, 'approve', `Pay ${ugxFmt(w.netAmount)} by mobile money to ${w.payoutPhone} (${w.provider})?\n\nThis sends real money.`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={btn(true)}>{busy ? 'Paying…' : 'Approve & pay'}</button>
                            </div>
                          </div>
                        ) : w.status === 'payout_unknown' || stuck ? (
                          <div className="flex flex-col gap-2 items-end">
                            <p className="text-xs max-w-[240px] text-right" style={{ color: '#9A3412' }}>The payout may have gone through. Check the gateway statement first.</p>
                            <div className="flex gap-2">
                              {w.status === 'payout_unknown' ? <button type="button" disabled={busy} onClick={() => act(w.id, 'reject', `Only reject if the gateway shows NO payout to ${w.payoutPhone}. ${ugxFmt(w.amount)} goes back to the provider's wallet. Continue?`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={btn(false)}>It didn&apos;t pay: reject</button> : null}
                              <button type="button" disabled={busy} onClick={() => act(w.id, 'mark-paid', `Confirm the gateway paid ${ugxFmt(w.netAmount)} to ${w.payoutPhone}?`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={btn(true)}>It paid: mark paid</button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: '#64748B' }}>Send each payer their money back by mobile money from your gateway account, then mark it here. If the provider had already been credited, that credit is taken back from their wallet.</p>
          {refunds === null ? <p className="text-sm" style={{ color: '#64748B' }}>Loading…</p> : !refunds.length ? (
            <div className="bg-white rounded-2xl border p-6 text-sm" style={{ ...card, color: '#64748B' }}>Nothing to refund.</div>
          ) : refunds.map((r) => (
            <div key={r.transactionId} className="bg-white rounded-2xl border p-5 flex flex-wrap gap-4 items-start justify-between" style={card}>
              <div>
                <p className="text-lg font-bold" style={{ color: '#0B2046' }}>{ugxFmt(r.amount)} <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{String(r.type).replace(/_/g, ' ')}</span></p>
                <p className="text-sm mt-1" style={{ color: '#0F172A' }}>{refundReason(r.reason)}</p>
                <p className="text-sm mt-1" style={{ color: '#475569' }}>Return to: <strong>{r.payerName || 'Payer'}</strong>{r.payerPhone ? ` · ${r.payerPhone}` : ''}{r.payerEmail ? ` · ${r.payerEmail}` : ''}</p>
                {r.provider ? <p className="text-xs mt-1" style={{ color: '#64748B' }}>Seller: {r.provider}{r.needsReversal ? ' (was credited, will be debited)' : ''}</p> : null}
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Flagged {new Date(r.flaggedAt).toLocaleString()} · ref {String(r.reference || '').slice(0, 18)}</p>
              </div>
              <div className="flex flex-col gap-2 items-end min-w-[240px]">
                <input value={notes[r.transactionId] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.transactionId]: e.target.value }))} placeholder="Note (e.g. MoMo ref)" className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={{ borderColor: '#E2E8F0' }} />
                {r.needsReversal ? (
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                    <input type="checkbox" checked={Boolean(skip[r.transactionId])} onChange={(e) => setSkip((s) => ({ ...s, [r.transactionId]: e.target.checked }))} /> Don&apos;t debit the seller (settle with them separately)
                  </label>
                ) : null}
                <button type="button" disabled={busyId === r.transactionId} onClick={() => resolveRefund(r)} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={btn(true)}>{busyId === r.transactionId ? 'Saving…' : 'I refunded this'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WalletsView = ({ walletsData = [] }) => {
  const isMobile = useIsMobile();
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-UG') : '0'}`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const ymd = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const wallets = (walletsData || []).map(mapWallet);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [minBal, setMinBal] = useState('');
  const [maxBal, setMaxBal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [drawer, setDrawer] = useState({ open: false, id: null, tab: 'Transaction history', start: '', end: '' });

  const statusTone = (status) => {
    const map = {
      Enabled: { bg: 'bg-emerald-100', fg: 'text-emerald-800', dot: '#10B981' },
      Disabled: { bg: 'bg-slate-200', fg: 'text-slate-700', dot: '#64748B' },
      Frozen: { bg: 'bg-rose-100', fg: 'text-rose-800', dot: '#F43F5E' }
    };
    return map[status] || { bg: 'bg-slate-200', fg: 'text-slate-700', dot: '#64748B' };
  };

  const toNumber = (v) => {
    const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const inDateRange = (iso) => {
    const day = ymd(iso);
    if (!day) return false;
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    return true;
  };

  const filtered = wallets.filter((w) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || w.provider.toLowerCase().includes(q) || w.providerId.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All Statuses' || w.status === statusFilter;
    const min = minBal ? toNumber(minBal) : null;
    const max = maxBal ? toNumber(maxBal) : null;
    const matchMin = min === null || w.balanceUgx >= min;
    const matchMax = max === null || w.balanceUgx <= max;
    const matchDates = (!startDate && !endDate) || inDateRange(w.lastActivityAt);
    return matchQuery && matchStatus && matchMin && matchMax && matchDates;
  }).sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  const totals = filtered.reduce((acc, w) => {
    acc.totalBalance += w.balanceUgx;
    acc.totalEarned += w.totalEarnedUgx;
    acc.totalWithdrawn += w.totalWithdrawnUgx;
    acc.pending += w.pendingWithdrawalsUgx;
    return acc;
  }, { totalBalance: 0, totalEarned: 0, totalWithdrawn: 0, pending: 0 });

  const Card = ({ tone, icon, label, value, sub }) => {
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046', iconBg: 'rgba(11,32,70,0.10)' },
      gold: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046', iconBg: 'rgba(250,204,21,0.22)' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046', iconBg: 'rgba(13,148,136,0.14)' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239', iconBg: 'rgba(244,63,94,0.12)' }
    };
    const t = tones[tone] || tones.navy;
    return (
      <div className="rounded-2xl border p-5 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }} />
        <div className="flex items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: t.ink }}>{value}</p>
            {sub ? <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(15,23,42,0.60)' }}>{sub}</p> : null}
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.iconBg, color: t.ink, border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className={`ph ${icon} text-xl`} />
          </div>
        </div>
      </div>
    );
  };

  const Avatar = ({ w }) => {
    if (w.avatar) return <img src={w.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />;
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
        {w.initials || w.provider.split(' ').slice(0, 2).map(s => s[0]).join('')}
      </div>
    );
  };

  const WalletCharts = ({ wallet }) => {
    const balRef = useRef(null);
    const flowRef = useRef(null);
    const chartRef = useRef({ bal: null, flow: null });

    useEffect(() => {
      let canceled = false;
      const init = () => {
        if (canceled) return;
        if (typeof window.Chart === 'undefined') {
          setTimeout(init, 120);
          return;
        }
        if (!balRef.current || !flowRef.current) return;

        if (chartRef.current.bal) {
          chartRef.current.bal.destroy();
          chartRef.current.bal = null;
        }
        if (chartRef.current.flow) {
          chartRef.current.flow.destroy();
          chartRef.current.flow = null;
        }

        const balCtx = balRef.current.getContext('2d');
        const flowCtx = flowRef.current.getContext('2d');

        const gradient = balCtx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(11, 32, 70, 0.22)');
        gradient.addColorStop(1, 'rgba(11, 32, 70, 0)');

        chartRef.current.bal = new window.Chart(balCtx, {
          type: 'line',
          data: {
            labels: wallet.chart.labels,
            datasets: [{
              label: 'Balance',
              data: wallet.chart.balance,
              borderColor: '#0B2046',
              backgroundColor: gradient,
              borderWidth: 3,
              pointRadius: 0,
              fill: true,
              tension: 0.38
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0F172A', displayColors: false, callbacks: { label: (c) => `UGX ${Number(c.parsed.y || 0).toLocaleString('en-UG')}` } } },
            scales: { x: { grid: { display: false }, ticks: { color: 'rgba(226,232,240,0.82)' } }, y: { grid: { color: 'rgba(255,255,255,0.12)', borderDash: [6, 6] }, ticks: { color: 'rgba(226,232,240,0.82)', callback: (v) => `UGX ${Number(v).toLocaleString('en-UG')}` } } }
          }
        });

        chartRef.current.flow = new window.Chart(flowCtx, {
          type: 'bar',
          data: {
            labels: wallet.chart.labels,
            datasets: [
              { label: 'Inflow', data: wallet.chart.inflow, backgroundColor: 'rgba(16,185,129,0.55)', borderRadius: 10, maxBarThickness: 18 },
              { label: 'Outflow', data: wallet.chart.outflow, backgroundColor: 'rgba(244,63,94,0.45)', borderRadius: 10, maxBarThickness: 18 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0F172A', displayColors: true, callbacks: { label: (c) => `${c.dataset.label}: UGX ${Number(c.parsed.y || 0).toLocaleString('en-UG')}` } } },
            scales: { x: { stacked: false, grid: { display: false }, ticks: { color: 'rgba(226,232,240,0.82)' } }, y: { grid: { color: 'rgba(255,255,255,0.12)', borderDash: [6, 6] }, ticks: { color: 'rgba(226,232,240,0.82)', callback: (v) => `UGX ${Number(v).toLocaleString('en-UG')}` } } }
          }
        });
      };

      init();
      return () => {
        canceled = true;
        if (chartRef.current.bal) { chartRef.current.bal.destroy(); chartRef.current.bal = null; }
        if (chartRef.current.flow) { chartRef.current.flow.destroy(); chartRef.current.flow = null; }
      };
    }, [wallet.providerId]);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.78)' }}>Balance Trend</p>
            <span className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.62)' }}>Recent</span>
          </div>
          <div className="mt-3 h-44">
            <canvas ref={balRef} />
          </div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.78)' }}>Revenue Flow</p>
            <span className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.62)' }}>Inflow vs Outflow</span>
          </div>
          <div className="mt-3 h-44">
            <canvas ref={flowRef} />
          </div>
        </div>
      </div>
    );
  };

  const DetailTabs = ({ active, onChange }) => {
    const options = [
      { label: 'Transaction history', icon: 'ph-arrows-left-right', tone: 'navy' },
      { label: 'Wallet analytics', icon: 'ph-chart-line-up', tone: 'cyan' },
      { label: 'Deposit history', icon: 'ph-arrow-circle-down', tone: 'teal' },
      { label: 'Withdrawal history', icon: 'ph-arrow-circle-up', tone: 'rose' },
      { label: 'Revenue charts', icon: 'ph-waveform', tone: 'yellow' }
    ];
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046' },
      cyan: { from: '#CFFAFE', to: '#A5F3FC', ink: '#0B2046' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046' },
      yellow: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239' }
    };
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((t) => {
          const isActive = active === t.label;
          const tone = tones[t.tone] || tones.navy;
          return (
            <button
              key={t.label}
              onClick={() => onChange(t.label)}
              className="px-3 py-3 rounded-2xl border text-left transition hover:-translate-y-0.5"
              style={isActive
                ? { borderColor: 'rgba(250,204,21,0.70)', background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`, boxShadow: '0 18px 46px -34px rgba(11,32,70,0.55)' }
                : { borderColor: 'rgba(255,255,255,0.12)', background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`, boxShadow: '0 12px 34px -30px rgba(11,32,70,0.35)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest truncate" style={{ color: 'rgba(15,23,42,0.62)' }}>Tab</p>
                  <p className="mt-1 text-sm font-extrabold truncate" style={{ color: tone.ink }}>{t.label}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.75)', color: tone.ink, border: '1px solid rgba(255,255,255,0.70)' }}>
                  <i className={`ph ${t.icon} text-xl`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const filterByInnerRange = (items) => {
    const s = drawer.start;
    const e = drawer.end;
    if (!s && !e) return items;
    return items.filter((it) => {
      const day = ymd(it.at);
      if (!day) return false;
      if (s && day < s) return false;
      if (e && day > e) return false;
      return true;
    });
  };

  const renderHistoryTable = (rows, columns, variant = 'dark') => (
    <div className="overflow-x-auto rounded-2xl border" style={variant === 'dark' ? { borderColor: 'rgba(255,255,255,0.14)' } : { borderColor: '#E2E8F0' }}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr
            className="border-b text-xs uppercase tracking-wider font-extrabold"
            style={variant === 'dark'
              ? { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(226,232,240,0.72)' }
              : { backgroundColor: 'rgba(248,250,252,0.85)', borderColor: '#E2E8F0', color: '#64748B' }}
          >
            {columns.map((c) => <th key={c} className="p-3">{c}</th>)}
          </tr>
        </thead>
        <tbody className="text-sm divide-y" style={variant === 'dark' ? { borderColor: 'rgba(255,255,255,0.10)' } : { borderColor: '#E2E8F0' }}>
          {rows.map((r) => (
            <tr key={r._key} className={variant === 'dark' ? 'hover:bg-white/5 transition' : 'hover:bg-slate-50/70 transition'}>
              {r.cells.map((cell, idx) => <td key={`${r._key}-${idx}`} className="p-3">{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center">
                <p className="text-sm font-semibold" style={variant === 'dark' ? { color: 'rgba(226,232,240,0.70)' } : { color: '#64748B' }}>No records in this range.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Wallets</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Track provider wallet balances, earnings, and payouts.</p>
        </div>
        <button
          className="px-4 py-2.5 rounded-xl font-extrabold border transition hover:bg-slate-50 flex items-center gap-2"
          style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          onClick={() => { setQuery(''); setStatusFilter('All Statuses'); setMinBal(''); setMaxBal(''); setStartDate(''); setEndDate(''); setDrawer({ open: false, id: null, tab: 'Transaction history', start: '', end: '' }); }}
        >
          <i className="ph ph-faders text-lg" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card tone="navy" icon="ph-wallet" label="Total Wallet Balance" value={formatUgx(totals.totalBalance)} sub="Across filtered providers" />
        <Card tone="gold" icon="ph-chart-line-up" label="Total Earned" value={formatUgx(totals.totalEarned)} sub="All-time earnings" />
        <Card tone="teal" icon="ph-arrow-circle-up" label="Total Withdrawn" value={formatUgx(totals.totalWithdrawn)} sub="All-time payouts" />
        <Card tone="rose" icon="ph-hourglass-medium" label="Pending Withdrawals" value={formatUgx(totals.pending)} sub="Awaiting payout" />
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <div className="relative">
              <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers by name or ID..."
                className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 pl-10 pr-3 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option>All Statuses</option>
              {['Enabled', 'Disabled', 'Frozen'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <input
              value={minBal}
              onChange={(e) => setMinBal(e.target.value)}
              placeholder="Min balance (UGX)"
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
              inputMode="numeric"
            />
          </div>

          <div className="lg:col-span-2">
            <input
              value={maxBal}
              onChange={(e) => setMaxBal(e.target.value)}
              placeholder="Max balance (UGX)"
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
              inputMode="numeric"
            />
          </div>

          <div className="lg:col-span-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          <div className="lg:col-span-1">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider font-extrabold" style={{ backgroundColor: 'rgba(248,250,252,0.85)', borderColor: '#E2E8F0', color: '#64748B' }}>
                <th className="p-4 pl-6">Provider</th>
                <th className="p-4">Wallet balance</th>
                <th className="p-4">Total earned</th>
                <th className="p-4">Total withdrawn</th>
                <th className="p-4">Pending withdrawals</th>
                <th className="p-4 pr-6">Wallet status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
              {filtered.map((w) => {
                const tone = statusTone(w.status);
                return (
                  <tr
                    key={w.providerId}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => setDrawer({ open: true, id: w.providerId, tab: 'Transaction history', start: '', end: '' })}
                  >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar w={w} />
                          <div className="min-w-0">
                            <p className="font-extrabold truncate" style={{ color: '#0F172A' }}>{w.provider}</p>
                            <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{w.providerId} • Last activity {formatDate(w.lastActivityAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(w.balanceUgx)}</td>
                      <td className="p-4 font-semibold" style={{ color: '#0F172A' }}>{formatUgx(w.totalEarnedUgx)}</td>
                      <td className="p-4 font-semibold" style={{ color: '#0F172A' }}>{formatUgx(w.totalWithdrawnUgx)}</td>
                      <td className="p-4 font-extrabold" style={{ color: w.pendingWithdrawalsUgx ? '#92400E' : '#0F172A' }}>{formatUgx(w.pendingWithdrawalsUgx)}</td>
                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold ${tone.bg} ${tone.fg}`}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tone.dot }} />
                            {w.status}
                          </span>
                          <i className="ph ph-arrow-square-out text-lg" style={{ color: '#94A3B8' }} />
                        </div>
                      </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                      <i className="ph ph-magnifying-glass text-3xl" />
                    </div>
                    <p className="mt-4 text-base font-extrabold" style={{ color: '#0F172A' }}>No wallets found</p>
                    <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Adjust your filters to see more results.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {drawer.open ? (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/30 z-[998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer({ open: false, id: null, tab: 'Transaction history', start: '', end: '' })}
            />
            <motion.aside
              className="fixed inset-x-0 bottom-0 max-h-[88vh] w-full sm:inset-x-auto sm:bottom-auto sm:top-20 sm:right-0 sm:h-[calc(100vh-5rem)] sm:max-h-none sm:w-[640px] lg:w-[720px] z-[999] border-t sm:border-t-0 sm:border-l rounded-t-2xl sm:rounded-none flex flex-col"
              style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0B2046' }}
              initial={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
              animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
              exit={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <SheetHandle />
              {(() => {
                const w = wallets.find(x => x.providerId === drawer.id) || null;
                if (!w) {
                  return (
                    <div className="p-6">
                      <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Wallet not found.</p>
                    </div>
                  );
                }
                const tone = statusTone(w.status);
                return (
                  <>
                    <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar w={w} />
                          <div className="min-w-0">
                            <p className="text-lg font-extrabold truncate" style={{ color: '#F8FAFC' }}>{w.provider}</p>
                            <p className="text-sm truncate" style={{ color: 'rgba(226,232,240,0.70)' }}>{w.providerId} • Last activity {formatDate(w.lastActivityAt)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDrawer({ open: false, id: null, tab: 'Transaction history', start: '', end: '' })}
                          className="p-2 rounded-xl hover:bg-white/10 transition"
                          style={{ color: 'rgba(226,232,240,0.80)' }}
                        >
                          <i className="ph ph-x text-xl" />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold ${tone.bg} ${tone.fg}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tone.dot }} />
                          {w.status}
                        </span>
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold border" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}>
                          Balance {formatUgx(w.balanceUgx)}
                        </span>
                        {w.pendingWithdrawalsUgx ? (
                          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold border" style={{ borderColor: 'rgba(250,204,21,0.28)', backgroundColor: 'rgba(250,204,21,0.18)', color: '#FDE68A' }}>
                            Pending {formatUgx(w.pendingWithdrawalsUgx)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-col gap-3">
                        <DetailTabs active={drawer.tab} onChange={(tab) => setDrawer(prev => ({ ...prev, tab }))} />
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={drawer.start}
                            onChange={(e) => setDrawer(prev => ({ ...prev, start: e.target.value }))}
                            className="border text-sm rounded-xl py-2 px-3 outline-none"
                            style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}
                          />
                          <input
                            type="date"
                            value={drawer.end}
                            onChange={(e) => setDrawer(prev => ({ ...prev, end: e.target.value }))}
                            className="border text-sm rounded-xl py-2 px-3 outline-none"
                            style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }}
                          />
                          <button
                            onClick={() => setDrawer(prev => ({ ...prev, start: '', end: '' }))}
                            className="px-3 py-2 rounded-xl text-sm font-extrabold border hover:bg-white/10 transition"
                            style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)', color: '#F8FAFC' }}
                          >
                            Clear dates
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>Current balance</p>
                          <p className="mt-1 text-lg font-extrabold" style={{ color: '#FDE68A' }}>{formatUgx(w.balanceUgx)}</p>
                        </div>
                        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>Avg daily</p>
                          <p className="mt-1 text-lg font-extrabold" style={{ color: '#F8FAFC' }}>{formatUgx(w.analytics.avgDailyUgx)}</p>
                        </div>
                        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>Success rate</p>
                          <p className="mt-1 text-lg font-extrabold" style={{ color: '#6EE7B7' }}>{w.analytics.successRate}%</p>
                        </div>
                        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>Last payout</p>
                          <p className="mt-1 text-lg font-extrabold" style={{ color: '#F8FAFC' }}>{formatDate(w.analytics.lastPayoutAt)}</p>
                        </div>
                      </div>

                      {drawer.tab === 'Transaction history' ? (
                        renderHistoryTable(
                          filterByInnerRange(w.transactions)
                            .slice()
                            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                            .map((t) => {
                              const dirColor = t.direction === 'Credit' ? '#6EE7B7' : t.direction === 'Debit' ? '#FDA4AF' : 'rgba(226,232,240,0.70)';
                              return {
                                _key: t.id,
                                cells: [
                                  <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{t.id}</span>,
                                  <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.80)' }}>{t.type}</span>,
                                  <span className="font-extrabold" style={{ color: dirColor }}>{t.direction}</span>,
                                  <span className="font-extrabold" style={{ color: '#FDE68A' }}>{formatUgx(t.amountUgx)}</span>,
                                  <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{t.status}</span>,
                                  <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.70)' }}>{formatDate(t.at)}</span>
                                ]
                              };
                            }),
                          ['ID', 'Type', 'Direction', 'Amount', 'Status', 'Date'],
                          'dark'
                        )
                      ) : null}

                      {drawer.tab === 'Deposit history' ? (
                        renderHistoryTable(
                          filterByInnerRange(w.deposits)
                            .slice()
                            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                            .map((d) => ({
                              _key: d.id,
                              cells: [
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{d.id}</span>,
                                <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.80)' }}>{d.source}</span>,
                                <span className="font-extrabold" style={{ color: '#6EE7B7' }}>{formatUgx(d.amountUgx)}</span>,
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{d.status}</span>,
                                <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.70)' }}>{formatDate(d.at)}</span>
                              ]
                            })),
                          ['ID', 'Source', 'Amount', 'Status', 'Date'],
                          'dark'
                        )
                      ) : null}

                      {drawer.tab === 'Withdrawal history' ? (
                        renderHistoryTable(
                          filterByInnerRange(w.withdrawals)
                            .slice()
                            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                            .map((x) => ({
                              _key: x.id,
                              cells: [
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{x.id}</span>,
                                <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.80)' }}>{x.method}</span>,
                                <span className="font-extrabold" style={{ color: x.status === 'Pending' ? '#FDE68A' : x.status === 'Failed' ? '#FDA4AF' : '#FDA4AF' }}>{formatUgx(x.amountUgx)}</span>,
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{x.status}</span>,
                                <span className="font-semibold" style={{ color: 'rgba(226,232,240,0.70)' }}>{formatDate(x.at)}</span>
                              ]
                            })),
                          ['ID', 'Method', 'Amount', 'Status', 'Date'],
                          'dark'
                        )
                      ) : null}

                      {drawer.tab === 'Wallet analytics' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.78)' }}>Performance</p>
                            <div className="mt-4 space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Success rate</span>
                                <span className="font-extrabold" style={{ color: '#6EE7B7' }}>{w.analytics.successRate}%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Avg daily</span>
                                <span className="font-extrabold" style={{ color: '#FDE68A' }}>{formatUgx(w.analytics.avgDailyUgx)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Chargebacks</span>
                                <span className="font-extrabold" style={{ color: w.analytics.chargebacks ? '#FDA4AF' : '#F8FAFC' }}>{w.analytics.chargebacks}</span>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.78)' }}>Payouts</p>
                            <div className="mt-4 space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Pending</span>
                                <span className="font-extrabold" style={{ color: w.pendingWithdrawalsUgx ? '#FDE68A' : '#F8FAFC' }}>{formatUgx(w.pendingWithdrawalsUgx)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Last payout</span>
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{formatDate(w.analytics.lastPayoutAt)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Methods</span>
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{w.analytics.payoutMethods.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(250,204,21,0.22)', backgroundColor: 'rgba(250,204,21,0.08)' }}>
                            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.78)' }}>Wallet health</p>
                            <div className="mt-4 space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Status</span>
                                <span className="font-extrabold" style={{ color: '#FDE68A' }}>{w.status}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Balance</span>
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{formatUgx(w.balanceUgx)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: 'rgba(226,232,240,0.82)' }}>Last activity</span>
                                <span className="font-extrabold" style={{ color: '#F8FAFC' }}>{formatDate(w.lastActivityAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {drawer.tab === 'Revenue charts' ? (
                        <WalletCharts wallet={w} />
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const TYPE_LABELS_PLATFORM = {
  contact_unlock: 'Contact unlock',
  subscription: 'Subscription',
  purchase: 'Purchase fees',
  cart_purchase: 'Cart order fees',
  ride_trip: 'Ride fees',
  bus_ticket: 'Bus ticket fees',
  platform_withdrawal: 'Withdrawal'
};

// Order, ride and bus payments credit the platform only their fee; unlocks and subscriptions credit the whole amount.
const PLATFORM_FEE_TYPES = ['purchase', 'cart_purchase', 'ride_trip', 'bus_ticket'];

const STATUS_TONE_PLATFORM = {
  completed: { bg: 'bg-emerald-100', fg: 'text-emerald-800' },
  pending: { bg: 'bg-yellow-100', fg: 'text-yellow-800' },
  failed: { bg: 'bg-rose-100', fg: 'text-rose-800' },
  canceled: { bg: 'bg-slate-200', fg: 'text-slate-700' }
};

const PlatformWalletView = ({ token, onReload }) => {
  const [wallet, setWallet] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', phone: '', type: '', note: '' });
  const [withdrawSaving, setWithdrawSaving] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const REVENUE_TYPES = [
    { key: 'contact_unlock', label: 'Contact unlock', icon: 'ph-lock-key', tone: 'navy' },
    { key: 'subscription', label: 'Subscription', icon: 'ph-star', tone: 'gold' },
    { key: 'purchase', label: 'Purchase fees', icon: 'ph-bag', tone: 'teal' }
  ];

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'All Types') params.set('type', typeFilter);
      if (statusFilter !== 'All Statuses') params.set('status', statusFilter.toLowerCase());
      if (startDate) params.set('from', new Date(`${startDate}T00:00:00`).toISOString());
      if (endDate) params.set('to', new Date(`${endDate}T23:59:59`).toISOString());
      params.set('limit', '100');
      const [walletResult, revenueResult, txResult] = await Promise.all([
        apiRequest('/admin/platform-wallet', { token }),
        apiRequest('/admin/platform-wallet/revenue-by-type', { token }),
        apiRequest(`/admin/platform-wallet/transactions?${params.toString()}`, { token })
      ]);
      setWallet(walletResult);
      setRevenue(revenueResult);
      setTransactions(txResult?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load the platform wallet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, typeFilter, statusFilter, startDate, endDate]);

  const openWithdraw = (presetType = '') => {
    setWithdrawForm({ amount: '', phone: '', type: presetType, note: '' });
    setWithdrawError('');
    setWithdrawOpen(true);
  };

  const availableForType = (type) => {
    if (!type) return wallet ? Number(wallet.balance) : 0;
    const row = revenue?.byType.find((r) => r.type === type);
    return row ? Number(row.available) : 0;
  };

  const submitWithdraw = async (event) => {
    event.preventDefault();
    const amountValue = Number(withdrawForm.amount);
    if (!amountValue || amountValue <= 0) {
      setWithdrawError('Enter a valid amount.');
      return;
    }
    if (!withdrawForm.phone.trim()) {
      setWithdrawError('Enter a destination phone number.');
      return;
    }
    const cap = availableForType(withdrawForm.type);
    if (amountValue > cap) {
      setWithdrawError(`Amount exceeds the available balance (${formatUgx(cap)}).`);
      return;
    }
    setWithdrawSaving(true);
    setWithdrawError('');
    try {
      await apiRequest('/admin/platform-wallet/withdraw', {
        token,
        method: 'POST',
        body: JSON.stringify({
          amount: amountValue,
          phone: withdrawForm.phone.trim(),
          type: withdrawForm.type || undefined,
          note: withdrawForm.note.trim() || undefined
        })
      });
      setWithdrawOpen(false);
      load();
      onReload?.();
    } catch (e) {
      setWithdrawError(e.message || 'Unable to complete this withdrawal.');
    } finally {
      setWithdrawSaving(false);
    }
  };

  const RevenueCard = ({ tone, icon, label, value, sub }) => {
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046', iconBg: 'rgba(11,32,70,0.10)' },
      gold: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046', iconBg: 'rgba(250,204,21,0.22)' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046', iconBg: 'rgba(13,148,136,0.14)' }
    };
    const t = tones[tone] || tones.navy;
    return (
      <div className="rounded-2xl border p-5 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="flex items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: t.ink }}>{value}</p>
            {sub ? <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(15,23,42,0.60)' }}>{sub}</p> : null}
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.iconBg, color: t.ink, border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className={`ph ${icon} text-xl`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>GoGabla wallet</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Platform revenue from subscriptions, contact unlocks, and purchase fees.</p>
        </div>
        <button
          type="button"
          className="px-5 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#0B2046' }}
          onClick={() => openWithdraw('')}
        >
          Withdraw
        </button>
      </div>

      {error ? <div className="rounded-xl p-3 text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200">{error}</div> : null}

      <RevenueCard tone="navy" icon="ph-wallet" label="Total balance" value={loading ? '…' : formatUgx(wallet?.balance)} sub="Available across all revenue types" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REVENUE_TYPES.map((rt) => {
          const row = revenue?.byType.find((r) => r.type === rt.key);
          return (
            <div key={rt.key} className="space-y-2">
              <RevenueCard
                tone={rt.tone}
                icon={rt.icon}
                label={rt.label}
                value={loading ? '…' : formatUgx(row?.available)}
                sub={loading ? undefined : `Earned ${formatUgx(row?.earned)} · Withdrawn ${formatUgx(row?.withdrawn)}`}
              />
              <button
                type="button"
                className="w-full text-xs font-bold uppercase tracking-wide py-2 rounded-lg border transition hover:bg-slate-50"
                style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
                onClick={() => openWithdraw(rt.key)}
              >
                Withdraw {rt.label.toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
        <div className="p-5 flex flex-wrap items-center gap-3 border-b" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="text-base font-bold mr-auto" style={{ color: '#0F172A' }}>Transactions</h2>
          <select className="text-sm rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option>All Types</option>
            <option value="contact_unlock">Contact unlock</option>
            <option value="subscription">Subscription</option>
            <option value="purchase">Purchase fees</option>
            <option value="cart_purchase">Cart order fees</option>
            <option value="ride_trip">Ride fees</option>
            <option value="bus_ticket">Bus ticket fees</option>
            <option value="platform_withdrawal">Withdrawals</option>
          </select>
          <select className="text-sm rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
          <input type="date" className="text-sm rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span className="text-sm" style={{ color: '#64748B' }}>to</span>
          <input type="date" className="text-sm rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#64748B' }}>
              <th className="p-4">Type</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const tone = STATUS_TONE_PLATFORM[t.status] || STATUS_TONE_PLATFORM.pending;
              return (
                <tr key={t.id} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                  <td className="p-4 font-semibold" style={{ color: '#0F172A' }}>{TYPE_LABELS_PLATFORM[t.type] || t.type}</td>
                  <td className="p-4 font-semibold" style={{ color: '#0F172A' }}>{formatUgx(PLATFORM_FEE_TYPES.includes(t.type) ? t.fee : t.netAmount)}</td>
                  <td className="p-4"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${tone.bg} ${tone.fg}`}>{normalizeStatus(t.status)}</span></td>
                  <td className="p-4" style={{ color: '#64748B' }}>{formatDateShort(t.createdAt)}</td>
                </tr>
              );
            })}
            {!loading && !transactions.length ? (
              <tr><td colSpan="4" className="p-8 text-center" style={{ color: '#64748B' }}>No transactions found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {withdrawOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.4)' }} onClick={() => setWithdrawOpen(false)}>
          <form
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4"
            style={{ boxShadow: '0 24px 60px -30px rgba(11,32,70,0.55)' }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitWithdraw}
          >
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Withdraw from GoGabla wallet</h2>
            <p className="text-sm" style={{ color: '#64748B' }}>
              Available: <strong>{formatUgx(availableForType(withdrawForm.type))}</strong>
              {withdrawForm.type ? ` for ${TYPE_LABELS_PLATFORM[withdrawForm.type]}` : ' (all revenue types)'}
            </p>
            {withdrawError ? <div className="rounded-xl p-3 text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200">{withdrawError}</div> : null}
            <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>
              Revenue type
              <select
                className="mt-1 w-full text-sm rounded-lg border px-3 py-2"
                style={{ borderColor: '#E2E8F0' }}
                value={withdrawForm.type}
                onChange={(e) => setWithdrawForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">All revenue types</option>
                <option value="contact_unlock">Contact unlock</option>
                <option value="subscription">Subscription</option>
                <option value="purchase">Purchase fees</option>
              </select>
            </label>
            <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>
              Amount (UGX)
              <input
                type="number" min="0" required
                className="mt-1 w-full text-sm rounded-lg border px-3 py-2"
                style={{ borderColor: '#E2E8F0' }}
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>
              Destination phone number
              <input
                required
                className="mt-1 w-full text-sm rounded-lg border px-3 py-2"
                style={{ borderColor: '#E2E8F0' }}
                placeholder="e.g. +256 700 000000"
                value={withdrawForm.phone}
                onChange={(e) => setWithdrawForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>
              Note (optional)
              <input
                className="mt-1 w-full text-sm rounded-lg border px-3 py-2"
                style={{ borderColor: '#E2E8F0' }}
                value={withdrawForm.note}
                onChange={(e) => setWithdrawForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" className="px-4 py-2.5 rounded-xl font-semibold" style={{ color: '#64748B' }} onClick={() => setWithdrawOpen(false)}>Cancel</button>
              <button type="submit" disabled={withdrawSaving} className="px-5 py-2.5 rounded-xl font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: '#0B2046' }}>
                {withdrawSaving ? 'Processing…' : 'Withdraw now'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

const SubscriptionsView = ({ subscriptionsData = [] }) => {
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-UG') : '0'}`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-UG', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const daysRemaining = (expiryIso) => {
    const expiry = new Date(expiryIso);
    if (Number.isNaN(expiry.getTime())) return 0;
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const addDaysIso = (iso, days) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return new Date(Date.now() + days * 86400000).toISOString();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const [subs, setSubs] = useState([]);

  useEffect(() => {
    setSubs((subscriptionsData || []).map(mapSubscription));
  }, [subscriptionsData]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [details, setDetails] = useState({ open: false, id: null });

  const filtered = subs.filter((s) => {
    const query = q.trim().toLowerCase();
    const matchesQuery = !query || s.provider.toLowerCase().includes(query) || s.providerId.toLowerCase().includes(query) || s.plan.toLowerCase().includes(query);
    const due = daysRemaining(s.expiryAt);
    const computedStatus = due < 0 ? 'Expired' : s.status;
    const matchStatus = statusFilter === 'All' || computedStatus === statusFilter;
    return matchesQuery && matchStatus;
  }).sort((a, b) => new Date(b.expiryAt).getTime() - new Date(a.expiryAt).getTime());

  const counts = subs.reduce((acc, s) => {
    const due = daysRemaining(s.expiryAt);
    const computedStatus = due < 0 ? 'Expired' : s.status;
    acc.total += 1;
    acc[computedStatus] = (acc[computedStatus] || 0) + 1;
    if (computedStatus === 'Active') acc.mrr += s.amountUgx;
    if (due < 0) acc.overdue += 1;
    return acc;
  }, { total: 0, Active: 0, Expired: 0, Pending: 0, mrr: 0, overdue: 0 });

  const statusPill = (status, overdue) => {
    if (overdue) return 'bg-rose-100 text-rose-800';
    const map = {
      Active: 'bg-emerald-100 text-emerald-800',
      Expired: 'bg-slate-200 text-slate-700',
      Pending: 'bg-yellow-100 text-yellow-800'
    };
    return map[status] || 'bg-slate-200 text-slate-700';
  };

  const Avatar = ({ s }) => {
    if (s.avatar) return <img src={s.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />;
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
        {s.initials || s.provider.split(' ').slice(0, 2).map(x => x[0]).join('')}
      </div>
    );
  };

  const Card = ({ tone, icon, label, value, sub, delay = 0 }) => {
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046', iconBg: 'rgba(11,32,70,0.10)' },
      gold: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046', iconBg: 'rgba(250,204,21,0.22)' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046', iconBg: 'rgba(13,148,136,0.14)' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239', iconBg: 'rgba(244,63,94,0.12)' }
    };
    const t = tones[tone] || tones.navy;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay }}
        className="rounded-2xl border p-5 overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}
      >
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }} />
        <div className="flex items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: t.ink }}>{value}</p>
            {sub ? <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(15,23,42,0.60)' }}>{sub}</p> : null}
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.iconBg, color: t.ink, border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className={`ph ${icon} text-xl`} />
          </div>
        </div>
      </motion.div>
    );
  };

  const MrrChart = ({ months, values }) => {
    const ref = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
      let canceled = false;
      const init = () => {
        if (canceled) return;
        if (typeof window.Chart === 'undefined') {
          setTimeout(init, 120);
          return;
        }
        if (!ref.current) return;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        const ctx = ref.current.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(11, 32, 70, 0.22)');
        gradient.addColorStop(1, 'rgba(11, 32, 70, 0)');
        chartRef.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: months,
            datasets: [{
              label: 'MRR',
              data: values,
              borderColor: '#0B2046',
              backgroundColor: gradient,
              borderWidth: 3,
              pointBackgroundColor: '#FACC15',
              pointBorderColor: '#FFFFFF',
              pointBorderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#0F172A', padding: 10, displayColors: false, callbacks: { label: (c) => `UGX ${Number(c.parsed.y || 0).toLocaleString('en-UG')}` } }
            },
            scales: {
              y: { beginAtZero: false, grid: { color: 'rgba(226,232,240,0.85)', borderDash: [6, 6], drawBorder: false }, ticks: { color: '#94A3B8', callback: (v) => `UGX ${Number(v).toLocaleString('en-UG')}` } },
              x: { grid: { display: false, drawBorder: false }, ticks: { color: '#94A3B8' } }
            }
          }
        });
      };
      init();
      return () => {
        canceled = true;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      };
    }, [months.join('|'), values.join('|')]);

    return <canvas ref={ref} />;
  };

  const StatusChart = ({ active, expired, pending }) => {
    const ref = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
      let canceled = false;
      const init = () => {
        if (canceled) return;
        if (typeof window.Chart === 'undefined') {
          setTimeout(init, 120);
          return;
        }
        if (!ref.current) return;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        const ctx = ref.current.getContext('2d');
        chartRef.current = new window.Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Active', 'Expired', 'Pending'],
            datasets: [{
              data: [active, expired, pending],
              backgroundColor: ['#0B2046', '#F43F5E', '#FDE68A'],
              borderWidth: 0,
              hoverOffset: 6
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0F172A', padding: 10 } } }
        });
      };
      init();
      return () => {
        canceled = true;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      };
    }, [active, expired, pending]);

    return <canvas ref={ref} />;
  };

  const ModalShell = ({ open, children, onClose }) => (
    createPortal(
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/40 z-[998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed top-4 md:top-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-6xl bg-white rounded-2xl z-[999] overflow-y-auto overscroll-contain max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-8rem)] border"
              style={{ borderColor: '#E2E8F0', boxShadow: '0 24px 60px -30px rgba(11,32,70,0.55)' }}
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>,
      document.body
    )
  );

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mrrSeries = [1820000, 1890000, 2055000, 2140000, 2268000, 2385000, 2460000, 2595000, 2680000, 2765000, 2830000, 2958000];

  const selected = details.open ? subs.find(s => s.id === details.id) : null;

  const overrideStatus = (id, next) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: next } : s));
  };

  const extend = (id, days) => {
    setSubs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const from = s.expiryAt;
      const to = addDaysIso(s.expiryAt, days);
      const event = { at: new Date().toISOString(), type: 'Manual Extension', from, to, note: `Extended by admin (+${days}d).` };
      const payment = { id: `TX-EXT-${Math.floor(100000 + Math.random() * 899999)}`, amountUgx: 0, method: 'Admin', status: 'Completed', at: new Date().toISOString() };
      return { ...s, expiryAt: to, status: s.status === 'Expired' ? 'Active' : s.status, renewalHistory: [event, ...s.renewalHistory], paymentHistory: [payment, ...s.paymentHistory] };
    }));
  };

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Subscriptions</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Manage provider plans, renewals, and subscription health.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl p-1 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
          {['Active', 'Expired', 'Pending'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-4 py-1.5 text-sm font-extrabold rounded-lg transition"
              style={statusFilter === f ? { backgroundColor: '#0B2046', color: 'white' } : { color: '#64748B' }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => setStatusFilter('All')}
            className="px-4 py-1.5 text-sm font-extrabold rounded-lg transition"
            style={statusFilter === 'All' ? { backgroundColor: '#0B2046', color: 'white' } : { color: '#64748B' }}
          >
            All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card tone="navy" icon="ph-repeat" label="Active Subscriptions" value={counts.Active.toLocaleString('en-UG')} sub="Currently billed" delay={0.02} />
        <Card tone="rose" icon="ph-warning-circle" label="Expired / Overdue" value={counts.Expired.toLocaleString('en-UG')} sub={`${counts.overdue} overdue`} delay={0.05} />
        <Card tone="gold" icon="ph-hourglass-medium" label="Pending Renewals" value={counts.Pending.toLocaleString('en-UG')} sub="Awaiting payment" delay={0.08} />
        <Card tone="teal" icon="ph-chart-line-up" label="Monthly Recurring Revenue" value={formatUgx(counts.mrr)} sub="Active plans total" delay={0.11} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="bg-white p-6 rounded-2xl border lg:col-span-2"
          style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.7)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Monthly Recurring Revenue</p>
              <p className="text-sm" style={{ color: '#64748B' }}>Subscription revenue trend</p>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(250,204,21,0.18)', color: '#92400E', border: '1px solid rgba(250,204,21,0.25)' }}>MRR</span>
          </div>
          <div className="h-64">
            <MrrChart months={monthLabels} values={mrrSeries} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.04 }}
          className="bg-white p-6 rounded-2xl border"
          style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: 'rgba(226,232,240,0.7)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Subscription Status</p>
              <p className="text-sm" style={{ color: '#64748B' }}>Active vs expired</p>
            </div>
            <button className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
              <i className="ph ph-dots-three text-xl" />
            </button>
          </div>
          <div className="h-56 relative">
            <StatusChart active={counts.Active} expired={counts.Expired} pending={counts.Pending} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-2xl font-extrabold" style={{ color: '#0F172A' }}>{counts.total}</span>
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Total</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-extrabold">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0B2046' }} /><span style={{ color: '#64748B' }}>Active</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F43F5E' }} /><span style={{ color: '#64748B' }}>Expired</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FDE68A' }} /><span style={{ color: '#64748B' }}>Pending</span></div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search providers, plans, or IDs..."
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 pl-10 pr-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Pending">Pending</option>
            </select>
            <button
              onClick={() => { setQ(''); setStatusFilter('All'); }}
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white hover:bg-slate-50 transition"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider font-extrabold" style={{ backgroundColor: 'rgba(248,250,252,0.85)', borderColor: '#E2E8F0', color: '#64748B' }}>
                <th className="p-4 pl-6">Provider</th>
                <th className="p-4">Current plan</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Expiry date</th>
                <th className="p-4">Days remaining</th>
                <th className="p-4 pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
              {filtered.map((s, idx) => {
                const due = daysRemaining(s.expiryAt);
                const overdue = due < 0;
                const computedStatus = overdue ? 'Expired' : s.status;
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(0.2, idx * 0.02) }}
                    className={overdue ? 'hover:bg-rose-50/40 transition cursor-pointer' : 'hover:bg-slate-50/70 transition cursor-pointer'}
                    onClick={() => setDetails({ open: true, id: s.id })}
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar s={s} />
                        <div className="min-w-0">
                          <p className="font-extrabold truncate" style={{ color: '#0F172A' }}>{s.provider}</p>
                          <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{s.providerId} • {s.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold border" style={{ borderColor: 'rgba(11,32,70,0.10)', backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046' }}>
                        {s.plan}
                      </span>
                    </td>
                    <td className="p-4 font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(s.amountUgx)}/mo</td>
                    <td className="p-4 font-semibold" style={{ color: '#0F172A' }}>{formatDate(s.expiryAt)}</td>
                    <td className="p-4">
                      <span className="font-extrabold" style={overdue ? { color: '#F43F5E' } : due <= 7 ? { color: '#92400E' } : { color: '#0F172A' }}>
                        {overdue ? `${due} (overdue)` : due}
                      </span>
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${statusPill(computedStatus, overdue)}`}>
                          {overdue ? 'Overdue' : computedStatus}
                        </span>
                        <select
                          value={s.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => overrideStatus(s.id, e.target.value)}
                          className="bg-slate-50 border text-xs rounded-xl py-2 px-2.5 outline-none"
                          style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                        >
                          {['Active', 'Pending', 'Expired'].map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <button
                          onClick={(e) => { e.stopPropagation(); extend(s.id, 30); }}
                          className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white hover:bg-slate-50 transition"
                          style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                        >
                          Extend +30d
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                      <i className="ph ph-magnifying-glass text-3xl" />
                    </div>
                    <p className="mt-4 text-base font-extrabold" style={{ color: '#0F172A' }}>No subscriptions found</p>
                    <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Try a different filter or search term.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell open={details.open} onClose={() => setDetails({ open: false, id: null })}>
        <div className="p-6 border-b flex items-start justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
          <div className="min-w-0">
            <p className="text-lg font-extrabold truncate" style={{ color: '#0F172A' }}>{selected?.provider || 'Subscription Details'}</p>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{selected ? `${selected.providerId} • ${selected.plan} • ${formatUgx(selected.amountUgx)}/mo` : ''}</p>
          </div>
          <button onClick={() => setDetails({ open: false, id: null })} className="p-2 rounded-xl hover:bg-slate-50 transition" style={{ color: '#64748B' }}>
            <i className="ph ph-x text-xl" />
          </button>
        </div>

        {selected ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Subscription</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Plan</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>{selected.plan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Amount</span>
                    <span className="font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(selected.amountUgx)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Expiry</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>{formatDate(selected.expiryAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Days remaining</span>
                    <span className="font-extrabold" style={daysRemaining(selected.expiryAt) < 0 ? { color: '#F43F5E' } : { color: '#0F172A' }}>
                      {daysRemaining(selected.expiryAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <select
                    value={selected.status}
                    onChange={(e) => overrideStatus(selected.id, e.target.value)}
                    className="bg-white border text-sm rounded-xl py-2 px-3 outline-none"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                  >
                    {['Active', 'Pending', 'Expired'].map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button
                    onClick={() => extend(selected.id, 30)}
                    className="px-4 py-2 rounded-xl text-sm font-extrabold border bg-white hover:bg-slate-50 transition"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                  >
                    Extend +30d
                  </button>
                  <button
                    onClick={() => extend(selected.id, 90)}
                    className="px-4 py-2 rounded-xl text-sm font-extrabold text-white hover:opacity-90 transition"
                    style={{ backgroundColor: '#0B2046' }}
                  >
                    Extend +90d
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Provider Activity</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Listings', value: selected.providerActivity.listings.toLocaleString('en-UG'), icon: 'ph-list-dashes' },
                    { label: 'Views (30d)', value: selected.providerActivity.profileViews30d.toLocaleString('en-UG'), icon: 'ph-eye' },
                    { label: 'Unlocks (30d)', value: selected.providerActivity.contactUnlocks30d.toLocaleString('en-UG'), icon: 'ph-lock-key' },
                    { label: 'Purchases (30d)', value: selected.providerActivity.purchases30d.toLocaleString('en-UG'), icon: 'ph-bag' }
                  ].map((m) => (
                    <motion.div key={m.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{m.label}</p>
                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
                          <i className={`ph ${m.icon} text-lg`} />
                        </div>
                      </div>
                      <p className="mt-2 text-lg font-extrabold" style={{ color: '#0F172A' }}>{m.value}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Rating</p>
                    <span className="inline-flex items-center gap-1 text-sm font-extrabold" style={{ color: '#0B2046' }}>
                      <i className="ph ph-star" style={{ color: '#FACC15' }} /> {selected.providerActivity.ratingAvg.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.6)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Revenue Generated</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Provider revenue</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>{formatUgx(selected.revenueGeneratedUgx)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Subscription paid</span>
                    <span className="font-extrabold" style={{ color: '#0B2046' }}>
                      {formatUgx(selected.paymentHistory.filter(p => p.status === 'Completed').reduce((sum, p) => sum + p.amountUgx, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#334155' }}>Renewals</span>
                    <span className="font-extrabold" style={{ color: '#0F172A' }}>{selected.renewalHistory.length.toLocaleString('en-UG')}</span>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: '#0B2046' }}>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.80)' }}>Health</p>
                  <p className="mt-2 text-sm font-extrabold" style={{ color: '#F8FAFC' }}>
                    {daysRemaining(selected.expiryAt) < 0 ? 'Overdue — renewal required' : selected.status === 'Pending' ? 'Pending — awaiting confirmation' : 'Healthy — billing active'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Payment History</p>
                  <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{selected.paymentHistory.length} payments</span>
                </div>
                <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-extrabold" style={{ backgroundColor: 'rgba(248,250,252,0.85)', borderColor: '#E2E8F0', color: '#64748B' }}>
                        <th className="p-3">Transaction</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y" style={{ borderColor: '#E2E8F0' }}>
                      {selected.paymentHistory.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-extrabold" style={{ color: '#0F172A' }}>{p.id}</td>
                          <td className="p-3 font-extrabold" style={{ color: '#0B2046' }}>{formatUgx(p.amountUgx)}</td>
                          <td className="p-3 font-semibold" style={{ color: '#334155' }}>{p.method}</td>
                          <td className="p-3 font-extrabold" style={{ color: p.status === 'Completed' ? '#065F46' : p.status === 'Failed' ? '#F43F5E' : '#92400E' }}>{p.status}</td>
                          <td className="p-3 font-semibold" style={{ color: '#64748B' }}>{formatDateTime(p.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#64748B' }}>Renewal History</p>
                  <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{selected.renewalHistory.length} events</span>
                </div>
                <div className="mt-4 space-y-3">
                  {selected.renewalHistory.map((r, i) => (
                    <motion.div
                      key={`${r.at}-${i}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, delay: Math.min(0.18, i * 0.03) }}
                      className="rounded-2xl border p-4 bg-white"
                      style={{ borderColor: '#E2E8F0' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{r.type}</p>
                          <p className="text-sm mt-1" style={{ color: '#334155' }}>{r.note}</p>
                          <p className="text-xs mt-2 font-semibold" style={{ color: '#94A3B8' }}>From {formatDate(r.from)} → {formatDate(r.to)}</p>
                        </div>
                        <span className="text-xs font-extrabold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                          {formatDateTime(r.at)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm" style={{ color: '#64748B' }}>No subscription selected.</p>
          </div>
        )}
      </ModalShell>
    </div>
  );
};

const ReportsView = ({ reportsData = null, providersData = [], categoriesData = [] }) => {
  const formatUgx = (value) => {
    const n = Number(value ?? 0);
    return `UGX ${Number.isFinite(n) ? Math.round(n).toLocaleString('en-UG') : '0'}`;
  };

  const ymd = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayYmd = ymd(new Date().toISOString());
  const daysAgoYmd = (n) => ymd(new Date(Date.now() - n * 86400000).toISOString());

  const reportTypes = [
    { key: 'users', label: 'Users Report', icon: 'ph-users', desc: 'Growth, acquisition, retention and cohorts.' },
    { key: 'transactions', label: 'Transactions Report', icon: 'ph-arrows-left-right', desc: 'Revenue, fees, outcomes and payment health.' },
    { key: 'wallet', label: 'Wallet Report', icon: 'ph-wallet', desc: 'Balances, payouts and provider earnings.' },
    { key: 'visits', label: 'Visits Report', icon: 'ph-eye', desc: 'Traffic, engagement and conversion metrics.' },
    { key: 'providers', label: 'Providers Report', icon: 'ph-storefront', desc: 'Onboarding, approvals and provider performance.' }
  ];

  const reportSource = {
    providers: (providersData || []).map((p) => ({
      id: p.id,
      name: p.businessName || 'Unnamed provider',
      category: p.category?.name || 'Uncategorized',
      status: normalizeStatus(p.moderationStatus, 'Pending')
    })),
    categories: (categoriesData || []).map((c) => c.name || 'Uncategorized'),
    txTypes: ['Subscription', 'Product Purchase', 'Contact Unlock', 'Withdrawal'],
    txStatuses: (reportsData?.transactionStatuses || []).map((s) => normalizeStatus(s.label, 'Pending')),
    providersStatuses: (reportsData?.providerStatuses || []).map((s) => normalizeStatus(s.label, 'Pending')),
    usersStatuses: ['Active', 'Suspended']
  };

  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState(null);
  const [filters, setFilters] = useState({
    start: daysAgoYmd(30),
    end: todayYmd,
    providers: [],
    categories: [],
    txTypes: [],
    statuses: []
  });
  const [generated, setGenerated] = useState({ ok: false, csvName: '', csvRows: 0 });

  useEffect(() => {
    setGenerated({ ok: false, csvName: '', csvRows: 0 });
  }, [reportType, filters.start, filters.end, filters.providers.join('|'), filters.categories.join('|'), filters.txTypes.join('|'), filters.statuses.join('|')]);

  const clampStep = (n) => Math.max(1, Math.min(4, n));
  const goNext = () => setStep(s => clampStep(s + 1));
  const goBack = () => setStep(s => clampStep(s - 1));

  const toggleIn = (arr, value) => arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const selectedType = reportTypes.find(r => r.key === reportType) || null;

  const progress = (step / 4) * 100;
  const StepDot = ({ idx, label }) => {
    const active = step === idx;
    const done = step > idx;
    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center border" style={done ? { backgroundColor: '#0B2046', borderColor: '#0B2046', color: '#FDE68A' } : active ? { backgroundColor: 'rgba(250,204,21,0.18)', borderColor: 'rgba(250,204,21,0.35)', color: '#0B2046' } : { backgroundColor: 'white', borderColor: '#E2E8F0', color: '#64748B' }}>
            <span className="text-sm font-extrabold">{idx}</span>
          </div>
          {idx < 4 ? (
            <div className="absolute left-1/2 top-10 -translate-x-1/2 w-0.5 h-7" style={{ backgroundColor: done ? '#0B2046' : 'rgba(226,232,240,0.9)' }} />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: done ? '#0B2046' : '#94A3B8' }}>Step {idx}</p>
          <p className="text-sm font-extrabold truncate" style={{ color: active ? '#0F172A' : '#334155' }}>{label}</p>
        </div>
      </div>
    );
  };

  const Card = ({ tone, icon, label, value, sub }) => {
    const tones = {
      navy: { from: '#DCEBFF', to: '#BFD8FF', ink: '#0B2046', iconBg: 'rgba(11,32,70,0.10)' },
      gold: { from: '#FEF3C7', to: '#FDE68A', ink: '#0B2046', iconBg: 'rgba(250,204,21,0.22)' },
      teal: { from: '#CCFBF1', to: '#99F6E4', ink: '#0B2046', iconBg: 'rgba(13,148,136,0.14)' },
      rose: { from: '#FFE4E6', to: '#FECDD3', ink: '#9F1239', iconBg: 'rgba(244,63,94,0.12)' },
      cyan: { from: '#CFFAFE', to: '#A5F3FC', ink: '#0B2046', iconBg: 'rgba(8,145,178,0.14)' }
    };
    const t = tones[tone] || tones.navy;
    return (
      <div className="rounded-2xl border p-5 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: 'rgba(226,232,240,0.75)', boxShadow: '0 10px 30px -16px rgba(11,32,70,0.28)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }} />
        <div className="flex items-start justify-between gap-4 relative">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.65)' }}>{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: t.ink }}>{value}</p>
            {sub ? <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(15,23,42,0.60)' }}>{sub}</p> : null}
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.iconBg, color: t.ink, border: '1px solid rgba(255,255,255,0.65)' }}>
            <i className={`ph ${icon} text-xl`} />
          </div>
        </div>
      </div>
    );
  };

  const getFilterOptions = () => {
    if (reportType === 'transactions') {
      return {
        providerFilters: true,
        categoryFilters: false,
        transactionFilters: true,
        statusFilters: true,
        statuses: reportSource.txStatuses.length ? reportSource.txStatuses : ['Completed', 'Pending', 'Failed', 'Canceled', 'Refunded'],
        types: reportSource.txTypes
      };
    }
    if (reportType === 'wallet') {
      return {
        providerFilters: true,
        categoryFilters: false,
        transactionFilters: false,
        statusFilters: true,
        statuses: ['Enabled', 'Disabled', 'Frozen'],
        types: []
      };
    }
    if (reportType === 'visits') {
      return {
        providerFilters: true,
        categoryFilters: true,
        transactionFilters: false,
        statusFilters: false,
        statuses: [],
        types: []
      };
    }
    if (reportType === 'providers') {
      return {
        providerFilters: true,
        categoryFilters: true,
        transactionFilters: false,
        statusFilters: true,
        statuses: reportSource.providersStatuses.length ? reportSource.providersStatuses : ['Approved', 'Pending', 'Rejected', 'Suspended'],
        types: []
      };
    }
    if (reportType === 'users') {
      return {
        providerFilters: false,
        categoryFilters: false,
        transactionFilters: false,
        statusFilters: true,
        statuses: reportSource.usersStatuses,
        types: []
      };
    }
    return { providerFilters: false, categoryFilters: false, transactionFilters: false, statusFilters: false, statuses: [], types: [] };
  };

  const options = getFilterOptions();

  const computePreview = () => {
    const hasType = Boolean(reportType);
    if (!hasType) {
      return {
        empty: true,
        title: 'Select a report type to preview',
        subtitle: 'Choose a report type in Step 1 to unlock preview insights.'
      };
    }

    const spanDays = (() => {
      if (!filters.start || !filters.end) return 0;
      const s = new Date(filters.start);
      const e = new Date(filters.end);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
      return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1);
    })();

    const base = {
      empty: false,
      spanDays,
      providerCount: filters.providers.length || reportSource.providers.length,
      categoryCount: filters.categories.length || reportSource.categories.length,
      statusCount: filters.statuses.length || (options.statusFilters ? options.statuses.length : 0),
      typeCount: filters.txTypes.length || (options.transactionFilters ? options.types.length : 0)
    };

    if (reportType === 'transactions') {
      const totalTx = 420 + base.spanDays * 7 - base.providerCount * 6 + base.typeCount * 12;
      const completed = Math.max(0, Math.round(totalTx * 0.86));
      const failed = Math.max(0, totalTx - completed - Math.round(totalTx * 0.08));
      const fees = Math.round(totalTx * 3900);
      const gross = Math.round(totalTx * 61000);
      return {
        ...base,
        cards: [
          { tone: 'navy', icon: 'ph-arrows-left-right', label: 'Total Transactions', value: totalTx.toLocaleString('en-UG'), sub: `${base.spanDays} day window` },
          { tone: 'teal', icon: 'ph-check-circle', label: 'Completed', value: completed.toLocaleString('en-UG'), sub: 'Successful payments' },
          { tone: 'rose', icon: 'ph-warning-circle', label: 'Failed', value: failed.toLocaleString('en-UG'), sub: 'Requires follow-up' },
          { tone: 'gold', icon: 'ph-coins', label: 'Fees Collected', value: formatUgx(fees), sub: 'Platform fees' }
        ],
        chart: { kind: 'line', label: 'Daily Volume', series: Array.from({ length: 10 }, (_, i) => Math.max(10, Math.round(22 + i * 2 + (i % 3) * 4))) },
        summary: { headline: 'Transactions summary', lines: [`Gross processed: ${formatUgx(gross)}`, `Estimated fees: ${formatUgx(fees)}`] }
      };
    }

    if (reportType === 'wallet') {
      const totalBalance = 12500000 + base.providerCount * 690000;
      const pending = 1600000 + base.providerCount * 120000;
      const payouts = 8200000 + base.spanDays * 110000;
      const riskFlags = Math.max(0, 2 + Math.floor(base.providerCount / 3));
      return {
        ...base,
        cards: [
          { tone: 'gold', icon: 'ph-wallet', label: 'Total Balance', value: formatUgx(totalBalance), sub: 'Across providers' },
          { tone: 'teal', icon: 'ph-hourglass-medium', label: 'Pending Payouts', value: formatUgx(pending), sub: 'Queued withdrawals' },
          { tone: 'navy', icon: 'ph-arrow-circle-up', label: 'Payouts (range)', value: formatUgx(payouts), sub: 'Estimated total' },
          { tone: 'rose', icon: 'ph-shield-warning', label: 'Risk Flags', value: riskFlags.toLocaleString('en-UG'), sub: 'Manual review' }
        ],
        chart: { kind: 'bar', label: 'Balance Distribution', series: [3, 6, 5, 2, 1] },
        summary: { headline: 'Wallet summary', lines: [`Total balance: ${formatUgx(totalBalance)}`, `Pending withdrawals: ${formatUgx(pending)}`] }
      };
    }

    if (reportType === 'visits') {
      const visits = 98500 + base.spanDays * 880;
      const unique = Math.round(visits * 0.66);
      const conversion = Math.min(18, Math.max(3, Math.round(6 + base.categoryCount / 6)));
      const topCity = 'Kampala';
      return {
        ...base,
        cards: [
          { tone: 'navy', icon: 'ph-eye', label: 'Total Visits', value: visits.toLocaleString('en-UG'), sub: `${base.spanDays} days` },
          { tone: 'cyan', icon: 'ph-user', label: 'Unique Visitors', value: unique.toLocaleString('en-UG'), sub: 'Estimated uniques' },
          { tone: 'teal', icon: 'ph-chart-line-up', label: 'Conversion', value: `${conversion}%`, sub: 'Visits → actions' },
          { tone: 'gold', icon: 'ph-map-pin', label: 'Top City', value: topCity, sub: 'By visit share' }
        ],
        chart: { kind: 'line', label: 'Daily Visits', series: Array.from({ length: 10 }, (_, i) => Math.max(1000, Math.round(6200 + (i % 4) * 450 + i * 90))) },
        summary: { headline: 'Visits summary', lines: [`Unique share: ${Math.round((unique / visits) * 100)}%`, `Top city: ${topCity}`] }
      };
    }

    if (reportType === 'providers') {
      const onboarded = 36 + base.spanDays;
      const approved = 18 + Math.floor(onboarded * 0.62);
      const pending = Math.max(0, onboarded - approved - 4);
      const suspended = 3 + Math.floor(base.providerCount / 4);
      return {
        ...base,
        cards: [
          { tone: 'navy', icon: 'ph-storefront', label: 'New Providers', value: onboarded.toLocaleString('en-UG'), sub: `${base.spanDays} days` },
          { tone: 'teal', icon: 'ph-check-circle', label: 'Approved', value: approved.toLocaleString('en-UG'), sub: 'Passed review' },
          { tone: 'gold', icon: 'ph-hourglass-medium', label: 'Pending', value: pending.toLocaleString('en-UG'), sub: 'Awaiting review' },
          { tone: 'rose', icon: 'ph-warning-circle', label: 'Suspended', value: suspended.toLocaleString('en-UG'), sub: 'Policy actions' }
        ],
        chart: { kind: 'bar', label: 'Approval Funnel', series: [approved, pending, suspended] },
        summary: { headline: 'Providers summary', lines: [`Approval rate: ${Math.round((approved / Math.max(1, onboarded)) * 100)}%`, `Suspended: ${suspended}`] }
      };
    }

    if (reportType === 'users') {
      const signups = 4200 + base.spanDays * 42;
      const active = Math.round(signups * 0.72);
      const churn = Math.round(signups * 0.05);
      const retention = Math.max(40, Math.min(92, 78 - Math.floor(base.spanDays / 8)));
      return {
        ...base,
        cards: [
          { tone: 'navy', icon: 'ph-user-plus', label: 'New Users', value: signups.toLocaleString('en-UG'), sub: `${base.spanDays} days` },
          { tone: 'teal', icon: 'ph-users', label: 'Active Users', value: active.toLocaleString('en-UG'), sub: 'Estimated active' },
          { tone: 'rose', icon: 'ph-trend-down', label: 'Churned', value: churn.toLocaleString('en-UG'), sub: 'Deactivations' },
          { tone: 'gold', icon: 'ph-chart-line-up', label: 'Retention', value: `${retention}%`, sub: '7-day cohort' }
        ],
        chart: { kind: 'line', label: 'Daily Signups', series: Array.from({ length: 10 }, (_, i) => Math.max(80, Math.round(140 + (i % 5) * 22 + i * 6))) },
        summary: { headline: 'Users summary', lines: [`Retention (7d): ${retention}%`, `Churned: ${churn}`] }
      };
    }

    return { empty: true, title: 'No preview available', subtitle: 'Select a supported report type.' };
  };

  const preview = computePreview();

  const PreviewChart = ({ chart }) => {
    const ref = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
      let canceled = false;
      const init = () => {
        if (canceled) return;
        if (typeof window.Chart === 'undefined') {
          setTimeout(init, 120);
          return;
        }
        if (!ref.current || !chart) return;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        const ctx = ref.current.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(11, 32, 70, 0.22)');
        gradient.addColorStop(1, 'rgba(11, 32, 70, 0)');

        if (chart.kind === 'line') {
          chartRef.current = new window.Chart(ctx, {
            type: 'line',
            data: {
              labels: Array.from({ length: chart.series.length }, (_, i) => `D${i + 1}`),
              datasets: [{
                label: chart.label,
                data: chart.series,
                borderColor: '#0B2046',
                backgroundColor: gradient,
                borderWidth: 3,
                pointRadius: 0,
                fill: true,
                tension: 0.38
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0F172A', displayColors: false } },
              scales: { x: { grid: { display: false }, ticks: { color: '#94A3B8' } }, y: { grid: { color: 'rgba(226,232,240,0.85)', borderDash: [6, 6] }, ticks: { color: '#94A3B8' } } }
            }
          });
          return;
        }

        chartRef.current = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: chart.series.map((_, i) => `S${i + 1}`),
            datasets: [{
              label: chart.label,
              data: chart.series,
              backgroundColor: 'rgba(250,204,21,0.55)',
              borderRadius: 10,
              maxBarThickness: 24
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0F172A', displayColors: false } },
            scales: { x: { grid: { display: false }, ticks: { color: '#94A3B8' } }, y: { grid: { color: 'rgba(226,232,240,0.85)', borderDash: [6, 6] }, ticks: { color: '#94A3B8' } } }
          }
        });
      };
      init();
      return () => {
        canceled = true;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      };
    }, [chart?.kind, chart?.label, (chart?.series || []).join('|')]);

    return <canvas ref={ref} />;
  };

  const buildCsv = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `sidra_${reportType || 'report'}_${filters.start || 'start'}_${filters.end || 'end'}_${stamp}.csv`;

    const range = `${filters.start || ''}..${filters.end || ''}`;
    const baseMeta = [
      ['report_type', reportType || ''],
      ['date_range', range],
      ['providers', filters.providers.join('|')],
      ['categories', filters.categories.join('|')],
      ['transaction_types', filters.txTypes.join('|')],
      ['statuses', filters.statuses.join('|')]
    ];

    const rows = [];
    rows.push(['key', 'value']);
    baseMeta.forEach(([k, v]) => rows.push([k, String(v ?? '')]));
    rows.push(['', '']);
    rows.push(['preview_metric', 'preview_value']);

    if (preview?.cards?.length) {
      preview.cards.forEach((c) => rows.push([c.label, String(c.value)]));
    } else {
      rows.push(['note', 'no_preview']);
    }

    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(',')).join('\n');

    return { name, csv, rowCount: rows.length - 1 };
  };

  const downloadCsv = () => {
    const { name, csv, rowCount } = buildCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGenerated({ ok: true, csvName: name, csvRows: rowCount });
  };

  const canNext = () => {
    if (step === 1) return Boolean(reportType);
    if (step === 2) return Boolean(filters.start && filters.end);
    if (step === 3) return !preview.empty;
    return true;
  };

  const WizardPanel = ({ children, k }) => (
    <motion.div
      key={k}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  );

  const MultiSelect = ({ title, subtitle, optionsList, selected, onToggle, emptyLabel }) => (
    <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: '#E2E8F0' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{title}</p>
          <p className="text-sm" style={{ color: '#64748B' }}>{subtitle}</p>
        </div>
        <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
          {selected.length || 0}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {optionsList.length ? optionsList.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className="px-3 py-2 rounded-2xl border text-sm font-extrabold transition hover:-translate-y-0.5"
              style={on
                ? { borderColor: 'rgba(250,204,21,0.60)', backgroundColor: 'rgba(250,204,21,0.16)', color: '#0B2046', boxShadow: '0 14px 34px -28px rgba(11,32,70,0.35)' }
                : { borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.8)', color: '#334155' }}
            >
              {opt}
            </button>
          );
        }) : (
          <div className="w-full rounded-2xl border p-6 text-center" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
            <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{emptyLabel}</p>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Select a report type to unlock filters.</p>
          </div>
        )}
      </div>
    </div>
  );

  const ProviderAutocomplete = ({ title, subtitle, optionsList, selected, onToggle }) => {
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
      const onClick = (e) => {
        const el = rootRef.current;
        if (!el) return;
        if (!el.contains(e.target)) setOpen(false);
      };
      window.addEventListener('mousedown', onClick);
      return () => window.removeEventListener('mousedown', onClick);
    }, []);

    const q = term.trim().toLowerCase();
    const suggestions = optionsList
      .filter(o => !selected.includes(o))
      .filter(o => !q || o.toLowerCase().includes(q))
      .slice(0, 8);

    const onPick = (value) => {
      onToggle(value);
      setTerm('');
      setOpen(true);
      setTimeout(() => inputRef.current?.focus?.(), 0);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[0]) onPick(suggestions[0]);
      }
    };

    return (
      <div ref={rootRef} className="rounded-2xl border p-5 bg-white" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{title}</p>
            <p className="text-sm" style={{ color: '#64748B' }}>{subtitle}</p>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
            {selected.length || 0}
          </span>
        </div>

        <div className="mt-4 relative">
          <div className="relative">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search providers (ID or name)..."
              className="w-full bg-slate-50 border text-sm rounded-xl py-2.5 pl-10 pr-10 outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100 transition"
              style={{ color: '#64748B' }}
            >
              <i className={`ph ${open ? 'ph-caret-up' : 'ph-caret-down'} text-lg`} />
            </button>
          </div>

          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                className="absolute z-20 mt-2 w-full rounded-2xl border overflow-hidden bg-white"
                style={{ borderColor: '#E2E8F0', boxShadow: '0 18px 46px -34px rgba(11,32,70,0.45)' }}
              >
                {optionsList.length === 0 ? (
                  <div className="p-6 text-center" style={{ backgroundColor: 'rgba(248,250,252,0.85)' }}>
                    <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>No providers available</p>
                    <p className="text-sm mt-1" style={{ color: '#64748B' }}>Select a report type to unlock filters.</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="p-6 text-center" style={{ backgroundColor: 'rgba(248,250,252,0.85)' }}>
                    <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>No matches</p>
                    <p className="text-sm mt-1" style={{ color: '#64748B' }}>Try a different search term.</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {suggestions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onPick(opt)}
                        className="w-full text-left p-3 border-b last:border-b-0 hover:bg-slate-50 transition"
                        style={{ borderColor: '#E2E8F0' }}
                      >
                        <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{opt}</p>
                        <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>Add to filters</p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {selected.length ? selected.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border text-sm font-extrabold"
              style={{ borderColor: 'rgba(250,204,21,0.60)', backgroundColor: 'rgba(250,204,21,0.16)', color: '#0B2046' }}
            >
              <span className="truncate max-w-[18rem]">{opt}</span>
              <button
                type="button"
                onClick={() => onToggle(opt)}
                className="p-1 rounded-lg hover:bg-black/5 transition"
                style={{ color: '#0B2046' }}
              >
                <i className="ph ph-x text-sm" />
              </button>
            </span>
          )) : (
            <div className="w-full rounded-2xl border p-6 text-center" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
              <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>No providers selected</p>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>Leave empty to include all providers.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="view-fade space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Reports</h1>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Build and export enterprise-ready reports with guided filters.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setStep(1); setReportType(null); setFilters({ start: daysAgoYmd(30), end: todayYmd, providers: [], categories: [], txTypes: [], statuses: [] }); setGenerated({ ok: false, csvName: '', csvRows: 0 }); }}
            className="px-4 py-2.5 rounded-xl font-extrabold border bg-white hover:bg-slate-50 transition flex items-center gap-2"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            <i className="ph ph-arrow-counter-clockwise text-lg" />
            Reset Wizard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border bg-white p-6 space-y-5" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Report Wizard</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>Four steps to a clean CSV export.</p>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                {Math.round(progress)}%
              </span>
            </div>

            <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(226,232,240,0.9)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#0B2046' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              />
            </div>

            <div className="space-y-5">
              <StepDot idx={1} label="Choose report type" />
              <StepDot idx={2} label="Choose filters" />
              <StepDot idx={3} label="Preview summary" />
              <StepDot idx={4} label="Generate CSV" />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={goBack}
                disabled={step === 1}
                className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
              >
                Back
              </button>
              <button
                onClick={goNext}
                disabled={step === 4 || !canNext()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: '#0B2046' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-6" style={{ borderColor: '#E2E8F0', boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>{selectedType ? selectedType.label : 'Choose a report type'}</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  {selectedType ? selectedType.desc : 'Select one of the report types to continue.'}
                </p>
              </div>
              {selectedType ? (
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(250,204,21,0.18)', color: '#92400E', border: '1px solid rgba(250,204,21,0.25)' }}>
                  {selectedType.key.toUpperCase()}
                </span>
              ) : null}
            </div>

            <div className="mt-5">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <WizardPanel k="step1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {reportTypes.map((t, idx) => {
                        const active = reportType === t.key;
                        return (
                          <motion.button
                            key={t.key}
                            onClick={() => setReportType(t.key)}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: Math.min(0.2, idx * 0.03) }}
                            className="text-left rounded-2xl border p-5 transition hover:-translate-y-0.5"
                            style={active
                              ? { borderColor: 'rgba(250,204,21,0.65)', background: 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(11,32,70,0.06))', boxShadow: '0 18px 46px -34px rgba(11,32,70,0.40)' }
                              : { borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Report Type</p>
                                <p className="mt-1 text-base font-extrabold" style={{ color: '#0F172A' }}>{t.label}</p>
                                <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{t.desc}</p>
                              </div>
                              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={active ? { backgroundColor: 'rgba(250,204,21,0.22)', color: '#0B2046', border: '1px solid rgba(250,204,21,0.25)' } : { backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                                <i className={`ph ${t.icon} text-xl`} />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    {!reportType ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="rounded-2xl border p-8 text-center" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
                        <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                          <i className="ph ph-hand-pointing text-3xl" />
                        </div>
                        <p className="mt-4 text-base font-extrabold" style={{ color: '#0F172A' }}>Pick a report type</p>
                        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Then continue to filters and preview.</p>
                      </motion.div>
                    ) : null}
                  </WizardPanel>
                ) : null}

                {step === 2 ? (
                  <WizardPanel k="step2">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: '#E2E8F0' }}>
                        <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Date Range</p>
                        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Defines the report window.</p>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={filters.start}
                            onChange={(e) => setFilters(p => ({ ...p, start: e.target.value }))}
                            className="bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                            style={{ borderColor: '#E2E8F0' }}
                          />
                          <input
                            type="date"
                            value={filters.end}
                            onChange={(e) => setFilters(p => ({ ...p, end: e.target.value }))}
                            className="bg-slate-50 border text-sm rounded-xl py-2.5 px-3 outline-none"
                            style={{ borderColor: '#E2E8F0' }}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            { label: 'Last 7d', days: 7 },
                            { label: 'Last 30d', days: 30 },
                            { label: 'Last 90d', days: 90 }
                          ].map((p) => (
                            <button
                              key={p.label}
                              onClick={() => setFilters(f => ({ ...f, start: daysAgoYmd(p.days), end: todayYmd }))}
                              className="px-3 py-2 rounded-2xl border text-sm font-extrabold transition hover:-translate-y-0.5"
                              style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)', color: '#0F172A' }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border p-5" style={{ borderColor: '#E2E8F0', backgroundColor: '#0B2046' }}>
                        <p className="text-sm font-extrabold" style={{ color: '#F8FAFC' }}>Selected Context</p>
                        <p className="text-sm mt-1" style={{ color: 'rgba(226,232,240,0.75)' }}>Auto-adjusts based on report type.</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {[
                            { label: 'Report', value: selectedType?.label || '-' },
                            { label: 'Providers', value: filters.providers.length ? `${filters.providers.length} selected` : 'All' },
                            { label: 'Categories', value: filters.categories.length ? `${filters.categories.length} selected` : options.categoryFilters ? 'All' : '—' },
                            { label: 'Statuses', value: filters.statuses.length ? `${filters.statuses.length} selected` : options.statusFilters ? 'All' : '—' }
                          ].map((m) => (
                            <div key={m.label} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                              <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>{m.label}</p>
                              <p className="mt-2 text-sm font-extrabold truncate" style={{ color: '#FDE68A' }}>{m.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {options.providerFilters ? (
                      <ProviderAutocomplete
                        title="Provider filters"
                        subtitle="Limit report to specific providers."
                        optionsList={reportSource.providers.map(p => `${p.id} — ${p.name}`)}
                        selected={filters.providers}
                        onToggle={(v) => setFilters(f => ({ ...f, providers: toggleIn(f.providers, v) }))}
                      />
                    ) : null}

                    {options.categoryFilters ? (
                      <MultiSelect
                        title="Category filters"
                        subtitle="Limit report to specific categories."
                        optionsList={reportSource.categories}
                        selected={filters.categories}
                        onToggle={(v) => setFilters(f => ({ ...f, categories: toggleIn(f.categories, v) }))}
                        emptyLabel="No categories available"
                      />
                    ) : null}

                    {options.transactionFilters ? (
                      <MultiSelect
                        title="Transaction filters"
                        subtitle="Include specific transaction types."
                        optionsList={options.types}
                        selected={filters.txTypes}
                        onToggle={(v) => setFilters(f => ({ ...f, txTypes: toggleIn(f.txTypes, v) }))}
                        emptyLabel="No transaction filters"
                      />
                    ) : null}

                    {options.statusFilters ? (
                      <MultiSelect
                        title="Status filters"
                        subtitle="Include specific statuses."
                        optionsList={options.statuses}
                        selected={filters.statuses}
                        onToggle={(v) => setFilters(f => ({ ...f, statuses: toggleIn(f.statuses, v) }))}
                        emptyLabel="No statuses"
                      />
                    ) : null}
                  </WizardPanel>
                ) : null}

                {step === 3 ? (
                  <WizardPanel k="step3">
                    {preview.empty ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="rounded-2xl border p-10 text-center" style={{ borderColor: '#E2E8F0', backgroundColor: 'rgba(248,250,252,0.7)' }}>
                        <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                          <i className="ph ph-file-dashed text-3xl" />
                        </div>
                        <p className="mt-4 text-base font-extrabold" style={{ color: '#0F172A' }}>{preview.title}</p>
                        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{preview.subtitle}</p>
                      </motion.div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                          {preview.cards.map((c) => (
                            <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                              <Card tone={c.tone} icon={c.icon} label={c.label} value={c.value} sub={c.sub} />
                            </motion.div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="bg-white p-6 rounded-2xl border lg:col-span-2" style={{ borderColor: '#E2E8F0' }}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Chart Preview</p>
                                <p className="text-sm" style={{ color: '#64748B' }}>{preview.chart.label}</p>
                              </div>
                              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(250,204,21,0.18)', color: '#92400E', border: '1px solid rgba(250,204,21,0.25)' }}>
                                PREVIEW
                              </span>
                            </div>
                            <div className="mt-4 h-56">
                              <PreviewChart chart={preview.chart} />
                            </div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border" style={{ borderColor: '#E2E8F0' }}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Summary</p>
                              <i className="ph ph-sparkle text-lg" style={{ color: '#FACC15' }} />
                            </div>
                            <p className="mt-2 text-sm font-extrabold" style={{ color: '#0B2046' }}>{preview.summary.headline}</p>
                            <div className="mt-4 space-y-2">
                              {preview.summary.lines.map((l) => (
                                <div key={l} className="rounded-2xl border p-3 bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{l}</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#0B2046' }}>
                              <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.75)' }}>Filters</p>
                              <p className="mt-2 text-sm font-extrabold" style={{ color: '#F8FAFC' }}>
                                {filters.start} → {filters.end}
                              </p>
                              <p className="mt-2 text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.70)' }}>
                                Providers: {filters.providers.length ? filters.providers.length : 'All'} • Categories: {options.categoryFilters ? (filters.categories.length ? filters.categories.length : 'All') : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </WizardPanel>
                ) : null}

                {step === 4 ? (
                  <WizardPanel k="step4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 rounded-2xl border p-6 bg-white" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold" style={{ color: '#0F172A' }}>Generate CSV</p>
                            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Exports preview metrics + selected filters for auditability.</p>
                          </div>
                          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,32,70,0.06)', color: '#0B2046', border: '1px solid rgba(11,32,70,0.10)' }}>
                            CSV
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { label: 'Report type', value: selectedType?.label || '—' },
                            { label: 'Date range', value: `${filters.start} → ${filters.end}` },
                            { label: 'Providers', value: options.providerFilters ? (filters.providers.length ? `${filters.providers.length} selected` : 'All') : '—' },
                            { label: 'Statuses', value: options.statusFilters ? (filters.statuses.length ? `${filters.statuses.length} selected` : 'All') : '—' }
                          ].map((m) => (
                            <div key={m.label} className="rounded-2xl border p-4 bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                              <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{m.label}</p>
                              <p className="mt-2 text-sm font-extrabold truncate" style={{ color: '#0F172A' }}>{m.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <button
                            onClick={downloadCsv}
                            disabled={!reportType}
                            className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-50 transition hover:opacity-90 flex items-center gap-2"
                            style={{ backgroundColor: '#0B2046' }}
                          >
                            <i className="ph ph-download-simple text-lg" />
                            Generate CSV
                          </button>
                          <button
                            onClick={() => { setStep(1); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white hover:bg-slate-50 transition"
                            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                          >
                            Start Over
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', backgroundColor: '#0B2046' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold" style={{ color: '#F8FAFC' }}>Export Status</p>
                            <p className="text-sm mt-1" style={{ color: 'rgba(226,232,240,0.75)' }}>Audit-friendly download confirmation.</p>
                          </div>
                          <i className="ph ph-seal-check text-2xl" style={{ color: '#FACC15' }} />
                        </div>

                        <div className="mt-6 space-y-3">
                          {generated.ok ? (
                            <>
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>File</p>
                                <p className="mt-2 text-sm font-extrabold break-words" style={{ color: '#FDE68A' }}>{generated.csvName}</p>
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.04 }} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(226,232,240,0.70)' }}>Rows</p>
                                <p className="mt-2 text-2xl font-extrabold" style={{ color: '#F8FAFC' }}>{generated.csvRows.toLocaleString('en-UG')}</p>
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.08 }} className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(250,204,21,0.10)', border: '1px solid rgba(250,204,21,0.22)' }}>
                                <p className="text-sm font-extrabold" style={{ color: '#FDE68A' }}>Download complete</p>
                                <p className="text-sm mt-1" style={{ color: 'rgba(226,232,240,0.80)' }}>Your CSV is saved to your Downloads folder.</p>
                              </motion.div>
                            </>
                          ) : (
                            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                              <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.16)', color: '#FDE68A', border: '1px solid rgba(250,204,21,0.22)' }}>
                                <i className="ph ph-download-simple text-3xl" />
                              </div>
                              <p className="mt-4 text-base font-extrabold" style={{ color: '#F8FAFC' }}>No export yet</p>
                              <p className="mt-1 text-sm" style={{ color: 'rgba(226,232,240,0.75)' }}>Generate CSV to see export details.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </WizardPanel>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AiSearchSettings = ({ token }) => {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [model, setModel] = useState('');
  const [testText, setTestText] = useState('I want to eat');
  const [testOut, setTestOut] = useState(null);
  const [testing, setTesting] = useState(false);
  const card = { boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: '#E2E8F0' };

  const apply = (data) => { setCfg(data); setModel(data.model || ''); };
  useEffect(() => {
    if (!token) return;
    apiRequest('/admin/ai/settings', { token }).then(apply).catch((e) => setError(e.message || 'Unable to load AI settings'));
  }, [token]);

  const save = async (patch) => {
    setBusy(true);
    setError('');
    try {
      apply(await apiRequest('/admin/ai/settings', { token, method: 'PUT', body: JSON.stringify(patch) }));
      setNewKey('');
    } catch (e) {
      setError(e.message || 'Unable to save');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestOut(null);
    try {
      const out = await apiRequest('/admin/ai/test', { token, method: 'POST', body: JSON.stringify({ query: testText }) });
      setTestOut(out.result);
      apply(out.settings);
    } catch (e) {
      setTestOut({ ok: false, error: e.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const sourceText = !cfg ? '' : cfg.keySource === 'admin' ? 'Key saved here' : cfg.keySource === 'environment' ? 'Server default key' : 'No key set';

  return (
    <div className="bg-white rounded-2xl border p-8" style={card}>
      <div className="mb-6 pb-4 border-b flex items-start justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>AI smart search</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Understands what shoppers mean (&ldquo;I want to eat&rdquo; finds restaurants, &ldquo;I need a phone&rdquo; finds phones) and adds related products and services to the home search. If it is off or fails, search falls back to plain word matching.
          </p>
        </div>
        {cfg ? (
          <ToggleSwitch id="toggle_ai" name="toggle_ai" checked={cfg.enabled} onChange={() => save({ enabled: !cfg.enabled })} />
        ) : null}
      </div>

      {error ? <div className="mb-4 text-sm font-medium text-red-600">{error}</div> : null}
      {!cfg ? <p className="text-sm" style={{ color: '#64748B' }}>Loading…</p> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-3 py-1 rounded-full font-semibold" style={cfg.working ? { background: '#DCFCE7', color: '#166534' } : { background: '#F1F5F9', color: '#475569' }}>
              {cfg.working ? 'Running' : cfg.enabled ? 'Needs a key' : 'Switched off'}
            </span>
            <span style={{ color: '#64748B' }}>{sourceText}{cfg.keyPreview ? ` · ${cfg.keyPreview}` : ''}</span>
            <span style={{ color: '#64748B' }}>{cfg.requestCount} request{cfg.requestCount === 1 ? '' : 's'} · {cfg.errorCount} failed</span>
          </div>
          {cfg.lastError ? (
            <p className="text-xs" style={{ color: '#B45309' }}>Last problem: {cfg.lastError}{cfg.lastErrorAt ? ` (${new Date(cfg.lastErrorAt).toLocaleString()})` : ''}</p>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-xl border p-4" style={{ borderColor: '#E2E8F0' }}>
            <div>
              <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Block contact details in service listings</h4>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Refuses a service submission that contains a phone number, email, link, social handle or address (in the text or in photos), so contact stays behind the unlock fee. Pattern checks always run; the AI also reads spelled-out numbers, described addresses and photos.</p>
            </div>
            <ToggleSwitch id="toggle_ai_moderate" name="toggle_ai_moderate" checked={cfg.moderateServices !== false} onChange={() => save({ moderateServices: cfg.moderateServices === false })} />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Switch API key</label>
            <div className="flex flex-wrap gap-3">
              <input
                type="password"
                autoComplete="off"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Paste a new Anthropic key (sk-ant-…)"
                className="flex-1 min-w-[240px] bg-slate-50 border text-sm rounded-lg py-2.5 px-4 outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
              <button type="button" disabled={busy || newKey.trim().length < 10} onClick={() => save({ apiKey: newKey.trim() })} className="px-5 py-2.5 text-white rounded-lg font-medium disabled:opacity-50" style={{ backgroundColor: '#0B2046' }}>
                Save key
              </button>
              {cfg.keySource === 'admin' ? (
                <button type="button" disabled={busy} onClick={() => save({ clearKey: true })} className="px-5 py-2.5 rounded-lg font-medium border" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
                  Use server default
                </button>
              ) : null}
            </div>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Saved keys are stored encrypted and never shown again; only the first and last characters are displayed.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Model</label>
            <div className="flex gap-3">
              <input value={model} onChange={(e) => setModel(e.target.value)} className="flex-1 max-w-sm bg-slate-50 border text-sm rounded-lg py-2.5 px-4 outline-none" style={{ borderColor: '#E2E8F0' }} />
              <button type="button" disabled={busy || !model.trim() || model.trim() === cfg.model} onClick={() => save({ model: model.trim() })} className="px-5 py-2.5 rounded-lg font-medium border disabled:opacity-50" style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
                Save model
              </button>
            </div>
          </div>

          <div className="pt-6 border-t" style={{ borderColor: '#E2E8F0' }}>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Try it</label>
            <div className="flex flex-wrap gap-3">
              <input value={testText} onChange={(e) => setTestText(e.target.value)} className="flex-1 min-w-[240px] bg-slate-50 border text-sm rounded-lg py-2.5 px-4 outline-none" style={{ borderColor: '#E2E8F0' }} />
              <button type="button" disabled={testing} onClick={runTest} className="px-5 py-2.5 text-white rounded-lg font-medium disabled:opacity-60" style={{ backgroundColor: '#EA580C' }}>
                {testing ? 'Asking…' : 'Test'}
              </button>
            </div>
            {testOut ? (
              testOut.ok ? (
                <div className="mt-3 text-sm space-y-1" style={{ color: '#0F172A' }}>
                  <p><strong>Understood as:</strong> {testOut.intent || 'nothing to search for'}</p>
                  <p><strong>Also searches:</strong> {testOut.terms?.length ? testOut.terms.join(', ') : '—'}</p>
                  <p><strong>Categories matched:</strong> {(testOut.serviceCategoryIds?.length || 0) + (testOut.productCategoryIds?.length || 0)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-red-600">{testOut.error}</p>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsView = ({ settingsData, token, onReload }) => {
  const [toggles, setToggles] = useState({
    subs: true,
    contact: true,
    wallet: true,
    ecom: false,
  });

  const [prices, setPrices] = useState({
    subFee: '29.99',
    contactFee: '1.50',
    txFee: '5.0',
    minWithdraw: '50.00',
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settingsData) return;
    setToggles({
      subs: Boolean(settingsData.enableSubscription),
      contact: Boolean(settingsData.enableContactFee),
      wallet: Boolean(settingsData.enableWallet),
      ecom: Boolean(settingsData.enableEcommerce),
    });
    setPrices({
      subFee: String(settingsData.subscriptionFee ?? '0'),
      contactFee: String(settingsData.contactFee ?? '0'),
      txFee: String(settingsData.transactionFeePercent ?? '0'),
      minWithdraw: String(settingsData.minimumWithdrawalAmount ?? '0'),
    });
  }, [settingsData]);

  const handleToggle = (key) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await apiRequest('/admin/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          enableSubscription: toggles.subs,
          enableContactFee: toggles.contact,
          enableWallet: toggles.wallet,
          enableEcommerce: toggles.ecom,
          subscriptionFee: prices.subFee || '0',
          contactFee: prices.contactFee || '0',
          transactionFeePercent: Number(prices.txFee || 0),
          minimumWithdrawalAmount: prices.minWithdraw || '0',
        })
      });
      setSaved(true);
      onReload?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      window.alert(error.message || 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view-fade space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Platform Settings</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>Configure core features, pricing, and system behaviors.</p>
      </div>

      <div className="flex gap-8 items-start">
        <div className="w-64 flex-shrink-0 space-y-1">
          {['Global Configurations', 'Payment Gateways', 'Email Templates', 'Security Settings'].map((item, i) => (
            <a key={i} href="#" className="block px-4 py-2.5 rounded-lg font-medium text-sm transition"
              style={i === 0
                ? { backgroundColor: 'rgba(11,32,70,0.1)', color: '#0B2046', fontWeight: 600 }
                : { color: '#64748B' }}
              onClick={e => e.preventDefault()}
            >{item}</a>
          ))}
        </div>

        <div className="flex-1 space-y-8">
          <div className="bg-white rounded-2xl border p-8" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: '#E2E8F0' }}>
            <div className="mb-6 pb-4 border-b" style={{ borderColor: '#E2E8F0' }}>
              <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Platform Features</h2>
              <p className="text-sm" style={{ color: '#64748B' }}>Enable or disable core functionalities across the ecosystem.</p>
            </div>
            <div className="space-y-6">
              {[
                { key: 'subs', label: 'Provider Subscriptions', desc: 'Require providers to have an active plan to be listed.' },
                { key: 'contact', label: 'Contact Unlock Fee', desc: 'Charge users a small fee to view provider contact details.' },
                { key: 'wallet', label: 'Internal Wallet System', desc: 'Allow providers to accumulate earnings before withdrawal.' },
                { key: 'ecom', label: 'E-commerce Module', desc: 'Allow providers to sell physical or digital products.' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{item.label}</h4>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{item.desc}</p>
                  </div>
                  <ToggleSwitch
                    id={`toggle_${item.key}`}
                    name={`toggle_${item.key}`}
                    checked={toggles[item.key]}
                    onChange={() => handleToggle(item.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-8" style={{ boxShadow: '0 4px 24px -4px rgba(11,32,70,0.04), 0 2px 8px -2px rgba(11,32,70,0.02)', borderColor: '#E2E8F0' }}>
            <div className="mb-6 pb-4 border-b flex justify-between items-end" style={{ borderColor: '#E2E8F0' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Pricing Controls</h2>
                <p className="text-sm" style={{ color: '#64748B' }}>Set global fees and commissions.</p>
              </div>
              <button className="text-sm font-medium hover:underline" style={{ color: '#0B2046' }}>Provider Overrides <i className="ph ph-arrow-right"></i></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Default Subscription Fee (Monthly)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#64748B' }}>UGX</span>
                  <input type="number" value={prices.subFee} onChange={e => setPrices(p => ({ ...p, subFee: e.target.value }))} className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 pl-14 pr-4 outline-none transition-all" style={{ borderColor: '#E2E8F0' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Contact Unlock Fee</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#64748B' }}>UGX</span>
                  <input type="number" value={prices.contactFee} step="0.10" onChange={e => setPrices(p => ({ ...p, contactFee: e.target.value }))} className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 pl-14 pr-4 outline-none transition-all" style={{ borderColor: '#E2E8F0' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Global Transaction Fee</label>
                <div className="relative">
                  <input type="number" value={prices.txFee} step="0.1" onChange={e => setPrices(p => ({ ...p, txFee: e.target.value }))} className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 pl-4 pr-8 outline-none transition-all" style={{ borderColor: '#E2E8F0' }} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium" style={{ color: '#64748B' }}>%</span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>Applied to service bookings and e-commerce.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>Minimum Withdrawal Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#64748B' }}>UGX</span>
                  <input type="number" value={prices.minWithdraw} onChange={e => setPrices(p => ({ ...p, minWithdraw: e.target.value }))} className="w-full bg-slate-50 border text-sm rounded-lg py-2.5 pl-14 pr-4 outline-none transition-all" style={{ borderColor: '#E2E8F0' }} />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t flex justify-end items-center gap-4" style={{ borderColor: '#E2E8F0' }}>
              {saved && <span className="text-sm text-emerald-600 font-medium">Changes saved!</span>}
              <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-white rounded-lg font-medium transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#0B2046', boxShadow: '0 4px 6px -1px rgba(11,32,70,0.2)' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <AiSearchSettings token={token} />
        </div>
      </div>
    </div>
  );
};

// Maps a nav item to the backend permission key that gates its underlying /admin/* routes (see
// requirePermission calls in src/routes/adminData.routes.js etc.) - an item with no entry here
// (dashboard, rides) has no dedicated permission key and stays visible to any admin. Keep this
// in sync with src/constants/permissions.js if a route's gate ever changes.
const NAV_PERMISSION_MAP = {
  users: 'users',
  providers: 'providers',
  categories: 'categories',
  shopCategories: 'categories',
  jobs: 'jobs',
  events: 'events',
  serviceCategories: 'categories',
  audiences: 'categories',
  listings: 'listings',
  transactions: 'transactions',
  bus: 'busticketing',
  'platform-wallet': 'wallets',
  payouts: 'wallets',
  rides: 'rides',
  wallets: 'wallets',
  subscriptions: 'subscriptions',
  reports: 'reports',
  settings: 'settings',
  admins: 'adminroles',
  roles: 'adminroles'
};

const Sidebar = ({ activeTab, onTabChange, currentUser, onLogout, open, onClose }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-squares-four', section: 'Menu' },
    { id: 'users', label: 'Users', icon: 'ph-users', section: 'Menu' },
    { id: 'providers', label: 'Providers', icon: 'ph-storefront', section: 'Menu' },
    { id: 'categories', label: 'Categories', icon: 'ph-folders', section: 'Menu' },
    { id: 'audiences', label: 'Target audiences', icon: 'ph-globe-hemisphere-west', section: 'Menu' },
    { id: 'listings', label: 'Listings', icon: 'ph-list-dashes', section: 'Menu' },
    { id: 'rides', label: 'Gabla Ride', icon: 'ph-moped-front', section: 'Menu' },
    { id: 'bus', label: 'Bus ticketing', icon: 'ph-bus', section: 'Menu' },
    { id: 'jobs', label: 'Jobs & paid tasks', icon: 'ph-briefcase', section: 'Menu' },
    { id: 'events', label: 'Events', icon: 'ph-ticket', section: 'Menu' },
    { id: 'transactions', label: 'Transactions', icon: 'ph-arrows-left-right', section: 'Finance' },
    { id: 'platform-wallet', label: 'GoGabla wallet', icon: 'ph-bank', section: 'Finance' },
    { id: 'payouts', label: 'Payouts & refunds', icon: 'ph-hand-coins', section: 'Finance' },
    { id: 'wallets', label: 'Wallets', icon: 'ph-wallet', section: 'Finance' },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'ph-repeat', section: 'Finance' },
    { id: 'reports', label: 'Reports', icon: 'ph-chart-line-up', section: 'System' },
    { id: 'settings', label: 'Settings', icon: 'ph-gear', section: 'System' },
    { id: 'admins', label: 'Admins', icon: 'ph-shield-check', section: 'System' },
    { id: 'roles', label: 'Roles & Permissions', icon: 'ph-lock-key', section: 'System' },
  ];

  const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
  const isSuperAdmin = permissions.includes('*');
  const visibleNavItems = navItems.filter((item) => {
    const requiredKey = NAV_PERMISSION_MAP[item.id];
    return !requiredKey || isSuperAdmin || permissions.includes(requiredKey);
  });

  const sections = ['Menu', 'Finance', 'System'];

  return (
    <>
      {open ? (
        <div className="fixed inset-0 bg-slate-900/50 z-[89] md:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-[90] w-72 md:static md:z-20 md:w-64 flex flex-col h-full flex-shrink-0 transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ backgroundColor: '#0B2046' }}
      >
      <div className="h-20 flex items-center justify-between px-6 md:px-8 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sidra-blue font-bold text-xl" style={{ backgroundColor: '#FACC15', color: '#0B2046', boxShadow: '0 0 15px rgba(250,204,21,0.3)' }}>
            <i className="ph-fill ph-intersect"></i>
          </div>
          <span className="font-brand text-white text-xl font-bold tracking-wide">Gabla</span>
        </div>
        <button type="button" onClick={onClose} className="md:hidden text-white/60 hover:text-white p-1" aria-label="Close menu">
          <i className="ph ph-x text-xl"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {sections.map((section, si) => {
          const items = visibleNavItems.filter(item => item.section === section);
          if (!items.length) return null;
          return (
          <React.Fragment key={section}>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4 px-4" style={{ marginTop: si > 0 ? '2rem' : '0' }}>
              {section}
            </p>
            {items.map(item => {
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href="#"
                  onClick={e => { e.preventDefault(); onTabChange(item.id); }}
                  className="nav-item flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group"
                  style={isActive
                    ? { backgroundColor: '#FACC15', color: '#0B2046' }
                    : { color: 'rgba(255,255,255,0.7)' }}
                >
                  <i className={`ph ${item.icon} text-xl ${!isActive ? 'group-hover:text-yellow-400 transition-colors' : ''}`}></i>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </React.Fragment>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/10 transition" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-10 h-10 rounded-full border-2" style={{ borderColor: '#FACC15' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentUser?.name || 'Admin'}</p>
            <p className="text-xs text-white/50 truncate">{currentUser?.roleName || 'Admin'}</p>
          </div>
          <button type="button" onClick={onLogout} className="text-white/50 hover:text-white" title="Sign out">
            <i className="ph ph-sign-out"></i>
          </button>
        </div>
      </div>
      </aside>
    </>
  );
};

const Header = ({ searchValue, onSearchChange, currentUser, onOpenSidebar }) => (
  <header className="h-20 border-b flex items-center justify-between gap-3 px-4 md:px-8 z-10 sticky top-0" style={{ backgroundColor: 'rgba(248,250,252,0.8)', backdropFilter: 'blur(12px)', borderColor: '#E2E8F0' }}>
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <button type="button" onClick={onOpenSidebar} className="md:hidden flex-shrink-0 p-2 rounded-lg hover:bg-white shadow-sm transition-colors" style={{ color: '#0B2046' }} aria-label="Open menu">
        <i className="ph ph-list text-2xl"></i>
      </button>
      <div className="relative w-full max-w-96 hidden sm:block">
        <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#64748B' }}></i>
        <input
          type="text"
          placeholder="Search users, providers, transactions..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-white border text-sm rounded-full py-2.5 pl-12 pr-4 outline-none transition-all shadow-sm"
          style={{ borderColor: '#E2E8F0' }}
        />
      </div>
    </div>
    <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
      <button className="relative p-2 rounded-full hover:bg-white shadow-sm transition-colors" style={{ color: '#64748B' }}>
        <i className="ph ph-bell text-2xl"></i>
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2" style={{ borderColor: '#F8FAFC' }}></span>
      </button>
      <div className="h-8 w-px hidden md:block" style={{ backgroundColor: '#E2E8F0' }}></div>
      <div className="flex items-center gap-3 cursor-pointer group">
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold transition-colors group-hover:text-blue-800" style={{ color: '#0F172A' }}>{currentUser?.name || 'Admin'}</p>
          <p className="text-xs" style={{ color: '#64748B' }}>Admin Dashboard</p>
        </div>
        <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-10 h-10 rounded-full shadow-sm" />
        <i className="ph ph-caret-down text-sm hidden md:inline" style={{ color: '#64748B' }}></i>
      </div>
    </div>
  </header>
);

const MainContent = ({ activeTab, data, token, currentUser, onReload }) => {
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView dashboard={data.dashboard} providersData={data.providers} transactionsData={data.transactions} subscriptionsData={data.subscriptions} />;
      case 'users': return <UsersView usersData={data.users} />;
      case 'jobs': return <CommunityModeration kind="jobs" token={token} request={apiRequest}/>;
      case 'events': return <CommunityModeration kind="events" token={token} request={apiRequest}/>;
      case 'providers': return <ProvidersView providersData={data.providers} categoriesData={data.categories} token={token} onReload={onReload} />;
      case 'categories': return <CategoryWorkspace data={data} token={token} onReload={onReload} />;
      case 'shopCategories': return <ShopCategoriesView providerCategories={data.categories} categoriesData={data.shopCategories} token={token} onReload={onReload} />;
      case 'audiences': return <AudiencesView token={token} />;
      case 'serviceCategories': return <ShopCategoriesView kind="service" categoriesData={data.serviceCategories} token={token} onReload={onReload} />;
      case 'listings': return <ListingsView listingsData={data.listings} providersData={data.providers} categoriesData={data.categories} token={token} onReload={onReload} />;
      case 'rides': return <RidesView token={token} />;
      case 'bus': return <BusTicketingView token={token} />;
      case 'transactions': return <TransactionsView transactionsData={data.transactions} />;
      case 'platform-wallet': return <PlatformWalletView token={token} onReload={onReload} />;
      case 'payouts': return <PayoutsView token={token} onReload={onReload} />;
      case 'wallets': return <WalletsView walletsData={data.wallets} />;
      case 'subscriptions': return <SubscriptionsView subscriptionsData={data.subscriptions} />;
      case 'reports': return <ReportsView reportsData={data.reports} providersData={data.providers} categoriesData={data.categories} />;
      case 'admins': return <AdminsListPage adminsData={data.admins} invitesData={data.adminInvites} rolesData={data.adminRoles} currentUserId={currentUser?.id} token={token} onReload={onReload} />;
      case 'roles': return <RolesListPage rolesData={data.adminRoles} permissionsData={data.permissions} token={token} onReload={onReload} />;
      case 'settings': return <SettingsView settingsData={data.settings} token={token} onReload={onReload} />;
      default: return (
        <div className="view-fade flex flex-col items-center justify-center h-full" style={{ color: '#64748B' }}>
          <i className="ph ph-construction text-6xl mb-4 opacity-30"></i>
          <p className="text-lg font-medium">This section is under construction</p>
          <p className="text-sm mt-1">Coming soon...</p>
        </div>
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 z-0">
      {renderView()}
    </div>
  );
};

const RIDE_DRIVER_STATUS_BADGE = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-rose-100 text-rose-800',
  Suspended: 'bg-slate-200 text-slate-700'
};

const RIDE_TRIP_STATUS_BADGE = {
  Searching: 'bg-blue-100 text-blue-800',
  Matched: 'bg-amber-100 text-amber-800',
  Arrived: 'bg-amber-100 text-amber-800',
  'In progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  'No drivers found': 'bg-rose-100 text-rose-800',
  'Cancelled by rider': 'bg-slate-200 text-slate-700',
  'Cancelled by driver': 'bg-slate-200 text-slate-700'
};

const RIDE_TRIP_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'searching', label: 'Searching' },
  { value: 'matched', label: 'Matched' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled_by_rider', label: 'Cancelled by rider' },
  { value: 'cancelled_by_driver', label: 'Cancelled by driver' },
  { value: 'no_drivers_found', label: 'No drivers found' }
];

const RIDE_VEHICLE_TYPES = [
  { value: 'boda', label: 'Boda', icon: 'ph-moped-front' },
  { value: 'car', label: 'Car', icon: 'ph-car' }
];

const RidesView = ({ token }) => {
  const [subTab, setSubTab] = useState('pending');
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driverStatusFilter, setDriverStatusFilter] = useState('');
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    boda: { baseFare: 0, perKmRate: 0, perMinuteRate: 0, minimumFare: 0, commissionPercent: 15, isActive: true },
    car: { baseFare: 0, perKmRate: 0, perMinuteRate: 0, minimumFare: 0, commissionPercent: 15, isActive: true }
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoModal, setPhotoModal] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [savingDriverId, setSavingDriverId] = useState('');
  const [savingVehicleType, setSavingVehicleType] = useState('');

  const loadDrivers = async (status) => {
    setDriversLoading(true);
    try {
      const qs = status ? `?moderationStatus=${status}&limit=100` : '?limit=100';
      const result = await apiRequest(`/rides/admin/drivers${qs}`, { token });
      setDrivers(result?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load drivers.');
    } finally {
      setDriversLoading(false);
    }
  };

  const loadTrips = async (status) => {
    setTripsLoading(true);
    try {
      const qs = status ? `?status=${status}&limit=100` : '?limit=100';
      const result = await apiRequest(`/rides/admin/trips${qs}`, { token });
      setTrips(result?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load trips.');
    } finally {
      setTripsLoading(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const result = await apiRequest('/rides/admin/settings', { token });
      const byType = {};
      for (const s of result?.items || []) {
        byType[s.vehicleType] = {
          baseFare: s.baseFare,
          perKmRate: s.perKmRate,
          perMinuteRate: s.perMinuteRate,
          minimumFare: s.minimumFare,
          commissionPercent: s.commissionPercent,
          isActive: s.isActive
        };
      }
      setSettingsForm((prev) => ({
        boda: byType.boda || prev.boda,
        car: byType.car || prev.car
      }));
    } catch (e) {
      setError(e.message || 'Unable to load fare settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (subTab === 'pending') loadDrivers('pending');
    else if (subTab === 'drivers') loadDrivers(driverStatusFilter);
    else if (subTab === 'trips') loadTrips(tripStatusFilter);
    else if (subTab === 'settings') loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subTab, driverStatusFilter, tripStatusFilter]);

  // The dispatch view should feel live without the admin needing to refresh.
  useEffect(() => {
    if (subTab !== 'trips' || !token) return;
    const timer = setInterval(() => loadTrips(tripStatusFilter), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, token, tripStatusFilter]);

  const refreshDrivers = () => loadDrivers(subTab === 'pending' ? 'pending' : driverStatusFilter);

  const approve = async (driver) => {
    setSavingDriverId(driver.id);
    setError('');
    try {
      await apiRequest(`/rides/admin/drivers/${driver.id}/approval`, { token, method: 'PATCH', body: JSON.stringify({ approved: true }) });
      refreshDrivers();
    } catch (e) {
      setError(e.message || 'Unable to approve this driver.');
    } finally {
      setSavingDriverId('');
    }
  };

  const openReject = (driver) => {
    setRejectTarget(driver);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setSavingDriverId(rejectTarget.id);
    setError('');
    try {
      await apiRequest(`/rides/admin/drivers/${rejectTarget.id}/approval`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ approved: false, rejectionReason: rejectReason.trim() || undefined })
      });
      setRejectTarget(null);
      refreshDrivers();
    } catch (e) {
      setError(e.message || 'Unable to reject this driver.');
    } finally {
      setSavingDriverId('');
    }
  };

  const updateFormField = (vehicleType, key, value) => {
    setSettingsForm((prev) => ({ ...prev, [vehicleType]: { ...prev[vehicleType], [key]: value } }));
  };

  const saveSettings = async (vehicleType) => {
    const form = settingsForm[vehicleType];
    if (!form) return;
    setSavingVehicleType(vehicleType);
    setError('');
    try {
      await apiRequest('/rides/admin/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          vehicleType,
          baseFare: Number(form.baseFare) || 0,
          perKmRate: Number(form.perKmRate) || 0,
          perMinuteRate: Number(form.perMinuteRate) || 0,
          minimumFare: Number(form.minimumFare) || 0,
          commissionPercent: Math.round(Number(form.commissionPercent)) || 0,
          isActive: Boolean(form.isActive)
        })
      });
      loadSettings();
    } catch (e) {
      setError(e.message || 'Unable to save fare settings.');
    } finally {
      setSavingVehicleType('');
    }
  };

  const ModalShell = ({ open, children, onClose }) => (
    createPortal(
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/30 z-[998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white border rounded-2xl z-[999] overflow-y-auto overscroll-contain max-h-[90vh]"
              style={{ borderColor: '#E2E8F0', boxShadow: '0 20px 70px -30px rgba(11,32,70,0.45)' }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>,
      document.body
    )
  );

  const SubTabs = () => {
    const tabs = [
      { id: 'pending', label: 'Pending Drivers' },
      { id: 'drivers', label: 'All Drivers' },
      { id: 'trips', label: 'Live Trips' },
      { id: 'settings', label: 'Fare Settings' }
    ];
    return (
      <div className="flex items-center gap-2 bg-slate-50 border rounded-xl p-1 w-fit" style={{ borderColor: '#E2E8F0' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${subTab === t.id ? 'bg-white shadow-sm' : ''}`}
            style={subTab === t.id ? { color: '#0B2046' } : { color: '#64748B' }}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  const DriverCard = ({ driver }) => {
    const statusLabel = normalizeStatus(driver.moderationStatus);
    const canDecide = driver.moderationStatus === 'pending' || driver.moderationStatus === 'rejected';
    return (
      <div className="bg-white border rounded-2xl p-5 flex flex-col" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold flex-shrink-0">
              {initialsFor(driver.userName)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: '#0F172A' }}>{driver.userName || 'Unnamed driver'}</p>
              <p className="text-xs truncate" style={{ color: '#64748B' }}>{driver.userPhone || 'No phone on file'}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${RIDE_DRIVER_STATUS_BADGE[statusLabel] || 'bg-slate-200 text-slate-700'}`}>{statusLabel}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Vehicle</p>
            <p className="font-medium capitalize">{driver.vehicleType}{driver.vehicleModel ? ` · ${driver.vehicleModel}` : ''}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Plate</p>
            <p className="font-medium">{driver.licensePlate || '—'}</p>
          </div>
        </div>

        {driver.rejectionReason ? (
          <p className="mt-3 text-xs px-3 py-2 rounded-lg bg-rose-50 text-rose-700">Rejected: {driver.rejectionReason}</p>
        ) : null}

        <div className="mt-4">
          {driver.licensePhotoUrl ? (
            <button
              type="button"
              onClick={() => setPhotoModal(driver.licensePhotoUrl)}
              className="w-full text-sm font-semibold px-3 py-2 rounded-lg border"
              style={{ borderColor: '#E2E8F0', color: '#0B2046' }}
            >
              <i className="ph ph-image mr-1"></i> View permit photo
            </button>
          ) : (
            <span className="block text-sm px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-center">No permit photo submitted</span>
          )}
        </div>

        {canDecide ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={savingDriverId === driver.id}
              onClick={() => approve(driver)}
              className="flex-1 text-sm font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: '#0B2046' }}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={savingDriverId === driver.id}
              onClick={() => openReject(driver)}
              className="flex-1 text-sm font-bold px-3 py-2 rounded-lg border text-rose-700 disabled:opacity-50"
              style={{ borderColor: '#FECDD3' }}
            >
              Reject
            </button>
          </div>
        ) : driver.moderationStatus === 'approved' ? (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: '#F1F5F9', color: '#64748B' }}>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {driver.isOnline ? 'Online' : 'Offline'}
            </span>
            <span>★ {Number(driver.ratingAvg || 0).toFixed(1)} ({driver.ratingCount})</span>
          </div>
        ) : null}
      </div>
    );
  };

  const DriverGrid = ({ items, loading, emptyLabel }) => {
    if (loading) {
      return <div className="flex items-center justify-center py-24" style={{ color: '#94A3B8' }}><i className="ph ph-circle-notch animate-spin text-3xl"></i></div>;
    }
    if (!items.length) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center" style={{ color: '#94A3B8' }}>
          <i className="ph ph-moped-front text-5xl mb-3 opacity-40"></i>
          <p className="font-medium">{emptyLabel}</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((driver) => <DriverCard key={driver.id} driver={driver} />)}
      </div>
    );
  };

  const TripsTable = () => {
    if (tripsLoading) {
      return <div className="flex items-center justify-center py-24" style={{ color: '#94A3B8' }}><i className="ph ph-circle-notch animate-spin text-3xl"></i></div>;
    }
    if (!trips.length) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center" style={{ color: '#94A3B8' }}>
          <i className="ph ph-map-trifold text-5xl mb-3 opacity-40"></i>
          <p className="font-medium">No trips match this filter.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto bg-white border rounded-2xl" style={{ borderColor: '#E2E8F0' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: '#E2E8F0', color: '#94A3B8' }}>
              <th className="p-4 font-semibold">Rider</th>
              <th className="p-4 font-semibold">Driver</th>
              <th className="p-4 font-semibold">Vehicle</th>
              <th className="p-4 font-semibold">Route</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Fare</th>
              <th className="p-4 font-semibold">Requested</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => {
              const statusLabel = normalizeStatus(trip.status);
              return (
                <tr key={trip.id} className="border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                  <td className="p-4">
                    <p className="font-medium" style={{ color: '#0F172A' }}>{trip.riderName || 'Rider'}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{trip.riderPhone || ''}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium" style={{ color: '#0F172A' }}>{trip.driverName || '—'}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{trip.driverPhone || ''}</p>
                  </td>
                  <td className="p-4 capitalize">{trip.vehicleType}</td>
                  <td className="p-4 max-w-xs">
                    <p className="truncate text-xs" style={{ color: '#64748B' }}><i className="ph ph-circle text-emerald-500 mr-1"></i>{trip.pickup?.address || `${trip.pickup?.lat?.toFixed(4)}, ${trip.pickup?.lng?.toFixed(4)}`}</p>
                    <p className="truncate text-xs mt-1" style={{ color: '#64748B' }}><i className="ph ph-map-pin text-rose-500 mr-1"></i>{trip.dropoff?.address || `${trip.dropoff?.lat?.toFixed(4)}, ${trip.dropoff?.lng?.toFixed(4)}`}</p>
                  </td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RIDE_TRIP_STATUS_BADGE[statusLabel] || 'bg-slate-200 text-slate-700'}`}>{statusLabel}</span></td>
                  <td className="p-4 font-medium">{formatUgx(Number(trip.finalFare) > 0 ? trip.finalFare : trip.estimatedFare)}</td>
                  <td className="p-4 text-xs" style={{ color: '#94A3B8' }}>{formatDateShort(trip.requestedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const SettingsCard = ({ vehicleType, label, icon }) => {
    const form = settingsForm[vehicleType] || {};
    return (
      <div className="bg-white border rounded-2xl p-6" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,32,70,0.08)', color: '#0B2046' }}>
              <i className={`ph ${icon} text-xl`}></i>
            </div>
            <p className="font-bold" style={{ color: '#0F172A' }}>{label}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: '#64748B' }}>
            <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => updateFormField(vehicleType, 'isActive', e.target.checked)} />
            Active
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'baseFare', label: 'Base fare (UGX)' },
            { key: 'perKmRate', label: 'Per km (UGX)' },
            { key: 'perMinuteRate', label: 'Per minute (UGX)' },
            { key: 'minimumFare', label: 'Minimum fare (UGX)' }
          ].map((field) => (
            <div key={field.key}>
              <label className="text-xs font-semibold" style={{ color: '#64748B' }}>{field.label}</label>
              <input
                type="number"
                min="0"
                value={form[field.key] ?? 0}
                onChange={(e) => updateFormField(vehicleType, field.key, e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Platform commission (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.commissionPercent ?? 0}
              onChange={(e) => updateFormField(vehicleType, 'commissionPercent', e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={savingVehicleType === vehicleType}
          onClick={() => saveSettings(vehicleType)}
          className="mt-5 w-full text-sm font-bold px-3 py-2.5 rounded-lg text-white disabled:opacity-50"
          style={{ backgroundColor: '#0B2046' }}
        >
          {savingVehicleType === vehicleType ? 'Saving…' : 'Save'}
        </button>
      </div>
    );
  };

  return (
    <div className="view-fade space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Gabla Ride</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Approve drivers, watch live trips, and tune fares.</p>
        </div>
        <SubTabs />
      </div>

      {error ? (
        <div className="px-4 py-3 rounded-xl text-sm bg-rose-50 text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-400 hover:text-rose-600"><i className="ph ph-x"></i></button>
        </div>
      ) : null}

      {subTab === 'pending' ? (
        <DriverGrid items={drivers} loading={driversLoading} emptyLabel="No pending driver applications." />
      ) : null}

      {subTab === 'drivers' ? (
        <>
          <div className="flex items-center gap-2">
            {['', 'pending', 'approved', 'rejected', 'suspended'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setDriverStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${driverStatusFilter === s ? 'text-white' : ''}`}
                style={driverStatusFilter === s ? { backgroundColor: '#0B2046', borderColor: '#0B2046' } : { borderColor: '#E2E8F0', color: '#64748B' }}
              >
                {s ? normalizeStatus(s) : 'All'}
              </button>
            ))}
          </div>
          <DriverGrid items={drivers} loading={driversLoading} emptyLabel="No drivers found." />
        </>
      ) : null}

      {subTab === 'trips' ? (
        <>
          <select
            value={tripStatusFilter}
            onChange={(e) => setTripStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none w-fit"
            style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            {RIDE_TRIP_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <TripsTable />
        </>
      ) : null}

      {subTab === 'settings' ? (
        settingsLoading ? (
          <div className="flex items-center justify-center py-24" style={{ color: '#94A3B8' }}><i className="ph ph-circle-notch animate-spin text-3xl"></i></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {RIDE_VEHICLE_TYPES.map((vt) => <SettingsCard key={vt.value} vehicleType={vt.value} label={vt.label} icon={vt.icon} />)}
          </div>
        )
      ) : null}

      <ModalShell open={Boolean(photoModal)} onClose={() => setPhotoModal('')}>
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#E2E8F0' }}>
          <p className="font-bold" style={{ color: '#0F172A' }}>Permit / license photo</p>
          <button type="button" onClick={() => setPhotoModal('')} className="p-2 rounded-lg hover:bg-slate-50" style={{ color: '#64748B' }}><i className="ph ph-x text-lg"></i></button>
        </div>
        <div className="p-4">
          {photoModal ? <img src={photoModal} alt="Driver permit" className="w-full rounded-xl object-contain max-h-[70vh]" /> : null}
        </div>
      </ModalShell>

      <ModalShell open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)}>
        <div className="p-6">
          <p className="font-bold text-lg" style={{ color: '#0F172A' }}>Reject {rejectTarget?.userName || 'this driver'}?</p>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Optionally tell them why — they'll see this note and can resubmit.</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Permit photo is blurry, please retake it."
            className="mt-4 w-full border rounded-lg px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#E2E8F0' }}
          />
          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={() => setRejectTarget(null)} className="flex-1 text-sm font-semibold px-3 py-2.5 rounded-lg border" style={{ borderColor: '#E2E8F0', color: '#64748B' }}>Cancel</button>
            <button
              type="button"
              disabled={savingDriverId === rejectTarget?.id}
              onClick={submitReject}
              className="flex-1 text-sm font-bold px-3 py-2.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: '#9F1239' }}
            >
              Reject driver
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};

const LoginGate = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      onLogin(data.accessToken, data.user);
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const inputShell = (placeholder, icon, value, onChange, extra = null) => (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
      }}
    >
      <i className={`ph ph-${icon} text-lg`} style={{ color: 'rgba(230,230,230,0.72)' }}></i>
      <input
        value={value}
        onChange={onChange}
        type={placeholder === 'Password' && !showPassword ? 'password' : 'text'}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: '#F8FBFF' }}
      />
      {extra}
    </div>
  );

  return (
    <div
      className="min-h-screen relative flex items-center justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6"
      style={{
        background: 'radial-gradient(circle at top, rgba(36, 78, 168, 0.22), transparent 28%), linear-gradient(180deg, #020915 0%, #07111F 46%, #09111D 100%)',
        fontFamily: 'var(--font-ui)'
      }}
    >
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.12) 0%, rgba(255,193,7,0) 72%)' }} />
        <div className="absolute bottom-0 left-1/2 h-80 w-[28rem] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.18) 0%, rgba(255,193,7,0) 70%)' }} />
      </div>

      <div className="gabla-login-shell relative z-10 flex h-full w-full max-w-[540px] flex-col items-center justify-center">
        <div className="gabla-login-brand text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] lg:h-24 lg:w-24"
            style={{
              backgroundColor: '#FACC15',
              color: '#0B2046',
              boxShadow: '0 0 24px rgba(250,204,21,0.34)',
              animation: 'gablaPulse 4.8s ease-in-out infinite'
            }}
          >
            <i className="ph-fill ph-intersect text-[2.4rem] lg:text-[2.9rem]"></i>
          </div>
          <h1 className="font-brand mt-1 text-[1.9rem] font-semibold lg:text-[2.45rem]" style={{ color: '#FFC107' }}>GABLA</h1>
        </div>

        <div className="pointer-events-none absolute bottom-[9.25rem] left-1/2 z-0 -translate-x-1/2">
          <motion.div
            className="w-[6px] rounded-full"
            initial={{ opacity: 0, height: 36, y: 150 }}
            animate={{ opacity: 1, height: 168, y: 82 }}
            transition={{
              delay: 0.05,
              duration: 0.82,
              ease: [0.16, 1, 0.3, 1],
              height: { type: 'spring', stiffness: 180, damping: 18, mass: 0.8 },
              y: { type: 'spring', stiffness: 160, damping: 16, mass: 0.9 }
            }}
            style={{
              background: 'linear-gradient(180deg, rgba(103,180,255,0) 0%, rgba(103,180,255,0.55) 18%, rgba(130,220,255,0.9) 52%, rgba(255,193,7,0.65) 100%)',
              boxShadow: '0 0 24px rgba(88,196,255,0.38), 0 0 42px rgba(255,193,7,0.18)',
              transformOrigin: 'bottom center',
              animation: 'gablaBeamPulse 2.8s ease-in-out infinite'
            }}
          />
        </div>
        <div className="pointer-events-none absolute bottom-[11.75rem] left-1/2 z-0 -translate-x-1/2">
          <motion.div
            className="rounded-full"
            initial={{ opacity: 0, y: 124, scaleX: 0.6, scaleY: 0.7 }}
            animate={{ opacity: 1, y: 58, scaleX: 1, scaleY: 1 }}
            transition={{
              delay: 0.08,
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
              scaleX: { type: 'spring', stiffness: 180, damping: 16, mass: 0.9 },
              scaleY: { type: 'spring', stiffness: 170, damping: 16, mass: 0.95 }
            }}
            style={{
              width: '12.5rem',
              height: '14.5rem',
              background: 'radial-gradient(ellipse at center bottom, rgba(117, 227, 255, 0.42) 0%, rgba(73, 162, 255, 0.18) 38%, rgba(73, 162, 255, 0.05) 68%, rgba(73, 162, 255, 0) 100%)',
              filter: 'blur(8px)',
              animation: 'gablaHoloFlicker 2.4s ease-in-out infinite'
            }}
          />
        </div>

        <motion.div
          className="gabla-login-card relative mt-5 w-full"
          initial={{ opacity: 0, y: 96, scaleX: 0.84, scaleY: 0.72 }}
          animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
          transition={{
            duration: 0.96,
            ease: [0.16, 1, 0.3, 1],
            scaleX: { type: 'spring', stiffness: 210, damping: 14, mass: 0.78 },
            scaleY: { type: 'spring', stiffness: 220, damping: 13, mass: 0.76 },
            y: { type: 'spring', stiffness: 170, damping: 13, mass: 0.92 }
          }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <div className="pointer-events-none absolute inset-x-10 -bottom-10 h-24 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.18) 0%, rgba(255,193,7,0) 72%)', animation: 'gablaPulse 4.2s ease-in-out infinite' }}></div>
          <div
            className="pointer-events-none absolute inset-x-4 bottom-[-1.35rem] h-10 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(117,227,255,0.34) 0%, rgba(117,227,255,0.08) 42%, rgba(117,227,255,0) 76%)',
              filter: 'blur(5px)',
              animation: 'gablaHoloFlicker 2.2s ease-in-out infinite'
            }}
          />
          <form
            onSubmit={submit}
            className="gabla-login-form relative z-10 mx-auto w-full max-w-[430px] rounded-[28px] border px-5 py-5 sm:px-6 sm:py-6"
            style={{
              borderColor: 'rgba(103,180,255,0.22)',
              background: 'linear-gradient(180deg, rgba(22,34,58,0.68), rgba(9,16,30,0.84))',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 22px 60px -32px rgba(53,161,255,0.28), 0 18px 48px -34px rgba(255,193,7,0.2), inset 0 1px 0 rgba(150,220,255,0.12)'
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
              style={{ opacity: 0.9 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(146, 232, 255, 0.08) 0%, rgba(146,232,255,0.02) 18%, rgba(255,255,255,0) 100%)'
                }}
              />
              <div
                className="absolute inset-x-0 top-0 h-[1px]"
                style={{ background: 'rgba(146,232,255,0.32)', boxShadow: '0 0 16px rgba(146,232,255,0.28)' }}
              />
              <div
                className="absolute inset-x-6 h-10 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(146,232,255,0) 0%, rgba(146,232,255,0.28) 50%, rgba(146,232,255,0) 100%)',
                  filter: 'blur(6px)',
                  animation: 'gablaScan 2.8s ease-in-out infinite',
                  animationDelay: '0.3s'
                }}
              />
            </div>
            <motion.div
              className="relative text-center"
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15, mass: 0.78 }}
            >
              <h2 className="font-display text-[1.8rem] font-semibold lg:text-[2.1rem]" style={{ color: '#F4F7FB' }}>Welcome Back</h2>
              <p className="mt-1 text-sm lg:text-base" style={{ color: 'rgba(230,230,230,0.82)' }}>Sign in to continue to Gabla</p>
            </motion.div>

            {error ? (
              <div className="mt-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,0.35)', background: 'rgba(127,29,29,0.22)', color: '#FFD4DB' }}>
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-3.5">
              {inputShell('Email Address', 'envelope-simple', email, (e) => setEmail(e.target.value))}
              {inputShell(
                'Password',
                'lock',
                password,
                (e) => setPassword(e.target.value),
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-sm"
                  style={{ color: 'rgba(230,230,230,0.72)' }}
                >
                  <i className={`ph ph-${showPassword ? 'eye-slash' : 'eye'} text-lg`}></i>
                </button>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => window.alert('Forgot password flow is not connected yet.')}
                className="text-sm font-medium transition hover:opacity-80"
                style={{ color: '#FFC107' }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              disabled={loading || !email.trim() || !password}
              className="mt-4 w-full rounded-2xl py-3 text-base font-semibold transition disabled:opacity-60"
              style={{
                background: 'linear-gradient(180deg, #D8A63A 0%, #C88B17 100%)',
                color: '#14110D',
                boxShadow: '0 12px 24px -12px rgba(255,193,7,0.8)'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </motion.div>

        <div className="gabla-login-footer relative mt-8 w-full">
          <div className="absolute inset-x-0 bottom-5 mx-auto h-16 w-44 rounded-full lg:h-24 lg:w-72" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.58) 0%, rgba(255,193,7,0) 72%)', filter: 'blur(2px)' }}></div>
          <div className="absolute left-1/2 bottom-10 h-10 w-28 -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(117,227,255,0.48) 0%, rgba(117,227,255,0) 72%)', filter: 'blur(5px)', animation: 'gablaHoloFlicker 2.1s ease-in-out infinite' }}></div>
          <img src="/login-assets/gabla-bowl.svg" alt="" className="gabla-login-bowl pointer-events-none relative z-10 mx-auto w-[72%] max-w-[400px] lg:w-[68%] lg:max-w-[520px]" />
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData] = useState({
    dashboard: null,
    users: [],
    providers: [],
    categories: [],
    shopCategories: [],
    serviceCategories: [],
    listings: [],
    transactions: [],
    wallets: [],
    withdrawals: [],
    subscriptions: [],
    reports: null,
    admins: [],
    adminRoles: [],
    adminInvites: [],
    permissions: [],
    settings: null
  });
  const [loadingData, setLoadingData] = useState(false);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setCurrentUser(null);
  };

  const login = (accessToken, user) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setCurrentUser(user);
  };

  const loadData = async () => {
    if (!token) return;
    setLoadingData(true);
    // Roles now genuinely restrict which /admin/* endpoints a given admin can call (see
    // requirePermission on the backend), so a role missing e.g. "wallets" gets a real 403 on
    // that one request. A plain Promise.all would let that single rejection blank out the whole
    // dashboard for anyone but a Super Admin - each request is wrapped so a restricted module
    // just falls back to an empty/null value instead of breaking every other module's data.
    let sawUnauthorized = false;
    const safe = async (promise, fallback) => {
      try {
        return await promise;
      } catch (error) {
        if (/unauthorized/i.test(error.message)) sawUnauthorized = true;
        return fallback;
      }
    };
    try {
      const [
        dashboard,
        usersResult,
        providersResult,
        categoriesResult,
        shopCategoriesResult,
        serviceCategoriesResult,
        listingsResult,
        transactionsResult,
        walletsResult,
        withdrawalsResult,
        subscriptionsResult,
        reports,
        adminsResult,
        adminRolesResult,
        adminInvitesResult,
        permissionsResult,
        settings
      ] = await Promise.all([
        safe(apiRequest('/admin/dashboard', { token }), null),
        safe(apiRequest('/admin/users?limit=100', { token }), []),
        safe(apiRequest('/admin/providers?limit=100', { token }), []),
        safe(apiRequest('/admin/categories', { token }), []),
        safe(apiRequest('/admin/product-categories', { token }), []),
        safe(apiRequest('/admin/service-categories', { token }), []),
        safe(apiRequest('/admin/listings?limit=100', { token }), []),
        safe(apiRequest('/admin/transactions?limit=100', { token }), []),
        safe(apiRequest('/admin/wallets', { token }), []),
        safe(apiRequest('/admin/withdrawals', { token }), []),
        safe(apiRequest('/admin/subscriptions', { token }), []),
        safe(apiRequest('/admin/reports', { token }), null),
        safe(apiRequest('/admin/admins', { token }), []),
        safe(apiRequest('/admin/roles', { token }), []),
        safe(apiRequest('/admin-invites', { token }), []),
        safe(apiRequest('/admin/permissions', { token }), []),
        safe(apiRequest('/admin/settings', { token }), null)
      ]);
      setData({
        dashboard,
        users: usersResult?.items || usersResult || [],
        providers: providersResult?.items || providersResult || [],
        categories: categoriesResult?.items || categoriesResult || [],
        shopCategories: shopCategoriesResult?.items || shopCategoriesResult || [],
        serviceCategories: serviceCategoriesResult?.items || serviceCategoriesResult || [],
        listings: listingsResult?.items || listingsResult || [],
        transactions: transactionsResult?.items || transactionsResult || [],
        wallets: walletsResult?.items || walletsResult || [],
        withdrawals: withdrawalsResult?.items || withdrawalsResult || [],
        subscriptions: subscriptionsResult?.items || subscriptionsResult || [],
        reports,
        admins: adminsResult?.items || adminsResult || [],
        adminRoles: adminRolesResult?.items || adminRolesResult || [],
        adminInvites: adminInvitesResult?.items || adminInvitesResult || [],
        permissions: permissionsResult?.items || permissionsResult || [],
        settings
      });
      if (sawUnauthorized) logout();
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // The login response already carries the admin's role/permissions (see AuthService#userDto),
  // but currentUser only lives in React state - a page refresh keeps the token (localStorage)
  // and loses currentUser, which would otherwise make the nav-permission filtering below think
  // nobody is signed in yet. Refetching /auth/me on every token change re-hydrates it.
  useEffect(() => {
    if (!token) return;
    apiRequest('/auth/me', { token })
      .then((res) => setCurrentUser(res.user))
      .catch(() => {});
  }, [token]);

  // Defends against a stale activeTab landing on a module the current admin can't (or can no
  // longer) access - e.g. their role was changed while this tab was open, or a bookmark/refresh
  // reopened the app straight onto a restricted tab before Sidebar's own filtering ever ran.
  useEffect(() => {
    if (!currentUser) return;
    const requiredKey = NAV_PERMISSION_MAP[activeTab];
    const permissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    const allowed = !requiredKey || permissions.includes('*') || permissions.includes(requiredKey);
    if (!allowed) setActiveTab('dashboard');
  }, [currentUser, activeTab]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = customStyles.scrollbar + customStyles.fadeIn + customStyles.toggle + customStyles.loginScene;
    document.head.appendChild(style);

    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    chartScript.async = true;
    document.head.appendChild(chartScript);

    const phosphorScript = document.createElement('script');
    phosphorScript.src = 'https://unpkg.com/@phosphor-icons/web';
    phosphorScript.async = true;
    document.head.appendChild(phosphorScript);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!token) return <LoginGate onLogin={login} />;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC', fontFamily: 'var(--font-ui)', color: '#0F172A' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        currentUser={currentUser}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(250,204,21,0.05)', filter: 'blur(100px)' }}></div>
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none -z-10" style={{ background: 'rgba(11,32,70,0.05)', filter: 'blur(120px)' }}></div>
        <Header searchValue={searchValue} onSearchChange={setSearchValue} currentUser={currentUser} onOpenSidebar={() => setSidebarOpen(true)} />
        {loadingData ? <div className="px-8 pt-4 text-xs font-semibold" style={{ color: '#64748B' }}>Syncing live backend data...</div> : null}
        <MainContent activeTab={activeTab} data={data} token={token} currentUser={currentUser} onReload={loadData} />
      </main>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </Router>
  );
};

export default App;
