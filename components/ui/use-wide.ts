'use client';

import { useSyncExternalStore } from 'react';

/** Tailwind's `lg`: where the grid and the board sit side by side. */
const QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** True on a wide screen; false on the server and through hydration, the phone being the first reading. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
