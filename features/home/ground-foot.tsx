'use client';

import Link from 'next/link';
import { Home, Plus, Users } from 'lucide-react';

/**
 * The ground's foot (H23): Home and Pool at the left, compose at the right
 * as a white disc with the blue plus — on the water, white carries the
 * action. The current place is full white; the other is faded on its
 * wrapper, one fade for icon and label together. On Home, every tap on
 * Home switches Lane and Date (round 3); on a pool, Home goes home. Pool
 * opens my most recently viewed pool (`/pool` decides).
 */
export function GroundFoot({
  here,
  onHome,
  onCompose,
  homeLabel,
}: {
  here: 'home' | 'pool';
  /** Home's own tap, when Home is where we are: the view switch. */
  onHome?: () => void;
  onCompose: () => void;
  /** Home's accessible name, which says what a tap will do. */
  homeLabel?: string;
}) {
  const item = 'flex flex-col items-center gap-1 font-semibold text-white';
  const faded = 'opacity-40';
  const home = (
    <>
      <Home aria-hidden size={22} strokeWidth={2.25} />
      <span className="text-xs/none">Home</span>
    </>
  );
  const pool = (
    <>
      <Users aria-hidden size={22} strokeWidth={2.25} />
      <span className="text-xs/none">Pool</span>
    </>
  );
  return (
    <div
      data-home-foot
      className="flex shrink-0 items-center justify-between px-6 pt-2 lg:px-0"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <nav aria-label="Places" className="flex items-center gap-8">
        {here === 'home' ? (
          <button
            type="button"
            data-home-tab
            aria-label={homeLabel}
            onClick={onHome}
            className={item}
          >
            {home}
          </button>
        ) : (
          <Link href="/" data-home-tab className={`${item} ${faded}`}>
            {home}
          </Link>
        )}
        {here === 'pool' ? (
          <span data-pool-tab aria-current="page" className={item}>
            {pool}
          </span>
        ) : (
          <Link href="/pool" data-pool-tab className={`${item} ${faded}`}>
            {pool}
          </Link>
        )}
      </nav>
      <button
        type="button"
        aria-label="Drop a splash"
        data-compose
        onClick={onCompose}
        className="text-main-900 flex h-12 w-12 items-center justify-center rounded-full bg-white"
      >
        <Plus aria-hidden size={24} />
      </button>
    </div>
  );
}
