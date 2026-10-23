'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';

import { Monogram } from '@/components/ui/monogram';
import type { MyPool } from '@/lib/queries/pools';
import { Avatar } from '@/features/people/avatar';

import { isNewSince } from './remembered';
import { PoolSheet, SheetTitle } from './sheet';

/**
 * The pool switcher (H23), from the chevron beside the pool's name: every
 * pool I am in now — monogram, name, members' initials, a dot when
 * something is new since my last visit on this device — the current one
 * checked, and *Open a new Pool* last. Picking one switches in place; the
 * view (Lane, Date, Swimmers) stays as it is.
 */
export function PoolSwitcher({
  pools,
  currentId,
  onClose,
}: {
  pools: MyPool[];
  currentId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <PoolSheet label="Your Pools" onClose={onClose}>
      <SheetTitle>Your Pools</SheetTitle>
      <ul className="flex flex-col">
        {pools.map((pool) => {
          const current = pool.id === currentId;
          const fresh = !current && isNewSince(pool.id, pool.latestActivity);
          return (
            <li key={pool.id}>
              <button
                type="button"
                data-switch-pool={pool.id}
                aria-current={current ? 'true' : undefined}
                onClick={() => {
                  onClose();
                  if (!current) router.push(`/pool/${pool.id}`);
                }}
                className="border-pool-100 flex w-full items-center gap-3 border-b py-3 text-left"
              >
                <Monogram name={pool.name} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-ink flex items-center gap-2 font-semibold">
                    <span className="truncate">{pool.name}</span>
                    {fresh ? (
                      <span
                        data-pool-new
                        aria-label="New since your last visit"
                        className="bg-main-900 h-2 w-2 shrink-0 rounded-full"
                      />
                    ) : null}
                  </span>
                  <span data-switch-members className="flex items-center">
                    {pool.members
                      .filter((m) => !m.former)
                      .map((m, at) => (
                        <Avatar
                          key={m.userId}
                          id={m.userId}
                          initials={m.initials}
                          // Solid, so a face never shows the one beneath it (review).
                          className={`bg-pool-100 text-pool-500 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ring-2 ring-white ${
                            at > 0 ? '-ml-1' : ''
                          }`}
                        />
                      ))}
                  </span>
                </span>
                {current ? (
                  <Check aria-label="Current" size={18} className="text-main-900" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/pool/new"
        onClick={onClose}
        data-open-new-pool
        className="text-main-900 mt-4 flex items-center gap-2 py-2 font-semibold"
      >
        <Plus aria-hidden size={18} />
        Open a new Pool
      </Link>
    </PoolSheet>
  );
}
