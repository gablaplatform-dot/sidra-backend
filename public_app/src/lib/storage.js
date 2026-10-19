import i18n from "../i18n";
import { request } from "./api";

// `register: false` skips the media-library entry (only providers and admins may create those) -
// used for a shopper's profile photo, which just needs somewhere to live.
export const uploadFile = async (file, folder = "provider-media", { register = true } = {}) => {
  if (!file) throw new Error(i18n.t("errors.noFile"));

  const upload = await request("/storage/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, folder, filename: file.name })
  });

  const putRes = await fetch(upload.uploadUrl, {
    method: upload.method || "PUT",
    headers: upload.headers || { "Content-Type": file.type },
    body: file
  });
  if (!putRes.ok) throw new Error(i18n.t("errors.uploadFailed"));
  if (!upload.publicUrl) throw new Error(i18n.t("errors.storageNotConfigured"));

  if (!register) return upload.publicUrl;

  await request("/storage/assets", {
    method: "POST",
    body: JSON.stringify({
      key: upload.key,
      url: upload.publicUrl,
      mimeType: file.type,
      size: file.size,
      kind: file.type?.startsWith("video/") ? "video" : "image",
      metadata: { scope: folder }
    })
  });

  return upload.publicUrl;
};
