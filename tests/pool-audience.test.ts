import { describe, expect, it } from 'vitest';

import { audienceLabel, audienceRows, defaultAudience } from '@/features/pool/audience';

const links = [
  { myCategoryId: 'place', poolId: 'p1', poolName: 'Our Pool' },
  { myCategoryId: 'place', poolId: 'p2', poolName: 'Crew' },
  { myCategoryId: 'food', poolId: 'p1', poolName: 'Our Pool' },
];
const pools = [
  { id: 'p1', name: 'Our Pool' },
  { id: 'p2', name: 'Crew' },
  { id: 'p3', name: 'Study' },
];

describe('the Audience chip (H23)', () => {
  it('says Only me, a pool’s name, or N pools — what the placements are', () => {
    expect(audienceLabel([])).toBe('Only me');
    expect(audienceLabel(['Our Pool'])).toBe('Our Pool');
    expect(audienceLabel(['Our Pool', 'Crew'])).toBe('2 pools');
  });

  it('defaults to every pool where the chosen lane is linked', () => {
    expect(defaultAudience('place', links)).toEqual(['p1', 'p2']);
    expect(defaultAudience('food', links)).toEqual(['p1']);
    expect(defaultAudience('day', links)).toEqual([]);
    expect(defaultAudience(null, links)).toEqual([]);
  });

  it('offers a switch where the lane is linked and a note where it is not', () => {
    const rows = audienceRows('food', links, pools);
    expect(rows.linked.map((r) => r.name)).toEqual(['Our Pool']);
    expect(rows.unlinked.map((r) => r.name)).toEqual(['Crew', 'Study']);
  });
});
