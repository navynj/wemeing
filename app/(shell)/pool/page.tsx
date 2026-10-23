import { redirect } from 'next/navigation';

import { PoolIndex } from '@/features/pool/pool-index';
import { getMyProfile } from '@/lib/queries/profile';
import { createClient } from '@/lib/supabase/server';

/** The Pool tab (H23): which pool opens is the device's to say, so the page asks it. */
export default async function PoolTab() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');
  const { data, error } = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('user_id', profile.id)
    .is('left_at', null)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return <PoolIndex poolIds={data.map((row) => row.pool_id)} />;
}
