'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';

import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import { deleteRipple } from '@/features/ripple-sheet/actions';
import { deleteSplash, setSplashPinned } from '@/features/splash/actions';
import { CategorySheet } from '@/features/lanes/category-sheet';
import { LanesSheet } from '@/features/lanes/lanes-sheet';
import { SessionsSheet } from '@/features/sessions/sessions-sheet';
import type { Session } from '@/features/sessions/shelves';
import type { SplashSummary } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';
import type { IsoDate } from '@/lib/time';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { FlipBoard } from './diving-board-flip';
import { byNewest, newestIn, placeCard, type Card } from './grid';
import { LaneGrid, type GridHandle, type Ring } from './lane-grid';
import { PinnedBar } from './pinned-bar';
import { StairBoard } from './stair-board';
import { useFlip } from './use-flip';

/**
 * Which board Home shows (review, 2026-10-22): the **stair** — read cards
 * stepping up above the top card, unread stepping down below — or the
 * **page turn** onto a pile of strips. Both stay in the tree; this one word
 * decides.
 */
export type Board = 'stair' | 'flip';
export const BOARD: Board = 'stair';

/** How long the commit ripple is given at a new post's mark once the real one has landed. */
const RING_MS = 1800;

/**
 * Home, the water ground (SPEC 5, H22; `_docs/mockups/home-grid-stack.png`):
 * one solid #0507C9 surface in two linked halves. Above, the lane grid — a
 * map of recent records, lanes across and days down. Below, the diving
 * board — the posts as a staircase around the top card, read cards above
 * and unread below (or, on the page-turn board, a pile beneath). The ring
 * plays at the mark of whichever card comes to the top; tapping a mark
 * brings its card there. Between them the pinned bar, when anything is
 * pinned; beneath, the compose `+` at the bottom right.
 *
 * The title opens the ground's menu: the Locker, the sessions sheet and the
 * lanes sheet. The Home dropdown's pool switching is P3's; nothing here
 * anticipates it.
 *
 * A post just dropped is on the grid and on top of the stack before the
 * server has it (CLAUDE.md, the principle); lanes edited in the lanes sheet
 * read edited at once; a post deleted a moment ago is gone.
 */
export function HomeGround({
  cards,
  pinned,
  categories,
  sessions,
  counts,
  customCounts,
  earliestYear,
  today,
  timeZone,
  initials,
  scrollToMonth,
  board = BOARD,
}: {
  /** Newest first. */
  cards: Card[];
  pinned: SplashSummary[];
  categories: MyCategory[];
  sessions: Session[];
  /** Posts per month, for the sessions sheet. */
  counts: Record<string, number>;
  customCounts: Record<string, number>;
  earliestYear: number;
  today: IsoDate;
  timeZone: string;
  initials: string;
  /** `?m=`: the month the ground opens on, its newest post on top. */
  scrollToMonth: string | null;
  board?: Board;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [newLane, setNewLane] = useState(false);
  const [editingLanes, setEditingLanes] = useState(false);
  const { openSheet, pendingDrop, clearDropped, dropMessage, pendingDeletes, markDeleted } =
    useInputSheet();
  const router = useRouter();
  const lanes = useOptimisticAction(categories);
  // Pinned from the card's menu shows on the bar at once (CLAUDE.md, the principle).
  const pins = useOptimisticAction(pinned);
  const pinnedIds = useMemo(() => new Set(pins.value.map((p) => p.id)), [pins.value]);
  const pin = (card: Card, on: boolean): void =>
    pins.run(
      (current) =>
        on
          ? [{ ...card.splash, pinnedAt: new Date().toISOString() }, ...current]
          : current.filter((p) => p.id !== card.splash.id),
      () => setSplashPinned(card.splash.id, on),
    );
  // Gone the moment it is asked for, from every surface; a lone block is its own post.
  const remove = (card: Card): void => {
    markDeleted(card.splash.id);
    void (card.splash.orphan ? deleteRipple(card.splash.id) : deleteSplash(card.splash.id)).then(
      (result) => {
        if (result.ok) router.refresh();
      },
    );
  };
  const grid = useRef<GridHandle>(null);

  // The post just dropped takes its place before the server has it; once the
  // real row is on the ground the optimistic one steps aside. A post deleted
  // a moment ago is gone before the re-read.
  const landed =
    pendingDrop !== null && cards.some(({ splash }) => splash.id === pendingDrop.splash.id);
  const shown = useMemo(() => {
    const kept = cards.filter(({ splash }) => !pendingDeletes.includes(splash.id));
    if (!pendingDrop || landed) return kept;
    return [...kept, placeCard(pendingDrop.splash, pendingDrop.note ?? '', timeZone)].sort(
      byNewest,
    );
  }, [cards, pendingDeletes, pendingDrop, landed, timeZone]);

  useEffect(() => {
    if (!landed) return;
    const timer = window.setTimeout(clearDropped, RING_MS);
    return () => window.clearTimeout(timer);
  }, [landed, clearDropped]);

  const ids = useMemo(() => shown.map((card) => card.splash.id), [shown]);
  // What opens on top: the month's newest post under `?m=`, else the newest.
  const [initialTop] = useState(
    () => (scrollToMonth ? newestIn(shown, scrollToMonth)?.splash.id : null) ?? ids[0] ?? null,
  );
  const flip = useFlip(ids, initialTop, board === 'stair' ? -1 : 1);
  const { topId, n, bringForward } = flip;
  const goTo = bringForward;

  // The ring: at the mark of whichever card comes to the top, at a drop,
  // and on open at the post on top — which is also what scrolls the grid
  // to it (review: under `?m=` that is the month's post, not the newest).
  const [ring, setRing] = useState<Ring | null>(() =>
    initialTop ? { id: initialTop, seq: 0 } : null,
  );
  const seq = useRef(0);
  const ringAt = (id: string): void => {
    seq.current += 1;
    setRing({ id, seq: seq.current });
  };
  const previousTop = useRef(topId);
  useEffect(() => {
    if (topId && topId !== previousTop.current) ringAt(topId);
    previousTop.current = topId;
    // The top changing is the event; the rest is read when it fires.
  }, [topId]);

  // A post just dropped lands on top of the stack, on the spring, ringed.
  const droppedId = pendingDrop?.splash.id ?? null;
  useEffect(() => {
    if (!droppedId) return;
    goTo(droppedId);
    ringAt(droppedId);
    // The drop is the event; the flip's identity changing is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedId]);

  // `?m=` while the ground is already open: the month's newest post comes up.
  const monthTop = scrollToMonth ? (newestIn(shown, scrollToMonth)?.splash.id ?? null) : null;
  useEffect(() => {
    if (monthTop) goTo(monthTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToMonth]);

  // The upper stair, read: translucent on the grid.
  const waterIds = useMemo(() => new Set(ids.slice(0, n)), [ids, n]);

  return (
    <div data-home-ground className="water-ground flex min-h-0 flex-1 flex-col">
      <div
        className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <header className="relative flex shrink-0 items-center px-6 pt-4 pb-1">
          <button
            type="button"
            data-home-menu-button
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-1 text-2xl font-semibold text-white"
          >
            Home
            <ChevronDown aria-hidden size={18} className="mt-0.5" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-30"
              />
              {/* The menu in ink: the selection channel on the water. */}
              <ul
                role="menu"
                data-home-menu
                className="bg-ink absolute top-full left-6 z-40 flex w-44 flex-col rounded-xl py-1 text-sm text-white shadow-lg"
              >
                <li>
                  <Link
                    role="menuitem"
                    href="/locker"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5"
                  >
                    Locker
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    data-manage-sessions
                    onClick={() => {
                      setMenuOpen(false);
                      setSessionsOpen(true);
                    }}
                    className="w-full px-4 py-2.5 text-left"
                  >
                    Sessions
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    data-edit-lanes
                    onClick={() => {
                      setMenuOpen(false);
                      setEditingLanes(true);
                    }}
                    className="w-full px-4 py-2.5 text-left"
                  >
                    Lanes
                  </button>
                </li>
              </ul>
            </>
          ) : null}
        </header>

        {dropMessage || lanes.message ? (
          <p role="alert" className="shrink-0 px-6 pb-2 text-sm text-white/80">
            {dropMessage ?? lanes.message}
          </p>
        ) : null}

        <LaneGrid
          ref={grid}
          cards={shown}
          categories={lanes.value}
          today={today}
          ring={ring}
          waterIds={waterIds}
          initials={initials}
          scrollToMonth={scrollToMonth}
          onPick={goTo}
          onEditLanes={() => setEditingLanes(true)}
          onCreateLane={() => setNewLane(true)}
        />

        <div className="shrink-0 px-6">
          <PinnedBar
            pinned={pins.value.filter((p) => !pendingDeletes.includes(p.id))}
            categories={lanes.value}
            month={today.slice(0, 7)}
          />
        </div>

        {board === 'stair' ? (
          <StairBoard
            cards={shown}
            flip={flip}
            categories={lanes.value}
            initials={initials}
            pinnedIds={pinnedIds}
            onPin={pin}
            onDelete={remove}
          />
        ) : (
          <FlipBoard cards={shown} flip={flip} categories={lanes.value} initials={initials} />
        )}

        {/* Compose: the action, in blue, at the bottom right outside the stack. */}
        <div
          className="flex shrink-0 justify-end px-6 pt-2"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            aria-label="Drop a splash"
            data-compose
            onClick={openSheet}
            className="bg-main-900 flex h-12 w-12 items-center justify-center rounded-full text-white"
          >
            <Plus aria-hidden size={24} />
          </button>
        </div>
      </div>

      {sessionsOpen ? (
        <SessionsSheet
          sessions={sessions}
          counts={counts}
          customCounts={customCounts}
          categories={lanes.value}
          earliestYear={earliestYear}
          today={today}
          onClose={() => setSessionsOpen(false)}
        />
      ) : null}

      {newLane ? (
        <CategorySheet category={null} apply={lanes.run} onClose={() => setNewLane(false)} />
      ) : null}
      {editingLanes ? (
        <LanesSheet
          categories={lanes.value}
          apply={lanes.run}
          message={lanes.message}
          onClose={() => setEditingLanes(false)}
        />
      ) : null}
    </div>
  );
}
