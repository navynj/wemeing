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
