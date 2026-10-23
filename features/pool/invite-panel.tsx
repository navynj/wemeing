'use client';

import { useState } from 'react';

import type { PoolInvite } from '@/lib/queries/pools';

import { createInvite, revokeInvite } from './actions';

/**
 * The invite link (H23): *Create invite link* mints one that expires in
 * seven days; each live link can be copied or revoked. Used by the pool's
 * `+` sheet and by Pool settings. The origin comes from the page, never
 * from source (CLAUDE.md: the deployment's origin is configuration).
 */
export function InvitePanel({ poolId, invites }: { poolId: string; invites: PoolInvite[] }) {
  const [live, setLive] = useState(
    invites.map((i) => ({ id: i.id, token: i.token, expiresAt: i.expires_at })),
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linkOf = (token: string): string => `${window.location.origin}/join/${token}`;

  return (
    <div data-invite-panel className="flex flex-col gap-3">
      <button
        type="button"
        data-create-invite
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const made = await createInvite(poolId);
          setBusy(false);
          if (!made.ok) return setMessage(made.message);
          setLive((current) => [
            { id: made.id, token: made.token, expiresAt: made.expiresAt },
            ...current,
          ]);
        }}
        className="bg-main-900 h-12 rounded-full text-sm font-semibold text-white disabled:opacity-40"
      >
        Create invite link
      </button>
      {message ? (
        <p role="alert" className="text-pool-500 text-sm">
          {message}
        </p>
      ) : null}
      <ul className="flex flex-col">
        {live.map((invite) => (
          <li
            key={invite.id}
            data-invite={invite.token}
            className="border-pool-100 flex flex-col gap-1 border-b py-3"
          >
            <span className="text-ink truncate font-mono text-xs">/join/{invite.token}</span>
            <span className="flex items-center justify-between gap-3 text-xs">
              <span className="text-pool-500">
                Expires{' '}
                {new Date(invite.expiresAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex gap-4">
                <button
                  type="button"
                  data-copy-invite
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkOf(invite.token));
                      setCopied(invite.token);
                    } catch {
                      setMessage('Copy did not work here. Select the link and copy it by hand.');
                    }
                  }}
                  className="text-main-900 font-semibold"
                >
                  {copied === invite.token ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  data-revoke-invite
                  onClick={async () => {
                    const before = live;
                    // Gone at once; back with a reason if the database refuses.
                    setLive((current) => current.filter((i) => i.token !== invite.token));
                    const done = await revokeInvite(poolId, invite.id);
                    if (!done.ok) {
                      setLive(before);
                      setMessage(done.message);
                    }
                  }}
                  className="text-pool-500"
                >
                  Revoke
                </button>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
