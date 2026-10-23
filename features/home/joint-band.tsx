'use client';

import { CommitRing } from '@/components/ui/waves';
import type { IsoDate } from '@/lib/time';
import { Avatar, PersonName } from '@/features/people/avatar';

import { monthAbbrev, weekdayOf, type Card, type CardLane } from './grid';

/** The band's height, a member's face on it, and how many faces before "+n". */
const BAND_PX = 44;
const FACE_PX = 26;
const MAX_FACES = 4;
const RING_PX = 96;

/**
 * A joint splash on the grid (H23; `_docs/mockups/pool-swimmers.png`): a
 * horizontal band across every column at its day — its icon, its title, a
 * translucent fill at the card's radius — and at its right end how many
 * ripples it holds and who wrote them, four faces then "+n" (review: no
 * branches; a ripple is never drawn on the grid, only counted).
 *
 * The band is the joint splash's mark (`data-mark`): the ring plays on it,
 * and a tap brings its card to the top.
 */
export function JointBand({
  card,
  day,
  label,
  icon,
  dived,
  ring,
  onPick,
}: {
  card: Card;
  day: IsoDate;
  /** The day's name on the rail, when no plain row above has named it. */
  label: { monthChanges: boolean } | null;
  icon: string | null;
  dived: boolean;
  ring: number | null;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const branches = card.branches ?? [];
  // Each writer once, in the order they first wrote.
  const writers = [
    ...new Map(branches.map((b) => [b.authorId ?? b.initials, b] as const)).values(),
  ];
  const more = writers.length - MAX_FACES;
  return (
    <>
      <Rail day={day} label={label} />
      <div
        data-joint-row={card.splash.id}
        className="relative flex items-center py-1.5 pr-3"
        style={{ gridColumn: '2 / -1' }}
      >
        <button
          type="button"
          data-mark={card.splash.id}
          data-joint-band={card.splash.id}
          data-dived={dived ? '' : undefined}
          data-ring={ring !== null ? '' : undefined}
          aria-label={title}
          onClick={() => onPick(card.splash.id)}
          className={`flex w-full min-w-0 items-center gap-2.5 rounded-[28px] bg-white/20 pr-4 pl-1.5 text-left text-white ${
            dived ? 'opacity-70' : ''
          }`}
          style={{ height: BAND_PX }}
        >
          <span className="relative flex shrink-0 items-center justify-center">
            {ring !== null ? (
              <span
                key={ring}
                aria-hidden
                data-commit-ripple
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
              >
                <span className="flex shrink-0">
                  <CommitRing size={RING_PX} contentSize={32} gap={6} once />
                </span>
              </span>
            ) : null}
            <span
              aria-hidden
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/30 text-base/none"
            >
              {icon}
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
          <span
            data-joint-count
            className="shrink-0 text-xs font-medium text-white/70 tabular-nums"
          >
            {branches.length === 1 ? '1 ripple' : `${branches.length} ripples`}
          </span>
          {writers.length > 0 ? (
            <span data-joint-faces className="flex shrink-0 items-center">
              {writers.slice(0, MAX_FACES).map((writer, at) => (
                <Avatar
                  key={writer.authorId ?? writer.initials}
                  id={writer.authorId}
                  initials={writer.initials}
                  // Solid, so a face never shows the one beneath it (review).
                  className={`text-main-900/60 ring-main-900 flex items-center justify-center rounded-full bg-[#8283EE] text-[10px] font-medium ring-2 ${
                    at > 0 ? '-ml-1' : ''
                  }`}
                  style={{ width: FACE_PX, height: FACE_PX }}
                />
              ))}
              {more > 0 ? (
                <span data-joint-more className="ml-1 text-[10px] font-medium text-white/70">
                  +{more}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}

/** The rail beside a band: the day's name when nothing above named it, else blank. */
function Rail({ day, label }: { day: IsoDate; label: { monthChanges: boolean } | null }) {
  if (!label) return <div aria-hidden className="bg-main-900 sticky left-0 z-10" />;
  return (
    <div
      data-day-row={day}
      data-labelled=""
      className="bg-main-900 sticky left-0 z-10 flex flex-col justify-center gap-0.5 py-2 pr-2 pl-6 text-white/70"
    >
      {label.monthChanges ? (
        <span data-month-label className="text-[10px]/none font-medium text-white/50">
          {day.slice(0, 4)}
          <br />
          {monthAbbrev(day)}
        </span>
      ) : null}
      <span className="text-sm/none font-medium tabular-nums">{Number(day.slice(8, 10))}</span>
      <span className="text-[10px]/none font-medium text-white/50">{weekdayOf(day)}</span>
    </div>
  );
}

/**
 * A joint splash in the Date view: the band is a row, its ripples indented
 * sub-rows hung from it by the same 10% line, each with its author.
 */
export function JointRows({
  card,
  lane,
  current,
  ring,
  onPick,
}: {
  card: Card;
  lane: CardLane | null;
  current: boolean;
  ring: number | null;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const icon = card.splash.icon ?? lane?.icon ?? null;
  return (
    <div
      data-joint-rows={card.splash.id}
      className={`flex flex-col ${current ? '' : 'opacity-60'}`}
    >
      <button
        type="button"
        data-pill={card.splash.id}
        data-joint-band={card.splash.id}
        data-ring={ring !== null ? '' : undefined}
        onClick={() => onPick(card.splash.id)}
        className="flex w-full min-w-0 items-center gap-3 rounded-[28px] bg-white/20 py-1.5 pr-4 pl-1.5 text-left text-white"
      >
        <span className="relative flex shrink-0 items-center justify-center">
          {ring !== null ? (
            <span
              key={ring}
              aria-hidden
              data-commit-ripple
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
            >
              <span className="flex shrink-0">
                <CommitRing size={RING_PX} contentSize={28} gap={6} once />
              </span>
            </span>
          ) : null}
          <span
            aria-hidden
            className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/30 text-sm/none"
          >
            {icon}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
      </button>
      <ol className="relative ml-5 border-l border-white/10 pb-1">
        {card.ripples.map((ripple) => (
          <li key={ripple.id}>
            <button
              type="button"
              data-joint-sub={ripple.id}
              onClick={() => onPick(card.splash.id)}
              className="flex w-full min-w-0 items-center gap-2 py-2 pl-3 text-left text-white"
            >
              <span className="w-16 shrink-0 truncate text-[10px] font-medium text-white/70">
                <PersonName
                  id={ripple.authorId}
                  name={ripple.authorName ?? ripple.initials ?? ''}
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-white/80">{ripple.note}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
