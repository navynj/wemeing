'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PoolMember } from '@/lib/queries/pools';
import { Avatar, PersonName } from '@/features/people/avatar';

import { leavePool } from './actions';
import { PoolSheet, SheetTitle } from './sheet';

/**
 * The member list (H23): current members, me first then join order (D7),
 * then former members who kept their records, marked so. At the foot,
 * *Leave Pool*, which asks one question before it does anything.
 */
export function MembersSheet({
  poolId,
  members,
  me,
  onClose,
}: {
  poolId: string;
  members: PoolMember[];
  me: string;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  if (leaving) return <LeaveSheet poolId={poolId} onClose={() => setLeaving(false)} />;
  return (
    <PoolSheet label="Members" onClose={onClose}>
      <SheetTitle>Members</SheetTitle>
      <ul className="flex flex-col">
        {members.map((member) => (
          <li
            key={member.userId}
            data-member={member.userId}
            className="border-pool-100 flex items-center gap-3 border-b py-3"
          >
            <Avatar
              id={member.userId}
              initials={member.initials}
              className="bg-pool-100 text-pool-500 flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium"
            />
            <span className="text-ink min-w-0 flex-1 truncate">
              <PersonName id={member.userId} name={member.name} />
              {member.userId === me ? <span className="text-pool-500"> (you)</span> : null}
            </span>
            {member.former ? (
              <span data-former-member className="text-pool-500 text-xs">
                Former member
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-leave-pool
        onClick={() => setLeaving(true)}
        className="text-pool-500 mt-6 self-start py-2 text-sm"
      >
        Leave Pool
      </button>
    </PoolSheet>
  );
}

/**
 * Leaving (H23): keep my records here, marked *Former member*, or remove
 * them — hidden from the pool, never deleted. My posts stay on my Home
 * either way, which the sheet says, so neither answer reads as a loss.
 */
export function LeaveSheet({ poolId, onClose }: { poolId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const leave = async (keep: boolean): Promise<void> => {
    setBusy(true);
    const done = await leavePool(poolId, keep);
    if (!done.ok) {
      setMessage(done.message);
      setBusy(false);
      return;
    }
    router.replace('/pool');
  };
  return (
    <PoolSheet label="Leave Pool" onClose={onClose}>
      <SheetTitle>Keep your records in this Pool?</SheetTitle>
      <p className="text-pool-500 -mt-2 mb-6 text-sm/relaxed">
        Your splashes always stay on your own Home. Members of this Pool keep seeing them only if
        you keep them here.
      </p>
      {message ? (
        <p role="alert" className="text-pool-500 mb-3 text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          data-leave-keep
          disabled={busy}
          onClick={() => void leave(true)}
          className="bg-main-900 h-14 rounded-full font-semibold text-white disabled:opacity-40"
        >
          Keep them
        </button>
        <button
          type="button"
          data-leave-remove
          disabled={busy}
          onClick={() => void leave(false)}
          className="border-pool-200 text-ink h-14 rounded-full border font-semibold disabled:opacity-40"
        >
          Remove them
        </button>
        <button type="button" onClick={onClose} className="text-pool-500 py-2 text-sm">
          Stay in the Pool
        </button>
      </div>
    </PoolSheet>
  );
}
