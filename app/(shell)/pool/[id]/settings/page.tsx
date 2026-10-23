import { notFound, redirect } from 'next/navigation';

import { PoolSettings } from '@/features/pool/settings';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { getPoolView } from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/server';

/** Pool settings (H23): the invite link and my lane links. Members only. */
export default async function PoolSettingsPage({ params }: PageProps<'/pool/[id]/settings'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  if (!profile) redirect('/sign-in');
  const { id } = await params;
  const [view, categories] = await Promise.all([
    getPoolView(supabase, id, profile.id),
    getMyCategories(supabase),
  ]);
  if (!view) notFound();
  return <PoolSettings view={view} categories={categories} />;
}
