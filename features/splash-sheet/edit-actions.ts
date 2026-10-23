'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { draftFrom, type Annotation } from '@/features/input-sheet/draft';
import { setPlacement } from '@/features/pool/actions';
import { updateSplashHeader } from '@/features/splash/actions';
import { createClient } from '@/lib/supabase/server';

/** What the edit sheet opens with, read fresh so the Audience is exact wherever it opened. */
export type SplashEditState =
  | {
      ok: true;
      /** mine: everything; own: Just mine (title, icon, dates; its pool fixed); joint: title and icon. */
      kind: 'mine' | 'own' | 'joint';
      title: string;
      icon: string | null;
      declaredStart: string | null;
      declaredEnd: string | null;
      declaredLaneId: string | null;
      /** Pools my splash is shared to now (mine only). */
      shared: string[];
      /** The pool a Just-mine or joint splash lives in. */
      poolId: string | null;
      /**
       * Where the splash's date lives (review): its own declared days, or —
       * as the composer writes it — the annotation on my first ripple.
       */
      date: { source: 'declared' } | { source: 'block'; rippleId: string };
      /** That date as the composer's control shows it; null when unset. */
      annotation: Annotation | null;
      /** A pool's own splash (joint, Just mine): its pool's lanes, and the one it is in (0020). */
      poolLanes: { id: string; name: string; icon: string | null }[];
      poolLaneId: string | null;
    }
  | { ok: false; message: string };

export async function loadSplashEdit(id: string): Promise<SplashEditState> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'No such splash.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to edit this.' };
  const { data: splash } = await supabase
    .from('splashes')
    .select(
      'owner_id, pool_id, pool_lane_id, own_pool_id, title, icon, declared_start, declared_end, declared_lane_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!splash) return { ok: false, message: 'That splash is gone.' };

  const joint = splash.owner_id === null;
  if (!joint && splash.owner_id !== user.id) {
    return { ok: false, message: 'Only its author edits this splash.' };
  }
  const ownPool = splash.pool_id ?? splash.own_pool_id;
  const [{ data: profile }, { data: first }, { data: lanes }, { data: placed }] = await Promise.all(
    [
      supabase.from('profiles').select('timezone').eq('id', user.id).single(),
      supabase
        .from('ripples')
        .select(
          'id, category_id, note, media, occurred_on, occurred_time, ended_at, started_at, splash_id',
        )
        .eq('splash_id', id)
        .eq('author_id', user.id)
        .is('parent_ripple_id', null)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
      ownPool
        ? supabase
            .from('pool_lanes')
            .select('id, name, icon')
            .eq('pool_id', ownPool)
            .order('position')
        : Promise.resolve({ data: [] }),
      splash.own_pool_id
        ? supabase
            .from('splash_placements')
            .select('pool_lane_id')
            .eq('splash_id', id)
            .eq('pool_id', splash.own_pool_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ],
  );
  // A declaration wins where there is one; otherwise the date is the first
  // ripple's, where the composer put it; with no ripple, a declaration to be.
  const onBlock = !splash.declared_start && first;
  const annotation: Annotation | null = splash.declared_start
    ? {
        date: splash.declared_start,
        time: null,
        endDate: splash.declared_end,
        endTime: null,
      }
    : first
      ? draftFrom(first, profile?.timezone ?? 'UTC').annotation
      : null;

  let shared: string[] = [];
  if (!joint && !splash.own_pool_id) {
    const { data } = await supabase
      .from('splash_placements')
      .select('pool_id')
      .eq('splash_id', id)
      .eq('shared', true);
    shared = (data ?? []).map((p) => p.pool_id);
  }
  return {
    ok: true,
    kind: joint ? 'joint' : splash.own_pool_id ? 'own' : 'mine',
    title: splash.title,
    icon: splash.icon,
    declaredStart: splash.declared_start,
    declaredEnd: splash.declared_end,
    declaredLaneId: splash.declared_lane_id,
    shared,
    poolId: splash.pool_id ?? splash.own_pool_id,
    date: onBlock ? { source: 'block', rippleId: first.id } : { source: 'declared' },
    annotation,
    poolLanes: lanes ?? [],
    poolLaneId: splash.pool_lane_id ?? placed?.pool_lane_id ?? null,
  };
}

const CLOCK = /^\d{2}:\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const Edit = z.object({
  id: z.uuid(),
  kind: z.enum(['mine', 'own', 'joint']),
  title: z.string().trim().max(120),
  icon: z.string().trim().max(16).nullable(),
  declaredStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  declaredEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  declaredLaneId: z.uuid().nullable(),
  /** Mine only: switches to flip, pool by pool. */
  share: z.array(z.object({ poolId: z.uuid(), on: z.boolean() })).max(24),
  poolId: z.uuid().nullable(),
  /** The first ripple's annotation, when that is where the date lives; else untouched. */
  block: z
    .object({
      rippleId: z.uuid(),
      occurredOn: z.string().regex(ISO).nullable(),
      occurredTime: z.string().regex(CLOCK).nullable(),
      startInstant: z.iso.datetime().nullable(),
      endInstant: z.iso.datetime().nullable(),
    })
    .nullable(),
  /** A pool's own splash: the pool lane it moves to, when it moved (0020). */
  poolLaneId: z.uuid().nullable(),
});

/**
 * Saves the edit sheet. Mine: the header as the page edits it, then each
 * pool switch that changed. Just mine: title, icon and dates; its lane stays
 * none and its pool stays its own (0014). Joint: title and icon, by any
 * current member — RLS holds that, and the rest of a joint splash is the
 * pool's (H23).
 */
export async function saveSplashEdit(
  input: z.infer<typeof Edit>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = Edit.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That edit is incomplete.' };
  const edit = parsed.data;

  if (edit.kind === 'joint') {
    const supabase = await createClient();
    const { error } = await supabase
      .from('splashes')
      .update({ title: edit.title, icon: edit.icon || null })
      .eq('id', edit.id);
    if (error) return { ok: false, message: error.message };
    const moved = await movePoolSplash(supabase, edit.id, edit.poolLaneId);
    if (moved) return moved;
    revalidatePath('/');
    if (edit.poolId) {
      revalidatePath(`/pool/${edit.poolId}`);
      revalidatePath(`/pool/${edit.poolId}/splash/${edit.id}`);
    }
    return { ok: true };
  }

  const header = await updateSplashHeader(edit.id, {
    title: edit.title,
    icon: edit.icon,
    declaredStart: edit.declaredStart,
    declaredEnd: edit.declaredEnd,
    // A Just-mine splash never takes a lane of mine.
    declaredLaneId: edit.kind === 'own' ? null : edit.declaredLaneId,
  });
  if (!header.ok) return header;
  const supabase = await createClient();
  if (edit.block) {
    const b = edit.block;
    if (b.occurredTime !== null && b.occurredOn === null) {
      return { ok: false, message: 'A time needs a date.' };
    }
    if (
      b.endInstant !== null &&
      (b.occurredOn === null ||
        (b.startInstant !== null && Date.parse(b.endInstant) <= Date.parse(b.startInstant)))
    ) {
      return { ok: false, message: 'That end is before the start.' };
    }
    // The same write a block's own editor makes (updateRipple), the date only.
    const { error } = await supabase
      .from('ripples')
      .update({
        occurred_on: b.occurredOn,
        occurred_time: b.occurredTime,
        ended_at: b.endInstant ?? b.startInstant,
      })
      .eq('id', b.rippleId)
      .eq('splash_id', edit.id);
    if (error) return { ok: false, message: error.message };
  }
  if (edit.kind === 'own') {
    const moved = await movePoolSplash(supabase, edit.id, edit.poolLaneId);
    if (moved) return moved;
  }
  revalidatePath('/');
  revalidatePath(`/splash/${edit.id}`);
  if (edit.poolId) revalidatePath(`/pool/${edit.poolId}/splash/${edit.id}`);
  if (edit.kind === 'mine') {
    for (const { poolId, on } of edit.share) {
      const done = await setPlacement(edit.id, poolId, on);
      if (!done.ok) return { ok: false, message: `Saved, but not shared: ${done.message}` };
    }
  }
  if (edit.poolId) revalidatePath(`/pool/${edit.poolId}`);
  return { ok: true };
}

/** Moves a pool's own splash to another of its pool's lanes (0020); null when done or unmoved. */
async function movePoolSplash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  poolLaneId: string | null,
): Promise<{ ok: false; message: string } | null> {
  if (!poolLaneId) return null;
  const { error } = await supabase.rpc('move_pool_splash', {
    p_splash: id,
    p_pool_lane: poolLaneId,
  });
  return error ? { ok: false, message: error.message } : null;
}
