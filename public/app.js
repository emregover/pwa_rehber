import { parseVCard } from './vcard.mjs';
import { saveContacts, resetArchive } from './archive.mjs';

const importButton = document.querySelector('#import');
const fileInput = document.querySelector('#vcf');
const status = document.querySelector('#status');
const people = document.querySelector('#people');
const clear = document.querySelector('#clear');
const empty = document.querySelector('#empty');
const count = document.querySelector('#count');
const manual = document.querySelector('#manual');
const nameInput = document.querySelector('#name');
const phoneInput = document.querySelector('#phone');

const returnUrl = new URL(window.location.href);
const googleResult = returnUrl.searchParams.get('google');
if (googleResult !== null) {
  const messages = {
    saved: 'Google Kişiler arşive kaydedildi.',
    denied: 'Google Kişiler erişimine izin verilmedi.',
    empty: 'Google hesabında aktarılacak kişi bulunamadı.',
    config: 'Google Kişiler bağlantısı henüz yapılandırılmadı. VCF dosyasıyla aktarabilirsin.',
    invalid: 'Aktarım oturumu sona erdi. Google Kişiler’den yeniden aktar.',
    failed: 'Google Kişiler aktarılamadı. Tekrar dene.',
    large: 'Google Kişiler listesi arşiv boyutu sınırını aşıyor.',
  };
  status.textContent = Object.hasOwn(messages, googleResult) ? messages[googleResult] : '';
  returnUrl.searchParams.delete('google');
  window.history.replaceState(window.history.state, '', returnUrl);
  if (googleResult === 'saved') document.querySelector('#archives').click();
}

function updateResults() {
  const total = people.childElementCount;
  count.textContent = total;
  empty.hidden = total > 0;
  clear.hidden = total === 0;
}

function addContact(name, numbers, target = people) {
  const row = document.createElement('li');
  const contact = document.createElement('div');
  contact.className = 'contact';
  const title = document.createElement('strong');
  title.textContent = name || 'İsimsiz kişi';
  contact.append(title);
  for (const number of numbers.length ? numbers : ['Telefon numarası yok']) {
    const line = document.createElement('span');
    line.textContent = number;
    contact.append(line);
  }
  const remove = document.createElement('button');
  remove.className = 'quiet';
  remove.type = 'button';
  remove.textContent = 'Kaldır';
  remove.setAttribute('aria-label', (name || 'İsimsiz kişi') + ' kişisini kaldır');
  remove.addEventListener('click', () => {
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    updateResults();
    (next?.querySelector('button') || phoneInput).focus();
    status.textContent = 'Kişi kaldırıldı.';
  });
  row.append(contact, remove);
  target.append(row);
}

let pageGeneration = 0;
importButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const generation = pageGeneration;
  importButton.disabled = true;
  status.textContent = 'Rehber okunuyor…';
  try {
    const contents = await file.text();
    if (generation !== pageGeneration) return;
    const contacts = parseVCard(contents);
    if (contacts.length === 0) {
      status.textContent = 'Dosyada okunabilir kişi bulunamadı.';
      return;
    }
    const imported = document.createDocumentFragment();
    for (const { name, numbers } of contacts) {
      addContact(name, numbers, imported);
    }
    people.replaceChildren(imported);
    updateResults();
    status.textContent = 'Rehber sunucuya kaydediliyor…';
    try {
      await saveContacts(contacts);
      if (generation === pageGeneration) status.textContent = contacts.length + ' kişi sunucuya kaydedildi.';
    } catch (error) {
      if (generation === pageGeneration) status.textContent = 'Arşive kaydedilemedi. ' + error.message;
    }
  } catch {
    if (generation === pageGeneration) {
      status.textContent = 'Rehber dosyası okunamadı. .vcf dosyasını tekrar açmayı dene.';
    }
  } finally {
    fileInput.value = '';
    importButton.disabled = false;
  }
});

phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
manual.addEventListener('submit', event => {
  event.preventDefault();
  const number = phoneInput.value.trim();
  const digits = number.replace(/\D/g, '').length;
  if (!/^\+?[\d().\s-]+$/.test(number) || digits < 3 || digits > 15) {
    phoneInput.setCustomValidity('Geçerli bir telefon numarası gir.');
    phoneInput.reportValidity();
    return;
  }
  addContact(nameInput.value.trim(), [number]);
  manual.reset();
  updateResults();
  status.textContent = 'Kişi eklendi.';
  nameInput.focus();
});
clear.addEventListener('click', () => {
  people.replaceChildren();
  updateResults();
  phoneInput.focus();
  status.textContent = 'Kişi listesi temizlendi.';
});
window.addEventListener('pagehide', () => {
  pageGeneration++;
  resetArchive();
  people.replaceChildren();
  fileInput.value = '';
  manual.reset();
  phoneInput.setCustomValidity('');
  updateResults();
  status.textContent = '';
});

const install = document.querySelector('#install');
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  install.hidden = false;
});
install.addEventListener('click', async () => {
  const prompt = installPrompt;
  installPrompt = undefined;
  install.hidden = true;
  try {
    await prompt?.prompt();
  } catch {
    status.textContent = 'Uygulamayı tarayıcı menüsünden ana ekrana ekleyebilirsin.';
  }
});
window.addEventListener('appinstalled', () => { install.hidden = true; });
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
document.querySelector('#ios-install').hidden = !ios || navigator.standalone
  || window.matchMedia('(display-mode: standalone)').matches;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
