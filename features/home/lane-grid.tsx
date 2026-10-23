'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { OutlineChip } from '@/components/ui/chips/category-chip';
import { useAxisLock } from '@/components/ui/use-axis-lock';
import { CommitRing } from '@/components/ui/waves';
import { usePrefersReducedMotion } from '@/components/ui/waves/use-reduced-motion';
import { monthKey } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';
import type { IsoDate } from '@/lib/time';

import {
  cardLane,
  daysDown,
  EVEN_COLUMNS_MAX,
  FIXED_COLUMN_PX,
  gridBounds,
  isOrphanCard,
  monthAbbrev,
  weekdayOf,
  type Card,
} from './grid';

/** The date rail's width and the `+` column's, both fixed; the lanes share the rest. */
const RAIL_PX = 56;
const PLUS_PX = 44;
/** How many day rows the window grows by when the bottom comes into view. */
const WINDOW_STEP = 31;
/** The fewest rows rendered at first, so a month that has barely begun still scrolls. */
const WINDOW_MIN = 21;
/** The narrowest a column gets when six share a phone's width: six always show at once. */
const MIN_COLUMN_PX = 40;
/** A day row's least height, a gap's height (a run of empty days, compressed), and the mark's diameter with the ring's bound. */
const ROW_PX = 56;
const GAP_PX = 28;
export const MARK_PX = 28;
const RING_PX = 96;
/** How long a smooth scroll to the mark is given before its ring plays, so the ring is seen. */
export const SCROLL_MS = 350;

/** A ring to play: at this mark, once per `seq`. */
export type Ring = { id: string; seq: number };

/** Where a mark is on screen: the centre of its disc, in client coordinates. */
export type MarkSpot = { x: number; y: number; size: number };

/** What Home can ask the grid to do. */
export type GridHandle = {
  /**
   * Scrolls so the first mark is in view (smooth unless motion is reduced)
   * and reports where each mark will be once that scroll has landed — the
   * target a diving card flies to, and the seat a rising one leaves from.
   */
  revealMarks: (ids: string[]) => Map<string, MarkSpot>;
};

/**
 * The lane grid (H22; `_docs/mockups/home-grid-stack.png`): a map of recent
 * records. One column per lane in the author's order, each headed by its
 * emoji over its name with a thin rope running down each side of it; one row per day,
 * newest at the top, named on a fixed rail at the left (the day number and
 * weekday, the year and month only where the month changes) at one quiet
 * opacity. A post is a white disc carrying its lane's emoji, centred on its
 * column at its day; several on one lane and day stack within the row, and
 * the row grows to hold them. The post on top of the board has the one
 * solid mark; every other reads translucent (review); tapping any mark
 * brings its card to the top. A run of
 * empty days is one short gap of empty ropes with no date on the rail
 * (review): the past compresses rather than stretching by the calendar,
 * and only a day with something on it is named.
 *
 * One scroll container, both axes: the rail is sticky at the left and the
 * lane headers sticky at the top, so a vertical drag anywhere scrolls days
 * and a horizontal one scrolls columns only, with nothing synchronised in
 * script. The avatar above the headers scrolls away with the days, which is
 * what keeps three rows above the stack on a short phone. With up to
 * `EVEN_COLUMNS_MAX` lanes the columns share the width and the group sits
 * centred; past that each column is fixed and the columns scroll sideways.
 * A lane's header opens its detail — the titles on it; at the far left of
 * the headers, above the rail, an `=` opens the lanes sheet (review).
 *
 * The rendered window of days grows as the bottom comes into view, from the
 * top day back to the oldest post's month. The ring plays at the mark Home
 * names — a landing, a drop, the first post on open — after the grid has
 * scrolled it into view.
 */
export const LaneGrid = forwardRef<
  GridHandle,
  {
    /** Newest first. */
    cards: Card[];
    categories: MyCategory[];
    today: IsoDate;
    /** The mark to ring, once per `seq`. */
    ring: Ring | null;
    /** Every post but the one on top of the board: their marks read translucent (review). */
    waterIds: ReadonlySet<string>;
    initials: string;
    /** `?m=`: the month to scroll the grid to; the newest day of it lands under the headers. */
    scrollToMonth: string | null;
    onPick: (id: string) => void;
    onCreateLane: () => void;
    /**
     * The Lane view (the grid) or the Date view (round 3): the same scroller,
     * rail, window, `?m=` target and ring; in the Date view a day's posts are
     * pills, one per line, and there are no lane columns.
     */
    view?: 'lane' | 'date';
  }
>(function LaneGrid(
  {
    cards,
    categories,
    today,
    ring,
    waterIds,
    initials,
    scrollToMonth,
    onPick,
    onCreateLane,
    view = 'lane',
  },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  // One axis per gesture: a drag never drifts diagonally (round 3).
  useAxisLock(scroller);
  const dateView = view === 'date';
  const reducedMotion = usePrefersReducedMotion();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  // The ring as it plays: set once its mark has been brought into view.
  const [ringAt, setRingAt] = useState<Ring | null>(null);

  const { top, floor } = gridBounds(cards, today);
  const allDays = useMemo(() => daysDown(top, floor), [top, floor]);
  const [grown, setLimit] = useState(() =>
    Math.max(WINDOW_MIN, daysDown(top, `${monthKey(top)}-01`).length),
  );

  const orphans = cards.some((card) => isOrphanCard(card, categories));
  const columns = categories.length + (orphans ? 1 : 0);
  const even = dateView || columns <= EVEN_COLUMNS_MAX;
  // Every mark carries its short title (round 3). Past six lanes a column
  // keeps a sixth of the room and the rest scroll sideways, so six lanes
  // always show at once; unmeasured, a column falls back to its fixed width.
  const titled = !dateView;
  const share =
    viewportWidth !== null
      ? Math.max(MIN_COLUMN_PX, Math.floor((viewportWidth - RAIL_PX - PLUS_PX) / EVEN_COLUMNS_MAX))
      : FIXED_COLUMN_PX;
  const template = dateView
    ? `${RAIL_PX}px minmax(0, 1fr)`
    : `${RAIL_PX}px repeat(${Math.max(columns, 1)}, ${
        even ? 'minmax(0, 1fr)' : `${share}px`
      }) ${PLUS_PX}px`;
  const byLaneId = useMemo(() => new Map(categories.map((lane) => [lane.id, lane])), [categories]);

  // Each day's cards by lane, so a cell is one lookup.
  const byCell = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards) {
      const lane = isOrphanCard(card, categories) ? '' : (cardLane(card.splash) ?? '');
      const key = `${card.day}|${lane}`;
      const cell = map.get(key);
      if (cell) cell.push(card);
      else map.set(key, [card]);
    }
    return map;
  }, [cards, categories]);

  // The avatar row is sticky at the left and exactly as wide as the viewport,
  // so it never scrolls sideways with the columns.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The month asked for and the mark to ring are always within the window,
  // which reaches down to them: the window is the larger of the two.
  const ringCard = cards.find((card) => card.splash.id === ring?.id) ?? null;
  const monthDay = scrollToMonth
    ? (allDays.find((day) => monthKey(day) === scrollToMonth) ?? null)
    : null;
  const needed = Math.max(
    ringCard ? allDays.indexOf(ringCard.day) + 1 : 0,
    monthDay ? allDays.indexOf(monthDay) + 1 : 0,
  );
  const limit = Math.max(grown, needed);
  const days = allDays.slice(0, limit);
  // A day with something on it is a row; a run of empty days is one gap.
  const byDay = useMemo(() => {
    const map = new Map<IsoDate, Card[]>();
    for (const card of cards) {
      const list = map.get(card.day);
      if (list) list.push(card);
      else map.set(card.day, [card]);
    }
    return map;
  }, [cards]);
  const named = (d: IsoDate): boolean => byDay.has(d);
  const rows: ({ kind: 'day'; day: IsoDate } | { kind: 'gap'; from: IsoDate; to: IsoDate })[] = [];
  for (const day of days) {
    if (named(day)) {
      rows.push({ kind: 'day', day });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.kind === 'gap') last.to = day;
    else rows.push({ kind: 'gap', from: day, to: day });
  }

  // The window grows when its end comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    const root = scroller.current;
    if (!el || !root) return;
    if (limit >= allDays.length) return;
    // Without an observer there is no telling where the bottom is: every day.
    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setLimit(allDays.length));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => Math.min(allDays.length, current + WINDOW_STEP));
        }
      },
      { root },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit, allDays.length]);

  /** The scroll that brings a mark into view, and where the mark sits once it has. */
  const reveal = useCallback(
    (ids: string[]): { spots: Map<string, MarkSpot>; scrolled: boolean } => {
      const el = scroller.current;
      const spots = new Map<string, MarkSpot>();
      if (!el) return { spots, scrolled: false };
      const header = headerHeight(el);
      let scrollTop = el.scrollTop;
      let scrollLeft = el.scrollLeft;
      let scrolled = false;
      const first = ids[0] ? el.querySelector<HTMLElement>(markSelector(ids[0])) : null;
      if (first) {
        const { top: markTop, left: markLeft } = offsetIn(first, el);
        if (markTop < scrollTop + header) scrollTop = markTop - header - 8;
        else if (markTop + first.offsetHeight > scrollTop + el.clientHeight) {
          scrollTop = markTop + first.offsetHeight - el.clientHeight + 8;
        }
        if (markLeft < scrollLeft + RAIL_PX) scrollLeft = markLeft - RAIL_PX - 8;
        else if (markLeft + first.offsetWidth > scrollLeft + el.clientWidth) {
          scrollLeft = markLeft + first.offsetWidth - el.clientWidth + 8;
        }
        scrollTop = Math.max(0, Math.min(scrollTop, el.scrollHeight - el.clientHeight));
        scrollLeft = Math.max(0, Math.min(scrollLeft, el.scrollWidth - el.clientWidth));
        if (scrollTop !== el.scrollTop || scrollLeft !== el.scrollLeft) {
          scrollWithin(el, { top: scrollTop, left: scrollLeft }, reducedMotion);
          scrolled = !reducedMotion;
        }
      }
      const rect = el.getBoundingClientRect();
      for (const id of ids) {
        const mark = el.querySelector<HTMLElement>(markSelector(id));
        if (!mark) continue;
        const at = offsetIn(mark, el);
        spots.set(id, {
          x: rect.left + at.left - scrollLeft + mark.offsetWidth / 2,
          y: rect.top + at.top - scrollTop + mark.offsetHeight / 2,
          size: mark.offsetWidth || MARK_PX,
        });
      }
      return { spots, scrolled };
    },
    [reducedMotion],
  );
  useImperativeHandle(ref, () => ({ revealMarks: (ids) => reveal(ids).spots }), [reveal]);

  // `?m=`: the month's newest day lands just under the headers.
  const scrolledMonth = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !scrollToMonth || !monthDay) return;
    if (scrolledMonth.current === scrollToMonth) return;
    const row = rowHolding(el, monthDay);
    if (!row) return;
    scrolledMonth.current = scrollToMonth;
    scrollWithin(el, { top: offsetIn(row, el).top - headerHeight(el) }, reducedMotion);
  }, [scrollToMonth, monthDay, reducedMotion]);

  // The ring never plays off screen: its mark is scrolled into view first,
  // and the ring starts once the scroll has had time to land.
  useLayoutEffect(() => {
    if (!ring) return;
    const { scrolled } = reveal([ring.id]);
    const timer = window.setTimeout(() => setRingAt(ring), scrolled ? SCROLL_MS : 0);
    return () => window.clearTimeout(timer);
  }, [ring, reveal]);

  return (
    <div
      ref={scroller}
      data-lane-grid
      data-columns={even ? 'even' : 'fixed'}
      className="no-scrollbar relative min-h-0 flex-1 overflow-auto overscroll-contain"
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div
        data-grid
        className={`relative grid ${even ? 'w-full' : 'w-max min-w-full'}`}
        // Every day row at least this tall and as tall as its fullest cell,
        // so stacked marks grow the row rather than spill into the next.
        style={{ gridTemplateColumns: template, gridAutoRows: 'auto' }}
      >
        {/* The avatar: large, centred, scrolling away with the days. */}
        <div
          data-avatar-row
          className="sticky left-0 col-span-full flex justify-center pt-5 pb-6"
          style={{ width: viewportWidth ?? '100%' }}
        >
          <span
            data-avatar
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 text-2xl font-medium text-white/70"
          >
            {initials}
          </span>
        </div>

        {/* The lane headers: sticky at the top, on the water so rows pass
            beneath. A header opens its lane's page (round 3). The Date view
            has no columns, so no headers. */}
        {dateView ? null : (
          <>
            <div
              data-grid-header
              className="bg-main-900 sticky top-0 left-0 z-30"
              style={{ gridColumn: 1 }}
            />
            {categories.map((lane) => (
              <Link
                key={lane.id}
                href={`/lane/${lane.id}`}
                data-lane-header={lane.id}
                className="bg-main-900 sticky top-0 z-20 flex flex-col items-center gap-0.5 px-0.5 pb-2 text-white"
              >
                <span aria-hidden className="text-2xl/none">
                  {lane.icon}
                </span>
                <span className="max-w-full truncate text-[11px]/tight font-semibold">
                  {lane.name}
                </span>
              </Link>
            ))}
            {orphans ? (
              <div data-lane-header="" className="bg-main-900 sticky top-0 z-20 pb-2" />
            ) : null}
            <div className="bg-main-900 sticky top-0 z-20 flex items-start justify-center pb-2">
              <button
                type="button"
                aria-label="New lane"
                data-new-lane
                onClick={onCreateLane}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/40 text-white/60"
              >
                <Plus aria-hidden size={14} />
              </button>
            </div>
          </>
        )}

        {rows.map((row, index) => {
          if (row.kind === 'gap') {
            return (
              <GapRow
                key={row.from}
                from={row.from}
                to={row.to}
                columns={dateView ? 0 : columns}
                plus={!dateView}
              />
            );
          }
          const { day } = row;
          // The month is named on its first named day.
          const monthChanges = !rows
            .slice(0, index)
            .some((r) => r.kind === 'day' && monthKey(r.day) === monthKey(day));
          const marks = (lane: string, icon: string | null): ReactNode =>
            (byCell.get(`${day}|${lane}`) ?? []).map((card) => (
              <Mark
                key={card.splash.id}
                card={card}
                icon={icon}
                dived={waterIds.has(card.splash.id)}
                ring={ringAt?.id === card.splash.id ? ringAt.seq : null}
                titled={titled}
                onPick={onPick}
              />
            ));
          if (dateView) {
            return (
              <DayRow key={day} day={day} monthChanges={monthChanges}>
                <div data-cell="date" className="flex min-w-0 flex-col gap-1.5 py-2 pr-4">
                  {(byDay.get(day) ?? []).map((card) => {
                    const laneId = cardLane(card.splash);
                    return (
                      <Pill
                        key={card.splash.id}
                        card={card}
                        lane={laneId ? (byLaneId.get(laneId) ?? null) : null}
                        dived={waterIds.has(card.splash.id)}
                        ring={ringAt?.id === card.splash.id ? ringAt.seq : null}
                        onPick={onPick}
                      />
                    );
                  })}
                </div>
              </DayRow>
            );
          }
          return (
            <DayRow key={day} day={day} monthChanges={monthChanges}>
              {categories.map((lane, at) => (
                <Cell key={lane.id} lane={lane.id} first={at === 0}>
                  {marks(lane.id, lane.icon)}
                </Cell>
              ))}
              {orphans ? <Cell lane="">{marks('', null)}</Cell> : null}
              <Cell lane="+" />
            </DayRow>
          );
        })}

        <div ref={sentinel} data-grid-end className="col-span-full h-px" />
      </div>
    </div>
  );
});

/** A day's row: its label on the rail, then a cell per column. */
function DayRow({
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
      {/* The rail reads quieter than the marks: one readable opacity (review).
          A day row is at least ROW_PX tall and as tall as its fullest cell,
          so stacked marks grow the row rather than spill into the next. */}
      <div
        data-day-row={day}
        data-labelled=""
        className="bg-main-900 sticky left-0 z-10 flex flex-col justify-center gap-0.5 py-2 pr-2 pl-6 text-white/70"
        style={{ minHeight: ROW_PX }}
      >
        {monthChanges ? (
          <span data-month-label className="text-[8px]/none font-medium text-white/50">
            {day.slice(0, 4)}
            <br />
            {monthAbbrev(day)}
          </span>
        ) : null}
        <span className="text-sm/none font-medium tabular-nums">{Number(day.slice(8, 10))}</span>
        <span className="text-[8px]/none font-medium text-white/50">{weekdayOf(day)}</span>
      </div>
      {children}
    </>
  );
}

/** A run of empty days, compressed to one short row of empty ropes: the rail says nothing. */
function GapRow({
  from,
  to,
  columns,
  plus,
}: {
  from: IsoDate;
  to: IsoDate;
  columns: number;
  plus: boolean;
}) {
  return (
    <>
      <div
        data-day-row={from}
        data-day-to={to}
        data-gap=""
        className="bg-main-900 sticky left-0 z-10"
        style={{ height: GAP_PX }}
      />
      {columns === 0 ? <div /> : null}
      {Array.from({ length: columns }, (_, at) => (
        <Cell key={at} lane="" first={at === 0} />
      ))}
      {plus ? <Cell lane="+" /> : null}
    </>
  );
}

/** The row that holds a day: its own, or the gap its run is compressed into. */
function rowHolding(scroller: HTMLElement, day: IsoDate): HTMLElement | null {
  for (const row of scroller.querySelectorAll<HTMLElement>('[data-day-row]')) {
    const from = row.getAttribute('data-day-row') ?? '';
    const to = row.getAttribute('data-day-to') ?? from;
    if (day <= from && day >= to) return row;
  }
  return null;
}

/**
 * A cell: the rope along its left edge — a lane line runs beside the lane,
 * never through its marks (review), and the first lane has none at the
 * rail's side — and the day's marks on that lane stacked 4px apart, centred
 * in the row. The `+` column's rope closes the last lane.
 */
function Cell({
  lane,
  first = false,
  children,
}: {
  lane: string;
  first?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      data-cell={lane}
      className="relative flex h-full flex-col items-center justify-center gap-1 py-2"
    >
      {first ? null : (
        <span
          aria-hidden
          data-rope
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/15"
        />
      )}
      {children}
    </div>
  );
}

/**
 * A post's mark: a white disc with its lane's emoji, solid for the post on
 * top of the board and translucent for every other, the ring around it
 * when Home says so. A
 * post on no lane of mine has no emoji to show, so its disc is an outline —
 * a seat with nothing on it, never a blank white coin.
 */
function Mark({
  card,
  icon,
  dived,
  ring,
  titled,
  onPick,
}: {
  card: Card;
  icon: string | null;
  dived: boolean;
  /** The ring's sequence number while it plays here, else null. */
  ring: number | null;
  /** The short title beneath the mark, two lines at most (round 3). */
  titled: boolean;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const surface = !icon ? 'border border-white/60' : dived ? 'bg-white/20' : 'bg-white';
  const disc = (
    <span className="relative flex items-center justify-center">
      {ring !== null ? (
        <span
          key={ring}
          aria-hidden
          data-commit-ripple
          // White on the water (H21c), and never shrunk to the mark's width.
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
        >
          <span className="flex shrink-0">
            <CommitRing size={RING_PX} contentSize={MARK_PX} gap={6} once />
          </span>
        </span>
      ) : null}
      <button
        type="button"
        data-mark={card.splash.id}
        data-dived={dived ? '' : undefined}
        data-ring={ring !== null ? '' : undefined}
        aria-label={title}
        onClick={() => onPick(card.splash.id)}
        className={`relative flex shrink-0 items-center justify-center rounded-full text-sm/none ${surface}`}
        style={{ width: MARK_PX, height: MARK_PX }}
      >
        {icon ? (
          <span aria-hidden className={`leading-none ${dived ? 'opacity-60' : ''}`}>
            {icon}
          </span>
        ) : null}
      </button>
    </span>
  );
  if (!titled) return disc;
  return (
    <span className="flex w-full min-w-0 flex-col items-center gap-1 px-1">
      {disc}
      <button
        type="button"
        tabIndex={-1}
        data-mark-title={card.splash.id}
        onClick={() => onPick(card.splash.id)}
        className={`line-clamp-2 w-full text-center text-[10px]/tight font-medium break-words text-white ${
          dived ? 'opacity-60' : ''
        }`}
      >
        {title}
      </button>
    </span>
  );
}

/**
 * A post in the Date view (round 3): one pill per line, full width — the
 * icon on a disc, the title, the lane as a chip — translucent like a mark
 * when it is not on top, the ring around its icon when Home says so.
 */
function Pill({
  card,
  lane,
  dived,
  ring,
  onPick,
}: {
  card: Card;
  lane: MyCategory | null;
  dived: boolean;
  ring: number | null;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  return (
    <button
      type="button"
      data-pill={card.splash.id}
      data-dived={dived ? '' : undefined}
      data-ring={ring !== null ? '' : undefined}
      onClick={() => onPick(card.splash.id)}
      className={`flex w-full min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-2 pl-1.5 text-left ${
        dived ? 'bg-white/15 text-white' : 'text-ink bg-white'
      }`}
    >
      <span className="relative flex shrink-0 items-center justify-center">
        {ring !== null ? (
          <span
            key={ring}
            aria-hidden
            data-commit-ripple
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
          >
            <span className="flex shrink-0">
              <CommitRing size={RING_PX} contentSize={MARK_PX} gap={6} once />
            </span>
          </span>
        ) : null}
        <span
          aria-hidden
          className={`relative flex items-center justify-center rounded-full text-sm/none ${
            dived ? 'bg-white/20' : 'bg-pool-100'
          }`}
          style={{ width: MARK_PX, height: MARK_PX }}
        >
          {lane?.icon ?? ''}
        </span>
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm font-semibold ${
          card.splash.title.trim() ? '' : 'opacity-50'
        }`}
      >
        {title}
      </span>
      {lane ? <OutlineChip icon={lane.icon} name={lane.name} className="opacity-90" /> : null}
    </button>
  );
}

/** The element a post shows as on either view: its mark, or its pill. */
function markSelector(id: string): string {
  const escaped = CSS.escape(id);
  return `[data-mark="${escaped}"], [data-pill="${escaped}"]`;
}

/** An element's position within the scroller's content. */
function offsetIn(el: HTMLElement, scroller: HTMLElement): { top: number; left: number } {
  const a = el.getBoundingClientRect();
  const b = scroller.getBoundingClientRect();
  return { top: a.top - b.top + scroller.scrollTop, left: a.left - b.left + scroller.scrollLeft };
}

function headerHeight(scroller: HTMLElement): number {
  return scroller.querySelector<HTMLElement>('[data-grid-header]')?.offsetHeight ?? 0;
}

function scrollWithin(
  el: HTMLElement,
  target: { top?: number; left?: number },
  reducedMotion: boolean,
): void {
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ ...target, behavior: reducedMotion ? 'instant' : 'smooth' });
    return;
  }
  if (target.top !== undefined) el.scrollTop = target.top;
  if (target.left !== undefined) el.scrollLeft = target.left;
}
