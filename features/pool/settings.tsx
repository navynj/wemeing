'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { saveLane } from '@/features/lanes/actions';
import type { MyCategory } from '@/lib/queries/profile';
import type { PoolView } from '@/lib/queries/pools';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { renamePool, setLaneLinks } from './actions';
import { DeletePool } from './delete-pool';
import { InvitePanel } from './invite-panel';
import { LaneMatch } from './lane-match';
import { settleDirections, type Directions, type Links } from './match';
import { PrimaryButton, StepPage } from './step-page';

/**
 * Pool settings (H23): the invite link, and which of my lanes each pool lane
 * takes — the same rows as step 2, changeable any time. Unlinking a lane
 * switches its posts here off; they stay, so linking it again is a choice
 * per post, never a flood. The creator renames the pool here too (0021).
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
  const initialDirections: Directions = Object.fromEntries(
    view.myLinks.map((l) => [l.poolLaneId, l.direction]),
  );
  const [directions, setDirections] = useState<Directions>(initialDirections);
  const [mine, setMine] = useState(categories);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The name shows at once; a refusal takes it back and says why.
  const name = useOptimisticAction(view.pool.name);
  const changed =
    JSON.stringify(links) !== JSON.stringify(initial) ||
    JSON.stringify(directions) !== JSON.stringify(initialDirections);

  return (
    <StepPage step={null} onBack={() => router.push(`/pool/${poolId}`)}>
      <p className="text-pool-500 text-sm">{name.value}</p>
      <h1 className="text-main-900 mt-1 text-3xl/tight font-semibold">Pool settings</h1>

      {view.pool.ownerId === me ? (
        <PoolName
          name={name.value}
          message={name.message}
          onSave={(next) =>
            name.run(
              () => next,
              () => renamePool(poolId, next),
            )
          }
        />
      ) : null}

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
          directions={directions}
          onDirectionsChange={setDirections}
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
                    direction: settleDirections(
                      view.lanes.map((lane) => lane.id),
                      links,
                      directions,
                    )[lane.id],
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

/** The pool's name, the creator's to change (0021): a field and its own Save. */
function PoolName({
  name,
  message,
  onSave,
}: {
  name: string;
  message: string | null;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const next = draft.trim();
  return (
    <section data-settings-name className="mt-10">
      <h2 className="text-ink mb-3 font-semibold">Name</h2>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={60}
          aria-label="Pool name"
          className="border-pool-200 text-ink h-12 min-w-0 flex-1 rounded-xl border px-3 outline-none"
        />
        <button
          type="button"
          data-save-name
          disabled={!next || next === name}
          onClick={() => onSave(next)}
          className="bg-main-900 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-pool-500 mt-2 text-xs">
          {message}
        </p>
      ) : null}
    </section>
  );
}
