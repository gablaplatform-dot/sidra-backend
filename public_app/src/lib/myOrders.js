import { API_BASE } from "./api";
import { getSession } from "./session";

// PDFs sit behind the bearer token, so they can't be plain links: fetch the file with the token and show the blob.
// The tab is opened first (inside the click) so pop-up blockers allow it, then pointed at the PDF.
export const openDocumentPdf = async (documentId) => {
  const tab = window.open("", "_blank");
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/pdf`, {
      headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}
    });
    if (!res.ok) throw new Error("This document could not be opened.");
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
  pending: { label: "Order placed", tone: "amber", step: 0 },
  accepted: { label: "Accepted by seller", tone: "blue", step: 1 },
  fulfilled: { label: "Completed", tone: "green", step: 2 },
  rejected: { label: "Declined by seller", tone: "red", step: -1 },
  canceled: { label: "Cancelled", tone: "red", step: -1 }
};
