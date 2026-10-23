'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { motion, useTransform, type PanInfo } from 'motion/react';

import { usePrefersReducedMotion } from '@/components/ui/waves/use-reduced-motion';
import type { MyCategory } from '@/lib/queries/profile';

import { CARD_PX, CardFace, face, TINT_STEP } from './card-face';
import { cardLane, type Card } from './grid';
import type { MarkSpot } from './lane-grid';
import type { Flip } from './use-flip';

/** How much of each back card shows above the one in front: its title line. */
export const PEEK_PX = 20;
/** How many back cards show. */
const PEEKS = 3;
/** The board's height: the peeks and the top card. */
export const STACK_PX = PEEKS * PEEK_PX + CARD_PX;
/** When several cards dive or rise at once, each starts this much of the way after the last (about 60ms). */
const STAGGER = 0.12;
/** The surfaced strip's height; it straddles the water and the board. */
const STRIP_PX = 28;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * The diving board (H22, review): the newest posts as a stack of white
 * cards, the top one read in full and up to three behind it each showing
 * its title line above the one in front — the same width and corners, each
 * a step darker. **A dive**: swipe up on the top card, or drag it past the
 * threshold, and it lifts, shrinks and flies to its own mark in the grid,
 * the grid scrolling if it must; the ring plays at that mark as the
 * landing, and the mark stays translucent while the post is in the water.
 * The next card is already in place behind it. **A rise**: pull down from
 * the top edge of the stack, tap the surfaced strip, or tap any mark in the
 * grid, and that card rises from its mark, grows and settles on top with
 * the spring; every card that dived after it rises with it. Tapping a back
 * card brings it to the front: the cards above it dive one after another.
 *
 * The **surfaced strip** is one thin translucent band straddling the water
 * and the board: the lane emoji and title of the post that dived last, and
 * an up chevron; it names the previous one as each returns and is gone
 * when none remain.
 *
 * The one state is which post is on top (`flip.n` posts have dived); every
 * card's seat is a function of the dive's one scalar `p`. Under reduced
 * motion a diving card fades out in place and a rising one fades in.
 */
export type DiveBoardHandle = {
  /** Brings this post to the top: the cards above it dive, or it and those after it rise. */
  goTo: (id: string) => void;
};

export const DiveBoard = forwardRef<
  DiveBoardHandle,
  {
    /** Newest first, in the order `flip.ids` follows. */
    cards: Card[];
    flip: Flip;
    categories: MyCategory[];
    initials: string;
    /** Where each mark is, or will be once the grid has scrolled it into view. */
    locate: (ids: string[]) => Map<string, MarkSpot>;
  }
>(function DiveBoard({ cards, flip, categories, initials, locate }, ref) {
  const { ids, n, next } = flip;
  const byId = new Map(cards.map((card) => [card.splash.id, card]));
  const stack = useRef<HTMLDivElement>(null);
  // The flight paths of the cards in motion, measured when the motion begins.
  const [paths, setPaths] = useState<Map<string, { dx: number; dy: number; scale: number }>>(
    () => new Map(),
  );

  /** Measures the flights for the cards between here and there, scrolling the grid to the first. */
  const plan = (from: number, to: number): void => {
    // The grid scrolls to the mark the eye follows: the first to dive, or
    // the one that ends on top — the first of the moving either way.
    const moving = from < to ? ids.slice(from, to) : ids.slice(to, from);
    const spots = locate(moving);
    const box = stack.current?.getBoundingClientRect();
    const map = new Map<string, { dx: number; dy: number; scale: number }>();
    if (box) {
      const cardX = box.left + box.width / 2;
      const cardY = box.top + PEEKS * PEEK_PX + CARD_PX / 2;
      for (const id of moving) {
        const spot = spots.get(id);
        if (!spot) continue;
        map.set(id, {
          dx: spot.x - cardX,
          dy: spot.y - cardY,
          scale: spot.size / Math.max(1, box.width),
        });
      }
    }
    setPaths(map);
  };

  const dive = (to: number): void => {
    if (to <= n || to > ids.length) return;
    plan(n, to);
    flip.bringForward(ids[to] ?? ids[ids.length - 1]);
  };
  const rise = (to: number): void => {
    if (to >= n || to < 0) return;
    plan(n, to);
    flip.bringForward(ids[to]);
  };
  useImperativeHandle(
    ref,
    () => ({
      goTo: (id) => {
        const at = ids.indexOf(id);
        if (at < 0 || at === n) return;
        if (at > n) dive(at);
        else rise(at);
      },
    }),
    // Reads the latest ids and depth each time it is called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, n],
  );

  // The finger on the top card: up dives it. On the strip or the stack's
  // top edge: down raises the last dived.
  const panned = useRef(false);
  const onDiveStart = (): void => {
    panned.current = true;
    if (n + 1 < ids.length) {
      plan(n, n + 1);
      flip.grab(ids[n + 1]);
    }
  };
  const onRiseStart = (): void => {
    panned.current = true;
    if (n > 0) {
      plan(n, n - 1);
      flip.grab(ids[n - 1]);
    }
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

  // Only what can be seen is rendered: the stack's faces, and the cards
  // flying between the stack and the water.
  const first = Math.min(n, next);
  const last = Math.min(ids.length - 1, Math.max(n, next) + PEEKS);
  const pages: number[] = [];
  for (let i = first; i <= last; i += 1) pages.push(i);
  const surfaced = n > 0 ? byId.get(ids[n - 1]) : undefined;
  const surfacedLane = surfaced
    ? (categories.find((c) => c.id === cardLane(surfaced.splash)) ?? null)
    : null;

  return (
    <div data-diving-board data-board="dive" className="relative shrink-0 px-4">
      {cards.length > 0 ? (
        <div
          ref={stack}
          data-stack
          className="relative select-none"
          style={{ height: STACK_PX, touchAction: 'none' }}
        >
          {pages.map((i) => {
            const card = byId.get(ids[i]);
            return card ? (
              <DiveCard
                key={card.splash.id}
                card={card}
                index={i}
                flip={flip}
                path={paths.get(card.splash.id) ?? null}
                lane={categories.find((c) => c.id === cardLane(card.splash)) ?? null}
                initials={initials}
                onDiveStart={onDiveStart}
                onPan={onPan}
                onPanEnd={onPanEnd}
                guard={guard}
                onBringFront={() => dive(i)}
              />
            ) : null;
          })}

          {/* The stack's top edge: pull down here to raise the last dived. A
              sibling of the top card, so the two gestures never both begin. */}
          {n > 0 ? (
            <motion.span
              aria-hidden
              data-pull-edge
              className="absolute inset-x-0 z-40 h-6"
              style={{ top: PEEKS * PEEK_PX - 4 }}
              onPanStart={onRiseStart}
              onPan={onPan}
              onPanEnd={onPanEnd}
            />
          ) : null}

          {/* The surfaced strip: the post that dived last, one tap from rising. */}
          {surfaced ? (
            <motion.button
              type="button"
              data-surfaced={surfaced.splash.id}
              aria-label={`Bring ${surfaced.splash.title.trim() || surfaced.splash.ghostTitle || 'Untitled'} back up`}
              onPanStart={onRiseStart}
              onPan={onPan}
              onPanEnd={onPanEnd}
              onClickCapture={guard}
              onClick={() => rise(n - 1)}
              className="bg-main-900/70 absolute inset-x-6 z-50 flex items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white backdrop-blur-sm"
              style={{ top: -STRIP_PX / 2, height: STRIP_PX }}
            >
              {surfacedLane?.icon ? <span aria-hidden>{surfacedLane.icon}</span> : null}
              <span className="min-w-0 flex-1 truncate">
                {surfaced.splash.title.trim() || surfaced.splash.ghostTitle || 'Untitled'}
              </span>
              <ChevronUp aria-hidden size={14} />
            </motion.button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

/**
 * One card on the board: seated by its slot behind the top, flying to or
 * from its mark while it dives or rises. `t` runs 0 → 1 as it dives.
 */
function DiveCard({
  card,
  index,
  flip,
  path,
  lane,
  initials,
  onDiveStart,
  onPan,
  onPanEnd,
  guard,
  onBringFront,
}: {
  card: Card;
  index: number;
  flip: Flip;
  path: { dx: number; dy: number; scale: number } | null;
  lane: MyCategory | null;
  initials: string;
  onDiveStart: () => void;
  onPan: (event: PointerEvent, info: PanInfo) => void;
  onPanEnd: (event: PointerEvent, info: PanInfo) => void;
  guard: (event: React.MouseEvent) => void;
  onBringFront: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { p, n, next } = flip;
  const i = index;
  const wasDived = i < n ? 1 : 0;
  const willBeDived = i < next ? 1 : 0;
  const moving = wasDived !== willBeDived;
  const diving = moving && willBeDived === 1;
  // Several at once go one after another: the first to leave leads a dive,
  // the last to have left leads a rise.
  const count = Math.abs(next - n);
  const order = diving ? i - Math.min(n, next) : Math.max(n, next) - 1 - i;
  const span = Math.max(0.001, 1 - (count - 1) * STAGGER);
  const own = (v: number): number => clamp01((clamp01(v) - order * STAGGER) / span);

  const t = useTransform(p, (v) => (moving ? lerp(wasDived, willBeDived, own(v)) : wasDived));
  // The stack's depth under this card, as the cards above it leave or return.
  const depth = useTransform(p, (v) => lerp(n, next, clamp01(v)));
  const slot = useTransform(depth, (d) => Math.max(0, i - d));

  const restY = useTransform(slot, (s) => PEEKS * PEEK_PX - s * PEEK_PX);
  const x = useTransform(t, (v) => (path && !reducedMotion ? path.dx * v : 0));
  const y = useTransform([t, restY], ([v, r]) =>
    path && !reducedMotion ? (r as number) + path.dy * (v as number) : (r as number),
  );
  const scale = useTransform(t, (v) => (path && !reducedMotion ? lerp(1, path.scale, v) : 1));
  const opacity = useTransform([t, slot], ([v, s]) => {
    if ((s as number) > PEEKS + 0.5) return 0;
    if (reducedMotion) return 1 - (v as number);
    // The card is the mark by the time it lands: it fades over the last stretch.
    return 1 - clamp01(((v as number) - 0.7) / 0.3);
  });
  const bg = useTransform(slot, (s) => face(s * TINT_STEP));
  const zIndex = useTransform([t, slot], ([v, s]) =>
    (v as number) > 0 && (v as number) < 1 ? 40 : 20 - Math.round(s as number),
  );

  const onTop = i === n;
  const faceSlot = Math.max(0, i - n);
  if (i < n && !moving) return null;

  return (
    <motion.div
      data-stack-card={card.splash.id}
      data-slot={i < n ? -1 : faceSlot}
      data-moving={moving ? (diving ? 'dive' : 'rise') : undefined}
      className="absolute inset-x-0 top-0 origin-center overflow-hidden rounded-[24px]"
      style={{
        x,
        y,
        scale,
        opacity,
        backgroundColor: bg,
        ['--face' as string]: bg,
        zIndex,
        height: CARD_PX,
        pointerEvents: onTop ? 'auto' : 'none',
      }}
      onPanStart={onTop ? onDiveStart : undefined}
      onPan={onTop ? onPan : undefined}
      onPanEnd={onTop ? onPanEnd : undefined}
    >
      {onTop ? (
        <CardFace
          card={card}
          lane={lane}
          initials={initials}
          titleHeight={PEEK_PX}
          onTop
          onClickCapture={guard}
        />
      ) : (
        // A card behind: its title line is a seat, one tap to the front.
        <button
          type="button"
          data-back-card={card.splash.id}
          aria-label={`Bring ${card.splash.title.trim() || card.splash.ghostTitle || 'Untitled'} to the front`}
          onClick={onBringFront}
          className="absolute inset-x-0 top-0 z-10 cursor-pointer"
          style={{ height: PEEK_PX, pointerEvents: 'auto' }}
        />
      )}
      {!onTop ? (
        <CardFace card={card} lane={lane} initials={initials} titleHeight={PEEK_PX} onTop={false} />
      ) : null}
    </motion.div>
  );
}
