# Ledger

**Live app:** [lightmt.com](https://lightmt.com)

Ledger is the platform behind Light Money Transfer: a public site where customers get live exchange rates and send money in a few clicks, and a staff CRM behind it for managing contacts and transaction history. Node.js, Express, and Postgres, deployed on Render. The database schema provisions itself on first boot, so there's no migration step to run.

## Why it's built this way

Small money-transfer operations usually run on a spreadsheet and word-of-mouth rates, or a website quoting numbers someone typed in by hand and forgot to update. Ledger pulls quotes from live market data instead, refreshed continuously, so the number on the screen is the number the market is actually giving. It covers sixteen currencies across Africa, the Americas, Europe, and Asia, with a rates board that lets a customer compare any pair, not just against the home currency. And it's built to behave like production software should — responsive on mobile, an audit log on every staff write, and it degrades gracefully instead of falling over when the upstream rate source hiccups.

## What's included

**Public site**
An animated hero with a live currency network visualization, a "you send / recipient gets" converter with quick-amount presets and instant swap, and a forex-bureau-style rates board with a searchable currency picker. FAQ, how-it-works, direct WhatsApp/Telegram contact links, plus the basics a real site needs: a proper 404 page, security headers, sitemap and robots.txt, and terms/privacy pages.

**Staff dashboard**
Login-gated behind a JWT session in an httpOnly cookie — `/dashboard.html`, `/api/contacts`, and `/api/transactions` all redirect to `/login.html` for anyone unauthenticated. Contacts are tagged by channel (WhatsApp, Telegram, Instagram, Facebook, phone), each with full transaction history. A rate settings panel lets the admin adjust the margin percentage live from the browser — no redeploy, no code change. Every write is recorded to an audit log.

**Rate engine**
Buy/sell/mid pricing sourced from live P2P market data, cached server-side. It only quotes off advertisers holding enough volume to actually fill a trade — a thin ad with a great headline price doesn't get to set the rate. The margin itself lives in the database rather than an env var, so when the admin changes it from the dashboard, it applies immediately and everywhere: the site, the WhatsApp bot, and the rates board all read the same value, with no drift between what different parts of the app quote. Cross-currency rates route through a common bridge asset, and precision scales to the value of the currency so a sub-cent rate doesn't silently round to zero.

**WhatsApp integration**
Auto-replies to incoming messages with today's rate, a how-it-works explanation, or a greeting, via the WhatsApp Cloud API. Every inbound number gets logged as a contact automatically.

## Tech stack

Node.js and Express for the backend — simple, well-understood, deployable anywhere. Postgres for persistence, portable to any host. Vanilla HTML/CSS/JS on the frontend, no build step, no framework overhead. Hosted on Render, auto-deploying on every push to `main`. No dependency made it in that the product didn't actually need.

## Local development

Requires a Postgres database — the free tier of [Neon](https://neon.tech) or [Supabase](https://supabase.com) both work. Create a project, copy the connection string.

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL` in `.env`, then set up admin login. Nothing here is sent anywhere — the hash is generated locally:

```bash
node scripts/hash-password.js "your-chosen-password"
# paste the printed ADMIN_PASSWORD_HASH into .env, and set ADMIN_USERNAME

node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste the output into JWT_SECRET
```

```bash
npm start
```

- Site: `http://localhost:3000`
- Staff login: `http://localhost:3000/login.html`
- Dashboard (requires login): `http://localhost:3000/dashboard.html`
- WhatsApp webhook: `http://localhost:3000/whatsapp/webhook`

The site, dashboard, and rate API work as soon as `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `JWT_SECRET` are set. WhatsApp auto-reply additionally needs a verified Meta Business account, a WhatsApp Business phone number registered through Meta's dashboard (which gives you `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`), and a public HTTPS URL for the webhook — `ngrok` works for local testing.

## Deployment

Configured for [Render](https://render.com) via `render.yaml`.

1. Create a free Postgres database (Neon or Supabase) and copy its connection string.
2. Generate an admin password hash locally: `node scripts/hash-password.js "your-chosen-password"`.
3. In Render: **New** → **Blueprint**, connect this repo.
4. When prompted for env vars, paste the connection string into `DATABASE_URL`, choose an `ADMIN_USERNAME`, and paste the hash from step 2 into `ADMIN_PASSWORD_HASH`. Set the WhatsApp vars if using that feature. `JWT_SECRET` is generated automatically by Render.

Every push to `main` redeploys automatically. Render's free tier has no persistent disk, which is the actual reason this runs on Postgres instead of a local file — a hosted database survives every deploy and restart, at no cost.

## API reference

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/login` | POST | — | `{ username, password }` → sets the session cookie |
| `/api/auth/logout` | POST | — | Clears the session cookie |
| `/api/auth/me` | GET | — | Returns the current session's username, if any |
| `/api/contacts` | GET/POST | required | List / create contacts |
| `/api/contacts/:id` | GET/PUT/DELETE | required | Read / update / delete a contact |
| `/api/transactions` | GET/POST | required | List (optionally `?contact_id=`) / create transactions |
| `/api/transactions/:id` | DELETE | required | Delete a transaction |
| `/api/settings` | GET/PUT | required | Read / update the rate margin percentage |
| `/api/rates/p2p?fiat=RWF` | GET | — | Live buy/sell/mid rate plus margin-adjusted client rate for USDT against the given currency |
| `/whatsapp/webhook` | GET/POST | — | Meta verification handshake / incoming message handler |

## Known limitations

One admin account, via env vars — not a multi-user system with roles. That's fine for a one-operator business, and would need a real users table to grow past it. There's no compliance layer built in: money transfer and currency exchange are regulated activities in most jurisdictions, and licensing, KYC/AML, and reporting are business decisions kept deliberately separate from the software. The upstream rate data isn't an official, documented API either, so it can change shape without notice — the rate engine is written to fail gracefully rather than crash if that happens.

Next up: multi-user accounts with roles, CSV export/backup for the database, daily rates auto-posted to a Telegram channel, and WhatsApp message templates for business-initiated messages.
