import { notFound, redirect } from 'next/navigation';

import { PoolGround } from '@/features/pool/pool-ground';
import { getMyProfile } from '@/lib/queries/profile';
import { getMyPools, getPoolView } from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * A pool's home (H23). RLS decides whether it exists for this viewer at all:
 * a pool I am not in now — never joined, or left — is not found.
 * `?top=<id>` opens with that post on top, where its page sends it back to.
 */
export default async function PoolPage({ params, searchParams }: PageProps<'/pool/[id]'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');
  const { id } = await params;
  const top = (await searchParams).top;

  const [view, pools] = await Promise.all([
    getPoolView(supabase, id, profile.id),
    getMyPools(supabase, profile.id),
  ]);
  if (!view) notFound();

  return (
    <main className="water-ground flex h-dvh min-h-0 flex-col">
      <PoolGround
        view={view}
        pools={pools}
        me={profile.id}
        today={todayIn(profile.timezone)}
        timeZone={profile.timezone}
        topParam={typeof top === 'string' ? top : null}
      />
    </main>
  );
}
