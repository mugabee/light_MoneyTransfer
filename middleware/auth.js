const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'ledger_session';
const TOKEN_TTL = '8h';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set — add it to .env (see .env.example)');
  }
  return secret;
}

function issueSession(res, username) {
  const token = jwt.sign({ sub: username }, getSecret(), { expiresIn: TOKEN_TTL });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME);
}

function verify(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

// For JSON API routes — returns 401 rather than redirecting.
function requireAuth(req, res, next) {
  const payload = verify(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.admin = payload;
  next();
}

// For HTML page routes — redirects to the login page instead of a bare 401.
function requirePageAuth(req, res, next) {
  const payload = verify(req);
  if (!payload) return res.redirect('/login.html');
  req.admin = payload;
  next();
}

module.exports = { issueSession, clearSession, verify, requireAuth, requirePageAuth, COOKIE_NAME };
