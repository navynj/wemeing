// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

import { GroundFoot } from '@/features/home/ground-foot';
import { PoolActivityProvider } from '@/features/pool/activity';
import { rememberVisit } from '@/features/pool/remembered';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const ACTIVITY = { 'p-a': '2026-10-23T10:00:00.000Z', 'p-b': null };

function foot(activity: Record<string, string | null> = ACTIVITY) {
  return render(
    <PoolActivityProvider
      activity={activity}
      pools={[
        { id: 'p-a', name: 'Sarang' },
        { id: 'p-b', name: 'Study Crew' },
      ]}
    >
      <GroundFoot here="home" onCompose={() => {}} />
    </PoolActivityProvider>,
  );
}

// The dot rides on the pool's own place on the strip (review).
const dot = (root: Element) =>
  root.querySelector('[data-home-foot] [data-strip-pool="p-a"] [data-unseen-dot]');

describe('a pool’s dot on the strip (review)', () => {
  it('shows when a pool has something I have not seen on this device', () => {
    expect(dot(foot().container)).not.toBeNull();
  });

  it('clears the moment I visit that pool, and stays off until something newer', () => {
    const { container } = foot();
    act(() => rememberVisit('p-a', new Date('2026-10-23T11:00:00.000Z')));
    expect(dot(container)).toBeNull();
    cleanup();
    // Someone writes after my visit.
    expect(dot(foot({ 'p-a': '2026-10-23T12:00:00.000Z' }).container)).not.toBeNull();
  });

  it('stays off when no pool has anything by anyone else', () => {
    expect(dot(foot({ 'p-a': null, 'p-b': null }).container)).toBeNull();
  });
});
