import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { blobConfig, maxBytes, saveArchive } from '../lib/archive.js';
import { contactRow, tableHeader } from '../public/contact-table.mjs';

const scope = 'https://www.googleapis.com/auth/contacts.readonly';
const cookieName = '__Host-rehber-google';
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const defaultCallback = 'https://rehber-pwa-demo.vercel.app/api/google-contacts';

function redirect(location, cookie) {
  const headers = { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}

function finish(result) {
  return redirect('/?google=' + result, cookieName + '=; Max-Age=0; ' + cookieAttributes);
}

function oauthCookie(request) {
  const token = request.headers.get('Cookie')?.split(';')
    .map(part => part.trim()).find(part => part.startsWith(cookieName + '='));
  const [state, verifier] = token?.slice(cookieName.length + 1).split('.') ?? [];
  return { state, verifier };
}

function validState(given, expected) {
  return /^[A-Za-z0-9_-]{43}$/.test(given || '')
    && /^[A-Za-z0-9_-]{43}$/.test(expected || '')
    && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function requestJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error('Google request failed');
  return response.json();
}

async function importContacts(accessToken, storage) {
  const endpoint = new URL('https://people.googleapis.com/v1/people/me/connections');
  endpoint.search = new URLSearchParams({
    personFields: 'names,phoneNumbers',
    sources: 'READ_SOURCE_TYPE_CONTACT',
    pageSize: '1000',
  });
  const rows = [];
  let size = Buffer.byteLength(tableHeader);
  let pageToken;
  do {
    if (pageToken) endpoint.searchParams.set('pageToken', pageToken);
    const data = await requestJson(endpoint, { headers: { Authorization: 'Bearer ' + accessToken } });
    for (const contact of data.connections ?? []) {
      const name = (contact.names?.find(item => item.metadata?.primary) ?? contact.names?.[0])?.displayName;
      const numbers = [...new Set((contact.phoneNumbers ?? []).map(phone => phone.value).filter(Boolean))];
      const row = contactRow({ name, numbers });
      size += Buffer.byteLength(row);
      if (size > maxBytes) return 'large';
      rows.push(row);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (!rows.length) return 'empty';
  await saveArchive(tableHeader + rows.join(''), storage);
  return 'saved';
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET;
    let callback;
    try {
      callback = new URL(process.env.GOOGLE_CONTACTS_REDIRECT_URI || defaultCallback);
    } catch {
      return finish('config');
    }
    const url = new URL(request.url);
    const storage = blobConfig();
    if (process.env.VERCEL !== '1' || !clientId || !clientSecret || !storage
      || callback.protocol !== 'https:' || url.origin !== callback.origin || url.pathname !== callback.pathname) {
      return finish('config');
    }

    const { searchParams } = url;
    if (!searchParams.has('code') && !searchParams.has('error') && !searchParams.has('state')) {
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(32).toString('base64url');
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.search = new URLSearchParams({
        client_id: clientId, redirect_uri: callback.href, response_type: 'code',
        scope, state, access_type: 'online',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
      });
      return redirect(authorize.href, cookieName + '=' + state + '.' + verifier + '; Max-Age=600; ' + cookieAttributes);
    }

    const { state, verifier } = oauthCookie(request);
    if (!validState(searchParams.get('state'), state) || !/^[A-Za-z0-9_-]{43}$/.test(verifier || '')) {
      return finish('invalid');
    }
    if (searchParams.has('error')) return finish('denied');
    if (!searchParams.get('code')) return finish('invalid');

    try {
      const token = await requestJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret, redirect_uri: callback.href,
          grant_type: 'authorization_code', code: searchParams.get('code'), code_verifier: verifier,
        }),
      });
      if (!token.scope?.split(' ').includes(scope) || !token.access_token) return finish('denied');
      return finish(await importContacts(token.access_token, storage));
    } catch {
      return finish('failed');
    }
  },
};
