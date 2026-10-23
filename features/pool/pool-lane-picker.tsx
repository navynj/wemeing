'use client';

import type { MyCategory } from '@/lib/queries/profile';

import type { PoolScope } from './compose-scope';

/** The picker's choice: one of my linked pool lanes, or a joint splash on a pool lane. */
export type PoolPick =
  | { kind: 'lane'; poolLaneId: string; myCategoryId: string }
  | { kind: 'joint'; poolLaneId: string | null }
  | null;

const chip = (selected: boolean): string =>
  `flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left ${
    // Selection is ink (H20f).
    selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
  }`;

/**
 * Composing from a pool (H23): the pool lanes I have linked, each with my
 * lane's name under it — writing there makes my post in my lane, placed
 * here — and *Joint splash*, a splash the pool owns, on whichever pool lane
 * is chosen next.
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
  const linked = scope.lanes.filter((lane) => lane.myCategoryId);
  return (
    <div data-pool-lane-picker className="flex flex-col gap-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {linked.map((lane) => {
          const selected = pick?.kind === 'lane' && pick.poolLaneId === lane.id;
          const mine = categories.find((c) => c.id === lane.myCategoryId);
          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={selected}
              data-pick-pool-lane={lane.id}
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
                {lane.icon ? `${lane.icon} ` : ''}
                {lane.name}
              </span>
              <span className={`text-[10px] ${selected ? 'text-white/70' : 'text-pool-500'}`}>
                your {mine?.name ?? 'lane'}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={pick?.kind === 'joint'}
          data-pick-joint
          onClick={() =>
            onPick(pick?.kind === 'joint' ? null : { kind: 'joint', poolLaneId: null })
          }
          className={chip(pick?.kind === 'joint')}
        >
          <span className="text-sm font-semibold">Joint splash</span>
          <span
            className={`text-[10px] ${pick?.kind === 'joint' ? 'text-white/70' : 'text-pool-500'}`}
          >
            owned by {scope.poolName}
          </span>
        </button>
      </div>
      {pick?.kind === 'joint' ? (
        <div className="flex flex-col gap-2">
          <span className="text-pool-500 text-xs">On which lane?</span>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {scope.lanes.map((lane) => {
              const selected = pick.poolLaneId === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  aria-pressed={selected}
                  data-pick-joint-lane={lane.id}
                  onClick={() => onPick({ kind: 'joint', poolLaneId: lane.id })}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-sm ${
                    selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
                  }`}
                >
                  {lane.icon ? `${lane.icon} ` : ''}
                  {lane.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
