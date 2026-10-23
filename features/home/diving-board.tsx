'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useTransform, type PanInfo } from 'motion/react';

import { OutlineChip } from '@/components/ui/chips/category-chip';
import { WaveMark } from '@/components/ui/waves';
import { usePrefersReducedMotion } from '@/components/ui/waves/use-reduced-motion';
import { splashHref } from '@/features/home/scope';
import { monthKey } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';

import { cardDate, cardLane, type Card } from './grid';
import type { Flip } from './use-flip';

/** The tab strip's height: what a card shows of itself while it waits behind the top one. */
export const TAB_PX = 28;
/** The top card's height, fixed so the grid above never moves when cards flip. */
export const CARD_PX = 232;
/** How far the outgoing card dips below its seat on its way back. */
const DIP_PX = 96;
/** How many cards peek above the top one as tabs. */
const TABS = 2;
/** The stack's height: the tabs' strips, the top card's own strip, and its body. */
const STACK_PX = (TABS + 1) * TAB_PX + CARD_PX;

/** The y and scale a card sits at in a slot: 0 the card, 1 and 2 the tabs, deeper ones hidden behind. */
function slotY(slot: number): number {
  return (TABS - Math.min(slot, TABS)) * TAB_PX;
}
function slotScale(slot: number): number {
  return 1 - 0.05 * Math.min(slot, TABS);
}
function slotShown(slot: number): number {
  return slot <= TABS ? 1 : 0;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * The diving board (H22; `_docs/mockups/home-grid-stack.png`): the newest
 * posts as a stack of white cards at the bottom of the water, the top one
 * read in full and the next ones peeking above it as thin tabs — a lane
 * emoji and the title. Drag the top card down, or fling it, to send it to
 * the back and reveal the next; drag a tab down, or tap it, to bring that
 * one forward. The order is cyclic, newest first, so flipping forward walks
 * back in time and round again. Beneath the stack, the one way in: *Drop New
 * Splash* opens the post sheet.
 *
 * Every card's place is a function of the flip's one scalar `p`: the
 * outgoing card scales down and dips below before sliding back behind the
 * tabs, the incoming card rises from its tab and settles with the spring's
 * small overshoot, and the tabs re-stack in the same motion. The outgoing
 * card stays above the rest for the first half, so the incoming one is
 * *revealed* beneath it as it dips, then drops behind the tabs for the
 * second half as it fades. Under reduced motion the cards take their new
 * seats at once and crossfade on `p`.
 */
export function DivingBoard({
  cards,
  flip,
  categories,
  initials,
  onDrop,
}: {
  /** Newest first. */
  cards: Card[];
  flip: Flip;
  categories: MyCategory[];
  initials: string;
  onDrop: () => void;
}) {
  const byId = new Map(cards.map((card) => [card.splash.id, card]));
  const { order, next } = flip;

  // Only what can be seen is rendered: the card, the tabs, and whichever
  // cards are moving between those seats and the back.
  const shown = new Set<string>();
  for (const list of [order, next]) {
    for (const id of list.slice(0, TABS + 1)) shown.add(id);
  }
  if (next !== order && order[0]) shown.add(order[0]);

  return (
    <div data-diving-board className="shrink-0 px-4">
      {cards.length > 0 ? (
        <div
          data-stack
          className="relative overflow-hidden"
          style={{ height: STACK_PX, touchAction: 'none' }}
        >
          {[...shown]
            .map((id) => byId.get(id))
            .filter((card): card is Card => card !== undefined)
            .map((card) => (
              <StackCard
                key={card.splash.id}
                card={card}
                from={order.indexOf(card.splash.id)}
                to={next.indexOf(card.splash.id)}
                depth={cards.length}
                flip={flip}
                lane={categories.find((c) => c.id === cardLane(card.splash)) ?? null}
                initials={initials}
                nextId={order[1] ?? null}
              />
            ))}
        </div>
      ) : null}

      {/* The drop bar: the action, in blue, quiet until pressed. */}
      <button
        type="button"
        data-drop-bar
        onClick={onDrop}
        className={`text-main-900 relative z-20 flex w-full items-center bg-white px-5 text-left text-xl font-semibold ${
          cards.length > 0 ? 'border-pool-100 border-t' : 'rounded-t-[24px]'
        }`}
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <span className="opacity-20">Drop New Splash</span>
      </button>
    </div>
  );
}

function StackCard({
  card,
  from,
  to,
  depth,
  flip,
  lane,
  initials,
  nextId,
}: {
  card: Card;
  /** Its seat now, and once the flip in flight lands. */
  from: number;
  to: number;
  depth: number;
  flip: Flip;
  lane: MyCategory | null;
  initials: string;
  /** The card beneath the top one: a drag on the top card brings this one up. */
  nextId: string | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { p } = flip;
  const moving = from !== to;
  const outgoing = moving && from === 0;
  const incoming = moving && to === 0;

  const y = useTransform(p, (v) => {
    if (!moving || reducedMotion) return slotY(to);
    const c = clamp01(v);
    return lerp(slotY(from), slotY(to), v) + (outgoing ? DIP_PX * 4 * c * (1 - c) : 0);
  });
  const scale = useTransform(p, (v) => {
    if (!moving || reducedMotion) return slotScale(to);
    const c = clamp01(v);
    return lerp(slotScale(from), slotScale(to), v) - (outgoing ? 0.06 * 4 * c * (1 - c) : 0);
  });
  const opacity = useTransform(p, (v) => {
    const c = clamp01(v);
    if (!moving) return slotShown(to);
    if (reducedMotion) return incoming ? c : outgoing ? 1 - c : slotShown(to);
    const a = slotShown(from);
    const b = slotShown(to);
    // Going back fades late; coming up fades early — the card is seen moving.
    if (a > b) return lerp(a, b, Math.max(0, (c - 0.5) * 2));
    if (a < b) return lerp(a, b, Math.min(1, c * 2));
    return a;
  });
  // How much of a tab the card is: 1 waiting behind, 0 on top.
  const stripness = useTransform(p, (v) => {
    if (!moving || reducedMotion) return to === 0 ? 0 : 1;
    return lerp(from === 0 ? 0 : 1, to === 0 ? 0 : 1, clamp01(v));
  });
  const tint = useTransform(stripness, (s) => s * 0.4);
  // Above the rest while it dips, behind the tabs as it slides back.
  const zIndex = useTransform(p, (v) => depth - (moving && v < 0.5 ? from : to));

  // The finger: on the top card it sends it back; on a tab it brings that
  // card up. A tap on a tab does the same on the spring. A pan is never a
  // tap, so the link beneath does not fire on release.
  const panned = useRef(false);
  const onPanStart = (): void => {
    panned.current = true;
    const target = from === 0 ? nextId : card.splash.id;
    if (target) flip.grab(target);
  };
  const onPan = (_: PointerEvent, info: PanInfo): void => flip.move(info.offset.y);
  const onPanEnd = (_: PointerEvent, info: PanInfo): void => {
    flip.release(info.velocity.y);
    window.setTimeout(() => {
      panned.current = false;
    }, 0);
  };
  const guard = (event: React.MouseEvent): void => {
    if (panned.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const href = splashHref(card.splash.id, monthKey(card.day));

  return (
    <motion.div
      data-stack-card={card.splash.id}
      data-slot={from}
      data-to={to}
      className="absolute inset-x-0 top-0 origin-top"
      style={{ y, scale, opacity, zIndex, height: TAB_PX + CARD_PX }}
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
    >
      {/* The tab strip: lavender with white words while waiting, the card's
          own white top edge once on top. */}
      <button
        type="button"
        data-tab={card.splash.id}
        aria-label={`Bring ${title} forward`}
        tabIndex={from === 0 ? -1 : 0}
        onClickCapture={guard}
        onClick={() => from !== 0 && flip.bringForward(card.splash.id)}
        className="relative block w-full overflow-hidden rounded-t-[24px] bg-white text-left"
        style={{ height: TAB_PX }}
      >
        <motion.span
          aria-hidden
          className="bg-main-900 absolute inset-0"
          style={{ opacity: tint }}
        />
        <motion.span
          className="relative flex h-full items-center gap-1.5 px-5 text-xs font-medium text-white"
          style={{ opacity: stripness }}
        >
          {lane?.icon ? <span aria-hidden>{lane.icon}</span> : null}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <WaveMark count={card.splash.count} className="scale-75" />
        </motion.span>
      </button>

      <div className="bg-white" style={{ height: CARD_PX }}>
        <Link
          href={href}
          data-card-link={card.splash.id}
          tabIndex={from === 0 ? 0 : -1}
          onClickCapture={guard}
          draggable={false}
          className="flex h-full flex-col gap-2 px-5 pt-1 pb-4"
        >
          <span className="flex items-start justify-between gap-3">
            <span data-card-date className="text-main-900 text-sm font-medium tabular-nums">
              {cardDate(card.day)}
            </span>
            {lane ? <OutlineChip icon={lane.icon} name={lane.name} /> : null}
          </span>
          <span className="text-main-900 flex min-w-0 items-center gap-1.5 text-xl/tight font-semibold">
            {lane?.icon ? <span aria-hidden>{lane.icon}</span> : null}
            <span className={`truncate ${card.splash.title.trim() ? '' : 'opacity-40'}`}>
              {title}
            </span>
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
            {/* The long body sinks into the card's edge rather than ending. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white"
            />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
