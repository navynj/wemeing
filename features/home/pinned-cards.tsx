'use client';

import { useRef } from 'react';

import { useAxisLock } from '@/components/ui/use-axis-lock';
import type { MyCategory } from '@/lib/queries/profile';

import { cardLane, type Card } from './grid';

/**
 * Pinned posts as cards (round 3), replacing the black strip: white at 15%
 * on the water, rounded like the stack's cards, each its lane chip, title,
 * and one line of its words after the author's initials. One card wide;
 * with several, a horizontal snap scroller with the next card peeking at
 * the right edge. A tap brings that post to the top of the stack, and the
 * grid or the list scrolls to it with the ring. Unpinning stays in the top
 * card's menu. Absent when nothing is pinned.
 */
export function PinnedCards({
  slot,
  cards,
  categories,
  initials,
  onPick,
}: {
  /** Which slot this is: under the header (phone) or above the stack (wide); CSS shows one. */
  slot: 'phone' | 'wide';
  /** Pinned posts, most recently pinned first. */
  cards: Card[];
  categories: MyCategory[];
  initials: string;
  onPick: (id: string) => void;
}) {
  const strip = useRef<HTMLOListElement>(null);
  useAxisLock(strip);
  if (cards.length === 0) return null;
  const several = cards.length > 1;
  return (
    <nav
      aria-label="Pinned"
      data-pinned-cards={slot}
      className={`shrink-0 ${slot === 'phone' ? 'lg:hidden' : 'hidden lg:block'}`}
    >
      <ol
        ref={strip}
        className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-3"
        style={{ scrollPaddingLeft: 16 }}
      >
        {cards.map((card) => {
          const lane = categories.find((c) => c.id === cardLane(card.splash)) ?? null;
          const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
          const excerpt = card.ripples[0]?.note ?? card.body;
          return (
            <li
              key={card.splash.id}
              className={`shrink-0 snap-start ${several ? 'w-[calc(100%-2.5rem)]' : 'w-full'}`}
            >
              <button
                type="button"
                data-pinned-card={card.splash.id}
                onClick={() => onPick(card.splash.id)}
                className="flex w-full flex-col gap-1.5 rounded-[24px] bg-white/15 px-4 py-3 text-left text-white"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {lane ? (
                    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 text-[10px]">
                      {lane.icon ? <span aria-hidden>{lane.icon}</span> : null}
                      {lane.name}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {card.splash.icon ? <span aria-hidden>{card.splash.icon} </span> : null}
                    {title}
                  </span>
                </span>
                {excerpt ? (
                  <span className="flex min-w-0 items-center gap-2 text-xs text-white/70">
                    <span
                      aria-hidden
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[7px] font-medium"
                    >
                      {initials}
                    </span>
                    <span className="min-w-0 truncate">{excerpt}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
