import { request } from "./api";

export const uploadFile = async (file, folder = "provider-media") => {
  if (!file) throw new Error("No file selected");

  const upload = await request("/storage/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, folder, filename: file.name })
  });

  const putRes = await fetch(upload.uploadUrl, {
    method: upload.method || "PUT",
    headers: upload.headers || { "Content-Type": file.type },
    body: file
  });
  if (!putRes.ok) throw new Error("Unable to upload file");
  if (!upload.publicUrl) throw new Error("Storage is not configured");

  await request("/storage/assets", {
    method: "POST",
    body: JSON.stringify({
      key: upload.key,
      url: upload.publicUrl,
      mimeType: file.type,
      size: file.size,
      kind: "image",
      metadata: { scope: folder }
    })
  });

  return upload.publicUrl;
};
