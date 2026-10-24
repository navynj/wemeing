'use client';

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Monogram } from '@/components/ui/monogram';
import { useAxisLock } from '@/components/ui/use-axis-lock';
import { initialsOf } from '@/features/home/grid';
import { Avatar } from '@/features/people/avatar';
import { usePeople } from '@/features/people/people-provider';
import { UnseenDot, useStripPools } from '@/features/pool/activity';

/**
 * The ground's foot (review): the places I go, as a strip — my face first
 * (Home), then a monogram per pool I am in, the one I opened last first, then
 * a small `+` to open a new pool — and compose at the right as the white disc
 * with the blue plus, outside the strip. Each place is a 40px circle; the one
 * I am in wears an ink ring (selection), and a pool with something new since
 * my last visit carries the dot. Tapping a place goes there; tapping the one
 * I am in walks its views (Home: Lane ↔ Date; a pool: Swimmers → Lane →
 * Date). The strip scrolls sideways, one axis per gesture.
 *
 * Two slots, CSS showing one per breakpoint so nothing moves after load: on
 * a phone a row at the foot of the board; on a wide screen a vertical rail at
 * the ground's right edge, the same places in the same order, then compose.
 */
export function GroundFoot({
  slot = 'phone',
  here,
  poolId = null,
  onHome,
  onPool,
  onCompose,
  homeLabel,
  poolLabel,
}: {
  slot?: 'phone' | 'wide';
  /** Where I am: Home, or a pool — `poolId` names which (none on the pool index). */
  here: 'home' | 'pool';
  poolId?: string | null;
  /** Home's own tap, when Home is where we are: the view switch. */
  onHome?: () => void;
  onCompose: () => void;
  /** Home's accessible name, which says what a tap will do. */
  homeLabel?: string;
  /** The current pool's own tap: the view cycle (review). */
  onPool?: () => void;
  poolLabel?: string;
}) {
  const wide = slot === 'wide';
  const strip = useRef<HTMLElement>(null);
  useAxisLock(strip);
  const { me, people } = usePeople();
  const pools = useStripPools();
  const myName = me ? (people[me]?.name ?? '') : '';
  const atHome = here === 'home';

  return (
    <div
      data-home-foot={slot}
      className={
        wide
          ? 'hidden min-h-0 shrink-0 flex-col items-center justify-center gap-6 self-stretch py-6 pr-6 lg:flex'
          : 'flex shrink-0 items-center gap-3 pt-2 pr-6 pl-4 lg:hidden'
      }
      style={
        wide ? undefined : { paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }
      }
    >
      <nav
        ref={strip}
        aria-label="Places"
        data-place-strip
        className={`no-scrollbar flex items-center gap-3 ${
          wide
            ? 'min-h-0 flex-col overflow-y-auto p-1.5'
            : 'min-w-0 flex-1 overflow-x-auto p-1.5'
        }`}
      >
        <Place
          current={atHome}
          label={atHome ? homeLabel : 'Home'}
          href="/"
          onTap={atHome ? onHome : undefined}
          data={{ 'data-home-tab': '', 'data-strip-home': '' }}
        >
          <Avatar
            id={me}
            initials={initialsOf(myName)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-xs font-medium text-white"
          />
        </Place>
        {pools.map((pool) => {
          const current = here === 'pool' && pool.id === poolId;
          return (
            <Place
              key={pool.id}
              current={current}
              label={current ? (poolLabel ?? pool.name) : pool.name}
              href={`/pool/${pool.id}`}
              onTap={current ? onPool : undefined}
              dot={pool.fresh && !current}
              data={{
                'data-strip-pool': pool.id,
                ...(current ? { 'data-pool-tab': '' } : {}),
              }}
            >
              <Monogram name={pool.name} size="nav" />
            </Place>
          );
        })}
        <Link
          href="/pool/new"
          aria-label="Open a new Pool"
          data-strip-new
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-white/40 text-white/80"
        >
          <Plus aria-hidden size={18} />
        </Link>
      </nav>
      <button
        type="button"
        aria-label="Drop a splash"
        data-compose
        onClick={onCompose}
        className="text-main-900 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
      >
        <Plus aria-hidden size={24} />
      </button>
    </div>
  );
}

/** One place on the strip: a link there, or — where I am — the view cycle. */
function Place({
  current,
  label,
  href,
  onTap,
  dot = false,
  data,
  children,
}: {
  current: boolean;
  label?: string;
  href: string;
  onTap?: () => void;
  dot?: boolean;
  data: Record<string, string>;
  children: ReactNode;
}) {
  // Selection is ink (H20f): a ring on the place I am in.
  const className = `relative flex shrink-0 rounded-full ${
    current ? 'ring-ink ring-[3px]' : ''
  }`;
  const body = (
    <>
      {children}
      {dot ? <UnseenDot label="New here" /> : null}
    </>
  );
  if (current) {
    return (
      <button
        type="button"
        aria-current="page"
        aria-label={label}
        data-strip-current=""
        onClick={onTap}
        className={className}
        {...data}
      >
        {body}
      </button>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className} {...data}>
      {body}
    </Link>
  );
}
