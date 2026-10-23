'use client';

import { useSyncExternalStore } from 'react';

function canBackdropFrost(): boolean {
  return (
    CSS.supports('(-webkit-backdrop-filter: blur(1px))') ||
    CSS.supports('(backdrop-filter: blur(1px))')
  );
}

/** True once the client can blur a backdrop; false on the server and through hydration. */
export function useBackdropFrost(): boolean {
  return useSyncExternalStore(
    () => () => {},
    canBackdropFrost,
    () => false,
  );
}
