-- 0010: the Pool path (SPEC 3, path 2), in RLS (H23).
--
-- A current member reads the pool, its members, its lanes and invites, the
-- placements and joint splashes in it, and the blocks under those — never a
-- locked one. A member reads only their own lane links. Nobody outside the
-- pool reads anything. A member who leaves loses access the moment left_at is
-- set; whether what they placed stays visible to the others follows
-- keep_on_leave, and nothing is deleted either way.
--
-- Destructive DDL: four policies from 0001 are dropped. They were owner-only
-- FOR ALL seats, and since permissive policies OR together, keeping them would
-- let a pool's creator delete the pool (cascading into every member's joint
-- ripples), manage members alone and edit joint splashes alone — a role this
-- phase does not have. Approved in the session by Yoonji (2026-10-23): "I
-- approve dropping these four policies from 0001: "pools belong to their
-- owner", "pool members are managed by the pool owner", "pool lanes are
-- managed by the pool owner", "splashes are managed by the pool owner"."

-- ---------------------------------------------------------------------------
-- helpers
--
-- SECURITY DEFINER for the reason 0001 gives: a policy's subquery is itself
-- under RLS, and reading membership through it would answer "not a member"
-- for exactly the rows the policy is deciding.
-- ---------------------------------------------------------------------------

-- Am I in this pool now? Every pool permission goes through here, so roles
-- later are a change to this function and a column, not to the data.
create function public.is_current_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
      from public.pool_members m
     where m.pool_id = pid
       and m.user_id = auth.uid()
       and m.left_at is null
  );
$$;

-- May this person's records be seen in this pool: a member now, or one who
-- left and chose to keep them.
create function public.member_visible(pid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.pool_members m
     where m.pool_id = pid
       and m.user_id = uid
       and (m.left_at is null or m.keep_on_leave)
  );
$$;

-- Do we share a pool I am still in? Former members count on their side, so a
-- kept record can still say whose it was.
create function public.shares_pool(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.pool_members mine
      join public.pool_members theirs on theirs.pool_id = mine.pool_id
     where mine.user_id = auth.uid()
       and mine.left_at is null
       and theirs.user_id = other
  );
$$;

create function public.splash_owner(sid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from public.splashes where id = sid;
$$;

-- Can I see this post through a pool: placed, switched on, in a pool I am in,
-- by someone whose records are visible there; or a joint splash of my pool.
create function public.splash_in_my_pools(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.splashes s
     where s.id = sid
       and (
         (s.owner_id is null and public.is_current_member(s.pool_id))
         or exists (
           select 1
             from public.splash_placements p
            where p.splash_id = s.id
              and p.shared
              and public.is_current_member(p.pool_id)
              and public.member_visible(p.pool_id, s.owner_id)
         )
       )
  );
$$;

-- A block seen through a pool. Lock always wins: "only me" means only me,
-- in a pool as anywhere. A block on a placed post is visible with the post;
-- a block on a joint splash follows its own author's membership, because a
-- joint splash holds several people's words.
create function public.ripple_in_my_pools(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ripples r
      join public.splashes s on s.id = r.splash_id
     where r.id = rid
       and not public.ripple_is_locked(r.id)
       and (
         (s.owner_id is null
           and public.is_current_member(s.pool_id)
           and public.member_visible(s.pool_id, r.author_id))
         or (s.owner_id = r.author_id and public.splash_in_my_pools(s.id))
       )
  );
$$;

-- Where may I write a block: my own post, or a joint splash of a pool I am
-- in now. Nobody writes into someone else's post.
create function public.splash_writable(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.splashes s
     where s.id = sid
       and (
         s.owner_id = auth.uid()
         or (s.owner_id is null and public.is_current_member(s.pool_id))
       )
  );
$$;

-- Have I linked one of my lanes to this pool lane? C5: an explicit mapping is
-- the precondition of any leak, so a post cannot be placed (or switched back
-- on) in a pool lane I never connected.
create function public.lane_is_mine_in(plid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.lane_mappings m
     where m.pool_lane_id = plid
       and m.user_id = auth.uid()
  );
$$;

-- The media path asks this (0003): the pool path joins the Link path.
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
         or (public.is_linked(r.author_id) and not public.ripple_is_locked(r.id))
         or public.ripple_in_my_pools(r.id)
       )
  );
$$;

revoke execute on function public.is_current_member(uuid) from anon;
revoke execute on function public.member_visible(uuid, uuid) from anon;
revoke execute on function public.shares_pool(uuid) from anon;
revoke execute on function public.splash_owner(uuid) from anon;
revoke execute on function public.splash_in_my_pools(uuid) from anon;
revoke execute on function public.ripple_in_my_pools(uuid) from anon;
revoke execute on function public.splash_writable(uuid) from anon;
revoke execute on function public.lane_is_mine_in(uuid) from anon;

-- ---------------------------------------------------------------------------
-- the four reserved owner-only policies go (approved above)
-- ---------------------------------------------------------------------------

drop policy "pools belong to their owner" on public.pools;
drop policy "pool members are managed by the pool owner" on public.pool_members;
drop policy "pool lanes are managed by the pool owner" on public.pool_lanes;
drop policy "splashes are managed by the pool owner" on public.splashes;

-- ---------------------------------------------------------------------------
-- pools, pool_members — read by current members; written only through 0011
-- ---------------------------------------------------------------------------

create policy "pools are readable by current members"
  on public.pools for select
  using (public.is_current_member(id));

-- Former members' rows stay readable to current members: a kept record is
-- labelled "Former member", and Swimmers draws only the current ones.
create policy "pool members are readable by current members"
  on public.pool_members for select
  using (public.is_current_member(pool_id));

-- ---------------------------------------------------------------------------
-- pool_lanes — any member names the group's lanes (no roles yet)
-- ---------------------------------------------------------------------------

create policy "pool lanes are readable by current members"
  on public.pool_lanes for select
  using (public.is_current_member(pool_id));

create policy "pool lanes are added by current members"
  on public.pool_lanes for insert
  with check (public.is_current_member(pool_id));

create policy "pool lanes are edited by current members"
  on public.pool_lanes for update
  using (public.is_current_member(pool_id))
  with check (public.is_current_member(pool_id));

-- A lane is renamed, re-iconed, described and reordered; it never moves to
-- another pool.
revoke update on public.pool_lanes from authenticated, anon;
grant update (name, icon, description, position) on public.pool_lanes to authenticated;

-- ---------------------------------------------------------------------------
-- lane_mappings — mine alone (0001's owner policy stays); written only for a
-- lane of mine into a pool I am in
-- ---------------------------------------------------------------------------

create policy "lane mappings link my lane into my pool"
  on public.lane_mappings as restrictive for insert
  with check (
    public.is_current_member(pool_id)
    and exists (
      select 1 from public.my_categories c
       where c.id = my_category_id and c.user_id = auth.uid()
    )
  );

create policy "lane mappings stay my lane in my pool"
  on public.lane_mappings as restrictive for update
  with check (
    public.is_current_member(pool_id)
    and exists (
      select 1 from public.my_categories c
       where c.id = my_category_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- splash_placements
-- ---------------------------------------------------------------------------

create policy "placements are readable by the author and by members"
  on public.splash_placements for select
  using (
    public.splash_owner(splash_id) = auth.uid()
    or (
      shared
      and public.is_current_member(pool_id)
      and public.member_visible(pool_id, public.splash_owner(splash_id))
    )
  );

create policy "placements are made by the author in a pool they are in"
  on public.splash_placements for insert
  with check (
    public.splash_owner(splash_id) = auth.uid()
    and public.is_current_member(pool_id)
    and public.lane_is_mine_in(pool_lane_id)
  );

create policy "placements are switched by the author in a pool they are in"
  on public.splash_placements for update
  using (public.splash_owner(splash_id) = auth.uid())
  with check (
    public.splash_owner(splash_id) = auth.uid()
    and public.is_current_member(pool_id)
    and public.lane_is_mine_in(pool_lane_id)
  );

create policy "placements are removed by the author"
  on public.splash_placements for delete
  using (public.splash_owner(splash_id) = auth.uid());

revoke update on public.splash_placements from authenticated, anon;
grant update (shared, pool_lane_id, updated_at) on public.splash_placements to authenticated;

-- ---------------------------------------------------------------------------
-- splashes — placed and joint ones become readable; joint ones editable
-- ---------------------------------------------------------------------------

create policy "splashes are readable through my pools"
  on public.splashes for select
  using (public.splash_in_my_pools(id));

-- Title, icon, pin and declared date of a joint splash are the pool's to
-- edit. Creating and deleting go through 0011, where the rules live.
create policy "joint splashes are edited by current members"
  on public.splashes for update
  using (owner_id is null and public.is_current_member(pool_id))
  with check (owner_id is null and public.is_current_member(pool_id));

-- A joint splash stays in its pool, unowned, credited to who opened it. The
-- policy cannot see the old row, so the trigger holds what moving it would
-- leak: words written for one pool turning up in another.
create function public.hold_joint_splash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is null and (
    new.owner_id is not null
    or new.pool_id is distinct from old.pool_id
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'a joint splash stays in its pool' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger splashes_hold_joint
  before update on public.splashes
  for each row execute function public.hold_joint_splash();

-- ---------------------------------------------------------------------------
-- ripples — readable through pools; written only where writable
-- ---------------------------------------------------------------------------

create policy "ripples are readable through my pools"
  on public.ripples for select
  using (public.ripple_in_my_pools(id));

-- Restrictive: ANDed with the author policies. Until now nothing stopped a
-- write naming someone else's post; with pools, that would put my words on
-- a page other people read as theirs.
create policy "ripples are written only into writable splashes"
  on public.ripples as restrictive for insert
  with check (splash_id is null or public.splash_writable(splash_id));

create policy "ripples stay in writable splashes"
  on public.ripples as restrictive for update
  with check (splash_id is null or public.splash_writable(splash_id));

-- ---------------------------------------------------------------------------
-- profiles — a pool member's name and avatar (C3: never implies a Link)
-- ---------------------------------------------------------------------------

create policy "profiles are readable by pool companions"
  on public.profiles for select
  using (public.shares_pool(id));

-- ---------------------------------------------------------------------------
-- pool_invites — read by members; minted and revoked through 0011
-- ---------------------------------------------------------------------------

create policy "invites are readable by current members"
  on public.pool_invites for select
  using (public.is_current_member(pool_id));
