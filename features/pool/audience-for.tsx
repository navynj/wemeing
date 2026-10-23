import type { ReactNode } from 'react';

import { representativeLane, type Splash, type SplashSummary } from '@/features/splash/summary';
import type { MyLink, Placement } from '@/lib/queries/pools';

import { FixedAudienceChip } from './audience-sheet';
import { SplashAudience } from './splash-audience';

/**
 * A splash page's Audience chip (H23), one rule for Home's page and the
 * pool's: Just mine names its pool and switches nothing (0014); my own post
 * gets a switch per pool its lane is linked in; anything else has none.
 */
export function audienceFor({
  board,
  summary,
  me,
  links,
  pools,
  placements,
}: {
  board: Splash | null;
  summary: SplashSummary;
  me: string;
  links: MyLink[];
  pools: { id: string; name: string }[];
  placements: Placement[];
}): ReactNode {
  if (!board || board.owner_id !== me) return null;
  if (board.own_pool_id) {
    return (
      <FixedAudienceChip
        poolName={pools.find((p) => p.id === board.own_pool_id)?.name ?? 'A pool you left'}
      />
    );
  }
  if (pools.length === 0) return null;
  const lane = summary.declaredLaneId ?? representativeLane(summary);
  const linkedIds = new Set(links.filter((l) => l.myCategoryId === lane).map((l) => l.poolId));
  return (
    <SplashAudience
      splashId={board.id}
      shared={placements.filter((p) => p.splashId === board.id && p.shared).map((p) => p.poolId)}
      linked={pools.filter((p) => linkedIds.has(p.id)).map((p) => ({ poolId: p.id, name: p.name }))}
      unlinked={pools
        .filter((p) => !linkedIds.has(p.id))
        .map((p) => ({ poolId: p.id, name: p.name }))}
    />
  );
}
