import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconClose, IconImage } from "./icons";

// Phone photos are often 5-10 MB: shrink them (longest side 1280px, WebP or JPEG) before they go up - shoppers on a
// mobile connection load many of these at once. Anything that cannot be read as an image here (or is already small,
// a GIF, a video) is sent untouched.
const shrink = async (file, maxDim = 1280, quality = 0.8) => {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 250 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)); // Safari cannot write WebP
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.\w+$/, "") || "photo"}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
};

const acceptsFile = (file, accept) => file.type.startsWith("image/") || (file.type === "video/mp4" && accept.includes("video"));

// One picture (or one image/video): a tappable card that shows the picked photo straight away, then the uploaded one.
export function PhotoField({ value, kind = "image", onChange, upload, onError, accept = "image/*", aspect = "16 / 10", emptyLabel, hint }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [drag, setDrag] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    if (!acceptsFile(file, accept)) {
      onError?.(t("photo.errType"));
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const preview = URL.createObjectURL(file);
    setPending({ preview, kind: isVideo ? "video" : "image" });
    onError?.("");
    try {
      const url = await upload(isVideo ? file : await shrink(file));
      onChange(url, isVideo ? "video" : "image");
    } catch (error) {
      onError?.(error.message || t("photo.errUpload"));
    } finally {
      setPending(null);
      URL.revokeObjectURL(preview);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const shown = pending?.preview || value;
  const shownKind = pending?.kind || kind;
  const choose = () => !pending && inputRef.current?.click();

  return (
    <div
      className={`pf ${drag ? "is-drag" : ""} ${shown ? "has-media" : ""}`}
      style={{ aspectRatio: aspect }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
    >
      {shown ? (
        shownKind === "video" ? <video src={shown} muted playsInline loop autoPlay /> : <img src={shown} alt="" />
      ) : (
        <button type="button" className="pf-empty" onClick={choose}>
          <span className="pf-empty-icon"><IconImage /></span>
          <strong>{emptyLabel || t("photo.addCover")}</strong>
          <small>{hint || t("photo.hintCover")}</small>
        </button>
      )}
      {shown && !pending ? (
        <div className="pf-actions">
          <button type="button" onClick={choose}>{t("photo.change")}</button>
          <button type="button" className="pf-x" onClick={() => onChange("", "image")} aria-label={t("photo.remove")}><IconClose /></button>
        </div>
      ) : null}
      {pending ? <div className="pf-busy"><i aria-hidden="true" /> {t("photo.uploading")}</div> : null}
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}

// Several pictures: square thumbnails with a remove button and a "+" tile; picks can be several at once.
export function PhotoGrid({ values, onAdd, onRemove, upload, onError, max = 12 }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [pending, setPending] = useState([]);

  const handleFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, max - values.length));
    if (!list.length) {
      if (files?.length) onError?.(t("photo.errType"));
      return;
    }
    onError?.("");
    for (const file of list) {
      const id = `${Date.now()}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setPending((cur) => [...cur, { id, preview }]);
      try {
        onAdd(await upload(await shrink(file)));
      } catch (error) {
        onError?.(error.message || t("photo.errUpload"));
      } finally {
        setPending((cur) => cur.filter((p) => p.id !== id));
        URL.revokeObjectURL(preview);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="pg">
      {values.map((url) => (
        <div key={url} className="pg-item" style={{ backgroundImage: `url("${url}")` }}>
          <button type="button" className="pf-x" onClick={() => onRemove(url)} aria-label={t("photo.remove")}><IconClose /></button>
        </div>
      ))}
      {pending.map((p) => (
        <div key={p.id} className="pg-item is-pending" style={{ backgroundImage: `url("${p.preview}")` }}>
          <div className="pf-busy"><i aria-hidden="true" /></div>
        </div>
      ))}
      {values.length + pending.length < max ? (
        <button type="button" className="pg-add" onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">+</span>
          <small>{t("photo.addMore")}</small>
        </button>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
