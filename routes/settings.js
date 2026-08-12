const express = require('express');
const { getSetting, setSetting, logAudit } = require('../db');
const { invalidateMarginCache } = require('./rates');

const router = express.Router();

router.get('/', async (req, res) => {
  const marginPercent = await getSetting('rate_margin_percent', process.env.RATE_MARGIN_PERCENT || '2');
  res.json({ rate_margin_percent: Number(marginPercent) });
});

router.put('/', async (req, res) => {
  const { rate_margin_percent } = req.body || {};
  const margin = Number(rate_margin_percent);

  if (!Number.isFinite(margin) || margin < 0 || margin > 25) {
    return res.status(400).json({ error: 'rate_margin_percent must be a number between 0 and 25' });
  }

  await setSetting('rate_margin_percent', margin);
  invalidateMarginCache();
  await logAudit('settings', 0, 'update', { rate_margin_percent: margin, by: req.admin?.sub });

  res.json({ rate_margin_percent: margin });
});

module.exports = router;
