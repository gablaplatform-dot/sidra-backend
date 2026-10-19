import { API_BASE } from "./api";
import { getSession } from "./session";
import i18n from "../i18n";

// PDFs sit behind the bearer token, so they can't be plain links: fetch the file with the token and show the blob.
// The tab is opened first (inside the click) so pop-up blockers allow it, then pointed at the PDF.
export const openDocumentPdf = async (documentId) => {
  const tab = window.open("", "_blank");
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/pdf`, {
      headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}
    });
    if (!res.ok) throw new Error(i18n.t("orders.docOpenFailed"));
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch (e) {
    if (tab) tab.close();
    throw e;
  }
};

export const ORDER_STATUS = {
  // Labels are shown via t(`orders.status.${key}`).
  pending: { tone: "amber", step: 0 },
  accepted: { tone: "blue", step: 1 },
  fulfilled: { tone: "green", step: 2 },
  rejected: { tone: "red", step: -1 },
  canceled: { tone: "red", step: -1 }
};
