-- 0016: a joint ripple may take no lane of mine (2026-10-23).
--
-- Writing on a joint splash whose pool lane I have not linked, my ripple
-- now lives on the pool lane with no lane of mine — as a Just-mine splash
-- does — instead of asking for one. Linking that pool lane later moves my
-- earlier lane-less joint ripples on it into the linked lane, in the same
-- transaction as the link; unlinking moves nothing. Deleting a pool gives
-- each author one lane per pool lane for everything lane-less of theirs on
-- it, Just mine and joint alike.
--
-- Additive: three functions replaced, no table or column changed, every
-- existing row valid. Approved in the session by Yoonji (2026-10-23):
-- "Approved, go ahead with 0016, with one rule change" — "Linking a pool
-- lane to one of my lanes moves my existing lane-less joint ripples on that
-- pool lane into the linked lane, in the same transaction as the link.
-- Just-mine splashes are not affected; they stay lane-less. Unlinking moves
-- nothing" — "in delete_pool the grouped post's declared lane follows the
-- same rule [its most recent ripple's lane, else the lane made from the
-- pool lane], and each ripple keeps its own lane."

-- ---------------------------------------------------------------------------
-- (1) no lane of mine: on a Just-mine splash, or on a joint one
-- ---------------------------------------------------------------------------

create or replace function public.check_ripple_lane()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  own uuid;
  joint boolean := false;
begin
  if new.splash_id is not null then
    select own_pool_id, (owner_id is null and pool_id is not null)
      into own, joint
      from public.splashes where id = new.splash_id;
  end if;
  if new.category_id is null and own is null and not coalesce(joint, false) then
    raise exception 'a ripple needs one of your lanes' using errcode = '23514';
  end if;
  if new.category_id is not null and own is not null then
    raise exception 'a ripple on a Just-mine splash has no lane of yours' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- (2) linking moves my lane-less joint ripples into the linked lane
-- ---------------------------------------------------------------------------

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

  -- Linking a pool lane moves my lane-less joint ripples on it into the
  -- lane I linked (0016). Just-mine splashes stay lane-less; unlinking
  -- moves nothing — a ripple keeps the lane it has.
  update public.ripples r
     set category_id = m.my_category_id
    from public.splashes s, public.lane_mappings m
   where r.splash_id = s.id
     and r.author_id = uid
     and r.category_id is null
     and s.owner_id is null
     and s.pool_id = pid
     and m.user_id = uid
     and m.pool_id = pid
     and m.pool_lane_id = s.pool_lane_id;
end;
$$;

revoke execute on function public._set_links(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (3) delete_pool: one lane per author per pool lane, for everything
--     lane-less of theirs on it
-- ---------------------------------------------------------------------------

create or replace function public.delete_pool(p_pool uuid)
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
  made jsonb := '{}'::jsonb;
  sid uuid;
  latest uuid;
begin
  select * into pool from public.pools where id = p_pool for update;
  if pool.id is null then
    raise exception 'no such pool' using errcode = 'P0002';
  end if;
  if pool.owner_id is null or pool.owner_id <> uid then
    raise exception 'Only the Pool''s creator can delete it.' using errcode = '42501';
  end if;
  perform public._require_member(p_pool);
  perform set_config('weming.pool_teardown', 'on', true);

  -- One lane per author per pool lane that holds anything lane-less of
  -- theirs: Just-mine splashes, and joint ripples with no lane.
  for grp in
    select x.author, l.id as pool_lane_id, l.name, l.icon
      from (
        select s.owner_id as author, sp.pool_lane_id
          from public.splashes s
          join public.splash_placements sp on sp.splash_id = s.id and sp.pool_id = p_pool
         where s.own_pool_id = p_pool
        union
        select r.author_id, s.pool_lane_id
          from public.ripples r
          join public.splashes s on s.id = r.splash_id
         where s.pool_id = p_pool and s.owner_id is null and r.category_id is null
      ) x
      join public.pool_lanes l on l.id = x.pool_lane_id
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
    made := made || jsonb_build_object(grp.author || ':' || grp.pool_lane_id, cid);
  end loop;

  -- Just mine: into that lane.
  for grp in
    select s.id, s.owner_id as author, sp.pool_lane_id, l.name, l.icon
      from public.splashes s
      join public.splash_placements sp on sp.splash_id = s.id and sp.pool_id = p_pool
      join public.pool_lanes l on l.id = sp.pool_lane_id
     where s.own_pool_id = p_pool
  loop
    cid := (made ->> (grp.author || ':' || grp.pool_lane_id))::uuid;
    update public.splashes set own_pool_id = null, declared_lane_id = cid where id = grp.id;
    update public.ripples set category_id = cid where splash_id = grp.id;
    insert into public.splash_origins (splash_id, pool_name, pool_lane_name, pool_lane_icon)
    values (grp.id, pool.name, grp.name, grp.icon);
  end loop;

  -- Joint splashes: each author's ripples become one post of theirs, each
  -- ripple keeping its lane (a lane-less one taking the lane made from the
  -- pool lane); the post's declared lane is its most recent ripple's.
  for shell in
    select s.*, l.name as lane_name, l.icon as lane_icon
      from public.splashes s
      join public.pool_lanes l on l.id = s.pool_lane_id
     where s.pool_id = p_pool and s.owner_id is null
  loop
    for writer in
      select distinct author_id from public.ripples where splash_id = shell.id
    loop
      cid := (made ->> (writer || ':' || shell.pool_lane_id))::uuid;
      -- Lane first, while still on the joint shell (where no lane is allowed).
      update public.ripples set category_id = cid
       where splash_id = shell.id and author_id = writer and category_id is null;
      select category_id into latest
        from public.ripples
       where splash_id = shell.id and author_id = writer
       order by created_at desc, id desc
       limit 1;
      insert into public.splashes
        (owner_id, title, icon, declared_start, declared_end, declared_lane_id, created_at)
      values (
        writer,
        shell.title,
        shell.icon,
        shell.declared_start,
        shell.declared_end,
        latest,
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
   where sp.pool_id = p_pool
     and sp.shared
     and not exists (select 1 from public.splash_origins o where o.splash_id = sp.splash_id
                      and o.pool_name = pool.name and o.recorded_at = now());

  delete from public.pools where id = p_pool;
end;
$$;

revoke execute on function public.delete_pool(uuid) from public, anon;
grant execute on function public.delete_pool(uuid) to authenticated;
