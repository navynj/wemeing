// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pool/p-a/settings',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));
const renamed: [string, string][] = [];
vi.mock('@/features/pool/actions', () => ({
  renamePool: (poolId: string, name: string) => {
    renamed.push([poolId, name]);
    return Promise.resolve({ ok: true });
  },
  setLaneLinks: () => Promise.resolve({ ok: true }),
  createInvite: () => Promise.resolve({ ok: false, message: 'not in tests' }),
  revokeInvite: () => Promise.resolve({ ok: true }),
  deletePool: () => Promise.resolve({ ok: true }),
}));
vi.mock('@/features/lanes/actions', () => ({ saveLane: () => Promise.resolve({ ok: true }) }));

import { PoolSettings } from '@/features/pool/settings';
import type { PoolView } from '@/lib/queries/pools';

afterEach(() => {
  cleanup();
  renamed.length = 0;
});

const view = (ownerId: string): PoolView => ({
  pool: { id: 'p-a', name: 'Our Pool', ownerId },
  members: [],
  lanes: [],
  myLinks: [],
  placements: [],
  splashes: [],
  ripples: [],
  invites: [],
});

describe('renaming the pool in settings (0021)', () => {
  it('is offered to its creator, shows at once, and saves trimmed', async () => {
    const { container, getByLabelText } = render(
      <PoolSettings view={view('u-me')} categories={[]} me="u-me" />,
    );
    const save = container.querySelector<HTMLButtonElement>('[data-save-name]')!;
    expect(save.disabled).toBe(true);
    fireEvent.change(getByLabelText('Pool name'), { target: { value: '  Sarang  ' } });
    fireEvent.click(save);
    expect(container.textContent).toContain('Sarang');
    await waitFor(() => expect(renamed).toEqual([['p-a', 'Sarang']]));
  });

  it('is not offered to any other member', () => {
    const { container } = render(<PoolSettings view={view('u-other')} categories={[]} me="u-me" />);
    expect(container.querySelector('[data-settings-name]')).toBeNull();
  });
});
