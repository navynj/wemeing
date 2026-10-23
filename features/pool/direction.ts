import type { Database } from '@/lib/database.types';

/**
 * A lane link's direction (0017): out, both (the default), in. Drawn between
 * the pool lane at the left and my lane at the right, so an arrow points where
 * records go: out ← (mine into the pool), in → (the pool's into mine).
 */
export type LinkDirection = Database['public']['Enums']['lane_link_direction'];

export const DEFAULT_DIRECTION: LinkDirection = 'both';

/** Shares my lane's splashes into the pool by default: out and both. */
export function sharesOut(direction: LinkDirection | null | undefined): boolean {
  return direction === 'out' || direction === 'both';
}

/** Brings my joint ripples on the pool lane into my lane: both and in. */
export function bringsIn(direction: LinkDirection | null | undefined): boolean {
  return direction === 'both' || direction === 'in';
}

export const DIRECTION_GLYPH: Record<LinkDirection, string> = { out: '←', both: '↔', in: '→' };

export const DIRECTION_CAPTION: Record<LinkDirection, string> = {
  out: 'Share my records to the pool',
  both: 'Share both ways',
  in: 'Bring pool records to my lane',
};

/** A tap cycles both → out → in → both: ↔ ← →. */
export function nextDirection(direction: LinkDirection): LinkDirection {
  return direction === 'both' ? 'out' : direction === 'out' ? 'in' : 'both';
}
