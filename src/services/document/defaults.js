import Joi from "joi";

// What a provider can customise on their quotations and receipts. Everything has a sensible default so
// a provider who never opens the settings still sends professional documents; the business details are
// filled from their profile until they type something else.

export const DEFAULT_QUOTATION_TERMS = [
  "Prices are in Ugandan Shillings (UGX) and are valid until the date shown on this quotation.",
  "Items are subject to availability when the order is confirmed.",
  "Payment is made on delivery or collection unless the seller has agreed something else.",
  "Delivery times are estimates and will be confirmed by the seller."
].join("\n");

export const DEFAULT_SETTINGS = Object.freeze({
  brand: {
    businessName: "",
    tagline: "",
    logoUrl: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    accentColor: "#0b2046"
  },
  quotation: {
    title: "Quotation",
    prefix: "QT",
    validityDays: 14,
    intro: "Thank you for your order. Here is our quotation for the items below.",
    terms: DEFAULT_QUOTATION_TERMS,
    showSignature: true,
    signatoryName: "",
    signatoryTitle: ""
  },
  receipt: {
    title: "Payment receipt",
    prefix: "RC",
    thankYou: "Thank you for your business. Please keep this receipt as proof of payment.",
    footerNote: ""
  },
  tax: { enabled: false, label: "VAT", percent: 18, inclusive: true },
  payment: { instructions: "", mobileMoneyNumber: "", mobileMoneyName: "", bankDetails: "" },
  options: { showItemNumbers: true, showAmountInWords: true, showQrCode: true },
  email: { sendQuotation: true, sendReceipt: true }
});

const text = (max) => Joi.string().trim().max(max).allow("");
const color = Joi.string().trim().pattern(/^#[0-9a-fA-F]{6}$/);

export const settingsSchema = Joi.object({
  brand: Joi.object({
    businessName: text(120),
    tagline: text(160),
    logoUrl: Joi.string().uri().max(1000).allow(""),
    address: text(300),
    phone: text(40),
    email: Joi.string().trim().email({ tlds: { allow: false } }).max(254).allow(""),
    website: text(200),
    taxId: text(40),
    accentColor: color
  }),
  quotation: Joi.object({
    title: text(40),
    prefix: Joi.string().trim().uppercase().pattern(/^[A-Z0-9]{1,6}$/),
    validityDays: Joi.number().integer().min(1).max(365),
    intro: text(500),
    terms: text(2000),
    showSignature: Joi.boolean(),
    signatoryName: text(80),
    signatoryTitle: text(80)
  }),
  receipt: Joi.object({
    title: text(40),
    prefix: Joi.string().trim().uppercase().pattern(/^[A-Z0-9]{1,6}$/),
    thankYou: text(400),
    footerNote: text(400)
  }),
  tax: Joi.object({ enabled: Joi.boolean(), label: text(20), percent: Joi.number().min(0).max(100), inclusive: Joi.boolean() }),
  payment: Joi.object({ instructions: text(600), mobileMoneyNumber: text(40), mobileMoneyName: text(80), bankDetails: text(400) }),
  options: Joi.object({ showItemNumbers: Joi.boolean(), showAmountInWords: Joi.boolean(), showQrCode: Joi.boolean() }),
  email: Joi.object({ sendQuotation: Joi.boolean(), sendReceipt: Joi.boolean() })
}).unknown(false);

// Section-by-section merge: only known keys, stored values win over defaults, empty strings count as "not set"
// for the business details that fall back to the provider's profile.
export const mergeSettings = (...layers) => {
  const out = {};
  for (const section of Object.keys(DEFAULT_SETTINGS)) {
    out[section] = { ...DEFAULT_SETTINGS[section] };
    for (const layer of layers) {
      const incoming = layer?.[section];
      if (!incoming || typeof incoming !== "object") continue;
      for (const key of Object.keys(DEFAULT_SETTINGS[section])) {
        if (incoming[key] !== undefined) out[section][key] = incoming[key];
      }
    }
  }
  return out;
};

const joinLocation = (location) => [location?.address, location?.city, location?.region].filter(Boolean).join(", ");

// The business details a document starts from, taken from the provider's own profile.
export const profileBrand = (provider) => ({
  businessName: provider.businessName || "",
  tagline: "",
  logoUrl: provider.media?.avatarUrl || "",
  address: joinLocation(provider.location),
  phone: provider.contact?.phone || provider.contact?.whatsapp || "",
  email: provider.contact?.email || "",
  website: provider.contact?.website || "",
  taxId: "",
  accentColor: DEFAULT_SETTINGS.brand.accentColor
});

// Stored settings layered over the profile layered over defaults; blank brand fields fall through to the profile.
export const resolveSettings = (provider, stored) => {
  const merged = mergeSettings({ brand: profileBrand(provider) }, stored || {});
  const profile = profileBrand(provider);
  for (const key of Object.keys(profile)) {
    if (!merged.brand[key] && profile[key]) merged.brand[key] = profile[key];
  }
  return merged;
};
