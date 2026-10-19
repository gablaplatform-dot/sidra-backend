import i18n, { intlLocale } from "../i18n";
import { API_BASE, request } from "./api";
import { clearSession, getSession } from "./session";

// Quotations & receipts. Everything here talks to /documents. The PDF endpoints return a binary body, so they
// can't go through request() (which parses JSON) - fetchPdfBlob does the same auth + error handling for blobs.

// Fetches a PDF as a Blob. `path` is relative to /documents (e.g. `/${id}/pdf` or `/preview`).
export const fetchPdfBlob = async (path, { method = "GET", body, signal } = {}) => {
  const session = getSession();
  const response = await fetch(`${API_BASE}/documents${path}`, {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (response.status === 401 && session?.accessToken) {
      clearSession();
      window.dispatchEvent(new Event("gabla-session-expired"));
    }
    const error = new Error(failure?.error?.message || i18n.t("docs.lib.errPdf"));
    error.status = response.status;
    error.code = failure?.error?.code;
    throw error;
  }
  const blob = await response.blob();
  return blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
};

// Opens a PDF in a new tab. The tab is opened synchronously (inside the click) and pointed at the blob once it
// has loaded - that keeps pop-up blockers and iOS Safari happy. If the browser refuses the tab, it downloads.
export const openPdfWith = async (getBlob, filename = "document.pdf") => {
  const tab = window.open("", "_blank");
  if (tab) {
    try {
      tab.document.title = i18n.t("docs.lib.loadingPdf");
      tab.document.body.style.cssText = "margin:0;display:grid;place-items:center;min-height:100vh;font:15px system-ui,sans-serif;color:#475569";
      tab.document.body.textContent = i18n.t("docs.lib.preparingPdf");
    } catch {
      /* cross-origin guard - ignore */
    }
  }
  try {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (error) {
    if (tab && !tab.closed) tab.close();
    throw error;
  }
};

export const openPdf = (path, filename) => openPdfWith(() => fetchPdfBlob(path), filename);

export const openDocumentPdf = (doc) =>
  openPdf(`/${doc.id}/pdf`, `${doc.type === "receipt" ? "Receipt" : "Quotation"}-${doc.number}${doc.revision > 1 ? `-rev${doc.revision}` : ""}.pdf`);

// ---------------------------------------------------------------- thin API wrappers
export const getDocumentSettings = () => request("/documents/settings");

export const saveDocumentSettings = (settings) => request("/documents/settings", { method: "PUT", body: JSON.stringify(settings) });

export const fetchPreviewPdf = (type, settings, options = {}) => fetchPdfBlob("/preview", { method: "POST", body: { type, settings }, ...options });

export const listDocuments = ({ type, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  return request(`/documents?${params.toString()}`);
};

export const resendDocument = (documentId) => request(`/documents/${documentId}/resend`, { method: "POST", body: JSON.stringify({}) });

export const issueOrderQuotation = (orderId, payload) =>
  request(`/documents/orders/${orderId}/quotation`, { method: "POST", body: JSON.stringify(payload) });

// ---------------------------------------------------------------- presentation helpers
export const docTypeLabel = (type) => i18n.t(`docs.type.${type}`, { defaultValue: type || i18n.t("docs.type.document") });

// What an email status means, in words a seller understands. `tone` drives the chip colour.
export const emailStatusInfo = (status, emailedTo) => {
  const msg = (key, opts) => i18n.t(`docs.email.${key}`, opts);
  switch (status) {
    case "sent":
      return { tone: "ok", label: msg("sentLabel"), detail: emailedTo ? msg("sentTo", { email: emailedTo }) : msg("sentToBuyer") };
    case "not_configured":
      return { tone: "warn", label: msg("notConfiguredLabel"), short: msg("notConfiguredShort"), detail: msg("notConfiguredDetail") };
    case "no_recipient":
      return { tone: "warn", label: msg("noRecipientLabel"), short: msg("noRecipientShort"), detail: msg("noRecipientDetail") };
    case "rejected":
      return { tone: "bad", label: msg("rejectedLabel"), short: msg("rejectedShort"), detail: msg("rejectedDetail") };
    case "delivery_failed":
      return { tone: "bad", label: msg("failedLabel"), short: msg("failedShort"), detail: msg("failedDetail") };
    default:
      return { tone: "muted", label: msg("notSentLabel"), short: msg("notSentShort"), detail: msg("notSentDetail") };
  }
};

export const formatDocDate = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" }) : "";
};
