'use client';

import { CommitRing } from '@/components/ui/waves';
import type { MyCategory } from '@/lib/queries/profile';

import { cardDate, postIcon, type Card } from './grid';

/** The icon disc's diameter, and the ring's bound around it. */
const DISC_PX = 28;
const RING_PX = 96;

/**
 * A post as a row (review): in the Date view and on a lane page — no pill
 * background, only a faint white line beneath each row. The post the stack
 * is reading is the one row at full white, its icon on a white disc; every
 * other row sits back, as every other mark does on the grid. The ring plays
 * around the icon when Home says so. A tap brings the post to the top of
 * the stack.
 */
export function PostRow({
  card,
  lane,
  current,
  ring,
  lead,
  onPick,
}: {
  card: Card;
  lane: MyCategory | null;
  /** The post the stack is reading: the one row at full white. */
  current: boolean;
  /** The ring's sequence number while it plays here, else null. */
  ring: number | null;
  /** What leads the row: the lane as a chip at the end (Date view), or the date first (a lane page). */
  lead: 'lane' | 'date';
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const glyph = postIcon(card.splash, lane);
  return (
    <button
      type="button"
      data-pill={card.splash.id}
      data-dived={current ? undefined : ''}
      data-ring={ring !== null ? '' : undefined}
      onClick={() => onPick(card.splash.id)}
      className={`flex w-full min-w-0 items-center gap-3 border-b border-white/15 py-2.5 text-left text-white ${
        current ? '' : 'opacity-60'
      }`}
    >
      {lead === 'date' ? (
        <span className="w-24 shrink-0 text-xs text-white/70 tabular-nums">
          {cardDate(card.day)}
        </span>
      ) : null}
      <span className="relative flex shrink-0 items-center justify-center">
        {ring !== null ? (
          <span
            key={ring}
            aria-hidden
            data-commit-ripple
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
          >
            <span className="flex shrink-0">
              <CommitRing size={RING_PX} contentSize={DISC_PX} gap={6} once />
            </span>
          </span>
        ) : null}
        <span
          aria-hidden
          className={`relative flex items-center justify-center rounded-full text-sm/none ${
            current ? 'bg-white' : 'bg-white/20'
          }`}
          style={{ width: DISC_PX, height: DISC_PX }}
        >
          {glyph ?? ''}
        </span>
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm font-semibold ${
          card.splash.title.trim() ? '' : 'opacity-60'
        }`}
      >
        {title}
      </span>
      {lead === 'lane' && lane ? (
        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-white/25 px-2 text-[10px] text-white/80">
          {lane.icon ? <span aria-hidden>{lane.icon}</span> : null}
          {lane.name}
        </span>
      ) : null}
    </button>
  );
}
