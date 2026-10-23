'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { Database } from '@/lib/database.types';
import { removeRippleMedia } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';

export type Done = { ok: true } | { ok: false; message: string };
export type Made = { ok: true; id: string } | { ok: false; message: string };

const ICON = z.string().trim().max(16).nullable();
const DESCRIPTION = z.string().trim().max(80).nullable();
const LINKS = z
  .array(z.object({ poolLaneId: z.uuid(), myCategoryId: z.uuid().nullable() }))
  .max(24);

/** Every surface a pool touches re-reads. */
function revalidatePool(poolId: string | null = null): void {
  revalidatePath('/');
  revalidatePath('/pool');
  if (poolId) revalidatePath(`/pool/${poolId}`);
}

/** A database refusal as the author should read it: our own words, else a plain one. */
function said(error: { message: string; code?: string } | null): string {
  if (!error) return 'That did not go through. Try again.';
  if (error.code === '42501' && /no longer valid/.test(error.message)) return error.message;
  if (error.code === '42501' && /ripples? by other members/.test(error.message)) {
    return error.message;
  }
  if (error.code === '42501') return 'You are not a member of this Pool.';
  return error.message;
}

const NewPool = z.object({
  name: z.string().trim().min(1).max(60),
  lanes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        icon: ICON,
        description: DESCRIPTION,
        myCategoryId: z.uuid().nullable(),
      }),
    )
    .min(1)
    .max(12),
  includeHistory: z.boolean(),
});

/** "Open a new Pool", steps 1 and 2 as one act (0011 `create_pool`). */
export async function createPool(input: z.infer<typeof NewPool>): Promise<Made> {
  const parsed = NewPool.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A Pool needs a name and at least one lane.' };
  const pool = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_pool', {
    p_name: pool.name,
    // The kind is no longer chosen or written (2026-10-23): the column is
    // nullable with no default, so it stays null. The function still takes
    // the argument, and the generated type reads it as required.
    p_kind: null as unknown as Database['public']['Enums']['pool_kind'],
    p_lanes: pool.lanes.map((lane) => ({
      name: lane.name,
      icon: lane.icon,
      description: lane.description,
      my_category_id: lane.myCategoryId,
    })),
    p_include_history: pool.includeHistory,
  });
  if (error || !data) return { ok: false, message: said(error) };
  revalidatePool(data);
  return { ok: true, id: data };
}

const Join = z.object({
  token: z.string().min(1).max(64),
  links: LINKS,
  includeHistory: z.boolean(),
});

/** Joining from `/join/[token]`: the token is checked again in the database. */
export async function joinPool(input: z.infer<typeof Join>): Promise<Made> {
  const parsed = Join.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'This invite link is no longer valid.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_pool', {
    p_token: parsed.data.token,
    p_links: parsed.data.links.map((l) => ({
      pool_lane_id: l.poolLaneId,
      my_category_id: l.myCategoryId,
    })),
    p_include_history: parsed.data.includeHistory,
  });
  if (error || !data) return { ok: false, message: said(error) };
  revalidatePool(data);
  return { ok: true, id: data };
}

/** Pool settings: change which of my lanes each pool lane takes. */
export async function setLaneLinks(poolId: string, links: z.infer<typeof LINKS>): Promise<Done> {
  const parsed = z.object({ poolId: z.uuid(), links: LINKS }).safeParse({ poolId, links });
  if (!parsed.success) return { ok: false, message: 'Those links are not valid.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_lane_links', {
    p_pool: poolId,
    p_links: parsed.data.links.map((l) => ({
      pool_lane_id: l.poolLaneId,
      my_category_id: l.myCategoryId,
    })),
  });
  if (error) return { ok: false, message: said(error) };
  revalidatePool(poolId);
  return { ok: true };
}

export type Invite =
  { ok: true; id: string; token: string; expiresAt: string } | { ok: false; message: string };

/** "Create invite link": a fresh token, seven days, revocable. */
export async function createInvite(poolId: string): Promise<Invite> {
  if (!z.uuid().safeParse(poolId).success) return { ok: false, message: 'No such Pool.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_invite', { p_pool: poolId });
  const row = data?.[0];
  if (error || !row) return { ok: false, message: said(error) };
  // Readable by members, so the link can be revoked the moment it exists.
  const { data: made } = await supabase
    .from('pool_invites')
    .select('id')
    .eq('token', row.token)
    .single();
  if (!made) return { ok: false, message: 'The link was made but could not be read back.' };
  revalidatePool(poolId);
  return { ok: true, id: made.id, token: row.token, expiresAt: row.expires_at };
}

export async function revokeInvite(poolId: string, inviteId: string): Promise<Done> {
  if (!z.uuid().safeParse(inviteId).success) return { ok: false, message: 'No such invite.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_invite', { p_invite: inviteId });
  if (error) return { ok: false, message: said(error) };
  revalidatePool(poolId);
  return { ok: true };
}

/** "Leave Pool": keep my records here (Former member), or hide them. Never deletes. */
export async function leavePool(poolId: string, keep: boolean): Promise<Done> {
  if (!z.uuid().safeParse(poolId).success) return { ok: false, message: 'No such Pool.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_pool', { p_pool: poolId, p_keep: keep });
  if (error) return { ok: false, message: said(error) };
  revalidatePool(poolId);
  return { ok: true };
}

const LaneEdit = z.object({
  id: z.uuid().nullable(),
  poolId: z.uuid(),
  name: z.string().trim().min(1).max(40),
  icon: ICON,
  description: DESCRIPTION,
});

/** A pool lane named, re-iconed or described by any member (no roles yet), or added. */
export async function savePoolLane(input: z.infer<typeof LaneEdit>): Promise<Done> {
  const parsed = LaneEdit.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A lane needs a name.' };
  const lane = parsed.data;
  const supabase = await createClient();
  const fields = {
    name: lane.name,
    icon: lane.icon || null,
    description: lane.description || null,
  };
  if (lane.id) {
    const { error } = await supabase.from('pool_lanes').update(fields).eq('id', lane.id);
    if (error) return { ok: false, message: said(error) };
  } else {
    const { data: last } = await supabase
      .from('pool_lanes')
      .select('position')
      .eq('pool_id', lane.poolId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from('pool_lanes')
      .insert({ ...fields, pool_id: lane.poolId, position: (last?.position ?? -1) + 1 });
    if (error) return { ok: false, message: said(error) };
  }
  revalidatePool(lane.poolId);
  return { ok: true };
}

/**
 * One post's audience in one pool (the Audience sheet). On: placed in the
 * pool lane my lane is linked to — the database refuses a lane I never
 * linked (C5). Off: kept, switched off, so off stays distinct from never.
 */
export async function setPlacement(
  splashId: string,
  poolId: string,
  shared: boolean,
): Promise<Done> {
  const parsed = z
    .object({ splashId: z.uuid(), poolId: z.uuid(), shared: z.boolean() })
    .safeParse({ splashId, poolId, shared });
  if (!parsed.success) return { ok: false, message: 'That audience is not valid.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to change this.' };

  const lane = await poolLaneFor(supabase, user.id, splashId, poolId);
  if (shared && !lane) return { ok: false, message: 'This lane is not linked in that Pool.' };

  const { data: existing } = await supabase
    .from('splash_placements')
    .select('splash_id')
    .eq('splash_id', splashId)
    .eq('pool_id', poolId)
    .maybeSingle();
  const { error } = existing
    ? await supabase
        .from('splash_placements')
        .update({
          shared,
          updated_at: new Date().toISOString(),
          ...(shared && lane ? { pool_lane_id: lane } : {}),
        })
        .eq('splash_id', splashId)
        .eq('pool_id', poolId)
    : shared && lane
      ? await supabase
          .from('splash_placements')
          .insert({ splash_id: splashId, pool_id: poolId, pool_lane_id: lane })
      : { error: null };
  if (error) return { ok: false, message: said(error) };
  revalidatePool(poolId);
  revalidatePath(`/splash/${splashId}`);
  return { ok: true };
}

/**
 * Where a post of mine lands in a pool: the pool lane my post's lane is
 * linked to there — its declared lane, else the lane its blocks took most.
 */
async function poolLaneFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  me: string,
  splashId: string,
  poolId: string,
): Promise<string | null> {
  const { data: splash } = await supabase
    .from('splashes')
    .select('declared_lane_id, owner_id')
    .eq('id', splashId)
    .maybeSingle();
  if (!splash || splash.owner_id !== me) return null;
  let lane = splash.declared_lane_id;
  if (!lane) {
    const { data: blocks } = await supabase
      .from('ripples')
      .select('category_id, created_at')
      .eq('splash_id', splashId);
    const tally = new Map<string, { count: number; latest: string }>();
    for (const b of blocks ?? []) {
      const t = tally.get(b.category_id) ?? { count: 0, latest: '' };
      tally.set(b.category_id, {
        count: t.count + 1,
        latest: b.created_at > t.latest ? b.created_at : t.latest,
      });
    }
    lane =
      [...tally.entries()].sort(
        ([, a], [, b]) => b.count - a.count || b.latest.localeCompare(a.latest),
      )[0]?.[0] ?? null;
  }
  if (!lane) return null;
  const { data: link } = await supabase
    .from('lane_mappings')
    .select('pool_lane_id')
    .eq('user_id', me)
    .eq('pool_id', poolId)
    .eq('my_category_id', lane)
    .maybeSingle();
  return link?.pool_lane_id ?? null;
}

/** A new post's audience, written right after the post (compose). */
export async function placeNewSplash(splashId: string, poolIds: string[]): Promise<Done> {
  for (const poolId of poolIds) {
    const done = await setPlacement(splashId, poolId, true);
    if (!done.ok) return done;
  }
  return { ok: true };
}

const Joint = z.object({
  id: z.uuid(),
  poolId: z.uuid(),
  poolLaneId: z.uuid(),
  title: z.string().trim().max(120),
  icon: ICON,
  body: z.string().trim().max(8000),
  /** My lane for my ripple: the one linked to this pool lane, else the one I chose. */
  myCategoryId: z.uuid().nullable(),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

/** A joint splash, opened by a member on a pool lane, with my first ripple on it. */
export async function createJointSplash(input: z.infer<typeof Joint>): Promise<Made> {
  const parsed = Joint.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That joint splash is incomplete.' };
  const joint = parsed.data;
  if (joint.body && !joint.myCategoryId) {
    return { ok: false, message: 'Pick one of your lanes for your ripple.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to drop this.' };

  const { error } = await supabase.rpc('create_joint_splash', {
    p_id: joint.id,
    p_pool: joint.poolId,
    p_pool_lane: joint.poolLaneId,
    p_title: joint.title,
    ...(joint.icon ? { p_icon: joint.icon } : {}),
    ...(joint.occurredOn ? { p_declared_start: joint.occurredOn } : {}),
  });
  if (error) return { ok: false, message: said(error) };

  if (joint.body && joint.myCategoryId) {
    const { error: blockError } = await supabase.from('ripples').insert({
      author_id: user.id,
      category_id: joint.myCategoryId,
      note: joint.body,
      occurred_on: joint.occurredOn,
      splash_id: joint.id,
    });
    if (blockError) {
      // The band without the words that opened it is not what was dropped.
      await supabase.rpc('delete_joint_splash', { p_splash: joint.id });
      return { ok: false, message: said(blockError) };
    }
  }
  revalidatePool(joint.poolId);
  return { ok: true, id: joint.id };
}

/** A ripple of mine on a joint splash (its page's add slot). */
export async function addJointRipple(input: {
  splashId: string;
  poolId: string;
  myCategoryId: string;
  body: string;
}): Promise<Done> {
  const parsed = z
    .object({
      splashId: z.uuid(),
      poolId: z.uuid(),
      myCategoryId: z.uuid(),
      body: z.string().trim().min(1).max(8000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Write something first.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to write this.' };
  const { error } = await supabase.from('ripples').insert({
    author_id: user.id,
    category_id: parsed.data.myCategoryId,
    note: parsed.data.body,
    splash_id: parsed.data.splashId,
  });
  if (error) return { ok: false, message: said(error) };
  revalidatePool(parsed.data.poolId);
  revalidatePath(`/pool/${parsed.data.poolId}/splash/${parsed.data.splashId}`);
  return { ok: true };
}

/** Delete a joint splash: only while every ripple on it is mine (0011). */
export async function deleteJointSplash(poolId: string, splashId: string): Promise<Done> {
  if (!z.uuid().safeParse(splashId).success) return { ok: false, message: 'No such splash.' };
  const supabase = await createClient();
  const { data: blocks } = await supabase
    .from('ripples')
    .select('id, media')
    .eq('splash_id', splashId);
  const { error } = await supabase.rpc('delete_joint_splash', { p_splash: splashId });
  if (error) return { ok: false, message: said(error) };
  // Hard deletes include the objects (CLAUDE.md); every ripple was mine.
  await removeRippleMedia((blocks ?? []).flatMap((b) => b.media));
  revalidatePool(poolId);
  return { ok: true };
}
