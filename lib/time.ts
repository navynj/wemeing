/**
 * Day boundaries are the author's, not the server's: `occurred_on` is a
 * wall-clock date in the author's timezone, and WeMeing is used across
 * Vancouver and Korea from week one.
 */

/** `YYYY-MM-DD`, the shape `occurred_on` takes over the wire. */
export type IsoDate = string;

export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function shiftDate(date: IsoDate, days: number): IsoDate {
  // Parsed as UTC so the arithmetic never crosses a DST seam; these are
  // calendar dates, not instants.
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The header's two halves: `2026 AUG` on the left, `15` over `SAT` on the
 * right. Formatted in UTC because these are calendar dates, not instants —
 * the author's zone has already been applied to pick which date this is.
 */
export function formatPagerDate(date: IsoDate): {
  year: string;
  month: string;
  day: string;
  weekday: string;
  full: string;
} {
  const at = new Date(`${date}T00:00:00Z`);
  const label = (options: Intl.DateTimeFormatOptions): string =>
    at.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

  return {
    year: String(at.getUTCFullYear()),
    month: label({ month: 'short' }).toUpperCase(),
    day: String(at.getUTCDate()),
    weekday: label({ weekday: 'short' }).toUpperCase(),
    // For assistive tech, which should hear a date rather than two fragments.
    full: label({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

/** The browser's zone, captured once at profile bootstrap. */
export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
