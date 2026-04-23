// Client-side auth token helpers.
//
// The JWT issued by /api/auth/login is stashed in localStorage under
// 'authToken'. Before this helper existed, every fetch site re-inlined
// either `localStorage.getItem('authToken') || ''` or the SSR-safe variant
// `typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''`.
// The inconsistency made it easy to miss the SSR guard in one spot and
// break `npm run build`, and centralizing it is a one-line fix if we ever
// move the token to an httpOnly cookie.

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
}

/**
 * Standard Authorization header for fetches against our own API routes.
 * Safe during SSR (returns empty bearer). Compose with other headers via spread:
 *   headers: { 'Content-Type': 'application/json', ...authHeaders() }
 */
export function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getAuthToken()}` };
}
