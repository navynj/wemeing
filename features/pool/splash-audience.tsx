'use client';

import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { setPlacement } from './actions';
import { AudienceChip } from './audience-sheet';

/**
 * A post's Audience chip on its own page (H23): the pools it is shared to,
 * switched on and off in place. Each switch shows at once and the
 * placement follows behind it; a refusal (a lane unlinked meanwhile) takes
 * it back and says why.
 */
export function SplashAudience({
  splashId,
  shared,
  linked,
  unlinked,
}: {
  splashId: string;
  shared: string[];
  linked: { poolId: string; name: string }[];
  unlinked: { poolId: string; name: string }[];
}) {
  const audience = useOptimisticAction(shared);
  return (
    <span className="flex flex-col items-end gap-1">
      <AudienceChip
        shared={audience.value}
        linked={linked}
        unlinked={unlinked}
        onToggle={(poolId, on) =>
          audience.run(
            (current) => (on ? [...current, poolId] : current.filter((id) => id !== poolId)),
            () => setPlacement(splashId, poolId, on),
          )
        }
      />
      {audience.message ? (
        <span role="alert" className="text-pool-500 text-[10px]">
          {audience.message}
        </span>
      ) : null}
    </span>
  );
}
