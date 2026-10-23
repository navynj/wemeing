import { describe, expect, it } from 'vitest';

import { originOf } from '@/features/splash/origin';

const LANES = [
  { id: 'c-media', name: 'Media', icon: '🎬' },
  { id: 'c-food', name: 'Food', icon: '🍜' },
];

describe('the back chip on a post’s page', () => {
  it('names the lane page it came from by its emoji and name', () => {
    expect(originOf('/lane/c-media', '2026-10-23', LANES)).toEqual({
      label: '🎬 Media',
      href: '/lane/c-media',
    });
  });

  it('names Home when Home sent it, with the way back to the same card', () => {
    expect(originOf('/?top=s1', '2026-10-23', LANES)).toEqual({ label: 'Home', href: '/?top=s1' });
  });

  it('falls back to Back for a lane it no longer knows, and a month by name', () => {
    expect(originOf('/lane/gone', '2026-10-23', LANES).label).toBe('Back');
    expect(originOf('2026-08', '2026-10-23', LANES)).toEqual({
      label: 'August',
      href: '/?m=2026-08',
    });
  });
});
