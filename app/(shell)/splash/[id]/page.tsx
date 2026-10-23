import { notFound, redirect } from 'next/navigation';

import { initialsOf } from '@/features/home/grid';
import { originOf } from '@/features/splash/origin';
import { SplashPage } from '@/features/splash/splash-page';
import { summarizeOrphan, summarizeSplash } from '@/features/splash/summary';
import { flowInstant } from '@/lib/flow-key';
import { signOwnMedia } from '@/lib/media';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { SplashAudience } from '@/features/pool/splash-audience';
import { representativeLane } from '@/features/splash/summary';
import { getMyLinks, getMyPlacements, getMyPoolNames } from '@/lib/queries/pools';
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

  const [ripples, categories, boards, links, pools, placements] = await Promise.all([
    getMyTrail(supabase, profile.id, profile.timezone),
    getMyCategories(supabase),
    getMySplashes(supabase, profile.id),
    getMyLinks(supabase, profile.id),
    getMyPoolNames(supabase, profile.id),
    getMyPlacements(supabase, profile.id),
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
        audience={
          // Where this post is shared (H23): a switch per pool its lane is
          // linked in. A lone block has no post row to place yet.
          board && pools.length > 0
            ? (() => {
                const lane = summary.declaredLaneId ?? representativeLane(summary);
                const linkedIds = new Set(
                  links.filter((l) => l.myCategoryId === lane).map((l) => l.poolId),
                );
                return (
                  <SplashAudience
                    splashId={board.id}
                    shared={placements
                      .filter((p) => p.splashId === board.id && p.shared)
                      .map((p) => p.poolId)}
                    linked={pools
                      .filter((p) => linkedIds.has(p.id))
                      .map((p) => ({ poolId: p.id, name: p.name }))}
                    unlinked={pools
                      .filter((p) => !linkedIds.has(p.id))
                      .map((p) => ({ poolId: p.id, name: p.name }))}
                  />
                );
              })()
            : null
        }
      />
    </main>
  );
}
