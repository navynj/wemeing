/**
 * The one canonical origin for this deployment.
 *
 * OAuth return URLs are matched against Supabase's allowlist as strings, and
 * an `additional_redirect_urls` entry matches exactly — so `localhost` and
 * `127.0.0.1` are two different origins to it, and a stray query string is
 * enough to miss. Building every redirect from one configured origin is what
 * keeps the sent URL and the allowlisted URL identical.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  throw new Error('NEXT_PUBLIC_SITE_URL is not set');
}

/** The exact URL registered in supabase/config.toml. Never add a query here. */
export function authCallbackUrl(): string {
  return `${siteUrl()}/auth/callback`;
}

/**
 * Carries the browser's timezone across the OAuth round trip. It travels in a
 * cookie rather than on the callback URL because a query string breaks the
 * allowlist match, and GoTrue's response to that is a silent fallback to
 * site_url rather than an error.
 */
export const TIMEZONE_COOKIE = 'during-tz';

/**
 * Carries `?next=` across the OAuth round trip for the same reason: a join
 * link opened signed out comes back to itself after sign-in (H23). The
 * callback reads it through `safeNext`, never as given.
 */
export const NEXT_COOKIE = 'during-next';
