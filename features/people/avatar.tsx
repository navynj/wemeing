'use client';

import type { CSSProperties } from 'react';

import { initialsOf } from '@/features/home/grid';

import { usePeople } from './people-provider';

/**
 * A person, wherever one is shown (0018): their photo, else their initials.
 * `id` finds them in the shell's faces, so a name or photo change reaches
 * every avatar at once; `initials` is what a caller already knew, drawn
 * when the shell does not know the person (or has no `id` to give).
 * `className` sizes and colours the disc; a photo fills it, cropped round.
 */
export function Avatar({
  id,
  initials,
  className = '',
  style,
}: {
  id?: string | null;
  initials: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { people } = usePeople();
  const person = id ? people[id] : undefined;
  if (person?.photo) {
    return (
      // A signed URL that is the same for a day (0018): the browser caches it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.photo}
        alt=""
        aria-hidden
        data-avatar-photo
        draggable={false}
        className={`${className} rounded-full object-cover`}
        style={style}
      />
    );
  }
  return (
    <span aria-hidden className={className} style={style}>
      {person ? initialsOf(person.name) : initials}
    </span>
  );
}

/** A person's initials as text (a mark's or a row's author label), current with their name. */
export function Initials({ id, initials }: { id?: string | null; initials: string }) {
  const { people } = usePeople();
  const person = id ? people[id] : undefined;
  return <>{person ? initialsOf(person.name) : initials}</>;
}

/** A person's name as text, current with their latest edit. */
export function PersonName({ id, name }: { id?: string | null; name: string }) {
  const { people } = usePeople();
  return <>{(id && people[id]?.name) || name}</>;
}
