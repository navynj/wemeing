import type { ReactNode } from 'react';

import type { IsoDate } from '@/lib/time';

import { monthAbbrev, weekdayOf } from './grid';

/** The date rail's width, for the grid and every day list. */
export const DAY_RAIL_PX = 56;
/** A day list's columns: the rail, then the day's rows. */
export const DAY_LIST_TEMPLATE = `${DAY_RAIL_PX}px minmax(0, 1fr)`;

/**
 * A day in a day list (review) — the Date view and a lane's page alike:
 * every day spaced the same. The month, when it changes, is a line of its
 * own above the day rather than a taller rail, so no day's rows sit apart
 * differently; the rail is the day number over its weekday, aligned with
 * the day's first row; one fixed space follows each day. Laid out in a
 * grid of `DAY_LIST_TEMPLATE`. A day list never scrolls sideways, so the
 * rail is neither sticky nor filled: a fill would cut the ring that plays
 * around a row's icon, which reaches across the rail (review).
 */
export function DateDay({
  day,
  monthChanges,
  children,
}: {
  day: IsoDate;
  monthChanges: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {monthChanges ? (
        <div
          data-month-label
          className="col-span-full pt-1 pb-1 pl-6 text-[10px]/none font-medium text-white/50"
        >
          {day.slice(0, 4)} {monthAbbrev(day)}
        </div>
      ) : null}
      <div
        data-day-row={day}
        data-labelled=""
        className="flex min-w-0 flex-col gap-0.5 pt-3 pr-1 pl-6 text-white/70"
      >
        <span className="text-sm/none font-medium tabular-nums">{Number(day.slice(8, 10))}</span>
        <span className="text-[10px]/none font-medium text-white/50">{weekdayOf(day)}</span>
      </div>
      <div data-cell="date" className="flex min-w-0 flex-col pr-4 pb-5">
        {children}
      </div>
    </>
  );
}
