// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pool/new',
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, refresh: () => {} }),
}));
vi.mock('@/features/pool/actions', () => ({
  createPool: () => Promise.resolve({ ok: true, id: 'p-new' }),
}));
vi.mock('@/features/lanes/actions', () => ({
  saveLane: () => Promise.resolve({ ok: true, id: 'c-made' }),
}));

import { CreateFlow } from '@/features/pool/create-flow';
import type { MyCategory } from '@/lib/queries/profile';

afterEach(cleanup);

const MINE = [
  { id: 'c-trips', name: 'Trips', icon: '🏕' },
  { id: 'c-day', name: 'Day', icon: '🖋' },
] as unknown as MyCategory[];

function addLane(root: HTMLElement, name: string): void {
  // With no lanes yet the editor's form is already open; after that, + Add lane.
  const add = root.querySelector('[data-add-lane]');
  if (add) fireEvent.click(add);
  fireEvent.change(root.querySelector('[aria-label="Lane name"]')!, { target: { value: name } });
  fireEvent.click(root.querySelector('[data-save-lane]')!);
}

describe('opening a new pool (review)', () => {
  it('takes turns on a phone; a wide screen shows step 1 left and step 2 right', () => {
    const { container } = render(<CreateFlow categories={MINE} />);
    const one = container.querySelector('[data-create-step="1"]')!;
    const two = container.querySelector('[data-create-step="2"]')!;
    // Phone: step 1 shows, step 2 waits. Wide (lg): both, in a two-column grid.
    expect(one.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(two.className).toContain('hidden');
    expect(one.className).toContain('lg:flex');
    expect(two.className).toContain('lg:flex');
    expect(one.parentElement!.className).toContain('lg:grid-cols-2');
    // The phone's Next is not on the wide screen, where step 2 is already beside.
    expect(container.querySelector('[data-step]')!.className).toContain('lg:hidden');
  });

  it('keeps step 2 live with the lanes: a name match is suggested, a choice is kept', () => {
    const { container } = render(<CreateFlow categories={MINE} />);
    addLane(container, 'Trips');
    const select = () =>
      container.querySelector('[data-create-step="2"] [data-match-select]') as HTMLSelectElement;
    // Suggested by name, without pressing Next.
    expect(select().value).toBe('c-trips');
    // "Don't connect" is a choice: adding another lane does not undo it.
    fireEvent.change(select(), { target: { value: '' } });
    addLane(container, 'Notes');
    expect(select().value).toBe('');
  });

  it('opens the pool only once it has a name and a lane', () => {
    const { container } = render(<CreateFlow categories={MINE} />);
    const button = () =>
      container.querySelector('[data-create-step="2"] [data-primary]') as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    fireEvent.change(container.querySelector('[data-pool-name]')!, { target: { value: 'Sarang' } });
    addLane(container, 'Trips');
    expect(button().disabled).toBe(false);
    expect(button().textContent).toBe('Connect 1 lane and join');
  });
});
