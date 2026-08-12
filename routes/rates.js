const express = require('express');
const { getSetting } = require('../db');

const router = express.Router();

const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// Only quote off advertisers actually holding enough USDT to fill a
// meaningful trade. A thin ad with a great headline price but only a few
// dollars of surplusAmount isn't a rate anyone could actually transact at.
const MIN_VOLUME_USDT = Number(process.env.RATE_MIN_VOLUME_USDT || 700);

// Simple in-memory cache so a page full of widgets doesn't hammer Binance.
const cache = new Map(); // fiat -> { data, fetchedAt }
const CACHE_TTL_MS = 30_000;

// The margin is admin-adjustable from the dashboard (stored in the
// database) rather than fixed in an env var, so changing it doesn't need a
// redeploy. Cached briefly so every rate request doesn't hit the DB.
let marginCache = null; // { value, fetchedAt }
const MARGIN_CACHE_TTL_MS = 10_000;

async function getMarginPercent() {
  if (marginCache && Date.now() - marginCache.fetchedAt < MARGIN_CACHE_TTL_MS) {
    return marginCache.value;
  }
  const stored = await getSetting('rate_margin_percent', process.env.RATE_MARGIN_PERCENT || '2');
  const value = Number(stored);
  marginCache = { value, fetchedAt: Date.now() };
  return value;
}

async function fetchSide(fiat, tradeType) {
  const res = await fetch(P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset: 'USDT',
      fiat,
      tradeType, // 'BUY' or 'SELL'
      page: 1,
      rows: 20, // wider pool so filtering by volume still leaves candidates
      payTypes: [],
      publisherType: null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Binance P2P responded ${res.status}`);
  }

  const json = await res.json();
  const adverts = json?.data ?? [];
  if (!adverts.length) {
    throw new Error('No P2P adverts returned for this fiat/side');
  }

  const wellFunded = adverts.filter(
    (a) => Number(a.adv.surplusAmount) >= MIN_VOLUME_USDT
  );
  // Fall back to the full pool if nobody in this market currently holds
  // that much — better to quote a real (thinner) rate than to error out.
  const pool = wellFunded.length ? wellFunded : adverts;

  return pool.map((a) => Number(a.adv.price)).filter((p) => Number.isFinite(p));
}

async function getP2pSummary(fiat) {
  const cached = cache.get(fiat);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const [buyPrices, sellPrices] = await Promise.all([
    fetchSide(fiat, 'BUY'),
    fetchSide(fiat, 'SELL'),
  ]);

  // From the taker's perspective: best "buy" advert price is the best price
  // a client selling USDT would receive; best "sell" advert price is what a
  // client buying USDT would pay. We surface both sides plus a midpoint.
  const bestBuy = Math.min(...buyPrices);
  const bestSell = Math.max(...sellPrices);
  const mid = (bestBuy + bestSell) / 2;

  const data = { fiat, bestBuy, bestSell, mid, fetchedAt: new Date().toISOString() };
  cache.set(fiat, { data, fetchedAt: Date.now() });
  return data;
}

router.get('/p2p', async (req, res) => {
  const fiat = (req.query.fiat || process.env.RATE_FIAT || 'RWF').toUpperCase();
  const margin = await getMarginPercent();

  try {
    const summary = await getP2pSummary(fiat);
    // clientRate/buyRate: what we pay when a customer sells us this currency.
    // sellRate: what a customer pays when buying this currency from us.
    // Symmetric spread around the market mid, sized by RATE_MARGIN_PERCENT.
    const buyRate = summary.mid * (1 - margin / 100);
    const sellRate = summary.mid * (1 + margin / 100);
    res.json({ ...summary, margin, clientRate: buyRate, buyRate, sellRate });
  } catch (err) {
    // Binance's internal endpoint is undocumented and can change shape
    // without notice — fail clearly instead of crashing the process.
    res.status(502).json({
      error: 'Unable to fetch live P2P rates right now',
      detail: err.message,
    });
  }
});

// Clears the cached margin immediately after an admin updates it, so the
// change is reflected on the very next request instead of waiting out the
// cache TTL.
function invalidateMarginCache() {
  marginCache = null;
}

module.exports = { router, getP2pSummary, getMarginPercent, invalidateMarginCache };
