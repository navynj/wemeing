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

describe('the pool badge on Home (H23, 0016)', () => {
  it('puts a joint entry whose latest ripple has no lane in its pool’s column, with the badge and tag', () => {
    const card = withPoolBadge(placeCard(summary('s-joint'), '', 'UTC'), {
      poolId: 'p-ours',
      poolName: 'Our Pool',
      latestLane: null,
      poolLane: { name: 'Games', icon: '🎲' },
    });
    expect(card.column).toBe('pool:p-ours');
    expect(card.pools).toEqual(['Our Pool']);
    expect(card.origins).toEqual(['Our Pool · 🎲 Games']);
    expect(card.href).toBe('/pool/p-ours/splash/s-joint');
  });

  it('keeps a joint entry whose latest ripple is linked in that lane’s column', () => {
    const card = withPoolBadge(placeCard(summary('s-joint'), '', 'UTC'), {
      poolId: 'p-ours',
      poolName: 'Our Pool',
      latestLane: 'my-media',
      poolLane: { name: 'Games', icon: '🎲' },
    });
    expect(card.column).toBe('my-media');
    expect(card.pools).toEqual(['Our Pool']);
  });

  it('leaves my own splash shared to a pool unbadged', () => {
    const card = withPoolBadge(placeCard(summary('s-mine'), '', 'UTC'), undefined);
    expect(card.pools).toBeUndefined();
    expect(card.href).toBeUndefined();
    expect(card.column).toBeUndefined();
  });
});
