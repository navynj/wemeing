'use client';

import { useState, type ReactNode } from 'react';

import { LaneChips } from '@/features/input-sheet/lane-chips';
import { linkedPools } from '@/features/pool/audience';
import { AudienceChip } from '@/features/pool/audience-sheet';
import type { PoolScope } from '@/features/pool/compose-scope';
import { PoolLanePicker, type PoolPick } from '@/features/pool/pool-lane-picker';

import {
  homeWarnings,
  planFromHome,
  planFromPool,
  removedFrom,
  type Conversion,
  type Current,
} from './conversion';
import type { SplashEditState } from './edit-actions';
import type { SheetContext } from './splash-sheet';

type Loaded = Extract<SplashEditState, { ok: true }>;

export type EditLanes = {
  conversion: Conversion;
  /** Mine from Home: the lane chosen (its declaration). */
  laneId: string | null;
  /** Mine from Home: the Audience as set. */
  shared: string[];
  changed: boolean;
  /** Becoming joint asks first (review): the pool, and the other pools it leaves. */
  confirm: { pool: string; removed: string[] } | null;
  node: ReactNode;
};

/**
 * The edit sheet's lanes (0022). Opened from a pool the splash is in: that
 * pool's lane chips and Just mine, by the compose table. Opened from Home: my
 * lanes — with the Audience for mine, a warning per pool when the lane
 * changes, and for a joint splash someone else wrote in, its pool's lanes only.
 */
export function useEditLanes(
  initial: Loaded,
  context: SheetContext,
  pool: PoolScope | null,
): EditLanes {
  const { categories, links, pools } = context;
  const poolName = (id: string): string => pools.find((p) => p.id === id)?.name ?? 'its Pool';
  const laneName = (id: string): string => initial.laneNames[id]?.name ?? 'its lane';
  const current: Current = {
    kind: initial.kind,
    poolLaneId: initial.poolLaneId,
    declaredLaneId: initial.declaredLaneId,
    sharedIn: initial.sharedIn,
  };
  const inPool =
    pool !== null &&
    (initial.poolId === pool.poolId || initial.sharedIn.some((s) => s.poolId === pool.poolId));
  const hereLane = pool
    ? initial.kind === 'mine'
      ? (initial.sharedIn.find((s) => s.poolId === pool.poolId)?.poolLaneId ?? null)
      : initial.poolLaneId
    : null;

  // From a pool: the chosen pool lane and the switch.
  const [pick, setPick] = useState<PoolPick>(null);
  const [justMine, setJustMine] = useState(initial.kind !== 'joint');
  const chosenPoolLane = pick?.poolLaneId ?? hereLane;
  // From Home: my lane, the Audience, or (a joint someone else wrote in) a pool lane.
  const [laneId, setLaneId] = useState<string | null>(
    initial.kind === 'mine' ? initial.declaredLaneId : null,
  );
  const [shared, setShared] = useState<string[]>(initial.shared);
  const [poolLaneId, setPoolLaneId] = useState(initial.poolLaneId);
  const stuck = initial.kind === 'joint' && initial.othersWrote;

  if (pool && inPool) {
    const conversion = chosenPoolLane
      ? planFromPool(current, pool, chosenPoolLane, justMine)
      : ({ op: 'none' } as const);
    const removed = removedFrom(current, pool.poolId).map(poolName);
    const notes =
      conversion.op === 'to_just_mine' && removed.length > 0
        ? [`It will be removed from ${removed.join(', ')}.`]
        : [];
    return {
      conversion,
      laneId: null,
      shared: initial.shared,
      changed: conversion.op !== 'none',
      confirm:
        conversion.op === 'to_joint' && initial.kind !== 'joint'
          ? { pool: pool.poolName, removed }
          : null,
      node: (
        <div data-edit-pool-lanes className="flex flex-col gap-2">
          <PoolLanePicker
            scope={pool}
            categories={categories}
            pick={pick ?? (hereLane ? { kind: 'joint', poolLaneId: hereLane } : null)}
            onPick={(next) => next && setPick(next)}
            initialJustMine={justMine}
            onJustMine={setJustMine}
            justMineLocked={stuck ? 'Others have written here.' : null}
          />
          <Notes lines={notes} />
        </div>
      ),
    };
  }

  if (stuck) {
    // Someone else wrote here: it stays in its pool, moved only among its lanes.
    const conversion: Conversion =
      poolLaneId && poolLaneId !== initial.poolLaneId
        ? { op: 'move_pool', poolLaneId }
        : { op: 'none' };
    return {
      conversion,
      laneId: null,
      shared: initial.shared,
      changed: conversion.op !== 'none',
      confirm: null,
      node: (
        <div data-edit-pool-lanes className="flex flex-col gap-2">
          <LaneChips
            categories={initial.poolLanes}
            selectedId={poolLaneId}
            onSelect={(id) => id && setPoolLaneId(id)}
            surface="white"
          />
          <Notes
            lines={[`Others have written here, so it stays in ${poolName(initial.poolId ?? '')}.`]}
          />
        </div>
      ),
    };
  }

  const conversion = planFromHome(current, laneId);
  const warnings = homeWarnings(
    { ...current, poolId: initial.poolId },
    laneId,
    links.flatMap((l) => (l.poolLaneId ? [{ ...l, poolLaneId: l.poolLaneId }] : [])),
    poolName,
    laneName,
  );
  const linked = linkedPools(laneId, links);
  const mine = initial.kind === 'mine';
  return {
    conversion,
    laneId,
    shared,
    changed:
      conversion.op !== 'none' ||
      (mine && [...shared].sort().join() !== [...initial.shared].sort().join()),
    confirm: null,
    node: (
      <div data-edit-my-lanes className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <LaneChips
              categories={categories}
              selectedId={laneId}
              onSelect={setLaneId}
              surface="white"
            />
          </div>
          {mine && pools.length > 0 ? (
            <AudienceChip
              shared={shared.filter((id) => linked.includes(id))}
              linked={pools
                .filter((p) => linked.includes(p.id))
                .map((p) => ({ poolId: p.id, name: p.name }))}
              unlinked={pools
                .filter((p) => !linked.includes(p.id))
                .map((p) => ({ poolId: p.id, name: p.name }))}
              onToggle={(poolId, on) =>
                setShared((list) =>
                  on ? [...new Set([...list, poolId])] : list.filter((id) => id !== poolId),
                )
              }
            />
          ) : null}
        </div>
        {initial.kind === 'own' && !laneId ? (
          <p data-edit-just-mine className="text-pool-500 text-xs">
            Just mine · {poolName(initial.poolId ?? '')}
          </p>
        ) : null}
        <Notes lines={warnings} />
      </div>
    ),
  };
}

function Notes({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul data-edit-warnings className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line} data-edit-warning className="text-ink text-xs">
          {line}
        </li>
      ))}
    </ul>
  );
}
