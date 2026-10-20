import i18n from "../i18n";
import { request } from "./api";
import { isNativeApp } from "./google";

// `register: false` skips the media-library entry (only providers and admins may create those) -
// used for a shopper's profile photo, which just needs somewhere to live.
const TYPE_BY_EXTENSION = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4" };

// Phones report odd or empty types ("image/jpg", nothing at all for some gallery picks); map them to the
// ones the API accepts, falling back to the file extension.
const normalizeType = (file) => {
  const declared = String(file.type || "").toLowerCase();
  if (declared === "image/jpg" || declared === "image/pjpeg") return "image/jpeg";
  if (declared) return declared;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  return TYPE_BY_EXTENSION[ext] || "";
};

// `register: false` skips the media-library entry (only providers and admins may create those) -
// used for a shopper's profile photo, which just needs somewhere to live.
export const uploadFile = async (file, folder = "provider-media", { register = true } = {}) => {
  if (!file) throw new Error(i18n.t("errors.noFile"));
  const contentType = normalizeType(file);

  let key;
  let publicUrl;
  if (isNativeApp()) {
    // The bucket only allows the website's origin, so the app sends the file through the API instead.
    const query = new URLSearchParams({ folder, filename: file.name || "photo" });
    const sent = await request(`/storage/upload?${query}`, { method: "POST", body: file, headers: { "Content-Type": contentType } });
    ({ key, publicUrl } = sent);
  } else {
    const upload = await request("/storage/upload-url", {
      method: "POST",
      body: JSON.stringify({ contentType, folder, filename: file.name })
    });

    const putRes = await fetch(upload.uploadUrl, {
      method: upload.method || "PUT",
      headers: upload.headers || { "Content-Type": contentType },
      body: file
    });
    if (!putRes.ok) throw new Error(i18n.t("errors.uploadFailed"));
    ({ key, publicUrl } = upload);
  }
  if (!publicUrl) throw new Error(i18n.t("errors.storageNotConfigured"));

  if (!register) return publicUrl;

  await request("/storage/assets", {
    method: "POST",
    body: JSON.stringify({
      key,
      url: publicUrl,
      mimeType: contentType,
      size: file.size,
      kind: contentType.startsWith("video/") ? "video" : "image",
      metadata: { scope: folder }
    })
  });

  return publicUrl;
};
