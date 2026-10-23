import { initialsOf } from '@/features/home/grid';
import type { Splash } from '@/features/splash/summary';
import type { Database } from '@/lib/database.types';
import type { DuringClient } from '@/lib/queries/profile';

export type PoolRow = Database['public']['Tables']['pools']['Row'];
export type PoolLane = Database['public']['Tables']['pool_lanes']['Row'];
export type PoolInvite = Database['public']['Tables']['pool_invites']['Row'];
type RippleRow = Database['public']['Tables']['ripples']['Row'];

/** A ripple as a pool reads it: no category (that is the author's own vocabulary). */
export type PoolRipple = Pick<
  RippleRow,
  | 'id'
  | 'author_id'
  | 'splash_id'
  | 'note'
  | 'media'
  | 'occurred_on'
  | 'occurred_time'
  | 'ended_at'
  | 'created_at'
  | 'category_id'
>;

export type PoolMember = {
  userId: string;
  name: string;
  initials: string;
  joinedAt: string;
  /** Left, and chose to keep their records here: labelled "Former member". */
  former: boolean;
};

/** A pool in the switcher: who is in it, and when something last happened there. */
export type MyPool = {
  id: string;
  name: string;
  kind: PoolRow['kind'];
  members: PoolMember[];
  /** The latest thing someone else put here, for the "new since my last visit" dot. */
  latestActivity: string | null;
};

export type Placement = {
  splashId: string;
  poolId: string;
  poolLaneId: string;
  shared: boolean;
};

export type PoolView = {
  pool: Pick<PoolRow, 'id' | 'name' | 'kind'>;
  /** Current members, me first then join order (D7), then former members who kept theirs. */
  members: PoolMember[];
  lanes: PoolLane[];
  /** My links only: a member never reads another's (RLS). */
  myLinks: { poolLaneId: string; myCategoryId: string }[];
  placements: (Placement & { ownerId: string })[];
  /** Placed posts and joint splashes, as RLS lets me see them. */
  splashes: Splash[];
  ripples: PoolRipple[];
  invites: PoolInvite[];
};

const RIPPLE_COLUMNS =
  'id, author_id, splash_id, note, media, occurred_on, occurred_time, ended_at, created_at, category_id';

type MemberRow = {
  pool_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  keep_on_leave: boolean | null;
  profile: { display_name: string } | null;
};

function toMember(row: MemberRow): PoolMember {
  const name = row.profile?.display_name ?? 'Someone';
  return {
    userId: row.user_id,
    name,
    initials: initialsOf(name),
    joinedAt: row.joined_at,
    former: row.left_at !== null,
  };
}

/** Me first, then join order (D7); former members last, never as columns. */
export function orderMembers(members: PoolMember[], me: string): PoolMember[] {
  return [...members].sort(
    (a, b) =>
      Number(a.former) - Number(b.former) ||
      Number(b.userId === me) - Number(a.userId === me) ||
      a.joinedAt.localeCompare(b.joinedAt),
  );
}

async function membersOf(supabase: DuringClient, poolIds: string[]): Promise<MemberRow[]> {
  if (poolIds.length === 0) return [];
  const { data, error } = await supabase
    .from('pool_members')
    .select('pool_id, user_id, joined_at, left_at, keep_on_leave, profile:profiles(display_name)')
    .in('pool_id', poolIds)
    .returns<MemberRow[]>();
  if (error) throw error;
  // A member who left and removed theirs is not shown at all.
  return data.filter((row) => row.left_at === null || row.keep_on_leave === true);
}

/** Every pool I am in now, most recently joined first. */
export async function getMyPools(supabase: DuringClient, me: string): Promise<MyPool[]> {
  const { data: mine, error } = await supabase
    .from('pool_members')
    .select('pool_id, joined_at, pool:pools(id, name, kind)')
    .eq('user_id', me)
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .returns<
      { pool_id: string; joined_at: string; pool: Pick<PoolRow, 'id' | 'name' | 'kind'> }[]
    >();
  if (error) throw error;
  const ids = mine.map((row) => row.pool_id);
  if (ids.length === 0) return [];

  const [members, placements, joints] = await Promise.all([
    membersOf(supabase, ids),
    supabase
      .from('splash_placements')
      .select('pool_id, splash_id')
      .in('pool_id', ids)
      .eq('shared', true),
    supabase.from('splashes').select('id, pool_id').in('pool_id', ids).is('owner_id', null),
  ]);
  if (placements.error) throw placements.error;
  if (joints.error) throw joints.error;

  // What happened there: the newest ripple someone else wrote on anything
  // placed or joint in the pool.
  const poolOf = new Map<string, string>();
  for (const p of placements.data) poolOf.set(p.splash_id, p.pool_id);
  for (const j of joints.data) if (j.pool_id) poolOf.set(j.id, j.pool_id);
  const latest = new Map<string, string>();
  if (poolOf.size > 0) {
    const { data: ripples, error: rippleError } = await supabase
      .from('ripples')
      .select('splash_id, created_at')
      .in('splash_id', [...poolOf.keys()])
      .neq('author_id', me);
    if (rippleError) throw rippleError;
    for (const r of ripples) {
      const pool = r.splash_id ? poolOf.get(r.splash_id) : undefined;
      if (!pool) continue;
      const seen = latest.get(pool);
      if (!seen || r.created_at > seen) latest.set(pool, r.created_at);
    }
  }

  return mine.map((row) => ({
    id: row.pool.id,
    name: row.pool.name,
    kind: row.pool.kind,
    members: orderMembers(
      members.filter((m) => m.pool_id === row.pool_id && m.left_at === null).map(toMember),
      me,
    ),
    latestActivity: latest.get(row.pool_id) ?? null,
  }));
}

/** One pool as its home reads it. Null when I am not a current member (RLS shows nothing). */
export async function getPoolView(
  supabase: DuringClient,
  poolId: string,
  me: string,
): Promise<PoolView | null> {
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, name, kind')
    .eq('id', poolId)
    .maybeSingle();
  if (error) throw error;
  if (!pool) return null;

  const [members, lanes, links, placements, joints, invites] = await Promise.all([
    membersOf(supabase, [poolId]),
    supabase.from('pool_lanes').select('*').eq('pool_id', poolId).order('position'),
    supabase
      .from('lane_mappings')
      .select('pool_lane_id, my_category_id')
      .eq('pool_id', poolId)
      .eq('user_id', me),
    supabase
      .from('splash_placements')
      .select('splash_id, pool_id, pool_lane_id, shared, splash:splashes(*)')
      .eq('pool_id', poolId)
      .returns<
        {
          splash_id: string;
          pool_id: string;
          pool_lane_id: string;
          shared: boolean;
          splash: Splash | null;
        }[]
      >(),
    supabase.from('splashes').select('*').eq('pool_id', poolId).is('owner_id', null),
    supabase
      .from('pool_invites')
      .select('*')
      .eq('pool_id', poolId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);
  for (const result of [lanes, links, placements, joints, invites]) {
    if (result.error) throw result.error;
  }

  // My own switched-off placements come back to me (I am their author); the
  // pool shows only what is shared, to me as to everyone.
  const shown = (placements.data ?? []).filter((p) => p.shared && p.splash);
  const splashes: Splash[] = [...shown.map((p) => p.splash!), ...(joints.data ?? [])];
  const splashIds = splashes.map((s) => s.id);

  let ripples: PoolRipple[] = [];
  if (splashIds.length > 0) {
    const { data, error: rippleError } = await supabase
      .from('ripples')
      .select(RIPPLE_COLUMNS)
      .in('splash_id', splashIds)
      .is('parent_ripple_id', null);
    if (rippleError) throw rippleError;
    // RLS already hides everyone else's locked blocks; mine come back to me
    // as their author, and a pool shows me what it shows the others.
    const mineIds = data.filter((r) => r.author_id === me).map((r) => r.id);
    const locked = new Set<string>();
    if (mineIds.length > 0) {
      const { data: locks } = await supabase
        .from('ripple_audience')
        .select('ripple_id')
        .eq('target_type', 'lock')
        .in('ripple_id', mineIds);
      for (const row of locks ?? []) locked.add(row.ripple_id);
    }
    ripples = data.filter((r) => !locked.has(r.id));
  }

  return {
    pool,
    members: orderMembers(members.map(toMember), me),
    lanes: lanes.data ?? [],
    myLinks: (links.data ?? []).map((l) => ({
      poolLaneId: l.pool_lane_id,
      myCategoryId: l.my_category_id,
    })),
    placements: shown.map((p) => ({
      splashId: p.splash_id,
      poolId: p.pool_id,
      poolLaneId: p.pool_lane_id,
      shared: p.shared,
      ownerId: p.splash!.owner_id ?? '',
    })),
    splashes,
    ripples,
    invites: invites.data ?? [],
  };
}

/**
 * Every link of mine across my pools, with the pool's name: what the
 * composer's Audience chip defaults from (a lane is shared to every pool it
 * is linked in) and what Home's monogram chips name.
 */
export type MyLink = {
  myCategoryId: string;
  poolId: string;
  poolName: string;
  poolLaneId: string;
};

export async function getMyLinks(supabase: DuringClient, me: string): Promise<MyLink[]> {
  const { data, error } = await supabase
    .from('lane_mappings')
    .select('my_category_id, pool_id, pool_lane_id, pool:pools(name)')
    .eq('user_id', me)
    .returns<
      {
        my_category_id: string;
        pool_id: string;
        pool_lane_id: string;
        pool: { name: string } | null;
      }[]
    >();
  if (error) throw error;
  // A pool I have left is unreadable, so its links drop out here.
  return data
    .filter((row) => row.pool)
    .map((row) => ({
      myCategoryId: row.my_category_id,
      poolId: row.pool_id,
      poolName: row.pool!.name,
      poolLaneId: row.pool_lane_id,
    }));
}

/** My posts' placements in pools I am in now, switched on or off. */
export async function getMyPlacements(supabase: DuringClient, me: string): Promise<Placement[]> {
  const { data, error } = await supabase
    .from('splash_placements')
    .select(
      'splash_id, pool_id, pool_lane_id, shared, splash:splashes!inner(owner_id), pool:pools(id)',
    )
    .eq('splash.owner_id', me)
    .returns<
      {
        splash_id: string;
        pool_id: string;
        pool_lane_id: string;
        shared: boolean;
        pool: { id: string } | null;
      }[]
    >();
  if (error) throw error;
  return data
    .filter((row) => row.pool)
    .map((row) => ({
      splashId: row.splash_id,
      poolId: row.pool_id,
      poolLaneId: row.pool_lane_id,
      shared: row.shared,
    }));
}

/** Joint splashes I have written in, for Home (H23): my ripples on them show there. */
export async function getJointSplashes(supabase: DuringClient, ids: string[]): Promise<Splash[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('splashes')
    .select('*')
    .in('id', ids)
    .is('owner_id', null);
  if (error) throw error;
  return data;
}
