import { notFound, redirect } from 'next/navigation';

import { initialsOf } from '@/features/home/grid';
import { originOf } from '@/features/splash/origin';
import { SplashPage } from '@/features/splash/splash-page';
import { summarizeOrphan, summarizeSplash } from '@/features/splash/summary';
import { flowInstant } from '@/lib/flow-key';
import { signOwnMedia } from '@/lib/media';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { getMySplashes } from '@/lib/queries/splashes';
import { getMyTrail } from '@/lib/queries/trail';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * A post's page (SPEC 5, H21c): the white page above the water. Under Home
 * in the shell, so the tab bar keeps Home lit; RLS decides whether the post
 * exists for this viewer at all. A splashless block opens here too, as an
 * untitled post of one.
 */
export default async function SplashRoute({ params, searchParams }: PageProps<'/splash/[id]'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');

  const { id } = await params;
  const from = (await searchParams).from;
  const now = new Date();
  const today = todayIn(profile.timezone);

  const [ripples, categories, boards] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
  ]);

  const board = boards.find((b) => b.id === id) ?? null;
  const lone = board ? null : (ripples.find((r) => r.id === id && r.splash_id === null) ?? null);
  if (!board && !lone) notFound();

  const blocks = (board ? ripples.filter((r) => r.splash_id === id) : [lone!]).sort(
    (a, b) =>
      flowInstant(a, profile.timezone) - flowInstant(b, profile.timezone) ||
      a.created_at.localeCompare(b.created_at),
  );
  const summary = board
    ? summarizeSplash(board, blocks, profile.timezone, now)
    : summarizeOrphan(lone!, profile.timezone, now);

  const { data: lockRows } = await supabase
    .from('ripple_audience')
    .select('ripple_id')
    .eq('target_type', 'lock')
    .in(
      'ripple_id',
      blocks.length ? blocks.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000'],
    );

  // A photo that could not be signed is a placeholder, never a failed page.
  const signed = await signOwnMedia(blocks.flatMap((r) => r.media));
  const photos = Object.fromEntries(
    blocks
      .filter((r) => r.media.length > 0)
      .map((r) => [r.id, r.media.map((path) => signed[path] ?? null)]),
  );

  return (
    // Wide: the page takes both halves, the blocks on the right (review).
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 lg:max-w-5xl">
      <SplashPage
        splash={summary}
        blocks={blocks}
        photos={photos}
        lockedIds={(lockRows ?? []).map((row) => row.ripple_id)}
        categories={categories}
        origin={originOf(typeof from === 'string' ? from : undefined, today, categories)}
        timeZone={profile.timezone}
        today={today}
        initials={initialsOf(profile.display_name)}
      />
    </main>
  );
}
