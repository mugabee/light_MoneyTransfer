# Ledger

A CRM + live rate engine + WhatsApp auto-reply for a USDT-to-fiat exchange / transfer service. Runs entirely locally (Node.js + Express + SQLite) — no cloud dependency, data stays on your machine.

## What it does

- Tracks contacts across channels (WhatsApp, Telegram, Instagram, Facebook, phone) and their transaction history
- Pulls live USDT buy/sell prices from Binance P2P's public web endpoint and shows them in the dashboard, refreshed every 60s
- Optional WhatsApp Cloud API webhook: auto-replies to incoming messages with today's rate (computed from the P2P mid-price minus your configured margin), a how-it-works explanation, or a greeting; unmatched messages get a polite hold reply. Every inbound number is logged as a contact automatically.
- All writes to contacts/transactions are recorded in an `audit_log` table.

The service is presented the same way to every customer — it's a USDT-to-fiat exchange, and the WhatsApp replies say so.

## Setup

```bash
cd crm-app
npm install
cp .env.example .env      # fill in WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, RATE_FIAT, RATE_MARGIN_PERCENT
npm start
```

Dashboard: `http://localhost:3000`
WhatsApp webhook: `http://localhost:3000/whatsapp/webhook`

The dashboard and rate API work with no configuration. WhatsApp features require:

1. A verified Meta Business account (takes Meta a few days to review)
2. A WhatsApp Business phone number registered through Meta's dashboard → gives you `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
3. A public HTTPS URL for the webhook once live (use `ngrok` for local dev)

## API

| Route | Method | Description |
|---|---|---|
| `/api/contacts` | GET/POST | List / create contacts |
| `/api/contacts/:id` | GET/PUT/DELETE | Read / update / delete a contact |
| `/api/transactions` | GET/POST | List (optionally `?contact_id=`) / create transactions |
| `/api/transactions/:id` | DELETE | Delete a transaction |
| `/api/rates/p2p?fiat=RWF` | GET | Live Binance P2P best buy/sell/mid for USDT |
| `/whatsapp/webhook` | GET/POST | Meta verification handshake / incoming message handler |

## Notes

- The Binance P2P endpoint used (`p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`) is public market data but not an officially documented API — it can change shape without notice. The rate route fails gracefully (returns a clear error) rather than crashing.
- No licensing/compliance work is built in. Money transfer and crypto-fiat exchange are regulated activities in most jurisdictions (MSB/MTO licensing, KYC/AML, reporting thresholds) — that's a decision and research task for the operator, separate from this software.
- No auth layer on the dashboard yet — treat `localhost:3000` as trusted-machine-only until one is added.

## Possible next features

- Login/auth for the dashboard
- CSV export/backup for the SQLite database
- "Quick add from P2P trade" shortcut
- Auto-post daily rate to a Telegram channel
- WhatsApp message templates for business-initiated messages (required outside the 24-hour customer service window)
