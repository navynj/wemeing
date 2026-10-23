'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Person } from '@/lib/queries/people';

/** My face as I just saved it, until the re-read has it (CLAUDE.md, the principle). */
export type PendingMe = { name: string; photo: string | null };

type PeopleApi = {
  me: string | null;
  people: Record<string, Person>;
  markMe: (pending: PendingMe) => void;
  clearMe: () => void;
};

// Outside the shell (a render test, the join page) a face is its initials.
const Context = createContext<PeopleApi>({
  me: null,
  people: {},
  markMe: () => {},
  clearMe: () => {},
});

/**
 * Every face the shell draws (0018): a name and a signed photo per person,
 * loaded once by the shell's layout. My own edit overlays it at once, so a
 * new photo or name shows on every surface before the server has it.
 */
export function PeopleProvider({
  me,
  people,
  children,
}: {
  me: string | null;
  people: Record<string, Person>;
  children: ReactNode;
}) {
  const [pending, setPending] = useState<PendingMe | null>(null);
  const api = useMemo<PeopleApi>(
    () => ({
      me,
      people: me && pending ? { ...people, [me]: pending } : people,
      markMe: setPending,
      clearMe: () => setPending(null),
    }),
    [me, people, pending],
  );
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function usePeople(): PeopleApi {
  return useContext(Context);
}

/** A person's face, or null when the shell does not know them. */
export function usePerson(id: string | null | undefined): Person | null {
  const { people } = usePeople();
  return id ? (people[id] ?? null) : null;
}
