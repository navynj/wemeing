'use client';

import { CommitRing } from '@/components/ui/waves';
import type { IsoDate } from '@/lib/time';

import { monthAbbrev, weekdayOf, type Card, type CardLane, type GridColumn } from './grid';

/** The band's height, a branch mark's diameter, and the rhythm branches stack at. */
const BAND_PX = 44;
const BRANCH_PX = 24;
/** A ripple's dot on its branch: a ripple is never an icon or a title — those are a splash's (review). */
const DOT_PX = 8;
const BRANCH_GAP_PX = 6;
const BRANCH_PAD_PX = 8;
const RING_PX = 96;

/**
 * A joint splash on the grid (H23; `_docs/mockups/pool-swimmers.png`): a
 * horizontal band across every column at its day — its icon, its title, a
 * translucent fill at the card's radius — and beneath it, each ripple a
 * small plain dot that branches off the band by an elbow (an icon and a
 * title are a splash's alone, never a ripple's): in Swimmers in its
 * author's column, in the Lane view in the band's own lane, stacked by
 * author. Branch lines are white at 10%, fainter than the 15–20% ropes, so
 * they read as belonging to the band rather than as structure.
 *
 * The band is the joint splash's mark (`data-mark`): the ring plays on it,
 * and a tap on it or on any branch brings its card to the top.
 */
export function JointBand({
  card,
  day,
  label,
  columns,
  orphans,
  plus,
  icon,
  dived,
  ring,
  onPick,
}: {
  card: Card;
  day: IsoDate;
  /** The day's name on the rail, when no plain row above has named it. */
  label: { monthChanges: boolean } | null;
  columns: GridColumn[];
  orphans: boolean;
  plus: boolean;
  icon: string | null;
  dived: boolean;
  ring: number | null;
  onPick: (id: string) => void;
}) {
  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
  const branches = card.branches ?? [];
  const cells = [...columns.map((c) => c.id), ...(orphans ? [''] : [])];
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
        </button>
      </div>

      {branches.length > 0 ? (
        <>
          <div aria-hidden className="bg-main-900 sticky left-0 z-10" />
          {cells.map((column, at) => (
            <BranchCell
              key={column || 'orphans'}
              first={at === 0}
              branches={branches.filter((b) => b.column === column)}
              dived={dived}
              onPick={() => onPick(card.splash.id)}
            />
          ))}
          {plus ? <div /> : null}
        </>
      ) : null}
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
 * A column's branches under a band: one vertical 10% line down the cell's
 * left, and at each mark a horizontal to it — the last turning with an 8px
 * radius, the elbow. The rope is kept at the left edge as everywhere.
 */
function BranchCell({
  first,
  branches,
  dived,
  onPick,
}: {
  first: boolean;
  branches: { id: string; initials: string }[];
  dived: boolean;
  onPick: () => void;
}) {
  const center = (i: number): number =>
    BRANCH_PAD_PX + i * (BRANCH_PX + BRANCH_GAP_PX) + BRANCH_PX / 2;
  const last = branches.length - 1;
  return (
    <div
      data-branch-cell
      className="relative flex flex-col items-center"
      style={{ gap: BRANCH_GAP_PX, paddingTop: BRANCH_PAD_PX, paddingBottom: BRANCH_PAD_PX }}
    >
      {first ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/15"
        />
      )}
      {branches.length > 0 ? (
        <>
          {last > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute left-2 w-px bg-white/10"
              style={{ top: 0, height: center(last) - 8 }}
            />
          ) : null}
          {branches.map((branch, i) =>
            i === last ? (
              <span
                key={`elbow-${branch.id}`}
                aria-hidden
                data-branch-elbow
                className="pointer-events-none absolute left-2 rounded-bl-[8px] border-b border-l border-white/10"
                style={{
                  top: last > 0 ? center(last) - 8 : 0,
                  height: last > 0 ? 8 : center(last),
                  width: `calc(50% - ${DOT_PX / 2 + 8}px)`,
                }}
              />
            ) : (
              <span
                key={`tee-${branch.id}`}
                aria-hidden
                className="pointer-events-none absolute left-2 h-px bg-white/10"
                style={{ top: center(i), width: `calc(50% - ${DOT_PX / 2 + 8}px)` }}
              />
            ),
          )}
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              data-branch={branch.id}
              aria-label={`A ripple by ${branch.initials}`}
              onClick={onPick}
              // A wide tap target around a small dot.
              className="relative flex items-center justify-center"
              style={{ width: BRANCH_PX, height: BRANCH_PX }}
            >
              <span
                aria-hidden
                data-branch-dot
                className={`rounded-full ${dived ? 'bg-white/30' : 'bg-white/90'}`}
                style={{ width: DOT_PX, height: DOT_PX }}
              />
            </button>
          ))}
        </>
      ) : null}
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
              <span className="w-6 shrink-0 text-[10px] font-medium text-white/70">
                {ripple.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-white/80">{ripple.note}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
