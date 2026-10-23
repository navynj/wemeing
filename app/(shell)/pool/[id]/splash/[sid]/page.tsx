import { notFound, redirect } from 'next/navigation';

import { initialsOf } from '@/features/home/grid';
import { PoolSplashPage } from '@/features/pool/pool-splash-page';
import { dayOf } from '@/lib/flow-key';
import { signRippleMedia } from '@/lib/media';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { getPoolView } from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * A post in a pool (H23): placed or joint, as the pool reads it. RLS
 * decides: a post not shared here, or a pool I am not in, is not found.
 */
export default async function PoolSplashRoute({ params }: PageProps<'/pool/[id]/splash/[sid]'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');
  const { id, sid } = await params;
  const [view, categories] = await Promise.all([
    getPoolView(supabase, id, profile.id),
    getMyCategories(supabase),
  ]);
  const splash = view?.splashes.find((s) => s.id === sid);
  if (!view || !splash) notFound();

  const initials = new Map(view.members.map((m) => [m.userId, m.initials]));
  const blocks = view.ripples
    .filter((r) => r.splash_id === sid)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photos = await Promise.all(
    blocks.map((r) => (r.media.length > 0 ? signRippleMedia(r.id) : Promise.resolve([]))),
  );
  const placement = view.placements.find((p) => p.splashId === sid);
  const laneId = splash.pool_lane_id ?? placement?.poolLaneId ?? null;
  const lane = view.lanes.find((l) => l.id === laneId) ?? null;
  const joint = splash.owner_id === null;
  const opener = joint ? view.members.find((m) => m.userId === splash.created_by) : undefined;

  return (
    <PoolSplashPage
      poolId={id}
      poolName={view.pool.name}
      splashId={sid}
      title={splash.title}
      icon={splash.icon ?? lane?.icon ?? null}
      lane={lane ? { icon: lane.icon, name: lane.name } : null}
      joint={joint ? { openedBy: opener?.name ?? null } : null}
      mine={splash.owner_id === profile.id}
      entries={blocks.map((r, at) => ({
        id: r.id,
        initials: initials.get(r.author_id) ?? '',
        note: r.note,
        photos: photos[at],
        day: dayOf({ ...r, splash: { declared_start: splash.declared_start } }, profile.timezone),
      }))}
      myInitials={initialsOf(profile.display_name)}
      myLane={
        joint
          ? (view.myLinks.find((l) => l.poolLaneId === splash.pool_lane_id)?.myCategoryId ?? null)
          : null
      }
      categories={categories}
      today={todayIn(profile.timezone)}
    />
  );
}
