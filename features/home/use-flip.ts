'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  animate,
  useMotionValue,
  type AnimationPlaybackControlsWithThen,
  type MotionValue,
} from 'motion/react';

import { usePrefersReducedMotion } from '@/components/ui/waves/use-reduced-motion';

/** The spring the stack flips on: Apple's card feel, as the brief sets it. */
export const FLIP_SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;
/** How far the finger travels, in px, for one whole flip. */
export const FLIP_TRAVEL = 180;
/** Past this, a release completes the flip; before it, a fast enough fling does too. */
const COMMIT_AT = 0.4;
const FLING = 1.5;

export type Flip = {
  /** The flip's progress: 0 is the top card at rest, 1 the next card landed. One scalar drives every card. */
  p: MotionValue<number>;
  /** The cards in stack order, the top first: the sorted list rotated to the top card. */
  order: string[];
  /** The order once the flip in flight lands; the same list when nothing is in flight. */
  next: string[];
  /** The card rising, while one is. */
  incoming: string | null;
  /** The finger takes hold: the flip toward `id` now follows it. */
  grab: (id: string) => void;
  /** The finger moves: progress from where it took hold. */
  move: (offsetY: number) => void;
  /** The finger lets go, at this velocity in px/s: the spring finishes or returns. */
  release: (velocityY: number) => void;
  /** The card is brought to the top, on the spring. */
  bringForward: (id: string) => void;
};

/** `ids` rotated so `topId` comes first; unrotated when it is not among them. */
export function rotateTo(ids: string[], topId: string | null): string[] {
  const at = topId ? ids.indexOf(topId) : -1;
  return at <= 0 ? ids : [...ids.slice(at), ...ids.slice(0, at)];
}

/**
 * The diving board's flip (H22): one motion value `p`, driven by the finger
 * while it is down and handed to the spring with its velocity on release,
 * interruptible at any point because a new grab simply stops the spring and
 * reads `p` where it is. The order is a rotation of the sorted ids, so a
 * post arriving or leaving never disturbs which card is on top.
 *
 * Under reduced motion the same `p` runs as a short tween and the cards
 * crossfade on it instead of moving (law 3).
 */
export function useFlip(ids: string[], initialTop: string | null): Flip {
  const p = useMotionValue(0);
  const reducedMotion = usePrefersReducedMotion();
  const [topId, setTopId] = useState<string | null>(initialTop);
  const [incoming, setIncoming] = useState<string | null>(null);
  const animation = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const grabbedAt = useRef(0);
  // The card in flight, readable the moment it is grabbed — a tap grabs and
  // releases in one handler, before any render.
  const incomingRef = useRef<string | null>(null);

  const order = rotateTo(ids, topId);
  const next = incoming ? rotateTo(ids, incoming) : order;

  const commit = useCallback(
    (id: string) => {
      // The new order renders before `p` snaps back, so no frame shows the
      // old order at rest.
      incomingRef.current = null;
      flushSync(() => {
        setTopId(id);
        setIncoming(null);
      });
      p.jump(0);
    },
    [p],
  );

  const grab = useCallback(
    (id: string) => {
      animation.current?.stop();
      const inFlight = incomingRef.current;
      if (inFlight && inFlight !== id) {
        // Grabbing another card mid-flight: the one in flight lands or
        // returns, whichever is nearer, and the new flip starts from rest.
        if (p.get() > 0.5) commit(inFlight);
        else p.jump(0);
      }
      incomingRef.current = id;
      setIncoming(id);
      grabbedAt.current = inFlight === id ? p.get() : 0;
    },
    [p, commit],
  );

  const move = useCallback(
    (offsetY: number) => {
      const raw = grabbedAt.current + offsetY / FLIP_TRAVEL;
      // Rubber-banded past either end, so a pull the wrong way gives a little.
      const clamped = raw < 0 ? raw / 4 : raw > 1 ? 1 + (raw - 1) / 4 : raw;
      p.set(Math.max(-0.08, Math.min(1.08, clamped)));
    },
    [p],
  );

  /** The spring takes `p` to its end, in p-units per second. */
  const settle = useCallback(
    (id: string, target: 0 | 1, velocity: number) => {
      animation.current = animate(
        p,
        target,
        reducedMotion ? { duration: 0.2, ease: 'easeOut' } : { ...FLIP_SPRING, velocity },
      );
      animation.current.then(() => {
        if (target === 1) commit(id);
        else {
          incomingRef.current = null;
          setIncoming(null);
        }
      });
    },
    [p, reducedMotion, commit],
  );

  const release = useCallback(
    (velocityY: number) => {
      const id = incomingRef.current;
      if (!id) return;
      const velocity = velocityY / FLIP_TRAVEL;
      settle(id, p.get() > COMMIT_AT || velocity > FLING ? 1 : 0, velocity);
    },
    [p, settle],
  );

  const bringForward = useCallback(
    (id: string) => {
      if (id === topId && !incomingRef.current) return;
      if (!ids.includes(id)) return;
      grab(id);
      settle(id, 1, 0);
    },
    [ids, topId, grab, settle],
  );

  // A stopped spring on unmount, never a set on a dead component.
  useEffect(() => () => animation.current?.stop(), []);

  return { p, order, next, incoming, grab, move, release, bringForward };
}
