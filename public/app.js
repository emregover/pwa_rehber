const pick = document.querySelector('#pick');
const support = document.querySelector('#support');
const status = document.querySelector('#status');
const people = document.querySelector('#people');
const clear = document.querySelector('#clear');
const empty = document.querySelector('#empty');
const count = document.querySelector('#count');
const manual = document.querySelector('#manual');
const nameInput = document.querySelector('#name');
const phoneInput = document.querySelector('#phone');

function updateResults() {
  const total = people.childElementCount;
  count.textContent = total;
  empty.hidden = total > 0;
  clear.hidden = total === 0;
}

function addContact(name, numbers) {
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
  people.append(row);
}

async function configurePicker() {
  let fields;
  try {
    if (window.isSecureContext && typeof navigator.contacts?.select === 'function') {
      const supported = await navigator.contacts.getProperties();
      if (supported.includes('tel')) fields = ['name', 'tel'].filter(field => supported.includes(field));
    }
  } catch {
    // Manual entry is available when the browser cannot provide a picker.
  }
  if (!fields) {
    support.textContent = 'Bu tarayıcıda rehber seçici kullanılamıyor. Aşağıdan elle ekleyebilirsin.';
    return;
  }
  pick.disabled = false;
  support.textContent = 'Bir veya birden fazla kişiyi seçebilirsin.';
  pick.addEventListener('click', async () => {
    status.textContent = '';
    pick.disabled = true;
    try {
      const contacts = await navigator.contacts.select(fields, { multiple: true });
      for (const contact of contacts) {
        addContact(contact.name?.[0], (contact.tel ?? []).filter(Boolean));
      }
      updateResults();
      status.textContent = contacts.length ? contacts.length + ' kişi eklendi.' : 'Kişi seçilmedi.';
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? 'Kişi seçimi iptal edildi.'
        : 'Rehber açılmadı. Aşağıdan elle ekleyebilirsin.';
    } finally {
      pick.disabled = false;
    }
  });
}

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
  people.replaceChildren();
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

void configurePicker();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
