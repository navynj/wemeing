import { DEFAULT_DIRECTION, sharesOut, type LinkDirection } from './direction';
import { RESIDUAL_CATEGORY } from '@/features/auth/preset-categories';

/** A pool lane as step 2 lists it: keyed, because on create it has no id yet. */
export type MatchLane = {
  key: string;
  name: string;
  icon: string | null;
  description: string | null;
};

/** Which of my lanes each pool lane takes; null is "Don't connect". */
export type Links = Record<string, string | null>;

/** Each link's direction (0017), by pool lane key; absent is both. */
export type Directions = Record<string, LinkDirection>;

/**
 * The join contract's starting point (SPEC 4, C5; H23): a pool lane takes my
 * lane of exactly the same name, case aside — never the residual Day, which
 * would carry everything that has no better home — and otherwise nothing.
 * Name coincidence only suggests; the author confirms every row.
 */
export function prefillLinks(lanes: MatchLane[], mine: { id: string; name: string }[]): Links {
  const byName = new Map(
    mine
      .filter((lane) => lane.name.toLowerCase() !== RESIDUAL_CATEGORY.toLowerCase())
      .map((lane) => [lane.name.trim().toLowerCase(), lane.id]),
  );
  return Object.fromEntries(
    lanes.map((lane) => [lane.key, byName.get(lane.name.trim().toLowerCase()) ?? null]),
  );
}

export function linkedCount(links: Links): number {
  return Object.values(links).filter((id) => id !== null).length;
}

/** "Connect 2 lanes and join"; one lane is singular; none still joins. */
export function joinLabel(count: number): string {
  if (count === 0) return 'Join without connecting';
  return `Connect ${count} ${count === 1 ? 'lane' : 'lanes'} and join`;
}

/**
 * One sender per lane of mine in a pool (review): a lane's records go into at
 * most one pool lane, so of the rows connecting the same lane only the first
 * may send (↔ or ←); any later one brings in only (→). Bringing in from
 * several pool lanes is fine. Every key comes back with its direction.
 */
export function settleDirections(keys: string[], links: Links, directions: Directions): Directions {
  const sending = new Set<string>();
  const settled: Directions = {};
  for (const key of keys) {
    let direction = directions[key] ?? DEFAULT_DIRECTION;
    const mine = links[key];
    if (mine && sharesOut(direction)) {
      if (sending.has(mine)) direction = 'in';
      else sending.add(mine);
    }
    settled[key] = direction;
  }
  return settled;
}

/** The row already sending this row's lane of mine, which holds this one to → only. */
export function sentBy(
  key: string,
  keys: string[],
  links: Links,
  settled: Directions,
): string | null {
  const mine = links[key];
  if (!mine) return null;
  return (
    keys.find((other) => other !== key && links[other] === mine && sharesOut(settled[other])) ??
    null
  );
}
