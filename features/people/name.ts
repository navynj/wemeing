import { z } from 'zod';

/** A name: 1–40 characters once trimmed. Enforced here, not in the schema (0018, agreed). */
export const NAME_MAX = 40;

export const displayName = z
  .string()
  .trim()
  .min(1, 'A name needs at least one character.')
  .max(NAME_MAX, `A name fits in ${NAME_MAX} characters.`);
