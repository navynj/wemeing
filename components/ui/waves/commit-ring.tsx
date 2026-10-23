'use client';

import { usePrefersReducedMotion } from './use-reduced-motion';

export type CommitRingProps = {
  /** The outer bound: the last ring fades exactly here. */
  size?: number;
  /** Diameter of whatever sits in the middle — avatar, FAB, plus sign. */
  contentSize?: number;
  /** Clear space between the content's edge and the first ring. */
  gap?: number;
  /** How many rings travel outward. Three reads as water; one reads as a pulse. */
  rings?: number;
  /**
   * Strength of the rings alone, 0 to 1. The Add-ripple slot is a ghost — an
   * invitation, not a record — so its rings sit back while the disc it circles
   * stays solid. Deliberately does not touch `children`: the caller decides
   * what inside the circle fades, because the disc and the glyph on it usually
   * want different answers.
   */
  ringOpacity?: number;
  /**
   * One event, not a loop: the rings travel out once and are gone. The
   * signature moment at a new post's pill (SPEC 6); the ghost ring, the one
   * stated exception to law 3, leaves this unset and keeps rippling.
   */
  once?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const STAGGER_MS = 220;

/**
 * The ripple: concentric rings spreading from a commit, each fainter than the
 * one inside it.
 *
 * Rings start clear of the content rather than on top of it — a ring drawn
 * against an avatar's edge reads as a border, not as water leaving it. The
 * first ring's diameter is therefore the content plus a gap, and the travel
 * is whatever remains out to `size`.
 *
 * Staggered rather than simultaneous, so they read as one disturbance moving
 * outward instead of a set of circles scaling together. Under reduced motion
 * the rings are drawn nested at rest, which is the same figure the animation
 * passes through — the design reads correctly static (law 3).
 */
export function CommitRing({
  size = 64,
  contentSize = 32,
  gap = 6,
  rings = 3,
  ringOpacity,
  once = false,
  className = '',
  children,
}: CommitRingProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const firstRing = Math.min(size, contentSize + gap * 2);
  const inset = (size - firstRing) / 2;
  const travel = firstRing > 0 ? size / firstRing : 1;

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      // Contrast-determined like every wave (H15c): blue on a page, white on
      // the water ground, through the surface's --wave-ink.
      style={{ width: size, height: size, color: 'var(--wave-ink)' }}
    >
      {/* Rings are grouped so their strength is one value, and so it cannot
          reach the content sitting beside them. */}
      <span aria-hidden className="absolute inset-0" style={{ opacity: ringOpacity }}>
        {Array.from({ length: rings }, (_, index) => (
          <span
            key={index}
            className={`absolute rounded-full border border-current ${
              prefersReducedMotion ? '' : 'commit-ring'
            }`}
            style={{
              // At rest the rings nest outward from the gap to the bound; in
              // motion they all start at the gap and travel the same distance.
              inset: prefersReducedMotion ? inset * (1 - index / rings) : inset,
              opacity: prefersReducedMotion ? (once ? 0 : 0.3 - index * 0.09) : undefined,
              animationDelay: prefersReducedMotion ? undefined : `${index * STAGGER_MS}ms`,
              animationIterationCount: once && !prefersReducedMotion ? 1 : undefined,
              animationFillMode: once && !prefersReducedMotion ? 'forwards' : undefined,
              ['--ring-travel' as string]: travel,
            }}
          />
        ))}
      </span>
      {children}
    </span>
  );
}
