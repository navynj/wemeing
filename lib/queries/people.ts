import { signAvatars } from '@/lib/avatars';
import type { DuringClient } from '@/lib/queries/profile';

/** A face: a name for the initials, and a signed photo when there is one I may see. */
export type Person = { name: string; photo: string | null };

/**
 * Everyone whose face the shell may draw: me, and the people RLS lets me
 * read — pool companions, current and former (0010). Photos only for those
 * `visible_avatars` allows; the rest are their initials.
 */
export async function getPeople(supabase: DuringClient): Promise<Record<string, Person>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_version');
  if (error) throw error;
  const photos = await signAvatars(
    supabase,
    data.map((row) => ({ id: row.id, version: row.avatar_version })),
  );
  return Object.fromEntries(
    data.map((row) => [row.id, { name: row.display_name, photo: photos[row.id] ?? null }]),
  );
}
