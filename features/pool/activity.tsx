'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useUnseenPools } from './remembered';

/** Each of my pools' latest activity by someone else, loaded once by the shell. */
const Context = createContext<Record<string, string | null>>({});

export function PoolActivityProvider({
  activity,
  children,
}: {
  activity: Record<string, string | null>;
  children: ReactNode;
}) {
  return <Context.Provider value={activity}>{children}</Context.Provider>;
}

/** True when a pool (other than `except`) has something I have not seen on this device. */
export function useHasUnseenPool(except: string | null = null): boolean {
  return useUnseenPools(useContext(Context), except).length > 0;
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
