import type { Database } from '@/lib/database.types';

type RippleMode = Database['public']['Enums']['ripple_mode'];

/**
 * The seed every new profile starts with (E1: presets declare a culture, not
 * just a taxonomy). Five lanes in the record-type register (H20i): what a
 * fragment is about, never what activity it measures — which is why there is
 * no Focus. Music folded into Media, which covers what is listened to as well
 * as watched, read and played (review, 2026-10-23). Day is the residual lane an
 * uncategorised drop falls into; SPEC 4 keeps it out of pool mappings by
 * default for the same reason.
 *
 * Preset constant and seed only: existing accounts are untouched, and a lane
 * with records refuses deletion (H19), so an old lane retires by hand in-app.
 */
export const PRESET_CATEGORIES: ReadonlyArray<{
  name: string;
  icon: string;
  default_mode: RippleMode;
}> = [
  { name: 'Place', icon: '📍', default_mode: 'drop' },
  { name: 'Mood', icon: '🌤️', default_mode: 'drop' },
  { name: 'Media', icon: '🎬', default_mode: 'drop' },
  { name: 'Food', icon: '🍽️', default_mode: 'drop' },
  { name: 'Day', icon: '🖋', default_mode: 'drop' },
];

/** The lane an uncategorised fragment falls into (H20i, D9). */
export const RESIDUAL_CATEGORY = 'Day';
