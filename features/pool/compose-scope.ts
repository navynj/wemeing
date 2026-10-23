import type { LinkDirection } from './direction';

/**
 * Composing from a pool (H23): the pool, and its lanes with the lane of mine
 * each is linked to (null when I left it unconnected). The composer's lane
 * picker lists the linked ones, my lane named under each, and *Joint
 * splash* for a splash the pool owns.
 */
export type PoolScope = {
  poolId: string;
  poolName: string;
  lanes: {
    id: string;
    name: string;
    icon: string | null;
    myCategoryId: string | null;
    /** The link's direction (0017), null when I linked none. */
    direction: LinkDirection | null;
  }[];
};

/** A pool as the composer takes it: its lanes, each with my link and its direction. */
export function poolScopeOf(view: {
  pool: { id: string; name: string };
  lanes: { id: string; name: string; icon: string | null }[];
  myLinks: { poolLaneId: string; myCategoryId: string; direction: LinkDirection }[];
}): PoolScope {
  return {
    poolId: view.pool.id,
    poolName: view.pool.name,
    lanes: view.lanes.map((lane) => {
      const link = view.myLinks.find((l) => l.poolLaneId === lane.id);
      return {
        id: lane.id,
        name: lane.name,
        icon: lane.icon,
        myCategoryId: link?.myCategoryId ?? null,
        direction: link?.direction ?? null,
      };
    }),
  };
}
