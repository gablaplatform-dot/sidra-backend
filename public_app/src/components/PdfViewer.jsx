import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconClose } from "./icons";

export const OPEN_PDF_EVENT = "gabla-open-pdf";

// In-app PDF reader. The Android/iOS web view can't show a PDF in a tab, so quotations and receipts are drawn here
// with pdf.js (loaded only when a PDF is actually opened). Opened through openPdfWith() in lib/documents.js.
export default function PdfViewer() {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null); // { blob: Promise<Blob>, title }
  const [state, setState] = useState("idle"); // loading | ready | error
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const docRef = useRef(null);
  const bodyRef = useRef(null);
  const canvases = useRef([]);

  useEffect(() => {
    const onOpen = (event) => {
      setRequest(event.detail);
      setState("loading");
      setPages(0);
      setZoom(1);
    };
    window.addEventListener(OPEN_PDF_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PDF_EVENT, onOpen);
  }, []);

  // Load the document whenever a new request arrives.
  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [blob, pdfjs, worker] = await Promise.all([
          request.blob,
          import("pdfjs-dist/legacy/build/pdf.min.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker")
        ]);
        // Bundled as a .js worker (a .mjs file is not always served as JavaScript by the app's local web server).
        if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new worker.default();
        const data = new Uint8Array(await blob.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setPages(doc.numPages);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [request]);

  // Draw every page at the current zoom (sharp on high-density screens).
  useEffect(() => {
    const doc = docRef.current;
    if (state !== "ready" || !doc || !bodyRef.current) return undefined;
    let cancelled = false;
    const cssWidth = Math.max(240, bodyRef.current.clientWidth - 24) * zoom;
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    (async () => {
      for (let n = 1; n <= doc.numPages; n += 1) {
        if (cancelled) return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
        const canvas = canvases.current[n - 1];
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${(viewport.height / ratio).toFixed(1)}px`;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state, pages, zoom]);

  useEffect(() => {
    if (!request) return undefined;
    const onKey = (event) => event.key === "Escape" && setRequest(null);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [request]);

  if (!request) return null;
  const step = (delta) => setZoom((z) => Math.min(3, Math.max(0.75, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="pdfv" role="dialog" aria-modal="true" aria-label={request.title}>
      <header className="pdfv-bar">
        <strong>{request.title}</strong>
        <div className="pdfv-tools">
          <button type="button" onClick={() => step(-0.25)} disabled={state !== "ready" || zoom <= 0.75} aria-label={t("docs.viewer.zoomOut")}>−</button>
          <button type="button" onClick={() => step(0.25)} disabled={state !== "ready" || zoom >= 3} aria-label={t("docs.viewer.zoomIn")}>+</button>
          <button type="button" className="pdfv-close" onClick={() => setRequest(null)} aria-label={t("docs.viewer.close")}><IconClose /></button>
        </div>
      </header>
      <div className="pdfv-body" ref={bodyRef}>
        {state === "loading" ? <p className="pdfv-note">{t("docs.viewer.loading")}</p> : null}
        {state === "error" ? <p className="pdfv-note pdfv-error">{t("docs.viewer.error")}</p> : null}
        {state === "ready" ? (
          <div className="pdfv-pages">
            {Array.from({ length: pages }, (_, i) => (
              <canvas key={i} ref={(el) => { canvases.current[i] = el; }} className="pdfv-page" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
