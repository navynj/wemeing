import { describe, expect, it } from 'vitest';

import { placeCard } from '@/features/home/grid';
import { withPoolBadge } from '@/features/pool/home-badge';
import type { SplashSummary } from '@/features/splash/summary';

function summary(id: string): SplashSummary {
  return {
    id,
    title: id,
    ghostTitle: null,
    declaredLaneId: null,
    icon: null,
    laneIds: [],
    declaredRange: null,
    range: { start: '2026-10-22', end: '2026-10-22' },
    count: 1,
    blocks: [],
    latestCreatedAt: '2026-10-22T18:00:00Z',
    createdAt: '2026-10-22T18:00:00Z',
    pinnedAt: null,
    sessionId: null,
    orphan: false,
  } as unknown as SplashSummary;
}

const JOINT_POOL = new Map([['s-joint', 'p-ours']]);
const POOL_NAME = new Map([['p-ours', 'Our Pool']]);

describe('the pool badge on Home (H23)', () => {
  it('marks a joint splash entry with its pool, opening the pool’s page', () => {
    const card = withPoolBadge(placeCard(summary('s-joint'), '', 'UTC'), JOINT_POOL, POOL_NAME);
    expect(card.pools).toEqual(['Our Pool']);
    expect(card.href).toBe('/pool/p-ours/splash/s-joint');
  });

  it('leaves my own splash shared to a pool unbadged', () => {
    const card = withPoolBadge(placeCard(summary('s-mine'), '', 'UTC'), JOINT_POOL, POOL_NAME);
    expect(card.pools).toBeUndefined();
    expect(card.href).toBeUndefined();
  });
});
