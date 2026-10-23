-- 0017: a lane link has a direction (2026-10-23).
--
--   out  — my lane → pool lane: splashes in my lane are shared here by
--          default; my joint ripples on the pool lane take no lane of mine.
--   both — my lane ↔ pool lane (the default): shared by default, and my
--          joint ripples on the pool lane take my lane.
--   in   — my lane ← pool lane: not shared by default (the Audience chip
--          can still share one splash), and my joint ripples take my lane.
--
-- On a change, old and new are compared link by link: gaining "in" moves
-- my lane-less joint ripples on that pool lane into my lane; losing "out"
-- switches off my placements from it (only when the direction actually
-- changes, so a splash shared by hand under "in" survives a later save of
-- other links); unlinking still switches off what has no link at all;
-- gaining "out" shares nothing retroactively. "Include my earlier records"
-- places only from out and both links.
--
-- Additive: one type, one column (default both, so every existing link is
-- both), two functions replaced. Approved in the session by Yoonji
-- (2026-10-23): "Go ahead with 0017 on your terms: compare old and new for
-- "losing out", and show the caption always."

create type public.lane_link_direction as enum ('out', 'both', 'in');

alter table public.lane_mappings
  add column direction public.lane_link_direction not null default 'both';

comment on column public.lane_mappings.direction is
  'out: my lane shares into the pool lane by default; in: the pool lane''s joint ripples of mine take my lane, nothing shared by default; both: the two.';

-- ---------------------------------------------------------------------------
-- _set_links: directions, compared old to new
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
  dir public.lane_link_direction;
  before jsonb;
begin
  if p_links is not null and jsonb_typeof(p_links) <> 'array' then
    raise exception 'links must be an array' using errcode = '22023';
  end if;

  -- The links as they were, pool lane → direction, to compare against.
  select coalesce(jsonb_object_agg(pool_lane_id::text, direction), '{}'::jsonb)
    into before
    from public.lane_mappings
   where pool_id = pid and user_id = uid;

  delete from public.lane_mappings where pool_id = pid and user_id = uid;

  for link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    plid := (link ->> 'pool_lane_id')::uuid;
    cid := (link ->> 'my_category_id')::uuid;
    if cid is null then
      continue; -- "Don't connect"
    end if;
    dir := coalesce(nullif(link ->> 'direction', ''), 'both')::public.lane_link_direction;
    if not exists (select 1 from public.pool_lanes where id = plid and pool_id = pid) then
      raise exception 'pool lane % is not in this pool', plid using errcode = '42501';
    end if;
    if not exists (select 1 from public.my_categories where id = cid and user_id = uid) then
      raise exception 'lane % is not yours', cid using errcode = '42501';
    end if;
    insert into public.lane_mappings (user_id, my_category_id, pool_lane_id, pool_id, direction)
    values (uid, cid, plid, pid, dir);
  end loop;

  -- Off: a placement on a pool lane with no link at all (C5), and one on a
  -- pool lane whose link just lost "out". A Just-mine splash is linked to no
  -- lane of mine and always shared (0014): never touched.
  update public.splash_placements p
     set shared = false, updated_at = now()
    from public.splashes s
   where p.splash_id = s.id
     and s.owner_id = uid
     and p.pool_id = pid
     and p.shared
     and s.own_pool_id is null
     and (
       not exists (
         select 1 from public.lane_mappings m
          where m.user_id = uid and m.pool_lane_id = p.pool_lane_id
       )
       or (
         before ->> p.pool_lane_id::text in ('out', 'both')
         and exists (
           select 1 from public.lane_mappings m
            where m.user_id = uid and m.pool_lane_id = p.pool_lane_id and m.direction = 'in'
         )
       )
     );

  -- In: my lane-less joint ripples on a pool lane linked both or in move
  -- into my lane (0016). Idempotent, so gaining "in" is the whole of it;
  -- losing "in" moves nothing.
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
     and m.pool_lane_id = s.pool_lane_id
     and m.direction in ('both', 'in');
end;
$$;

revoke execute on function public._set_links(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- _place_history: "Include my earlier records" places only what shares out
-- ---------------------------------------------------------------------------

create or replace function public._place_history(pid uuid, uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.splash_placements (splash_id, pool_id, pool_lane_id)
  select s.id, pid, m.pool_lane_id
    from public.splashes s
    join public.lane_mappings m
      on m.my_category_id = public._splash_lane(s.id)
     and m.user_id = uid
     and m.pool_id = pid
     and m.direction in ('out', 'both')
   where s.owner_id = uid
  on conflict (splash_id, pool_id) do nothing;
end;
$$;

revoke execute on function public._place_history(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_pool: a lane's link carries its direction (default both)
-- ---------------------------------------------------------------------------

create or replace function public.create_pool(
  p_name text,
  p_kind public.pool_kind,
  p_lanes jsonb,
  p_include_history boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  pid uuid;
  lane jsonb;
  ord bigint;
  plid uuid;
  links jsonb := '[]'::jsonb;
begin
  if p_lanes is null or jsonb_typeof(p_lanes) <> 'array'
     or jsonb_array_length(p_lanes) not between 1 and 12 then
    raise exception 'a pool needs between 1 and 12 lanes' using errcode = '22023';
  end if;

  insert into public.pools (name, kind, visibility, owner_id)
  values (btrim(p_name), p_kind, 'private', uid)
  returning id into pid;

  insert into public.pool_members (pool_id, user_id, include_history)
  values (pid, uid, coalesce(p_include_history, false));

  for lane, ord in select * from jsonb_array_elements(p_lanes) with ordinality loop
    insert into public.pool_lanes (pool_id, name, icon, description, position)
    values (
      pid,
      btrim(lane ->> 'name'),
      nullif(btrim(coalesce(lane ->> 'icon', '')), ''),
      nullif(btrim(coalesce(lane ->> 'description', '')), ''),
      ord - 1
    )
    returning id into plid;
    links := links || jsonb_build_array(jsonb_build_object(
      'pool_lane_id', plid,
      'my_category_id', lane ->> 'my_category_id',
      'direction', lane ->> 'direction'
    ));
  end loop;

  perform public._set_links(pid, uid, links);
  if coalesce(p_include_history, false) then
    perform public._place_history(pid, uid);
  end if;

  return pid;
end;
$$;
