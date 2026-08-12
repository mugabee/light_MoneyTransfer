const express = require('express');

const router = express.Router();

const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// Simple in-memory cache so a page full of widgets doesn't hammer Binance.
const cache = new Map(); // fiat -> { data, fetchedAt }
const CACHE_TTL_MS = 30_000;

async function fetchSide(fiat, tradeType) {
  const res = await fetch(P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset: 'USDT',
      fiat,
      tradeType, // 'BUY' or 'SELL'
      page: 1,
      rows: 5,
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

  return adverts.map((a) => Number(a.adv.price)).filter((p) => Number.isFinite(p));
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
  const margin = Number(process.env.RATE_MARGIN_PERCENT || 2);

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

module.exports = { router, getP2pSummary };
