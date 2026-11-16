import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { get, list, put } from '@vercel/blob';

const prefix = 'rehber-arsivi/';
const filePattern = /^\d{13}-[a-f0-9-]{36}[.]txt$/;
const maxBytes = 4_000_000;
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

function json(value, status = 200) {
  return Response.json(value, { status, headers });
}

function authorized(request, secret) {
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(request.headers.get('Authorization') || ''), digest('Bearer ' + secret));
}

function filename(pathname) {
  return pathname.slice(prefix.length);
}

export default {
  async fetch(request) {
    const secret = process.env.REHBER_ERISIM_ANAHTARI;
    if (!secret || secret.length < 24) {
      return json({ error: 'Sunucu erişim anahtarı henüz yapılandırılmamış.' }, 503);
    }
    if (!authorized(request, secret)) {
      return json({ error: 'Arşiv erişim anahtarı eksik veya yanlış.' }, 401);
    }
    const storeId = process.env.REHBER2026QZAWXSECDRVF99_STORE_ID?.trim()
      || process.env.BLOB_STORE_ID?.trim();
    if (!storeId && !process.env.BLOB_READ_WRITE_TOKEN) {
      return json({ error: 'Özel dosya depolaması henüz bağlanmamış.' }, 503);
    }
    const params = new URL(request.url).searchParams;
    try {
      if (request.method === 'POST') {
        if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'text/plain') {
          return json({ error: 'Düz metin gönderilmesi gerekiyor.' }, 415);
        }
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > maxBytes) return json({ error: 'Rehber metni 4 MB sınırını aşıyor.' }, 413);
        const content = new TextDecoder().decode(bytes);
        if (!content.trim()) return json({ error: 'Kaydedilecek rehber boş.' }, 400);

        const sortableTime = String(9_999_999_999_999 - Date.now()).padStart(13, '0');
        const pathname = prefix + sortableTime + '-' + randomUUID() + '.txt';
        const blob = await put(pathname, content, {
          storeId,
          access: 'private',
          contentType: 'text/plain; charset=utf-8',
        });
        return json({ id: filename(blob.pathname) }, 201);
      }

      if (request.method === 'GET') {
        const id = params.get('file');
        if (id !== null) {
          if (!filePattern.test(id)) return json({ error: 'Geçersiz dosya kimliği.' }, 400);
          const result = await get(prefix + id, { storeId, access: 'private', useCache: false });
          if (result?.statusCode !== 200) return json({ error: 'Dosya bulunamadı.' }, 404);
          return new Response(result.stream, {
            headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
        const { blobs, hasMore, cursor } = await list({
          storeId,
          prefix,
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
