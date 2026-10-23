// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}));
const saved: Record<string, unknown>[] = [];
vi.mock('@/features/splash-sheet/edit-actions', () => ({
  loadSplashEdit: () =>
    Promise.resolve({
      ok: true,
      kind: 'joint',
      title: 'Arnak league',
      icon: '🏛️',
      declaredStart: null,
      declaredEnd: null,
      declaredLaneId: null,
      shared: [],
      poolId: 'p-ours',
    }),
  saveSplashEdit: (input: Record<string, unknown>) => {
    saved.push(input);
    return Promise.resolve({ ok: true });
  },
}));

import { CardMenu } from '@/features/home/card-menu';
import { placeCard } from '@/features/home/grid';
import { InputSheetProvider, useInputSheet } from '@/features/input-sheet/sheet-provider';
import { SplashEditSheet } from '@/features/splash-sheet/splash-edit-sheet';
import type { SplashSummary } from '@/features/splash/summary';

afterEach(cleanup);

const SUMMARY = {
  id: 's-joint',
  title: 'Arnak league',
  ghostTitle: null,
  declaredLaneId: null,
  icon: '🏛️',
  laneIds: [],
  declaredRange: null,
  range: { start: '2026-10-22', end: '2026-10-22' },
  count: 1,
  blocks: [],
  latestCreatedAt: '2026-10-22T18:00:00Z',
  writtenOn: '2026-10-22',
  ownPoolId: null,
  open: true,
  createdAt: '2026-10-22T18:00:00Z',
  pinnedAt: null,
  sessionId: null,
  orphan: false,
} satisfies SplashSummary;

describe('the edit pencil (review)', () => {
  it('shows only where I can edit', () => {
    const card = placeCard(SUMMARY, '', 'UTC');
    const menu = (editable: boolean) =>
      render(
        <InputSheetProvider>
          <CardMenu
            card={{ ...card, editable }}
            pinned={false}
            onPin={() => {}}
            onDelete={() => {}}
          />
        </InputSheetProvider>,
      );
    expect(menu(true).container.querySelector('[data-card-edit]')).not.toBeNull();
    cleanup();
    expect(menu(false).container.querySelector('[data-card-edit]')).toBeNull();
  });
});

function Probe() {
  const { pendingEdits } = useInputSheet();
  return <span data-pending>{JSON.stringify(pendingEdits)}</span>;
}

describe('editing a joint splash (review)', () => {
  it('offers title and icon only, saves them, and shows them at once', async () => {
    const view = render(
      <InputSheetProvider>
        <SplashEditSheet
          splashId="s-joint"
          context={{
            categories: [],
            timeZone: 'UTC',
            today: '2026-10-23',
            links: [],
            pools: [{ id: 'p-ours', name: 'Our Pool' }],
            initials: 'YL',
          }}
          onClose={() => {}}
        />
        <Probe />
      </InputSheetProvider>,
    );
    await waitFor(() =>
      expect(view.container.querySelector('[data-edit-form="joint"]')).not.toBeNull(),
    );
    // No dates, no lane, no audience on a joint splash.
    expect(view.queryByLabelText('Start date')).toBeNull();
    expect(view.container.querySelector('[data-audience-chip]')).toBeNull();
    const save = view.container.querySelector('[data-edit-save]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(view.getByLabelText('Title'), { target: { value: 'Arnak finals' } });
    expect(save.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(save);
    });
    expect(saved[0]).toMatchObject({
      id: 's-joint',
      kind: 'joint',
      title: 'Arnak finals',
      icon: '🏛️',
    });
    expect(view.container.querySelector('[data-pending]')!.textContent).toContain('Arnak finals');
  });
});
