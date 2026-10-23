'use client';

/** The first grapheme of what was typed: one emoji, flags and skin tones kept whole. */
export function firstGrapheme(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const [first] = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed);
    return first?.segment ?? '';
  }
  return [...trimmed][0] ?? '';
}

/**
 * A lane's emoji, typed (H22): a plain field that keeps one grapheme — the
 * last one typed, so a second emoji replaces the first rather than being
 * refused — shown large on a quiet disc. The phone's own emoji keyboard is
 * the picker; a picker of our own, searchable in Korean and English, is a
 * later task (ROADMAP).
 */
export function EmojiInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (icon: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => {
        const typed = event.target.value;
        // What was added, if anything, else what remains.
        const added = typed.startsWith(value) ? typed.slice(value.length) : typed;
        onChange(firstGrapheme(added) || firstGrapheme(typed));
      }}
      aria-label={label}
      placeholder={placeholder}
      data-emoji-input
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      className="bg-pool-100 h-14 w-14 shrink-0 rounded-full text-center text-3xl/none outline-none placeholder:opacity-30"
    />
  );
}
