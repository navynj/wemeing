import type { Ripple } from '@/lib/queries/ripples';
import { wallClockToInstant } from '@/lib/ripple-kind';
import { todayIn, type IsoDate } from '@/lib/time';

/**
 * The diary's own order (H20c, H21f): `COALESCE(occurred, the post's
 * declared date, created_at)`, `created_at` as the tiebreak.
 *
 * An unannotated block — the default — rests at its post's declared date if
 * the post declares one, else where it was written. An annotation is an
 * instruction to place the block where it happened, and it always wins: a
 * declaration is a default, never an override. Computed where it is read,
 * never stored: the sort_key plan was cancelled unbuilt.
 */
export type FlowKeyed = Pick<Ripple, 'occurred_on' | 'occurred_time' | 'created_at'> & {
  /** The post this block composes, where the query joined it. */
  splash?: { declared_start: string | null } | null;
  /**
   * The author's local date when it was written (0013), fixed at insert.
   * Optional only for a block made in the browser a moment ago.
   */
  written_on?: string | null;
  /** The start instant, resolved in the author's zone when written (0002). */
  started_at?: string | null;
};

/** A day's length in ms: a resting block sits this far past its date's UTC midnight. */
const RESTING_MS = 2 * 24 * 60 * 60 * 1000 - 1;

/** Just before midnight, author-local: where a date-only block sits. */
export const END_OF_DAY = '23:59:59.999';

/** The date a block rests on without an annotation: its post's declared date. */
function restingDate(ripple: FlowKeyed): IsoDate | null {
  return ripple.occurred_on ?? ripple.splash?.declared_start ?? null;
}

/**
 * Where a block sorts **within its day** (2026-10-23: the author's local
 * day). A timed block sorts at its start, the instant resolved in the
 * author's zone when written; an unannotated one where it was posted; a
 * date-only block, or one resting at its post's declared date, above
 * everything else that day — a rank, not a clock, so no reader's zone can
 * move it past a real instant. Only meaningful between blocks of one day:
 * compare across days with `compareFlow`, which reads the day first.
 */
export function flowInstant(ripple: FlowKeyed, timeZone: string): number {
  const date = restingDate(ripple);
  if (date === null) return Date.parse(ripple.created_at);
  if (ripple.occurred_on === null || ripple.occurred_time === null) {
    return restingInstant(date);
  }
  if (ripple.started_at) return Date.parse(ripple.started_at);
  return wallClockToInstant(date, ripple.occurred_time, timeZone).getTime();
}

/** Where a resting (date-only) block sits within its date: above every real instant of it. */
export function restingInstant(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`) + RESTING_MS;
}

/** Oldest first: the day, then the place within it, then the posting. */
export function compareFlow(a: FlowKeyed, b: FlowKeyed, timeZone: string): number {
  const da = dayOf(a, timeZone);
  const db = dayOf(b, timeZone);
  if (da !== db) return da < db ? -1 : 1;
  return (
    flowInstant(a, timeZone) - flowInstant(b, timeZone) ||
    Date.parse(a.created_at) - Date.parse(b.created_at)
  );
}

/** Newest first; a later posting wins a tie. */
export function compareNewestFirst(a: FlowKeyed, b: FlowKeyed, timeZone: string): number {
  return compareFlow(b, a, timeZone);
}

export function sortNewestFirst<T extends FlowKeyed>(ripples: T[], timeZone: string): T[] {
  return [...ripples].sort((a, b) => compareNewestFirst(a, b, timeZone));
}

/**
 * The day a block belongs to (H20c, H21f; 2026-10-23): its annotation's
 * date, else its post's declared date, else the author's local date when it
 * was written — stored, so no reader's zone moves it. `timeZone` cuts the
 * day only for a block made in the browser a moment ago, which is mine.
 */
export function dayOf(ripple: FlowKeyed, timeZone: string): IsoDate {
  return restingDate(ripple) ?? ripple.written_on ?? todayIn(timeZone, new Date(ripple.created_at));
}

/** `2026-08`: the month of the block's day. */
export function monthOf(ripple: FlowKeyed, timeZone: string): string {
  return dayOf(ripple, timeZone).slice(0, 7);
}

/** True when the block is placed on a day that has not happened yet. */
export function isFutureDated(ripple: FlowKeyed, timeZone: string, today: IsoDate): boolean {
  return ripple.occurred_on !== null && ripple.occurred_on > today;
}
