// Update these with real contact handles once accounts are set up.
const WHATSAPP_NUMBER = '250788954566'; // e.g. '15551234567' (digits only, no +)
const TELEGRAM_HANDLE = 'lightmt'; // e.g. 'yourhandle'

document.getElementById('whatsapp-link').href = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}`
  : '#';
document.getElementById('telegram-link').href = TELEGRAM_HANDLE
  ? `https://t.me/${TELEGRAM_HANDLE}`
  : '#';

function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Fiat currencies offered on the converter. Add/remove as you support more markets.
const FIAT_CURRENCIES = [
  { code: 'RWF', label: 'RWF — Rwandan Franc' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
];
const USDT = { code: 'USDT', label: 'USDT — Tether' };
const ALL_CURRENCIES = [USDT, ...FIAT_CURRENCIES];

const rateCache = new Map(); // fiat code -> { clientRate, mid, fetchedAt }
const RATE_TTL_MS = 60_000;

async function getClientRate(fiatCode) {
  const cached = rateCache.get(fiatCode);
  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached;

  const res = await fetch(`/api/rates/p2p?fiat=${fiatCode}`);
  if (!res.ok) throw new Error('rate unavailable');
  const data = await res.json();
  const entry = { clientRate: data.clientRate, mid: data.mid, fetchedAt: Date.now() };
  rateCache.set(fiatCode, entry);
  return entry;
}

const haveSelect = document.getElementById('have-currency');
const wantSelect = document.getElementById('want-currency');
const amountInput = document.getElementById('amount-input');
const resultOutput = document.getElementById('result-output');
const converterRateEl = document.getElementById('converter-rate');
const swapBtn = document.getElementById('swap-btn');

function populateSelect(select, defaultCode) {
  select.innerHTML = ALL_CURRENCIES.map(
    (c) => `<option value="${c.code}" ${c.code === defaultCode ? 'selected' : ''}>${c.label}</option>`
  ).join('');
}

populateSelect(haveSelect, 'USDT');
populateSelect(wantSelect, 'RWF');

async function runConversion() {
  const have = haveSelect.value;
  const want = wantSelect.value;
  const amount = Number(amountInput.value) || 0;

  if (have === want) {
    resultOutput.textContent = fmt(amount);
    converterRateEl.textContent = 'Pick two different currencies to see a rate.';
    return;
  }

  converterRateEl.textContent = 'Fetching live rate…';

  try {
    let result;
    let rateLine;

    if (have === 'USDT' && want !== 'USDT') {
      const { clientRate } = await getClientRate(want);
      result = amount * clientRate;
      rateLine = `1 USDT ≈ ${fmt(clientRate)} ${want}`;
    } else if (have !== 'USDT' && want === 'USDT') {
      const { clientRate } = await getClientRate(have);
      result = clientRate > 0 ? amount / clientRate : 0;
      rateLine = `1 USDT ≈ ${fmt(clientRate)} ${have}`;
    } else {
      // fiat -> fiat, routed through USDT
      const [haveRate, wantRate] = await Promise.all([getClientRate(have), getClientRate(want)]);
      const usdtAmount = haveRate.clientRate > 0 ? amount / haveRate.clientRate : 0;
      result = usdtAmount * wantRate.clientRate;
      rateLine = `1 ${have} ≈ ${fmt(wantRate.clientRate / haveRate.clientRate)} ${want}`;
    }

    resultOutput.textContent = fmt(result);
    converterRateEl.textContent = rateLine;
  } catch {
    resultOutput.textContent = '—';
    converterRateEl.textContent = "Live rate unavailable right now — message us for today's price.";
  }
}

amountInput.addEventListener('input', runConversion);
haveSelect.addEventListener('change', runConversion);
wantSelect.addEventListener('change', runConversion);

swapBtn.addEventListener('click', () => {
  const temp = haveSelect.value;
  haveSelect.value = wantSelect.value;
  wantSelect.value = temp;
  runConversion();
  swapBtn.classList.toggle('spin');
});

amountInput.value = 100;
runConversion();
setInterval(runConversion, 60_000);

// Hero banner: quick USDT -> default fiat glance
async function loadHeroRate() {
  const heroRate = document.getElementById('hero-rate');
  try {
    const { clientRate } = await getClientRate('RWF');
    heroRate.textContent = `Today: ~${fmt(clientRate)} RWF per USDT`;
  } catch {
    heroRate.textContent = "Rate updating — message us for today's exact price";
  }
}

loadHeroRate();
setInterval(loadHeroRate, 60_000);

// Reveal sections as they scroll into view
const revealTargets = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && revealTargets.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('in-view'));
}
