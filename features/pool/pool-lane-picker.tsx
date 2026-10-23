'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import type { MyCategory } from '@/lib/queries/profile';

import type { PoolScope } from './compose-scope';

/**
 * The choice when composing from a pool (H23): a pool lane — a joint
 * splash the pool owns — or one of my lanes linked here — my own splash,
 * placed in this pool.
 */
export type PoolPick =
  | { kind: 'joint'; poolLaneId: string }
  | { kind: 'lane'; poolLaneId: string; myCategoryId: string }
  | null;

type Segment = 'pool' | 'mine';

/** My lane for my ripple on a joint splash whose pool lane I have not linked. */
export type JointLane = { myCategoryId: string | null; linkIt: boolean };

// Selection is ink, never blue (H20f): blue stays for actions.
const chip = (selected: boolean): string =>
  `flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left ${
    selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
  }`;

/**
 * Composing from a pool: *Pool lanes* | *My lanes*, Pool lanes first.
 * Pool lanes are this pool's lanes; picking one makes a joint splash on it.
 * My lanes are only those linked to this pool, each naming the pool lane it
 * lands in; picking one makes my splash, placed here. There is no audience
 * here: what is written in a pool is in that pool.
 */
export function PoolLanePicker({
  scope,
  categories,
  pick,
  onPick,
  jointLane,
  onJointLane,
}: {
  scope: PoolScope;
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
  pick: PoolPick;
  onPick: (pick: PoolPick) => void;
  jointLane: JointLane;
  onJointLane: (lane: JointLane) => void;
}) {
  const { closeSheet } = useInputSheet();
  const [segment, setSegment] = useState<Segment>('pool');
  const linked = scope.lanes.filter((lane) => lane.myCategoryId);
  const chosenPoolLane =
    pick?.kind === 'joint' ? scope.lanes.find((l) => l.id === pick.poolLaneId) : undefined;

  return (
    <div data-pool-lane-picker className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Lanes"
        data-lane-segment
        className="bg-pool-100 flex self-start rounded-full p-0.5 text-sm font-medium"
      >
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
            className={`rounded-full px-4 py-1.5 ${
              segment === value ? 'bg-ink text-white' : 'text-pool-500'
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
              const selected = pick?.kind === 'joint' && pick.poolLaneId === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  aria-pressed={selected}
                  data-pick-pool-lane={lane.id}
                  onClick={() => onPick(selected ? null : { kind: 'joint', poolLaneId: lane.id })}
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
          {chosenPoolLane && !chosenPoolLane.myCategoryId ? (
            // A ripple is always filed under one of my lanes (ripples.category_id).
            <div
              data-joint-unlinked
              className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
            >
              <span className="text-pool-500">Not linked to your lanes</span>
              <select
                value={jointLane.myCategoryId ?? ''}
                aria-label="Your lane for this ripple"
                data-joint-my-lane
                onChange={(event) =>
                  onJointLane({ ...jointLane, myCategoryId: event.target.value || null })
                }
                className="border-pool-200 text-ink h-8 rounded-lg border bg-white px-2 text-sm"
              >
                <option value="">Pick your lane</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="text-ink flex items-center gap-1.5">
                <input
                  type="checkbox"
                  data-link-it
                  checked={jointLane.linkIt}
                  onChange={(event) => onJointLane({ ...jointLane, linkIt: event.target.checked })}
                  className="accent-ink"
                />
                Link it
              </label>
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
            className="border-pool-200 text-pool-500 flex h-auto shrink-0 items-center rounded-2xl border border-dashed px-3.5 text-sm"
          >
            + Link a lane
          </Link>
        </div>
      )}
    </div>
  );
}
