import type { Database } from '@/lib/database.types';

export type PoolKind = Database['public']['Enums']['pool_kind'];

/** "What kind of Pool?" — display only (H23): the label changes no behaviour. */
export const POOL_KINDS: { kind: PoolKind; label: string }[] = [
  { kind: 'couple_diary', label: 'Couple diary' },
  { kind: 'study', label: 'Study' },
  { kind: 'running_crew', label: 'Running crew' },
  { kind: 'faith_group', label: 'Faith group' },
  { kind: 'friends', label: 'Friends' },
];

function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
      (s) => s.segment,
    );
  }
  return [...text];
}

/**
 * A pool's monogram: the first two characters of its name, spaces skipped,
 * grapheme-aware so a Korean name keeps its syllables whole. Latin letters
 * are uppercased; a name too short gives what it has.
 */
export function monogram(name: string): string {
  return graphemes(name.replace(/\s+/g, '')).slice(0, 2).join('').toUpperCase();
}
