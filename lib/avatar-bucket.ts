/** Shared with the browser, which uploads a person's one photo into it (0018). */
export const AVATAR_BUCKET = 'avatars';

/** The object a person's photo lives at: their id, nothing else (0018's policies). */
export function avatarPath(userId: string): string {
  return userId;
}
