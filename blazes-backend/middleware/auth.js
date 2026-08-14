// Token-based identity.
//
// Before this existed, login/register/OAuth all handed back the literal string
// 'jwt-token-here' and every route read the acting user's id straight out of the
// request body or URL. Anyone could pass someone else's id and act as them —
// including changing their password or deleting their account outright.
//
// The rule this enforces: identity comes from a signed token the server issued,
// never from something the caller can type.

const jwt = require('jsonwebtoken');

const TOKEN_TTL = '30d';

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    // Failing loudly beats signing production tokens with a known constant.
    throw new Error('JWT_SECRET (or SESSION_SECRET) must be set in production');
  }
  return 'blazes-local-dev-secret-not-for-production';
}

/** Signs the token handed to a client on login / register / OAuth. */
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, secret(), { expiresIn: TOKEN_TTL });
}

/**
 * Populates req.auth from a Bearer token when one is present and valid.
 * Never rejects — routes that have not been migrated yet keep working.
 */
function readAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { req.auth = null; return next(); }
  try {
    req.auth = jwt.verify(token, secret());
  } catch {
    // Expired, tampered with, or one of the old 'jwt-token-here' placeholders.
    req.auth = null;
  }
  next();
}

/** Rejects anything without a valid token. Use on routes that act on an account. */
function requireAuth(req, res, next) {
  if (!req.auth?.id) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Please sign in again.' });
  }
  next();
}

/**
 * The acting user's id, from the token only.
 * Routes must use this instead of req.body.userId / req.params.userId.
 */
const actingUserId = (req) => req.auth?.id ?? null;

module.exports = { signToken, readAuth, requireAuth, actingUserId, TOKEN_TTL };
