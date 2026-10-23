'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { deletePool } from './actions';
import { PoolSheet, SheetTitle } from './sheet';

/**
 * Delete Pool (0015), on the settings page and for the creator only. The
 * confirm says what happens to everyone's records, and stays shut until the
 * pool's name is typed exactly: this is the one action here that cannot be
 * taken back.
 */
export function DeletePool({ poolId, poolName }: { poolId: string; poolName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        data-delete-pool
        onClick={() => setOpen(true)}
        className="text-pool-500 self-start py-2 text-sm"
      >
        Delete Pool
      </button>
      {open ? (
        <PoolSheet label="Delete Pool" onClose={() => setOpen(false)}>
          <SheetTitle>Delete {poolName} for everyone?</SheetTitle>
          <p className="text-pool-500 -mt-2 mb-5 text-sm/relaxed">
            Joint splashes go back to each writer as their own records. Splashes shared from your
            lanes stay on their authors&apos; Home.
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-pool-500 text-xs">Type the Pool’s name to confirm</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              data-delete-pool-name
              autoComplete="off"
              className="border-pool-200 text-ink h-12 rounded-xl border px-3 outline-none"
            />
          </label>
          {message ? (
            <p role="alert" className="text-pool-500 mt-3 text-sm">
              {message}
            </p>
          ) : null}
          <button
            type="button"
            data-delete-pool-confirm
            disabled={typed !== poolName || busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const done = await deletePool(poolId);
              if (!done.ok) {
                setMessage(done.message);
                setBusy(false);
                return;
              }
              router.replace('/pool');
            }}
            className="bg-ink mt-5 h-14 w-full rounded-full font-semibold text-white disabled:opacity-30"
          >
            {busy ? 'Deleting…' : 'Delete Pool'}
          </button>
        </PoolSheet>
      ) : null}
    </>
  );
}
