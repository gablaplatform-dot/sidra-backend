// Only web links and in-app paths may be turned into a link. Anything else (javascript:, data:, ...) becomes
// the fallback, so an address a provider typed can never run script when someone taps it.
export const safeHref = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  if (/^\/(?!\/|\\)/.test(text) || /^https?:\/\//i.test(text)) return text;
  return fallback;
};

// A bare website like "mybiz.com" is shown as a link to https://mybiz.com.
export const webHref = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return safeHref(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`, "");
};
