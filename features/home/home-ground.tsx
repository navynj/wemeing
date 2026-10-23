'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import { CategorySheet } from '@/features/lanes/category-sheet';
import { LanesSheet } from '@/features/lanes/lanes-sheet';
import { SessionsSheet } from '@/features/sessions/sessions-sheet';
import type { Session } from '@/features/sessions/shelves';
import type { SplashSummary } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';
import type { IsoDate } from '@/lib/time';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { DivingBoard } from './diving-board';
import { byNewest, newestIn, placeCard, type Card } from './grid';
import { LaneGrid } from './lane-grid';
import { PinnedBar } from './pinned-bar';
import { useFlip } from './use-flip';

/** How long the commit ripple is given at a new post's mark once the real one has landed. */
const RING_MS = 1800;

/**
 * Home, the water ground (SPEC 5, H22; `_docs/mockups/home-grid-stack.png`):
 * one solid #0507C9 surface in two linked halves. Above, the lane grid — a
 * map of recent records, lanes across and days down. Below, the diving
 * board — the newest posts as a stack of cards, read in full and flipped
 * through. The post on top of the stack is the one with the ring at its
 * mark; flipping moves the ring, tapping a mark brings its card up, and a
 * post just dropped does both at once. Between them the pinned bar, when
 * anything is pinned.
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [newLane, setNewLane] = useState(false);
  const [editingLanes, setEditingLanes] = useState(false);
  const { openSheet, pendingDrop, clearDropped, dropMessage, pendingDeletes } = useInputSheet();
  const lanes = useOptimisticAction(categories);

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
  const flip = useFlip(
    ids,
    (scrollToMonth ? newestIn(shown, scrollToMonth)?.splash.id : null) ?? ids[0] ?? null,
  );
  const topId = flip.order[0] ?? null;

  // A post just dropped lands on top of the stack, on the spring.
  const droppedId = pendingDrop?.splash.id ?? null;
  const { bringForward } = flip;
  useEffect(() => {
    if (droppedId) bringForward(droppedId);
    // The drop is the event; the flip's identity changing is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedId]);

  // `?m=` while the ground is already open: the month's newest post comes up.
  const monthTop = scrollToMonth ? (newestIn(shown, scrollToMonth)?.splash.id ?? null) : null;
  useEffect(() => {
    if (monthTop) bringForward(monthTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToMonth]);

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
          cards={shown}
          categories={lanes.value}
          today={today}
          topId={topId}
          initials={initials}
          scrollToMonth={scrollToMonth}
          onPick={bringForward}
          onEditLanes={() => setEditingLanes(true)}
          onCreateLane={() => setNewLane(true)}
        />

        <div className="shrink-0 px-6">
          <PinnedBar
            pinned={pinned.filter((p) => !pendingDeletes.includes(p.id))}
            categories={lanes.value}
            month={today.slice(0, 7)}
          />
        </div>

        <DivingBoard
          cards={shown}
          flip={flip}
          categories={lanes.value}
          initials={initials}
          onDrop={openSheet}
        />
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
