-- 0022: converting between personal, Just-mine and joint splashes (2026-10-23).
--
-- A splash changes kind only through these functions; each is one act that
-- checks membership and ownership itself and never trusts its arguments.
-- None deletes a ripple or changes a ripple's author.
--
--   splash_to_joint(splash, pool_lane)      mine (personal or Just mine), all
--                                           ripples mine, in that pool → joint
--   splash_to_mine(splash, my_lane[, place_on])
--                                           joint (only my ripples) or Just
--                                           mine → my personal splash
--   splash_to_just_mine(splash, pool_lane)  personal in that pool, or joint
--                                           with only my ripples → Just mine
--   set_splash_lane(splash, my_lane[, place_on])
--                                           personal stays personal; its pool
--                                           placements follow the new lane
--
-- `place_on` is the compose table's case from a pool screen (Just mine on,
-- a pool lane my lane is linked to in any direction): place it there,
-- shared, as composing would. Without it, Home's rule alone decides.
--
-- Rules (Yoonji, in the session):
--   * A ripple on a joint splash takes my lane linked to its pool lane when
--     the link brings in (both, in), else none (0016, 0017).
--   * Sharing follows a splash into a pool only when its lane sends there
--     (both, out); otherwise it stops being shared (the Audience chip can
--     still share it by hand).
--   * Any conversion clears the pin: a joint splash's pin is the pool's, a
--     personal one is mine alone. "Yes, clear pins on any conversion, both
--     directions."
--
-- The two triggers that hold a joint splash in its pool and a Just-mine
-- splash in its own are replaced to let these functions through, by a
-- transaction-local flag only a function can set (as delete_pool's
-- weming.pool_teardown). Additive otherwise: four functions.
-- Approved in the session (Yoonji, 2026-10-23): "1. Yes. … 2. Yes, use
-- splash_to_mine. … 3. Yes, clear pins on any conversion, both directions."

-- ---------------------------------------------------------------------------
-- the holds, with a way through for a conversion
-- ---------------------------------------------------------------------------

create or replace function public.hold_joint_splash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is null
     and coalesce(current_setting('weming.reshape', true), '') <> 'on'
     and (
       new.owner_id is not null
       or new.pool_id is distinct from old.pool_id
       or new.created_by is distinct from old.created_by
     ) then
    raise exception 'a joint splash stays in its pool' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.hold_own_pool()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.own_pool_id is distinct from old.own_pool_id
     and coalesce(current_setting('weming.pool_teardown', true), '') <> 'on'
     and coalesce(current_setting('weming.reshape', true), '') <> 'on' then
    raise exception 'a Just-mine splash stays in its pool' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.hold_own_pool_placement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  own uuid;
  splash_id uuid := coalesce(new.splash_id, old.splash_id);
begin
  select own_pool_id into own from public.splashes where id = splash_id;
  -- Not Just mine, or the splash itself is being deleted (the cascade runs
  -- after its row is gone), or the pool is torn down, or a conversion is
  -- reshaping it: no rule here.
  if own is null
     or coalesce(current_setting('weming.pool_teardown', true), '') = 'on'
     or coalesce(current_setting('weming.reshape', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' and new.pool_id <> own then
    raise exception 'a Just-mine splash lives in one pool' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.pool_id <> old.pool_id or not new.shared) then
    raise exception 'a Just-mine splash is always shared to its pool' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.pool_id = own then
    raise exception 'a Just-mine splash is always shared to its pool' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- shared checks
-- ---------------------------------------------------------------------------

-- Refuses unless every ripple on the splash is the caller's.
create function public._require_only_mine(sid uuid, uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.ripples where splash_id = sid and author_id <> uid) then
    raise exception 'others have written here' using errcode = '42501';
  end if;
end;
$$;

-- The pool lane my lane sends into in a pool (0019: at most one), or null.
create function public._sending_lane(pid uuid, uid uuid, cid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pool_lane_id from public.lane_mappings
   where pool_id = pid and user_id = uid and my_category_id = cid
     and direction in ('out', 'both')
   limit 1;
$$;

-- Places a splash of mine on a pool lane chosen in that pool, shared: the
-- lane must be in a pool I am in and linked to my lane in any direction.
create function public._place_on(sid uuid, uid uuid, cid uuid, plid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  select pool_id into pid from public.pool_lanes where id = plid;
  if pid is null then
    raise exception 'no such pool lane' using errcode = '42501';
  end if;
  perform public._require_member(pid);
  if not exists (
    select 1 from public.lane_mappings
     where user_id = uid and pool_id = pid and pool_lane_id = plid and my_category_id = cid
  ) then
    raise exception 'that pool lane is not linked to that lane of yours' using errcode = '42501';
  end if;
  insert into public.splash_placements (splash_id, pool_id, pool_lane_id, shared)
  values (sid, pid, plid, true)
  on conflict (splash_id, pool_id)
  do update set pool_lane_id = excluded.pool_lane_id, shared = true, updated_at = now();
end;
$$;

revoke execute on function public._place_on(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._require_only_mine(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._sending_lane(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- mine → joint
-- ---------------------------------------------------------------------------

create function public.splash_to_joint(p_splash uuid, p_pool_lane uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  s record;
  pid uuid;
begin
  select id, owner_id, own_pool_id into s from public.splashes where id = p_splash;
  if not found then
    raise exception 'that splash is gone' using errcode = 'P0002';
  end if;
  if s.owner_id is distinct from uid then
    raise exception 'only its author makes a splash joint' using errcode = '42501';
  end if;
  select pool_id into pid from public.pool_lanes where id = p_pool_lane;
  if pid is null then
    raise exception 'no such pool lane' using errcode = '42501';
  end if;
  perform public._require_member(pid);
  -- It must already be in that pool: Just mine there, or shared there.
  if s.own_pool_id is distinct from pid and not exists (
    select 1 from public.splash_placements
     where splash_id = p_splash and pool_id = pid and shared
  ) then
    raise exception 'this splash is not in that pool' using errcode = '42501';
  end if;
  perform public._require_only_mine(p_splash, uid);

  perform set_config('weming.reshape', 'on', true);
  -- Every pool it was shared to lets go of it; a joint splash is the pool's own.
  delete from public.splash_placements where splash_id = p_splash;
  delete from public.splash_origins where splash_id = p_splash;
  update public.splashes
     set owner_id = null,
         own_pool_id = null,
         pool_id = pid,
         pool_lane_id = p_pool_lane,
         created_by = uid,
         declared_lane_id = null,
         session_id = null,
         pinned_at = null
   where id = p_splash;
  update public.ripples r
     set category_id = (
       select m.my_category_id from public.lane_mappings m
        where m.user_id = uid and m.pool_id = pid and m.pool_lane_id = p_pool_lane
          and m.direction in ('both', 'in')
     )
   where r.splash_id = p_splash;
  perform set_config('weming.reshape', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- joint or Just mine → my personal splash
-- ---------------------------------------------------------------------------

create function public.splash_to_mine(p_splash uuid, p_my_lane uuid, p_place_on uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  s record;
  pid uuid;
  target uuid;
begin
  select id, owner_id, pool_id, own_pool_id into s from public.splashes where id = p_splash;
  if not found then
    raise exception 'that splash is gone' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.my_categories where id = p_my_lane and user_id = uid) then
    raise exception 'that lane is not yours' using errcode = '42501';
  end if;
  if s.owner_id is null then
    pid := s.pool_id;
    perform public._require_member(pid);
    perform public._require_only_mine(p_splash, uid);
  elsif s.own_pool_id is not null and s.owner_id = uid then
    pid := s.own_pool_id;
  else
    raise exception 'only a joint or Just-mine splash becomes yours this way' using errcode = '42501';
  end if;

  perform set_config('weming.reshape', 'on', true);
  delete from public.splash_placements where splash_id = p_splash;
  update public.splashes
     set owner_id = uid,
         pool_id = null,
         pool_lane_id = null,
         own_pool_id = null,
         declared_lane_id = p_my_lane,
         pinned_at = null
   where id = p_splash;
  update public.ripples set category_id = p_my_lane where splash_id = p_splash;
  if p_place_on is not null then
    -- Chosen in the pool (the compose table): placed there.
    perform public._place_on(p_splash, uid, p_my_lane, p_place_on);
  else
    -- From Home: it stays in its pool only where its lane sends.
    target := public._sending_lane(pid, uid, p_my_lane);
    if target is not null and exists (
      select 1 from public.pool_members where pool_id = pid and user_id = uid and left_at is null
    ) then
      insert into public.splash_placements (splash_id, pool_id, pool_lane_id, shared)
      values (p_splash, pid, target, true);
    end if;
  end if;
  perform set_config('weming.reshape', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- personal in a pool, or joint with only my ripples → Just mine
-- ---------------------------------------------------------------------------

create function public.splash_to_just_mine(p_splash uuid, p_pool_lane uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  s record;
  pid uuid;
begin
  select id, owner_id, pool_id, own_pool_id into s from public.splashes where id = p_splash;
  if not found then
    raise exception 'that splash is gone' using errcode = 'P0002';
  end if;
  select pool_id into pid from public.pool_lanes where id = p_pool_lane;
  if pid is null then
    raise exception 'no such pool lane' using errcode = '42501';
  end if;
  perform public._require_member(pid);
  if s.owner_id is null then
    if s.pool_id <> pid then
      raise exception 'a joint splash stays in its pool' using errcode = '42501';
    end if;
    perform public._require_only_mine(p_splash, uid);
  elsif s.owner_id = uid and s.own_pool_id is null then
    if not exists (
      select 1 from public.splash_placements
       where splash_id = p_splash and pool_id = pid and shared
    ) then
      raise exception 'this splash is not in that pool' using errcode = '42501';
    end if;
    perform public._require_only_mine(p_splash, uid);
  else
    raise exception 'only your splash in this pool becomes Just mine' using errcode = '42501';
  end if;

  perform set_config('weming.reshape', 'on', true);
  -- Just mine lives in one pool: every other placement goes.
  delete from public.splash_placements where splash_id = p_splash;
  update public.splashes
     set owner_id = uid,
         pool_id = null,
         pool_lane_id = null,
         own_pool_id = pid,
         declared_lane_id = null,
         session_id = null,
         pinned_at = null
   where id = p_splash;
  update public.ripples set category_id = null where splash_id = p_splash;
  insert into public.splash_placements (splash_id, pool_id, pool_lane_id, shared)
  values (p_splash, pid, p_pool_lane, true);
  perform set_config('weming.reshape', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- personal stays personal: a new lane, and its placements follow it
-- ---------------------------------------------------------------------------

create function public.set_splash_lane(p_splash uuid, p_my_lane uuid, p_place_on uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  p record;
  target uuid;
begin
  if not exists (
    select 1 from public.splashes
     where id = p_splash and owner_id = uid and own_pool_id is null
  ) then
    raise exception 'only your own splash changes lane this way' using errcode = '42501';
  end if;
  if p_my_lane is not null
     and not exists (select 1 from public.my_categories where id = p_my_lane and user_id = uid) then
    raise exception 'that lane is not yours' using errcode = '42501';
  end if;

  update public.splashes set declared_lane_id = p_my_lane where id = p_splash;
  -- Each pool it is shared to: it moves to the pool lane the new lane sends
  -- into, or it stops being shared there (kept, switched off, as unlinking).
  for p in
    select pool_id, pool_lane_id from public.splash_placements
     where splash_id = p_splash and shared
  loop
    target := case when p_my_lane is null then null
                   else public._sending_lane(p.pool_id, uid, p_my_lane) end;
    if target is not null then
      update public.splash_placements
         set pool_lane_id = target, updated_at = now()
       where splash_id = p_splash and pool_id = p.pool_id;
    else
      update public.splash_placements
         set shared = false, updated_at = now()
       where splash_id = p_splash and pool_id = p.pool_id;
    end if;
  end loop;
  if p_place_on is not null then
    if p_my_lane is null then
      raise exception 'a placement needs a lane of yours' using errcode = '42501';
    end if;
    perform public._place_on(p_splash, uid, p_my_lane, p_place_on);
  end if;
end;
$$;

revoke execute on function public.splash_to_joint(uuid, uuid) from public, anon;
revoke execute on function public.splash_to_mine(uuid, uuid, uuid) from public, anon;
revoke execute on function public.splash_to_just_mine(uuid, uuid) from public, anon;
revoke execute on function public.set_splash_lane(uuid, uuid, uuid) from public, anon;
grant execute on function public.splash_to_joint(uuid, uuid) to authenticated;
grant execute on function public.splash_to_mine(uuid, uuid, uuid) to authenticated;
grant execute on function public.splash_to_just_mine(uuid, uuid) to authenticated;
grant execute on function public.set_splash_lane(uuid, uuid, uuid) to authenticated;
