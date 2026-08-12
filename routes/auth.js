const express = require('express');
const bcrypt = require('bcryptjs');
const { issueSession, clearSession, verify } = require('../middleware/auth');

const router = express.Router();

// Simple rate limiting for login attempts — keyed by IP, in-memory. Fine for
// a single-instance deploy; resets on restart.
const attempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

router.post('/login', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many attempts — try again later' });
  }

  const { username, password } = req.body || {};
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !adminHash) {
    return res.status(500).json({ error: 'Admin login is not configured' });
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Constant-time-ish: always run bcrypt.compare even on a username miss,
  // so a wrong username doesn't return faster than a wrong password.
  const usernameMatches = username === adminUsername;
  const passwordMatches = await bcrypt.compare(password, adminHash);

  if (!usernameMatches || !passwordMatches) {
    recordAttempt(ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  issueSession(res, username);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const payload = verify(req);
  if (!payload) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: payload.sub });
});

module.exports = router;
