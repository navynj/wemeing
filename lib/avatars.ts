import { createClient as createServiceClient } from '@supabase/supabase-js';

import { AVATAR_BUCKET, avatarPath } from '@/lib/avatar-bucket';
import type { Database } from '@/lib/database.types';
import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import type { DuringClient } from '@/lib/queries/profile';

/**
 * A day: a face is drawn on every screen, and a URL that changes each render
 * would defeat the browser's cache. A photo change bumps the version, so a
 * long-lived URL never outlives the photo it shows.
 */
export const AVATAR_TTL_SECONDS = 24 * 60 * 60;
/** Reissued once less than this is left, so no page is handed a URL about to rot. */
const REISSUE_BEFORE_MS = 60 * 60 * 1000;

/** Per (person, version) on this server: the same version is the same URL across renders. */
const signed = new Map<string, { url: string; expires: number }>();

export function clearAvatarCache(): void {
  signed.clear();
}

/** Who to sign: a person and the version their profile names; null version means initials. */
export type AvatarRef = { id: string; version: number | null };

/**
 * Signed photo URLs by person, for the people the viewer may see (0018): me,
 * and current members of a pool I am in. `visible_avatars` answers that
 * through my own session, and only then does the service role sign — the
 * pattern ripple media uses. A person without a photo, or one I may not see,
 * comes back null and is drawn as initials. Never throws: a face that could
 * not sign is initials, not a failed page.
 */
export async function signAvatars(
  supabase: DuringClient,
  people: AvatarRef[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = Object.fromEntries(people.map((p) => [p.id, null]));
  const withPhoto = people.filter((p) => p.version !== null);
  if (withPhoto.length === 0) return out;

  try {
    const { data: visible, error } = await supabase.rpc('visible_avatars', {
      uids: withPhoto.map((p) => p.id),
    });
    if (error) throw error;
    const allowed = new Set(visible);

    const now = Date.now();
    const missing: AvatarRef[] = [];
    for (const person of withPhoto) {
      if (!allowed.has(person.id)) continue;
      const hit = signed.get(`${person.id}:${person.version}`);
      if (hit && hit.expires - now > REISSUE_BEFORE_MS) out[person.id] = hit.url;
      else missing.push(person);
    }
    if (missing.length === 0) return out;

    const service = createServiceClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });
    const { data, error: signError } = await service.storage.from(AVATAR_BUCKET).createSignedUrls(
      missing.map((p) => avatarPath(p.id)),
      AVATAR_TTL_SECONDS,
    );
    if (signError) throw signError;

    for (const person of missing) {
      const entry = data.find((d) => d.path === avatarPath(person.id));
      if (!entry?.signedUrl) continue;
      signed.set(`${person.id}:${person.version}`, {
        url: entry.signedUrl,
        expires: now + AVATAR_TTL_SECONDS * 1000,
      });
      out[person.id] = entry.signedUrl;
    }
    return out;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[during] avatar signing failed: ${message}`);
    return out;
  }
}
