'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { saveLane } from '@/features/lanes/actions';
import type { MyCategory } from '@/lib/queries/profile';
import type { PoolView } from '@/lib/queries/pools';

import { setLaneLinks } from './actions';
import { DeletePool } from './delete-pool';
import { InvitePanel } from './invite-panel';
import { LaneMatch } from './lane-match';
import type { Links } from './match';
import { PrimaryButton, StepPage } from './step-page';

/**
 * Pool settings (H23): the invite link, and which of my lanes each pool lane
 * takes — the same rows as step 2, changeable any time. Unlinking a lane
 * switches its posts here off; they stay, so linking it again is a choice
 * per post, never a flood.
 */
export function PoolSettings({
  view,
  categories,
  me,
}: {
  view: PoolView;
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
  me: string;
}) {
  const router = useRouter();
  const poolId = view.pool.id;
  const initial: Links = Object.fromEntries(
    view.lanes.map((lane) => [
      lane.id,
      view.myLinks.find((l) => l.poolLaneId === lane.id)?.myCategoryId ?? null,
    ]),
  );
  const [links, setLinks] = useState<Links>(initial);
  const [mine, setMine] = useState(categories);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const changed = JSON.stringify(links) !== JSON.stringify(initial);

  return (
    <StepPage step={null} onBack={() => router.push(`/pool/${poolId}`)}>
      <p className="text-pool-500 text-sm">{view.pool.name}</p>
      <h1 className="text-main-900 mt-1 text-3xl/tight font-semibold">Pool settings</h1>

      <section className="mt-10">
        <h2 className="text-ink mb-3 font-semibold">Invite link</h2>
        <InvitePanel poolId={poolId} invites={view.invites} />
      </section>

      <section data-settings-links className="mt-12 flex flex-1 flex-col">
        <LaneMatch
          poolName={view.pool.name}
          lanes={view.lanes.map((lane) => ({
            key: lane.id,
            name: lane.name,
            icon: lane.icon,
            description: lane.description,
          }))}
          categories={mine}
          links={links}
          onLinksChange={setLinks}
          onCreateLane={async (lane) => {
            const made = await saveLane({ id: null, ...lane });
            if (!made.ok || !made.id) return { message: made.ok ? 'Try again.' : made.message };
            setMine((current) => [...current, { id: made.id!, name: lane.name, icon: lane.icon }]);
            return made.id;
          }}
          footer={
            message ? (
              <p role="alert" className="text-pool-500 text-sm">
                {message}
              </p>
            ) : null
          }
          action={
            <PrimaryButton
              disabled={busy || !changed}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                const done = await setLaneLinks(
                  poolId,
                  view.lanes.map((lane) => ({
                    poolLaneId: lane.id,
                    myCategoryId: links[lane.id] ?? null,
                  })),
                );
                setBusy(false);
                if (!done.ok) return setMessage(done.message);
                router.push(`/pool/${poolId}`);
              }}
            >
              {busy ? 'Saving…' : 'Save lane links'}
            </PrimaryButton>
          }
        />
      </section>

      {/* The creator alone deletes the pool (0015). */}
      {view.pool.ownerId === me ? (
        <section className="border-pool-100 mt-12 border-t pt-6">
          <DeletePool poolId={poolId} poolName={view.pool.name} />
        </section>
      ) : null}
    </StepPage>
  );
}
