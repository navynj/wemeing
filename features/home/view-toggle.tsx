'use client';

import { useSyncExternalStore } from 'react';

export type HomeView = 'lane' | 'date';

/** Remembered per device (round 3). */
const KEY = 'weming.home-view';
const EVENT = 'weming:home-view';

function read(): HomeView {
  try {
    return window.localStorage.getItem(KEY) === 'date' ? 'date' : 'lane';
  } catch {
    return 'lane';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** The view Home shows, the last one chosen on this device; the Lane view on the server. */
export function useHomeView(): [HomeView, (view: HomeView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => 'lane' as const);
  const set = (next: HomeView): void => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, then; the switch still happens below.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [view, set];
}

/**
 * The header's segmented toggle, Lane | Date (round 3): the selected
 * segment white with blue words — on the water white carries what is
 * chosen (H21c) — the other quiet.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: HomeView;
  onChange: (view: HomeView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="View"
      data-view-toggle
      className="flex w-full rounded-full bg-white/15 p-0.5 text-sm font-medium"
    >
      {(['lane', 'date'] as const).map((option) => {
        const selected = option === view;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={selected}
            data-view-option={option}
            onClick={() => onChange(option)}
            className={`flex-1 rounded-full px-4 py-1.5 ${selected ? 'text-main-900 bg-white' : 'text-white/70'}`}
          >
            {option === 'lane' ? 'Lane' : 'Date'}
          </button>
        );
      })}
    </div>
  );
}
