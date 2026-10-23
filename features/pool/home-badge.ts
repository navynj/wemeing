import type { Card } from '@/features/home/grid';

import { poolSplashHref } from './pool-cards';

/**
 * A card on Home, as pools touch it (H23): a joint splash — my ripples on a
 * splash a pool owns — carries the pool's monogram, opens the pool's page,
 * and is neither pinned nor deleted from here. My own splash merely shared
 * to a pool carries nothing on Home: its audience shows on its page's
 * Audience chip.
 */
export function withPoolBadge(
  card: Card,
  jointPool: ReadonlyMap<string, string>,
  poolName: ReadonlyMap<string, string>,
): Card {
  const pool = jointPool.get(card.splash.id);
  if (!pool) return card;
  const name = poolName.get(pool);
  return {
    ...card,
    pools: name ? [name] : [],
    href: poolSplashHref(pool, card.splash.id),
    menu: { pin: false, delete: false },
  };
}
