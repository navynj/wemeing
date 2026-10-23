'use client';

import { useRef } from 'react';
import { motion, useTransform, type PanInfo } from 'motion/react';

import { usePrefersReducedMotion } from '@/components/ui/waves/use-reduced-motion';
import type { MyCategory } from '@/lib/queries/profile';

import { CARD_PX, CardFace, face } from './card-face';
import { CardMenu } from './card-menu';
import { cardLane, type Card } from './grid';
import type { Flip } from './use-flip';

/** Each step of the lower stair: how far a card peeks below the one in front, its visible edge. */
export const STEP_PX = 26;
/** The one read card above peeks by less: a bookmark, not a second stack (review). */
export const UP_STEP_PX = 22;
/** Each card a step away is this much the size of the one before, about its centre. */
export const STEP_SCALE = 0.94;
/** How many unread cards show below the top, and how many read cards above it: exactly one (review). */
const DOWN = 3;
const UP = 1;
/** The board's box: the top card and the lower stair; the upper stair rises above it, into the water. */
export const STACK_PX = CARD_PX + DOWN * STEP_PX;
/**
 * The fills, one family centred on the top card (review): below it the pale
 * tint, then back toward white — as fractions of the water blue mixed into
 * white. Above it the one read card is **frosted glass** under the water:
 * the pale tint at 40% over a blurred backdrop (`.frosted`, with the solid
 * fallback where blur is unsupported), so the marks and ropes behind soften
 * instead of showing through; no edge line; its words white at 60%.
 */
const DOWN_TINTS = [0, 0.08, 0.04, 0.02];
const FROST = [235, 235, 251] as const;
const UP_FILL = 0.5;
const UP_INK = 0.6;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Where a card sits `d` steps from the top — negative above (read), zero on
 * top, positive below (unread) — as a continuous function, so one spring on
 * the stack's depth moves every card one step at once. A card a step away
 * is smaller about its centre, so its translate makes up the difference and
 * its visible edge stays exactly one step.
 */
export function seat(d: number): {
  y: number;
  scale: number;
  opacity: number;
  height: number;
  background: string;
  ink: number;
} {
  const steps = Math.abs(d);
  const scale = STEP_SCALE ** steps;
  const height = CARD_PX;
  const shrink = (height * (1 - scale)) / 2;
  const y = d >= 0 ? STEP_PX * d + shrink : UP_STEP_PX * d - shrink;
  let opacity: number;
  if (d >= 0) opacity = steps <= DOWN ? 1 : Math.max(0, 1 - (steps - DOWN) * 2);
  else opacity = steps <= UP ? 1 : Math.max(0, 1 - (steps - UP) * 2);
  if (d >= 0) {
    // The fill, read off the ramp between its two nearest steps.
    const at = Math.min(steps, DOWN_TINTS.length - 1);
    const low = Math.floor(at);
    const tint = lerp(
      DOWN_TINTS[low],
      DOWN_TINTS[Math.min(low + 1, DOWN_TINTS.length - 1)],
      at - low,
    );
    return { y, scale, opacity, height, background: face(tint), ink: 1 };
  }
  // Under the water: on its way up from the top card a white card becomes
  // the frost.
  const rise = Math.min(1, steps);
  const alpha = lerp(1, UP_FILL, rise);
  const channel = (white: number, frost: number): number => Math.round(lerp(white, frost, rise));
  const ink = lerp(1, UP_INK, rise);
  return {
    y,
    scale,
    opacity,
    height,
    background: `rgba(${channel(255, FROST[0])}, ${channel(255, FROST[1])}, ${channel(255, FROST[2])}, ${alpha.toFixed(3)})`,
    ink,
  };
}

/** * The diving board as a staircase (H22, review): the top card is the
 * current step. Unread cards step down below it, each peeking below the one
 * before by a step, smaller and a shade paler, three at most; the one card
 * read last steps up above it by a shorter step — a bookmark — free to sit
 * over the grid's bottom edge; earlier read cards are reached through their
 * marks. A peeking card shows its lane emoji and title on its visible edge,
 * one line; the top card shows everything.
 *
 * Flip forward: the top card slides up one step into the upper stair, the
 * first unread card rises into its place, every other card shifts a step —
 * one spring on the stack's depth drives all of it. Flip back is the exact
 * reverse. Tap a lower card to bring it to the top (the cards between shift
 * up); tap an upper card to bring it back down (the cards between shift
 * down); swipe up on the top card to flip forward, down to flip back. No
 * chevrons, no strips. Under reduced motion the cards take their seats at
 * once and the old and new top crossfade.
 */
export function StairBoard({
  cards,
  flip,
  categories,
  initials,
  pinnedIds,
  onPin,
  onDelete,
}: {
  /** Newest first, in the order `flip.ids` follows. */
  cards: Card[];
  flip: Flip;
  categories: MyCategory[];
  initials: string;
  pinnedIds: ReadonlySet<string>;
  onPin: (card: Card, pinned: boolean) => void;
  onDelete: (card: Card) => void;
}) {
  const { ids, n, next } = flip;
  const byId = new Map(cards.map((card) => [card.splash.id, card]));

  // The finger on the top card: up flips forward, down flips back; which is
  // not known until it has moved, so the grab waits for the first move.
  const panned = useRef(false);
  const grabbed = useRef(false);
  const onPanStart = (): void => {
    panned.current = true;
    grabbed.current = false;
  };
  const onPan = (_: PointerEvent, info: PanInfo): void => {
    if (!grabbed.current) {
      if (Math.abs(info.offset.y) < 4) return;
      const target = info.offset.y < 0 ? ids[n + 1] : ids[n - 1];
      if (!target) return;
      grabbed.current = true;
      flip.grab(target);
    }
    flip.move(info.offset.y);
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo): void => {
    if (grabbed.current) flip.release(info.velocity.y);
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

  // Only what can be seen is rendered: the two stairs around the top, at
  // both ends of the motion in flight.
  const first = Math.max(0, Math.min(n, next) - UP);
  const last = Math.min(ids.length - 1, Math.max(n, next) + DOWN);
  const pages: number[] = [];
  for (let i = first; i <= last; i += 1) pages.push(i);

  return (
    <div data-diving-board data-board="stair" className="relative z-10 shrink-0 px-4">
      {cards.length > 0 ? (
        <div
          data-stack
          className="relative select-none"
          style={{ height: STACK_PX, touchAction: 'none' }}
        >
          {pages.map((i) => {
            const card = byId.get(ids[i]);
            return card ? (
              <Step
                key={card.splash.id}
                card={card}
                index={i}
                flip={flip}
                lane={categories.find((c) => c.id === cardLane(card.splash)) ?? null}
                initials={initials}
                onPanStart={onPanStart}
                onPan={onPan}
                onPanEnd={onPanEnd}
                guard={guard}
                pinned={pinnedIds.has(card.splash.id)}
                onPin={(pinned) => onPin(card, pinned)}
                onDelete={() => onDelete(card)}
              />
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

/** One card on the stair, seated by its distance from the top as the depth moves. */
function Step({
  card,
  index,
  flip,
  lane,
  initials,
  onPanStart,
  onPan,
  onPanEnd,
  guard,
  pinned,
  onPin,
  onDelete,
}: {
  card: Card;
  index: number;
  flip: Flip;
  lane: MyCategory | null;
  initials: string;
  onPanStart: () => void;
  onPan: (event: PointerEvent, info: PanInfo) => void;
  onPanEnd: (event: PointerEvent, info: PanInfo) => void;
  guard: (event: React.MouseEvent) => void;
  pinned: boolean;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { p, n, next, bringForward } = flip;
  const i = index;
  const from = i - n;
  const to = i - next;
  const moving = from !== to;

  // The card's distance from the top as the stack's depth moves.
  const d = useTransform(p, (v) => (reducedMotion ? to : lerp(from, to, clamp01(v))));
  const y = useTransform(d, (v) => seat(v).y);
  const scale = useTransform(d, (v) => seat(v).scale);
  const opacity = useTransform([d, p], ([v, pv]) => {
    const at = seat(v as number).opacity;
    if (!reducedMotion || !moving) return at;
    // Reduced motion: the old top fades out as the new one fades in.
    if (from === 0) return at * (1 - clamp01(pv as number));
    if (to === 0) return at * clamp01(pv as number);
    return at;
  });
  const background = useTransform(d, (v) => seat(v).background);
  const height = useTransform(d, (v) => seat(v).height);
  const inkOpacity = useTransform(d, (v) => seat(v).ink);
  // Nearer the top, nearer the eye; a card rising from below over one sliding up.
  const zIndex = useTransform(d, (v) => Math.round((30 - Math.abs(v)) * 10) + (v >= 0 ? 1 : 0));

  const onTop = to === 0;
  const stair = to === 0 ? 'top' : to < 0 ? 'up' : 'down';
  // A moving card keeps the face it had until it lands: a card sliding up
  // out of the top keeps its words, rather than going blank in flight.
  const shown = moving ? (from === 0 ? 'top' : from < 0 ? 'up' : 'down') : stair;
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';

  return (
    <motion.div
      data-stack-card={card.splash.id}
      data-slot={from}
      data-stair={stair}
      data-step={Math.abs(to)}
      data-moving={moving ? (to < from ? 'up' : 'down') : undefined}
      className="absolute inset-x-0 top-0 origin-center"
      style={{ y, scale, opacity, zIndex, height }}
      onPanStart={onTop ? onPanStart : undefined}
      onPan={onTop ? onPan : undefined}
      onPanEnd={onTop ? onPanEnd : undefined}
    >
      {/* The face, clipped to the card's corners so the frost stays inside. */}
      <motion.div
        className={`absolute inset-0 overflow-hidden rounded-[24px] ${stair === 'up' ? 'frosted' : ''}`}
        style={{
          background,
          ['--face' as string]: background,
          ['--ink-opacity' as string]: inkOpacity,
        }}
      >
        {shown === 'top' ? (
          <>
            <CardFace
              card={card}
              lane={lane}
              initials={initials}
              edge="full"
              onClickCapture={guard}
            />
            {onTop ? (
              <CardMenu card={card} pinned={pinned} onPin={onPin} onDelete={onDelete} />
            ) : null}
          </>
        ) : (
          <>
            {/* A step: its visible edge is a seat, one tap to the top. */}
            <button
              type="button"
              data-step-card={card.splash.id}
              aria-label={`Bring ${title} to the top`}
              onClick={() => bringForward(card.splash.id)}
              className={`absolute inset-x-0 z-10 cursor-pointer ${stair === 'up' ? 'top-0' : 'bottom-0'}`}
              style={{ height: stair === 'up' ? UP_STEP_PX : STEP_PX }}
            />
            <CardFace
              card={card}
              lane={lane}
              initials={initials}
              edge={shown === 'up' ? 'top' : 'bottom'}
              ink={shown === 'up' ? 'white' : 'blue'}
            />
          </>
        )}
      </motion.div>
      {/* The ladder glyph hung over the read card's edge: a hint, not a control (review). */}
      {shown === 'up' ? <LadderGlyph /> : null}
    </motion.div>
  );
}

/**
 * A small pool ladder standing on the upper stair card's top edge near its
 * right end (review, to the reference): two rails leaning in toward the
 * top and hooking outward there like handrails, three rungs between them
 * shortening with the rails, outlined, white, round caps. The same size at every width, undoing the card's own scale; the
 * card beneath is the tap.
 */
function LadderGlyph() {
  return (
    <svg
      aria-hidden
      data-ladder-glyph
      width={24}
      height={44}
      viewBox="0 0 24 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-7 origin-bottom-right text-white"
      style={{ top: -44, transform: `scale(${1 / STEP_SCALE})` }}
    >
      {/* In slight perspective, as the reference draws it: the rails lean in
          toward the top and the rungs shorten with them. */}
      <path d="M3 43L7 13a5 5 0 0 0-5-6M21 43l-4-30a5 5 0 0 1 5-6M4 36h16M5 28h14M6 20h12" />
    </svg>
  );
}
