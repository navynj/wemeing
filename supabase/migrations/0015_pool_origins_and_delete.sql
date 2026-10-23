-- 0015: where a splash came from, and deleting a pool (2026-10-23).
--
-- (1) A placement remembers its pool's and pool lane's names. The tag a
--     splash shows — "<Pool> · <emoji> <pool lane>" — reads the live names
--     while its author is a member; the snapshot is what stays when they
--     leave, refreshed on a rename only for current members' placements, so
--     a leaver's tag freezes at the names they knew.
-- (2) splash_origins: one row per deleted pool a splash was in, written by
--     delete_pool before the placements go; owner-only; deleted with the
--     splash.
-- (3) delete_pool: the creator deletes a pool for everyone, and nobody's
--     words go with it — Just-mine splashes move into a new lane of their
--     author's made from the pool lane; each author's ripples on a joint
--     splash become one post of theirs with the shell's title and icon;
--     shared splashes stay where they are. Each keeps its origin.
--
-- Additive: three nullable columns, one table, triggers, one function.
-- Approved in the session by Yoonji (2026-10-23): "Placement snapshot
-- columns (origin_pool_name, origin_pool_lane_name, origin_pool_lane_icon)
-- with insert and rename triggers, current members only, backfill with
-- today's names: approved." / "splash_origins table with owner-only RLS, one
-- row per deleted pool, cascading with the splash: approved." / "For each
-- joint shell, each author gets one post holding all of their ripples from
-- that shell, in their original order. The post takes the shell's title and
-- icon (not untitled) and its origin row." / "Just-mine splashes go to the
-- new lane created from the pool lane, not Day." / "delete_pool checks the
-- caller is pools.owner_id and a current member." / "Pools with a null owner
-- cannot be deleted for now."
--
-- Photos: a joint shell holds none (photos live on ripples, which are all
-- kept), so deleting a pool leaves no file without its row.

-- ---------------------------------------------------------------------------
-- (1) the placement's snapshot
-- ---------------------------------------------------------------------------

alter table public.splash_placements
  add column origin_pool_name text,
  add column origin_pool_lane_name text,
  add column origin_pool_lane_icon text;

comment on column public.splash_placements.origin_pool_name is
  'The pool''s name as last known to the placement''s author: written on placement, refreshed on rename only while they are a member, frozen when they leave.';

-- Written on placement, and when a placement moves to another pool lane.
create function public.snapshot_placement_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.name, l.name, l.icon
    into new.origin_pool_name, new.origin_pool_lane_name, new.origin_pool_lane_icon
    from public.pools p
    join public.pool_lanes l on l.pool_id = p.id
   where p.id = new.pool_id and l.id = new.pool_lane_id;
  return new;
end;
$$;

create trigger splash_placements_snapshot_origin
  before insert or update of pool_lane_id on public.splash_placements
  for each row execute function public.snapshot_placement_origin();

-- A rename reaches current members' placements only; a leaver's snapshot
-- keeps the names they knew.
create function public.refresh_pool_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.splash_placements sp
     set origin_pool_name = new.name
    from public.splashes s
   where sp.pool_id = new.id
     and s.id = sp.splash_id
     and exists (
       select 1 from public.pool_members m
        where m.pool_id = new.id and m.user_id = s.owner_id and m.left_at is null
     );
  return null;
end;
$$;

create trigger pools_refresh_origin
  after update of name on public.pools
  for each row
  when (new.name is distinct from old.name)
  execute function public.refresh_pool_origin();

create function public.refresh_pool_lane_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.splash_placements sp
     set origin_pool_lane_name = new.name,
         origin_pool_lane_icon = new.icon
    from public.splashes s
   where sp.pool_lane_id = new.id
     and s.id = sp.splash_id
     and exists (
       select 1 from public.pool_members m
        where m.pool_id = new.pool_id and m.user_id = s.owner_id and m.left_at is null
     );
  return null;
end;
$$;

create trigger pool_lanes_refresh_origin
  after update of name, icon on public.pool_lanes
  for each row
  when (new.name is distinct from old.name or new.icon is distinct from old.icon)
  execute function public.refresh_pool_lane_origin();

-- Backfill with today's names. The Just-mine guard only stops a placement
-- leaving its pool or going off; this changes neither.
update public.splash_placements sp
   set origin_pool_name = p.name,
       origin_pool_lane_name = l.name,
       origin_pool_lane_icon = l.icon
  from public.pools p, public.pool_lanes l
 where p.id = sp.pool_id and l.id = sp.pool_lane_id;

-- ---------------------------------------------------------------------------
-- (2) splash_origins — a deleted pool, remembered on the splash
-- ---------------------------------------------------------------------------

create table public.splash_origins (
  id uuid primary key default gen_random_uuid(),
  splash_id uuid not null references public.splashes (id) on delete cascade,
  pool_name text not null,
  pool_lane_name text not null,
  pool_lane_icon text,
  recorded_at timestamptz not null default now()
);

create index splash_origins_splash_idx on public.splash_origins (splash_id);

alter table public.splash_origins enable row level security;

-- Owner-only. Written only by delete_pool; never edited.
create policy "origins are readable by the splash's owner"
  on public.splash_origins for select
  using (public.splash_owner(splash_id) = auth.uid());

create policy "origins are removed by the splash's owner"
  on public.splash_origins for delete
  using (public.splash_owner(splash_id) = auth.uid());

-- ---------------------------------------------------------------------------
-- (3) delete_pool
-- ---------------------------------------------------------------------------

create function public.delete_pool(p_pool uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  pool public.pools%rowtype;
  grp record;
  shell record;
  writer uuid;
  lane_name text;
  n integer;
  cid uuid;
  ids uuid[];
  sid uuid;
begin
  select * into pool from public.pools where id = p_pool for update;
  if pool.id is null then
    raise exception 'no such pool' using errcode = 'P0002';
  end if;
  -- Only the creator, and only while still in it; a pool whose creator's
  -- account is gone cannot be deleted for now.
  if pool.owner_id is null or pool.owner_id <> uid then
    raise exception 'Only the Pool''s creator can delete it.' using errcode = '42501';
  end if;
  perform public._require_member(p_pool);

  -- Lets the Just-mine guards stand aside for this transaction only.
  perform set_config('weming.pool_teardown', 'on', true);

  -- Just mine: one new lane per author per pool lane, from the pool lane.
  for grp in
    select s.owner_id as author, l.id as pool_lane_id, l.name, l.icon,
           array_agg(s.id) as splash_ids
      from public.splashes s
      join public.splash_placements sp on sp.splash_id = s.id and sp.pool_id = p_pool
      join public.pool_lanes l on l.id = sp.pool_lane_id
     where s.own_pool_id = p_pool
     group by s.owner_id, l.id, l.name, l.icon
  loop
    lane_name := grp.name;
    if exists (select 1 from public.my_categories where user_id = grp.author and name = lane_name) then
      lane_name := grp.name || ' (' || pool.name || ')';
      n := 2;
      while exists (select 1 from public.my_categories where user_id = grp.author and name = lane_name) loop
        lane_name := grp.name || ' (' || pool.name || ' ' || n || ')';
        n := n + 1;
      end loop;
    end if;
    insert into public.my_categories (user_id, name, icon, position)
    values (
      grp.author,
      lane_name,
      grp.icon,
      coalesce((select max(position) + 1 from public.my_categories where user_id = grp.author), 0)
    )
    returning id into cid;

    ids := grp.splash_ids;
    update public.splashes set own_pool_id = null, declared_lane_id = cid where id = any(ids);
    update public.ripples set category_id = cid where splash_id = any(ids);
    insert into public.splash_origins (splash_id, pool_name, pool_lane_name, pool_lane_icon)
    select unnest(ids), pool.name, grp.name, grp.icon;
  end loop;

  -- Joint splashes: each author's ripples become one post of theirs, with
  -- the shell's title, icon and declared dates; the shell goes.
  for shell in
    select s.*, l.name as lane_name, l.icon as lane_icon
      from public.splashes s
      join public.pool_lanes l on l.id = s.pool_lane_id
     where s.pool_id = p_pool and s.owner_id is null
  loop
    for writer in
      select distinct author_id from public.ripples where splash_id = shell.id
    loop
      insert into public.splashes (owner_id, title, icon, declared_start, declared_end, created_at)
      values (
        writer,
        shell.title,
        shell.icon,
        shell.declared_start,
        shell.declared_end,
        (select min(created_at) from public.ripples where splash_id = shell.id and author_id = writer)
      )
      returning id into sid;
      update public.ripples set splash_id = sid where splash_id = shell.id and author_id = writer;
      insert into public.splash_origins (splash_id, pool_name, pool_lane_name, pool_lane_icon)
      values (sid, pool.name, shell.lane_name, shell.lane_icon);
    end loop;
    delete from public.splashes where id = shell.id;
  end loop;

  -- Shared splashes: untouched, but for where they came from.
  insert into public.splash_origins (splash_id, pool_name, pool_lane_name, pool_lane_icon)
  select sp.splash_id,
         coalesce(sp.origin_pool_name, pool.name),
         coalesce(sp.origin_pool_lane_name, l.name),
         coalesce(sp.origin_pool_lane_icon, l.icon)
    from public.splash_placements sp
    join public.pool_lanes l on l.id = sp.pool_lane_id
    join public.splashes s on s.id = sp.splash_id
   where sp.pool_id = p_pool
     and sp.shared
     and not exists (select 1 from public.splash_origins o where o.splash_id = sp.splash_id
                      and o.pool_name = pool.name and o.recorded_at = now());

  -- Members, lanes, links, placements and invites go with the pool.
  delete from public.pools where id = p_pool;
end;
$$;

revoke execute on function public.delete_pool(uuid) from public, anon;
grant execute on function public.delete_pool(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- (4) _set_links leaves Just-mine placements alone
-- ---------------------------------------------------------------------------

-- Found while rehearsing this migration: since 0014, unlinking a lane (or
-- rejoining with fewer links) switched off every placement of mine on an
-- unlinked pool lane — Just-mine ones included, which their guard refuses,
-- so the whole join or settings change failed. Same body, one more clause.
create or replace function public._set_links(pid uuid, uid uuid, p_links jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link jsonb;
  plid uuid;
  cid uuid;
begin
  if p_links is not null and jsonb_typeof(p_links) <> 'array' then
    raise exception 'links must be an array' using errcode = '22023';
  end if;

  delete from public.lane_mappings where pool_id = pid and user_id = uid;

  for link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    plid := (link ->> 'pool_lane_id')::uuid;
    cid := (link ->> 'my_category_id')::uuid;
    if cid is null then
      continue; -- "Don't connect"
    end if;
    if not exists (select 1 from public.pool_lanes where id = plid and pool_id = pid) then
      raise exception 'pool lane % is not in this pool', plid using errcode = '42501';
    end if;
    if not exists (select 1 from public.my_categories where id = cid and user_id = uid) then
      raise exception 'lane % is not yours', cid using errcode = '42501';
    end if;
    insert into public.lane_mappings (user_id, my_category_id, pool_lane_id, pool_id)
    values (uid, cid, plid, pid);
  end loop;

  -- A lane that is no longer linked stops leaking: its placements switch
  -- off (kept, so switching back on is the author's act, never a side
  -- effect of relinking).
  update public.splash_placements p
     set shared = false, updated_at = now()
    from public.splashes s
   where p.splash_id = s.id
     and s.owner_id = uid
     and p.pool_id = pid
     and p.shared
     -- A Just-mine splash is linked to no lane of mine by definition and
     -- always shared to its pool (0014): unlinking a lane never touches it.
     and s.own_pool_id is null
     and not exists (
       select 1 from public.lane_mappings m
        where m.user_id = uid and m.pool_lane_id = p.pool_lane_id
     );
end;
$$;

revoke execute on function public._set_links(uuid, uuid, jsonb) from public, anon, authenticated;
