import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { asAdmin, asUser } from './as-user';

/**
 * Adding a ripple to a joint splash from the pool's splash page (0016,
 * 0017): `commitRipple` files it under my lane linked to the splash's pool
 * lane when the link brings in (↔ both, ← in), and under no lane when it
 * only sends out (→) or there is no link — whatever lane the editor offered.
 *
 * The real action against the real schema, as a throwaway member. Needs the
 * local stack; excluded from the CI config like every DB test.
 */
// Real v4 ids: the action's zod schema refuses the fixtures' all-zero pattern.
const ANA_TRIPS = crypto.randomUUID();
const ANA_OTHER = crypto.randomUUID();

let ana: string;
let pool: string;
let trips: string;
let days: string;
const joints: string[] = [];

const as = vi.hoisted(() => ({ user: '' }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/lib/supabase/server', async () => {
  const { asUser: client } = await import('./as-user');
  return {
    createClient: async () => {
      const supabase = client(as.user);
      // A minted token has no GoTrue session behind it; the action only needs the id.
      supabase.auth.getUser = (async () => ({
        data: { user: { id: as.user } },
        error: null,
      })) as unknown as typeof supabase.auth.getUser;
      return supabase;
    },
  };
});

import { commitRipple } from '@/features/input-sheet/commit';

beforeAll(async () => {
  const admin = asAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: `joint-lane-${Date.now()}@during.today`,
    email_confirm: true,
  });
  if (error) throw error;
  ana = data.user.id;
  as.user = ana;
  await admin
    .from('profiles')
    .insert({ id: ana, display_name: 'Ana', timezone: 'America/Vancouver' });
  await admin.from('my_categories').insert([
    { id: ANA_TRIPS, user_id: ana, name: 'Trips', icon: '•' },
    { id: ANA_OTHER, user_id: ana, name: 'Other', icon: '•' },
  ]);
  const made = await asUser(ana).rpc('create_pool', {
    p_name: 'Joint lanes',
    p_kind: null as unknown as 'friends',
    p_lanes: [
      { name: 'Trips', icon: '🏕', my_category_id: ANA_TRIPS },
      { name: 'Days', icon: '📓', my_category_id: null },
    ],
    p_include_history: false,
  });
  if (made.error) throw made.error;
  pool = made.data!;
  const lanes = (await asUser(ana).from('pool_lanes').select('id, name').eq('pool_id', pool)).data!;
  trips = lanes.find((l) => l.name === 'Trips')!.id;
  days = lanes.find((l) => l.name === 'Days')!.id;
});

afterAll(async () => {
  const admin = asAdmin();
  if (ana) await admin.from('ripples').delete().eq('author_id', ana);
  if (joints.length) await admin.from('splashes').delete().in('id', joints);
  if (pool) await admin.from('pools').delete().eq('id', pool);
  if (ana) await admin.auth.admin.deleteUser(ana);
});

/** Links Trips in `direction`, opens a joint splash on `poolLane`, adds a ripple from its page. */
async function addTo(poolLane: 'trips' | 'days', direction: 'both' | 'in' | 'out') {
  const linked = await asUser(ana).rpc('set_lane_links', {
    p_pool: pool,
    p_links: [{ pool_lane_id: trips, my_category_id: ANA_TRIPS, direction }],
  });
  expect(linked.error).toBeNull();
  const id = crypto.randomUUID();
  joints.push(id);
  const opened = await asUser(ana).rpc('create_joint_splash', {
    p_id: id,
    p_pool: pool,
    p_pool_lane: poolLane === 'trips' ? trips : days,
    p_title: `${poolLane} ${direction}`,
  });
  expect(opened.error).toBeNull();
  const done = await commitRipple({
    // The editor's lane chip: never what files a joint ripple.
    categoryId: ANA_OTHER,
    note: 'from the splash page',
    media: [],
    occurredOn: null,
    occurredTime: null,
    startInstant: null,
    endInstant: null,
    splashId: id,
  });
  expect(done).toMatchObject({ ok: true });
  const row = await asUser(ana)
    .from('ripples')
    .select('category_id')
    .eq('id', done.ok ? done.rippleId : '')
    .single();
  return row.data!.category_id;
}

describe('a ripple added to a joint splash', () => {
  it('↔ both: files under my linked lane', async () => {
    expect(await addTo('trips', 'both')).toBe(ANA_TRIPS);
  });

  it('← in: files under my linked lane', async () => {
    expect(await addTo('trips', 'in')).toBe(ANA_TRIPS);
  });

  it('→ out: files under no lane', async () => {
    expect(await addTo('trips', 'out')).toBeNull();
  });

  it('unlinked pool lane: files under no lane', async () => {
    expect(await addTo('days', 'both')).toBeNull();
  });
});
