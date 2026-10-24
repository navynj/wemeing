'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { isNewSince, usePoolVisits } from './remembered';

type MyPoolName = { id: string; name: string; photo?: string | null };
type Activity = { activity: Record<string, string | null>; pools: MyPoolName[] };

/** My pools, and each one's latest activity by someone else, loaded once by the shell. */
const Context = createContext<Activity>({ activity: {}, pools: [] });

export function PoolActivityProvider({
  activity,
  pools = [],
  children,
}: {
  activity: Record<string, string | null>;
  pools?: MyPoolName[];
  children: ReactNode;
}) {
  return <Context.Provider value={{ activity, pools }}>{children}</Context.Provider>;
}

/**
 * The pool strip's pools (review): every pool I am in now, in a fixed order —
 * the one I joined most recently first — so a place never moves when it is
 * tapped; each with whether it has something new for me, known only once
 * this device's visits are (never on the server).
 */
export function useStripPools(): (MyPoolName & { fresh: boolean })[] {
  const { activity, pools } = useContext(Context);
  const visits = usePoolVisits();
  return pools.map((pool) => ({
    ...pool,
    fresh: visits !== null && isNewSince(pool.id, activity[pool.id] ?? null),
  }));
}

/**
 * The notification dot (review): small, white with the water's blue ring so
 * it reads on the ground, at the top right of what it marks.
 */
export function UnseenDot({ label = 'New in your Pools' }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      data-unseen-dot
      className="ring-main-900 absolute -top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-white ring-2"
    />
  );
}
