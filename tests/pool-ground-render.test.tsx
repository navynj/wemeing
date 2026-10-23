// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushed: string[] = [];
const replaced: string[] = [];
vi.mock('next/navigation', () => ({
  usePathname: () => '/pool/p-a',
  useRouter: () => ({
    push: (to: string) => pushed.push(to),
    replace: (to: string) => replaced.push(to),
    refresh: () => {},
  }),
}));
vi.mock('@/features/splash/actions', () => ({
  setSplashPinned: () => Promise.resolve({ ok: true }),
  deleteSplash: () => Promise.resolve({ ok: true }),
}));
vi.mock('@/features/pool/actions', () => ({
  deleteJointSplash: () => Promise.resolve({ ok: true }),
  leavePool: () => Promise.resolve({ ok: true }),
  savePoolLane: () => Promise.resolve({ ok: true }),
  createInvite: () => Promise.resolve({ ok: false, message: 'not in tests' }),
  revokeInvite: () => Promise.resolve({ ok: true }),
}));

import { InputSheetProvider } from '@/features/input-sheet/sheet-provider';
import { PoolGround } from '@/features/pool/pool-ground';
import { PoolIndex } from '@/features/pool/pool-index';
import { lastPool, rememberVisit } from '@/features/pool/remembered';
import type { Splash } from '@/features/splash/summary';
import type { MyPool, PoolRipple, PoolView } from '@/lib/queries/pools';
import { written } from './written-on';

const TZ = 'America/Vancouver';
const ME = 'u-me';
const MINA = 'u-mina';
const GONE = 'u-gone';

function splash(over: Partial<Splash> & { id: string }): Splash {
  return written({
    owner_id: ME,
    title: '',
    declared_start: null,
    declared_end: null,
    declared_lane_id: null,
    icon: null,
    session_id: null,
    pinned_at: null,
    pool_id: null,
    pool_lane_id: null,
    own_pool_id: null,
    created_by: null,
    type: 'free',
    prompt: null,
    ends_at: null,
    created_at: '2026-10-20T18:00:00.000Z',
    ...over,
  });
}

function ripple(over: Partial<PoolRipple> & { id: string; splash_id: string }): PoolRipple {
  return written({
    author_id: ME,
    note: 'words',
    media: [],
    occurred_on: '2026-10-21',
    occurred_time: null,
    ended_at: null,
    created_at: '2026-10-21T18:00:00.000Z',
    category_id: 'my-lane',
    started_at: null,
    ...over,
  });
}

const LANE = (id: string, pool: string, name: string, icon: string, position: number) => ({
  id,
  pool_id: pool,
  name,
  icon,
  description: null,
  position,
});

/** Pool A: two current members and one who left keeping theirs; a placed post each, and a joint splash with two ripples. */
const A: PoolView = {
  pool: { id: 'p-a', name: 'Our Pool', ownerId: ME },
  members: [
    {
      userId: ME,
      name: 'Yoonji Lee',
      initials: 'YL',
      joinedAt: '2026-10-01',
      former: false,
      timeZone: TZ,
    },
    {
      userId: MINA,
      name: 'Mina',
      initials: 'MI',
      joinedAt: '2026-10-02',
      former: false,
      timeZone: TZ,
    },
    {
      userId: GONE,
      name: 'Gone',
      initials: 'GO',
      joinedAt: '2026-10-03',
      former: true,
      timeZone: TZ,
    },
  ],
  lanes: [LANE('l-food', 'p-a', 'Food', '🍽️', 0), LANE('l-media', 'p-a', 'Media', '🎬', 1)],
  myLinks: [{ poolLaneId: 'l-food', myCategoryId: 'my-lane', direction: 'both' }],
  placements: [
    { splashId: 's-mine', poolId: 'p-a', poolLaneId: 'l-food', shared: true, ownerId: ME },
    { splashId: 's-mina', poolId: 'p-a', poolLaneId: 'l-food', shared: true, ownerId: MINA },
    { splashId: 's-own', poolId: 'p-a', poolLaneId: 'l-media', shared: true, ownerId: ME },
  ],
  splashes: [
    splash({ id: 's-mine', title: 'Fried egg' }),
    splash({ id: 's-mina', owner_id: MINA, title: 'Hiking' }),
    splash({ id: 's-own', own_pool_id: 'p-a', title: 'Just mine' }),
    splash({
      id: 's-joint',
      owner_id: null,
      pool_id: 'p-a',
      pool_lane_id: 'l-media',
      created_by: MINA,
      title: 'Lost Ruins of Arnak',
      icon: '🏛️',
    }),
  ],
  ripples: [
    ripple({ id: 'r-mine', splash_id: 's-mine', occurred_on: '2026-10-22' }),
    ripple({ id: 'r-mina', splash_id: 's-mina', author_id: MINA }),
    ripple({ id: 'r-own', splash_id: 's-own', category_id: null }),
    ripple({ id: 'r-j1', splash_id: 's-joint', author_id: MINA, occurred_on: '2026-10-20' }),
    ripple({ id: 'r-j2', splash_id: 's-joint', author_id: ME, occurred_on: '2026-10-20' }),
  ],
  invites: [],
};

/** Pool B: nothing of A's. */
const B: PoolView = {
  pool: { id: 'p-b', name: 'Study Crew', ownerId: ME },
  members: [
    {
      userId: ME,
      name: 'Yoonji Lee',
      initials: 'YL',
      joinedAt: '2026-10-05',
      former: false,
      timeZone: TZ,
    },
  ],
  lanes: [LANE('l-notes', 'p-b', 'Notes', '📓', 0)],
  myLinks: [],
  placements: [
    { splashId: 's-study', poolId: 'p-b', poolLaneId: 'l-notes', shared: true, ownerId: ME },
  ],
  splashes: [splash({ id: 's-study', title: 'Chapter 3' })],
  ripples: [ripple({ id: 'r-study', splash_id: 's-study' })],
  invites: [],
};

const POOLS: MyPool[] = [
  { id: 'p-a', name: 'Our Pool', members: [], latestActivity: null },
  {
    id: 'p-b',
    name: 'Study Crew',
    members: [],
    latestActivity: '2026-10-22T00:00:00Z',
  },
];

function ground(view: PoolView) {
  return render(
    <InputSheetProvider>
      <PoolGround view={view} pools={POOLS} me={ME} today="2026-10-23" timeZone={TZ} />
    </InputSheetProvider>,
  );
}

function setView(view: 'lane' | 'date' | 'swimmers'): void {
  window.localStorage.setItem('weming.pool-view', view);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  Element.prototype.scrollTo = function scrollTo() {} as Element['scrollTo'];
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
  pushed.length = 0;
  replaced.length = 0;
});
afterEach(cleanup);

describe('a joint splash on the grid (H23)', () => {
  it('renders once as a band, with one branch per ripple', () => {
    setView('lane');
    const { container } = ground(A);
    expect(container.querySelectorAll('[data-joint-band="s-joint"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-branch]')).toHaveLength(2);
    // Never also a mark in a cell.
    expect(container.querySelectorAll('[data-cell] [data-mark="s-joint"]')).toHaveLength(0);
  });

  it('draws each ripple as a plain dot, never with an icon or a title', () => {
    setView('lane');
    const { container } = ground(A);
    for (const branch of container.querySelectorAll('[data-branch]')) {
      expect(branch.textContent).toBe('');
      expect(branch.querySelector('[data-branch-dot]')).not.toBeNull();
    }
    // The icon and the title are the splash's, on its band.
    expect(container.querySelector('[data-joint-band="s-joint"]')!.textContent).toContain('🏛️');
  });

  it('branches in its own lane in the Lane view, stacked by author', () => {
    setView('lane');
    const { container } = ground(A);
    const cells = [...container.querySelectorAll('[data-branch-cell]')];
    const holding = cells.filter((cell) => cell.querySelector('[data-branch]'));
    expect(holding).toHaveLength(1);
    expect(holding[0].querySelectorAll('[data-branch]')).toHaveLength(2);
  });

  it('branches in each author’s column in Swimmers', () => {
    setView('swimmers');
    const { container } = ground(A);
    const holding = [...container.querySelectorAll('[data-branch-cell]')].filter((cell) =>
      cell.querySelector('[data-branch]'),
    );
    expect(holding).toHaveLength(2);
  });

  it('is a row with its ripples as sub-rows in the Date view', () => {
    setView('date');
    const { container } = ground(A);
    expect(container.querySelectorAll('[data-joint-rows="s-joint"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-joint-sub]')).toHaveLength(2);
  });

  it('comes to the top of the stack from its band', () => {
    setView('lane');
    const { container } = ground(A);
    fireEvent.click(container.querySelector('[data-joint-band="s-joint"]')!);
    expect(container.querySelector('[data-mark="s-joint"]')!.hasAttribute('data-dived')).toBe(
      false,
    );
  });
});

describe('Swimmers (H23)', () => {
  it('has a column per current member, me first, never a former member', () => {
    setView('swimmers');
    const { container } = ground(A);
    const headers = [...container.querySelectorAll('[data-lane-header]')]
      .map((h) => h.getAttribute('data-lane-header'))
      .filter(Boolean);
    expect(headers).toEqual([ME, MINA]);
  });

  it('puts each placed post in its author’s column, with the author under the title', () => {
    setView('swimmers');
    const { container } = ground(A);
    const row = container.querySelector('[data-cell="u-mina"] [data-mark="s-mina"]');
    expect(row).not.toBeNull();
    setView('lane');
    cleanup();
    const lane = ground(A).container;
    expect(lane.querySelector('[data-cell="l-food"] [data-mark-author]')).not.toBeNull();
  });
});

describe('switching pools (H23)', () => {
  it('lists every pool in the switcher, the current one checked', () => {
    const { container, getByText } = ground(A);
    fireEvent.click(container.querySelector('[data-pool-switcher]')!);
    expect(container.ownerDocument.querySelectorAll('[data-switch-pool]')).toHaveLength(2);
    expect(
      container.ownerDocument
        .querySelector('[data-switch-pool="p-a"]')!
        .getAttribute('aria-current'),
    ).toBe('true');
    // Something happened in B since a visit that never was: the dot.
    expect(
      container.ownerDocument.querySelector('[data-switch-pool="p-b"] [data-pool-new]'),
    ).not.toBeNull();
    fireEvent.click(getByText('Study Crew'));
    expect(pushed).toEqual(['/pool/p-b']);
  });

  it('shows only the other pool’s records once switched, in the same view', () => {
    setView('swimmers');
    const first = ground(A).container;
    expect(first.querySelector('[data-mark="s-mine"]')).not.toBeNull();
    cleanup();
    const second = ground(B).container;
    expect(second.querySelector('[data-mark="s-study"]')).not.toBeNull();
    for (const id of ['s-mine', 's-mina', 's-joint']) {
      expect(second.querySelector(`[data-mark="${id}"]`)).toBeNull();
    }
    expect(
      second.querySelector('[data-view-option="swimmers"]')!.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('opens the last pool viewed on this device, after a reload', () => {
    ground(B);
    expect(lastPool()).toBe('p-b');
    cleanup();
    // A reload: the Pool tab asks the device which pool to open.
    render(
      <InputSheetProvider>
        <PoolIndex poolIds={['p-a', 'p-b']} />
      </InputSheetProvider>,
    );
    expect(replaced).toEqual(['/pool/p-b']);
  });

  it('opens the pool joined last when this device remembers none', () => {
    render(
      <InputSheetProvider>
        <PoolIndex poolIds={['p-a', 'p-b']} />
      </InputSheetProvider>,
    );
    expect(replaced).toEqual(['/pool/p-a']);
  });

  it('marks a pool seen once visited', () => {
    rememberVisit('p-b', new Date('2026-10-23T00:00:00Z'));
    const { container } = ground(A);
    fireEvent.click(container.querySelector('[data-pool-switcher]')!);
    expect(
      container.ownerDocument.querySelector('[data-switch-pool="p-b"] [data-pool-new]'),
    ).toBeNull();
  });
});

describe('leaving (H23)', () => {
  it('asks to keep or remove before anything happens', () => {
    const { container, getByText } = ground(A);
    fireEvent.click(container.querySelector('[data-pool-members]')!);
    expect(container.ownerDocument.querySelector('[data-former-member]')).not.toBeNull();
    fireEvent.click(getByText('Leave Pool'));
    expect(getByText('Keep your records in this Pool?')).toBeTruthy();
    expect(getByText('Keep them')).toBeTruthy();
    expect(getByText('Remove them')).toBeTruthy();
  });
});

describe('pool lanes (H23)', () => {
  it('keeps the add form open, cleared, after each lane so the next can follow', () => {
    const { container, getByText } = ground(A);
    fireEvent.click(container.querySelector('[data-manage-pool-lanes]')!);
    fireEvent.click(getByText('+ Add lane'));
    const doc = container.ownerDocument;
    for (const name of ['Books', 'Walks']) {
      const field = doc.querySelector(
        '[data-pool-lane-form] [aria-label="Lane name"]',
      ) as HTMLInputElement;
      expect(field.value).toBe('');
      fireEvent.change(field, { target: { value: name } });
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(doc.querySelector('[data-pool-lane-form]')).not.toBeNull();
    }
    const listed = [...doc.querySelectorAll('[data-pool-lane]')].map((el) => el.textContent);
    expect(listed.some((t) => t?.includes('Books'))).toBe(true);
    expect(listed.some((t) => t?.includes('Walks'))).toBe(true);
  });
});

describe('Just mine in the pool (0014)', () => {
  it('is a mark in its pool lane’s column, never a band', () => {
    setView('lane');
    const { container } = ground(A);
    expect(container.querySelector('[data-cell="l-media"] [data-mark="s-own"]')).not.toBeNull();
    expect(container.querySelector('[data-joint-band="s-own"]')).toBeNull();
  });

  it('is a mark in my column in Swimmers', () => {
    setView('swimmers');
    const { container } = ground(A);
    expect(container.querySelector(`[data-cell="${ME}"] [data-mark="s-own"]`)).not.toBeNull();
  });
});

describe('re-tapping Pool (review)', () => {
  it('cycles Lane → Swimmers → Date → Lane, the toggle following, and keeps the last per device', () => {
    setView('lane');
    const { container } = ground(A);
    const tab = container.querySelector('[data-home-foot="phone"] [data-pool-tab]') as HTMLElement;
    const selected = (): string | null =>
      container
        .querySelector('[data-view-option][aria-selected="true"]')!
        .getAttribute('data-view-option');
    expect(
      [...container.querySelectorAll('[data-view-option]')].map((o) =>
        o.getAttribute('data-view-option'),
      ),
    ).toEqual(['lane', 'swimmers', 'date']);
    expect(selected()).toBe('lane');
    fireEvent.click(tab);
    expect(selected()).toBe('swimmers');
    fireEvent.click(tab);
    expect(selected()).toBe('date');
    expect(window.localStorage.getItem('weming.pool-view')).toBe('date');
    fireEvent.click(tab);
    expect(selected()).toBe('lane');
    // The desktop rail cycles too.
    fireEvent.click(container.querySelector('[data-home-foot="wide"] [data-pool-tab]')!);
    expect(selected()).toBe('swimmers');
  });
});
