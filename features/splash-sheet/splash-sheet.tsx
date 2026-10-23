'use client';

import { COLUMN_MAX_WIDTH } from '@/components/ui/column';

import type { PoolScope } from '@/features/pool/compose-scope';

import { SplashComposer, type DropHandoff, type SheetContext } from './splash-composer';

export type { DropHandoff, SheetContext };

/**
 * The sheet grows with its content to near-fullscreen, capped at the safe
 * area (SPEC 6). One expression, so the test and the screen agree on it.
 */
export const SHEET_MAX_HEIGHT = 'max-h-[calc(100dvh-env(safe-area-inset-top,0px)-2rem)]';

/**
 * The post sheet (SPEC 6, H21): the composer as a white bottom sheet on the
 * dimmed ground, from the compose disc at every width (review).
 */
export function SplashSheet({
  context,
  onClose,
  onDrop,
  pool = null,
}: {
  context: SheetContext;
  onClose: () => void;
  onDrop: (drop: DropHandoff) => void;
  /** Opened from a pool (H23): that pool is the default. */
  pool?: PoolScope | null;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-main-900/60 scrim-in absolute inset-0"
      />

      <section
        role="dialog"
        aria-label="Drop a splash"
        data-splash-sheet
        className={`sheet-rise relative mx-auto flex w-full ${COLUMN_MAX_WIDTH} ${SHEET_MAX_HEIGHT} flex-col overflow-hidden rounded-t-[32px] bg-white`}
      >
        <div
          className="flex min-h-0 flex-col overflow-y-auto px-7 pt-8"
          style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <SplashComposer context={context} onDrop={onDrop} pool={pool} />
        </div>
      </section>
    </div>
  );
}
