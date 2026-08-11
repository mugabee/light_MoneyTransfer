const express = require('express');
const { db, logAudit } = require('../db');
const { getP2pSummary } = require('./rates');

const router = express.Router();

const GRAPH_API_VERSION = 'v20.0';

async function sendWhatsAppMessage(to, body) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('WhatsApp not configured — skipping outbound send:', body);
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('WhatsApp send failed:', res.status, detail);
  }
}

async function buildReply(text) {
  const lower = text.toLowerCase();
  const fiat = process.env.RATE_FIAT || 'RWF';
  const margin = Number(process.env.RATE_MARGIN_PERCENT || 2);

  if (/\b(rate|price|today)\b/.test(lower)) {
    try {
      const { mid } = await getP2pSummary(fiat);
      const clientRate = mid * (1 - margin / 100);
      return `Today's USDT to ${fiat} rate is ${clientRate.toFixed(2)} ${fiat} per USDT. Let us know how much you'd like to exchange.`;
    } catch {
      return "We're updating today's rate right now — one moment and we'll confirm the exact number with you.";
    }
  }

  if (/\b(how|work|process)\b/.test(lower)) {
    return "Here's how it works: 1) tell us the amount of USDT you're sending and the fiat currency you want, 2) we confirm today's rate, 3) you send the USDT, 4) we send the fiat to your account. Simple and fast.";
  }

  if (/\b(hi|hello|hey)\b/.test(lower)) {
    return 'Hello! This is our USDT-to-fiat exchange service. Ask us for today\'s rate any time, or let us know what you\'d like to exchange.';
  }

  return "Thanks for your message — one of our team will follow up shortly to help with your exchange.";
}

// Meta webhook verification handshake
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // ack immediately, Meta expects a fast response

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const from = message.from; // phone number, no '+'
    const text = message.text.body;

    let contact = db.prepare('SELECT * FROM contacts WHERE handle = ? AND channel = ?').get(from, 'whatsapp');
    if (!contact) {
      const result = db
        .prepare(
          `INSERT INTO contacts (name, channel, handle, source) VALUES (?, 'whatsapp', ?, 'WhatsApp inbound')`
        )
        .run(from, from);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
      logAudit('contact', contact.id, 'create', { source: 'WhatsApp inbound' });
    }

    const reply = await buildReply(text);
    await sendWhatsAppMessage(from, reply);
  } catch (err) {
    console.error('Error handling WhatsApp webhook:', err);
  }
});

module.exports = router;
