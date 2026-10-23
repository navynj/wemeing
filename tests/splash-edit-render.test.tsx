// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}));
const saved: Record<string, unknown>[] = [];
const JOINT = {
  ok: true,
  kind: 'joint',
  title: 'Arnak league',
  icon: '🏛️',
  declaredStart: null,
  declaredEnd: null,
  declaredLaneId: null,
  shared: [],
  poolId: 'p-ours',
  date: { source: 'declared' },
  annotation: null,
  poolLanes: [
    { id: 'l-games', name: 'Games', icon: '🎲' },
    { id: 'l-media', name: 'Media', icon: '🎬' },
  ],
  poolLaneId: 'l-games',
};
const loaded = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('@/features/splash-sheet/edit-actions', () => ({
  loadSplashEdit: () => Promise.resolve(loaded.state ?? JOINT),
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

afterEach(() => {
  cleanup();
  loaded.state = null;
  saved.length = 0;
});

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
    expect(view.container.querySelector('[data-edit-date]')).toBeNull();
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

const CONTEXT = {
  categories: [],
  timeZone: 'America/Vancouver',
  today: '2026-10-23',
  links: [],
  pools: [{ id: 'p-ours', name: 'Our Pool' }],
  initials: 'YL',
};

async function open(state: Record<string, unknown>) {
  loaded.state = { ...JOINT, ...state };
  const view = render(
    <InputSheetProvider>
      <SplashEditSheet splashId="s-1" context={CONTEXT} onClose={() => {}} />
    </InputSheetProvider>,
  );
  await waitFor(() => expect(view.container.querySelector('[data-edit-form]')).not.toBeNull());
  return view;
}

const save = async (view: ReturnType<typeof render>) => {
  await act(async () => {
    fireEvent.click(view.container.querySelector('[data-edit-save]')!);
  });
};

describe('a splash’s date in the edit sheet (review)', () => {
  it('opens with the date and time the composer put on its first ripple, not a range', async () => {
    const view = await open({
      kind: 'mine',
      title: 'Coffee',
      date: { source: 'block', rippleId: 'r-first' },
      annotation: { date: '2026-10-20', time: '14:30', endDate: null, endTime: null },
    });
    expect((view.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-20');
    expect((view.getByLabelText('Time') as HTMLInputElement).value).toBe('14:30');
    expect(view.queryByLabelText('End date')).toBeNull();
    expect(view.container.textContent).not.toMatch(/From/);
    expect((view.container.querySelector('[data-edit-save]') as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(view.getByLabelText('Date'), { target: { value: '2026-10-21' } });
    await save(view);
    expect(saved[0]).toMatchObject({
      declaredStart: null,
      declaredEnd: null,
      block: {
        rippleId: 'r-first',
        occurredOn: '2026-10-21',
        occurredTime: '14:30',
        // 14:30 in Vancouver.
        startInstant: '2026-10-21T21:30:00.000Z',
        endInstant: null,
      },
    });
  });

  it('opens a declared range as its days, with no clock, and saves the declaration', async () => {
    const view = await open({
      kind: 'mine',
      title: 'Whistler',
      declaredStart: '2026-10-10',
      declaredEnd: '2026-10-12',
      annotation: { date: '2026-10-10', time: null, endDate: '2026-10-12', endTime: null },
    });
    expect((view.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-10');
    expect((view.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-12');
    expect(view.queryByText('+ add time')).toBeNull();
    fireEvent.change(view.getByLabelText('End date'), { target: { value: '2026-10-13' } });
    await save(view);
    expect(saved[0]).toMatchObject({
      declaredStart: '2026-10-10',
      declaredEnd: '2026-10-13',
      block: null,
    });
  });
});

describe('a pool’s own splash in the edit sheet (0020)', () => {
  it('offers only its pool’s lanes, and saves a move', async () => {
    const view = await open({});
    const lanes = view.container.querySelector('[data-edit-pool-lanes]')!;
    expect(lanes.textContent).toContain('Games');
    expect(lanes.textContent).toContain('Media');
    fireEvent.click(view.getByText('Media'));
    await save(view);
    expect(saved[0]).toMatchObject({ kind: 'joint', poolLaneId: 'l-media' });
  });

  it('sends no move when the lane is unchanged', async () => {
    const view = await open({});
    fireEvent.change(view.getByLabelText('Title'), { target: { value: 'Renamed' } });
    await save(view);
    expect(saved[0]).toMatchObject({ poolLaneId: null });
  });

  it('keeps my own lane chips, not the pool’s, for my splash shared to a pool', async () => {
    const view = await open({ kind: 'mine', poolLanes: [], poolLaneId: null });
    expect(view.container.querySelector('[data-edit-pool-lanes]')).toBeNull();
  });
});
