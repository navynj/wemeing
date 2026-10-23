'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { OutlineChip } from '@/components/ui/chips/category-chip';
import { cardDate } from '@/features/home/grid';
import { RippleThread } from '@/features/splash/ripple-thread';
import { DETAIL_TITLE_CLASS } from '@/features/splash/splash-header';
import type { MyCategory } from '@/lib/queries/profile';
import type { IsoDate } from '@/lib/time';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { addJointRipple } from './actions';

export type PoolEntry = {
  id: string;
  initials: string;
  note: string | null;
  photos: string[];
  day: IsoDate;
  /** When it was written: in my zone, and in the author's when theirs differs (0013). */
  clock: { mine: string; theirs: string | null } | null;
};

/**
 * A post as a pool reads it (H23): the white page above the water, read
 * only — every ripple an entry in the thread with its author's initials.
 * My own placed post links to its page on my Home, where it is edited and
 * its audience set. A joint splash has an add slot at the foot: my ripple
 * goes on the pool's splash, filed under the lane of mine linked to its
 * pool lane, or one I pick when that lane is unlinked.
 */
export function PoolSplashPage({
  poolId,
  poolName,
  splashId,
  title,
  icon,
  lane,
  joint,
  mine,
  entries,
  myInitials,
  myLane,
  categories,
  today,
}: {
  poolId: string;
  poolName: string;
  splashId: string;
  title: string;
  icon: string | null;
  lane: { icon: string | null; name: string } | null;
  joint: { openedBy: string | null } | null;
  /** My own placed post: edit it on my page. */
  mine: boolean;
  entries: PoolEntry[];
  myInitials: string;
  /** The lane of mine linked to this joint splash's pool lane, if any. */
  myLane: string | null;
  categories: Pick<MyCategory, 'id' | 'name' | 'icon'>[];
  today: IsoDate;
}) {
  const thread = useOptimisticAction(entries);
  const [body, setBody] = useState('');
  const [laneId, setLaneId] = useState<string | null>(myLane);

  const add = (): void => {
    const note = body.trim();
    if (!note || !laneId) return;
    setBody('');
    thread.run(
      (current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          initials: myInitials,
          note,
          photos: [],
          day: today,
          clock: null,
        },
      ],
      () => addJointRipple({ splashId, poolId, myCategoryId: laneId, body: note }),
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-white px-6 pt-6 pb-16">
      <Link
        href={`/pool/${poolId}?top=${splashId}`}
        data-back-chip
        className="text-main-900 flex items-center gap-1.5 self-start text-sm font-medium"
      >
        <ArrowLeft aria-hidden size={16} />
        {poolName}
      </Link>

      <header className="mt-8 flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          {lane ? <OutlineChip icon={lane.icon} name={lane.name} /> : null}
          {joint ? (
            <span data-joint-label className="text-pool-500 text-xs">
              Joint splash{joint.openedBy ? ` · opened by ${joint.openedBy}` : ''}
            </span>
          ) : null}
        </span>
        <h1 className={`text-main-900 ${DETAIL_TITLE_CLASS} leading-tight`}>
          {icon ? <span aria-hidden>{icon} </span> : null}
          {title || 'Untitled'}
        </h1>
        {mine ? (
          <Link
            href={`/splash/${splashId}`}
            className="text-main-900 self-start text-sm font-semibold"
          >
            Edit on your page
          </Link>
        ) : null}
      </header>

      <RippleThread
        className="mt-10"
        initials=""
        entries={thread.value.map((entry) => ({
          id: entry.id,
          initials: entry.initials,
          meta: (
            <>
              {cardDate(entry.day)}
              {entry.clock ? ` · ${entry.clock.mine}` : null}
              {entry.clock?.theirs ? (
                <span data-author-clock className="text-pool-500/70 ml-1 text-[10px]">
                  · {entry.clock.theirs}
                </span>
              ) : null}
            </>
          ),
          body: (
            <span className="flex flex-col gap-3">
              {entry.note ? (
                <span className="text-ink text-base/relaxed whitespace-pre-wrap">{entry.note}</span>
              ) : null}
              {entry.photos.map((src) => (
                // Signed, short-lived URLs; next/image would cache them past their life.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="w-full rounded-2xl" />
              ))}
            </span>
          ),
        }))}
      />

      {thread.message ? (
        <p role="alert" className="text-pool-500 mt-4 text-sm">
          {thread.message}
        </p>
      ) : null}

      {joint ? (
        <div data-joint-add className="border-pool-100 mt-10 flex flex-col gap-3 border-t pt-6">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Drop your words here"
            rows={2}
            aria-label="Your ripple"
            className="text-ink placeholder:text-ink w-full resize-none text-base/relaxed outline-none placeholder:opacity-30"
          />
          <div className="flex items-center justify-between gap-3">
            {myLane ? (
              <span className="text-pool-500 text-xs">
                Filed under your {categories.find((c) => c.id === myLane)?.name ?? 'lane'} lane
              </span>
            ) : (
              <label className="text-pool-500 flex items-center gap-2 text-xs">
                Your lane
                <select
                  value={laneId ?? ''}
                  onChange={(event) => setLaneId(event.target.value || null)}
                  data-joint-lane
                  className="border-pool-200 text-ink h-9 rounded-lg border bg-white px-2 text-sm"
                >
                  <option value="">Pick one</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              data-joint-add-button
              disabled={!body.trim() || !laneId}
              onClick={add}
              className="bg-main-900 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
