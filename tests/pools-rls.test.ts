import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asAdmin, asUser } from './as-user';

/**
 * The Pool path (H23), proved through PostgREST with real user tokens: the
 * service role bypasses RLS, which is the only thing under test.
 *
 * Three fresh people, none of them Linked, so nothing seen here can have
 * arrived by the Link path: Ana opens the pool, Ben joins it, Cal stays
 * outside. Everything they write goes with them in afterAll.
 *
 * Needs the local stack; excluded from the CI config like every DB test.
 */

const ANA_TRIPS = '0e000000-0000-0000-0000-0000000000a1';
const ANA_DAY = '0e000000-0000-0000-0000-0000000000a2';
const BEN_TRIPS = '0e000000-0000-0000-0000-0000000000b1';
const CAL_TRIPS = '0e000000-0000-0000-0000-0000000000c1';

const ANA_OLD_POST = '0e100000-0000-0000-0000-0000000000a1';
const ANA_DAY_POST = '0e100000-0000-0000-0000-0000000000a2';
const BEN_OLD_POST = '0e100000-0000-0000-0000-0000000000b1';

let ana: string;
let ben: string;
let cal: string;
let pool: string;
let token: string;
let tripsLane: string;
const pools: string[] = [];

async function person(name: string, lane: string): Promise<string> {
  const admin = asAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: `pool-${name.replace(/\W/g, '')}-${Date.now()}@during.today`,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;
  await admin.from('profiles').insert({ id, display_name: name, timezone: 'America/Vancouver' });
  await admin.from('my_categories').insert({ id: lane, user_id: id, name: 'Trips' });
  return id;
}

async function post(owner: string, id: string, lane: string, note: string): Promise<void> {
  const client = asUser(owner);
  const { error } = await client
    .from('splashes')
    .insert({ id, owner_id: owner, title: note, declared_lane_id: lane });
  expect(error).toBeNull();
  const { error: blockError } = await client
    .from('ripples')
    .insert({ author_id: owner, category_id: lane, note, splash_id: id });
  expect(blockError).toBeNull();
}

beforeAll(async () => {
  ana = await person('Ana Lee', ANA_TRIPS);
  ben = await person('Ben', BEN_TRIPS);
  cal = await person('Cal', CAL_TRIPS);
  await asAdmin().from('my_categories').insert({ id: ANA_DAY, user_id: ana, name: 'Day' });

  // Written before the pool exists: what "include my earlier records" is about.
  await post(ana, ANA_OLD_POST, ANA_TRIPS, 'Whistler');
  await post(ana, ANA_DAY_POST, ANA_DAY, 'a quiet day');
  await post(ben, BEN_OLD_POST, BEN_TRIPS, 'Squamish');

  const { data, error } = await asUser(ana).rpc('create_pool', {
    p_name: 'Weekend crew',
    p_kind: 'friends',
    p_lanes: [
      { name: 'Trips', icon: '🏕', description: 'Where we went', my_category_id: ANA_TRIPS },
      { name: 'Days', icon: '☀️', my_category_id: null },
    ],
    p_include_history: true,
  });
  expect(error).toBeNull();
  pool = data!;
  pools.push(pool);

  const lanes = await asUser(ana).from('pool_lanes').select('id, name').eq('pool_id', pool);
  tripsLane = lanes.data!.find((l) => l.name === 'Trips')!.id;

  const invite = await asUser(ana).rpc('create_invite', { p_pool: pool });
  expect(invite.error).toBeNull();
  token = invite.data![0].token;

  const join = await asUser(ben).rpc('join_pool', {
    p_token: token,
    p_links: [{ pool_lane_id: tripsLane, my_category_id: BEN_TRIPS }],
    p_include_history: false,
  });
  expect(join.error).toBeNull();
});

afterAll(async () => {
  const admin = asAdmin();
  // The pool first: it takes its lanes, members, links, placements and joint
  // splashes (with their ripples) with it.
  for (const id of pools) await admin.from('pools').delete().eq('id', id);
  for (const id of [ana, ben, cal].filter(Boolean)) {
    await admin.from('ripples').delete().eq('author_id', id);
    await admin.from('splashes').delete().eq('owner_id', id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe('outside the pool', () => {
  it('reads nothing at all', async () => {
    const client = asUser(cal);
    for (const table of [
      'pools',
      'pool_members',
      'pool_lanes',
      'splash_placements',
      'pool_invites',
      'lane_mappings',
    ] as const) {
      const { data } = await client.from(table).select('*');
      expect(data, table).toEqual([]);
    }
    const splashes = await client.from('splashes').select('id').in('owner_id', [ana, ben]);
    expect(splashes.data).toEqual([]);
    const ripples = await client.from('ripples').select('id').in('author_id', [ana, ben]);
    expect(ripples.data).toEqual([]);
  });

  it('cannot call the doors with a stranger’s pool', async () => {
    const { error } = await asUser(cal).rpc('create_invite', { p_pool: pool });
    expect(error?.code).toBe('42501');
  });
});

describe('placement', () => {
  it('places earlier posts in linked lanes when history is on, and only those', async () => {
    const { data } = await asUser(ben).from('splashes').select('id').eq('owner_id', ana);
    const ids = (data ?? []).map((s) => s.id);
    expect(ids).toContain(ANA_OLD_POST);
    // Ana's Day lane is not linked: her Day post stays hers alone.
    expect(ids).not.toContain(ANA_DAY_POST);
  });

  it('places nothing earlier when history is off', async () => {
    const { data } = await asUser(ana).from('splashes').select('id').eq('owner_id', ben);
    expect(data).toEqual([]);
  });

  it('shows a member the placed post’s blocks', async () => {
    const { data } = await asUser(ben).from('ripples').select('note').eq('splash_id', ANA_OLD_POST);
    expect(data).toEqual([{ note: 'Whistler' }]);
  });

  it('keeps every member’s lane links private', async () => {
    const { data } = await asUser(ben).from('lane_mappings').select('user_id');
    expect(new Set((data ?? []).map((m) => m.user_id))).toEqual(new Set([ben]));
  });

  it('refuses a placement in a pool lane the author never linked', async () => {
    const days = await asUser(ana).from('pool_lanes').select('id').eq('name', 'Days').single();
    const { error } = await asUser(ana)
      .from('splash_placements')
      .insert({ splash_id: ANA_DAY_POST, pool_id: pool, pool_lane_id: days.data!.id });
    expect(error?.code).toBe('42501');
  });

  it('switches one post off and on', async () => {
    const off = await asUser(ana)
      .from('splash_placements')
      .update({ shared: false })
      .eq('splash_id', ANA_OLD_POST)
      .eq('pool_id', pool);
    expect(off.error).toBeNull();
    const hidden = await asUser(ben).from('splashes').select('id').eq('id', ANA_OLD_POST);
    expect(hidden.data).toEqual([]);

    await asUser(ana)
      .from('splash_placements')
      .update({ shared: true })
      .eq('splash_id', ANA_OLD_POST)
      .eq('pool_id', pool);
    const shown = await asUser(ben).from('splashes').select('id').eq('id', ANA_OLD_POST);
    expect(shown.data).toHaveLength(1);
  });

  it('never shows a locked block, even on a placed post', async () => {
    const { data: block } = await asUser(ana)
      .from('ripples')
      .insert({ author_id: ana, category_id: ANA_TRIPS, note: 'only me', splash_id: ANA_OLD_POST })
      .select('id')
      .single();
    await asUser(ana).from('ripple_audience').insert({ ripple_id: block!.id, target_type: 'lock' });
    const { data } = await asUser(ben).from('ripples').select('id').eq('id', block!.id);
    expect(data).toEqual([]);
  });
});

describe('writing', () => {
  it('refuses a block written into another member’s post', async () => {
    const { error } = await asUser(ben)
      .from('ripples')
      .insert({ author_id: ben, category_id: BEN_TRIPS, note: 'mine?', splash_id: ANA_OLD_POST });
    expect(error?.code).toBe('42501');
  });

  it('lets members write into a joint splash, and only members', async () => {
    const joint = '0e200000-0000-0000-0000-000000000001';
    const made = await asUser(ben).rpc('create_joint_splash', {
      p_id: joint,
      p_pool: pool,
      p_pool_lane: tripsLane,
      p_title: 'Tofino plan',
      p_icon: null,
      p_declared_start: null,
    });
    expect(made.error).toBeNull();

    for (const [who, lane] of [
      [ana, ANA_TRIPS],
      [ben, BEN_TRIPS],
    ] as const) {
      const { error } = await asUser(who)
        .from('ripples')
        .insert({ author_id: who, category_id: lane, note: `${who} in`, splash_id: joint });
      expect(error).toBeNull();
    }
    const outsider = await asUser(cal)
      .from('ripples')
      .insert({ author_id: cal, category_id: CAL_TRIPS, note: 'let me in', splash_id: joint });
    expect(outsider.error?.code).toBe('42501');

    const both = await asUser(ana).from('ripples').select('author_id').eq('splash_id', joint);
    expect(both.data).toHaveLength(2);

    // Ben cannot delete what Ana wrote along with his own.
    const refused = await asUser(ben).rpc('delete_joint_splash', { p_splash: joint });
    expect(refused.error?.message).toMatch(/1 ripple by other members/);
  });

  it('refuses a joint splash on another pool’s lane', async () => {
    const other = await asUser(cal).rpc('create_pool', {
      p_name: 'Elsewhere',
      p_kind: 'study',
      p_lanes: [{ name: 'Notes', my_category_id: null }],
      p_include_history: false,
    });
    pools.push(other.data!);
    const { error } = await asUser(cal).rpc('create_joint_splash', {
      p_id: null,
      p_pool: other.data!,
      p_pool_lane: tripsLane,
      p_title: 'stolen lane',
      p_icon: null,
      p_declared_start: null,
    });
    expect(error?.code).toBe('42501');
  });
});

describe('invites', () => {
  it('previews only the pool’s name and its members’ initials', async () => {
    const { data } = await asUser(cal).rpc('invite_preview', { p_token: token });
    expect(data).toEqual([{ pool_name: 'Weekend crew', member_initials: ['AL', 'BE'] }]);
  });

  it('opens nothing once expired', async () => {
    const fresh = await asUser(ana).rpc('create_invite', { p_pool: pool });
    const expiring = fresh.data![0].token;
    await asAdmin()
      .from('pool_invites')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('token', expiring);

    const preview = await asUser(cal).rpc('invite_preview', { p_token: expiring });
    expect(preview.data).toEqual([]);
    const join = await asUser(cal).rpc('join_pool', {
      p_token: expiring,
      p_links: [],
      p_include_history: false,
    });
    expect(join.error?.code).toBe('42501');
  });

  it('opens nothing once revoked', async () => {
    const fresh = await asUser(ana).rpc('create_invite', { p_pool: pool });
    const row = await asUser(ana)
      .from('pool_invites')
      .select('id')
      .eq('token', fresh.data![0].token)
      .single();
    await asUser(ana).rpc('revoke_invite', { p_invite: row.data!.id });

    const join = await asUser(cal).rpc('join_pool', {
      p_token: fresh.data![0].token,
      p_links: [],
      p_include_history: false,
    });
    expect(join.error?.code).toBe('42501');
  });
});

describe('leaving', () => {
  it('hides a leaver’s placements when they remove them, and keeps them when they keep', async () => {
    const left = await asUser(ana).rpc('leave_pool', { p_pool: pool, p_keep: false });
    expect(left.error).toBeNull();

    // The leaver loses the pool at once, and keeps every post of their own.
    expect((await asUser(ana).from('pools').select('id').eq('id', pool)).data).toEqual([]);
    expect(
      (await asUser(ana).from('splashes').select('id').eq('id', ANA_OLD_POST)).data,
    ).toHaveLength(1);

    const removed = await asUser(ben).from('splashes').select('id').eq('id', ANA_OLD_POST);
    expect(removed.data).toEqual([]);

    // Back in, then out again keeping them.
    const back = await asUser(ana).rpc('join_pool', {
      p_token: token,
      p_links: [{ pool_lane_id: tripsLane, my_category_id: ANA_TRIPS }],
      p_include_history: false,
    });
    expect(back.error).toBeNull();
    await asUser(ana).rpc('leave_pool', { p_pool: pool, p_keep: true });

    const kept = await asUser(ben).from('splashes').select('id').eq('id', ANA_OLD_POST);
    expect(kept.data).toHaveLength(1);
    const members = await asUser(ben)
      .from('pool_members')
      .select('user_id, left_at, keep_on_leave')
      .eq('pool_id', pool);
    const former = members.data!.find((m) => m.user_id === ana)!;
    expect(former.left_at).not.toBeNull();
    expect(former.keep_on_leave).toBe(true);
  });
});
