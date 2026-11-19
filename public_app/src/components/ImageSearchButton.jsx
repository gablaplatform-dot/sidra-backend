import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { IconCamera } from "./icons";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Shrinks the photo before it goes up (search only needs to see what the item is) and always hands back a type the
// server accepts; phones can offer HEIC or huge originals.
const prepare = async (file, maxDim = 1024) => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) return blob;
  } catch {
    /* fall through to the original */
  }
  return ALLOWED.has(file.type) && file.size < 5 * 1024 * 1024 ? file : null;
};

// The camera button that sits at the end of a search field. Pick or take a photo and it comes back as a search phrase
// ("samsung smartphone"), which the field then searches like typed text: `onResult(query, intent)`.
export default function ImageSearchButton({ onResult, className = "" }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const photo = await prepare(file);
      if (!photo) throw new Error(t("imageSearch.errType"));
      const result = await request("/search/image", { method: "POST", body: photo, headers: { "Content-Type": photo.type || "image/jpeg" } });
      if (result?.query) onResult?.(result.query, result.intent || "");
      else setMessage(t("imageSearch.nothing"));
    } catch (error) {
      setMessage(error.message || t("imageSearch.errFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={`imgs-btn ${busy ? "is-busy" : ""} ${className}`.trim()} onClick={() => inputRef.current?.click()} disabled={busy} aria-label={t("imageSearch.label")} title={t("imageSearch.label")}>
        {busy ? <span className="imgs-spin" aria-hidden="true" /> : <IconCamera width={18} height={18} />}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
      {message ? createPortal(<div className="imgs-toast" role="status">{message}</div>, document.body) : null}
    </>
  );
}
