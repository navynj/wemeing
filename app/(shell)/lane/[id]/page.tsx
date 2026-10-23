import { notFound, redirect } from 'next/navigation';

import { byNewest, cardLane, placeCard } from '@/features/home/grid';
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
export default async function LaneRoute({ params }: PageProps<'/lane/[id]'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');

  const { id } = await params;
  const [ripples, categories, boards] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
  ]);
  const lane = categories.find((c) => c.id === id);
  if (!lane) notFound();

  const cards = summarizeSplashes(boards, ripples, profile.timezone, new Date())
    .filter((summary) => cardLane(summary) === id)
    .map((summary) => placeCard(summary, '', profile.timezone))
    .sort(byNewest);

  return (
    <main className="water-ground flex min-h-dvh flex-col">
      <LanePage lane={lane} cards={cards} />
    </main>
  );
}
