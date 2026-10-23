import { monthKey, representativeLane, type SplashSummary } from '@/features/splash/summary';
import { END_OF_DAY } from '@/lib/flow-key';
import type { MyCategory } from '@/lib/queries/profile';
import { wallClockToInstant } from '@/lib/ripple-kind';
import { todayIn, type IsoDate } from '@/lib/time';

/**
 * With this many lanes or fewer, the columns share the width evenly and the
 * group is centred; with more, each column is `FIXED_COLUMN_PX` wide and the
 * columns scroll sideways under the fixed date rail (H22).
 */
export const EVEN_COLUMNS_MAX = 7;
export const FIXED_COLUMN_PX = 56;

/** The grid's one unit: a post as a card on the diving board and a mark on the grid. */
export type Card = {
  splash: SplashSummary;
  /** The day row the mark sits on: the last day of the post's range, else the day it was made (H22). */
  day: IsoDate;
  /** Order within the day: its latest block that day, else the day's end. */
  instant: number;
  /** Every block's words, oldest first, as the card reads them. */
  body: string;
};

/**
 * Where a post sits (H22): on the last day of its display range, else the
 * day it was made — one row, one month, no longer every month its range
 * touches. Within the day it orders by its latest block there, so the grid
 * and the stack read the same key.
 */
export function placeCard(splash: SplashSummary, body: string, timeZone: string): Card {
  const day = splash.range?.end ?? todayIn(timeZone, new Date(splash.createdAt));
  const onDay = splash.blocks.filter((block) => block.day === day);
  const instant =
    onDay.length > 0
      ? onDay[onDay.length - 1].instant
      : splash.range
        ? wallClockToInstant(day, END_OF_DAY, timeZone).getTime()
        : Date.parse(splash.createdAt);
  return { splash, day, instant, body };
}

/** Newest first: the later day, then the later moment, then the later-made post. */
export function byNewest(a: Card, b: Card): number {
  return (
    b.day.localeCompare(a.day) ||
    b.instant - a.instant ||
    b.splash.createdAt.localeCompare(a.splash.createdAt)
  );
}

/** The lane a post's mark sits under: its declared lane, else its representative one. */
export function cardLane(splash: SplashSummary): string | null {
  return splash.declaredLaneId ?? representativeLane(splash);
}

/** True when the post's lane is none of mine: it takes the unlabelled column. */
export function isOrphanCard(card: Card, categories: MyCategory[]): boolean {
  const lane = cardLane(card.splash);
  return lane === null || !categories.some((c) => c.id === lane);
}

/** `2026-10-21`, the day before. */
export function dayBefore(day: IsoDate): IsoDate {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}

/** Every day from `from` down to `to` inclusive, newest first. */
export function daysDown(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = from; day >= to; day = dayBefore(day)) days.push(day);
  return days;
}

/** The first day of the month a day falls in. */
export function monthStart(day: IsoDate): IsoDate {
  return `${monthKey(day)}-01`;
}

/**
 * The grid's top row: today, or a later day a post reaches into. Its floor:
 * the first day of the oldest post's month, or of today's month with nothing
 * written — the grid never asks for a day before anything was written.
 */
export function gridBounds(cards: Card[], today: IsoDate): { top: IsoDate; floor: IsoDate } {
  let top = today;
  let oldest = today;
  for (const card of cards) {
    if (card.day > top) top = card.day;
    if (card.day < oldest) oldest = card.day;
  }
  return { top, floor: monthStart(oldest) };
}

/** `WED`, for a day row. */
export function weekdayOf(day: IsoDate): string {
  return new Date(`${day}T00:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    .toUpperCase();
}

/** `OCT`, for the rail's month label. */
export function monthAbbrev(day: IsoDate): string {
  return new Date(`${day}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    .toUpperCase();
}

/** `Oct 22 (THU)`, as the card heads itself. */
export function cardDate(day: IsoDate): string {
  const at = new Date(`${day}T00:00:00Z`);
  return `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} (${weekdayOf(day)})`;
}

/**
 * `YL` from `Yoonji Lee`: the first letter of the first two words, or the
 * first two letters of a lone word. Grapheme-aware, so a Korean name keeps
 * its syllables whole.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const graphemes = (word: string): string[] =>
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map(
          (s) => s.segment,
        )
      : [...word];
  if (words.length === 0) return '';
  if (words.length === 1) return graphemes(words[0]).slice(0, 2).join('').toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => graphemes(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

/** The newest card of a month, for `?m=`: the ground opens with it on top. */
export function newestIn(cards: Card[], month: string): Card | null {
  return cards.find((card) => monthKey(card.day) === month) ?? null;
}
