'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { cardDate, type Card } from '@/features/home/grid';
import { monthName } from '@/features/home/scope';
import { monthKey } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { saveLane } from './actions';
import { EmojiInput } from './emoji-input';

/**
 * A lane's page (round 3): a breadcrumb, Home / the lane; where Home has
 * the avatar, the lane's emoji large with its name under it; then every
 * post on the lane as a pill — the date at the left, the title — newest
 * first, grouped by month under a small label. A pill opens the post's
 * page, which comes back here.
 *
 * Tapping the emoji or the name edits them in place — the emoji as the
 * one-grapheme field, the name as text — with Save and Cancel, shown at
 * once (CLAUDE.md, the principle). Deleting and reordering lanes stay in
 * lane management, linked at the foot.
 */
export function LanePage({ lane, cards }: { lane: MyCategory; cards: Card[] }) {
  const saved = useOptimisticAction({ name: lane.name, icon: lane.icon ?? '' });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lane.name);
  const [icon, setIcon] = useState(lane.icon ?? '');

  function start(): void {
    setName(saved.value.name);
    setIcon(saved.value.icon);
    setEditing(true);
  }
  function save(): void {
    const next = { name: name.trim(), icon: icon.trim() };
    if (!next.name || !next.icon) return;
    setEditing(false);
    saved.run(
      () => next,
      () => saveLane({ id: lane.id, name: next.name, icon: next.icon }),
    );
  }

  const months: { month: string; cards: Card[] }[] = [];
  for (const card of cards) {
    const month = monthKey(card.day);
    const last = months[months.length - 1];
    if (last && last.month === month) last.cards.push(card);
    else months.push({ month, cards: [card] });
  }
  const here = `/lane/${lane.id}`;

  return (
    <div
      data-lane-page={lane.id}
      className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-10"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
    >
      <nav aria-label="Breadcrumb" data-breadcrumb className="flex items-center gap-1 text-sm">
        <Link href="/" className="font-medium text-white">
          Home
        </Link>
        <ChevronRight aria-hidden size={14} className="text-white/50" />
        <span className="text-white/70">{saved.value.name}</span>
      </nav>

      <header className="flex flex-col items-center gap-2 pt-6 pb-8">
        {editing ? (
          <div data-lane-edit className="flex w-full flex-col items-center gap-3">
            <EmojiInput value={icon} onChange={setIcon} label="Lane icon" />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Lane name"
              maxLength={24}
              className="text-ink w-full max-w-60 rounded-full bg-white px-4 py-2 text-center text-base outline-none"
            />
            <span className="flex gap-4 text-sm">
              <button
                type="button"
                onClick={save}
                disabled={!name.trim() || !icon.trim()}
                className="text-main-900 rounded-full bg-white px-4 py-1.5 font-semibold disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-white/70">
                Cancel
              </button>
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-label="Edit the lane icon"
              data-lane-emoji
              onClick={start}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-5xl/none"
            >
              {saved.value.icon}
            </button>
            <button
              type="button"
              aria-label="Edit the lane name"
              data-lane-name
              onClick={start}
              className="text-xl font-semibold text-white"
            >
              {saved.value.name}
            </button>
          </>
        )}
        {saved.message ? (
          <p role="alert" className="text-sm text-white/80">
            {saved.message}
          </p>
        ) : null}
      </header>

      {months.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/60">Nothing on this lane yet.</p>
      ) : (
        <div data-lane-posts className="flex flex-col gap-6">
          {months.map(({ month, cards: inMonth }) => (
            <section key={month} className="flex flex-col gap-2">
              <h2 data-lane-month className="text-[11px] font-medium text-white/60">
                {monthName(month)} {month.slice(0, 4)}
              </h2>
              <ol className="flex flex-col gap-1.5">
                {inMonth.map((card) => {
                  const title = card.splash.title.trim() || card.splash.ghostTitle || 'Untitled';
                  return (
                    <li key={card.splash.id}>
                      <Link
                        href={`/splash/${card.splash.id}?from=${encodeURIComponent(here)}`}
                        data-lane-post={card.splash.id}
                        className="text-ink flex items-center gap-3 rounded-full bg-white py-2 pr-4 pl-4"
                      >
                        <span className="text-pool-500 w-24 shrink-0 text-xs tabular-nums">
                          {cardDate(card.day)}
                        </span>
                        <span aria-hidden className="shrink-0 text-base/none">
                          {saved.value.icon}
                        </span>
                        <span
                          className={`min-w-0 truncate text-sm font-semibold ${
                            card.splash.title.trim() ? '' : 'opacity-50'
                          }`}
                        >
                          {title}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <Link
        href="/?manage=lanes"
        data-manage-lanes-link
        className="mt-10 self-center text-sm text-white/70 underline-offset-4 hover:underline"
      >
        Manage lanes
      </Link>
    </div>
  );
}
