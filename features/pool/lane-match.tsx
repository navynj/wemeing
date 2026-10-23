'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';

import { EmojiInput } from '@/features/lanes/emoji-input';
import type { MyCategory } from '@/lib/queries/profile';

import type { Links, MatchLane } from './match';

/**
 * Step 2 of 2 (1d), shared by create, join and Pool settings: one row per
 * pool lane — its name and description, an arrow, and a dropdown of my
 * lanes. *Don't connect* greys the row and turns the arrow into a cross.
 * At the end, a lane of mine made on the spot and connected; then whether
 * my earlier records come along, and the one primary button.
 *
 * Only connected lanes leak (C5): the subtitle says so, and nothing is
 * connected that the author did not leave connected.
 */
export function LaneMatch({
  poolName,
  lanes,
  categories,
  links,
  onLinksChange,
  includeHistory,
  onIncludeHistoryChange,
  onCreateLane,
  footer,
  action,
}: {
  poolName: string;
  lanes: MatchLane[];
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
  links: Links;
  onLinksChange: (links: Links) => void;
  /** Absent in settings: earlier records are a choice made at joining. */
  includeHistory?: boolean;
  onIncludeHistoryChange?: (on: boolean) => void;
  /** Makes one of my lanes and returns its id, or a refusal. */
  onCreateLane: (lane: { name: string; icon: string }) => Promise<string | { message: string }>;
  footer?: ReactNode;
  action: ReactNode;
}) {
  const [making, setMaking] = useState(false);
  const unconnected = lanes.filter((lane) => !links[lane.key]);

  return (
    <div data-lane-match className="flex min-h-0 flex-1 flex-col">
      <h1 className="text-main-900 text-3xl/tight font-semibold">Connect your lanes?</h1>
      <p className="text-pool-500 mt-3 text-sm/relaxed">
        Only records from connected lanes appear in this Pool. Unconnected lanes stay yours alone.
      </p>

      <div className="text-pool-500 mt-10 flex justify-between text-xs">
        <span data-pool-lanes-label className="truncate">
          {poolName.trim() || 'Pool'} lanes
        </span>
        <span>Your lanes</span>
      </div>

      <ol className="mt-3 flex flex-col gap-3">
        {lanes.map((lane) => {
          const chosen = links[lane.key] ?? null;
          const off = chosen === null;
          return (
            <li
              key={lane.key}
              data-match-row={lane.key}
              data-connected={off ? undefined : ''}
              className={`grid grid-cols-[minmax(0,1fr)_2rem_7.5rem] items-center gap-2 rounded-2xl px-5 py-5 ${
                off ? 'bg-pool-100/60' : 'bg-pool-100'
              }`}
            >
              <span className={`flex min-w-0 flex-col gap-1 ${off ? 'opacity-40' : ''}`}>
                <span className="text-main-900 flex min-w-0 items-center gap-1.5 font-semibold">
                  {lane.icon ? <span aria-hidden>{lane.icon}</span> : null}
                  <span className="truncate">{lane.name}</span>
                </span>
                {lane.description ? (
                  <span className="text-pool-500 truncate text-xs">{lane.description}</span>
                ) : null}
              </span>
              <span aria-hidden className="flex justify-center">
                {off ? (
                  <X size={18} className="text-pool-500/50" />
                ) : (
                  <ArrowRight size={22} className="text-main-900" />
                )}
              </span>
              <label className="relative flex min-w-0">
                <span className="sr-only">Your lane for {lane.name}</span>
                <select
                  value={chosen ?? ''}
                  data-match-select={lane.key}
                  onChange={(event) =>
                    onLinksChange({ ...links, [lane.key]: event.target.value || null })
                  }
                  className={`h-14 w-full min-w-0 appearance-none truncate rounded-xl bg-white pr-7 pl-3 text-center text-sm font-semibold outline-none ${
                    off
                      ? 'border-pool-200 text-pool-500/60 border'
                      : 'border-main-900 text-main-900 border-2'
                  }`}
                >
                  <option value="">Don&apos;t connect</option>
                  {categories.map((mine) => (
                    <option key={mine.id} value={mine.id}>
                      {mine.icon ? `${mine.icon} ` : ''}
                      {mine.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  size={14}
                  className={`pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 ${
                    off ? 'text-pool-500/40' : 'text-main-900'
                  }`}
                />
              </label>
            </li>
          );
        })}
      </ol>

      {making ? (
        <MakeLane
          lanes={unconnected.length > 0 ? unconnected : lanes}
          onCancel={() => setMaking(false)}
          onMake={async (key, lane) => {
            const made = await onCreateLane(lane);
            if (typeof made !== 'string') return made.message;
            onLinksChange({ ...links, [key]: made });
            setMaking(false);
            return null;
          }}
        />
      ) : (
        <div className="border-pool-200 mt-3 flex items-center justify-between gap-3 rounded-2xl border px-5 py-4">
          <span className="text-pool-500 text-sm">No lane to match?</span>
          <button
            type="button"
            data-create-and-connect
            onClick={() => setMaking(true)}
            className="text-main-900 text-sm font-semibold"
          >
            + Create and connect
          </button>
        </div>
      )}

      {onIncludeHistoryChange ? (
        <label className="mt-6 flex items-center justify-between gap-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-ink text-sm font-medium">Include my earlier records</span>
            <span className="text-pool-500 text-xs">
              {includeHistory
                ? 'Posts already in connected lanes appear here too.'
                : 'Only what you write from now on appears here.'}
            </span>
          </span>
          <Switch
            on={includeHistory ?? false}
            onChange={onIncludeHistoryChange}
            label="Include my earlier records"
          />
        </label>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-4 pt-10">
        {footer}
        {action}
      </div>
    </div>
  );
}

/** A switch: blue when on — it commits a choice — pale when off. */
export function Switch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-main-900' : 'bg-pool-200'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

/** "+ Create and connect": a lane of mine, named after the pool lane by default. */
function MakeLane({
  lanes,
  onCancel,
  onMake,
}: {
  lanes: MatchLane[];
  onCancel: () => void;
  onMake: (key: string, lane: { name: string; icon: string }) => Promise<string | null>;
}) {
  const [key, setKey] = useState(lanes[0]?.key ?? '');
  const target = lanes.find((lane) => lane.key === key) ?? lanes[0];
  const [name, setName] = useState(target?.name ?? '');
  const [icon, setIcon] = useState(target?.icon ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div
      data-make-lane
      className="border-main-900 mt-3 flex flex-col gap-3 rounded-2xl border-2 p-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-pool-500 text-xs">Connect to</span>
        <select
          value={key}
          onChange={(event) => {
            const next = lanes.find((lane) => lane.key === event.target.value);
            setKey(event.target.value);
            if (next) {
              setName(next.name);
              setIcon(next.icon ?? '');
            }
          }}
          className="border-pool-200 text-ink h-11 rounded-xl border bg-white px-3 text-sm"
        >
          {lanes.map((lane) => (
            <option key={lane.key} value={lane.key}>
              {lane.icon ? `${lane.icon} ` : ''}
              {lane.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <EmojiInput
          value={icon}
          onChange={setIcon}
          label="Your new lane's emoji"
          placeholder="🙂"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          aria-label="Your new lane's name"
          placeholder="Lane name"
          className="border-pool-200 text-ink h-12 min-w-0 flex-1 rounded-xl border px-3 outline-none"
        />
      </div>
      {message ? (
        <p role="alert" className="text-pool-500 text-xs">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-4 text-sm">
        <button type="button" onClick={onCancel} className="text-pool-500">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !name.trim() || !icon}
          onClick={async () => {
            setBusy(true);
            setMessage(await onMake(key, { name: name.trim(), icon }));
            setBusy(false);
          }}
          className="text-main-900 font-semibold disabled:opacity-40"
        >
          Create and connect
        </button>
      </div>
    </div>
  );
}
