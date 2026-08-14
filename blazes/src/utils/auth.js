// Identity is proved by the token the server signed at login, not by a userId
// in the request body. Routes protected with requireAuth reject anything else.

/** Headers for an authenticated JSON request. */
export function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Call with a 401 response to clear the stale session and bounce to login.
 * Returns true when it handled the response, so callers can bail out.
 *
 * Accounts signed in before tokens were real hold the old 'jwt-token-here'
 * placeholder, which no longer verifies — they land here once and re-login.
 */
export function handleUnauthorized(res) {
  if (res?.status !== 401) return false;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login?error=session_expired';
  return true;
}
