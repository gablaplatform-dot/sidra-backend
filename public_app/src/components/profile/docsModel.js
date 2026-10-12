// Shared pieces of the "Quotes & receipts" studio: curated colours, the character limits (mirroring the API's
// validation so errors show inline before a save), and draft helpers.

export const ACCENT_PALETTE = [
  { name: "Navy", value: "#0b2046" },
  { name: "Royal blue", value: "#1d4ed8" },
  { name: "Teal", value: "#0f766e" },
  { name: "Emerald", value: "#047857" },
  { name: "Orange", value: "#ea580c" },
  { name: "Burgundy", value: "#9f1239" },
  { name: "Plum", value: "#6d28d9" },
  { name: "Charcoal", value: "#1f2937" }
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
    if (value.trim().length > max) errors[path] = `Too long - ${value.trim().length} of ${max} characters.`;
  }
  if (s.brand.email && !EMAIL_RE.test(s.brand.email)) errors["brand.email"] = "Enter a valid email address, like sales@mybusiness.com.";
  if (s.brand.logoUrl && !/^https?:\/\//i.test(s.brand.logoUrl)) errors["brand.logoUrl"] = "The logo must be an image link starting with https://.";
  if (!HEX_RE.test(s.brand.accentColor)) errors["brand.accentColor"] = "Use a 6-digit hex colour like #0b2046.";
  if (!PREFIX_RE.test(s.quotation.prefix)) errors["quotation.prefix"] = "1-6 letters or numbers, e.g. QT.";
  if (!PREFIX_RE.test(s.receipt.prefix)) errors["receipt.prefix"] = "1-6 letters or numbers, e.g. RC.";
  const days = s.quotation.validityDays;
  if (!Number.isInteger(days) || days < 1 || days > 365) errors["quotation.validityDays"] = "Enter a whole number of days from 1 to 365.";
  const pct = s.tax.percent;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) errors["tax.percent"] = "Enter a percentage from 0 to 100.";
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
  if (/fails to match/.test(rest)) friendly = "That value isn't in the right format.";
  else if (/length must be less than or equal to (\d+)/.test(rest)) friendly = `Too long - at most ${/(\d+)/.exec(rest)[1]} characters.`;
  else if (/must be a valid email/.test(rest)) friendly = "Enter a valid email address.";
  else if (/must be a valid uri/.test(rest)) friendly = "That isn't a valid link.";
  else if (/must be (less|greater)/.test(rest)) friendly = "That number is out of range.";
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
