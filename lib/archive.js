import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

export const archivePrefix = 'rehber-arsivi/';
export const maxBytes = 4_000_000;

export function blobConfig() {
  const storeId = process.env.REHBER2026QZAWXSECDRVF99_STORE_ID?.trim()
    || process.env.BLOB_STORE_ID?.trim();
  return storeId || process.env.BLOB_READ_WRITE_TOKEN ? { storeId } : null;
}

export function filename(pathname) {
  return pathname.slice(archivePrefix.length);
}

export async function saveArchive(content, storage) {
  const sortableTime = String(9_999_999_999_999 - Date.now()).padStart(13, '0');
  const pathname = archivePrefix + sortableTime + '-' + randomUUID() + '.txt';
  const blob = await put(pathname, content, {
    ...storage,
    access: 'private',
    contentType: 'text/plain; charset=utf-8',
  });
  return filename(blob.pathname);
}
