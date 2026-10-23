'use client';

import Link from 'next/link';
import { Home, Plus, WavesLadder } from 'lucide-react';

/**
 * The ground's foot (H23): Home and Pool at the left, compose at the right
 * as a white disc with the blue plus — on the water, white carries the
 * action. The current place is full white; the other is faded on its
 * wrapper, one fade for icon and label together. On Home, every tap on
 * Home switches Lane and Date (round 3); on a pool, Home goes home. Pool
 * opens my most recently viewed pool (`/pool` decides).
 *
 * Two slots, CSS showing one per breakpoint so nothing moves after load:
 * on a phone a row at the foot of the board; on a wide screen a vertical
 * stack at the ground's right edge — Home, Pool, then compose.
 */
export function GroundFoot({
  slot = 'phone',
  here,
  onHome,
  onPool,
  onCompose,
  homeLabel,
  poolLabel,
}: {
  slot?: 'phone' | 'wide';
  here: 'home' | 'pool';
  /** Home's own tap, when Home is where we are: the view switch. */
  onHome?: () => void;
  onCompose: () => void;
  /** Home's accessible name, which says what a tap will do. */
  homeLabel?: string;
  /** Pool's own tap, when a pool is where we are: the view cycle (review). */
  onPool?: () => void;
  poolLabel?: string;
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
      {/* The pool's own glyph: a ladder into the water. */}
      <WavesLadder aria-hidden size={22} strokeWidth={2.25} />
      <span className="text-xs/none">Pool</span>
    </>
  );
  const wide = slot === 'wide';
  return (
    <div
      data-home-foot={slot}
      className={
        wide
          ? 'hidden shrink-0 flex-col items-center justify-center gap-10 self-stretch pr-6 lg:flex'
          : 'flex shrink-0 items-center justify-between px-6 pt-2 lg:hidden'
      }
      style={
        wide ? undefined : { paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }
      }
    >
      <nav aria-label="Places" className={`flex items-center ${wide ? 'flex-col gap-7' : 'gap-8'}`}>
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
          onPool ? (
            <button
              type="button"
              data-pool-tab
              aria-current="page"
              aria-label={poolLabel}
              onClick={onPool}
              className={item}
            >
              {pool}
            </button>
          ) : (
            <span data-pool-tab aria-current="page" className={item}>
              {pool}
            </span>
          )
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
