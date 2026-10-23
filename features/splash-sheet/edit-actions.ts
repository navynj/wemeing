'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
      'owner_id, pool_id, own_pool_id, title, icon, declared_start, declared_end, declared_lane_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!splash) return { ok: false, message: 'That splash is gone.' };

  const joint = splash.owner_id === null;
  if (!joint && splash.owner_id !== user.id) {
    return { ok: false, message: 'Only its author edits this splash.' };
  }
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
  };
}

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
  if (edit.kind === 'mine') {
    for (const { poolId, on } of edit.share) {
      const done = await setPlacement(edit.id, poolId, on);
      if (!done.ok) return { ok: false, message: `Saved, but not shared: ${done.message}` };
    }
  }
  if (edit.poolId) revalidatePath(`/pool/${edit.poolId}`);
  return { ok: true };
}
