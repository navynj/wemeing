import { describe, expect, it } from 'vitest';

import type { PoolScope } from '@/features/pool/compose-scope';
import {
  homeWarnings,
  planFromHome,
  planFromPool,
  removedFrom,
  type Current,
  type Link,
} from '@/features/splash-sheet/conversion';

/**
 * Converting a splash (0022) as the edit sheet decides it. From a pool: the
 * compose table — Just mine off is joint; on is mine in my lane linked by
 * both or in, placed on that pool lane, else Just mine. From Home: my lanes,
 * and a warning per pool by whether the new lane sends there (both, out).
 */
const POOL: PoolScope = {
  poolId: 'p-a',
  poolName: 'Sarang',
  lanes: [
    { id: 'pl-word', name: '말씀', icon: '📖', myCategoryId: 'church', direction: 'both' },
    { id: 'pl-thanks', name: '감사', icon: '🥹', myCategoryId: 'church', direction: 'in' },
    { id: 'pl-free', name: 'Free', icon: null, myCategoryId: null, direction: null },
  ],
};
const mine = (over: Partial<Current> = {}): Current => ({
  kind: 'mine',
  poolLaneId: null,
  declaredLaneId: 'church',
  sharedIn: [{ poolId: 'p-a', poolLaneId: 'pl-word' }],
  ...over,
});
const joint: Current = { kind: 'joint', poolLaneId: 'pl-word', declaredLaneId: null, sharedIn: [] };
const own: Current = { kind: 'own', poolLaneId: 'pl-free', declaredLaneId: null, sharedIn: [] };

describe('from a pool: the compose table', () => {
  it('Just mine off makes my splash joint on the chosen pool lane', () => {
    expect(planFromPool(mine(), POOL, 'pl-word', false)).toEqual({
      op: 'to_joint',
      poolLaneId: 'pl-word',
    });
    expect(planFromPool(own, POOL, 'pl-free', false)).toEqual({
      op: 'to_joint',
      poolLaneId: 'pl-free',
    });
  });

  it('Just mine on with a lane linked by both or in keeps it mine there, placed on that pool lane', () => {
    expect(planFromPool(mine(), POOL, 'pl-word', true)).toEqual({ op: 'none' });
    expect(planFromPool(mine(), POOL, 'pl-thanks', true)).toEqual({
      op: 'set_lane',
      myLaneId: 'church',
      placeOn: 'pl-thanks',
    });
    expect(planFromPool(joint, POOL, 'pl-word', true)).toEqual({
      op: 'to_mine',
      myLaneId: 'church',
      placeOn: 'pl-word',
    });
  });

  it('Just mine on with no lane linked makes it Just mine', () => {
    expect(planFromPool(mine(), POOL, 'pl-free', true)).toEqual({
      op: 'to_just_mine',
      poolLaneId: 'pl-free',
    });
    expect(planFromPool(joint, POOL, 'pl-free', true)).toEqual({
      op: 'to_just_mine',
      poolLaneId: 'pl-free',
    });
  });

  it('a joint or Just-mine splash staying what it is only moves among the lanes', () => {
    expect(planFromPool(joint, POOL, 'pl-word', false)).toEqual({ op: 'none' });
    expect(planFromPool(joint, POOL, 'pl-free', false)).toEqual({
      op: 'move_pool',
      poolLaneId: 'pl-free',
    });
    expect(planFromPool(own, POOL, 'pl-free', true)).toEqual({ op: 'none' });
  });

  it('lists the other pools a conversion takes it out of', () => {
    const shared = mine({
      sharedIn: [
        { poolId: 'p-a', poolLaneId: 'pl-word' },
        { poolId: 'p-b', poolLaneId: 'x' },
      ],
    });
    expect(removedFrom(shared, 'p-a')).toEqual(['p-b']);
  });
});

describe('from Home: my lanes, and what each pool will do', () => {
  const LINKS: Link[] = [
    { myCategoryId: 'church', poolId: 'p-a', poolLaneId: 'pl-word', direction: 'both' },
    { myCategoryId: 'study', poolId: 'p-a', poolLaneId: 'pl-thanks', direction: 'in' },
    { myCategoryId: 'study', poolId: 'p-b', poolLaneId: 'pb-notes', direction: 'out' },
  ];
  const poolName = (id: string) => ({ 'p-a': 'Sarang', 'p-b': 'Study Crew' })[id] ?? id;
  const laneName = (id: string) =>
    ({ 'pl-word': '말씀', 'pl-thanks': '감사', 'pb-notes': 'Notes' })[id] ?? id;

  it('says, per pool it is shared to, whether it moves or stops being shared', () => {
    const shared = mine({
      declaredLaneId: 'church',
      sharedIn: [
        { poolId: 'p-a', poolLaneId: 'pl-word' },
        { poolId: 'p-b', poolLaneId: 'pb-notes' },
      ],
    });
    expect(planFromHome(shared, 'study')).toEqual({
      op: 'set_lane',
      myLaneId: 'study',
      placeOn: null,
    });
    expect(homeWarnings({ ...shared, poolId: null }, 'study', LINKS, poolName, laneName)).toEqual([
      // Study only brings in from Sarang: it stops being shared there.
      'It will stop being shared to Sarang.',
      // Study sends to Study Crew's Notes.
      'It will move to Notes in Study Crew.',
    ]);
    expect(homeWarnings({ ...shared, poolId: null }, 'church', LINKS, poolName, laneName)).toEqual(
      [],
    );
  });

  it('says what becoming mine costs a joint splash, then where it lands', () => {
    expect(planFromHome(joint, 'church')).toEqual({
      op: 'to_mine',
      myLaneId: 'church',
      placeOn: null,
    });
    expect(homeWarnings({ ...joint, poolId: 'p-a' }, 'church', LINKS, poolName, laneName)).toEqual([
      'This is a joint splash in Sarang. Moving it to your lane makes it yours alone; members can no longer add to it.',
      'It will move to 말씀 in Sarang.',
    ]);
  });

  it('says a Just-mine splash leaves its pool for a lane that does not send there', () => {
    expect(homeWarnings({ ...own, poolId: 'p-a' }, 'study', LINKS, poolName, laneName)).toEqual([
      'It will leave Sarang.',
    ]);
  });
});
