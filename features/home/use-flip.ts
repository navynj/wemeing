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

/** The spring the pages turn on: Apple's card feel, as the brief sets it. */
export const FLIP_SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;
/** How far the finger travels, in px, for one whole turn. */
export const FLIP_TRAVEL = 200;
/** Past this, a release completes the turn; before it, a fast enough fling does too. */
const COMMIT_AT = 0.4;
const FLING = 1.5;

export type Flip = {
  /** The turn's progress: 0 is the pages where they are, 1 the pages where they are going. One scalar drives every page. */
  p: MotionValue<number>;
  /** The newest-first ids: the unread stack is the tail from `n`, the pile the head before it. */
  ids: string[];
  /** How many pages are turned into the pile, and how many will be once the turn in flight lands. */
  n: number;
  next: number;
  /** The post on top of the unread stack: `ids[n]`. */
  topId: string | null;
  /** The finger takes hold: the turn toward `id` on top now follows it. */
  grab: (id: string) => void;
  /** The finger moves: progress from where it took hold, down for a forward turn and up for a turn back. */
  move: (offsetY: number) => void;
  /** The finger lets go, at this velocity in px/s: the spring finishes or returns. */
  release: (velocityY: number) => void;
  /** The post is brought to the top of the unread stack, turning every page between on the spring. */
  bringForward: (id: string) => void;
};

/**
 * The diving board's page turn (H22, review): the posts are one newest-first
 * list, and the one state is **which post is on top of the unread stack**;
 * everything newer is turned into the pile below, read, and everything from
 * it on is unread above. Turning forward moves the top down by one; tapping
 * a mark, a pile strip or a new drop moves it anywhere, every page between
 * turning in one motion.
 *
 * One motion value `p`, driven by the finger while it is down and handed to
 * the spring with its velocity on release, interruptible at any point
 * because a new grab simply stops the spring and reads `p` where it is.
 * Under reduced motion the same `p` runs as a short tween and the pages
 * crossfade on it instead of turning (law 3).
 */
export function useFlip(
  ids: string[],
  initialTop: string | null,
  /** Which way the finger moves a page forward: down for a page turn, up for a dive. */
  forwardDirection: 1 | -1 = 1,
): Flip {
  const p = useMotionValue(0);
  const reducedMotion = usePrefersReducedMotion();
  const [topId, setTopId] = useState<string | null>(initialTop);
  const [target, setTarget] = useState<string | null>(null);
  const animation = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const grabbedAt = useRef(0);
  // The page in flight, readable the moment it is grabbed — a tap grabs and
  // releases in one handler, before any render.
  const targetRef = useRef<string | null>(null);

  const n = Math.max(0, ids.indexOf(topId ?? ''));
  const next = target ? Math.max(0, ids.indexOf(target)) : n;

  const commit = useCallback(
    (id: string) => {
      targetRef.current = null;
      // The new order renders before `p` snaps back, so no frame shows the
      // old order at rest.
      flushSync(() => {
        setTopId(id);
        setTarget(null);
      });
      p.jump(0);
    },
    [p],
  );

  const grab = useCallback(
    (id: string) => {
      animation.current?.stop();
      const inFlight = targetRef.current;
      if (inFlight && inFlight !== id) {
        // Grabbing another page mid-flight: the one in flight lands or
        // returns, whichever is nearer, and the new turn starts from rest.
        if (p.get() > 0.5) commit(inFlight);
        else p.jump(0);
      }
      targetRef.current = id;
      setTarget(id);
      grabbedAt.current = inFlight === id ? p.get() : 0;
    },
    [p, commit],
  );

  const move = useCallback(
    (offsetY: number) => {
      const id = targetRef.current;
      if (!id) return;
      // Forward one way, back the other.
      const direction = (ids.indexOf(id) > n ? 1 : -1) * forwardDirection;
      const raw = grabbedAt.current + (direction * offsetY) / FLIP_TRAVEL;
      // Rubber-banded past either end, so a pull the wrong way gives a little.
      const clamped = raw < 0 ? raw / 4 : raw > 1 ? 1 + (raw - 1) / 4 : raw;
      p.set(Math.max(-0.08, Math.min(1.08, clamped)));
    },
    [p, ids, n, forwardDirection],
  );

  /** The spring takes `p` to its end, in p-units per second. */
  const settle = useCallback(
    (id: string, end: 0 | 1, velocity: number) => {
      animation.current = animate(
        p,
        end,
        reducedMotion ? { duration: 0.2, ease: 'easeOut' } : { ...FLIP_SPRING, velocity },
      );
      animation.current.then(() => {
        if (end === 1) commit(id);
        else {
          targetRef.current = null;
          setTarget(null);
        }
      });
    },
    [p, reducedMotion, commit],
  );

  const release = useCallback(
    (velocityY: number) => {
      const id = targetRef.current;
      if (!id) return;
      const direction = (ids.indexOf(id) > n ? 1 : -1) * forwardDirection;
      const velocity = (direction * velocityY) / FLIP_TRAVEL;
      settle(id, p.get() > COMMIT_AT || velocity > FLING ? 1 : 0, velocity);
    },
    [p, ids, n, forwardDirection, settle],
  );

  const bringForward = useCallback(
    (id: string) => {
      if (id === topId && !targetRef.current) return;
      if (!ids.includes(id)) return;
      grab(id);
      settle(id, 1, 0);
    },
    [ids, topId, grab, settle],
  );

  // A stopped spring on unmount, never a set on a dead component.
  useEffect(() => () => animation.current?.stop(), []);

  return { p, ids, n, next, topId: ids[n] ?? null, grab, move, release, bringForward };
}
