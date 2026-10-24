'use client';

import { useState } from 'react';

import type { MyCategory } from '@/lib/queries/profile';

import type { PoolScope } from './compose-scope';
import { Switch } from './lane-match';
import { landingHint, resolvePick, type PoolPick } from './pool-pick';

export type { PoolPick } from './pool-pick';

/**
 * Composing from a pool (review): this pool's lane chips, the one filled
 * element; under the chosen chip, one line saying where it lands; and under
 * the chips at the right a small *Just mine* switch, off by default, ink
 * when on. What lands where follows the switch and the pool lane's link
 * (0017) — see resolvePick. There is no audience here: what is written in a
 * pool is in that pool.
 */
export function PoolLanePicker({
  scope,
  categories,
  pick,
  onPick,
  initialJustMine = false,
  justMineLocked = null,
  onJustMine,
}: {
  scope: PoolScope;
  categories: Pick<MyCategory, 'id' | 'name'>[];
  pick: PoolPick;
  onPick: (pick: PoolPick) => void;
  /** Editing (0022): where the switch starts — on for a splash of mine. */
  initialJustMine?: boolean;
  /** Why the switch cannot move, shown in its place ("Others have written here."). */
  justMineLocked?: string | null;
  onJustMine?: (on: boolean) => void;
}) {
  const [justMine, setJustMine] = useState(initialJustMine);
  const chosen = scope.lanes.find((l) => l.id === pick?.poolLaneId) ?? null;
  const nameOf = (id: string): string | null => categories.find((c) => c.id === id)?.name ?? null;

  return (
    <div data-pool-lane-picker className="flex flex-col gap-2">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {scope.lanes.map((lane) => {
          const selected = chosen?.id === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={selected}
              data-pick-pool-lane={lane.id}
              onClick={() => onPick(selected ? null : resolvePick(lane, justMine))}
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
      <div className="flex items-center justify-between gap-3">
        <span data-landing-hint className="text-pool-500 min-w-0 truncate text-xs">
          {justMineLocked ?? (chosen ? landingHint(chosen, justMine, nameOf) : null)}
        </span>
        <label data-just-mine className="text-pool-500 flex shrink-0 items-center gap-2 text-xs">
          Just mine
          <Switch
            on={justMine}
            label="Just mine"
            tone="ink"
            size="sm"
            disabled={justMineLocked !== null}
            onChange={(on) => {
              setJustMine(on);
              onJustMine?.(on);
              if (chosen) onPick(resolvePick(chosen, on));
            }}
          />
        </label>
      </div>
    </div>
  );
}
