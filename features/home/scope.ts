import { monthKey } from '@/features/splash/summary';
import type { IsoDate } from '@/lib/time';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The month the ground shows (H21h): `?m=YYYY-MM`, else the current month.
 * Scope, not scroll: the ground shows that month and nothing else.
 */
export function scopedMonth(param: string | string[] | undefined, today: IsoDate): string {
  const candidate = Array.isArray(param) ? param[0] : param;
  return candidate && MONTH.test(candidate) ? candidate : monthKey(today);
}

/** The link that scopes the ground to a month. */
export function monthHref(month: string): string {
  return `/?m=${month}`;
}

/**
 * A post's page opened from Home's board: the back chip returns to Home
 * with this post on top again, rather than to a fresh stack (review).
 */
export function splashFromHome(id: string): string {
  return `/splash/${id}?from=${encodeURIComponent(`/?top=${id}`)}`;
}

/** Where a post's page says it came from, for the month it was opened in. */
export function splashHref(id: string, month: string): string {
  return `/splash/${id}?from=${month}`;
}

/** `September`, from `2026-09`. */
export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
}
