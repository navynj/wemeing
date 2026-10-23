-- 0014: "Just mine" — my splash on a pool lane, with no lane of mine (2026-10-23).
--
-- A third kind of record beside a post in my lane (placed by a link) and a
-- joint splash (owned by the pool): my own splash, owner me, that lives on
-- one pool lane of one pool and is linked to no lane of mine. Its ripples
-- have no lane of mine either.
--
-- Additive: one column relaxed, one column added, triggers, one function.
-- Nothing dropped or narrowed; every existing row stays valid (no row has
-- own_pool_id, and every ripple has a lane). Approved in the session by
-- Yoonji (2026-10-23): "Add splashes.own_pool_id as you proposed, with the
-- triggers and the deferred check. Approved."

-- A ripple may have no lane of mine — only on a Just-mine splash (below).
alter table public.ripples alter column category_id drop not null;

-- RESTRICT: a pool cannot vanish from under a Just-mine splash; deleting a
-- pool moves them into a lane of their author's first (delete_pool, later).
alter table public.splashes
  add column own_pool_id uuid references public.pools (id) on delete restrict,
  add constraint splashes_own_pool_shape check (
    own_pool_id is null
    or (owner_id is not null and pool_id is null and pool_lane_id is null
        and declared_lane_id is null)
  );

comment on column public.splashes.own_pool_id is
  'Set on a "Just mine" splash: mine, living on one pool lane of this pool, linked to no lane of mine. Always placed and shared there; its ripples have no category.';

create index splashes_own_pool_idx on public.splashes (own_pool_id) where own_pool_id is not null;

-- ---------------------------------------------------------------------------
-- ripples: no lane of mine exactly where the splash is Just mine
-- ---------------------------------------------------------------------------

create function public.check_ripple_lane()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  own uuid;
begin
  if new.splash_id is not null then
    select own_pool_id into own from public.splashes where id = new.splash_id;
  end if;
  if new.category_id is null and own is null then
    raise exception 'a ripple needs one of your lanes' using errcode = '23514';
  end if;
  if new.category_id is not null and own is not null then
    raise exception 'a ripple on a Just-mine splash has no lane of yours' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ripples_check_lane
  before insert or update of category_id, splash_id on public.ripples
  for each row execute function public.check_ripple_lane();

-- ---------------------------------------------------------------------------
-- splashes: Just mine is decided at creation; only a pool's teardown undoes it
-- ---------------------------------------------------------------------------

create function public.hold_own_pool()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.own_pool_id is distinct from old.own_pool_id
     and coalesce(current_setting('weming.pool_teardown', true), '') <> 'on' then
    raise exception 'a Just-mine splash stays in its pool' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger splashes_hold_own_pool
  before update of own_pool_id on public.splashes
  for each row execute function public.hold_own_pool();

-- At commit: a Just-mine splash is placed, shared, in its pool.
create function public.check_own_pool_placed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.own_pool_id is not null and not exists (
    select 1 from public.splash_placements p
     where p.splash_id = new.id and p.pool_id = new.own_pool_id and p.shared
  ) then
    raise exception 'a Just-mine splash must be placed in its pool' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger splashes_own_pool_placed
  after insert or update of own_pool_id on public.splashes
  deferrable initially deferred
  for each row execute function public.check_own_pool_placed();

-- ---------------------------------------------------------------------------
-- placements: a Just-mine splash's one placement stays, shared, in its pool
-- ---------------------------------------------------------------------------

create function public.hold_own_pool_placement()
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
  -- after its row is gone), or the pool is being torn down: no rule here.
  if own is null or coalesce(current_setting('weming.pool_teardown', true), '') = 'on' then
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

create trigger splash_placements_hold_own_pool
  before insert or update or delete on public.splash_placements
  for each row execute function public.hold_own_pool_placement();

-- ---------------------------------------------------------------------------
-- the door: a Just-mine splash and its placement, as one act
-- ---------------------------------------------------------------------------

-- The placement policy admits only a pool lane I linked (C5); Just mine is
-- by definition unlinked, so its one placement is made here, for a current
-- member, on a lane of that pool. The first ripple follows through the
-- ordinary insert, with no lane.
create function public.create_own_pool_splash(
  p_id uuid,
  p_pool uuid,
  p_pool_lane uuid,
  p_title text,
  p_icon text default null,
  p_declared_start date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_member(p_pool);
  sid uuid;
begin
  if not exists (select 1 from public.pool_lanes where id = p_pool_lane and pool_id = p_pool) then
    raise exception 'pool lane is not in this pool' using errcode = '42501';
  end if;

  insert into public.splashes (id, owner_id, own_pool_id, title, icon, declared_start)
  values (
    coalesce(p_id, gen_random_uuid()),
    uid,
    p_pool,
    coalesce(btrim(p_title), ''),
    nullif(btrim(coalesce(p_icon, '')), ''),
    p_declared_start
  )
  returning id into sid;

  insert into public.splash_placements (splash_id, pool_id, pool_lane_id, shared)
  values (sid, p_pool, p_pool_lane, true);
  return sid;
end;
$$;

revoke execute on function public.create_own_pool_splash(uuid, uuid, uuid, text, text, date) from public, anon;
grant execute on function public.create_own_pool_splash(uuid, uuid, uuid, text, text, date) to authenticated;
