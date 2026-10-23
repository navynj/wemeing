'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { removeRippleMedia } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';

import type { Splash } from './summary';

export type SplashResult = { ok: true; splash: Splash } | { ok: false; message: string };
export type Done = { ok: true } | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;

/** Every path a post touches. The post pages and the ground re-read. */
function revalidateSplash(id: string | null = null): void {
  revalidatePath('/');
  revalidatePath('/locker');
  revalidatePath('/lanes');
  if (id) revalidatePath(`/splash/${id}`);
}

const Header = z.object({
  title: z.string().trim().max(120),
  /** A declared range is descriptive, never a deadline (H20e). */
  declaredStart: z.string().regex(ISO_DATE).nullable(),
  declaredEnd: z.string().regex(ISO_DATE).nullable(),
  /** The default lane of a new block (H21f). */
  declaredLaneId: z.uuid().nullable(),
  /** The post's own icon, one glyph, else its lane's emoji stands for it (0008). */
  icon: z.string().trim().max(16).nullable(),
});

export type Header = z.infer<typeof Header>;

function refuseRange(header: Pick<Header, 'declaredStart' | 'declaredEnd'>): string | null {
  if (header.declaredEnd && !header.declaredStart) return 'An end date needs a start date.';
  if (header.declaredEnd && header.declaredStart && header.declaredEnd < header.declaredStart) {
    return 'That end is before the start.';
  }
  return null;
}

const Drop = Header.extend({
  /** The post's id, minted in the browser so the pill on the ground is the real one from the start. */
  id: z.uuid().optional(),
  /** The first block's body; empty makes a titled post with nothing in it yet. */
  body: z.string().trim().max(8000),
  media: z.array(z.string()).max(8),
  /** The first block's annotation (H20c), or nothing. */
  occurredOn: z.string().regex(ISO_DATE).nullable(),
  occurredTime: z.string().regex(CLOCK).nullable(),
  startInstant: z.iso.datetime().nullable(),
  endInstant: z.iso.datetime().nullable(),
  /** The custom shelf to sit on, if any (H21e). */
  sessionId: z.uuid().nullable(),
});

export type Drop = z.infer<typeof Drop>;

/**
 * The post sheet's one commit (SPEC 6): a post and, with it, its first block.
 * A line with no title is an untitled post whose line is its block; a title
 * with nothing under it is a post with nothing in it yet; both are complete.
 */
export async function dropSplash(input: Drop): Promise<SplashResult> {
  const parsed = Drop.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That post is incomplete.' };
  const drop = parsed.data;
  const refused = refuseRange(drop);
  if (refused) return { ok: false, message: refused };
  if (drop.occurredTime !== null && drop.occurredOn === null) {
    return { ok: false, message: 'A time needs a date.' };
  }
  if (!drop.title && !drop.body && drop.media.length === 0 && !drop.declaredLaneId) {
    return { ok: false, message: 'Nothing to drop.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to drop this.' };

  const { data: splash, error } = await supabase
    .from('splashes')
    .insert({
      ...(drop.id ? { id: drop.id } : {}),
      owner_id: user.id,
      title: drop.title,
      declared_start: drop.declaredStart,
      declared_end: drop.declaredEnd,
      declared_lane_id: drop.declaredLaneId,
      icon: drop.icon || null,
      session_id: drop.sessionId,
    })
    .select('*')
    .single();
  if (error) return { ok: false, message: error.message };

  const hasBlock = drop.body.length > 0 || drop.media.length > 0;
  if (hasBlock) {
    const categoryId = drop.declaredLaneId ?? (await residualLane(supabase));
    if (!categoryId) {
      await supabase.from('splashes').delete().eq('id', splash.id);
      return { ok: false, message: 'There is no lane to drop into.' };
    }
    const { error: blockError } = await supabase.from('ripples').insert({
      author_id: user.id,
      category_id: categoryId,
      note: drop.body.length > 0 ? drop.body : null,
      media: drop.media,
      occurred_on: drop.occurredOn,
      occurred_time: drop.occurredTime,
      ended_at: drop.endInstant ?? drop.startInstant,
      splash_id: splash.id,
    });
    if (blockError) {
      // A post without the words that made it is not what was dropped.
      await supabase.from('splashes').delete().eq('id', splash.id);
      return { ok: false, message: blockError.message };
    }
  }

  revalidateSplash(splash.id);
  return { ok: true, splash };
}

/** Day, if the account still has it; else the first lane (H20i). */
async function residualLane(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.from('my_categories').select('id, name').order('position');
  return (data ?? []).find((c) => c.name === 'Day')?.id ?? data?.[0]?.id ?? null;
}

/**
 * A splashless block gets a post of its own the first time it needs one
 * (H21a): titled, pinned, shelved, or extended. The post is made at the
 * block's own time, so it sits where the block always sat.
 */
export async function adoptRipple(rippleId: string): Promise<SplashResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again.' };

  const { data: block } = await supabase
    .from('ripples')
    .select('id, splash_id, created_at')
    .eq('id', rippleId)
    .maybeSingle();
  if (!block) return { ok: false, message: 'That block is gone.' };
  if (block.splash_id) {
    const { data: existing } = await supabase
      .from('splashes')
      .select('*')
      .eq('id', block.splash_id)
      .single();
    return existing ? { ok: true, splash: existing } : { ok: false, message: 'That post is gone.' };
  }

  const { data: splash, error } = await supabase
    .from('splashes')
    .insert({ owner_id: user.id, title: '', created_at: block.created_at })
    .select('*')
    .single();
  if (error) return { ok: false, message: error.message };

  const { error: attach } = await supabase
    .from('ripples')
    .update({ splash_id: splash.id })
    .eq('id', rippleId);
  if (attach) return { ok: false, message: attach.message };

  revalidateSplash(splash.id);
  return { ok: true, splash };
}

/**
 * Edits a post's header in place: title, declared range, declared lane. RLS
 * makes it mine; the update touches no block. A changed declaration governs
 * new blocks from here on (H21f) and never rewrites what was written.
 */
export async function updateSplashHeader(id: string, input: Header): Promise<SplashResult> {
  const parsed = Header.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That header is incomplete.' };
  const header = parsed.data;
  const refused = refuseRange(header);
  if (refused) return { ok: false, message: refused };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('splashes')
    .update({
      title: header.title,
      declared_start: header.declaredStart,
      declared_end: header.declaredEnd,
      declared_lane_id: header.declaredLaneId,
      icon: header.icon || null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { ok: false, message: error.message };
  revalidateSplash(id);
  return { ok: true, splash: data };
}

/** Pins or unpins a post (H21g). */
export async function setSplashPinned(id: string, pinned: boolean): Promise<Done> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('splashes')
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateSplash(id);
  return { ok: true };
}

/**
 * Deletes a post **and its blocks** (H21, the reversal of H20d): the FK
 * cascades, and the media is gathered first because afterwards nothing says
 * which objects were theirs (H17). Hard, with no undo.
 */
export async function deleteSplash(id: string): Promise<Done> {
  const supabase = await createClient();

  const { data: blocks } = await supabase.from('ripples').select('media').eq('splash_id', id);
  const paths = (blocks ?? []).flatMap((row) => row.media);

  const { error } = await supabase.from('splashes').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  await removeRippleMedia(paths);
  revalidateSplash();
  return { ok: true };
}
