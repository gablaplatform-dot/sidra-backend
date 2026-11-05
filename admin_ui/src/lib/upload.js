import { apiRequest } from './api.js';

export const uploadFileToStorage = async ({ file, token, folder = 'category-images' }) => {
  if (!file) throw new Error('No file selected');

  const upload = await apiRequest('/storage/upload-url', {
    token,
    method: 'POST',
    body: JSON.stringify({
      contentType: file.type,
      folder,
      filename: file.name
    })
  });

  const putRes = await fetch(upload.uploadUrl, {
    method: upload.method || 'PUT',
    headers: upload.headers || { 'Content-Type': file.type },
    body: file
  });

  if (!putRes.ok) {
    throw new Error('Unable to upload file');
  }

  if (!upload.publicUrl) {
    throw new Error('R2 public URL is not configured');
  }

  await apiRequest('/storage/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({
      key: upload.key,
      url: upload.publicUrl,
      mimeType: file.type,
      size: file.size,
      kind: 'image',
      metadata: { scope: 'category' }
    })
  });

  return { key: upload.key, url: upload.publicUrl };
};
