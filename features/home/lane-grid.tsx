'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

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
/** The mark's diameter, and the ring's bound around the one on top of the stack. */
const MARK_PX = 28;
const RING_PX = 96;
/** How long a smooth scroll to the mark is given before its ring plays, so the ring is seen. */
const SCROLL_MS = 350;

/**
 * The lane grid (H22; `_docs/mockups/home-grid-stack.png`): a map of recent
 * records. One column per lane in the author's order, each headed by its
 * emoji over its name with a thin rope running down it; one row per day,
 * newest at the top, named on a fixed rail at the left (the day number and
 * weekday, the year and month only where the month changes). A post is a
 * white disc carrying its lane's emoji, centred on its column at its day;
 * several on one lane and day stack within the row. Empty days are rows of
 * empty ropes — the empty state is the water itself.
 *
 * One scroll container, both axes: the rail is sticky at the left and the
 * lane headers sticky at the top, so a vertical drag anywhere scrolls days
 * and a horizontal one scrolls columns only, with nothing synchronised in
 * script. The avatar above the headers scrolls away with the days, which is
 * what keeps three rows above the stack on a short phone. With up to
 * `EVEN_COLUMNS_MAX` lanes the columns share the width and the group sits
 * centred; past that each column is fixed and the columns scroll sideways.
 *
 * The rendered window of days grows as the bottom comes into view, from the
 * top day back to the oldest post's month. The post on top of the stack has
 * the one-time ripple at its mark, replayed each time a new card lands, and
 * the grid scrolls so that mark is in view.
 */
export function LaneGrid({
  cards,
  categories,
  today,
  topId,
  initials,
  scrollToMonth,
  onPick,
  onEditLanes,
  onCreateLane,
}: {
  /** Newest first. */
  cards: Card[];
  categories: MyCategory[];
  today: IsoDate;
  /** The post on top of the stack: its mark carries the ring. */
  topId: string | null;
  initials: string;
  /** `?m=`: the month to scroll the grid to; the newest day of it lands under the headers. */
  scrollToMonth: string | null;
  onPick: (id: string) => void;
  onEditLanes: () => void;
  onCreateLane: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  // The mark the ring plays at: the top card's, once it has been brought into view.
  const [ringAt, setRingAt] = useState<string | null>(null);

  const { top, floor } = gridBounds(cards, today);
  const allDays = useMemo(() => daysDown(top, floor), [top, floor]);
  const [grown, setLimit] = useState(() =>
    Math.max(WINDOW_MIN, daysDown(top, `${monthKey(top)}-01`).length),
  );

  const orphans = cards.some((card) => isOrphanCard(card, categories));
  const columns = categories.length + (orphans ? 1 : 0);
  const even = columns <= EVEN_COLUMNS_MAX;
  const template = `${RAIL_PX}px repeat(${Math.max(columns, 1)}, ${
    even ? 'minmax(0, 1fr)' : `${FIXED_COLUMN_PX}px`
  }) ${PLUS_PX}px`;

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

  // The month asked for and the mark on top are always within the window,
  // which reaches down to them: the window is the larger of the two.
  const topCard = cards.find((card) => card.splash.id === topId) ?? null;
  const monthDay = scrollToMonth
    ? (allDays.find((day) => monthKey(day) === scrollToMonth) ?? null)
    : null;
  const needed = Math.max(
    topCard ? allDays.indexOf(topCard.day) + 1 : 0,
    monthDay ? allDays.indexOf(monthDay) + 1 : 0,
  );
  const limit = Math.max(grown, needed);
  const days = allDays.slice(0, limit);

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

  // `?m=`: the month's newest day lands just under the headers.
  const scrolledMonth = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !scrollToMonth || !monthDay) return;
    if (scrolledMonth.current === scrollToMonth) return;
    const row = el.querySelector<HTMLElement>(`[data-day-row="${monthDay}"]`);
    if (!row) return;
    scrolledMonth.current = scrollToMonth;
    scrollWithin(el, { top: offsetIn(row, el).top - headerHeight(el) }, reducedMotion);
  }, [scrollToMonth, monthDay, reducedMotion]);

  // The ring never plays off screen: the mark on top is scrolled into view
  // first, and the ring starts once the scroll has had time to land.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !topId) return;
    const mark = el.querySelector<HTMLElement>(`[data-mark="${CSS.escape(topId)}"]`);
    if (!mark) return;
    let scrolled = false;
    const { top: markTop, left: markLeft } = offsetIn(mark, el);
    const header = headerHeight(el);
    const target: { top?: number; left?: number } = {};
    if (markTop < el.scrollTop + header) target.top = markTop - header - 8;
    else if (markTop + mark.offsetHeight > el.scrollTop + el.clientHeight) {
      target.top = markTop + mark.offsetHeight - el.clientHeight + 8;
    }
    if (markLeft < el.scrollLeft + RAIL_PX) target.left = markLeft - RAIL_PX - 8;
    else if (markLeft + mark.offsetWidth > el.scrollLeft + el.clientWidth) {
      target.left = markLeft + mark.offsetWidth - el.clientWidth + 8;
    }
    if (target.top !== undefined || target.left !== undefined) {
      scrollWithin(el, target, reducedMotion);
      scrolled = !reducedMotion;
    }
    const timer = window.setTimeout(() => setRingAt(topId), scrolled ? SCROLL_MS : 0);
    return () => window.clearTimeout(timer);
  }, [topId, reducedMotion]);

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
        style={{ gridTemplateColumns: template }}
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

        {/* The lane headers: sticky at the top, on the water so rows pass beneath. */}
        <div
          data-grid-header
          className="bg-main-900 sticky top-0 left-0 z-30"
          style={{ gridColumn: 1 }}
        />
        {categories.map((lane) => (
          <button
            key={lane.id}
            type="button"
            data-lane-header={lane.id}
            onClick={onEditLanes}
            className="bg-main-900 sticky top-0 z-20 flex flex-col items-center gap-0.5 px-0.5 pb-2 text-white"
          >
            <span aria-hidden className="text-2xl/none">
              {lane.icon}
            </span>
            <span className="max-w-full truncate text-[11px]/tight font-semibold">{lane.name}</span>
          </button>
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

        {days.map((day, index) => {
          const monthChanges = index === 0 || monthKey(days[index - 1]) !== monthKey(day);
          return (
            <DayRow key={day} day={day} monthChanges={monthChanges}>
              {categories.map((lane) => (
                <Cell key={lane.id} lane={lane.id}>
                  {(byCell.get(`${day}|${lane.id}`) ?? []).map((card) => (
                    <Mark
                      key={card.splash.id}
                      card={card}
                      icon={lane.icon}
                      ring={card.splash.id === ringAt}
                      onPick={onPick}
                    />
                  ))}
                </Cell>
              ))}
              {orphans ? (
                <Cell lane="">
                  {(byCell.get(`${day}|`) ?? []).map((card) => (
                    <Mark
                      key={card.splash.id}
                      card={card}
                      icon={null}
                      ring={card.splash.id === ringAt}
                      onPick={onPick}
                    />
                  ))}
                </Cell>
              ) : null}
              <Cell lane="+" />
            </DayRow>
          );
        })}

        <div ref={sentinel} data-grid-end className="col-span-full h-px" />
      </div>
    </div>
  );
}

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
      <div
        data-day-row={day}
        className="bg-main-900 sticky left-0 z-10 flex min-h-12 flex-col justify-center py-1.5 pl-6 text-white"
      >
        {monthChanges ? (
          <span data-month-label className="text-[8px]/none font-medium text-white/60">
            {day.slice(0, 4)}
            <br />
            {monthAbbrev(day)}
          </span>
        ) : null}
        <span className="text-sm/none font-medium tabular-nums">{Number(day.slice(8, 10))}</span>
        <span className="text-[8px]/none font-medium text-white/60">{weekdayOf(day)}</span>
      </div>
      {children}
    </>
  );
}

/** A cell: the rope through it, and the day's marks on that lane stacked. */
function Cell({ lane, children }: { lane: string; children?: ReactNode }) {
  return (
    <div
      data-cell={lane}
      className="relative flex min-h-12 flex-col items-center justify-center gap-1 py-1.5"
    >
      <span
        aria-hidden
        data-rope
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15"
      />
      {children}
    </div>
  );
}

/** A post's mark: a white disc with its lane's emoji; the ring around the one on top. */
function Mark({
  card,
  icon,
  ring,
  onPick,
}: {
  card: Card;
  icon: string | null;
  ring: boolean;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  return (
    <span className="relative flex items-center justify-center">
      {ring ? (
        <span
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
        data-ring={ring ? '' : undefined}
        aria-label={title}
        onClick={() => onPick(card.splash.id)}
        className="relative flex items-center justify-center rounded-full bg-white text-sm/none"
        style={{ width: MARK_PX, height: MARK_PX }}
      >
        {icon ? <span aria-hidden>{icon}</span> : null}
      </button>
    </span>
  );
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
