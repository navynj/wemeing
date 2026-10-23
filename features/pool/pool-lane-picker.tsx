'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import type { MyCategory } from '@/lib/queries/profile';

import type { PoolScope } from './compose-scope';

/**
 * The choice when composing from a pool (H23): a pool lane — a joint
 * splash the pool owns, or "Just mine" on it — or one of my lanes linked
 * here — my own splash, placed in this pool.
 */
export type PoolPick =
  | { kind: 'joint'; poolLaneId: string }
  /** "Just mine" (0014): my splash on that pool lane, linked to no lane of mine. */
  | { kind: 'own'; poolLaneId: string }
  | { kind: 'lane'; poolLaneId: string; myCategoryId: string }
  | null;

type Segment = 'pool' | 'mine';

/** A lane chip: the one filled element here — ink when chosen (H20f), outlined otherwise. */
const chip = (selected: boolean): string =>
  `flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left ${
    selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
  }`;

/**
 * Composing from a pool (review): the lane is the one decision, and the two
 * toggles qualify it. *Pool lanes | My lanes* are text tabs above the chips
 * — the chosen one in ink with a 2px underline, the other muted, at a
 * section label's size. The lane chips are the only filled element. Under
 * Pool lanes, once a lane is chosen, *Everyone's | Just mine* is a small
 * text toggle beneath the chips, the chosen option in ink and weight. My
 * ripple on a joint splash takes the lane I linked to that pool lane, or
 * none (0016) — nothing to ask. There is no audience here: what is written
 * in a pool is in that pool.
 */
export function PoolLanePicker({
  scope,
  categories,
  pick,
  onPick,
}: {
  scope: PoolScope;
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
  pick: PoolPick;
  onPick: (pick: PoolPick) => void;
}) {
  const { closeSheet } = useInputSheet();
  const [segment, setSegment] = useState<Segment>('pool');
  const linked = scope.lanes.filter((lane) => lane.myCategoryId);
  const onPoolLane = pick?.kind === 'joint' || pick?.kind === 'own';

  return (
    <div data-pool-lane-picker className="flex flex-col gap-3">
      <div role="tablist" aria-label="Lanes" data-lane-segment className="flex gap-5 text-xs">
        {(
          [
            ['pool', 'Pool lanes'],
            ['mine', 'My lanes'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={segment === value}
            data-segment={value}
            onClick={() => {
              if (segment === value) return;
              setSegment(value);
              onPick(null);
            }}
            className={`border-b-2 pb-1 ${
              segment === value
                ? 'border-ink text-ink font-semibold'
                : 'text-pool-500 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {segment === 'pool' ? (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {scope.lanes.map((lane) => {
              const selected = onPoolLane && pick.poolLaneId === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  aria-pressed={selected}
                  data-pick-pool-lane={lane.id}
                  onClick={() =>
                    // Another lane keeps Everyone's or Just mine as it was.
                    onPick(
                      selected
                        ? null
                        : { kind: pick?.kind === 'own' ? 'own' : 'joint', poolLaneId: lane.id },
                    )
                  }
                  className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                    selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
                  }`}
                >
                  {lane.icon ? `${lane.icon} ` : ''}
                  {lane.name}
                </button>
              );
            })}
          </div>
          {onPoolLane ? (
            // Whose splash it is: the pool's, or mine alone on that lane (0014).
            <div role="tablist" aria-label="Whose" data-whose className="flex gap-4 text-xs">
              {(
                [
                  ['joint', "Everyone's"],
                  ['own', 'Just mine'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={pick.kind === kind}
                  data-whose-option={kind}
                  onClick={() => onPick({ kind, poolLaneId: pick.poolLaneId })}
                  className={pick.kind === kind ? 'text-ink font-semibold' : 'text-pool-500'}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {linked.map((lane) => {
            const mine = categories.find((c) => c.id === lane.myCategoryId);
            const selected = pick?.kind === 'lane' && pick.poolLaneId === lane.id;
            return (
              <button
                key={lane.id}
                type="button"
                aria-pressed={selected}
                data-pick-my-lane={lane.myCategoryId!}
                onClick={() =>
                  onPick(
                    selected
                      ? null
                      : { kind: 'lane', poolLaneId: lane.id, myCategoryId: lane.myCategoryId! },
                  )
                }
                className={chip(selected)}
              >
                <span className="text-sm font-semibold">
                  {mine?.icon ? `${mine.icon} ` : ''}
                  {mine?.name ?? 'Lane'}
                </span>
                <span className={`text-[10px] ${selected ? 'text-white/70' : 'text-pool-500'}`}>
                  → {lane.name}
                </span>
              </button>
            );
          })}
          <Link
            href={`/pool/${scope.poolId}/settings`}
            onClick={closeSheet}
            data-link-a-lane
            className="border-pool-200 text-pool-500 flex shrink-0 items-center rounded-2xl border border-dashed px-3.5 text-sm"
          >
            + Link a lane
          </Link>
        </div>
      )}
    </div>
  );
}
