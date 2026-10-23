import Link from 'next/link';

import { WaveMark } from '@/components/ui/waves';
import type { MyCategory } from '@/lib/queries/profile';

import { formatPillDate, representativeLane, type DateRange, type SplashSummary } from './summary';

/** Where a pill sits: on the blue ground, or on a white page. */
export type PillGround = 'water' | 'page';

/**
 * A post as a pill (`_docs/mockups/home-ground.png`), as wide as its title
 * and no wider: the date small, the representative lane's emoji with the
 * title, the wave mark at the right end
 * — white waves on a blue disc — scaled by block count. White on the ground,
 * where it carries content in the inverted channel (H21c); a quiet surface on
 * a white page, the same anatomy.
 *
 * A post of one — a lone block standing in as a post (H21a), or a post that
 * is only a title with no block yet — is the inverse: a blue pill with a
 * white/50 outer border, white text, and the mark a white disc with blue
 * waves. Both are the same weight on the rope: a single thing, not a bundle.
 * An untitled post shows its first block's first words as a ghost title.
 */
export function SplashPill({
  splash,
  range,
  categories,
  href,
  ground,
  ring = false,
}: {
  splash: SplashSummary;
  /** The date to show: the post's place on this shelf, or its range. */
  range: DateRange;
  categories: MyCategory[];
  href: string;
  ground: PillGround;
  /** True while the commit ripple plays here: the new post's pill (SPEC 6). */
  ring?: boolean;
}) {
  const lane = categories.find((c) => c.id === representativeLane(splash)) ?? null;
  const title = splash.title.trim();
  const lone = splash.orphan || splash.count === 0;
  const surface = lone
    ? 'bg-main-900 text-white border border-white/50'
    : ground === 'water'
      ? 'bg-white text-ink'
      : 'bg-pool-100 text-ink';
  const date = lone ? 'text-white/60' : 'text-pool-500';

  return (
    <Link
      href={href}
      data-splash-pill={splash.id}
      data-lone={lone ? '' : undefined}
      data-ring={ring ? '' : undefined}
      className={`relative flex max-w-full items-center gap-2 rounded-full py-1.5 pr-2 pl-3.5 ${surface}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className={`text-[10px]/none font-medium tabular-nums ${date}`}>
          {formatPillDate(range)}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[13px]/tight font-medium">
          {lane?.icon ? <span aria-hidden>{lane.icon}</span> : null}
          {title ? (
            <span className="truncate">{title}</span>
          ) : (
            <span data-ghost-title className="truncate opacity-40">
              {splash.ghostTitle ?? 'Untitled'}
            </span>
          )}
        </span>
      </span>
      <WaveMark count={splash.count} tone={lone ? 'lone' : 'blue'} />
    </Link>
  );
}
