import { contactTable } from './contact-table.mjs';

const panel = document.querySelector('#archive-panel');
const button = document.querySelector('#archives');
const list = document.querySelector('#archive-list');
const status = document.querySelector('#archive-status');
const content = document.querySelector('#archive-content');
const more = document.querySelector('#archive-more');
const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'medium' });
let cursor;
let listRequest;
let fileRequest;

async function requestArchive(params, options = {}) {
  const url = new URL('/api/rehber', location.origin);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'manual',
  });
  if (response.type === 'opaqueredirect' || [401, 403].includes(response.status)) {
    throw new Error('Vercel oturumunu yenilemek için uygulama sayfasını yeniden aç.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Sunucu yanıt vermedi. Biraz sonra tekrar dene.');
  }
  return response;
}

export async function saveContacts(contacts) {
  await requestArchive({}, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Rehber-Import': '1' },
    body: contactTable(contacts),
  });
  if (!panel.hidden) void loadFiles();
}

export function resetArchive() {
  listRequest?.abort();
  fileRequest?.abort();
  list.replaceChildren();
  content.textContent = '';
  content.hidden = true;
  more.hidden = true;
  panel.hidden = true;
  status.textContent = '';
  button.setAttribute('aria-expanded', 'false');
  cursor = null;
}

async function openFile(file) {
  fileRequest?.abort();
  const request = new AbortController();
  fileRequest = request;
  content.textContent = 'Dosya açılıyor…';
  content.hidden = false;
  try {
    const response = await requestArchive({ file: file.id }, { signal: request.signal });
    const text = await response.text();
    if (!request.signal.aborted) {
      content.textContent = text;
      content.focus();
    }
  } catch (error) {
    if (!request.signal.aborted) content.textContent = error.message;
  }
}

async function loadFiles(append = false) {
  listRequest?.abort();
  const request = new AbortController();
  listRequest = request;
  if (!append) {
    fileRequest?.abort();
    list.replaceChildren();
    content.textContent = '';
    content.hidden = true;
    cursor = null;
  }
  status.textContent = 'Dosyalar yükleniyor…';
  more.hidden = true;
  try {
    const response = await requestArchive(cursor ? { cursor } : {}, { signal: request.signal });
    const result = await response.json();
    if (request.signal.aborted) return;
    for (const file of result.files) {
      const item = document.createElement('li');
      const open = document.createElement('button');
      open.className = 'quiet';
      open.type = 'button';
      open.textContent = 'Rehber · ' + dateFormat.format(new Date(file.uploadedAt)) + ' · .txt';
      open.addEventListener('click', () => void openFile(file));
      item.append(open);
      list.append(item);
    }
    cursor = result.cursor;
    status.textContent = list.childElementCount ? 'Açmak için bir dosyaya dokun.' : 'Henüz kayıtlı dosya yok.';
  } catch (error) {
    if (!request.signal.aborted) status.textContent = error.message;
  } finally {
    if (!request.signal.aborted) more.hidden = !cursor;
  }
}

button.addEventListener('click', () => {
  if (!panel.hidden) {
    resetArchive();
    return;
  }
  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  void loadFiles();
});
more.addEventListener('click', () => void loadFiles(true));
