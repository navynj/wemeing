// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/lane/c-food',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));
const saved: unknown[] = [];
vi.mock('@/features/lanes/actions', () => ({
  saveLane: (lane: unknown) => {
    saved.push(lane);
    return Promise.resolve({ ok: true });
  },
}));

import { byNewest, placeCard } from '@/features/home/grid';
import { LanePage } from '@/features/lanes/lane-page';
import { summarizeSplash, type SplashBlock } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';

afterEach(cleanup);

const TZ = 'America/Vancouver';
const NOW = new Date('2026-10-22T20:00:00.000Z');
const FOOD: MyCategory = {
  id: 'c-food',
  user_id: 'a1',
  name: 'Food',
  icon: '🍜',
  default_mode: 'drop',
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
};
function post(id: string, title: string, day: string) {
  const block: SplashBlock = {
    id: `${id}-b`,
    category_id: 'c-food',
    note: id,
    occurred_on: day,
    occurred_time: null,
    created_at: `${day}T16:00:00.000Z`,
  };
  return summarizeSplash(
    {
      id,
      owner_id: 'a1',
      title,
      declared_start: null,
      declared_end: null,
      declared_lane_id: 'c-food',
      session_id: null,
      pinned_at: null,
      pool_id: null,
      type: 'free',
      prompt: null,
      ends_at: null,
      created_at: `${day}T16:00:00.000Z`,
    },
    [block],
    TZ,
    NOW,
  );
}
const CARDS = [
  post('soup', 'Short rib soup', '2026-09-08'),
  post('ramen', 'Ramen', '2026-10-03'),
  post('noodles', 'Cold noodles', '2026-10-12'),
]
  .map((s) => placeCard(s, '', TZ))
  .sort(byNewest);

describe('a lane’s page (round 3)', () => {
  it('reads Home / the lane, the emoji large over the name, and its posts newest first by month', () => {
    const { container } = render(<LanePage lane={FOOD} cards={CARDS} />);
    const crumb = container.querySelector('[data-breadcrumb]')!;
    expect(crumb.querySelector('a[href="/"]')!.textContent).toBe('Home');
    expect(crumb.textContent).toContain('Food');
    expect(container.querySelector('[data-lane-emoji]')!.textContent).toBe('🍜');
    expect(container.querySelector('[data-lane-name]')!.textContent).toBe('Food');
    const months = [...container.querySelectorAll('[data-lane-month]')].map((m) => m.textContent);
    expect(months).toEqual(['October 2026', 'September 2026']);
    const posts = [...container.querySelectorAll('[data-lane-post]')].map((p) =>
      p.getAttribute('data-lane-post'),
    );
    expect(posts).toEqual(['noodles', 'ramen', 'soup']);
    expect(container.querySelector('[data-lane-post="soup"]')!.getAttribute('href')).toBe(
      `/splash/soup?from=${encodeURIComponent('/lane/c-food')}`,
    );
    expect(container.querySelector('a[href="/?manage=lanes"]')!.textContent).toBe('Manage lanes');
  });

  it('edits the emoji and the name in place, and saves them', async () => {
    saved.length = 0;
    const { container, getByText, getByLabelText } = render(<LanePage lane={FOOD} cards={CARDS} />);
    fireEvent.click(container.querySelector('[data-lane-name]')!);
    fireEvent.change(getByLabelText('Lane icon'), { target: { value: '🍜🍣' } });
    fireEvent.change(getByLabelText('Lane name'), { target: { value: 'Meals' } });
    fireEvent.click(getByText('Save'));
    expect(container.querySelector('[data-lane-name]')!.textContent).toBe('Meals');
    expect(container.querySelector('[data-lane-emoji]')!.textContent).toBe('🍣');
    await waitFor(() => expect(saved).toEqual([{ id: 'c-food', name: 'Meals', icon: '🍣' }]));
  });

  it('cancels an edit without saving', () => {
    saved.length = 0;
    const { container, getByText, getByLabelText } = render(<LanePage lane={FOOD} cards={CARDS} />);
    fireEvent.click(container.querySelector('[data-lane-emoji]')!);
    fireEvent.change(getByLabelText('Lane name'), { target: { value: 'Meals' } });
    fireEvent.click(getByText('Cancel'));
    expect(container.querySelector('[data-lane-name]')!.textContent).toBe('Food');
    expect(saved).toEqual([]);
  });
});
