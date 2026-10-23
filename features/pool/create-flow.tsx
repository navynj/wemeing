'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Monogram } from '@/components/ui/monogram';
import { saveLane } from '@/features/lanes/actions';
import type { MyCategory } from '@/lib/queries/profile';

import { createPool } from './actions';
import { POOL_KINDS, type PoolKind } from './kinds';
import { LaneMatch } from './lane-match';
import { LaneEditor, type DraftLane } from './lane-editor';
import { joinLabel, linkedCount, prefillLinks, type Links } from './match';
import { PrimaryButton, StepPage } from './step-page';

/**
 * "Open a new Pool" (1c, then 1d): step 1 names the pool, its kind, its
 * visibility and its lanes; step 2 matches them to mine. Nothing is written
 * until the last button, which opens the pool, its lanes, my membership and
 * my links as one act (`create_pool`), then goes to the pool.
 *
 * The pool's id comes from the database, so this one add waits on its round
 * trip: the button says so while it does.
 */
export function CreateFlow({ categories }: { categories: MyCategory[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PoolKind | null>(null);
  const [lanes, setLanes] = useState<DraftLane[]>([]);
  const [mine, setMine] = useState<Pick<MyCategory, 'id' | 'name' | 'icon'>[]>(categories);
  const [links, setLinks] = useState<Links>({});
  const [includeHistory, setIncludeHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready = name.trim().length > 0 && lanes.length > 0;
  const count = linkedCount(links);

  if (step === 2) {
    return (
      <StepPage step="2 / 2" onBack={() => setStep(1)}>
        <LaneMatch
          poolName={name}
          lanes={lanes}
          categories={mine}
          links={links}
          onLinksChange={setLinks}
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
                const made = await createPool({
                  name: name.trim(),
                  kind,
                  lanes: lanes.map((lane) => ({
                    name: lane.name,
                    icon: lane.icon,
                    description: lane.description,
                    myCategoryId: links[lane.key] ?? null,
                  })),
                  includeHistory,
                });
                if (!made.ok) {
                  setMessage(made.message);
                  setBusy(false);
                  return;
                }
                router.replace(`/pool/${made.id}`);
              }}
            >
              {busy ? 'Opening the Pool…' : joinLabel(count)}
            </PrimaryButton>
          }
        />
      </StepPage>
    );
  }

  return (
    <StepPage step="1 / 2" onBack={() => router.back()}>
      <h1 className="text-main-900 text-3xl/tight font-semibold">Open a new Pool</h1>
      <p className="text-pool-500 mt-3 text-sm">A pool for the people you keep records with.</p>

      <div className="mt-10 flex items-end gap-4">
        <Monogram name={name} size="tile" />
        <label className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-pool-500 text-xs">Pool name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            data-pool-name
            className="border-pool-200 text-ink focus:border-main-900 h-16 rounded-2xl border px-5 text-lg outline-none"
          />
        </label>
      </div>

      <fieldset className="mt-8">
        <legend className="text-pool-500 text-xs">What kind of Pool?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {POOL_KINDS.map((option) => {
            const selected = kind === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                aria-pressed={selected}
                data-pool-kind={option.kind}
                onClick={() => setKind(selected ? null : option.kind)}
                // Selection is ink, never blue (H20f).
                className={`h-12 rounded-full px-5 text-sm ${
                  selected ? 'bg-ink text-white' : 'border-pool-200 text-pool-500 border'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-8 flex flex-col gap-3">
        <legend className="text-pool-500 mb-3 text-xs">Visibility</legend>
        <VisibilityCard
          title="Private"
          detail="Only people with the invite link can join"
          selected
        />
        <VisibilityCard
          title="Open"
          detail="Anyone can find and join"
          note="Coming later"
          disabled
        />
      </fieldset>

      <div className="mt-8">
        <span className="text-pool-500 text-xs">
          Pool lanes, matched to your lanes in the next step
        </span>
        <LaneEditor lanes={lanes} onChange={setLanes} />
      </div>

      <div className="mt-auto pt-10">
        <PrimaryButton
          disabled={!ready}
          onClick={() => {
            // Prefilled once, when step 2 first opens; kept after that.
            setLinks((current) => ({ ...prefillLinks(lanes, mine), ...current }));
            setStep(2);
          }}
        >
          Next: match lanes
        </PrimaryButton>
      </div>
    </StepPage>
  );
}

/** A visibility card (1c): a title, a line, and a radio at the right. */
function VisibilityCard({
  title,
  detail,
  note,
  selected = false,
  disabled = false,
}: {
  title: string;
  detail: string;
  note?: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      data-visibility={title.toLowerCase()}
      className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-5 ${
        selected ? 'border-main-900 border-2' : 'border-pool-200 border'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="flex flex-col gap-1">
        <span className={`font-semibold ${selected ? 'text-main-900' : 'text-ink'}`}>
          {title}
          {note ? <span className="text-pool-500 ml-2 text-[10px] font-normal">{note}</span> : null}
        </span>
        <span className="text-pool-500 text-xs">{detail}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          selected ? 'border-main-900 border-2' : 'border-pool-200 border'
        }`}
      >
        {selected ? <span className="bg-main-900 h-3 w-3 rounded-full" /> : null}
      </span>
    </div>
  );
}
