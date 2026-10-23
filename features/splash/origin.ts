import { monthHref, monthName } from '@/features/home/scope';
import type { MyCategory } from '@/lib/queries/profile';

import type { Origin } from './splash-page';

const MONTH = /^\d{4}-\d{2}$/;

/**
 * Where the back chip points, from `?from=`: a month, Home, a lane page —
 * named by the lane's emoji and name (review) — or any path on the site.
 */
export function originOf(
  from: string | undefined,
  today: string,
  lanes: Pick<MyCategory, 'id' | 'name' | 'icon'>[],
): Origin {
  if (from && MONTH.test(from)) return { label: monthName(from), href: monthHref(from) };
  const lanePage = from ? /^\/lane\/([^/?#]+)$/.exec(from) : null;
  if (from && lanePage) {
    const lane = lanes.find((l) => l.id === lanePage[1]);
    if (lane) return { label: [lane.icon, lane.name].filter(Boolean).join(' '), href: from };
  }
  if (from === '/' || from?.startsWith('/?')) return { label: 'Home', href: from };
  if (from?.startsWith('/')) return { label: 'Back', href: from };
  return { label: monthName(today.slice(0, 7)), href: monthHref(today.slice(0, 7)) };
}
