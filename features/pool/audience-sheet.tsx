'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';

import { audienceLabel } from './audience';
import { Switch } from './lane-match';
import { PoolSheet, SheetTitle } from './sheet';

type Row = { poolId: string; name: string };

/**
 * The Audience chip (H23): one compact chip beside the lane picker in the
 * composer and in a post's header, saying where the post is shared — *Only
 * me*, the pool's name, or *N pools*. A tap opens the sheet. A joint
 * splash has no chip: it belongs to its pool.
 */
export function AudienceChip({
  shared,
  linked,
  unlinked,
  onToggle,
}: {
  /** Pool ids the post is shared to now. */
  shared: string[];
  /** Pools where the post's lane is linked: a switch each. */
  linked: Row[];
  /** Pools I am in where it is not: a note each. */
  unlinked: Row[];
  onToggle: (poolId: string, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const names = linked.filter((r) => shared.includes(r.poolId)).map((r) => r.name);
  return (
    <>
      <button
        type="button"
        data-audience-chip
        aria-label={`Audience: ${audienceLabel(names)}`}
        onClick={() => setOpen(true)}
        className="border-pool-200 text-ink inline-flex h-8 max-w-[12rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm"
      >
        <Users aria-hidden size={14} className="text-pool-500 shrink-0" />
        <span className="truncate">{audienceLabel(names)}</span>
      </button>
      {open ? (
        <AudienceSheet
          sections={[{ title: 'Pools', linked, unlinked }]}
          shared={shared}
          onToggle={onToggle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Where a post is shared, as switches. Sections, so a *Followers* row can
 * join *Pools* later without reshaping this; only Pools is built.
 */
function AudienceSheet({
  sections,
  shared,
  onToggle,
  onClose,
}: {
  sections: { title: string; linked: Row[]; unlinked: Row[] }[];
  shared: string[];
  onToggle: (poolId: string, on: boolean) => void;
  onClose: () => void;
}) {
  return (
    <PoolSheet label="Audience" onClose={onClose}>
      <SheetTitle>Audience</SheetTitle>
      <p className="text-pool-500 -mt-2 mb-5 text-sm">
        Every ripple on this splash follows it. With every switch off, it is yours alone.
      </p>
      {sections.map((section) => (
        <section key={section.title} data-audience-section={section.title} className="mb-6">
          <h3 className="text-pool-500 mb-1 text-xs">{section.title}</h3>
          <ul className="flex flex-col">
            {section.linked.map((row) => (
              <li
                key={row.poolId}
                data-audience-row={row.poolId}
                className="border-pool-100 flex items-center justify-between gap-4 border-b py-3"
              >
                <span className="text-ink min-w-0 truncate">Shared to {row.name}</span>
                <Switch
                  on={shared.includes(row.poolId)}
                  onChange={(on) => onToggle(row.poolId, on)}
                  label={`Shared to ${row.name}`}
                />
              </li>
            ))}
            {section.unlinked.map((row) => (
              <li
                key={row.poolId}
                data-audience-unlinked={row.poolId}
                className="border-pool-100 flex items-center justify-between gap-4 border-b py-3 text-sm"
              >
                <span className="text-pool-500 min-w-0 truncate">Not linked in {row.name}</span>
                <Link
                  href={`/pool/${row.poolId}/settings`}
                  className="text-main-900 shrink-0 font-semibold"
                >
                  Lane settings
                </Link>
              </li>
            ))}
            {section.linked.length + section.unlinked.length === 0 ? (
              <li className="text-pool-500 py-3 text-sm">You are in no Pool yet.</li>
            ) : null}
          </ul>
        </section>
      ))}
    </PoolSheet>
  );
}
