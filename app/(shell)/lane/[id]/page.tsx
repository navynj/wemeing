import { notFound, redirect } from 'next/navigation';

import { byNewest, cardLane, initialsOf, placeCard, type CardRipple } from '@/features/home/grid';
import { LanePage } from '@/features/lanes/lane-page';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { getMySplashes, summarizeSplashes } from '@/lib/queries/splashes';
import { getMyTrail } from '@/lib/queries/trail';
import { createClient } from '@/lib/supabase/server';

/**
 * A lane's page (round 3): opened from its header on Home's grid. RLS
 * decides whether the lane exists for this viewer; its posts are the ones
 * whose mark sits in its column.
 */
export default async function LaneRoute({ params, searchParams }: PageProps<'/lane/[id]'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');

  const { id } = await params;
  const top = (await searchParams).top;
  const [ripples, categories, boards] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
  ]);
  const lane = categories.find((c) => c.id === id);
  if (!lane) notFound();

  // Each card's ripples, oldest first, for the stack's thread.
  const threads = new Map<string, CardRipple[]>();
  for (const ripple of [...ripples].reverse()) {
    if (!ripple.note) continue;
    const key = ripple.splash_id ?? ripple.id;
    const entry = { id: ripple.id, note: ripple.note, createdAt: ripple.created_at };
    const list = threads.get(key);
    if (list) list.push(entry);
    else threads.set(key, [entry]);
  }
  const cards = summarizeSplashes(boards, ripples, profile.timezone, new Date())
    .filter((summary) => cardLane(summary) === id)
    .map((summary) => {
      const thread = threads.get(summary.id) ?? [];
      const card = placeCard(
        summary,
        thread.map((r) => r.note).join('\n\n'),
        profile.timezone,
        thread,
      );
      // My own splash carries the pencil; a post of one has no row to edit yet.
      return summary.orphan ? card : { ...card, editable: true };
    })
    .sort(byNewest);

  return (
    <main className="water-ground flex h-dvh min-h-0 flex-col">
      <LanePage
        lane={lane}
        cards={cards}
        categories={categories}
        initials={initialsOf(profile.display_name)}
        topParam={typeof top === 'string' ? top : null}
      />
    </main>
  );
}
