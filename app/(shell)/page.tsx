import { redirect } from 'next/navigation';

import { byNewest, initialsOf, placeCard, type Card } from '@/features/home/grid';
import { HomeGround } from '@/features/home/home-ground';
import { scopedMonth } from '@/features/home/scope';
import { earliestYear } from '@/features/sessions/shelves';
import { monthKey } from '@/features/splash/summary';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { getMySessions } from '@/lib/queries/sessions';
import { getMySplashes, summarizeSplashes } from '@/lib/queries/splashes';
import { getMyTrail } from '@/lib/queries/trail';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * Home (SPEC 5, H22): the water ground — the lane grid above, the diving
 * board below. The same rows the Trail reads, placed by day here and cut by
 * day there; neither is a feed — nothing anyone else wrote arrives on it.
 * The whole archive comes down at once (one person's few months, as the
 * Trail reasons); the grid renders days as they are scrolled to.
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
  const requested = Array.isArray(params.m) ? params.m[0] : params.m;
  const month = requested ? scopedMonth(requested, today) : null;

  const [ripples, categories, boards, sessions] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
    getMySessions(supabase, profile.id),
  ]);
  const summaries = summarizeSplashes(boards, ripples, profile.timezone, now);

  // A card's body: its blocks' words, oldest first. A lone block's is its own.
  const words = new Map<string, string[]>();
  for (const ripple of [...ripples].reverse()) {
    const key = ripple.splash_id ?? ripple.id;
    if (!ripple.note) continue;
    const list = words.get(key);
    if (list) list.push(ripple.note);
    else words.set(key, [ripple.note]);
  }
  const cards: Card[] = summaries
    .map((summary) =>
      placeCard(summary, (words.get(summary.id) ?? []).join('\n\n'), profile.timezone),
    )
    .sort(byNewest);

  const counts: Record<string, number> = {};
  for (const card of cards) {
    const key = monthKey(card.day);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const customCounts: Record<string, number> = {};
  for (const summary of summaries) {
    if (summary.sessionId) {
      customCounts[summary.sessionId] = (customCounts[summary.sessionId] ?? 0) + 1;
    }
  }
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
        sessions={sessions}
        counts={counts}
        customCounts={customCounts}
        earliestYear={earliestYear(summaries, today, profile.timezone)}
        today={today}
        timeZone={profile.timezone}
        initials={initialsOf(profile.display_name)}
        scrollToMonth={month}
      />
    </main>
  );
}
