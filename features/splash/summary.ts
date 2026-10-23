import type { Database } from '@/lib/database.types';
import { dayOf, flowInstant, restingInstant, type FlowKeyed } from '@/lib/flow-key';
import { todayIn, type IsoDate } from '@/lib/time';

export type Splash = Database['public']['Tables']['splashes']['Row'];

/**
 * How long after its last block a post stays open (H20e). Tunable. Since
 * H21g this decides the `+Drop` affordance on an entry and nothing else.
 */
export const OPEN_WINDOW_HOURS = 48;

/** How many words of a first block stand in for a missing title. */
const GHOST_TITLE_WORDS = 6;

/** What a block contributes to its post: its key, its lane, its words. */
export type SplashBlock = FlowKeyed & {
  id: string;
  /** Null only on a "Just mine" splash (0014): a block with no lane of mine. */
  category_id: string | null;
  note: string | null;
  /** A span's end, when the block has one: its last day counts for the range. */
  ended_at?: string | null;
};

export type DateRange = { start: IsoDate; end: IsoDate };

/**
 * A post as the surfaces read it (H21a): declared where declared, derived
 * from its blocks where not, its lane tags accumulated, its range the union
 * of what it declares and what its blocks say.
 */
export type SplashSummary = {
  id: string;
  title: string;
  /** For an untitled post: the first block's first words, else null. */
  ghostTitle: string | null;
  /** The default lane of a new block (H21f), or none. */
  declaredLaneId: string | null;
  /** The post's own icon (0008), or none: its lane's emoji stands in. */
  icon: string | null;
  /** Derived tags: the declared lane first, then every lane the blocks took, by frequency. */
  laneIds: string[];
  declaredRange: DateRange | null;
  /** Display range: declared ∪ block-derived. Null for an empty, undeclared post. */
  range: DateRange | null;
  count: number;
  /** Each block's resting day, the last day of its span, and its instant, oldest first. */
  blocks: { day: IsoDate; endDay: IsoDate; instant: number }[];
  /** When the post last received something, for recency and the open rule. */
  latestCreatedAt: string;
  /** The author's local date when the post was made (0013): its row with no range. */
  writtenOn: IsoDate;
  /** A "Just mine" splash (0014): the pool it lives in, with no lane of mine. */
  ownPoolId: string | null;
  open: boolean;
  createdAt: string;
  pinnedAt: string | null;
  sessionId: string | null;
  /** True for a splashless block standing in as a post of one (H21a). */
  orphan: boolean;
};

/** A block within the window, or nothing written yet (H20e). */
export function isSplashOpen(count: number, latestCreatedAt: string | null, now: Date): boolean {
  if (count === 0 || latestCreatedAt === null) return true;
  return now.getTime() - Date.parse(latestCreatedAt) < OPEN_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * The lanes a post's blocks took, most frequent first; a tie goes to the most
 * recently written, because that is the one the author was just thinking
 * about.
 */
export function lanesByFrequency(
  blocks: Pick<SplashBlock, 'category_id' | 'created_at'>[],
): string[] {
  const tally = new Map<string, { count: number; latest: number }>();
  for (const block of blocks) {
    // A block with no lane of mine (Just mine, 0014) takes no tag.
    if (block.category_id === null) continue;
    const at = Date.parse(block.created_at);
    const current = tally.get(block.category_id) ?? { count: 0, latest: 0 };
    tally.set(block.category_id, {
      count: current.count + 1,
      latest: Math.max(current.latest, at),
    });
  }
  return [...tally.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.latest - a.latest)
    .map(([id]) => id);
}

/**
 * The tags a post carries (H21f): the declared lane first and representative,
 * then every other lane its blocks took. Accumulation, never rejection.
 */
export function laneTags(
  declaredLaneId: string | null,
  blocks: Pick<SplashBlock, 'category_id' | 'created_at'>[],
): string[] {
  const taken = lanesByFrequency(blocks).filter((id) => id !== declaredLaneId);
  return declaredLaneId ? [declaredLaneId, ...taken] : taken;
}

/** The first few words of a note, for a post with no title. */
export function ghostTitle(note: string | null): string | null {
  const words = (note ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const head = words.slice(0, GHOST_TITLE_WORDS).join(' ');
  return words.length > GHOST_TITLE_WORDS ? `${head}…` : head;
}

/**
 * The last day a block covers: its span's end in the author's zone, else the
 * day it rests on. A span by dates alone ends at the close of its end day, so
 * that day is the one read back.
 */
function spanEndDay(block: SplashBlock, day: IsoDate, timeZone: string): IsoDate {
  if (!block.ended_at || !block.occurred_on) return day;
  const end = todayIn(timeZone, new Date(block.ended_at));
  return end > day ? end : day;
}

function union(a: DateRange | null, b: DateRange | null): DateRange | null {
  if (!a) return b;
  if (!b) return a;
  return { start: a.start < b.start ? a.start : b.start, end: a.end > b.end ? a.end : b.end };
}

export function summarizeSplash(
  splash: Splash,
  blocks: SplashBlock[],
  timeZone: string,
  now: Date,
): SplashSummary {
  // The blocks read the post's declared date through the join the queries
  // make; summarised here from the row itself so a post just created, with
  // no join yet, summarises the same way.
  const keyed = blocks.map((block) => ({
    ...block,
    splash: block.splash ?? { declared_start: splash.declared_start },
  }));
  const placed = keyed
    .map((block) => {
      const day = dayOf(block, timeZone);
      return {
        day,
        endDay: spanEndDay(block, day, timeZone),
        instant: flowInstant(block, timeZone),
        createdAt: block.created_at,
        note: block.note,
      };
    })
    // The day first: an in-day instant means nothing across days (0013).
    .sort(
      (a, b) =>
        (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) ||
        a.instant - b.instant ||
        a.createdAt.localeCompare(b.createdAt),
    );

  const declaredRange = splash.declared_start
    ? { start: splash.declared_start, end: splash.declared_end ?? splash.declared_start }
    : null;
  const derived =
    placed.length > 0
      ? {
          start: placed[0].day,
          end: placed.reduce((latest, b) => (b.endDay > latest ? b.endDay : latest), placed[0].day),
        }
      : null;

  const latestCreatedAt = blocks.reduce<string | null>(
    (latest, b) => (latest === null || b.created_at > latest ? b.created_at : latest),
    null,
  );

  return {
    id: splash.id,
    title: splash.title,
    ghostTitle: splash.title.trim() ? null : ghostTitle(placed[0]?.note ?? null),
    declaredLaneId: splash.declared_lane_id,
    icon: splash.icon ?? null,
    laneIds: laneTags(splash.declared_lane_id, blocks),
    declaredRange,
    range: union(declaredRange, derived),
    count: blocks.length,
    blocks: placed.map(({ day, endDay, instant }) => ({ day, endDay, instant })),
    latestCreatedAt: latestCreatedAt ?? splash.created_at,
    writtenOn: splash.written_on ?? todayIn(timeZone, new Date(splash.created_at)),
    ownPoolId: splash.own_pool_id ?? null,
    open: isSplashOpen(blocks.length, latestCreatedAt, now),
    createdAt: splash.created_at,
    pinnedAt: splash.pinned_at,
    sessionId: splash.session_id,
    orphan: false,
  };
}

/**
 * A block with no post renders as an untitled post of one (H21a). It has no
 * row of its own until it needs one; its id is the block's.
 */
export function summarizeOrphan(block: SplashBlock, timeZone: string, now: Date): SplashSummary {
  const day = dayOf(block, timeZone);
  return {
    id: block.id,
    title: '',
    ghostTitle: ghostTitle(block.note),
    declaredLaneId: null,
    icon: null,
    laneIds: block.category_id ? [block.category_id] : [],
    declaredRange: null,
    range: { start: day, end: day },
    count: 1,
    blocks: [
      { day, endDay: spanEndDay(block, day, timeZone), instant: flowInstant(block, timeZone) },
    ],
    latestCreatedAt: block.created_at,
    writtenOn: day,
    ownPoolId: null,
    open: isSplashOpen(1, block.created_at, now),
    createdAt: block.created_at,
    pinnedAt: null,
    sessionId: null,
    orphan: true,
  };
}

/**
 * Every post summarised against the blocks it holds, plus every splashless
 * block as a post of one, recent first. A block whose post is not among
 * `splashes` — a joint splash of a pool I have left, say (H23) — is never
 * dropped: it reads as a post of one, so nothing I wrote vanishes from my
 * own surfaces.
 */
export function summarizeAll(
  splashes: Splash[],
  blocks: (SplashBlock & { splash_id: string | null })[],
  timeZone: string,
  now: Date,
): SplashSummary[] {
  const byPost = new Map<string, SplashBlock[]>();
  const orphans: SplashBlock[] = [];
  const known = new Set(splashes.map((splash) => splash.id));
  for (const block of blocks) {
    if (block.splash_id === null || !known.has(block.splash_id)) {
      orphans.push(block);
      continue;
    }
    const list = byPost.get(block.splash_id);
    if (list) list.push(block);
    else byPost.set(block.splash_id, [block]);
  }
  return [
    ...splashes.map((splash) =>
      summarizeSplash(splash, byPost.get(splash.id) ?? [], timeZone, now),
    ),
    ...orphans.map((block) => summarizeOrphan(block, timeZone, now)),
  ].sort(byRecency);
}

/** Recent first: the post something was just written on is the likely target. */
export function byRecency(a: SplashSummary, b: SplashSummary): number {
  return Date.parse(b.latestCreatedAt) - Date.parse(a.latestCreatedAt);
}

/** The lane that stands for the post: the declared one, else the one its blocks took most. */
export function representativeLane(summary: Pick<SplashSummary, 'laneIds'>): string | null {
  return summary.laneIds[0] ?? null;
}

/** `2026-08`, the month a date falls in. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

/** The last day of `2026-08`, as a date. */
export function lastDayOf(month: string): IsoDate {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0));
  return last.toISOString().slice(0, 10);
}

/** Every month from `a` to `b` inclusive, ascending. */
export function monthsBetween(a: string, b: string): string[] {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  const months: string[] = [];
  for (let n = ay * 12 + am; n <= by * 12 + bm; n += 1) {
    const year = Math.floor((n - 1) / 12);
    const month = ((n - 1) % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

/**
 * The months a post appears in (H21e): every month its display range
 * touches, or the month it was made in while it has nothing and declares
 * nothing.
 */
export function monthsOf(summary: SplashSummary): string[] {
  if (summary.range)
    return monthsBetween(monthKey(summary.range.start), monthKey(summary.range.end));
  return [monthKey(summary.writtenOn)];
}

/**
 * Where a post sits within a month (H21e): at its latest block in that month;
 * with no block there, at the end of its range clipped to the month; with no
 * range at all, where it was made. `span` is what the pill reads: that
 * block's own period when it spans days (review), clipped to the month, else
 * the one date.
 */
export function positionInMonth(
  summary: SplashSummary,
  month: string,
): { instant: number; date: IsoDate; span: DateRange } {
  const last = lastDayOf(month);
  const inMonth = summary.blocks.filter((block) => monthKey(block.day) === month);
  if (inMonth.length > 0) {
    const latest = inMonth[inMonth.length - 1];
    return {
      instant: latest.instant,
      date: latest.day,
      span: { start: latest.day, end: latest.endDay < last ? latest.endDay : last },
    };
  }
  if (summary.range) {
    const date = summary.range.end < last ? summary.range.end : last;
    return {
      instant: restingInstant(date),
      date,
      span: { start: date, end: date },
    };
  }
  const made = summary.writtenOn;
  return { instant: Date.parse(summary.createdAt), date: made, span: { start: made, end: made } };
}

/** `2026. 8. 17 ~ 2026. 8. 20`, or one date, as the mockups write it. */
export function formatRange(range: DateRange | null): string {
  if (!range) return '';
  const day = (date: IsoDate): string =>
    `${date.slice(0, 4)}. ${Number(date.slice(5, 7))}. ${Number(date.slice(8, 10))}`;
  return range.start === range.end ? day(range.start) : `${day(range.start)} ~ ${day(range.end)}`;
}

/** `Sep 12`, or `Sep 12–14` within one month, for a pill. */
export function formatPillDate(range: DateRange): string {
  const month = (date: IsoDate): string =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = (date: IsoDate): number => Number(date.slice(8, 10));
  if (range.start === range.end) return `${month(range.start)} ${day(range.start)}`;
  if (monthKey(range.start) === monthKey(range.end)) {
    return `${month(range.start)} ${day(range.start)}–${day(range.end)}`;
  }
  return `${month(range.start)} ${day(range.start)} – ${month(range.end)} ${day(range.end)}`;
}
