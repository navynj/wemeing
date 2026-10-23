import { describe, expect, it } from 'vitest';

import {
  formatPillDate,
  ghostTitle,
  laneTags,
  lastDayOf,
  monthsBetween,
  monthsOf,
  positionInMonth,
  summarizeAll,
  summarizeOrphan,
  summarizeSplash,
  type Splash,
  type SplashBlock,
} from '@/features/splash/summary';
import { dayOf, flowInstant } from '@/lib/flow-key';

const TZ = 'America/Vancouver';
const NOW = new Date('2026-09-25T20:00:00.000Z');

function block(over: Partial<SplashBlock> & { id: string }): SplashBlock {
  return {
    category_id: 'c-day',
    note: 'fixture words',
    occurred_on: null,
    occurred_time: null,
    created_at: '2026-09-20T16:00:00.000Z',
    ...over,
  };
}

function splash(over: Partial<Splash> = {}): Splash {
  return {
    id: 's1',
    owner_id: 'a1',
    title: 'Whistler',
    declared_start: null,
    declared_end: null,
    declared_lane_id: null,
    session_id: null,
    icon: null,
    pinned_at: null,
    pool_id: null,
    pool_lane_id: null,
    created_by: null,
    type: 'free',
    prompt: null,
    ends_at: null,
    created_at: '2026-09-01T16:00:00.000Z',
    ...over,
  };
}

describe('a declaration is a default, never an override (H21f)', () => {
  it('rests an unannotated block at the declared date, and lets an annotation win', () => {
    const resting = { ...block({ id: 'r' }), splash: { declared_start: '2026-08-17' } };
    const placed = { ...resting, occurred_on: '2026-09-02' };
    const plain = block({ id: 'p' });

    expect(dayOf(resting, TZ)).toBe('2026-08-17');
    expect(dayOf(placed, TZ)).toBe('2026-09-02');
    expect(dayOf(plain, TZ)).toBe('2026-09-20');
    // A resting block sits at the declared day's end, like a date-only one.
    expect(flowInstant(resting, TZ)).toBe(Date.parse('2026-08-18T06:59:59.999Z'));
  });

  it('summarises its blocks against its own declared date before any join exists', () => {
    const summary = summarizeSplash(
      splash({ declared_start: '2026-08-17', declared_end: '2026-08-20' }),
      [block({ id: 'a' })],
      TZ,
      NOW,
    );
    expect(summary.blocks[0].day).toBe('2026-08-17');
  });

  it('turns a declared lane into tags when a block takes another: declared first', () => {
    const blocks = [
      block({ id: 'a', category_id: 'c-media', created_at: '2026-09-21T16:00:00Z' }),
      block({ id: 'b', category_id: 'c-media', created_at: '2026-09-22T16:00:00Z' }),
      block({ id: 'c', category_id: 'c-day', created_at: '2026-09-23T16:00:00Z' }),
    ];
    expect(laneTags('c-day', blocks)).toEqual(['c-day', 'c-media']);
    expect(laneTags(null, blocks)).toEqual(['c-media', 'c-day']);
    expect(laneTags('c-place', [])).toEqual(['c-place']);
    expect(summarizeSplash(splash({ declared_lane_id: 'c-day' }), blocks, TZ, NOW).laneIds).toEqual(
      ['c-day', 'c-media'],
    );
  });
});

describe('a post’s range and months (H21e)', () => {
  it('unions the declared range with what the blocks say', () => {
    const summary = summarizeSplash(
      splash({ declared_start: '2026-08-17', declared_end: '2026-08-20' }),
      [block({ id: 'late', occurred_on: '2026-09-02' })],
      TZ,
      NOW,
    );
    expect(summary.declaredRange).toEqual({ start: '2026-08-17', end: '2026-08-20' });
    expect(summary.range).toEqual({ start: '2026-08-17', end: '2026-09-02' });
    expect(monthsOf(summary, TZ)).toEqual(['2026-08', '2026-09']);
  });

  it('appears in every month it touches, positioned by its latest block in each', () => {
    const summary = summarizeSplash(
      splash(),
      [
        block({ id: 'aug1', occurred_on: '2026-08-28' }),
        block({ id: 'aug2', occurred_on: '2026-08-30' }),
        block({ id: 'sep', occurred_on: '2026-09-03' }),
      ],
      TZ,
      NOW,
    );
    expect(monthsOf(summary, TZ)).toEqual(['2026-08', '2026-09']);
    expect(positionInMonth(summary, '2026-08', TZ).date).toBe('2026-08-30');
    expect(positionInMonth(summary, '2026-09', TZ).date).toBe('2026-09-03');
  });

  it('sits at the clipped end of its range in a month it declares but has no block in', () => {
    const summary = summarizeSplash(
      splash({ declared_start: '2026-08-28', declared_end: '2026-09-03' }),
      [block({ id: 'a', occurred_on: '2026-08-29' })],
      TZ,
      NOW,
    );
    expect(positionInMonth(summary, '2026-09', TZ).date).toBe('2026-09-03');
    expect(positionInMonth(summary, '2026-08', TZ).date).toBe('2026-08-29');
  });

  it('counts a span’s last day into the range, and reads the period on the pill', () => {
    // A span by dates alone, Sep 12 to 14: the end is the close of Sep 14.
    const span = block({
      id: 'trip',
      occurred_on: '2026-09-12',
      ended_at: '2026-09-15T06:59:59.999Z',
      created_at: '2026-09-12T16:00:00.000Z',
    });
    const summary = summarizeSplash(splash(), [span], TZ, NOW);
    expect(summary.range).toEqual({ start: '2026-09-12', end: '2026-09-14' });
    expect(summary.blocks[0].endDay).toBe('2026-09-14');
    const at = positionInMonth(summary, '2026-09', TZ);
    expect(at.date).toBe('2026-09-12');
    expect(at.span).toEqual({ start: '2026-09-12', end: '2026-09-14' });
    expect(formatPillDate(at.span)).toBe('Sep 12–14');
    // A point block reads one date.
    const point = summarizeSplash(
      splash(),
      [block({ id: 'p', occurred_on: '2026-09-03' })],
      TZ,
      NOW,
    );
    expect(positionInMonth(point, '2026-09', TZ).span).toEqual({
      start: '2026-09-03',
      end: '2026-09-03',
    });
  });

  it('sits where it was made while it has nothing and declares nothing', () => {
    const summary = summarizeSplash(splash({ created_at: '2026-09-23T16:00:00Z' }), [], TZ, NOW);
    expect(summary.range).toBeNull();
    expect(monthsOf(summary, TZ)).toEqual(['2026-09']);
    expect(positionInMonth(summary, '2026-09', TZ).date).toBe('2026-09-23');
  });

  it('walks months inclusively, across a year', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(lastDayOf('2026-02')).toBe('2026-02-28');
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
  });
});

describe('an untitled post (H21a)', () => {
  it('shows its first block’s first words as a ghost title', () => {
    expect(ghostTitle('coffee went cold while I read the whole thing')).toBe(
      'coffee went cold while I read…',
    );
    expect(ghostTitle('short')).toBe('short');
    expect(ghostTitle(null)).toBeNull();
    const summary = summarizeSplash(
      splash({ title: '' }),
      [
        block({ id: 'later', note: 'later words', created_at: '2026-09-22T16:00:00Z' }),
        block({ id: 'first', note: 'first words here', created_at: '2026-09-21T16:00:00Z' }),
      ],
      TZ,
      NOW,
    );
    expect(summary.ghostTitle).toBe('first words here');
    expect(summarizeSplash(splash(), [block({ id: 'a' })], TZ, NOW).ghostTitle).toBeNull();
  });

  it('is what a splashless block becomes, with the block’s own id and lane', () => {
    const lone = summarizeOrphan(block({ id: 'r-lone', category_id: 'c-place' }), TZ, NOW);
    expect(lone).toMatchObject({
      id: 'r-lone',
      orphan: true,
      title: '',
      laneIds: ['c-place'],
      count: 1,
      range: { start: '2026-09-20', end: '2026-09-20' },
    });
  });

  it('is summarised alongside the posts, recent first', () => {
    const all = summarizeAll(
      [splash()],
      [
        { ...block({ id: 'member', created_at: '2026-09-10T16:00:00Z' }), splash_id: 's1' },
        { ...block({ id: 'lone', created_at: '2026-09-24T16:00:00Z' }), splash_id: null },
      ],
      TZ,
      NOW,
    );
    expect(all.map((s) => s.id)).toEqual(['lone', 's1']);
  });
});

describe('a pill’s date', () => {
  it('reads a day, a run within a month, or a span across months', () => {
    expect(formatPillDate({ start: '2026-09-12', end: '2026-09-12' })).toBe('Sep 12');
    expect(formatPillDate({ start: '2026-08-17', end: '2026-08-20' })).toBe('Aug 17–20');
    expect(formatPillDate({ start: '2026-08-28', end: '2026-09-03' })).toBe('Aug 28 – Sep 3');
  });
});
