'use client';

import { useEffect, type RefObject } from 'react';

/** How far a finger travels before its axis is decided. */
export const AXIS_LOCK_PX = 8;
/** How long a scroll must be still, after the finger lifts, before the lock lets go. */
const SETTLE_MS = 160;

/**
 * One axis per gesture on a scroller that moves both ways (round 3): the
 * first 8px of a touch decide whether it is a horizontal or a vertical
 * drag, and for the rest of the gesture — momentum included — the other
 * axis is held where it was, so a drag never drifts diagonally. A trackpad
 * or wheel gesture is decided the same way from its first deltas. The lock
 * lets go once scrolling has settled, so a programmatic scroll afterwards
 * (the ring bringing a mark into view) moves freely.
 */
export function useAxisLock(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let axis: 'x' | 'y' | null = null;
    let start = { x: 0, y: 0 };
    let held = { top: 0, left: 0 };
    let touching = false;
    let wheel = { x: 0, y: 0 };
    let settle: number | undefined;

    const release = (): void => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (!touching) {
          axis = null;
          wheel = { x: 0, y: 0 };
        }
      }, SETTLE_MS);
    };
    const begin = (x: number, y: number): void => {
      window.clearTimeout(settle);
      axis = null;
      start = { x, y };
      held = { top: el.scrollTop, left: el.scrollLeft };
    };
    const decide = (dx: number, dy: number): void => {
      if (axis !== null || Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      held = { top: el.scrollTop, left: el.scrollLeft };
    };

    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) return;
      touching = true;
      begin(touch.clientX, touch.clientY);
    };
    const onTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (touch) decide(touch.clientX - start.x, touch.clientY - start.y);
    };
    const onTouchEnd = (): void => {
      touching = false;
      release();
    };
    const onWheel = (event: WheelEvent): void => {
      if (axis === null && wheel.x === 0 && wheel.y === 0) begin(0, 0);
      wheel = { x: wheel.x + event.deltaX, y: wheel.y + event.deltaY };
      decide(wheel.x, wheel.y);
      release();
    };
    // The held axis is put back on every scroll the gesture causes.
    const onScroll = (): void => {
      if (axis === 'x' && el.scrollTop !== held.top) el.scrollTop = held.top;
      if (axis === 'y' && el.scrollLeft !== held.left) el.scrollLeft = held.left;
      if (!touching && axis !== null) release();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settle);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ref]);
}
