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
const pins: [string, boolean][] = [];
const deleted: string[] = [];
vi.mock('@/features/splash/actions', () => ({
  setSplashPinned: (id: string, pinned: boolean) => {
    pins.push([id, pinned]);
    return Promise.resolve({ ok: true });
  },
  deleteSplash: (id: string) => {
    deleted.push(id);
    return Promise.resolve({ ok: true });
  },
}));
vi.mock('@/features/ripple-sheet/actions', () => ({
  deleteRipple: (id: string) => {
    deleted.push(id);
    return Promise.resolve({ ok: true });
  },
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
import { DETAIL_TITLE_CLASS } from '@/features/splash/splash-header';
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
  board: 'stair' | 'flip' = 'stair',
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
        board={board}
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
/** The pile's strips, newest-turned first (the page-turn board). */
const pile = (root: Element): (string | null)[] =>
  [...root.querySelectorAll('[data-pile-strip][data-pile-slot]')]
    .sort(
      (a, b) => Number(a.getAttribute('data-pile-slot')) - Number(b.getAttribute('data-pile-slot')),
    )
    .map((el) => el.getAttribute('data-pile-strip'));
/** Nothing moving or turning. */
const settled = (root: Element): Promise<void> =>
  waitFor(() => {
    expect(root.querySelector('[data-moving]')).toBeNull();
    expect(root.querySelector('[data-turning]')).toBeNull();
  });
/** A stair's cards, nearest the top first. */
const stair = (root: Element, which: 'up' | 'down'): (string | null)[] =>
  [...root.querySelectorAll(`[data-stack-card][data-stair="${which}"]`)]
    .sort((a, b) => Number(a.getAttribute('data-step')) - Number(b.getAttribute('data-step')))
    .map((el) => el.getAttribute('data-stack-card'));
const scaleOf = (el: Element): number =>
  Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1] ?? 1);
const water = (root: Element): (string | null)[] =>
  [...root.querySelectorAll('[data-mark][data-dived]')].map((el) => el.getAttribute('data-mark'));
/** The ring arrives once the mark has been brought into view. */
const ringed = (root: Element, id: string): Promise<void> =>
  waitFor(() => expect(root.querySelector(`[data-mark="${id}"][data-ring]`)).not.toBeNull());
/** The window reaches every day once the grid has measured where its end is. */
const grown = (root: Element): Promise<void> =>
  waitFor(() => expect(root.querySelector('[data-day-row="2026-08-17"]')).not.toBeNull());
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

  it('reads newest day first, names only the days with something, and the month on the first named day', async () => {
    const { container } = ground();
    await grown(container);
    const rows = [...container.querySelectorAll('[data-day-row]')].map((r) =>
      r.getAttribute('data-day-row'),
    );
    // A run of empty days is one short gap, with no date (review).
    expect(rows[0]).toBe('2026-09-25');
    expect(rows[1]).toBe('2026-09-20');
    const gap = container.querySelector('[data-day-row="2026-09-25"]')!;
    expect(gap.getAttribute('data-gap')).toBe('');
    expect(gap.getAttribute('data-day-to')).toBe('2026-09-21');
    expect(gap.textContent).toBe('');
    expect(rows).toContain('2026-08-17');
    const named = [...container.querySelectorAll('[data-day-row][data-labelled]')].map((r) =>
      r.getAttribute('data-day-row'),
    );
    expect(named).toEqual(['2026-09-20', '2026-09-12', '2026-09-08', '2026-09-05', '2026-08-17']);
    expect(container.querySelector('[data-day-row="2026-09-20"]')!.textContent).toContain('SUN');
    const monthLabelled = [...container.querySelectorAll('[data-day-row]')]
      .filter((r) => r.querySelector('[data-month-label]'))
      .map((r) => r.getAttribute('data-day-row'));
    expect(monthLabelled).toEqual(['2026-09-20', '2026-08-17']);
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
    // A rope runs beside each lane, between it and the next; none at the rail's side (review).
    const row = container.querySelector('[data-day-row="2026-09-20"]')!;
    const cells = [row.nextElementSibling!, row.nextElementSibling!.nextElementSibling!];
    expect(cells[0].querySelector('[data-rope]')).toBeNull();
    expect(cells[1].querySelector('[data-rope]')).not.toBeNull();
  });

  it('renders an empty month as one compressed gap of empty ropes, with no copy', () => {
    const { container, queryByText } = ground([]);
    expect(container.querySelectorAll('[data-day-row]')).toHaveLength(1);
    expect(container.querySelector('[data-day-row][data-gap]')).not.toBeNull();
    expect(container.querySelectorAll('[data-rope]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-mark]')).toBeNull();
    expect(queryByText(/quiet|fresh page|nothing/i)).toBeNull();
    expect(container.querySelector('[data-diving-board] [data-stack]')).toBeNull();
    expect(container.querySelector('[data-compose]')).not.toBeNull();
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

  it('opens a lane\u2019s detail from its header: its titles as a list, newest first', () => {
    const { container, getByLabelText, getByRole } = ground();
    fireEvent.click(container.querySelector('[data-lane-header="c-food"]')!);
    const sheet = getByRole('dialog', { name: 'Food' });
    expect(sheet.textContent).toContain('2 posts');
    const posts = [...sheet.querySelectorAll('[data-lane-post]')].map((p) => p.textContent);
    expect(posts[0]).toContain('Toy Story 5');
    expect(posts[0]).toContain('Sep 20');
    expect(posts[1]).toContain('Beef Short Rib Soup');
    expect(sheet.querySelector('[data-lane-post="late"]')!.getAttribute('href')).toBe(
      '/splash/late?from=2026-09',
    );
    fireEvent.click(getByLabelText('Close'));
    expect(container.querySelector('[data-lane-detail]')).toBeNull();
  });

  it('opens the lanes sheet from the = above the rail, and the new-lane sheet from the +', () => {
    const { container, getByLabelText, getByRole } = ground();
    fireEvent.click(container.querySelector('[data-grid-header] [data-edit-lanes]')!);
    expect(getByRole('dialog', { name: 'Edit lanes' })).toBeTruthy();
    fireEvent.click(getByLabelText('Close'));
    fireEvent.click(getByLabelText('New lane'));
    expect(getByRole('dialog', { name: 'New lane' })).toBeTruthy();
  });
});

describe('the diving board, a staircase', () => {
  it('reads the newest post as the top card, with its mark ringed on first render', async () => {
    const { container } = ground();
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
    expect(topCard(container).getAttribute('data-stair')).toBe('top');
    await ringed(container, 'late');
    expect(container.querySelectorAll('[data-commit-ripple]')).toHaveLength(1);
    for (const ring of container.querySelectorAll<HTMLElement>('.commit-ring')) {
      expect(ring.style.animationIterationCount).toBe('1');
    }
  });

  it('steps the unread cards down below the top, each smaller by 0.94, three at most; no strip, no chevron', () => {
    const { container } = ground();
    expect(stair(container, 'down')).toEqual(['mid', 'soup', 'early']);
    expect(stair(container, 'up')).toEqual([]);
    const scales = stair(container, 'down').map((id) =>
      scaleOf(container.querySelector(`[data-stack-card="${id}"]`)!),
    );
    expect(scales[0]).toBeCloseTo(0.94, 3);
    expect(scales[1]).toBeCloseTo(0.94 ** 2, 3);
    expect(scales[2]).toBeCloseTo(0.94 ** 3, 3);
    expect(scaleOf(topCard(container))).toBe(1);
    const behind = container.querySelector('[data-stack-card="mid"]')!;
    expect(behind.textContent).toContain('📍');
    expect(behind.textContent).toContain('coffee went cold');
    expect(container.querySelector('[data-surfaced]')).toBeNull();
    expect(container.querySelector('[data-tab]')).toBeNull();
    expect(pile(container)).toEqual([]);
  });

  it('reads the top card: the title at the detail title size, then the date, the chip, the initials and the body', () => {
    const { container } = ground();
    const card = topCard(container);
    expect(card.querySelector('[data-card-title]')!.className).toContain(DETAIL_TITLE_CLASS);
    expect(card.querySelector('[data-card-date]')!.textContent).toBe('Sep 20 (SUN)');
    expect(card.textContent).toContain('Food');
    expect(card.textContent).toContain('🍜');
    expect(card.textContent).toContain('Toy Story 5');
    expect(card.textContent).toContain('YL');
    expect(card.querySelector('[data-card-link]')!.getAttribute('href')).toBe(
      '/splash/late?from=2026-09',
    );
    const behind = container.querySelector('[data-stack-card="mid"] [data-card-title]')!;
    expect(behind.className).not.toContain('text-3xl');
  });

  it('flips forward from a tap on the first lower card: the top goes up one step, the ring moves', async () => {
    const { container } = ground();
    fireEvent.click(container.querySelector('[data-step-card="mid"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    expect(stair(container, 'up')).toEqual(['late']);
    expect(stair(container, 'down')).toEqual(['soup', 'early', 'aug']);
    // One solid mark, the top card's; every other translucent.
    expect(water(container)).not.toContain('mid');
    expect(water(container)).toContain('late');
    expect(water(container)).toContain('soup');
    await ringed(container, 'mid');
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(1);
  });

  it('flips back from a tap on the upper card: the upper stair empties', async () => {
    const { container } = ground();
    fireEvent.click(container.querySelector('[data-step-card="mid"]')!);
    await settled(container);
    fireEvent.click(container.querySelector('[data-step-card="late"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
    expect(stair(container, 'up')).toEqual([]);
    expect(water(container)).not.toContain('late');
    await ringed(container, 'late');
  });

  it('brings the second lower card to the top, moving two cards into the upper stair', async () => {
    const { container } = ground();
    fireEvent.click(container.querySelector('[data-step-card="soup"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('soup');
    // One read card above, the one read last; the rest wait at their marks.
    expect(stair(container, 'up')).toEqual(['mid']);
    expect(water(container)).not.toContain('soup');
    expect(water(container)).toContain('mid');
  });

  it('brings a tapped mark\u2019s card to the top with the same motion, read cards above it', async () => {
    const { container } = ground();
    await grown(container);
    fireEvent.click(container.querySelector('[data-mark="aug"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('aug');
    expect(stair(container, 'up')).toEqual(['early']);
    expect(water(container)).toHaveLength(4);
    expect(water(container)).not.toContain('aug');
    await ringed(container, 'aug');
    fireEvent.click(container.querySelector('[data-mark="mid"][data-dived]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    expect(stair(container, 'up')).toEqual(['late']);
  });

  it('offers open, pin and delete from the top card\u2019s menu; pin shows on the bar at once', async () => {
    pins.length = 0;
    const { container, getByRole } = ground(POSTS.filter((p) => !p.pinnedAt));
    expect(container.querySelector('[data-pinned-bar]')).toBeNull();
    fireEvent.click(topCard(container).querySelector('[data-card-menu-button]')!);
    const menu = container.querySelector('[data-card-menu]')!;
    expect(menu.querySelector('a[href="/splash/late?from=2026-09"]')!.textContent).toBe('Open');
    fireEvent.click(getByRole('menuitem', { name: 'Pin' }));
    await waitFor(() =>
      expect(container.querySelector('[data-pinned-chip="late"]')).not.toBeNull(),
    );
    await waitFor(() => expect(pins).toEqual([['late', true]]));
  });

  it('deletes from the top card\u2019s menu behind a confirm: gone from the board and the grid at once', async () => {
    deleted.length = 0;
    const { container, getByRole, getByText } = ground();
    fireEvent.click(topCard(container).querySelector('[data-card-menu-button]')!);
    fireEvent.click(getByRole('menuitem', { name: 'Delete' }));
    expect(container.querySelector('[data-card-delete-confirm]')!.textContent).toContain(
      'Deletes the post and its 1 block.',
    );
    fireEvent.click(getByText('Delete', { selector: '[data-card-delete-confirm] button' }));
    await waitFor(() => expect(container.querySelector('[data-mark="late"]')).toBeNull());
    expect(container.querySelector('[data-stack-card="late"]')).toBeNull();
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    await waitFor(() => expect(deleted).toEqual(['late']));
  });

  it('opens the post sheet from the compose disc at the nav\u2019s right: white, a blue plus', () => {
    const { container } = ground();
    expect(container.querySelector('[data-drop-bar]')).toBeNull();
    expect(container.querySelector('[data-stack] [data-compose]')).toBeNull();
    const compose = container.querySelector('[data-ground-nav] [data-compose]')!;
    expect(compose.className).toContain('bg-white');
    expect(compose.className).toContain('text-main-900');
    expect(container.querySelector('[data-sheet-open]')).toBeNull();
    fireEvent.click(compose);
    expect(container.querySelector('[data-sheet-open="splash"]')).not.toBeNull();
  });

  it('keeps its height whatever is on top, so the grid never moves', async () => {
    const { container } = ground();
    const stack = container.querySelector<HTMLElement>('[data-stack]')!;
    const height = stack.style.height;
    fireEvent.click(container.querySelector('[data-step-card="soup"]')!);
    await settled(container);
    expect(stack.style.height).toBe(height);
  });

  it('turns pages onto a pile instead when the page-turn board is chosen', async () => {
    const { container } = ground(POSTS, null, null, LANES, null, 'flip');
    expect(container.querySelector('[data-board="flip"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-mark="mid"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    expect(pile(container)).toEqual(['late']);
    await ringed(container, 'mid');
  });
});

describe('the stair under a finger (touch)', () => {
  const touch = { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0 } as const;
  /** A finger on the element, dragged by `dy` in a few frames, and lifted. */
  async function swipe(el: Element, dy: number): Promise<void> {
    fireEvent.pointerDown(el, { ...touch, clientX: 200, clientY: 600 });
    for (let k = 1; k <= 8; k += 1) {
      fireEvent.pointerMove(window, { ...touch, clientX: 200, clientY: 600 + (dy * k) / 8 });
      await new Promise((r) => setTimeout(r, 16));
    }
    fireEvent.pointerUp(window, { ...touch, clientX: 200, clientY: 600 + dy });
  }

  it('flips forward on a tap of the first lower card', async () => {
    const { container } = ground();
    const step = container.querySelector('[data-step-card="mid"]')!;
    fireEvent.pointerDown(step, { ...touch, clientX: 200, clientY: 700 });
    fireEvent.pointerUp(step, { ...touch, clientX: 200, clientY: 700 });
    fireEvent.click(step);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
  });

  it('flips forward on a swipe up and back on a swipe down, and keeps answering after', async () => {
    const { container } = ground();
    await swipe(topCard(container), -160);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    // The second gesture is the one that went dead (review): the stack must
    // have settled, not stayed in flight.
    expect(container.querySelector('[data-moving]')).toBeNull();
    await swipe(topCard(container), 160);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
    await swipe(topCard(container), -160);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    fireEvent.click(container.querySelector('[data-step-card="soup"]')!);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('soup');
  });

  it('springs back on a short swipe, and ignores a drag that starts across the stair', async () => {
    const { container } = ground();
    await swipe(topCard(container), -30);
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
    const el = topCard(container);
    fireEvent.pointerDown(el, { ...touch, clientX: 100, clientY: 600 });
    for (let k = 1; k <= 8; k += 1) {
      fireEvent.pointerMove(window, { ...touch, clientX: 100 + k * 25, clientY: 600 - k * 4 });
      await new Promise((r) => setTimeout(r, 16));
    }
    fireEvent.pointerUp(window, { ...touch, clientX: 300, clientY: 568 });
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
  });
});

describe('the staircase sideways, on a wide screen', () => {
  const wide = (): void => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('min-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }),
    });
  };
  const translateX = (el: Element): number =>
    Number(/translateX\((-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform)?.[1] ?? 0);

  it('runs left to right after a flip forward: the read card left of the top, the stair to its right', async () => {
    wide();
    const { container } = ground();
    expect(container.querySelector('[data-stack]')!.getAttribute('data-axis')).toBe('x');
    fireEvent.click(container.querySelector('[data-step-card="mid"]')!);
    await settled(container);
    const read = container.querySelector('[data-stack-card="late"]')!;
    expect(read.getAttribute('data-stair')).toBe('up');
    expect(translateX(read)).toBeLessThan(0);
    for (const id of stair(container, 'down')) {
      expect(translateX(container.querySelector(`[data-stack-card="${id}"]`)!)).toBeGreaterThan(0);
    }
    expect(translateX(topCard(container))).toBe(0);
  });

  it('writes a peeking title downward on its 44px spine', () => {
    wide();
    const { container } = ground();
    const spine = container.querySelector<HTMLElement>(
      '[data-stack-card="mid"] [data-card-spine]',
    )!;
    const title = spine.querySelector<HTMLElement>('[data-card-title]')!;
    expect(title.style.writingMode).toBe('vertical-rl');
    expect(title.style.textOrientation).toBe('mixed');
    expect(spine.style.width).toBe('44px');
    expect(spine.textContent).toContain('📍');
  });

  it('flips with the arrow keys when the stack has focus', async () => {
    wide();
    const { container } = ground();
    const stack = container.querySelector('[data-stack]')!;
    fireEvent.keyDown(stack, { key: 'ArrowRight' });
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('mid');
    fireEvent.keyDown(stack, { key: 'ArrowLeft' });
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('late');
  });
});

describe('the post just dropped', () => {
  it('is on the grid at once with the ring, and lands on top of the stack', async () => {
    const fresh = post('fresh', 'Just dropped', [block('f', '2026-09-25', 'c-place')]);
    const { container } = ground(POSTS, fresh);
    expect(cellOf(container.querySelector('[data-mark="fresh"]')!).getAttribute('data-cell')).toBe(
      'c-place',
    );
    await settled(container);
    expect(topCard(container).getAttribute('data-stack-card')).toBe('fresh');
    expect(stair(container, 'up')).toEqual([]);
    expect(water(container)).not.toContain('fresh');
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
