'use client';

import { useState } from 'react';

import type { PoolScope } from './compose-scope';
import { Switch } from './lane-match';

/**
 * The choice when composing from a pool (H23): a pool lane, and whose — a
 * joint splash the pool owns; or, Just mine, my own splash in the lane I
 * linked to it (placed here), or with no lane of mine when I linked none.
 */
export type PoolPick =
  | { kind: 'joint'; poolLaneId: string }
  /** "Just mine" (0014): my splash on that pool lane, linked to no lane of mine. */
  | { kind: 'own'; poolLaneId: string }
  | { kind: 'lane'; poolLaneId: string; myCategoryId: string }
  | null;

/**
 * Composing from a pool (review): this pool's lanes, the chips the only
 * filled element, and under them at the right one *Just mine* switch.
 * Off (the default): a joint splash on the chosen pool lane, everyone's.
 * On: mine alone. On a pool lane I have linked, that is my own splash in
 * my linked lane, placed here — it shows in that lane on my Home too; on
 * one I have not, a Just-mine splash with no lane of mine (0014), in the
 * pool's column on my Home. No separate "My lanes": the link decides where
 * mine lands. My ripple on a joint splash takes my linked lane, or none
 * (0016) — nothing to ask. There is no audience here: what is written in a
 * pool is in that pool.
 */
export function PoolLanePicker({
  scope,
  pick,
  onPick,
}: {
  scope: PoolScope;
  pick: PoolPick;
  onPick: (pick: PoolPick) => void;
}) {
  const [justMine, setJustMine] = useState(false);
  const chosen = pick?.poolLaneId ?? null;
  const pickFor = (laneId: string, mine: boolean): PoolPick => {
    if (!mine) return { kind: 'joint', poolLaneId: laneId };
    const myLane = scope.lanes.find((l) => l.id === laneId)?.myCategoryId ?? null;
    return myLane
      ? { kind: 'lane', poolLaneId: laneId, myCategoryId: myLane }
      : { kind: 'own', poolLaneId: laneId };
  };

  return (
    <div data-pool-lane-picker className="flex flex-col gap-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {scope.lanes.map((lane) => {
          const selected = chosen === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={selected}
              data-pick-pool-lane={lane.id}
              onClick={() => onPick(selected ? null : pickFor(lane.id, justMine))}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                // Selection is ink (H20f); the chips are the one fill here.
                selected ? 'bg-ink text-white' : 'border-pool-200 text-ink border'
              }`}
            >
              {lane.icon ? `${lane.icon} ` : ''}
              {lane.name}
            </button>
          );
        })}
      </div>
      {/* Under the lanes, at the right: whose it is (review). */}
      <div className="flex justify-end">
        <label data-just-mine className="text-pool-500 flex items-center gap-2 text-xs">
          Just mine
          <Switch
            on={justMine}
            label="Just mine"
            onChange={(on) => {
              setJustMine(on);
              if (chosen) onPick(pickFor(chosen, on));
            }}
          />
        </label>
      </div>
    </div>
  );
}
