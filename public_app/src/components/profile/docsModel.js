// Shared pieces of the "Quotes & receipts" studio: curated colours, the character limits (mirroring the API's
// validation so errors show inline before a save), and draft helpers.

import i18n from "../../i18n";

// `key` selects the translated colour name (docs.palette.<key>); `name` is the English fallback.
export const ACCENT_PALETTE = [
  { key: "navy", name: "Navy", value: "#0b2046" },
  { key: "royalBlue", name: "Royal blue", value: "#1d4ed8" },
  { key: "teal", name: "Teal", value: "#0f766e" },
  { key: "emerald", name: "Emerald", value: "#047857" },
  { key: "orange", name: "Orange", value: "#2563eb" },
  { key: "burgundy", name: "Burgundy", value: "#9f1239" },
  { key: "plum", name: "Plum", value: "#6d28d9" },
  { key: "charcoal", name: "Charcoal", value: "#1f2937" }
];

// path -> max length
export const LIMITS = {
  "brand.businessName": 120,
  "brand.tagline": 160,
  "brand.logoUrl": 1000,
  "brand.address": 300,
  "brand.phone": 40,
  "brand.email": 254,
  "brand.website": 200,
  "brand.taxId": 40,
  "quotation.title": 40,
  "quotation.intro": 500,
  "quotation.terms": 2000,
  "quotation.signatoryName": 80,
  "quotation.signatoryTitle": 80,
  "receipt.title": 40,
  "receipt.thankYou": 400,
  "receipt.footerNote": 400,
  "tax.label": 20,
  "payment.instructions": 600,
  "payment.mobileMoneyNumber": 40,
  "payment.mobileMoneyName": 80,
  "payment.bankDetails": 400
};

export const SECTION_OF = (path) => {
  const [section, key] = path.split(".");
  if (section === "brand") return "business";
  if (section === "options" || key === "accentColor") return "look";
  return section; // quotation | receipt | tax | payment | email
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PREFIX_RE = /^[A-Za-z0-9]{1,6}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const toNumber = (value) => (value === "" || value === null || value === undefined ? NaN : Number(value));

export const clone = (value) => JSON.parse(JSON.stringify(value));

// Canonical form of a draft (numbers as numbers, prefixes uppercased) used for comparing, previewing and saving.
export const normalize = (settings) => {
  const out = clone(settings);
  out.quotation.validityDays = toNumber(out.quotation.validityDays);
  out.tax.percent = toNumber(out.tax.percent);
  out.quotation.prefix = String(out.quotation.prefix ?? "").trim().toUpperCase();
  out.receipt.prefix = String(out.receipt.prefix ?? "").trim().toUpperCase();
  out.brand.accentColor = String(out.brand.accentColor ?? "").trim();
  return out;
};

// Friendly, field-keyed validation. Empty object = valid.
export const validateDraft = (settings) => {
  const s = normalize(settings);
  const errors = {};

  for (const [path, max] of Object.entries(LIMITS)) {
    const [section, key] = path.split(".");
    const value = String(s[section]?.[key] ?? "");
    if (value.trim().length > max) errors[path] = i18n.t("docs.model.tooLong", { length: value.trim().length, max });
  }
  if (s.brand.email && !EMAIL_RE.test(s.brand.email)) errors["brand.email"] = i18n.t("docs.model.errEmail");
  if (s.brand.logoUrl && !/^https?:\/\//i.test(s.brand.logoUrl)) errors["brand.logoUrl"] = i18n.t("docs.model.errLogo");
  if (!HEX_RE.test(s.brand.accentColor)) errors["brand.accentColor"] = i18n.t("docs.model.errHex");
  if (!PREFIX_RE.test(s.quotation.prefix)) errors["quotation.prefix"] = i18n.t("docs.model.errPrefix", { example: "QT" });
  if (!PREFIX_RE.test(s.receipt.prefix)) errors["receipt.prefix"] = i18n.t("docs.model.errPrefix", { example: "RC" });
  const days = s.quotation.validityDays;
  if (!Number.isInteger(days) || days < 1 || days > 365) errors["quotation.validityDays"] = i18n.t("docs.model.errDays");
  const pct = s.tax.percent;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) errors["tax.percent"] = i18n.t("docs.model.errPercent");
  return errors;
};

// Only the keys that changed, as a partial settings object (so untouched business details keep falling back to
// the provider's profile instead of being frozen at today's values).
export const diffSettings = (base, next) => {
  const a = normalize(base);
  const b = normalize(next);
  const patch = {};
  for (const section of Object.keys(b)) {
    for (const key of Object.keys(b[section])) {
      const same = Object.is(a[section]?.[key], b[section][key]) || (Number.isNaN(a[section]?.[key]) && Number.isNaN(b[section][key]));
      if (!same) {
        patch[section] = patch[section] || {};
        patch[section][key] = b[section][key];
      }
    }
  }
  return patch;
};

// The API reports one problem as `"quotation.prefix" with value ...`; turn it into { path, message }.
export const parseApiError = (message = "") => {
  const match = /^"([\w.]+)"\s+(.*)$/.exec(message);
  if (!match) return { path: null, message };
  const [, path, rest] = match;
  let friendly = rest;
  if (/fails to match/.test(rest)) friendly = i18n.t("docs.model.apiFormat");
  else if (/length must be less than or equal to (\d+)/.test(rest)) friendly = i18n.t("docs.model.apiTooLong", { max: /(\d+)/.exec(rest)[1] });
  else if (/must be a valid email/.test(rest)) friendly = i18n.t("docs.model.apiEmail");
  else if (/must be a valid uri/.test(rest)) friendly = i18n.t("docs.model.apiLink");
  else if (/must be (less|greater)/.test(rest)) friendly = i18n.t("docs.model.apiRange");
  return { path, message: friendly };
};

// PDFs can only embed PNG and JPEG. Returns true when the URL clearly points at something else.
export const logoLikelyUnsupported = (url) => {
  if (!url) return false;
  const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
  if (!match) return false;
  return !["png", "jpg", "jpeg"].includes(match[1].toLowerCase());
};

export const monogram = (name) => (String(name || "").trim()[0] || "G").toUpperCase();
