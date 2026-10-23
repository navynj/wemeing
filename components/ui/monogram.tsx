import { monogram } from '@/features/pool/monogram';

const SIZES = {
  // The create screen's tile (1c), beside the name field.
  tile: 'h-[76px] w-[76px] rounded-2xl text-2xl',
  // A row in the switcher.
  row: 'h-10 w-10 rounded-xl text-sm',
  // On a card or a mark on Home: which pool a post is shared to.
  chip: 'h-4 min-w-4 rounded px-0.5 text-[10px]',
} as const;

/**
 * A pool's monogram tile (1c): two characters of its name in blue on the
 * pale tint, a rounded square. The pale tint is a surface, never text, and
 * the blue is the emphasis colour; the tile is a name, not an action.
 */
export function Monogram({
  name,
  size = 'row',
  className = '',
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const letters = monogram(name);
  return (
    <span
      aria-hidden
      data-monogram={letters}
      className={`bg-main-100/60 text-main-900 border-main-900/25 inline-flex shrink-0 items-center justify-center font-semibold ${
        size === 'tile' ? 'border-2' : ''
      } ${SIZES[size]} ${className}`}
    >
      {letters || '·'}
    </span>
  );
}
