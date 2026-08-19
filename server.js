require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const { init } = require('./db');
const { requireAuth, requirePageAuth } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const contactsRouter = require('./routes/contacts');
const transactionsRouter = require('./routes/transactions');
const settingsRouter = require('./routes/settings');
const { router: ratesRouter } = require('./routes/rates');
const whatsappRouter = require('./routes/whatsapp');

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy — without this,
// req.ip resolves to the proxy's address for every request, which would
// collapse the login rate-limiter across all users instead of per-client.
app.set('trust proxy', 1);

// Everything on this site is self-hosted (no CDNs, no external fonts/images),
// so the CSP can stay tight. 'unsafe-inline' on style-src is needed for the
// inline style="--angle: ...deg" attributes on the hero's orbit nodes —
// script-src stays strict since there's no inline JS anywhere.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// The dashboard HTML lives outside public/ specifically so it can't be
// fetched directly by static file serving — this route is the only way to
// reach it, and it's gated on a valid session.
app.get('/dashboard.html', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.use('/api/auth', authRouter);
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/rates', ratesRouter);
app.use('/whatsapp', whatsappRouter);

// Catch-all: anything that didn't match a route or a static file above gets
// the branded 404 page instead of Express's bare default error page. API
// routes get a plain JSON 404 instead, so client-side error handling
// doesn't have to parse HTML.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ledger running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
