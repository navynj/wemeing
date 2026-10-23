import { redirect } from 'next/navigation';

import { byNewest, initialsOf, placeCard, type Card, type CardRipple } from '@/features/home/grid';
import { HomeGround } from '@/features/home/home-ground';
import { scopedMonth } from '@/features/home/scope';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
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

  const [ripples, categories, boards] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
  ]);
  const summaries = summarizeSplashes(boards, ripples, profile.timezone, now);

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
      return placeCard(summary, thread.map((r) => r.note).join('\n\n'), profile.timezone, thread);
    })
    .sort(byNewest);
  const pinned = summaries
    .filter((s) => s.pinnedAt !== null)
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
      />
    </main>
  );
}
