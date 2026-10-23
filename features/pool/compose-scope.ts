/**
 * Composing from a pool (H23): the pool, and its lanes with the lane of mine
 * each is linked to (null when I left it unconnected). The composer's lane
 * picker lists the linked ones, my lane named under each, and *Joint
 * splash* for a splash the pool owns.
 */
export type PoolScope = {
  poolId: string;
  poolName: string;
  lanes: { id: string; name: string; icon: string | null; myCategoryId: string | null }[];
};
