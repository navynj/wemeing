import { describe, expect, it } from 'vitest';

import { joinLabel, linkedCount, prefillLinks } from '@/features/pool/match';

const lanes = [
  { key: 'a', name: 'Focus', icon: null, description: null },
  { key: 'b', name: 'day', icon: null, description: 'A line a day' },
  { key: 'c', name: 'Prayer', icon: null, description: null },
];
const mine = [
  { id: 'focus', name: 'focus' },
  { id: 'day', name: 'Day' },
  { id: 'media', name: 'Media' },
];

describe('the join contract’s prefill (H23)', () => {
  it('links exact name matches, case aside', () => {
    expect(prefillLinks(lanes, mine).a).toBe('focus');
  });

  it('never prefills the residual Day', () => {
    expect(prefillLinks(lanes, mine).b).toBeNull();
  });

  it('leaves everything else unconnected', () => {
    expect(prefillLinks(lanes, mine).c).toBeNull();
  });
});

describe('the primary button', () => {
  it('counts linked lanes, singular for one', () => {
    expect(joinLabel(linkedCount({ a: 'x', b: null, c: 'y' }))).toBe('Connect 2 lanes and join');
    expect(joinLabel(1)).toBe('Connect 1 lane and join');
  });
});
