-- 0023: Link retires; pools are the one way to share (2026-10-23).
--
-- One sharing model: a pool's settings are the single place that decides who
-- sees what. A link between two people no longer lets either read the
-- other's ripples, splashes, media or profile. Following someone is a pool
-- of two; discovery comes later from Open pools.
--
-- Production holds no links (0 rows, checked before the push), so nothing
-- anyone can see today changes. The links table, its rows, its read and
-- delete policies and is_linked stay, unused; no new link can be made.
--
-- Approved in the session (Yoonji, 2026-10-23), quoted:
--   "I approve migration 0023: drop the policies "ripples are readable by
--   author, and by links unless locked" and "profiles are readable by self
--   and linked users", replacing them with author-only and self-only
--   versions; redefine can_see_ripple without the link branch; and also drop
--   the links insert policy. Keep the links table, its rows, its read and
--   delete policies, and is_linked, unused. Quote this approval in the
--   migration and the commit."

-- Ripples: the author; through pools, the pool policy (0010) as before.
drop policy "ripples are readable by author, and by links unless locked" on public.ripples;
create policy "ripples are readable by their author"
  on public.ripples for select
  using (author_id = auth.uid());

-- Profiles: myself; pool companions, the pool policy (0010) as before.
drop policy "profiles are readable by self and linked users" on public.profiles;
create policy "profiles are readable by self"
  on public.profiles for select
  using (id = auth.uid());

-- The visibility question (record_ripple_view; media signing goes through
-- the ripples policy itself): the author, or a ripple I see through a pool.
create or replace function public.can_see_ripple(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ripples r
     where r.id = rid
       and (
         r.author_id = auth.uid()
         or public.ripple_in_my_pools(r.id)
       )
  );
$$;

-- No new links: the table is kept, read and removable by either side.
drop policy "links are inserted by a participant" on public.links;

comment on table public.links is
  'Retired (0023): kept with its rows, granting nothing. Sharing is through pools.';
comment on function public.is_linked(uuid) is
  'Retired (0023): no policy or function reads it.';
