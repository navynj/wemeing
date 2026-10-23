'use client';

import Link from 'next/link';

import { OutlineChip } from '@/components/ui/chips/category-chip';
import { splashHref } from '@/features/home/scope';
import { DETAIL_TITLE_CLASS } from '@/features/splash/splash-header';
import { monthKey } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';

import { cardDate, type Card } from './grid';

/** The top card's height, fixed so the grid above never moves when the stack changes. */
export const CARD_PX = 200;
/** A card's padding, the same on top, at the sides and at the bottom (review). */
export const CARD_PAD_PX = 20;
/** A peeking card's edge: one line — this much padding, the emoji, the title, nothing else. */
export const EDGE_PAD_PX = { top: 8, bottom: 12 } as const;
/** Each step back tints the white face this much toward the water. */
export const TINT_STEP = 0.08;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** White stepped toward #0507C9 by `tint`: the depth cue of a card behind another. */
export function face(tint: number): string {
  const t = clamp01(tint);
  return `rgb(${Math.round(lerp(255, 5, t))}, ${Math.round(lerp(255, 7, t))}, ${Math.round(lerp(255, 201, t))})`;
}

/**
 * What a card reads (H22, review): on the top card, the emoji with the
 * title in blue at the detail title's size, then the date with its weekday
 * and the lane as an outline chip, the author's initials, and the body —
 * every block's words oldest first, a long one sinking into the face's own
 * colour. A card on a stair shows only its title line, small, on the edge
 * that peeks out: its top edge above the top card, its bottom edge below.
 * Tap = the post's page. Shared by both boards.
 */
export function CardFace({
  card,
  lane,
  initials,
  edge,
  ink = 'blue',
  onClickCapture,
}: {
  card: Card;
  lane: MyCategory | null;
  initials: string;
  /** Everything, or the title line on the edge that shows. */
  edge: 'full' | 'top' | 'bottom';
  /** The title's colour: blue on a pale face, white on a card in the water. */
  ink?: 'blue' | 'white';
  onClickCapture?: (event: React.MouseEvent) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const titleLine = (
    <span
      data-card-title
      className={`flex min-w-0 shrink-0 items-center gap-1.5 ${
        ink === 'white' ? 'text-white' : 'text-main-900'
      } ${edge === 'full' ? `${DETAIL_TITLE_CLASS} pr-8 leading-tight` : 'text-sm/none font-semibold'}`}
      style={ink === 'white' ? { opacity: 'var(--ink-opacity, 0.6)' } : undefined}
    >
      {lane?.icon ? <span aria-hidden>{lane.icon}</span> : null}
      <span className={`truncate ${card.splash.title.trim() ? '' : 'opacity-40'}`}>{title}</span>
    </span>
  );
  if (edge !== 'full') {
    return (
      <span
        aria-hidden
        className={`flex h-full flex-col px-5 ${edge === 'top' ? 'justify-start' : 'justify-end'}`}
        style={{ paddingTop: EDGE_PAD_PX.top, paddingBottom: EDGE_PAD_PX.bottom }}
      >
        {titleLine}
      </span>
    );
  }
  return (
    <Link
      href={splashHref(card.splash.id, monthKey(card.day))}
      data-card-link={card.splash.id}
      onClickCapture={onClickCapture}
      draggable={false}
      className="flex h-full flex-col gap-1.5 px-5"
      style={{ paddingTop: CARD_PAD_PX, paddingBottom: CARD_PAD_PX }}
    >
      {titleLine}
      <span className="flex items-start justify-between gap-3">
        <span data-card-date className="text-main-900 text-sm font-medium tabular-nums">
          {cardDate(card.day)}
        </span>
        {lane ? <OutlineChip icon={lane.icon} name={lane.name} /> : null}
      </span>
      <span className="relative flex min-h-0 flex-1 items-start gap-2 overflow-hidden">
        <span
          aria-hidden
          className="bg-pool-100 text-pool-500 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-medium"
        >
          {initials}
        </span>
        <span
          data-card-body
          className="text-ink/80 min-w-0 flex-1 text-[13px]/relaxed whitespace-pre-wrap"
        >
          {card.body}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--face, #fff))' }}
        />
      </span>
    </Link>
  );
}
