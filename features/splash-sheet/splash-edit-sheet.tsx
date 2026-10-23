'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { COLUMN_MAX_WIDTH } from '@/components/ui/column';
import { LaneChips } from '@/features/input-sheet/lane-chips';
import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import { EmojiInput } from '@/features/lanes/emoji-input';
import { linkedPools } from '@/features/pool/audience';
import { AudienceChip } from '@/features/pool/audience-sheet';

import { loadSplashEdit, saveSplashEdit, type SplashEditState } from './edit-actions';
import { SHEET_MAX_HEIGHT, type SheetContext } from './splash-sheet';

type Loaded = Extract<SplashEditState, { ok: true }>;

/** How long an edit stays applied over the server's rows before the re-read has surely landed. */
const SETTLE_MS = 2500;

/**
 * The compose sheet in edit mode (review), from the pencil on the top card
 * or a splash's page: title, icon, dates, lane and Audience for my own
 * splash; title, icon and dates for Just mine (its pool fixed); title and
 * icon for a joint splash. Ripples are edited on the splash's page, not
 * here. Save shows the change at once everywhere the splash is drawn and
 * the save runs behind it; a refusal takes it back and says why.
 */
export function SplashEditSheet({
  splashId,
  context,
  onClose,
}: {
  splashId: string;
  context: SheetContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const { markEdited, clearEdited, dropFailed } = useInputSheet();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadSplashEdit(splashId).then((state) => {
      if (!live) return;
      if (state.ok) setLoaded(state);
      else setMessage(state.message);
    });
    return () => {
      live = false;
    };
  }, [splashId]);

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
        aria-label="Edit splash"
        data-edit-sheet
        className={`sheet-rise relative mx-auto flex w-full ${COLUMN_MAX_WIDTH} ${SHEET_MAX_HEIGHT} flex-col overflow-hidden rounded-t-[32px] bg-white`}
      >
        <div
          className="flex min-h-0 flex-col overflow-y-auto px-7 pt-8"
          style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {loaded ? (
            <EditForm
              initial={loaded}
              context={context}
              onCancel={onClose}
              onSave={(edit) => {
                // Shown at once everywhere the splash is drawn (CLAUDE.md, the principle).
                markEdited(splashId, {
                  title: edit.title,
                  icon: edit.icon,
                  declaredLaneId: edit.kind === 'mine' ? edit.declaredLaneId : undefined,
                });
                onClose();
                void saveSplashEdit({ id: splashId, ...edit }).then((done) => {
                  if (!done.ok) {
                    clearEdited(splashId);
                    dropFailed(done.message);
                    return;
                  }
                  router.refresh();
                  window.setTimeout(() => clearEdited(splashId), SETTLE_MS);
                });
              }}
            />
          ) : (
            <p className="text-pool-500 py-6 text-sm">{message ?? 'Opening…'}</p>
          )}
        </div>
      </section>
    </div>
  );
}

type Edit = {
  kind: Loaded['kind'];
  title: string;
  icon: string | null;
  declaredStart: string | null;
  declaredEnd: string | null;
  declaredLaneId: string | null;
  share: { poolId: string; on: boolean }[];
  poolId: string | null;
};

function EditForm({
  initial,
  context,
  onCancel,
  onSave,
}: {
  initial: Loaded;
  context: SheetContext;
  onCancel: () => void;
  onSave: (edit: Edit) => void;
}) {
  const { categories, links, pools } = context;
  const [title, setTitle] = useState(initial.title);
  const [icon, setIcon] = useState(initial.icon ?? '');
  const [start, setStart] = useState(initial.declaredStart ?? '');
  const [end, setEnd] = useState(initial.declaredEnd ?? '');
  const [laneId, setLaneId] = useState<string | null>(initial.declaredLaneId);
  const [shared, setShared] = useState<string[]>(initial.shared);
  const mine = initial.kind === 'mine';
  const joint = initial.kind === 'joint';
  const linked = linkedPools(laneId, links);
  const poolName = pools.find((p) => p.id === initial.poolId)?.name ?? 'its pool';

  const changed =
    title.trim() !== initial.title ||
    (icon || null) !== initial.icon ||
    (!joint && (start || null) !== initial.declaredStart) ||
    (!joint && (end || null) !== initial.declaredEnd) ||
    (mine && laneId !== initial.declaredLaneId) ||
    (mine && [...shared].sort().join() !== [...initial.shared].sort().join());
  const rangeOk = !end || (start !== '' && end >= start);

  return (
    <div data-edit-form={initial.kind} className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <EmojiInput value={icon} onChange={setIcon} label="Icon" placeholder="🙂" />
        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
          rows={1}
          aria-label="Title"
          data-edit-title
          placeholder="Untitled"
          className="text-main-900 placeholder:text-main-900 min-w-0 flex-1 resize-none text-3xl/snug font-semibold outline-none placeholder:opacity-20"
        />
      </div>

      {joint ? (
        <p className="text-pool-500 text-xs">
          A joint splash belongs to {poolName}: its title and icon are everyone&apos;s to edit.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-pool-500 flex items-center gap-2">
            From
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              aria-label="Start date"
              className="text-ink bg-pool-100 rounded-lg px-2 py-1"
            />
          </label>
          <label className="text-pool-500 flex items-center gap-2">
            to
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              aria-label="End date"
              className="text-ink bg-pool-100 rounded-lg px-2 py-1"
            />
          </label>
          {start || end ? (
            <button
              type="button"
              onClick={() => (setStart(''), setEnd(''))}
              className="text-pool-500 text-xs"
            >
              Clear dates
            </button>
          ) : null}
        </div>
      )}

      {mine ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <LaneChips
              categories={categories}
              selectedId={laneId}
              onSelect={setLaneId}
              surface="white"
            />
          </div>
          {pools.length > 0 ? (
            <AudienceChip
              shared={shared.filter((id) => linked.includes(id))}
              linked={pools
                .filter((p) => linked.includes(p.id))
                .map((p) => ({ poolId: p.id, name: p.name }))}
              unlinked={pools
                .filter((p) => !linked.includes(p.id))
                .map((p) => ({ poolId: p.id, name: p.name }))}
              onToggle={(poolId, on) =>
                setShared((current) =>
                  on ? [...new Set([...current, poolId])] : current.filter((id) => id !== poolId),
                )
              }
            />
          ) : null}
        </div>
      ) : initial.kind === 'own' ? (
        <p data-edit-just-mine className="text-pool-500 text-xs">
          Just mine · {poolName}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border-pool-200 text-ink flex-1 rounded-full border py-2.5 text-base font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          data-edit-save
          disabled={!changed || !rangeOk}
          onClick={() =>
            onSave({
              kind: initial.kind,
              title: title.trim(),
              icon: icon || null,
              declaredStart: joint ? initial.declaredStart : start || null,
              declaredEnd: joint ? initial.declaredEnd : end || null,
              declaredLaneId: mine ? laneId : null,
              // Only the switches that moved.
              share: mine
                ? [
                    ...shared
                      .filter((id) => !initial.shared.includes(id))
                      .map((poolId) => ({ poolId, on: true })),
                    ...initial.shared
                      .filter((id) => !shared.includes(id))
                      .map((poolId) => ({ poolId, on: false })),
                  ]
                : [],
              poolId: initial.poolId,
            })
          }
          className="bg-main-900 flex-1 rounded-full py-2.5 text-base font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
