import {
  monthKey,
  monthsBetween,
  monthsOf,
  positionInMonth,
  representativeLane,
  type SplashSummary,
} from '@/features/splash/summary';
import type { Database } from '@/lib/database.types';
import type { MyCategory } from '@/lib/queries/profile';
import { todayIn, type IsoDate } from '@/lib/time';

export type Session = Database['public']['Tables']['sessions']['Row'];

/** A post on a shelf, at the place the shelf gives it, and the period its pill reads. */
export type Seat = {
  splash: SplashSummary;
  instant: number;
  date: IsoDate;
  span: { start: IsoDate; end: IsoDate };
};

/**
 * A month's shelf (H21e): every post whose display range touches the month,
 * each at its latest block in that month, **oldest first** — the ground reads
 * downward, top = the month's start, bottom = now (H21d). Strict order on the
 * coalesced key; a later-made post wins a tie.
 */
export function monthSeats(summaries: SplashSummary[], month: string, timeZone: string): Seat[] {
  return summaries
    .filter((summary) => monthsOf(summary, timeZone).includes(month))
    .map((splash) => ({ splash, ...positionInMonth(splash, month, timeZone) }))
    .sort((a, b) => a.instant - b.instant || a.splash.createdAt.localeCompare(b.splash.createdAt));
}

/** How many posts each month shelves. A month with none is simply absent. */
export function monthCounts(summaries: SplashSummary[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    for (const month of monthsOf(summary, timeZone)) {
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The scrubber's months, **newest first**: from the current month (or a later
 * one a post reaches into) back to the earliest month that shelves anything.
 * A month exists because the calendar says so, so the ones between are
 * listed too, with nothing on them.
 */
export function scrubberMonths(
  summaries: SplashSummary[],
  today: IsoDate,
  timeZone: string,
): string[] {
  const current = monthKey(today);
  let earliest = current;
  let latest = current;
  for (const month of monthCounts(summaries, timeZone).keys()) {
    if (month < earliest) earliest = month;
    if (month > latest) latest = month;
  }
  return monthsBetween(earliest, latest).reverse();
}

/** A custom shelf's posts, oldest first by where their range begins. */
export function sessionSeats(
  summaries: SplashSummary[],
  sessionId: string,
  timeZone: string,
): Seat[] {
  return summaries
    .filter((summary) => summary.sessionId === sessionId)
    .map((splash) => {
      const date = splash.range?.start ?? todayIn(timeZone, new Date(splash.createdAt));
      return {
        splash,
        instant: Date.parse(`${date}T00:00:00Z`),
        date,
        span: splash.range ?? { start: date, end: date },
      };
    })
    .sort((a, b) => a.instant - b.instant || a.splash.createdAt.localeCompare(b.splash.createdAt));
}

/** A shelf's range: declared, else first post to last. */
export function sessionRange(
  session: Pick<Session, 'declared_start' | 'declared_end'>,
  seats: Seat[],
): { start: IsoDate; end: IsoDate } | null {
  if (session.declared_start) {
    return { start: session.declared_start, end: session.declared_end ?? session.declared_start };
  }
  const days = seats.flatMap(({ splash }) =>
    splash.range ? [splash.range.start, splash.range.end] : [],
  );
  if (days.length === 0) return null;
  days.sort();
  return { start: days[0], end: days[days.length - 1] };
}

export type LaneGroup = { lane: MyCategory | null; seats: Seat[] };

/**
 * The ratified lane-first grouping of a custom shelf (H21e): posts gathered
 * under their representative lane, groups in lane order, the unlaned last.
 * A shelf that declares a lane, or whose posts all share one, renders flat:
 * one group with no head.
 */
export function groupByLane(
  seats: Seat[],
  categories: MyCategory[],
  session: Pick<Session, 'lane_id'>,
): LaneGroup[] {
  const lanes = new Set(seats.map(({ splash }) => representativeLane(splash)));
  if (session.lane_id || lanes.size <= 1) return [{ lane: null, seats }];

  const groups: LaneGroup[] = [];
  for (const lane of categories) {
    const mine = seats.filter(({ splash }) => representativeLane(splash) === lane.id);
    if (mine.length > 0) groups.push({ lane, seats: mine });
  }
  const unlaned = seats.filter(({ splash }) => representativeLane(splash) === null);
  if (unlaned.length > 0) groups.push({ lane: null, seats: unlaned });
  return groups;
}

/** The monthly row for a month, if it has been titled. */
export function monthlyTitle(sessions: Session[], month: string): Session | null {
  return sessions.find((s) => s.kind === 'monthly' && s.month?.slice(0, 7) === month) ?? null;
}

/** Custom shelves, most recently made first. */
export function customSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.kind === 'custom')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** `September`, from `2026-09`. */
export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
}

/** `Sep`, from `2026-09`. */
export function shortMonthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * The months of a year the Sessions tab lists: January up to the current
 * month in the current year, all twelve in a past year. A month that has not
 * begun has nothing to shelve and no row.
 */
export function monthsOfYear(year: number, today: IsoDate): string[] {
  const current = monthKey(today);
  const last = year === Number(current.slice(0, 4)) ? Number(current.slice(5, 7)) : 12;
  return Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** The earliest year the pager reaches: the first shelved month's, else this one. */
export function earliestYear(summaries: SplashSummary[], today: IsoDate, timeZone: string): number {
  const months = scrubberMonths(summaries, today, timeZone);
  return Number(months[months.length - 1].slice(0, 4));
}
