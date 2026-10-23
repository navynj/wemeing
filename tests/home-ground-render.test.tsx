// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));
vi.mock('@/features/sessions/actions', () => ({
  titleMonth: () => Promise.resolve({ ok: true }),
  createSession: () => Promise.resolve({ ok: true, session: {} }),
  updateSession: () => Promise.resolve({ ok: true, session: {} }),
  deleteSession: () => Promise.resolve({ ok: true }),
}));
const savedLanes: unknown[] = [];
const orders: string[][] = [];
vi.mock('@/features/lanes/actions', () => ({
  saveLane: (lane: unknown) => {
    savedLanes.push(lane);
    return Promise.resolve({ ok: true });
  },
  reorderLanes: (ids: string[]) => {
    orders.push(ids);
    return Promise.resolve({ ok: true });
  },
  // Settled by the test, so the optimistic state can be observed in flight.
  deleteLane: (id: string) =>
    new Promise((resolve) => {
      deletes.push({ id, resolve });
    }),
}));
const deletes: { id: string; resolve: (outcome: unknown) => void }[] = [];

import { byNewest, placeCard, type Card } from '@/features/home/grid';
import { HomeGround } from '@/features/home/home-ground';
import { InputSheetProvider, useInputSheet } from '@/features/input-sheet/sheet-provider';
import {
  summarizeSplash,
  type Splash,
  type SplashBlock,
  type SplashSummary,
} from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';

const TZ = 'America/Vancouver';
const NOW = new Date('2026-09-25T20:00:00.000Z');
const TODAY = '2026-09-25';

const scrolled: ScrollToOptions[] = [];
beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollTo = function scrollTo(
    this: Element,
    options?: ScrollToOptions | number,
  ) {
    if (typeof options === 'object') scrolled.push(options);
  } as Element['scrollTo'];
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
});
afterEach(cleanup);

function lane(id: string, name: string, icon: string, position: number): MyCategory {
  return {
    id,
    user_id: 'a1',
    name,
    icon,
    default_mode: 'drop',
    position,
    created_at: '2026-01-01T00:00:00Z',
  };
}
const LANES = [
  lane('c-food', 'Food', '🍜', 0),
  lane('c-place', 'Place', '📍', 1),
  lane('c-day', 'Day', '🖋', 2),
];

function block(id: string, day: string, category = 'c-day', note = id): SplashBlock {
  return {
    id,
    category_id: category,
    note,
    occurred_on: day,
    occurred_time: null,
    created_at: `${day}T16:00:00.000Z`,
  };
}
function post(
  id: string,
  title: string,
  blocks: SplashBlock[],
  over: Partial<Splash> = {},
): SplashSummary {
  return summarizeSplash(
    {
      id,
      owner_id: 'a1',
      title,
      declared_start: null,
      declared_end: null,
      declared_lane_id: null,
      session_id: null,
      pinned_at: null,
      pool_id: null,
      type: 'free',
      prompt: null,
      ends_at: null,
      created_at: '2026-09-01T16:00:00.000Z',
      ...over,
    },
    blocks,
    TZ,
    NOW,
  );
}

const POSTS = [
  post('late', 'Toy Story 5', [block('l', '2026-09-20', 'c-food')]),
  post('early', 'Arnak', [
    block('e1', '2026-09-03'),
    block('e2', '2026-09-04'),
    block('e3', '2026-09-05'),
  ]),
  post('mid', '', [
    block('m', '2026-09-12', 'c-place', 'coffee went cold while I read the whole thing'),
  ]),
  post('soup', 'Beef Short Rib Soup & Alfa Tea', [block('s', '2026-09-08', 'c-food')]),
  post('aug', 'Whistler', [block('a', '2026-08-17', 'c-place')], {
    pinned_at: '2026-09-01T00:00:00Z',
  }),
];

function Dropper({ splash, month }: { splash: SplashSummary; month: string }) {
  const { markDropped } = useInputSheet();
  useEffect(() => markDropped({ splash, month, note: null }), [splash, month, markDropped]);
  return null;
}

/** The sheet host lives in the shell; here the provider's state stands in for it. */
function SheetProbe() {
  const { sheet } = useInputSheet();
  return sheet ? <span data-sheet-open={sheet.kind} /> : null;
}

function Deleter({ id }: { id: string }) {
  const { markDeleted } = useInputSheet();
  useEffect(() => markDeleted(id), [id, markDeleted]);
  return null;
}

function cards(posts: SplashSummary[]): Card[] {
  return posts.map((p) => placeCard(p, p.ghostTitle ?? '', TZ)).sort(byNewest);
}

function ground(
  posts = POSTS,
  dropped: SplashSummary | null = null,
  deleted: string | null = null,
  categories = LANES,
  month: string | null = null,
) {
  return render(
    <InputSheetProvider>
      {dropped ? <Dropper splash={dropped} month={month ?? '2026-09'} /> : null}
      {deleted ? <Deleter id={deleted} /> : null}
      <SheetProbe />
      <HomeGround
        cards={cards(posts)}
        pinned={posts.filter((p) => p.pinnedAt)}
        categories={categories}
        sessions={[]}
        counts={{}}
        customCounts={{}}
        earliestYear={2026}
        today={TODAY}
        timeZone={TZ}
        initials="YL"
        scrollToMonth={month}
      />
    </InputSheetProvider>,
  );
}

const markIds = (root: Element): (string | null)[] =>
  [...root.querySelectorAll('[data-mark]')].map((el) => el.getAttribute('data-mark'));
const cellOf = (mark: Element): HTMLElement => mark.closest<HTMLElement>('[data-cell]')!;
const rowOf = (mark: Element): HTMLElement => {
  // A row is the rail cell and the cells after it, up to the next rail cell.
  let el: Element | null = cellOf(mark);
  while (el && !el.hasAttribute('data-day-row')) el = el.previousElementSibling;
  return el as HTMLElement;
};
const topCard = (root: Element): HTMLElement =>
  root.querySelector<HTMLElement>('[data-stack-card][data-slot="0"]')!;
const tabs = (root: Element): (string | null)[] =>
  [...root.querySelectorAll('[data-stack-card]')]
    .filter((el) => el.getAttribute('data-slot') !== '0' && el.getAttribute('data-slot') !== '-1')
    .sort((a, b) => Number(a.getAttribute('data-slot')) - Number(b.getAttribute('data-slot')))
    .map((el) => el.getAttribute('data-stack-card'));
const flipped = (root: Element): Promise<void> => waitFor(() => expectSettled(root));
/** The ring arrives once the mark has been brought into view. */
const ringed = (root: Element, id: string): Promise<void> =>
  waitFor(() => expect(root.querySelector(`[data-mark="${id}"][data-ring]`)).not.toBeNull());
/** The window reaches every day once the grid has measured where its end is. */
const grown = (root: Element): Promise<void> =>
  waitFor(() => expect(root.querySelector('[data-day-row="2026-08-17"]')).not.toBeNull());
function expectSettled(root: Element): void {
  for (const el of root.querySelectorAll('[data-stack-card]')) {
    expect(el.getAttribute('data-slot')).toBe(el.getAttribute('data-to'));
  }
}

describe('the water ground (H22)', () => {
  it('is the blue ground: the grid above, the diving board below, white carrying content', () => {
    const { container } = ground();
    expect(container.querySelector('[data-home-ground]')!.className).toContain('water-ground');
    const grid = container.querySelector('[data-lane-grid]')!;
    const board = container.querySelector('[data-diving-board]')!;
    expect(grid.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const mark of container.querySelectorAll('[data-mark]')) {
      expect(mark.className).toContain('bg-white');
    }
    expect(container.querySelector('[data-avatar]')!.textContent).toBe('YL');
  });

  it('shows the title as text with its menu, and nothing of Pools or Friends', () => {
    const { container, queryByText } = ground();
    expect(container.querySelector('[data-home-menu-button]')!.textContent).toBe('Home');
    expect(queryByText(/pool|friends|my lanes/i)).toBeNull();
    expect(container.querySelector('[data-tab-bar]')).toBeNull();
    expect(container.querySelector('[data-month-scrubber]')).toBeNull();
  });
});

describe('the lane grid', () => {
  it('places every post exactly once, on its lane\u2019s column and its day\u2019s row', async () => {
    const { container } = ground();
    await grown(container);
    const ids = markIds(container);
    expect([...ids].sort()).toEqual(['aug', 'early', 'late', 'mid', 'soup']);
    expect(cellOf(container.querySelector('[data-mark="late"]')!).getAttribute('data-cell')).toBe(
      'c-food',
    );
    expect(rowOf(container.querySelector('[data-mark="late"]')!).getAttribute('data-day-row')).toBe(
      '2026-09-20',
    );
    // A post sits on the last day of its range (H22): Arnak's third block.
    expect(
      rowOf(container.querySelector('[data-mark="early"]')!).getAttribute('data-day-row'),
    ).toBe('2026-09-05');
    expect(cellOf(container.querySelector('[data-mark="early"]')!).getAttribute('data-cell')).toBe(
      'c-day',
    );
  });

  it('reads newest day first, with the year and month only where the month changes', async () => {
    const { container } = ground();
    await grown(container);
    const rows = [...container.querySelectorAll('[data-day-row]')].map((r) =>
      r.getAttribute('data-day-row'),
    );
    expect(rows[0]).toBe('2026-09-25');
    expect(rows[1]).toBe('2026-09-24');
    expect(rows).toContain('2026-08-17');
    const labelled = [...container.querySelectorAll('[data-day-row]')]
      .filter((r) => r.querySelector('[data-month-label]'))
      .map((r) => r.getAttribute('data-day-row'));
    expect(labelled).toEqual(['2026-09-25', '2026-08-31']);
    expect(container.querySelector('[data-day-row="2026-09-25"]')!.textContent).toContain('FRI');
  });

  it('heads each column with its emoji over its name, in lane order, a rope down each', () => {
    const { container } = ground();
    const headers = [...container.querySelectorAll('[data-lane-header]')];
    expect(headers.map((h) => h.getAttribute('data-lane-header'))).toEqual([
      'c-food',
      'c-place',
      'c-day',
    ]);
    expect(headers[0].textContent).toBe('🍜Food');
    const row = container.querySelector('[data-day-row="2026-09-24"]')!;
    const cells = [row.nextElementSibling, row.nextElementSibling!.nextElementSibling];
    for (const cell of cells) expect(cell!.querySelector('[data-rope]')).not.toBeNull();
  });

  it('renders an empty month as rows of empty ropes, with no copy', () => {
    const { container, queryByText } = ground([]);
    expect(container.querySelectorAll('[data-day-row]').length).toBeGreaterThanOrEqual(21);
    expect(container.querySelector('[data-mark]')).toBeNull();
    expect(queryByText(/quiet|fresh page|nothing/i)).toBeNull();
    expect(container.querySelector('[data-diving-board] [data-stack]')).toBeNull();
    expect(container.querySelector('[data-drop-bar]')).not.toBeNull();
  });

  it('stacks two posts on one lane and day within the row', () => {
    const twin = post('twin', 'Second soup', [block('t', '2026-09-08', 'c-food')]);
    const { container } = ground([...POSTS, twin]);
    const cell = cellOf(container.querySelector('[data-mark="soup"]')!);
    expect(markIds(cell).sort()).toEqual(['soup', 'twin']);
  });

  it('places a post by its declared lane over the lane its blocks took', () => {
    const declared = post('decl', 'Declared', [block('d', '2026-09-10', 'c-day')], {
      declared_lane_id: 'c-place',
    });
    const { container } = ground([declared]);
    expect(cellOf(container.querySelector('[data-mark="decl"]')!).getAttribute('data-cell')).toBe(
      'c-place',
    );
  });

  it('gives a post on no lane of mine one unlabelled column at the end, only when any', () => {
    const { container: plain } = ground();
    expect(plain.querySelector('[data-lane-header=""]')).toBeNull();
    const stray = post('stray', 'Stray', [block('x', '2026-09-09', 'c-gone')]);
    const { container } = ground([stray]);
    expect(container.querySelector('[data-lane-header=""]')).not.toBeNull();
    expect(cellOf(container.querySelector('[data-mark="stray"]')!).getAttribute('data-cell')).toBe(
      '',
    );
  });

  it('shares the width among seven lanes or fewer, and fixes the columns past that', () => {
    const seven = Array.from({ length: 7 }, (_, i) => lane(`l${i}`, `Lane ${i}`, '🌊', i));
    const { container: even } = ground([], null, null, seven);
    const grid = even.querySelector<HTMLElement>('[data-lane-grid]')!;
    expect(grid.getAttribute('data-columns')).toBe('even');
    expect(grid.querySelector<HTMLElement>('[data-grid]')!.style.gridTemplateColumns).toContain(
      'repeat(7, minmax(0, 1fr))',
    );
    cleanup();
    const eight = [...seven, lane('l7', 'Lane 7', '🌊', 7)];
    const { container: fixed } = ground([], null, null, eight);
    const wide = fixed.querySelector<HTMLElement>('[data-lane-grid]')!;
    expect(wide.getAttribute('data-columns')).toBe('fixed');
    expect(wide.querySelector<HTMLElement>('[data-grid]')!.style.gridTemplateColumns).toContain(
      'repeat(8, 56px)',
    );
    // The rail and the headers stay put: sticky inside the one scroller.
    expect(wide.querySelector('[data-day-row]')!.className).toContain('sticky left-0');
    expect(wide.querySelector('[data-lane-header]')!.className).toContain('sticky top-0');
    expect(wide.style.touchAction).toBe('pan-x pan-y');
  });

  it('opens the lanes sheet from a lane header, and the new-lane sheet from the +', () => {
    const { container, getByLabelText, getByRole } = ground();
    fireEvent.click(container.querySelector('[data-lane-header="c-food"]')!);
    expect(getByRole('dialog', { name: 'Edit lanes' })).toBeTruthy();
    fireEvent.click(getByLabelText('Close'));
    fireEvent.click(getByLabelText('New lane'));
    expect(getByRole('dialog', { name: 'New lane' })).toBeTruthy();
  });
});

describe('the diving board', () => {
  it('reads the newest post as the top card, with its mark ringed on first render', async () => {
    const { container } = ground();
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
    await ringed(container, 'late');
    expect(container.querySelectorAll('[data-commit-ripple]')).toHaveLength(1);
    for (const ring of container.querySelectorAll<HTMLElement>('.commit-ring')) {
      expect(ring.style.animationIterationCount).toBe('1');
    }
  });

  it('peeks the next older cards as tabs, each its emoji and title', () => {
    const { container } = ground();
    expect(tabs(container)).toEqual(['mid', 'soup']);
    const tab = container.querySelector('[data-tab="mid"]')!;
    expect(tab.textContent).toContain('📍');
    expect(tab.textContent).toContain('coffee went cold');
  });

  it('reads the top card: date with weekday, lane chip, emoji and title, initials, body', () => {
    const { container } = ground();
    const card = topCard(container);
    expect(card.querySelector('[data-card-date]')!.textContent).toBe('Sep 20 (SUN)');
    expect(card.textContent).toContain('Food');
    expect(card.textContent).toContain('🍜');
    expect(card.textContent).toContain('Toy Story 5');
    expect(card.textContent).toContain('YL');
    expect(card.querySelector('[data-card-link]')!.getAttribute('href')).toBe(
      '/splash/late?from=2026-09',
    );
  });

  it('brings a tapped tab forward, moving the ring to its mark', async () => {
    const { container } = ground();
    fireEvent.click(container.querySelector('[data-tab="soup"]')!);
    await flipped(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('soup');
    await ringed(container, 'soup');
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(1);
    expect(tabs(container)).toEqual(['early', 'aug']);
  });

  it('brings a tapped mark\u2019s card to the top, and scrolls the grid to the mark', async () => {
    const { container } = ground();
    await grown(container);
    fireEvent.click(container.querySelector('[data-mark="aug"]')!);
    await flipped(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('aug');
    await ringed(container, 'aug');
    // Round again: the newest follows the oldest.
    expect(tabs(container)).toEqual(['late', 'mid']);
  });

  it('opens the post sheet from the drop bar', () => {
    const { container } = ground();
    expect(container.querySelector('[data-sheet-open]')).toBeNull();
    fireEvent.click(container.querySelector('[data-drop-bar]')!);
    expect(container.querySelector('[data-sheet-open="splash"]')).not.toBeNull();
  });

  it('keeps its height whatever is on top, so the grid never moves', async () => {
    const { container } = ground();
    const stack = container.querySelector<HTMLElement>('[data-stack]')!;
    const height = stack.style.height;
    fireEvent.click(container.querySelector('[data-tab="mid"]')!);
    await flipped(container);
    expect(stack.style.height).toBe(height);
  });
});

describe('the post just dropped', () => {
  it('is on the grid at once with the ring, and lands on top of the stack', async () => {
    const fresh = post('fresh', 'Just dropped', [block('f', '2026-09-25', 'c-place')]);
    const { container } = ground(POSTS, fresh);
    expect(cellOf(container.querySelector('[data-mark="fresh"]')!).getAttribute('data-cell')).toBe(
      'c-place',
    );
    await flipped(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('fresh');
    await ringed(container, 'fresh');
    expect(container.querySelectorAll('[data-commit-ripple]')).toHaveLength(1);
  });

  it('takes a deleted post off the grid, the stack and the pinned bar at once', () => {
    const { container } = ground(POSTS, null, 'aug');
    expect(markIds(container)).not.toContain('aug');
    expect(container.querySelector('[data-stack-card="aug"]')).toBeNull();
    expect(container.querySelector('[data-pinned-bar]')).toBeNull();
  });
});

describe('the menu', () => {
  it('reaches the Locker, the sessions sheet and the lanes sheet', () => {
    const { container, getByRole } = ground();
    fireEvent.click(container.querySelector('[data-home-menu-button]')!);
    const menu = container.querySelector('[data-home-menu]')!;
    expect(menu.className).toContain('bg-ink');
    expect(menu.querySelector('a[href="/locker"]')!.textContent).toBe('Locker');
    fireEvent.click(within(menu as HTMLElement).getByText('Sessions'));
    expect(
      getByRole('dialog', { name: 'Sessions' }).querySelector('[data-session-schedule]'),
    ).not.toBeNull();
    fireEvent.click(getByRole('button', { name: 'Close' }));
    fireEvent.click(container.querySelector('[data-home-menu-button]')!);
    fireEvent.click(
      within(container.querySelector('[data-home-menu]') as HTMLElement).getByText('Lanes'),
    );
    expect(getByRole('dialog', { name: 'Edit lanes' })).toBeTruthy();
  });
});

describe('?m= as a scroll target', () => {
  it('opens with the month\u2019s newest post on top, and scrolls the grid to the month', () => {
    const { container } = ground(POSTS, null, null, LANES, '2026-08');
    expect(topCard(container).getAttribute('data-stack-card')).toBe('aug');
    expect(scrolled.length).toBeGreaterThan(0);
  });
});

describe('the pinned bar (H21g)', () => {
  it('sits in ink between the grid and the stack, a chip per pinned post', () => {
    const { container } = ground();
    const bar = container.querySelector('[data-pinned-bar]')!;
    expect(bar.className).toContain('bg-ink');
    const chip = bar.querySelector('[data-pinned-chip="aug"]')!;
    expect(chip.textContent).toContain('Whistler');
    const grid = container.querySelector('[data-lane-grid]')!;
    const board = container.querySelector('[data-diving-board]')!;
    expect(grid.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent when nothing is pinned', () => {
    const { container } = ground(POSTS.filter((p) => !p.pinnedAt));
    expect(container.querySelector('[data-pinned-bar]')).toBeNull();
  });
});

const openLanes = (container: HTMLElement): void => {
  fireEvent.click(container.querySelector('[data-home-menu-button]')!);
  fireEvent.click(container.querySelector('[data-home-menu] [data-edit-lanes]')!);
};

describe('the lanes sheet from the menu', () => {
  it('edits every lane’s icon and name in one sheet', async () => {
    savedLanes.length = 0;
    const { getByRole, getByText, container } = ground();
    openLanes(container);
    const sheet = getByRole('dialog', { name: 'Edit lanes' });
    expect(sheet.querySelectorAll('[data-lane-row]')).toHaveLength(3);
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    const food = sheet.querySelector('[data-lane-row="c-food"]')!;
    fireEvent.change(food.querySelector('input[aria-label^="Icon"]')!, {
      target: { value: '🍣' },
    });
    fireEvent.change(food.querySelector('input[aria-label="Lane name"]')!, {
      target: { value: 'Meals' },
    });
    fireEvent.click(getByText('Save'));
    await waitFor(() => expect(savedLanes).toHaveLength(1));
    expect(savedLanes[0]).toEqual({ id: 'c-food', name: 'Meals', icon: '🍣' });
    await waitFor(() => expect(container.querySelector('[data-lanes-sheet]')).toBeNull());
  });

  it('reorders the lanes by dragging a grip, keeping up with a fast drag, and saves the order', async () => {
    orders.length = 0;
    const { getByLabelText, getByRole, getByText, container } = ground();
    openLanes(container);
    const sheet = getByRole('dialog', { name: 'Edit lanes' });
    const order = (): (string | null)[] =>
      [...sheet.querySelectorAll('[data-lane-row]')].map((r) => r.getAttribute('data-lane-row'));
    for (const row of sheet.querySelectorAll<HTMLElement>('[data-lane-row]')) {
      row.getBoundingClientRect = () => {
        const index = order().indexOf(row.getAttribute('data-lane-row'));
        return { top: index * 40, height: 40 } as DOMRect;
      };
    }
    const grip = getByLabelText('Move Day');
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 50 });
    expect(order()).toEqual(['c-food', 'c-day', 'c-place']);
    fireEvent.pointerUp(grip, { pointerId: 1 });
    fireEvent.click(getByText('Save'));
    await waitFor(() => expect(orders).toHaveLength(1));
    expect(orders[0]).toEqual(['c-food', 'c-day', 'c-place']);
  });

  it('deletes an empty lane at once, and brings one with records back with the refusal', async () => {
    deletes.length = 0;
    const { getByLabelText, getByRole, getByText, container } = ground();
    openLanes(container);
    const sheet = getByRole('dialog', { name: 'Edit lanes' });
    fireEvent.click(getByLabelText('Delete Day'));
    fireEvent.click(getByText('Delete'));
    await waitFor(() => expect(sheet.querySelector('[data-lane-row="c-day"]')).toBeNull());
    await act(async () =>
      deletes[0].resolve({ ok: false, message: 'This lane holds 2 records, so it stays.' }),
    );
    await waitFor(() =>
      expect(within(sheet).getByText('This lane holds 2 records, so it stays.')).toBeTruthy(),
    );
    expect(sheet.querySelector('[data-lane-row="c-day"]')).not.toBeNull();
  });
});
