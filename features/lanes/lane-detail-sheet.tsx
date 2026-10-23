'use client';

import Link from 'next/link';

import { COLUMN_MAX_WIDTH } from '@/components/ui/column';
import { cardDate, type Card } from '@/features/home/grid';
import { splashHref } from '@/features/home/scope';
import { monthKey } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';

/**
 * A lane's detail (H22 review): opened from its header on the grid, a white
 * bottom sheet on the dimmed ground — the lane's emoji and name, how many
 * posts it holds, and every one of them as a list, newest first, each its
 * title and date, opening the post's page. Not icons alone: the titles.
 * Editing the lanes stays behind the `=` and the title menu.
 */
export function LaneDetailSheet({
  lane,
  cards,
  onClose,
}: {
  lane: MyCategory;
  /** This lane's posts, newest first. */
  cards: Card[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-main-900/60 scrim-in absolute inset-0"
      />
      <section
        role="dialog"
        aria-label={lane.name}
        data-lane-detail={lane.id}
        className={`sheet-rise relative mx-auto flex max-h-[calc(100dvh-env(safe-area-inset-top,0px)-2rem)] w-full ${COLUMN_MAX_WIDTH} flex-col overflow-hidden rounded-t-[32px] bg-white`}
      >
        <div
          className="flex min-h-0 flex-col overflow-y-auto px-6 pt-7"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <header className="flex items-center gap-3 pb-5">
            <span aria-hidden className="text-3xl/none">
              {lane.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <h2 className="text-ink truncate text-2xl font-semibold">{lane.name}</h2>
              <span className="text-pool-500 text-xs tabular-nums">
                {cards.length} post{cards.length === 1 ? '' : 's'}
              </span>
            </span>
          </header>

          {cards.length === 0 ? (
            <p className="text-pool-500 py-10 text-center text-sm">Nothing on this lane yet.</p>
          ) : (
            <ol data-lane-posts className="flex flex-col">
              {cards.map((card) => {
                const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
                return (
                  <li key={card.splash.id} className="border-pool-100 border-t first:border-t-0">
                    <Link
                      href={splashHref(card.splash.id, monthKey(card.day))}
                      data-lane-post={card.splash.id}
                      className="flex items-baseline justify-between gap-4 py-3.5"
                    >
                      <span
                        className={`text-ink min-w-0 truncate text-base font-medium ${
                          card.splash.title.trim() ? '' : 'opacity-40'
                        }`}
                      >
                        {title}
                      </span>
                      <span className="text-pool-500 shrink-0 text-xs tabular-nums">
                        {cardDate(card.day)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
