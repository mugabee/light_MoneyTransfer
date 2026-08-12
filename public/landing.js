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
// Native <select><option> elements can't render images/SVG (a browser
// limitation, not fixable with CSS), so these stay plain text — the SVG flag
// icons are used everywhere else (ticker, orbit nodes, rate text).
const FIAT_CURRENCIES = [
  { code: 'RWF', label: 'RWF — Rwandan Franc' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
];
const USDT = { code: 'USDT', label: 'USDT — Tether' };
const ALL_CURRENCIES = [USDT, ...FIAT_CURRENCIES];

// Maps a currency code to its <symbol> id in the inline SVG sprite at the
// top of index.html.
const FLAG_SYMBOLS = {
  USDT: 'flag-usdt',
  RWF: 'flag-rw',
  UGX: 'flag-ug',
  KES: 'flag-ke',
  TZS: 'flag-tz',
  ZAR: 'flag-za',
  NGN: 'flag-ng',
  GHS: 'flag-gh',
  USD: 'flag-us',
  EUR: 'flag-eu',
  GBP: 'flag-gb',
  INR: 'flag-in',
  CNY: 'flag-cn',
  AED: 'flag-ae',
  CAD: 'flag-ca',
  AUD: 'flag-au',
};

function withFlag(code) {
  const symbol = FLAG_SYMBOLS[code];
  const icon = symbol ? `<svg class="flag-icon"><use href="#${symbol}"/></svg> ` : '';
  return `${icon}${code}`;
}

const rateCache = new Map(); // fiat code -> { clientRate, buyRate, sellRate, mid, fetchedAt }
const RATE_TTL_MS = 60_000;

async function getClientRate(fiatCode) {
  const cached = rateCache.get(fiatCode);
  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached;

  const res = await fetch(`/api/rates/p2p?fiat=${fiatCode}`);
  if (!res.ok) throw new Error('rate unavailable');
  const data = await res.json();
  const entry = {
    clientRate: data.clientRate,
    buyRate: data.buyRate,
    sellRate: data.sellRate,
    mid: data.mid,
    margin: data.margin,
    fetchedAt: Date.now(),
  };
  rateCache.set(fiatCode, entry);
  return entry;
}

const haveSelect = document.getElementById('have-currency');
const wantSelect = document.getElementById('want-currency');
const haveFlag = document.getElementById('have-flag');
const wantFlag = document.getElementById('want-flag');
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

// The <select> itself can't show a flag (native option elements are
// text-only), so a separate <svg><use> icon next to it tracks the
// current selection instead.
function syncFlag(select, iconEl) {
  const symbol = FLAG_SYMBOLS[select.value];
  if (symbol && iconEl) iconEl.querySelector('use').setAttribute('href', `#${symbol}`);
}

syncFlag(haveSelect, haveFlag);
syncFlag(wantSelect, wantFlag);

async function runConversion() {
  const have = haveSelect.value;
  const want = wantSelect.value;
  const amount = Number(amountInput.value) || 0;

  if (have === want) {
    resultOutput.textContent = fmt(amount);
    converterRateEl.innerHTML = 'Pick two different currencies to see a rate.';
    return;
  }

  converterRateEl.innerHTML = 'Fetching live rate…';

  try {
    let result;
    let rateLine;

    if (have === 'USDT' && want !== 'USDT') {
      const { clientRate } = await getClientRate(want);
      result = amount * clientRate;
      rateLine = `1 ${withFlag('USDT')} ≈ ${fmt(clientRate)} ${withFlag(want)}`;
    } else if (have !== 'USDT' && want === 'USDT') {
      const { clientRate } = await getClientRate(have);
      result = clientRate > 0 ? amount / clientRate : 0;
      rateLine = `1 ${withFlag('USDT')} ≈ ${fmt(clientRate)} ${withFlag(have)}`;
    } else {
      // fiat -> fiat, routed through USDT
      const [haveRate, wantRate] = await Promise.all([getClientRate(have), getClientRate(want)]);
      const usdtAmount = haveRate.clientRate > 0 ? amount / haveRate.clientRate : 0;
      result = usdtAmount * wantRate.clientRate;
      rateLine = `1 ${withFlag(have)} ≈ ${fmt(wantRate.clientRate / haveRate.clientRate)} ${withFlag(want)}`;
    }

    resultOutput.textContent = fmt(result);
    converterRateEl.innerHTML = rateLine;
    flash(resultOutput);
  } catch {
    resultOutput.textContent = '—';
    converterRateEl.innerHTML = "Live rate unavailable right now — message us for today's price.";
  }
}

function flash(el) {
  el.classList.remove('flash');
  // force reflow so the animation restarts even on rapid updates
  void el.offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 600);
}

amountInput.addEventListener('input', runConversion);
haveSelect.addEventListener('change', () => {
  syncFlag(haveSelect, haveFlag);
  runConversion();
});
wantSelect.addEventListener('change', () => {
  syncFlag(wantSelect, wantFlag);
  runConversion();
});

swapBtn.addEventListener('click', () => {
  const temp = haveSelect.value;
  haveSelect.value = wantSelect.value;
  wantSelect.value = temp;
  syncFlag(haveSelect, haveFlag);
  syncFlag(wantSelect, wantFlag);
  runConversion();
  swapBtn.classList.toggle('spin');
});

document.querySelectorAll('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    amountInput.value = btn.dataset.amount;
    runConversion();
  });
});

amountInput.value = 100;
runConversion();
setInterval(runConversion, 60_000);

// Hero banner: quick USDT -> default fiat glance
let heroRateLoadedOnce = false;

async function loadHeroRate() {
  const heroRate = document.getElementById('hero-rate');
  try {
    const { clientRate } = await getClientRate('RWF');
    const suffix = `${withFlag('RWF')} per ${withFlag('USDT')}`;
    if (!heroRateLoadedOnce) {
      heroRateLoadedOnce = true;
      await countUp(heroRate, clientRate, suffix);
    } else {
      heroRate.innerHTML = `Today: ~${fmt(clientRate)} ${suffix}`;
      flash(heroRate);
    }
  } catch {
    heroRate.innerHTML = "Rate updating — message us for today's exact price";
  }
}

// Animate the hero rate counting up from 0 on first load.
function countUp(el, target, suffix) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.innerHTML = `Today: ~${fmt(target)} ${suffix}`;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const duration = 900;
    const start = performance.now();

    // Safety net: if rAF never fires (backgrounded tab, throttled browser),
    // don't leave the rate stuck on "Loading…" forever.
    const fallback = setTimeout(() => {
      el.innerHTML = `Today: ~${fmt(target)} ${suffix}`;
      resolve();
    }, duration + 500);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.innerHTML = `Today: ~${fmt(target * eased)} ${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        clearTimeout(fallback);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

loadHeroRate();
setInterval(loadHeroRate, 60_000);

// Rates board: forex-bureau-style buy/sell table, quoted against RWF.
// USD listed first since RWF and USD are the primary currencies at launch.
const BOARD_CURRENCIES = [
  'USD', 'UGX', 'KES', 'TZS', 'ZAR', 'NGN', 'GHS',
  'EUR', 'GBP', 'INR', 'CNY', 'AED', 'CAD', 'AUD',
];
const boardTbody = document.getElementById('board-tbody');

async function loadRatesBoard() {
  if (!boardTbody) return;

  // /api/rates/p2p?fiat=X returns the price of 1 USDT in X — not a rate
  // against RWF. Bridge every currency through USDT's raw mid price, then
  // apply our margin once on the resulting RWF cross rate (applying it
  // separately on each leg would double-count the spread).
  let rwf;
  try {
    rwf = await getClientRate('RWF');
  } catch {
    boardTbody.innerHTML = `<tr><td colspan="3" class="board-unavailable">Rates unavailable right now</td></tr>`;
    return;
  }

  const rows = await Promise.all(
    BOARD_CURRENCIES.map(async (code) => {
      try {
        const x = await getClientRate(code);
        const crossMid = rwf.mid / x.mid; // RWF per 1 unit of `code`
        const margin = rwf.margin ?? 2;
        const buyRate = crossMid * (1 - margin / 100);
        const sellRate = crossMid * (1 + margin / 100);
        return { code, buyRate, sellRate, ok: true };
      } catch {
        return { code, ok: false };
      }
    })
  );

  boardTbody.innerHTML = rows
    .map((r) =>
      r.ok
        ? `<tr>
             <td class="board-currency">${withFlag(r.code)}</td>
             <td>${fmt(r.buyRate)} RWF</td>
             <td>${fmt(r.sellRate)} RWF</td>
           </tr>`
        : `<tr>
             <td class="board-currency">${withFlag(r.code)}</td>
             <td colspan="2" class="board-unavailable">Rate unavailable</td>
           </tr>`
    )
    .join('');
}

loadRatesBoard();
setInterval(loadRatesBoard, 60_000);

// Scroll-driven chrome: progress bar, header shadow, subtle background parallax
const scrollProgress = document.getElementById('scroll-progress');
const siteHeader = document.getElementById('site-header');
const bgFx = document.getElementById('bg-fx');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Timeout-based throttle rather than rAF-only, so this keeps working even in
// contexts where rAF is heavily throttled or never fires (backgrounded tabs).
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  setTimeout(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    if (scrollProgress) scrollProgress.style.width = `${progress}%`;
    if (siteHeader) siteHeader.classList.toggle('scrolled', scrollTop > 8);
    if (bgFx && !reduceMotion) bgFx.style.transform = `translateY(${scrollTop * 0.08}px)`;

    ticking = false;
  }, 16);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

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
