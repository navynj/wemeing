/**
 * A post's audience (H23): where it is shared. Ripples have none of their
 * own; they follow their post. Today an audience is a set of pools; the
 * shape leaves room for a Followers row later without changing this one.
 */
export type AudienceLink = { myCategoryId: string; poolId: string; poolName: string };

/** "Only me", the pool's name, or "N pools". */
export function audienceLabel(poolNames: string[]): string {
  if (poolNames.length === 0) return 'Only me';
  if (poolNames.length === 1) return poolNames[0];
  return `${poolNames.length} pools`;
}

/** The default: every pool where the chosen lane is linked. */
export function defaultAudience(laneId: string | null, links: AudienceLink[]): string[] {
  if (!laneId) return [];
  return [...new Set(links.filter((l) => l.myCategoryId === laneId).map((l) => l.poolId))];
}

/**
 * The sheet's rows: a switch for each pool where the lane is linked, and a
 * note for each pool I am in where it is not.
 */
export function audienceRows(
  laneId: string | null,
  links: AudienceLink[],
  pools: { id: string; name: string }[],
): { linked: { poolId: string; name: string }[]; unlinked: { poolId: string; name: string }[] } {
  const linked = new Set(defaultAudience(laneId, links));
  return {
    linked: pools.filter((p) => linked.has(p.id)).map((p) => ({ poolId: p.id, name: p.name })),
    unlinked: pools.filter((p) => !linked.has(p.id)).map((p) => ({ poolId: p.id, name: p.name })),
  };
}
