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
 * A post's URL. Opened in the app it is a sheet over the current screen,
 * which stays as it was beneath (review), so it carries no way back.
 */
export function splashHref(id: string): string {
  return `/splash/${id}`;
}

/** `September`, from `2026-09`. */
export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
}
