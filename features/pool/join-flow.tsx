'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Monogram } from '@/components/ui/monogram';
import { saveLane } from '@/features/lanes/actions';
import type { MyCategory } from '@/lib/queries/profile';

import { joinPool } from './actions';
import { LaneMatch } from './lane-match';
import {
  settleDirections,
  joinLabel,
  linkedCount,
  prefillLinks,
  type Directions,
  type Links,
  type MatchLane,
} from './match';
import { PrimaryButton, StepPage } from './step-page';

/**
 * Joining from an invite link (H23): first who is there — the pool's name
 * and its members' initials, nothing more (0011 `invite_preview`) — then the
 * same step 2 as creating: my lanes matched to the pool's, and whether my
 * earlier records come along. The token is checked again when joining.
 */
export function JoinFlow({
  token,
  poolName,
  initials,
  lanes,
  categories,
}: {
  token: string;
  poolName: string;
  initials: string[];
  lanes: MatchLane[];
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mine, setMine] = useState(categories);
  const [links, setLinks] = useState<Links>(() => prefillLinks(lanes, categories));
  const [directions, setDirections] = useState<Directions>({});
  const [includeHistory, setIncludeHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (step === 1) {
    return (
      <StepPage step="1 / 2" onBack={() => router.replace('/')}>
        <p className="text-pool-500 text-sm">You are invited to</p>
        <div className="mt-4 flex items-center gap-4">
          <Monogram name={poolName} size="tile" />
          <h1
            data-invite-pool
            className="text-main-900 min-w-0 text-3xl/tight font-semibold break-words"
          >
            {poolName}
          </h1>
        </div>
        <ul aria-label="Members" className="mt-8 flex flex-wrap gap-2">
          {initials.map((letters, index) => (
            <li
              key={`${letters}-${index}`}
              data-invite-member
              className="bg-pool-100 text-pool-500 flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium"
            >
              {letters}
            </li>
          ))}
        </ul>
        <p className="text-pool-500 mt-6 text-sm/relaxed">
          Only the lanes you connect next will flow into this Pool. Everything else stays yours.
        </p>
        <div className="mt-auto pt-10">
          <PrimaryButton onClick={() => setStep(2)}>Next: match lanes</PrimaryButton>
        </div>
      </StepPage>
    );
  }

  return (
    <StepPage step="2 / 2" onBack={() => setStep(1)}>
      <LaneMatch
        poolName={poolName}
        lanes={lanes}
        categories={mine}
        links={links}
        onLinksChange={setLinks}
        directions={directions}
        onDirectionsChange={setDirections}
        includeHistory={includeHistory}
        onIncludeHistoryChange={setIncludeHistory}
        onCreateLane={async (lane) => {
          const made = await saveLane({ id: null, ...lane });
          if (!made.ok || !made.id) return { message: made.ok ? 'Try again.' : made.message };
          setMine((current) => [...current, { id: made.id!, name: lane.name, icon: lane.icon }]);
          return made.id;
        }}
        footer={
          <>
            {message ? (
              <p role="alert" className="text-pool-500 text-sm">
                {message}
              </p>
            ) : null}
            <p className="text-pool-500 text-xs">You can change this anytime in Pool settings.</p>
          </>
        }
        action={
          <PrimaryButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const joined = await joinPool({
                token,
                links: lanes.map((lane) => ({
                  poolLaneId: lane.key,
                  myCategoryId: links[lane.key] ?? null,
                  direction: settleDirections(
                    lanes.map((lane) => lane.key),
                    links,
                    directions,
                  )[lane.key],
                })),
                includeHistory,
              });
              if (!joined.ok) {
                setMessage(joined.message);
                setBusy(false);
                return;
              }
              router.replace(`/pool/${joined.id}`);
            }}
          >
            {busy ? 'Joining…' : joinLabel(linkedCount(links))}
          </PrimaryButton>
        }
      />
    </StepPage>
  );
}
