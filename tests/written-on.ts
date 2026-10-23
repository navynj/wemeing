import { todayIn } from '@/lib/time';

/**
 * A fixture row as the database stores it since 0013: `written_on` is the
 * author's local date of `created_at`, set by a trigger. Fixtures are
 * written by an author in Vancouver unless they say otherwise; a row that
 * sets its own `written_on` keeps it.
 */
export function written<T extends { created_at: string; written_on?: string | null }>(
  row: T,
  timeZone = 'America/Vancouver',
): T & { written_on: string } {
  return { ...row, written_on: row.written_on ?? todayIn(timeZone, new Date(row.created_at)) };
}
