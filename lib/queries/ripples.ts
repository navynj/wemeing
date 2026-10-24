import type { Database } from '@/lib/database.types';
import type { DuringClient } from '@/lib/queries/profile';
import type { IsoDate } from '@/lib/time';

export type Ripple = Database['public']['Tables']['ripples']['Row'];

/**
 * A block with the category it is displayed as — SPEC 7's format is
 * `category · note`, so the badge and the row arrive together — and the
 * post it composes, because an unannotated block rests at its post's
 * declared date (H21f) and the key cannot be computed without it.
 */
export type RippleWithCategory = Ripple & {
  category: { name: string; icon: string | null } | null;
  splash?: { declared_start: string | null; title: string } | null;
};

export const WITH_CATEGORY =
  '*, category:my_categories(name, icon), splash:splashes(declared_start, title)';

/**
 * One author's day, top level only. Chronological top to bottom (H2), with
 * date-only records first: they belong to the day without claiming a position
 * on its axis and render in the Daily Note area above it (SPEC 5, H5).
 *
 * Dormant (H20b) with the paged day; kept for P3's Swim.
 *
 * The author filter narrows, it does not protect: RLS decides what a viewer
 * may see. Without it the same call would also return rows seen through my
 * pools, which is the pool's query, not the timeline's.
 */
export async function getRipplesForDate(
  supabase: DuringClient,
  authorId: string,
  occurredOn: IsoDate,
): Promise<RippleWithCategory[]> {
  const { data, error } = await supabase
    .from('ripples')
    .select(WITH_CATEGORY)
    .eq('author_id', authorId)
    .eq('occurred_on', occurredOn)
    .is('parent_ripple_id', null)
    .order('occurred_time', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .returns<RippleWithCategory[]>();

  if (error) throw error;
  return data;
}

export async function getMyRipplesForDate(
  supabase: DuringClient,
  occurredOn: IsoDate,
): Promise<RippleWithCategory[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return getRipplesForDate(supabase, user.id, occurredOn);
}

/**
 * Splits a day into its two regions. Date-only records belong to the day
 * without claiming a position on its axis, so they stack in the Daily Note
 * area (SPEC 5.3, H5) and never appear on the timeline. Dormant (H20b).
 */
export function splitByRegion(ripples: RippleWithCategory[]): {
  notes: RippleWithCategory[];
  timeline: RippleWithCategory[];
} {
  return {
    notes: ripples.filter((ripple) => ripple.occurred_time === null),
    timeline: ripples.filter((ripple) => ripple.occurred_time !== null),
  };
}
