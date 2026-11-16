import { get, list } from '@vercel/blob';
import { archivePrefix, blobConfig, filename, maxBytes, saveArchive } from '../lib/archive.js';
const filePattern = /^\d{13}-[a-f0-9-]{36}[.]txt$/;
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

function json(value, status = 200) {
  return Response.json(value, { status, headers });
}

export default {
  async fetch(request) {
    // Vercel Authentication (All Deployments) authorizes visitors before this function runs.
    if (process.env.VERCEL !== '1') {
      return json({ error: 'Rehber arşivi korumalı Vercel yayınında kullanılabilir.' }, 503);
    }
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return json({ error: 'Arşiv isteği uygulama içinden yapılmalı.' }, 403);
    }
    const storage = blobConfig();
    if (!storage) return json({ error: 'Özel dosya depolaması henüz bağlanmamış.' }, 503);
    const params = new URL(request.url).searchParams;
    try {
      if (request.method === 'POST') {
        if (request.headers.get('X-Rehber-Import') !== '1') {
          return json({ error: 'Aktarım uygulama içinden başlatılmalı.' }, 403);
        }
        if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'text/plain') {
          return json({ error: 'Düz metin gönderilmesi gerekiyor.' }, 415);
        }
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > maxBytes) return json({ error: 'Rehber metni 4 MB sınırını aşıyor.' }, 413);
        const content = new TextDecoder().decode(bytes);
        if (!content.trim()) return json({ error: 'Kaydedilecek rehber boş.' }, 400);

        return json({ id: await saveArchive(content, storage) }, 201);
      }

      if (request.method === 'GET') {
        const id = params.get('file');
        if (id !== null) {
          if (!filePattern.test(id)) return json({ error: 'Geçersiz dosya kimliği.' }, 400);
          const result = await get(archivePrefix + id, { ...storage, access: 'private', useCache: false });
          if (result?.statusCode !== 200) return json({ error: 'Dosya bulunamadı.' }, 404);
          return new Response(result.stream, {
            headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
        const { blobs, hasMore, cursor } = await list({
          ...storage,
          prefix: archivePrefix,
          limit: 50,
          cursor: params.get('cursor') || undefined,
        });
        const files = blobs.map(blob => ({
          id: filename(blob.pathname),
          uploadedAt: blob.uploadedAt.toISOString(),
        }));
        return json({ files, cursor: hasMore ? cursor : null });
      }

      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
    } catch (error) {
      console.error('Rehber arşivi işlemi başarısız', error?.name);
      return json({ error: 'Arşive erişilemedi. Biraz sonra tekrar dene.' }, 502);
    }
  },
};
