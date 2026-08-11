# Ledger

A money transfer CRM with a live rate engine and WhatsApp integration. Built with Node.js, Express, and Postgres.

## What's included

- **Public site** (`/`) — landing page with a live currency converter (USDT, RWF, UGX, KES, TZS), how-it-works, FAQ, and WhatsApp/Telegram contact links
- **Staff dashboard** (`/dashboard.html`) — contacts and transaction history, tagged by channel (WhatsApp, Telegram, Instagram, Facebook, phone)
- **Rate engine** — live USDT buy/sell prices from Binance P2P, cached and exposed at `/api/rates/p2p?fiat=<code>`
- **WhatsApp auto-reply** (optional) — replies to incoming messages with today's rate, a how-it-works explanation, or a greeting, using the WhatsApp Cloud API. Every inbound number is logged as a contact automatically.
- **Audit log** — every write to contacts/transactions is recorded

The site is transparent with every customer about how transfers work — rates and the USDT conversion step are shown on the public page, not just internally.

## Local development

Requires a Postgres database. The free tier of [Neon](https://neon.tech) or [Supabase](https://supabase.com) both work — create a project, copy the connection string.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, RATE_FIAT, RATE_MARGIN_PERCENT, and WhatsApp credentials if using that feature
npm start
```

Tables are created automatically on startup if they don't already exist.

- Site: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard.html`
- WhatsApp webhook: `http://localhost:3000/whatsapp/webhook`

The site, dashboard, and rate API work as soon as `DATABASE_URL` is set. WhatsApp auto-reply additionally requires:

1. A verified Meta Business account
2. A WhatsApp Business phone number registered through Meta's dashboard → gives you `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
3. A public HTTPS URL for the webhook (use `ngrok` for local testing)

## Deployment

Configured for [Render](https://render.com) via `render.yaml`:

1. Create a free Postgres database (Neon or Supabase) and copy its connection string
2. Render → **New** → **Blueprint**, connect this repo
3. When prompted for env vars, paste the connection string into `DATABASE_URL`, and set the WhatsApp vars if using that feature

Render's free tier doesn't support persistent disks, which is why this runs on Postgres rather than the SQLite file used in early development — a hosted database keeps data intact across deploys and restarts on the free plan.

## API

| Route | Method | Description |
|---|---|---|
| `/api/contacts` | GET/POST | List / create contacts |
| `/api/contacts/:id` | GET/PUT/DELETE | Read / update / delete a contact |
| `/api/transactions` | GET/POST | List (optionally `?contact_id=`) / create transactions |
| `/api/transactions/:id` | DELETE | Delete a transaction |
| `/api/rates/p2p?fiat=RWF` | GET | Live Binance P2P best buy/sell/mid/margin-adjusted client rate for USDT |
| `/whatsapp/webhook` | GET/POST | Meta verification handshake / incoming message handler |

## Notes

- The Binance P2P endpoint used is public market data but not an officially documented API — it can change shape without notice. The rate route fails gracefully rather than crashing.
- No licensing/compliance work is built in. Money transfer and crypto-fiat conversion are regulated activities in most jurisdictions (MSB/MTO licensing, KYC/AML, reporting thresholds) — that's a decision and research task for the operator, separate from this software.
- No auth layer on the dashboard yet — treat it as trusted-access-only until one is added.

## Possible next features

- Login/auth for the dashboard
- CSV export/backup for the database
- "Quick add from P2P trade" shortcut
- Auto-post daily rate to a Telegram channel
- WhatsApp message templates for business-initiated messages (required outside the 24-hour customer service window)
