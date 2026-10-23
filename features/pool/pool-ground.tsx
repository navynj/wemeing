'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Settings, Users } from 'lucide-react';

import { GroundFoot } from '@/features/home/ground-foot';
import type { Card } from '@/features/home/grid';
import { LaneGrid, type Ring } from '@/features/home/lane-grid';
import { LaneIcon } from '@/features/home/lane-icon';
import { PinnedCards } from '@/features/home/pinned-cards';
import { StairBoard } from '@/features/home/stair-board';
import { useFlip } from '@/features/home/use-flip';
import { SegmentedToggle } from '@/features/home/view-toggle';
import { useInputSheet } from '@/features/input-sheet/sheet-provider';
import { deleteSplash, setSplashPinned } from '@/features/splash/actions';
import type { MyPool, PoolView } from '@/lib/queries/pools';
import type { IsoDate } from '@/lib/time';
import { useOptimisticAction } from '@/lib/use-optimistic-action';

import { deleteJointSplash } from './actions';
import { InvitePanel } from './invite-panel';
import { MembersSheet } from './members-sheet';
import { poolCards, poolColumns, poolPinned, type PoolViewKind } from './pool-cards';
import { PoolLanesSheet } from './pool-lanes-sheet';
import { rememberVisit, usePoolView } from './remembered';
import { PoolSheet, SheetTitle } from './sheet';
import { PoolSwitcher } from './switcher';

const VIEWS = [
  { value: 'lane', label: 'Lane' },
  { value: 'date', label: 'Date' },
  { value: 'swimmers', label: 'Swimmers' },
] as const satisfies readonly { value: PoolViewKind; label: string }[];

/** How many members' initials the header shows before the `+`. */
const HEADER_AVATARS = 3;

type Sheet = 'switcher' | 'members' | 'invite' | 'lanes' | null;

/**
 * A pool's home (H23; `_docs/mockups/pool-home.png`, `pool-swimmers.png`):
 * the same water ground as Home, scoped to one pool. The header is the
 * pool's name with the switcher's chevron, the members' initials and a `+`
 * that opens the invite link, and the settings gear; beneath it the lane
 * glyph (the pool's lanes, any member edits them), the Lane | Date |
 * Swimmers toggle, and the members icon. Pinned cards and the stair stack
 * work as on Home: cards carry their author's initials, joint splashes are
 * bands with their ripples branching off. The foot is Home · Pool · +, and
 * compose from here defaults to this pool.
 */
export function PoolGround({
  view,
  pools,
  me,
  today,
  timeZone,
  topParam = null,
}: {
  view: PoolView;
  pools: MyPool[];
  me: string;
  today: IsoDate;
  timeZone: string;
  topParam?: string | null;
}) {
  const router = useRouter();
  const poolId = view.pool.id;
  const [kind, setKind] = usePoolView();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { openSheet, pendingDrop, clearDropped, pendingDeletes, markDeleted, dropMessage } =
    useInputSheet();

  // Opening a pool makes it the one the Pool tab opens, seen as of now.
  useEffect(() => rememberVisit(poolId), [poolId]);

  const cards = useMemo(() => poolCards(view, kind, me, timeZone), [view, kind, me, timeZone]);
  const columns = useMemo(() => poolColumns(view, kind), [view, kind]);

  // A post just dropped here is on the grid before the server has it.
  const dropHere = pendingDrop?.pool?.poolId === poolId ? pendingDrop.pool.card : null;
  const landed = dropHere !== null && cards.some((c) => c.splash.id === dropHere.splash.id);
  const shown = useMemo(() => {
    const kept = cards.filter((c) => !pendingDeletes.includes(c.splash.id));
    if (!dropHere || landed) return kept;
    return [{ ...dropHere, column: kind === 'swimmers' ? me : dropHere.column }, ...kept];
  }, [cards, pendingDeletes, dropHere, landed, kind, me]);
  useEffect(() => {
    if (!landed) return;
    const timer = window.setTimeout(clearDropped, 1800);
    return () => window.clearTimeout(timer);
  }, [landed, clearDropped]);

  const pinned = useOptimisticAction(poolPinned(cards, me, view));
  const pinnedIds = useMemo(() => new Set(pinned.value.map((c) => c.splash.id)), [pinned.value]);
  const pin = (card: Card, on: boolean): void =>
    pinned.run(
      (current) =>
        on
          ? [
              { ...card, splash: { ...card.splash, pinnedAt: new Date().toISOString() } },
              ...current,
            ]
          : current.filter((c) => c.splash.id !== card.splash.id),
      () => setSplashPinned(card.splash.id, on),
    );
  const remove = (card: Card): void => {
    markDeleted(card.splash.id);
    void (
      card.branches ? deleteJointSplash(poolId, card.splash.id) : deleteSplash(card.splash.id)
    ).then((result) => {
      if (result.ok) router.refresh();
    });
  };

  const ids = useMemo(() => shown.map((c) => c.splash.id), [shown]);
  const [initialTop] = useState(() =>
    topParam && ids.includes(topParam) ? topParam : (ids[0] ?? null),
  );
  const flip = useFlip(ids, initialTop, -1);
  const { heading, bringForward } = flip;

  const [ring, setRing] = useState<Ring | null>(() =>
    initialTop ? { id: initialTop, seq: 0 } : null,
  );
  const seq = useRef(0);
  const previous = useRef(heading);
  useEffect(() => {
    if (heading && heading !== previous.current) {
      seq.current += 1;
      setRing({ id: heading, seq: seq.current });
    }
    previous.current = heading;
  }, [heading]);
  const droppedId = dropHere?.splash.id ?? null;
  useEffect(() => {
    if (droppedId) bringForward(droppedId);
    // The drop is the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedId]);

  const waterIds = useMemo(() => new Set(ids.filter((id) => id !== heading)), [ids, heading]);
  const current = view.members.filter((m) => !m.former);
  const laneNames = view.lanes.map((l) => ({ id: l.id, name: l.name, icon: l.icon }));
  const pinnedStrip = (slot: 'phone' | 'wide') => (
    <PinnedCards
      slot={slot}
      cards={pinned.value}
      categories={laneNames}
      initials=""
      onPick={bringForward}
    />
  );

  return (
    <div data-pool-ground={poolId} className="water-ground flex min-h-0 flex-1 flex-col">
      <div
        className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col lg:max-w-7xl lg:flex-row lg:gap-8"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex min-h-0 flex-1 flex-col lg:min-w-0 lg:flex-1">
          <header data-pool-header className="flex shrink-0 items-center gap-2 px-4 pt-4">
            <button
              type="button"
              data-pool-switcher
              aria-label={`${view.pool.name}, switch Pool`}
              onClick={() => setSheet('switcher')}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-white"
            >
              <span data-pool-title className="truncate text-3xl/tight font-semibold">
                {view.pool.name}
              </span>
              <ChevronDown aria-hidden size={22} strokeWidth={2.5} className="shrink-0" />
            </button>
            <span className="flex shrink-0 items-center">
              {current.slice(0, HEADER_AVATARS).map((member, at) => (
                <span
                  key={member.userId}
                  aria-hidden
                  className={`text-main-900/60 ring-main-900 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-[10px] font-medium ring-2 ${
                    at > 0 ? '-ml-2' : ''
                  }`}
                >
                  {member.initials}
                </span>
              ))}
              <button
                type="button"
                aria-label="Invite"
                data-pool-invite
                onClick={() => setSheet('invite')}
                className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white"
              >
                <Plus aria-hidden size={16} />
              </button>
            </span>
            <Link
              href={`/pool/${poolId}/settings`}
              aria-label="Pool settings"
              data-pool-settings
              className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center text-white"
            >
              <Settings aria-hidden size={20} />
            </Link>
          </header>

          <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-6">
            <button
              type="button"
              aria-label="Pool lanes"
              data-manage-pool-lanes
              onClick={() => setSheet('lanes')}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
            >
              <LaneIcon size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <SegmentedToggle view={kind} onChange={setKind} options={VIEWS} />
            </div>
            <button
              type="button"
              aria-label="Members"
              data-pool-members
              onClick={() => setSheet('members')}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
            >
              <Users aria-hidden size={20} />
            </button>
          </div>

          {dropMessage || pinned.message ? (
            <p role="alert" className="shrink-0 px-6 pb-2 text-sm text-white/80">
              {dropMessage ?? pinned.message}
            </p>
          ) : null}

          {pinnedStrip('phone')}

          {shown.length === 0 ? (
            <p data-pool-empty className="px-6 pt-6 text-sm/relaxed text-white/80">
              Nothing in this Pool yet. Splashes in your connected lanes land here, and so do joint
              splashes anyone opens.
            </p>
          ) : null}

          <LaneGrid
            view={kind === 'date' ? 'date' : 'lane'}
            cards={shown}
            categories={columns}
            today={today}
            ring={ring}
            waterIds={waterIds}
            initials={null}
            scrollToMonth={null}
            onPick={bringForward}
          />
        </div>

        <div
          data-board-column
          className="flex shrink-0 flex-col lg:min-h-0 lg:min-w-0 lg:flex-1 lg:py-10"
        >
          {pinnedStrip('wide')}
          <StairBoard
            cards={shown}
            flip={flip}
            categories={laneNames}
            initials=""
            pinnedIds={pinnedIds}
            onPin={pin}
            onDelete={remove}
            hrefFor={(id) => shown.find((c) => c.splash.id === id)?.href ?? `/pool/${poolId}`}
          />
          <GroundFoot
            here="pool"
            onCompose={() =>
              openSheet({
                poolId,
                poolName: view.pool.name,
                lanes: view.lanes.map((lane) => ({
                  id: lane.id,
                  name: lane.name,
                  icon: lane.icon,
                  myCategoryId:
                    view.myLinks.find((l) => l.poolLaneId === lane.id)?.myCategoryId ?? null,
                })),
              })
            }
          />
        </div>
      </div>

      {sheet === 'switcher' ? (
        <PoolSwitcher pools={pools} currentId={poolId} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'members' ? (
        <MembersSheet
          poolId={poolId}
          members={view.members}
          me={me}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'lanes' ? (
        <PoolLanesSheet poolId={poolId} lanes={view.lanes} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'invite' ? (
        <PoolSheet label="Invite" onClose={() => setSheet(null)}>
          <SheetTitle>Invite to {view.pool.name}</SheetTitle>
          <InvitePanel poolId={poolId} invites={view.invites} />
        </PoolSheet>
      ) : null}
    </div>
  );
}
