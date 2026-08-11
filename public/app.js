const contactsTableBody = document.querySelector('#contacts-table tbody');
const txTableBody = document.querySelector('#tx-table tbody');
const rateWidget = document.getElementById('rate-widget');

let contactsCache = [];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function loadRate() {
  try {
    const data = await api('/api/rates/p2p');
    rateWidget.textContent = `USDT/${data.fiat}  buy ${fmt(data.bestBuy)}  ·  sell ${fmt(data.bestSell)}`;
  } catch (err) {
    rateWidget.textContent = 'Rate unavailable';
  }
}

async function loadContacts() {
  contactsCache = await api('/api/contacts');
  contactsTableBody.innerHTML = contactsCache
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td><span class="tag">${escapeHtml(c.channel)}</span></td>
      <td>${escapeHtml(c.handle || '')}</td>
      <td>${escapeHtml(c.source || '')}</td>
      <td><button class="icon-btn" data-delete-contact="${c.id}">Delete</button></td>
    </tr>`
    )
    .join('');

  const contactSelect = document.querySelector('#tx-form select[name="contact_id"]');
  contactSelect.innerHTML = contactsCache
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join('');
}

async function loadTransactions() {
  const txs = await api('/api/transactions');
  const contactName = (id) => contactsCache.find((c) => c.id === id)?.name || `#${id}`;

  txTableBody.innerHTML = txs
    .map(
      (t) => `
    <tr>
      <td>${escapeHtml(contactName(t.contact_id))}</td>
      <td>${t.direction}</td>
      <td>${fmt(t.amount)}</td>
      <td>${escapeHtml(t.currency_from)}</td>
      <td>${escapeHtml(t.currency_to)}</td>
      <td>${fmt(t.rate)}</td>
      <td>${new Date(t.created_at).toLocaleString()}</td>
    </tr>`
    )
    .join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// --- Contact dialog ---
const contactDialog = document.getElementById('contact-dialog');
document.getElementById('new-contact-btn').addEventListener('click', () => contactDialog.showModal());
contactDialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => contactDialog.close()));

document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  await api('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(form)),
  });
  e.target.reset();
  contactDialog.close();
  await loadContacts();
  await loadTransactions();
});

// --- Transaction dialog ---
const txDialog = document.getElementById('tx-dialog');
document.getElementById('new-tx-btn').addEventListener('click', () => txDialog.showModal());
txDialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => txDialog.close()));

document.getElementById('tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form);
  payload.contact_id = Number(payload.contact_id);
  payload.amount = Number(payload.amount);
  payload.rate = Number(payload.rate);

  await api('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset();
  txDialog.close();
  await loadTransactions();
});

// --- Delete contact ---
contactsTableBody.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-delete-contact');
  if (!id) return;
  if (!confirm('Delete this contact and its transactions?')) return;
  await api(`/api/contacts/${id}`, { method: 'DELETE' });
  await loadContacts();
  await loadTransactions();
});

async function init() {
  await loadContacts();
  await loadTransactions();
  await loadRate();
  setInterval(loadRate, 60_000);
}

init();
