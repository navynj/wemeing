'use client';

import { useState } from 'react';

import { EmojiInput } from '@/features/lanes/emoji-input';
import type { PoolLane } from '@/lib/queries/pools';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { savePoolLane } from './actions';
import { PoolSheet, SheetTitle } from './sheet';

/**
 * The pool's lanes (H23), from the lane glyph at the header's left: any
 * member renames a lane, changes its emoji or its line of description, or
 * adds one. No roles in this phase; deleting a pool lane waits for them.
 */
export function PoolLanesSheet({
  poolId,
  lanes,
  onClose,
}: {
  poolId: string;
  lanes: PoolLane[];
  onClose: () => void;
}) {
  const shown = useOptimisticAction(lanes);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return (
    <PoolSheet label="Pool lanes" onClose={onClose}>
      <SheetTitle>Pool lanes</SheetTitle>
      {shown.message ? (
        <p role="alert" className="text-pool-500 mb-3 text-sm">
          {shown.message}
        </p>
      ) : null}
      <ul className="flex flex-col">
        {shown.value.map((lane) =>
          editing === lane.id ? (
            <li key={lane.id}>
              <PoolLaneForm
                lane={lane}
                onCancel={() => setEditing(null)}
                onSave={(fields) => {
                  setEditing(null);
                  shown.run(
                    (current) => current.map((l) => (l.id === lane.id ? { ...l, ...fields } : l)),
                    () => savePoolLane({ id: lane.id, poolId, ...fields }),
                  );
                }}
              />
            </li>
          ) : (
            <li key={lane.id}>
              <button
                type="button"
                data-pool-lane={lane.id}
                onClick={() => setEditing(lane.id)}
                className="border-pool-100 flex w-full items-center gap-3 border-b py-3 text-left"
              >
                <span aria-hidden className="text-2xl/none">
                  {lane.icon ?? '·'}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink truncate font-semibold">{lane.name}</span>
                  {lane.description ? (
                    <span className="text-pool-500 truncate text-xs">{lane.description}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <PoolLaneForm
          lane={null}
          onCancel={() => setEditing(null)}
          onSave={(fields) => {
            setEditing(null);
            shown.run(
              (current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  pool_id: poolId,
                  position: current.length,
                  ...fields,
                },
              ],
              () => savePoolLane({ id: null, poolId, ...fields }),
            );
          }}
        />
      ) : (
        <button
          type="button"
          data-add-pool-lane
          onClick={() => setEditing('new')}
          className="text-main-900 mt-4 self-start py-2 text-sm font-semibold"
        >
          + Add lane
        </button>
      )}
    </PoolSheet>
  );
}

type LaneFields = { name: string; icon: string | null; description: string | null };

function PoolLaneForm({
  lane,
  onCancel,
  onSave,
}: {
  lane: PoolLane | null;
  onCancel: () => void;
  onSave: (fields: LaneFields) => void;
}) {
  const [icon, setIcon] = useState(lane?.icon ?? '');
  const [name, setName] = useState(lane?.name ?? '');
  const [description, setDescription] = useState(lane?.description ?? '');
  return (
    <div
      data-pool-lane-form
      className="border-pool-200 my-2 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-3">
        <EmojiInput value={icon} onChange={setIcon} label="Lane emoji" placeholder="🙂" />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          aria-label="Lane name"
          className="border-pool-200 text-ink h-12 min-w-0 flex-1 rounded-xl border px-3 outline-none"
        />
      </div>
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={80}
        aria-label="Lane description"
        placeholder="A line about this lane (optional)"
        className="border-pool-200 text-ink h-11 rounded-xl border px-3 text-sm outline-none"
      />
      <div className="flex justify-end gap-4 text-sm">
        <button type="button" onClick={onCancel} className="text-pool-500">
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              icon: icon || null,
              description: description.trim() || null,
            })
          }
          className="text-main-900 font-semibold disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
