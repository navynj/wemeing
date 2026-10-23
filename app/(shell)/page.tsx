import { redirect } from 'next/navigation';

import {
  byNewest,
  initialsOf,
  placeCard,
  type Card,
  type CardRipple,
  ownPoolColumn,
  type GridColumn,
} from '@/features/home/grid';
import { HomeGround } from '@/features/home/home-ground';
import { scopedMonth } from '@/features/home/scope';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { withPoolBadge } from '@/features/pool/home-badge';
import {
  getJointSplashes,
  getMyOriginTags,
  getMyPlacements,
  getMyPoolNames,
} from '@/lib/queries/pools';
import { getMySplashes, summarizeSplashes } from '@/lib/queries/splashes';
import { getMyTrail } from '@/lib/queries/trail';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * Home (SPEC 5, H22): the water ground — the lane grid or the date list
 * above, the diving board below. Placed by day; not a feed — nothing anyone
 * else wrote arrives on it. The whole archive comes down at once (one
 * person's few months); the grid renders days as they are scrolled to.
 *
 * `?m=YYYY-MM` opens on that month's newest post; `?top=<id>` opens with
 * that post on top — where a post's page sends Home back to (review);
 * `?manage=lanes` opens lane management, from a lane page.
 */
export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);

  // The proxy guarantees a session; a missing profile means the bootstrap did
  // not complete, so send the visitor back through it.
  if (!profile) redirect('/sign-in');

  const now = new Date();
  const today = todayIn(profile.timezone);
  const params = await searchParams;
  const one = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;
  const requested = one(params.m);
  const month = requested ? scopedMonth(requested, today) : null;

  const [ripples, categories, mine, pools, originTags] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
    getMyPoolNames(supabase, profile.id),
    getMyOriginTags(supabase, profile.id),
  ]);
  // My ripples on joint splashes show here too (H23): the splash, with only
  // my ripples on it, at my ripple's lane. One I can no longer read (a pool
  // I left) still shows its ripples, as posts of one.
  const mineIds = new Set(mine.map((s) => s.id));
  const joints = await getJointSplashes(supabase, [
    ...new Set(
      ripples.flatMap((r) => (r.splash_id && !mineIds.has(r.splash_id) ? [r.splash_id] : [])),
    ),
  ]);
  const boards = [...mine, ...joints];
  const summaries = summarizeSplashes(boards, ripples, profile.timezone, now);
  const poolName = new Map(pools.map((p) => [p.id, p.name]));
  const jointPool = new Map(joints.map((j) => [j.id, j.pool_id!]));

  // Just mine (0014): a column per pool after my lanes, headed by the pool's
  // monogram and name — "A pool you left" with a neutral tile once I cannot
  // read it — and each mark showing its pool lane's emoji while I can.
  const ownPools = [...new Set(mine.flatMap((s) => (s.own_pool_id ? [s.own_pool_id] : [])))];
  const ownLaneIcon = new Map<string, string | null>();
  if (ownPools.length > 0) {
    const placed = await getMyPlacements(supabase, profile.id);
    const laneOf = new Map(placed.map((p) => [p.splashId, p.poolLaneId]));
    const { data: lanes } = await supabase
      .from('pool_lanes')
      .select('id, icon')
      .in('id', [...new Set(placed.map((p) => p.poolLaneId))]);
    const iconOf = new Map((lanes ?? []).map((l) => [l.id, l.icon]));
    for (const s of mine) {
      const lane = laneOf.get(s.id);
      if (s.own_pool_id && lane) ownLaneIcon.set(s.id, iconOf.get(lane) ?? null);
    }
  }
  const poolColumns: GridColumn[] = ownPools.map((id) => {
    const name = poolName.get(id);
    return {
      id: ownPoolColumn(id),
      name: name ?? 'A pool you left',
      icon: null,
      monogram: name ?? '',
      href: null,
    };
  });

  // A card's ripples: its blocks with words, oldest first. A lone block's is its own.
  const threads = new Map<string, CardRipple[]>();
  for (const ripple of [...ripples].reverse()) {
    if (!ripple.note) continue;
    const key = ripple.splash_id ?? ripple.id;
    const entry = { id: ripple.id, note: ripple.note, createdAt: ripple.created_at };
    const list = threads.get(key);
    if (list) list.push(entry);
    else threads.set(key, [entry]);
  }
  const cards: Card[] = summaries
    .map((summary) => {
      const thread = threads.get(summary.id) ?? [];
      const card = placeCard(
        summary,
        thread.map((r) => r.note).join('\n\n'),
        profile.timezone,
        thread,
      );
      if (summary.ownPoolId) {
        // No badge: the column header says where it lives.
        return {
          ...card,
          lane: {
            icon: ownLaneIcon.get(summary.id) ?? null,
            name: poolName.get(summary.ownPoolId) ?? 'A pool you left',
          },
        };
      }
      return withPoolBadge(card, jointPool, poolName);
    })
    // Where each is or was in a pool, on its card (0015).
    .map((card) => {
      const tags = originTags.get(card.splash.id);
      return tags ? { ...card, origins: tags } : card;
    })
    .sort(byNewest);
  const pinned = summaries
    .filter((s) => s.pinnedAt !== null && !jointPool.has(s.id))
    .sort((a, b) => b.pinnedAt!.localeCompare(a.pinnedAt!));

  return (
    // Exactly the dynamic viewport: the grid scrolls inside it, the stack
    // stays put above the safe area.
    <main className="water-ground flex h-dvh min-h-0 flex-col">
      <HomeGround
        cards={cards}
        pinned={pinned}
        categories={categories}
        today={today}
        timeZone={profile.timezone}
        initials={initialsOf(profile.display_name)}
        scrollToMonth={month}
        topParam={one(params.top) ?? null}
        manageLanes={one(params.manage) === 'lanes'}
        poolColumns={poolColumns}
      />
    </main>
  );
}
