# Ledger

**Fast, transparent money transfer — with the live currency infrastructure of a forex bureau, built for the web.**

🔗 **Live app:** [https://ledger-khml.onrender.com](https://ledger-khml.onrender.com)

Ledger is a full money transfer platform: a public-facing site where customers get live, worldwide exchange rates and send money in a few clicks, paired with a staff CRM for managing contacts and transaction history. It's built on Node.js, Express, and Postgres, and deployed on Render with zero manual database migrations — the schema provisions itself on first boot.

---

## Why it's built this way

Most small money-transfer operations either rely on a spreadsheet and word-of-mouth rates, or bolt together a website that quotes stale, manually-updated numbers. Ledger does neither:

- **Rates are live, not guessed.** Every quote is pulled from real-time market data, cached briefly to stay fast, and refreshed continuously — never a static number someone forgot to update.
- **Pricing is transparent, not hidden.** The public site shows customers exactly how a transfer works and what rate they're getting, before they commit to anything.
- **It scales past one currency pair.** Sixteen currencies across Africa, the Americas, Europe, and Asia — each with a real flag icon, not a broken emoji — with a forex-bureau-style rates board that lets a customer compare *any* currency against *any* other, not just the home currency.
- **It's a real product, not a prototype.** Responsive down to mobile, accessible dropdowns, graceful degradation when an upstream data source hiccups, and a staff-side audit log on every write.

## What's included

### Public site
- Animated hero with a live, worldwide currency network visualization
- A stacked "You send / Recipient gets" converter with quick-amount presets, instant swap, and live flag icons
- A forex-bureau-style **rates board** — buy/sell prices for every supported currency, with a picker to compare against any base currency, not just RWF
- Scroll-aware UI: progress bar, reveal animations, mobile hamburger nav
- FAQ, how-it-works, and direct WhatsApp/Telegram contact links

### Staff dashboard
- Login-gated — `/dashboard.html` and all of `/api/contacts` and `/api/transactions` require an authenticated session (JWT in an httpOnly cookie); anyone else is redirected to `/login.html`
- Contact management, tagged by channel (WhatsApp, Telegram, Instagram, Facebook, phone)
- Full transaction history per contact
- Every write — create, update, delete — recorded to an audit log

### Rate engine
- Live buy/sell/mid pricing sourced from real P2P market data, cached server-side
- Margin-adjusted client rates computed once and shared consistently across the site, the WhatsApp bot, and the rates board — no drift between what different parts of the app quote
- Cross-currency rates computed properly through a common bridge asset, with precision that scales to the value of the currency (so a sub-cent rate never silently rounds to zero)

### WhatsApp integration (optional)
- Auto-replies to incoming messages with today's rate, a how-it-works explanation, or a greeting, via the WhatsApp Cloud API
- Every inbound number is logged as a contact automatically

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + Express | Simple, well-understood, easy to deploy anywhere |
| Database | Postgres | Real persistence on Render's free tier (no disk required), portable to any Postgres host |
| Frontend | Vanilla HTML/CSS/JS | No build step, no framework overhead, fast to load |
| Hosting | Render | Auto-deploys on every push to `main` |

No unnecessary dependencies, no framework lock-in — just what the product needs.

## Local development

Requires a Postgres database. The free tier of [Neon](https://neon.tech) or [Supabase](https://supabase.com) both work — create a project, copy the connection string.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, RATE_FIAT, RATE_MARGIN_PERCENT, and WhatsApp credentials if using that feature
```

Then set up admin login — generate a password hash locally (nothing is sent anywhere) and add it, along with a username and a random JWT secret, to `.env`:

```bash
node scripts/hash-password.js "your-chosen-password"
# paste the printed ADMIN_PASSWORD_HASH line into .env, and set ADMIN_USERNAME
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste the output into JWT_SECRET in .env
```

```bash
npm start
```

Tables are created automatically on startup if they don't already exist — no migration step.

- Site: `http://localhost:3000`
- Staff login: `http://localhost:3000/login.html`
- Dashboard (requires login): `http://localhost:3000/dashboard.html`
- WhatsApp webhook: `http://localhost:3000/whatsapp/webhook`

The site, dashboard, and rate API work as soon as `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `JWT_SECRET` are set. WhatsApp auto-reply additionally requires:

1. A verified Meta Business account
2. A WhatsApp Business phone number registered through Meta's dashboard → gives you `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
3. A public HTTPS URL for the webhook (use `ngrok` for local testing)

## Deployment

Configured for [Render](https://render.com) via `render.yaml` — connect the repo, set `DATABASE_URL`, deploy. Every push to `main` redeploys automatically.

1. Create a free Postgres database (Neon or Supabase) and copy its connection string
2. Generate an admin password hash locally: `node scripts/hash-password.js "your-chosen-password"`
3. Render → **New** → **Blueprint**, connect this repo
4. When prompted for env vars: paste the connection string into `DATABASE_URL`, choose an `ADMIN_USERNAME`, paste the hash from step 2 into `ADMIN_PASSWORD_HASH`, and set the WhatsApp vars if using that feature. `JWT_SECRET` is generated automatically by Render — no action needed.

Render's free tier doesn't support persistent disks, which is why this runs on Postgres rather than a local file — a hosted database keeps data intact across every deploy and restart, at no cost.

## API reference

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/login` | POST | — | `{ username, password }` → sets the session cookie |
| `/api/auth/logout` | POST | — | Clears the session cookie |
| `/api/auth/me` | GET | — | Returns the current session's username, if any |
| `/api/contacts` | GET/POST | ✅ | List / create contacts |
| `/api/contacts/:id` | GET/PUT/DELETE | ✅ | Read / update / delete a contact |
| `/api/transactions` | GET/POST | ✅ | List (optionally `?contact_id=`) / create transactions |
| `/api/transactions/:id` | DELETE | ✅ | Delete a transaction |
| `/api/rates/p2p?fiat=RWF` | GET | — | Live buy/sell/mid rate plus margin-adjusted client rate for USDT against the given currency |
| `/whatsapp/webhook` | GET/POST | — | Meta verification handshake / incoming message handler |

## Known limitations & roadmap

Being upfront about what's not built yet is part of shipping something real:

- **Single admin account** — one username/password pair via env vars, not a multi-user system with roles. Fine for a one-operator business; would need a real users table to grow past that.
- **No compliance layer built in** — money transfer and currency exchange are regulated activities in most jurisdictions (licensing, KYC/AML, reporting thresholds). That's a business decision for the operator, kept deliberately separate from the software.
- **Upstream rate data isn't an official, documented API** — it can change shape without notice. The rate engine is written to fail gracefully rather than crash if that happens.

**Planned next:**
- Multi-user accounts with roles, for teams past a single operator
- CSV export/backup for the database
- Auto-post daily rates to a Telegram channel
- WhatsApp message templates for business-initiated messages
