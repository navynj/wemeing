import type { PoolScope } from '@/features/pool/compose-scope';
import { sharesOut } from '@/features/pool/direction';
import { resolvePick } from '@/features/pool/pool-pick';

/**
 * Converting a splash between personal, Just mine and joint (0022), as the
 * edit sheet decides it. Pure, so the rules are tested here and the sheet
 * only draws them.
 */
export type SplashKind = 'mine' | 'own' | 'joint';

/** One database act, or nothing to convert. */
export type Conversion =
  | { op: 'none' }
  | { op: 'move_pool'; poolLaneId: string } // move_pool_splash (0020)
  | { op: 'to_joint'; poolLaneId: string }
  | { op: 'to_just_mine'; poolLaneId: string }
  | { op: 'to_mine'; myLaneId: string; placeOn: string | null }
  | { op: 'set_lane'; myLaneId: string; placeOn: string | null };

/** Where the splash stands now, as the sheet loaded it. */
export type Current = {
  kind: SplashKind;
  /** Joint: its pool lane; Just mine: its placement's pool lane. */
  poolLaneId: string | null;
  /** Mine: its declared lane. */
  declaredLaneId: string | null;
  /** Mine: where it is shared now, pool by pool. */
  sharedIn: { poolId: string; poolLaneId: string }[];
};

/**
 * From a pool screen: the pool's lane chips and Just mine, re-resolved by the
 * compose table (resolvePick): off is joint; on is mine in my lane linked by
 * both or in, placed on that pool lane, else Just mine.
 */
export function planFromPool(
  current: Current,
  scope: PoolScope,
  poolLaneId: string,
  justMine: boolean,
): Conversion {
  const lane = scope.lanes.find((l) => l.id === poolLaneId);
  if (!lane) return { op: 'none' };
  const target = resolvePick(lane, justMine);
  const here = current.sharedIn.find((s) => s.poolId === scope.poolId)?.poolLaneId ?? null;
  if (target.kind === 'joint') {
    if (current.kind !== 'joint') return { op: 'to_joint', poolLaneId };
    return current.poolLaneId === poolLaneId ? { op: 'none' } : { op: 'move_pool', poolLaneId };
  }
  if (target.kind === 'own') {
    if (current.kind !== 'own') return { op: 'to_just_mine', poolLaneId };
    return current.poolLaneId === poolLaneId ? { op: 'none' } : { op: 'move_pool', poolLaneId };
  }
  if (current.kind === 'mine') {
    return current.declaredLaneId === target.myCategoryId && here === poolLaneId
      ? { op: 'none' }
      : { op: 'set_lane', myLaneId: target.myCategoryId, placeOn: poolLaneId };
  }
  return { op: 'to_mine', myLaneId: target.myCategoryId, placeOn: poolLaneId };
}

/** From Home: one of my lanes for mine, Just mine and a joint splash only I wrote in. */
export function planFromHome(current: Current, myLaneId: string | null): Conversion {
  if (!myLaneId) return { op: 'none' };
  if (current.kind === 'mine') {
    return myLaneId === current.declaredLaneId
      ? { op: 'none' }
      : { op: 'set_lane', myLaneId, placeOn: null };
  }
  return { op: 'to_mine', myLaneId, placeOn: null };
}

export type Link = {
  myCategoryId: string;
  poolId: string;
  poolLaneId: string;
  /** Absent reads as both (0017). */
  direction?: Parameters<typeof sharesOut>[0];
};
export type LaneName = { name: string; poolId: string };

/** The pool lane my lane sends into in a pool (both, out; 0019 keeps it to one), or null. */
export function sendingLane(links: Link[], poolId: string, myLaneId: string): string | null {
  return (
    links.find(
      (l) => l.poolId === poolId && l.myCategoryId === myLaneId && sharesOut(l.direction ?? 'both'),
    )?.poolLaneId ?? null
  );
}

/**
 * What a Home edit does to each pool, said before saving (review): it moves
 * to the pool lane its new lane sends into, or it stops being shared there
 * (mine), or it leaves the pool (Just mine, joint). A joint splash first says
 * what becoming mine costs.
 */
export function homeWarnings(
  current: Current & { poolId: string | null },
  myLaneId: string | null,
  links: Link[],
  poolName: (id: string) => string,
  laneName: (id: string) => string,
): string[] {
  const plan = planFromHome(current, myLaneId);
  if (plan.op === 'none' || !myLaneId) return [];
  if (current.kind === 'mine') {
    return current.sharedIn.map(({ poolId }) => {
      const to = sendingLane(links, poolId, myLaneId);
      return to
        ? `It will move to ${laneName(to)} in ${poolName(poolId)}.`
        : `It will stop being shared to ${poolName(poolId)}.`;
    });
  }
  if (!current.poolId) return [];
  const pool = poolName(current.poolId);
  const to = sendingLane(links, current.poolId, myLaneId);
  const where = to ? `It will move to ${laneName(to)} in ${pool}.` : `It will leave ${pool}.`;
  return current.kind === 'joint'
    ? [
        `This is a joint splash in ${pool}. Moving it to your lane makes it yours alone; members can no longer add to it.`,
        where,
      ]
    : [where];
}

/** The pools a conversion in one pool takes the splash out of: every other one it is shared to. */
export function removedFrom(current: Current, poolId: string): string[] {
  return current.sharedIn.filter((s) => s.poolId !== poolId).map((s) => s.poolId);
}
